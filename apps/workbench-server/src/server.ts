import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, realpath, stat } from "node:fs/promises";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

import { createConversationStore, type ConversationStore, type ConversationTurn } from "@ai-assist/conversation";
import { drawingGovernanceResultV2Schema, type F6OptimizationTargets, type F8ScenarioDraft, type hostActionClaimSchema, type hostActionRequestSchema, type hostActionResultSchema } from "@ai-assist/contracts";
import { acceptAttemptResult, canonicalSelectedWorksheetSetHash, createSessionStore, createToleranceTargetsPreview, openSessionStore, reduceSessionCommand, type F8SessionCommand, type F8SessionSnapshot, type ReviewContextIdentity, type ScenarioBaseline, type SessionArtifactReference, type SessionDeltaOperations } from "@ai-assist/workbench";
import { createTypedError } from "@ai-assist/contracts";
import { createHostActionStore } from "@ai-assist/workbench";
import { createF4WhatIfBaselineRequest, renderF3AdoReminder, runF4WhatIfCalculation } from "@ai-assist/workflow-runners";

interface RunnerArtifactReference {
  readonly artifactId: string;
  readonly kind: "f1_image" | "f3_report" | "f4_calculation" | "f5_report" | "f6_optimization" | "f6_report";
  readonly relativePath: string;
  readonly contentHash: string;
}

import { WorkbenchAuth, SESSION_COOKIE_NAME, type HostBearerOptions, type AuthenticatedRequest, type TestAuthentication } from "./auth.js";
import { createBrowserBootstrapRendezvous, renderBootstrapPage, renderBootstrapScript, type BrowserBootstrapRendezvous } from "./bootstrap.js";
import { applySecurityHeaders, isMutation, LOOPBACK_HOST, rejectIfUnsafeBrowserBoundary, safeErrorResponse } from "./security.js";
import { artifactsRoutes } from "./routes/artifacts.js";
import { commandsRoutes } from "./routes/commands.js";
import { conversationRoutes } from "./routes/conversation.js";
import { filesRoutes } from "./routes/files.js";
import { hostActionsRoutes } from "./routes/host-actions.js";
import { sessionsRoutes } from "./routes/sessions.js";
import { whatIfRoutes } from "./routes/what-if.js";
import { createPersistentWorkerQueue, type PersistentWorkerQueue, type PersistentWorkerQueueOptions, type QueueSessionStore, type StageJob } from "./sqlite-worker-queue.js";
import { createSqliteEventSource, type SqliteEventSource } from "./sse.js";

type HostActionClaim = ReturnType<typeof hostActionClaimSchema.parse>;
type HostActionRequest = ReturnType<typeof hostActionRequestSchema.parse>;
type HostActionResult = ReturnType<typeof hostActionResultSchema.parse>;

export interface StartWorkbenchServerOptions {
  readonly rootDir: string;
  readonly port?: number;
  readonly webAssetsRoot?: string;
  readonly skipWebAssets?: boolean;
  readonly bootstrap?: BrowserBootstrapRendezvous;
  readonly runner?: (job: StageJob) => Promise<unknown>;
  readonly queueFactory?: (options: PersistentWorkerQueueOptions) => Promise<PersistentWorkerQueue>;
  readonly whatIfService?: WhatIfService;
  readonly surfacePrepareService?: SurfacePrepareService;
}

export interface SurfacePrepareService {
  create(snapshot: F8SessionSnapshot, command: F8SessionCommand): Promise<Extract<HostActionRequest, { kind: "surface_validate" }>["prepareRequest"]>;
}

export interface WhatIfService {
  calculate(snapshot: F8SessionSnapshot, input: { readonly draftId: string; readonly worksheetName: string; readonly tableId: string; readonly sourceRow: number; readonly inputRevision: number; readonly patch: NonNullable<F8ScenarioDraft["change"]> }): Promise<F8ScenarioDraft>;
  createPromotionPreview(snapshot: F8SessionSnapshot, draft: F8ScenarioDraft): Promise<F6OptimizationTargets>;
}

export interface WorkbenchServer extends FastifyInstance {
  readonly listenOptions: { readonly host: string; readonly port: number };
  readonly bootstrap: BrowserBootstrapRendezvous;
  testAuthenticate(sessionId?: string): Promise<TestAuthentication>;
  issueHostBearer(sessionId: string, scopes: readonly string[], options?: HostBearerOptions): string;
  registerArtifactForTest(sessionId: string, artifactId: string, relativePath: string, fileName: string, classification: ArtifactClassification, mimeType: string): void;
  publishEventForTest(sessionId: string, eventName: string, payload: unknown): void;
}

export type ArtifactClassification = "public" | "confidential";

export interface ArtifactRegistry {
  authorize(sessionId: string, artifactId: string, relativePath: string, fileName: string, classification: ArtifactClassification, mimeType: string): void;
  read(sessionId: string, artifactId: string): { readonly relativePath: string; readonly fileName: string; readonly classification: ArtifactClassification; readonly mimeType: string } | undefined;
}

export interface SessionRegistry {
  create(sessionId: string): Promise<F8SessionSnapshot>;
  read(sessionId: string): Promise<F8SessionSnapshot | undefined>;
  applyCommand(command: F8SessionCommand): Promise<F8SessionSnapshot>;
  readCommandReceipt(sessionId: string, commandId: string): Promise<F8SessionSnapshot | undefined>;
}

export interface ConversationRegistry {
  append(turn: ConversationTurn): Promise<ConversationTurn>;
  read(sessionId: string): Promise<readonly ConversationTurn[]>;
  close(): Promise<void>;
}

export interface HostActionRegistry {
  create(request: HostActionRequest): Promise<HostActionRequest | undefined>;
  claim(sessionId: string, actionId: string, hostInstanceId: string): Promise<HostActionClaim | undefined>;
  complete(sessionId: string, result: HostActionResult): Promise<"accepted" | "rejected" | "duplicate">;
  read(sessionId: string, actionId: string): Promise<HostActionRequest | undefined>;
}

export interface EventSource {
  publish(sessionId: string, eventName: string, payload: unknown): void;
  replay(sessionId: string, afterEventId: string | undefined): readonly StoredEvent[];
  subscribe(sessionId: string, listener: (event: StoredEvent) => void, afterEventId?: string): () => void;
}

export interface StoredEvent {
  readonly id: string;
  readonly eventName: string;
  readonly payload: unknown;
}

export interface WorkbenchServerContext {
  readonly rootDir: string;
  readonly auth: WorkbenchAuth;
  readonly sessions: SessionRegistry;
  readonly conversation: ConversationRegistry;
  readonly hostActions: HostActionRegistry;
  readonly artifacts: ArtifactRegistry;
  readonly events: EventSource;
  readonly queue: PersistentWorkerQueue;
  calculateWhatIf(sessionId: string, input: { readonly draftId: string; readonly worksheetName: string; readonly tableId: string; readonly sourceRow: number; readonly inputRevision: number; readonly patch: NonNullable<F8ScenarioDraft["change"]> }): Promise<F8ScenarioDraft>;
  createWhatIfPromotion(sessionId: string, draftId: string): Promise<{ readonly draft: F8ScenarioDraft; readonly promotionPreview: F6OptimizationTargets }>;
  resolveManagedWorkbook(sessionId: string, artifactId: string): Promise<{ readonly fileName: string; readonly workbookBytes: Uint8Array }>;
  createPendingHostAction(snapshot: F8SessionSnapshot, command: F8SessionCommand): Promise<void>;
  enqueueActiveAttempt(snapshot: F8SessionSnapshot): Promise<void>;
  requireAuthenticated(request: FastifyRequest, reply: FastifyReply): AuthenticatedRequest | undefined;
  requireBrowserSession(request: FastifyRequest, reply: FastifyReply): AuthenticatedRequest | undefined;
  requireBrowserMutation(request: FastifyRequest, reply: FastifyReply): AuthenticatedRequest | undefined;
}

export async function buildWorkbenchServer(options: StartWorkbenchServerOptions): Promise<WorkbenchServer> {
  await mkdir(options.rootDir, { recursive: true });

  const auth = new WorkbenchAuth();
  const context = await createWorkbenchServerContext(options.rootDir, auth, options.runner, options.queueFactory, options.whatIfService, options.surfacePrepareService);
  const app = Fastify({ logger: false, bodyLimit: 1024 * 1024 }) as unknown as WorkbenchServer;
  const bootstrap = options.bootstrap ?? createBrowserBootstrapRendezvous();

  Object.defineProperties(app, {
    listenOptions: { value: { host: LOOPBACK_HOST, port: options.port ?? 0 }, enumerable: true },
    bootstrap: { value: bootstrap, enumerable: true },
    testAuthenticate: { value: async (sessionId?: string) => {
      const authentication = auth.issueBrowserSession(sessionId as `${string}-${string}-${string}-${string}-${string}` | undefined);
      if (await context.sessions.read(authentication.sessionId) === undefined) {
        await context.sessions.create(authentication.sessionId);
      }
      return authentication;
    }, enumerable: true },
    issueHostBearer: { value: (sessionId: string, scopes: readonly string[], bearerOptions?: HostBearerOptions) => auth.issueHostBearer(sessionId, scopes as never, bearerOptions), enumerable: true },
    registerArtifactForTest: { value: (sessionId: string, artifactId: string, relativePath: string, fileName: string, classification: ArtifactClassification, mimeType: string) => context.artifacts.authorize(sessionId, artifactId, relativePath, fileName, classification, mimeType), enumerable: true },
    publishEventForTest: { value: (sessionId: string, eventName: string, payload: unknown) => context.events.publish(sessionId, eventName, payload), enumerable: true },
  });

  app.addHook("onRequest", async (request, reply) => {
    applySecurityHeaders(reply);
    rejectIfUnsafeBrowserBoundary(request, reply);
  });

  await app.register(cookie, { hook: "onRequest" });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 8 } });

  app.get("/", async (request, reply) => {
    const authenticated = auth.authenticate(request);
    return reply.type("text/html; charset=utf-8").send(authenticated?.kind === "browser" ? renderWorkbenchPage() : renderBootstrapPage());
  });
  app.get("/bootstrap.js", async (_request, reply) => reply.type("application/javascript; charset=utf-8").send(renderBootstrapScript()));
  const webAssets = options.skipWebAssets === true
    ? missingWebAssets(options.webAssetsRoot ?? defaultWebAssetsRoot())
    : await openWebAssets(options.webAssetsRoot ?? defaultWebAssetsRoot());
  app.get("/workbench.js", async (_request, reply) => sendWebAsset(reply, webAssets, "workbench.js", "application/javascript; charset=utf-8"));
  app.get("/workbench.css", async (_request, reply) => sendWebAsset(reply, webAssets, "workbench.css", "text/css; charset=utf-8"));
  app.post("/api/bootstrap", async (request, reply) => {
    const nonce = (request.body as { readonly nonce?: unknown } | undefined)?.nonce;
    if (typeof nonce !== "string" || !(await bootstrap.consumeBrowserBootstrap(nonce))) {
      return reply.code(401).send({ error: "bootstrap_nonce_rejected" });
    }

    const session = auth.issueBrowserSession();
    return reply
      .setCookie(SESSION_COOKIE_NAME, session.cookieValue, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: false,
      })
      .code(204)
      .send();
  });
  app.get("/api/csrf", async (request, reply) => {
    const authenticated = context.requireBrowserSession(request, reply);
    if (authenticated === undefined) {
      return reply;
    }

    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const csrfToken = auth.readCsrfToken(authenticated.sessionId, cookies?.[SESSION_COOKIE_NAME]);
    return csrfToken === undefined ? reply.code(401).send({ error: "csrf_unavailable" }) : { csrfToken };
  });

  await app.register(sessionsRoutes, { context });
  await app.register(filesRoutes, { context });
  await app.register(commandsRoutes, { context });
  await app.register(conversationRoutes, { context });
  await app.register(hostActionsRoutes, { context });
  await app.register(artifactsRoutes, { context });
  await app.register(whatIfRoutes, { context });
  app.addHook("onClose", async () => {
    (context.events as SqliteEventSource).close();
    await context.conversation.close();
  });

  return app;
}

export async function startWorkbenchServer(options: StartWorkbenchServerOptions): Promise<{ readonly server: WorkbenchServer; readonly url: string; readonly bootstrapNonce: string }> {
  const server = await buildWorkbenchServer(options);
  await server.listen(server.listenOptions);
  const address = server.server.address();
  const port = typeof address === "object" && address !== null ? address.port : server.listenOptions.port;
  const bootstrapNonce = await server.bootstrap.issueBrowserBootstrap();
  return { server, url: `http://${LOOPBACK_HOST}:${port}/#bootstrap=${bootstrapNonce}`, bootstrapNonce };
}

async function createWorkbenchServerContext(rootDir: string, auth: WorkbenchAuth, runner: StartWorkbenchServerOptions["runner"], queueFactory: StartWorkbenchServerOptions["queueFactory"], whatIfService: WhatIfService | undefined, surfacePrepareService: SurfacePrepareService | undefined): Promise<WorkbenchServerContext> {
  const sessions = new StoreBackedSessionRegistry(rootDir);
  const artifacts = new FileBackedArtifactRegistry(rootDir);
  const effectiveWhatIfService = whatIfService ?? createDefaultWhatIfService(rootDir);
  const queueOptions = {
    rootDir: join(rootDir, "runtime", "workbench"),
    sessionStore: new StoreBackedQueueSessionStore(rootDir, sessions),
    ...(runner === undefined ? {} : { worker: runner }),
  } satisfies PersistentWorkerQueueOptions;
  const queue = await (queueFactory ?? createPersistentWorkerQueue)(queueOptions);
  await queue.reconcile();
  return {
    rootDir,
    auth,
    sessions,
    conversation: new SharedConversationRegistry(await createConversationStore({ rootDir: join(rootDir, "runtime", "workbench") })),
    hostActions: new SqliteHostActionRegistry(rootDir),
    artifacts,
    events: await createSqliteEventSource({ rootDir }),
    queue,
    async calculateWhatIf(sessionId, input) {
      const snapshot = await sessions.read(sessionId);
      if (snapshot === undefined || snapshot.state !== "review_required" || snapshot.inputRevision !== input.inputRevision) {
        throw createTypedError({ code: "evidence_mismatch", summary: "What-if input revision is not current.", suggestedAction: "Refresh the review before recalculating.", affectedInputReferences: [sessionId, input.draftId] });
      }
      return effectiveWhatIfService.calculate(snapshot, input);
    },
    async createWhatIfPromotion(sessionId, draftId) {
      const snapshot = await sessions.read(sessionId);
      const draft = snapshot?.scenarioDrafts?.findLast((candidate) => candidate.draftId === draftId && candidate.status === "saved");
      if (snapshot === undefined || draft?.status !== "saved") {
        throw createTypedError({ code: "evidence_mismatch", summary: "Saved What-if draft is unavailable for promotion.", suggestedAction: "Save a current tolerance-only draft before promotion.", affectedInputReferences: [sessionId, draftId] });
      }
      return { draft, promotionPreview: await effectiveWhatIfService.createPromotionPreview(snapshot, draft) };
    },
    async createPendingHostAction(snapshot, command) {
      if (snapshot.state !== "ado_action_pending" || command.command !== "confirm_ado_decision") return;
      const decision = (command.payload as { readonly decision: "create_new" | "use_existing" | "local_only" }).decision;
      if (decision === "local_only") return;
      const prepareRequest = surfacePrepareService === undefined
        ? await createDefaultSurfacePrepareRequest(rootDir, snapshot, command)
        : await surfacePrepareService.create(snapshot, command);
      const actionId = `ado-validation:${snapshot.sessionId}:${snapshot.revision}`;
      const confirmationHash = createHash("sha256").update(JSON.stringify(prepareRequest)).digest("hex");
      const created = await (new SqliteHostActionRegistry(rootDir)).create({
        contractVersion: "f8-host-action-request-v1",
        actionId,
        sessionId: snapshot.sessionId,
        expectedRevision: snapshot.revision,
        kind: "surface_validate",
        confirmationHash,
        expectedTargetVersion: "ado-decision-v1",
        prepareRequest,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      });
      if (created === undefined) {
        throw createTypedError({ code: "dependency_error", summary: "Unable to create the required ADO validation action.", suggestedAction: "Retry the ADO decision before continuing.", affectedInputReferences: [actionId] });
      }
    },
    async enqueueActiveAttempt(snapshot) {
      const attempt = snapshot.activeAttempt;
      if (attempt === null) return;
      const reviewContext = ["f5_running", "f6_running"].includes(attempt.stage)
        ? await persistedReviewContext(rootDir, snapshot)
        : undefined;
      const baselineRunReference = attempt.stage === "f4_running"
        ? validatedF2BaselineReference(snapshot)
        : undefined;
      await queue.enqueue({
        jobId: attempt.attemptId,
        attemptId: attempt.attemptId,
        kind: attempt.stage === "f1_f2_running" || attempt.stage === "f3_running" ? "excel" : "calculation",
        stage: attempt.stage,
        payload: {
          sessionId: snapshot.sessionId,
          ...(baselineRunReference === undefined ? {} : { baselineRunReference }),
          ...(reviewContext === undefined ? {} : { reviewContext }),
        },
      });
    },
    async resolveManagedWorkbook(sessionId, artifactId) {
      const artifact = artifacts.read(sessionId, artifactId);
      if (artifact === undefined || artifact.relativePath !== `uploads/${sessionId}/workbook/${artifactId}-${artifact.fileName}`) {
        throw createTypedError({
          code: "validation_error",
          summary: "Managed workbook reference is unavailable.",
          suggestedAction: "Upload the workbook again from this browser session.",
          affectedInputReferences: [artifactId],
        });
      }
      const handle = await open(resolve(rootDir, artifact.relativePath), "r");
      try {
        await assertOpenedFileContained(handle, rootDir, artifact.relativePath, `${artifactId}-${artifact.fileName}`);
        return { fileName: artifact.fileName, workbookBytes: new Uint8Array(await handle.readFile()) };
      } finally {
        await handle.close();
      }
    },
    requireAuthenticated(request, reply) {
      const authenticated = auth.authenticate(request);
      if (authenticated === undefined) {
        reply.code(request.headers.authorization === undefined ? 401 : 403).send({ error: "authentication_required" });
      }

      return authenticated;
    },
    requireBrowserSession(request, reply) {
      const authenticated = auth.authenticate(request);
      if (authenticated?.kind !== "browser") {
        reply.code(403).send({ error: "browser_session_required" });
        return undefined;
      }

      return authenticated;
    },
    requireBrowserMutation(request, reply) {
      const authenticated = auth.authenticate(request);
      if (authenticated?.kind !== "browser") {
        reply.code(403).send({ error: "csrf_required" });
        return undefined;
      }

      if (isMutation(request.method) && !auth.verifyCsrf(request, authenticated)) {
        reply.code(403).send({ error: "csrf_required" });
        return undefined;
      }

      return authenticated;
    },
  };
}

class StoreBackedSessionRegistry implements SessionRegistry {
  constructor(private readonly rootDir: string) {}

  async create(sessionId: string): Promise<F8SessionSnapshot> {
    const store = await createSessionStore({ rootDir: this.rootDir, sessionId });
    try {
      return await store.readSnapshot();
    } finally {
      await store.close();
    }
  }

  async read(sessionId: string): Promise<F8SessionSnapshot | undefined> {
    try {
      const store = await openSessionStore({ rootDir: this.rootDir, sessionId });
      try {
        return await store.readSnapshot();
      } finally {
        await store.close();
      }
    } catch {
      return undefined;
    }
  }

  async applyCommand(command: F8SessionCommand): Promise<F8SessionSnapshot> {
    const store = await openSessionStore({ rootDir: this.rootDir, sessionId: command.sessionId });
    try {
      return await store.applyCommand(command, async (snapshot, nextCommand) => ({ snapshot: reduceSessionCommand(snapshot, nextCommand) }));
    } finally {
      await store.close();
    }
  }

  async readCommandReceipt(sessionId: string, commandId: string): Promise<F8SessionSnapshot | undefined> {
    try {
      const store = await openSessionStore({ rootDir: this.rootDir, sessionId });
      try {
        return (await store.readCommandReceipt(commandId)) ?? undefined;
      } finally {
        await store.close();
      }
    } catch {
      return undefined;
    }
  }
}

class SharedConversationRegistry implements ConversationRegistry {
  constructor(private readonly store: ConversationStore) {}

  append(turn: ConversationTurn): Promise<ConversationTurn> {
    return this.store.appendTurn(turn, `web:${turn.turnId}`);
  }

  read(sessionId: string): Promise<readonly ConversationTurn[]> {
    return this.store.readTurns(sessionId);
  }

  close(): Promise<void> {
    return this.store.close();
  }
}

class SqliteHostActionRegistry implements HostActionRegistry {
  constructor(private readonly rootDir: string) {}

  async create(request: HostActionRequest): Promise<HostActionRequest | undefined> {
    try {
      const store = await createHostActionStore({ rootDir: this.rootDir, sessionId: request.sessionId });
      try {
        return await store.createHostAction(request);
      } finally {
        await store.close();
      }
    } catch (error) {
      if ((error as { code?: unknown }).code === "validation_error") return undefined;
      throw error;
    }
  }

  async claim(sessionId: string, actionId: string, hostInstanceId: string): Promise<HostActionClaim | undefined> {
    try {
      const store = await createHostActionStore({ rootDir: this.rootDir, sessionId });
      try {
        return await store.claimHostAction(actionId, hostInstanceId);
      } finally {
        await store.close();
      }
    } catch {
      return undefined;
    }
  }

  async complete(sessionId: string, result: HostActionResult): Promise<"accepted" | "rejected" | "duplicate"> {
    try {
      const store = await createHostActionStore({ rootDir: this.rootDir, sessionId });
      try {
        await store.completeHostAction(result);
        return "accepted";
      } finally {
        await store.close();
      }
    } catch (error) {
      return (error as { code?: unknown }).code === "policy_denied" ? "duplicate" : "rejected";
    }
  }

  async read(sessionId: string, actionId: string): Promise<HostActionRequest | undefined> {
    try {
      const store = await createHostActionStore({ rootDir: this.rootDir, sessionId });
      try {
        return (await store.getHostAction(actionId)).request;
      } finally {
        await store.close();
      }
    } catch {
      return undefined;
    }
  }
}

class FileBackedArtifactRegistry implements ArtifactRegistry {
  constructor(private readonly rootDir: string) {}

  authorize(sessionId: string, artifactId: string, relativePath: string, fileName: string, classification: ArtifactClassification, mimeType: string): void {
    const artifacts = readRegistry<Record<string, { readonly sessionId: string; readonly relativePath: string; readonly fileName: string; readonly classification: ArtifactClassification; readonly mimeType: string }>>(this.rootDir, "artifacts", sessionId) ?? {};
    writeRegistry(this.rootDir, "artifacts", sessionId, { ...artifacts, [artifactId]: { sessionId, relativePath, fileName, classification, mimeType } });
  }

  read(sessionId: string, artifactId: string): { readonly relativePath: string; readonly fileName: string; readonly classification: ArtifactClassification; readonly mimeType: string } | undefined {
    const artifact = readRegistry<Record<string, { readonly sessionId: string; readonly relativePath: string; readonly fileName: string; readonly classification: ArtifactClassification; readonly mimeType: string }>>(this.rootDir, "artifacts", sessionId)?.[artifactId];
    return artifact?.sessionId === sessionId ? artifact : undefined;
  }
}

function createDefaultWhatIfService(rootDir: string): WhatIfService {
  const loadBaseline = async (snapshot: F8SessionSnapshot, worksheetName: string) => {
    const references = snapshot.artifactRefs ?? [];
    const f2References = references.filter((reference) => reference.kind === "f2_report" && reference.revision === snapshot.inputRevision && reference.validated);
    const f4References = references.filter((reference) => reference.kind === "f4_calculation" && reference.revision === snapshot.inputRevision && reference.validated);
    if (f2References.length !== 1 || f4References.length !== 1) {
      throw createTypedError({ code: "evidence_mismatch", summary: "What-if requires one current validated F2 and F4 artifact.", suggestedAction: "Rerun F2 through F4 for the current workbook revision.", affectedInputReferences: [snapshot.sessionId] });
    }
    const [f2Report, f4Result] = await Promise.all([
      readSessionArtifactJson(rootDir, snapshot.sessionId, f2References[0]!.artifactId),
      readSessionArtifactJson(rootDir, snapshot.sessionId, f4References[0]!.artifactId),
    ]);
    const baselineRequest = createF4WhatIfBaselineRequest({ f2Report, f4Result, worksheetName });
    const worksheet = baselineRequest.worksheetAnalysisAssets.worksheets[0];
    const table = worksheet?.factorTables.find((candidate) => candidate.tableId === baselineRequest.worksheetSelection.tableId);
    if (worksheet?.worksheetName !== worksheetName || table === undefined) {
      throw createTypedError({ code: "evidence_mismatch", summary: "What-if worksheet baseline is unavailable.", suggestedAction: "Select a worksheet with a validated F4 baseline.", affectedInputReferences: [worksheetName] });
    }
    return { baselineRequest, table };
  };
  return {
    async calculate(snapshot, input) {
      const { baselineRequest, table } = await loadBaseline(snapshot, input.worksheetName);
      if (table.tableId !== input.tableId) throw new Error("What-if factor table identity does not match the governed baseline.");
      const row = table.rows.find((candidate) => candidate.sourceRow === input.sourceRow);
      if (row === undefined) throw new Error("What-if baseline has no factor row.");
      const result = runF4WhatIfCalculation({
        draftId: input.draftId,
        baselineRequest,
        factor: { worksheetName: input.worksheetName, tableId: table.tableId, sourceRow: row.sourceRow },
        patch: compactWhatIfPatch(input.patch),
      });
      if (result.status !== "completed") {
        throw createTypedError({ code: "calculation_not_possible", summary: "Signed direction evidence is required for nominal or mean-shift What-if calculation.", suggestedAction: "Use tolerance-only changes or provide governed signed direction evidence.", affectedInputReferences: [input.draftId] });
      }
      const factorName = availableTextValue(row.fields.factorName);
      const unit = row.fields.unit?.status === "available" ? row.fields.unit.rawText : "mm";
      if (typeof factorName !== "string" || factorName.length === 0) throw new Error("What-if factor identity is unavailable.");
      return {
        contractVersion: "f8-scenario-draft-v1", draftId: input.draftId, sessionId: snapshot.sessionId, worksheetName: input.worksheetName, inputRevision: snapshot.inputRevision, status: "calculated", mode: "WHAT_IF",
        baselineWorkbookHash: baselineRequest.worksheetAnalysisAssets.workbook.contentHash, baselineRunReference: baselineRequest.runReference, change: input.patch,
        calculationReference: result.calculationReference, calculationMetrics: result.metrics,
        factorIdentity: { worksheetName: input.worksheetName, tableId: table.tableId, sourceRow: row.sourceRow, factorName, unit },
      };
    },
    async createPromotionPreview(snapshot, draft) {
      if (draft.factorIdentity === undefined) throw new Error("What-if factor identity is unavailable.");
      const { baselineRequest, table } = await loadBaseline(snapshot, draft.worksheetName);
      const row = table.rows.find((candidate) => candidate.sourceRow === draft.factorIdentity!.sourceRow);
      const nominalValue = availableNumberValue(row?.fields.nominalValue);
      const upperTolerance = availableNumberValue(row?.fields.upperTolerance);
      const lowerTolerance = availableNumberValue(row?.fields.lowerTolerance);
      if (row === undefined || nominalValue === undefined || upperTolerance === undefined || lowerTolerance === undefined) {
        throw new Error("What-if baseline factor values are unavailable.");
      }
      const baseline: ScenarioBaseline = {
        workbookContentHash: baselineRequest.worksheetAnalysisAssets.workbook.contentHash,
        baselineRunReference: baselineRequest.runReference,
        calculationVersion: "excel-ta-v1",
        projectReference: baselineRequest.projectReference,
        worksheetName: draft.worksheetName,
        tableId: table.tableId,
        factor: { ...draft.factorIdentity, nominalValue, upperTolerance, lowerTolerance, additionalMeanShift: baselineRequest.systemSpecification.additionalMeanShift },
      };
      return createToleranceTargetsPreview(draft, baseline);
    },
  };
}

async function createDefaultSurfacePrepareRequest(
  rootDir: string,
  snapshot: F8SessionSnapshot,
  command: F8SessionCommand,
): Promise<Extract<HostActionRequest, { kind: "surface_validate" }>["prepareRequest"]> {
  const f3References = snapshot.artifactRefs?.filter((reference) => reference.kind === "f3_report" && reference.revision === snapshot.inputRevision && reference.validated) ?? [];
  if (f3References.length !== 1) throw reviewContextMismatch(snapshot, "Surface validation requires one current validated F3 report.");
  const report = drawingGovernanceResultV2Schema.parse(await readSessionArtifactJson(rootDir, snapshot.sessionId, f3References[0]!.artifactId));
  if (report.status === "input_rejected") throw reviewContextMismatch(snapshot, "Surface validation cannot use an input-rejected F3 report.");
  const nextContent = renderF3AdoReminder(report);
  const payload = command.payload as { readonly decision: "create_new" | "use_existing"; readonly workItemReference?: string };
  return payload.decision === "create_new"
    ? { mode: "create", title: `TA Drawing Governance - ${report.workbook.fileName}`, nextContent, factorCount: report.summary.factorCount }
    : { mode: "existing", workItemReference: payload.workItemReference!, nextContent, factorCount: report.summary.factorCount };
}

function compactWhatIfPatch(patch: NonNullable<F8ScenarioDraft["change"]>): Parameters<typeof runF4WhatIfCalculation>[0]["patch"] {
  return {
    ...(patch.nominalValue === undefined ? {} : { nominalValue: patch.nominalValue }),
    ...(patch.upperTolerance === undefined ? {} : { upperTolerance: patch.upperTolerance }),
    ...(patch.lowerTolerance === undefined ? {} : { lowerTolerance: patch.lowerTolerance }),
    ...(patch.additionalMeanShift === undefined ? {} : { additionalMeanShift: patch.additionalMeanShift }),
  };
}

function availableTextValue(value: unknown): string | undefined {
  const candidate = value as { readonly status?: unknown; readonly rawText?: unknown } | undefined;
  return candidate?.status === "available" && typeof candidate.rawText === "string" && candidate.rawText.length > 0 ? candidate.rawText : undefined;
}

function availableNumberValue(value: unknown): number | undefined {
  const candidate = value as { readonly status?: unknown; readonly numericValue?: unknown } | undefined;
  return candidate?.status === "available" && typeof candidate.numericValue === "number" && Number.isFinite(candidate.numericValue) ? candidate.numericValue : undefined;
}

async function readSessionArtifactJson(rootDir: string, sessionId: string, artifactId: string): Promise<unknown> {
  const store = await openSessionStore({ rootDir, sessionId });
  let artifact: SessionArtifactReference | undefined;
  try {
    artifact = await store.readArtifactReference(artifactId);
  } finally {
    await store.close();
  }
  if (artifact === undefined || artifact.sessionId !== sessionId || artifact.contentHash === undefined) {
    throw createTypedError({ code: "evidence_mismatch", summary: "Governed What-if source artifact is unavailable.", suggestedAction: "Rerun the current analysis before opening What-if.", affectedInputReferences: [artifactId] });
  }
  const handle = await open(resolve(rootDir, artifact.relativePath), "r");
  try {
    await assertOpenedFileContained(handle, rootDir, artifact.relativePath, basename(artifact.relativePath));
    const bytes = await handle.readFile();
    if (createHash("sha256").update(bytes).digest("hex") !== artifact.contentHash) {
      throw createTypedError({ code: "evidence_mismatch", summary: "Governed What-if source artifact content hash changed.", suggestedAction: "Rerun the current analysis before opening What-if.", affectedInputReferences: [artifactId] });
    }
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } finally {
    await handle.close();
  }
}

function readRegistry<T>(rootDir: string, registry: string, sessionId: string): T | undefined {
  try {
    return JSON.parse(readFileSync(join(rootDir, "runtime", "workbench", "registries", registry, `${sessionId}.json`), "utf8")) as T;
  } catch {
    return undefined;
  }
}

function writeRegistry(rootDir: string, registry: string, sessionId: string, value: unknown): void {
  const directory = join(rootDir, "runtime", "workbench", "registries", registry);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const target = join(directory, `${sessionId}.json`);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(value), { encoding: "utf8", mode: 0o600, flag: "wx" });
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
}

class StoreBackedQueueSessionStore implements QueueSessionStore {
  constructor(private readonly rootDir: string, private readonly sessions: SessionRegistry) {}

  async persistAttempt(): Promise<void> {}

  async markAttemptResult(attemptId: string, result: unknown, _expectedStatus: "running", _job?: StageJob): Promise<boolean> {
    const sessionId = readSessionId(_job?.payload);
    if (sessionId === undefined) return false;
    const current = await this.sessions.read(sessionId);
    if (current?.activeAttempt?.attemptId !== attemptId) return false;
    try {
      return await this.record(current, { result, status: "completed" });
    } catch (error) {
      if ((error as { readonly code?: unknown }).code !== "evidence_mismatch") throw error;
      return this.record(current, { status: "failed", result: { error } });
    }
  }

  async markDependencyFailure(attemptId: string, reason: string, job?: StageJob): Promise<void> {
    const sessionId = readSessionId(job?.payload);
    if (sessionId === undefined) return;
    const current = await this.sessions.read(sessionId);
    if (current?.activeAttempt?.attemptId !== attemptId) return;
    await this.record(current, {
      status: "failed",
      result: { error: createTypedError({ code: "dependency_error", summary: reason, suggestedAction: "Restore the required runner dependency and retry.", affectedInputReferences: [attemptId] }) },
    });
  }

  private async record(snapshot: F8SessionSnapshot, result: { readonly status: "completed" | "failed"; readonly result: unknown }): Promise<boolean> {
    const store = await openSessionStore({ rootDir: this.rootDir, sessionId: snapshot.sessionId });
    try {
      const artifactReferenceOps = result.status === "completed"
        ? await artifactReferenceOpsFromRunnerResult(this.rootDir, snapshot, result.result)
        : undefined;
      const receipt = await store.recordAttemptResult({
        attemptId: snapshot.activeAttempt!.attemptId,
        status: result.status,
        result: result.result,
        snapshot: acceptAttemptResult(snapshot, { attemptId: snapshot.activeAttempt!.attemptId, status: result.status, result: result.result }),
        ...(artifactReferenceOps === undefined ? {} : { artifactReferenceOps }),
      });
      return receipt.accepted;
    } finally {
      await store.close();
    }
  }
}

function readSessionId(value: unknown): string | undefined {
  return typeof value === "object" && value !== null && "sessionId" in value && typeof value.sessionId === "string" ? value.sessionId : undefined;
}

interface OpenWebAssets {
  read(name: "workbench.js" | "workbench.css"): Promise<string>;
}

function missingWebAssets(webAssetsRoot: string): OpenWebAssets {
  return { read: async () => { throw createTypedError({ code: "dependency_error", summary: "Workbench web assets are unavailable.", suggestedAction: "Build apps/workbench-web before starting the workbench server.", affectedInputReferences: [webAssetsRoot] }); } };
}

async function openWebAssets(webAssetsRoot: string): Promise<OpenWebAssets> {
  let rootRealPath: string | undefined;
  try {
    rootRealPath = await realpath(webAssetsRoot);
  } catch {
    return { read: async () => { throw createTypedError({ code: "dependency_error", summary: "Workbench web assets are unavailable.", suggestedAction: "Build apps/workbench-web before starting the workbench server.", affectedInputReferences: [webAssetsRoot] }); } };
  }
  return {
    async read(name) {
      const relativePath = name;
      try {
        const handle = await open(join(rootRealPath, relativePath), "r");
        try {
          await assertOpenedFileContained(handle, rootRealPath, relativePath, name);
          return await handle.readFile({ encoding: "utf8" });
        } finally {
          await handle.close();
        }
      } catch {
        throw createTypedError({ code: "dependency_error", summary: "Workbench web assets are unavailable.", suggestedAction: "Build apps/workbench-web before starting the workbench server.", affectedInputReferences: [join(rootRealPath, relativePath)] });
      }
    },
  };
}

function defaultWebAssetsRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../assets/workbench");
}

async function sendWebAsset(reply: FastifyReply, webAssets: OpenWebAssets, name: "workbench.js" | "workbench.css", contentType: string): Promise<FastifyReply> {
  try {
    return reply.type(contentType).send(await webAssets.read(name));
  } catch (error) {
    return reply.code(503).type("application/json; charset=utf-8").send(safeErrorResponse(error));
  }
}

async function assertOpenedFileContained(
  handle: Awaited<ReturnType<typeof open>>,
  rootDir: string,
  relativePath: string,
  expectedName: string,
): Promise<void> {
  const rootRealPath = await realpath(rootDir);
  const targetPath = resolve(rootDir, relativePath);
  const targetRealPath = await realpath(targetPath);
  const [handleStats, targetStats] = await Promise.all([handle.stat(), stat(targetRealPath)]);
  if (!handleStats.isFile()
    || relative(rootRealPath, targetRealPath).startsWith("..")
    || basename(targetRealPath) !== expectedName
    || handleStats.dev !== targetStats.dev
    || handleStats.ino !== targetStats.ino) {
    throw createTypedError({
      code: "policy_denied",
      summary: "Managed file reference was rejected.",
      suggestedAction: "Retry using a newly uploaded managed file.",
      affectedInputReferences: [expectedName],
    });
  }
}

async function artifactReferenceOpsFromRunnerResult(
  rootDir: string,
  snapshot: F8SessionSnapshot,
  result: unknown,
): Promise<SessionDeltaOperations<SessionArtifactReference> | undefined> {
  const candidate = result as { readonly reviewContext?: ReviewContextIdentity; readonly artifactReferences?: readonly RunnerArtifactReference[] };
  if (candidate.reviewContext === undefined && candidate.artifactReferences === undefined) return undefined;
  if (candidate.artifactReferences === undefined) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "Runner result must provide validated artifact references.",
      suggestedAction: "Return validated structured artifact references from the runner.",
      affectedInputReferences: [snapshot.activeAttempt?.attemptId ?? snapshot.sessionId],
    });
  }
  const artifactReferences = candidate.artifactReferences;
  const scope = snapshot.downstreamScopeSelection;
  if (scope?.confirmed !== true) {
    throw reviewContextMismatch(snapshot, "Runner review context does not match the current session lineage.");
  }
  const expectedFromSession: ReviewContextIdentity = {
    workbookHash: scope.workbookContentHash,
    downstreamSelectionHash: canonicalSelectedWorksheetSetHash(scope.selectedWorksheetNames),
    baselineRunReference: validatedF2BaselineReference(snapshot),
  };
  let reviewContext: ReviewContextIdentity;
  if (snapshot.activeAttempt?.stage === "f4_running") {
    reviewContext = candidate.reviewContext ?? expectedFromSession;
    if (reviewContext.workbookHash !== expectedFromSession.workbookHash
      || reviewContext.downstreamSelectionHash !== expectedFromSession.downstreamSelectionHash
      || reviewContext.baselineRunReference !== expectedFromSession.baselineRunReference) {
      throw reviewContextMismatch(snapshot, "Runner review context does not match the validated F2 baseline lineage.");
    }
  } else {
    if (candidate.reviewContext === undefined) {
      throw reviewContextMismatch(snapshot, "Downstream runner result is missing the F4 review baseline.");
    }
    reviewContext = candidate.reviewContext;
  }
  if (["f5_running", "f6_running"].includes(snapshot.activeAttempt?.stage ?? "")) {
    const expectedReviewContext = await persistedReviewContext(rootDir, snapshot);
    if (reviewContext.workbookHash !== expectedReviewContext.workbookHash
      || reviewContext.downstreamSelectionHash !== expectedReviewContext.downstreamSelectionHash
      || reviewContext.baselineRunReference !== expectedReviewContext.baselineRunReference) {
      throw reviewContextMismatch(snapshot, "Runner review context does not match the F4 baseline lineage.");
    }
  }
  return {
    upsert: artifactReferences.map((artifact) => ({
      artifactId: artifact.artifactId,
      sessionId: snapshot.sessionId,
      inputRevision: snapshot.inputRevision,
      kind: artifact.kind,
      relativePath: artifact.relativePath,
      contentHash: artifact.contentHash,
      reviewContext,
    })),
  };
}

function reviewContextMismatch(snapshot: F8SessionSnapshot, summary: string): Error {
  return createTypedError({
    code: "evidence_mismatch",
    summary,
    suggestedAction: "Rerun the stage using the current workbook, worksheet selection, and F2 baseline.",
    affectedInputReferences: [snapshot.activeAttempt?.attemptId ?? snapshot.sessionId],
  });
}

function validatedF2BaselineReference(snapshot: F8SessionSnapshot): string {
  const runReferences = new Set(snapshot.priorRunReferences.filter((candidate) =>
    candidate.featureId === "F2"
      && candidate.workbookHash === snapshot.downstreamScopeSelection?.workbookContentHash
      && typeof candidate.runReference === "string"
      && candidate.runReference.length > 0,
  ).map((candidate) => candidate.runReference as string));
  if (runReferences.size !== 1) {
    throw reviewContextMismatch(snapshot, "The current session does not have one unambiguous validated F2 baseline lineage.");
  }
  return [...runReferences][0]!;
}

async function persistedReviewContext(rootDir: string, snapshot: F8SessionSnapshot): Promise<ReviewContextIdentity> {
  const f4References = snapshot.artifactRefs?.filter((reference) =>
    reference.kind === "f4_calculation" && reference.revision === snapshot.inputRevision && reference.validated,
  ) ?? [];
  if (f4References.length === 0) throw reviewContextMismatch(snapshot, "The current session has no F4 review baseline.");
  const store = await openSessionStore({ rootDir, sessionId: snapshot.sessionId });
  try {
    const contexts = await Promise.all(f4References.map(async (reference) => {
      const persisted = await store.readArtifactReference(reference.artifactId);
      return parseReviewContext(snapshot, persisted?.metadata?.reviewContext);
    }));
    const uniqueContexts = new Map(contexts.map((context) => [JSON.stringify(context), context]));
    if (uniqueContexts.size !== 1) {
      throw reviewContextMismatch(snapshot, "The current session has ambiguous F4 review baselines.");
    }
    const reviewContext = [...uniqueContexts.values()][0]!;
    const scope = snapshot.downstreamScopeSelection;
    if (scope?.confirmed !== true) {
      throw reviewContextMismatch(snapshot, "The persisted F4 review baseline has no confirmed downstream scope.");
    }
    const expected: ReviewContextIdentity = {
      workbookHash: scope.workbookContentHash,
      downstreamSelectionHash: canonicalSelectedWorksheetSetHash(scope.selectedWorksheetNames),
      baselineRunReference: validatedF2BaselineReference(snapshot),
    };
    if (reviewContext.workbookHash !== expected.workbookHash
      || reviewContext.downstreamSelectionHash !== expected.downstreamSelectionHash
      || reviewContext.baselineRunReference !== expected.baselineRunReference) {
      throw reviewContextMismatch(snapshot, "The persisted F4 review baseline does not match the current session lineage.");
    }
    return reviewContext;
  } finally {
    await store.close();
  }
}

function parseReviewContext(snapshot: F8SessionSnapshot, value: unknown): ReviewContextIdentity {
  const candidate = value as Partial<ReviewContextIdentity> | undefined;
  if (typeof candidate?.workbookHash !== "string"
    || typeof candidate.downstreamSelectionHash !== "string"
    || typeof candidate.baselineRunReference !== "string") {
    throw reviewContextMismatch(snapshot, "The persisted F4 review baseline is invalid.");
  }
  return candidate as ReviewContextIdentity;
}

function renderWorkbenchPage(): string {
  return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>TA Assist Workbench</title><link rel=\"stylesheet\" href=\"/workbench.css\"></head><body><main id=\"app\"></main><script type=\"module\" src=\"/workbench.js\"></script></body></html>";
}