import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, realpath, stat } from "node:fs/promises";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { DatabaseSync } from "node:sqlite";

import { createConversationStore, type ConversationStore, type ConversationTurn } from "@ai-assist/conversation";
import { drawingGovernanceResultV2Schema, f2UserReportSchema, f4WorkflowCalculationResultSchema, f8PublicSessionCommandSchema, f8SessionCommandSchema, f8SessionSnapshotSchema, worksheetSelectionPromptSchema, type F6OptimizationTargets, type F8ScenarioDraft, type F8WorksheetWhatIfCalculationRequest, type hostActionClaimSchema, type hostActionRequestSchema, type hostActionResultSchema } from "@ai-assist/contracts";
import { acceptAttemptResult, canonicalSelectedWorksheetSetHash, createSessionStore, createToleranceTargetsPreview, openSessionStore, reduceSessionCommand, type F8SessionCommand, type F8SessionSnapshot, type ReviewContextIdentity, type ScenarioBaseline, type SessionArtifactReference, type SessionDeltaOperations } from "@ai-assist/workbench";
import { createTypedError } from "@ai-assist/contracts";
import { createHostActionStore, type HostActionRecord } from "@ai-assist/workbench";
import { createF4WhatIfBaselineRequest, renderF3AdoMarkdown, runF1F2Confirmed, runF1F2Selection, runF3Analysis, runF4Calculation, runF4WhatIfCalculation, runF5Interpretation, runF6Optimization, validateF0Capabilities } from "@ai-assist/workflow-runners";
import { readOoxmlWorkbook } from "@ai-assist/workbook-catalog";

interface RunnerArtifactReference {
  readonly artifactId: string;
  readonly kind: "f1_image" | "f3_report" | "f4_calculation" | "f4_report" | "f5_report" | "f6_optimization" | "f6_report";
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
import { adoRoutes } from "./routes/ado.js";
import { sessionsRoutes } from "./routes/sessions.js";
import { whatIfRoutes } from "./routes/what-if.js";
import { createPersistentWorkerQueue, type PersistentWorkerQueue, type PersistentWorkerQueueOptions, type QueueSessionStore, type StageJob } from "./sqlite-worker-queue.js";
import { createSqliteEventSource, type SqliteEventSource } from "./sse.js";
import { createAutoEntryDecision } from "./auto-entry.js";
import { buildConversationContext, type ConversationContextSelection } from "./conversation-context.js";
import { reviewContextFor, runProductionStage, type ProductionRoots } from "./production-stage-runner.js";
import { writeSessionRecord } from "./session-records.js";
import { storeUpload } from "./uploads.js";

type HostActionClaim = ReturnType<typeof hostActionClaimSchema.parse>;
type HostActionRequest = ReturnType<typeof hostActionRequestSchema.parse>;
type HostActionResult = ReturnType<typeof hostActionResultSchema.parse>;

export interface StartWorkbenchServerOptions {
  readonly rootDir: string;
  readonly port?: number;
  readonly webAssetsRoot?: string;
  readonly skipWebAssets?: boolean;
  readonly allowInternalFixtureAutoConfirmation?: boolean;
  readonly bootstrap?: BrowserBootstrapRendezvous;
  readonly runner?: (job: StageJob) => Promise<unknown>;
  readonly queueFactory?: (options: PersistentWorkerQueueOptions) => Promise<PersistentWorkerQueue>;
  readonly whatIfService?: WhatIfService;
  readonly surfacePrepareService?: SurfacePrepareService;
  readonly resumeSessionId?: string;
}

export interface SurfacePrepareService {
  create(snapshot: F8SessionSnapshot, command: F8SessionCommand): Promise<Extract<HostActionRequest, { kind: "surface_validate" }>["prepareRequest"]>;
}

export interface WhatIfService {
  calculate(snapshot: F8SessionSnapshot, input: { readonly draftId: string; readonly worksheetName: string; readonly tableId: string; readonly sourceRow: number; readonly inputRevision: number; readonly patch: NonNullable<F8ScenarioDraft["change"]>; readonly signedDirectionEvidence?: true }): Promise<F8ScenarioDraft>;
  createPromotionPreview(snapshot: F8SessionSnapshot, draft: F8ScenarioDraft): Promise<F6OptimizationTargets>;
  calculateWorksheet?(snapshot: F8SessionSnapshot, input: F8WorksheetWhatIfCalculationRequest): Promise<F8ScenarioDraft>;
}

export interface WorkbenchServer extends FastifyInstance {
  readonly listenOptions: { readonly host: string; readonly port: number };
  readonly bootstrap: BrowserBootstrapRendezvous;
  importHostWorkbook(input: HostWorkbookImportInput): Promise<HostWorkbookImportReceipt>;
  testAuthenticate(sessionId?: string): Promise<TestAuthentication>;
  issueHostBearer(sessionId: string, scopes: readonly string[], options?: HostBearerOptions): string;
  registerArtifactForTest(sessionId: string, artifactId: string, relativePath: string, fileName: string, classification: ArtifactClassification, mimeType: string): void;
  publishEventForTest(sessionId: string, eventName: string, payload: unknown): void;
}

export interface HostWorkbookImportInput {
  readonly requestId: string;
  readonly sessionId: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export interface HostWorkbookImportReceipt {
  readonly artifactId: string;
  readonly contentHash: string;
  readonly snapshotRevision: number;
  readonly state: string;
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
  readCommittedCommand(sessionId: string, commandId: string): Promise<F8SessionCommand | undefined>;
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
  readRecord(sessionId: string, actionId: string): Promise<HostActionRecord | undefined>;
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

export interface AdoPreviewIdentity {
  readonly target: { readonly mode: "create"; readonly title: string } | { readonly mode: "existing"; readonly workItemReference: string };
  readonly markdown: string;
  readonly contentHash: string;
  readonly factorCount: number;
  readonly matchesPrepareRequest: boolean;
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
  readonly inflightHostImports: Map<string, Promise<HostWorkbookImportReceipt>>;
  calculateWhatIf(sessionId: string, input: { readonly draftId: string; readonly worksheetName: string; readonly tableId: string; readonly sourceRow: number; readonly inputRevision: number; readonly patch: NonNullable<F8ScenarioDraft["change"]>; readonly signedDirectionEvidence?: true }): Promise<F8ScenarioDraft>;
  calculateWorksheetWhatIf(sessionId: string, input: F8WorksheetWhatIfCalculationRequest): Promise<F8ScenarioDraft>;
  createWhatIfPromotion(sessionId: string, draftId: string): Promise<{ readonly draft: F8ScenarioDraft; readonly promotionPreview: F6OptimizationTargets }>;
  resolveManagedWorkbook(sessionId: string, artifactId: string): Promise<{ readonly fileName: string; readonly workbookBytes: Uint8Array }>;
  bindManagedWorkbook(sessionId: string, artifactId: string): void;
  recoverCommittedCommand(snapshot: F8SessionSnapshot, command: F8SessionCommand): Promise<void>;
  buildConversationContext(sessionId: string, selection: ConversationContextSelection): ReturnType<typeof buildConversationContext>;
  validateConversationContext(sessionId: string, input: { readonly worksheetName?: string; readonly tableId?: string; readonly sourceRow?: number; readonly factorName?: string; readonly calculationReference?: string; readonly relatedArtifactIds: readonly string[] }): Promise<boolean>;
  createAdoPreview(sessionId: string, prepareRequest: Extract<HostActionRequest, { kind: "surface_validate" }>["prepareRequest"]): Promise<AdoPreviewIdentity>;
  syncSessionRecord(sessionId: string): Promise<void>;
  createPendingHostAction(snapshot: F8SessionSnapshot, command: F8SessionCommand): Promise<void>;
  enqueueActiveAttempt(snapshot: F8SessionSnapshot): Promise<void>;
  requireAuthenticated(request: FastifyRequest, reply: FastifyReply): AuthenticatedRequest | undefined;
  requireBrowserSession(request: FastifyRequest, reply: FastifyReply): AuthenticatedRequest | undefined;
  requireBrowserMutation(request: FastifyRequest, reply: FastifyReply): AuthenticatedRequest | undefined;
}

export async function buildWorkbenchServer(options: StartWorkbenchServerOptions): Promise<WorkbenchServer> {
  await mkdir(options.rootDir, { recursive: true });

  const auth = new WorkbenchAuth(loadOrCreateAuthKey(options.rootDir));
  const context = await createWorkbenchServerContext(
    options.rootDir,
    auth,
    options.runner,
    options.queueFactory,
    options.whatIfService,
    options.surfacePrepareService,
    options.allowInternalFixtureAutoConfirmation === true,
  );
  const app = Fastify({ logger: false, bodyLimit: 1024 * 1024 }) as unknown as WorkbenchServer;
  const bootstrap = options.bootstrap ?? createBrowserBootstrapRendezvous();

  Object.defineProperties(app, {
    listenOptions: { value: { host: LOOPBACK_HOST, port: options.port ?? 0 }, enumerable: true },
    bootstrap: { value: bootstrap, enumerable: true },
    importHostWorkbook: { value: (input: HostWorkbookImportInput) => importHostWorkbook(context, input), enumerable: true },
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
    const consumed = typeof nonce === "string" ? await bootstrap.consumeBrowserBootstrap(nonce) : { accepted: false as const };
    if (!consumed.accepted) {
      return reply.code(401).send({ error: "bootstrap_nonce_rejected" });
    }
    if (consumed.sessionId !== undefined && await context.sessions.read(consumed.sessionId) === undefined) return reply.code(404).send({ error: "bootstrap_session_not_found" });
    const session = auth.issueBrowserSession(consumed.sessionId);
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
  await app.register(adoRoutes, { context });
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
  const bootstrapNonce = await server.bootstrap.issueBrowserBootstrap(options.resumeSessionId);
  const sessionQuery = options.resumeSessionId === undefined ? "" : `?session=${encodeURIComponent(options.resumeSessionId)}`;
  return { server, url: `http://${LOOPBACK_HOST}:${port}/${sessionQuery}#bootstrap=${bootstrapNonce}`, bootstrapNonce };
}

async function createWorkbenchServerContext(rootDir: string, auth: WorkbenchAuth, runner: StartWorkbenchServerOptions["runner"], queueFactory: StartWorkbenchServerOptions["queueFactory"], whatIfService: WhatIfService | undefined, surfacePrepareService: SurfacePrepareService | undefined, allowInternalFixtureAutoConfirmation: boolean): Promise<WorkbenchServerContext> {
  const sessions = new StoreBackedSessionRegistry(rootDir);
  const artifacts = new FileBackedArtifactRegistry(rootDir);
  const events = await createSqliteEventSource({ rootDir });
  const effectiveWhatIfService = whatIfService ?? createDefaultWhatIfService(rootDir);
  const queueSessionStore = new StoreBackedQueueSessionStore(rootDir, sessions, allowInternalFixtureAutoConfirmation);
  const queueOptions = {
    rootDir: join(rootDir, "runtime", "workbench"),
    sessionStore: queueSessionStore,
    worker: runner ?? createDefaultStageRunner(rootDir, sessions, artifacts, events),
  } satisfies PersistentWorkerQueueOptions;
  const queue = await (queueFactory ?? createPersistentWorkerQueue)(queueOptions);
  const inflightHostImports = new Map<string, Promise<HostWorkbookImportReceipt>>();
  queueSessionStore.setFollowUp(async (snapshot) => {
    await enqueueSnapshotAttempt(rootDir, queue, snapshot, true);
  });
  await queue.reconcile();
  await recoverActiveAttempts(rootDir, sessions, artifacts, queue);
  const context: WorkbenchServerContext = {
    rootDir,
    auth,
    sessions,
    conversation: new SharedConversationRegistry(await createConversationStore({ rootDir: join(rootDir, "runtime", "workbench") })),
    hostActions: new SqliteHostActionRegistry(rootDir),
    artifacts,
    events,
    queue,
    inflightHostImports,
    async calculateWhatIf(sessionId, input) {
      const snapshot = await sessions.read(sessionId);
      if (snapshot === undefined || snapshot.state !== "review_required" || snapshot.inputRevision !== input.inputRevision) {
        throw createTypedError({ code: "evidence_mismatch", summary: "What-if input revision is not current.", suggestedAction: "Refresh the review before recalculating.", affectedInputReferences: [sessionId, input.draftId] });
      }
      return effectiveWhatIfService.calculate(snapshot, input);
    },
    async calculateWorksheetWhatIf(sessionId, input) {
      const snapshot = await sessions.read(sessionId);
      if (snapshot === undefined || snapshot.state !== "review_required" || snapshot.inputRevision !== input.inputRevision) {
        throw createTypedError({ code: "evidence_mismatch", summary: "Worksheet Scenario input revision is not current.", suggestedAction: "Refresh the review before recalculating.", affectedInputReferences: [sessionId, input.draftId] });
      }
      if (effectiveWhatIfService.calculateWorksheet === undefined) throw createTypedError({ code: "feature_not_available", summary: "Worksheet Scenario calculation is unavailable.", suggestedAction: "Use the production F4 calculation service.", affectedInputReferences: [sessionId] });
      return effectiveWhatIfService.calculateWorksheet(snapshot, input);
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
      await enqueueSnapshotAttempt(rootDir, queue, snapshot);
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
    bindManagedWorkbook(sessionId, artifactId) {
      writeRegistry(rootDir, "active-workbooks", sessionId, { artifactId });
    },
    async recoverCommittedCommand(snapshot, command) {
      if (command.command === "upload_workbook" && "managedArtifactId" in command.payload && typeof command.payload.managedArtifactId === "string") {
        await context.resolveManagedWorkbook(command.sessionId, command.payload.managedArtifactId);
        context.bindManagedWorkbook(command.sessionId, command.payload.managedArtifactId);
      }
      await context.createPendingHostAction(snapshot, command);
      const job = await stageJobForSnapshot(rootDir, snapshot);
      if (job !== undefined) await queue.recover(job);
    },
    async buildConversationContext(sessionId, selection) {
      const snapshot = await sessions.read(sessionId);
      if (snapshot === undefined) {
        throw createTypedError({ code: "validation_error", summary: "Session is unavailable for TA model context.", suggestedAction: "Refresh the workbench and retry.", affectedInputReferences: [sessionId] });
      }
      return buildConversationContext(snapshot, selection, {
        async readReference(artifactId) {
          const store = await openSessionStore({ rootDir, sessionId });
          try {
            return await store.readArtifactReference(artifactId);
          } finally {
            await store.close();
          }
        },
        async readJson(artifactId) {
          return readSessionArtifactJson(rootDir, sessionId, artifactId);
        },
      });
    },
    async validateConversationContext(sessionId, input) {
      const snapshot = await sessions.read(sessionId);
      if (snapshot === undefined) return false;
      const allowedArtifacts = new Set(snapshot.artifactRefs?.filter(({ validated }) => validated).map(({ artifactId }) => artifactId) ?? []);
      if (input.relatedArtifactIds.some((artifactId) => !allowedArtifacts.has(artifactId))) return false;
      if (input.worksheetName === undefined) return input.tableId === undefined && input.sourceRow === undefined && input.factorName === undefined && input.calculationReference === undefined;
      const worksheetNames = new Set(snapshot.downstreamScopeSelection?.selectedWorksheetNames ?? snapshot.initialScopeSelection?.selectedWorksheetNames ?? []);
      if (!worksheetNames.has(input.worksheetName)) return false;
      if (input.tableId === undefined && input.sourceRow === undefined && input.factorName === undefined) return input.calculationReference === undefined;
      if (input.tableId === undefined || input.sourceRow === undefined || input.factorName === undefined) return false;
      const f4References = snapshot.artifactRefs?.filter((reference) => reference.kind === "f4_calculation" && reference.validated && reference.revision === snapshot.inputRevision) ?? [];
      if (f4References.length !== 1) return false;
      const report = f4WorkflowCalculationResultSchema.safeParse(await readSessionArtifactJson(rootDir, sessionId, f4References[0]!.artifactId));
      if (!report.success) return false;
      const calculation = report.data.calculations.find((candidate) => candidate.worksheetSelection.worksheetName === input.worksheetName);
      const factor = calculation?.factors.find((candidate) => candidate.source.tableId === input.tableId && candidate.source.sourceRow === input.sourceRow && candidate.factorName === input.factorName);
      if (factor === undefined) return false;
      if (input.calculationReference === undefined) return true;
      return snapshot.scenarioDrafts?.some((draft) => draft.worksheetName === input.worksheetName && draft.calculationReference === input.calculationReference) ?? false;
    },
    async createAdoPreview(sessionId, prepareRequest) {
      const snapshot = await sessions.read(sessionId);
      if (snapshot === undefined || snapshot.state !== "ado_action_pending") {
        throw createTypedError({ code: "evidence_mismatch", summary: "ADO preview requires a pending ADO action.", suggestedAction: "Refresh the ADO workspace before previewing again.", affectedInputReferences: [sessionId] });
      }
      return createAdoPreview(rootDir, snapshot, prepareRequest);
    },
    async syncSessionRecord(sessionId) {
      const snapshot = await sessions.read(sessionId);
      if (snapshot !== undefined) await writeSessionRecord(rootDir, snapshot, await context.conversation.read(sessionId));
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
  return context;
}

async function importHostWorkbook(context: WorkbenchServerContext, input: HostWorkbookImportInput): Promise<HostWorkbookImportReceipt> {
  const inflightKey = `${input.sessionId}:${input.requestId}`;
  const inflight = context.inflightHostImports.get(inflightKey);
  if (inflight !== undefined) return inflight;

  const started = importHostWorkbookOnce(context, input);
  context.inflightHostImports.set(inflightKey, started);
  try {
    return await started;
  } finally {
    context.inflightHostImports.delete(inflightKey);
  }
}

async function importHostWorkbookOnce(context: WorkbenchServerContext, input: HostWorkbookImportInput): Promise<HostWorkbookImportReceipt> {
  const commandId = `host-import:${input.requestId}`;
  const existingReceipts = readRegistry<Record<string, HostWorkbookImportReceipt>>(context.rootDir, "host-import-receipts", input.sessionId) ?? {};
  const existingReceipt = existingReceipts[input.requestId];
  if (existingReceipt !== undefined) return existingReceipt;

  const current = await context.sessions.read(input.sessionId);
  if (current === undefined) {
    throw createTypedError({ code: "validation_error", summary: "Session is unavailable for workbook import.", suggestedAction: "Create or resume a TA Assist session before importing.", affectedInputReferences: ["session_unavailable"] });
  }
  if (!isAcceptedHostWorkbookFileName(input.fileName)) {
    throw createTypedError({ code: "validation_error", summary: "Workbook import rejected.", suggestedAction: "Provide a supported .xlsx workbook file.", affectedInputReferences: ["workbook_name_rejected"] });
  }

  const artifact = await storeUpload({
    rootDir: context.rootDir,
    sessionId: input.sessionId,
    kind: "workbook",
    fileName: input.fileName,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    bytes: input.bytes,
  });
  context.artifacts.authorize(input.sessionId, artifact.artifactId, artifact.relativePath, artifact.fileName, artifact.classification, artifact.mimeType);

  const command: F8SessionCommand = {
    contractVersion: "f8-session-command-v1",
    sessionId: input.sessionId,
    commandId,
    expectedRevision: current.revision,
    command: "upload_workbook",
    payload: { fileName: artifact.fileName, workbookBytes: Buffer.from(input.bytes), inputClassification: "confidential", managedArtifactId: artifact.artifactId },
  };
  const snapshot = await context.sessions.applyCommand(command);
  context.bindManagedWorkbook(input.sessionId, artifact.artifactId);
  await context.createPendingHostAction(snapshot, command);
  await context.enqueueActiveAttempt(snapshot);
  await context.syncSessionRecord(input.sessionId);

  const receipt = { artifactId: artifact.artifactId, contentHash: artifact.contentHash, snapshotRevision: snapshot.revision, state: snapshot.state };
  writeRegistry(context.rootDir, "host-import-receipts", input.sessionId, { ...existingReceipts, [input.requestId]: receipt });
  return receipt;
}

function isAcceptedHostWorkbookFileName(fileName: string): boolean {
  return fileName.length > 0
    && extname(fileName).toLowerCase() === ".xlsx"
    && !/[\\/]/.test(fileName)
    && !/^[A-Za-z]:/.test(fileName);
}

async function enqueueSnapshotAttempt(rootDir: string, queue: PersistentWorkerQueue, snapshot: F8SessionSnapshot, deferDrain = false): Promise<void> {
  const job = await stageJobForSnapshot(rootDir, snapshot);
  if (job === undefined) return;
  await queue.enqueue(job, deferDrain ? { deferStart: true } : undefined);
}

async function stageJobForSnapshot(rootDir: string, snapshot: F8SessionSnapshot): Promise<StageJob | undefined> {
  const attempt = snapshot.activeAttempt;
  if (attempt === null) return undefined;
  const reviewContext = ["f5_running", "f6_running"].includes(attempt.stage)
    ? await persistedReviewContext(rootDir, snapshot)
    : undefined;
  const baselineRunReference = attempt.stage === "f4_running"
    ? validatedF2BaselineReference(snapshot)
    : undefined;
  return {
    jobId: attempt.attemptId,
    attemptId: attempt.attemptId,
    kind: attempt.stage === "f1_f2_running" || attempt.stage === "f3_running" ? "excel" : "calculation",
    stage: attempt.stage,
    payload: {
      sessionId: snapshot.sessionId,
      ...(baselineRunReference === undefined ? {} : { baselineRunReference }),
      ...(reviewContext === undefined ? {} : { reviewContext }),
    },
  };
}

async function recoverActiveAttempts(rootDir: string, sessions: SessionRegistry, artifacts: ArtifactRegistry, queue: PersistentWorkerQueue): Promise<void> {
  let database: DatabaseSync | undefined;
  try {
    database = new DatabaseSync(join(rootDir, "runtime", "workbench", "workbench.sqlite"), { readOnly: true });
    const rows = database.prepare("SELECT session_id, snapshot_json FROM sessions").all() as unknown as Array<{ readonly session_id: string; readonly snapshot_json: string }>;
    for (const row of rows) {
      const parsed = f8SessionSnapshotSchema.safeParse(JSON.parse(row.snapshot_json) as unknown);
      if (!parsed.success || parsed.data.sessionId !== row.session_id) continue;
      await writeSessionRecord(rootDir, parsed.data);
      if (parsed.data.activeAttempt === null) continue;
      const current = await sessions.read(row.session_id);
      if (current?.activeAttempt === null || current === undefined) continue;
      if (current.activeAttempt.commandId !== undefined) {
        const command = await sessions.readCommittedCommand(row.session_id, current.activeAttempt.commandId);
        if (command?.command === "upload_workbook" && "managedArtifactId" in command.payload && typeof command.payload.managedArtifactId === "string") {
          const artifact = artifacts.read(row.session_id, command.payload.managedArtifactId);
          if (artifact === undefined) continue;
          writeRegistry(rootDir, "active-workbooks", row.session_id, { artifactId: command.payload.managedArtifactId });
        }
      }
      const job = await stageJobForSnapshot(rootDir, current);
      if (job !== undefined) await queue.recover(job);
    }
  } catch {
    return;
  } finally {
    database?.close();
  }
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

  async readCommittedCommand(sessionId: string, commandId: string): Promise<F8SessionCommand | undefined> {
    try {
      const store = await openSessionStore({ rootDir: this.rootDir, sessionId });
      try {
        return await store.readCommittedCommand(commandId);
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
    return (await this.readRecord(sessionId, actionId))?.request;
  }

  async readRecord(sessionId: string, actionId: string): Promise<HostActionRecord | undefined> {
    try {
      const store = await createHostActionStore({ rootDir: this.rootDir, sessionId });
      try {
        return await store.getHostAction(actionId);
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

function createDefaultStageRunner(rootDir: string, sessions: SessionRegistry, artifacts: ArtifactRegistry, events: EventSource): (job: StageJob) => Promise<unknown> {
  return async (job) => {
    const sessionId = readSessionId(job.payload);
    if (sessionId === undefined) throw new Error("Stage job has no session identity.");
    try {
      return await runDefaultStage(rootDir, sessions, artifacts, events, job, sessionId);
    } catch (error) {
      const typed = error as { readonly code?: unknown; readonly summary?: unknown; readonly affectedInputReferences?: unknown };
      writeRegistry(rootDir, "runner-errors", sessionId, {
        stage: job.stage,
        code: typeof typed.code === "string" ? typed.code : "internal_error",
        summary: typeof typed.summary === "string" ? typed.summary : "Governed runner failed.",
        affectedInputReferences: Array.isArray(typed.affectedInputReferences)
          ? typed.affectedInputReferences.filter((value): value is string => typeof value === "string" && !value.includes(":\\"))
          : [],
      });
      throw error;
    }
  };
}

async function runDefaultStage(rootDir: string, sessions: SessionRegistry, artifacts: ArtifactRegistry, events: EventSource, job: StageJob, sessionId: string): Promise<unknown> {
    const binding = readRegistry<{ readonly artifactId: string }>(rootDir, "active-workbooks", sessionId);
    const artifact = binding === undefined ? undefined : artifacts.read(sessionId, binding.artifactId);
    if (["f0_validating", "f1_f2_running"].includes(job.stage) && (binding === undefined || artifact === undefined)) {
      throw createTypedError({ code: "dependency_error", summary: "The active managed workbook is unavailable.", suggestedAction: "Upload the workbook again.", affectedInputReferences: [sessionId] });
    }
    const workbookPath = artifact === undefined ? "" : resolve(resolve(rootDir), artifact.relativePath);
    const context = {
      attemptId: job.attemptId,
      repositoryRoot: process.cwd(),
      managedOutputRoot: join(rootDir, "runtime", "workbench", "runner-output", sessionId),
      signal: new AbortController().signal,
      emit: (event: { readonly kind: string; readonly featureId: string; readonly stage: string; readonly timestamp: string }) => {
        try {
          events.publish(sessionId, "runner_progress", { kind: event.kind, featureId: event.featureId, stage: event.stage, timestamp: event.timestamp });
        } catch {
          // Progress is observational and must never fail governed analysis.
        }
      },
    };
    if (job.stage === "f0_validating") {
      const f0 = validateF0Capabilities(context);
      const workbook = readOoxmlWorkbook(new Uint8Array(readFileSync(workbookPath)), undefined, false, { maxRow: 100, maxColumn: "AZ" });
      let selection: ReturnType<typeof runF1F2Selection> | undefined;
      try {
        selection = runF1F2Selection({ workbookPath }, context);
        writeRegistry(rootDir, "f1-f2-selection", sessionId, selection.selectionReference);
      } catch {
        selection = undefined;
      }
      return {
        featureId: f0.featureId,
        status: f0.status,
        versions: f0.versions,
        worksheetCapabilities: workbook.worksheetInventory.map((worksheet) => ({ worksheetName: worksheet.worksheetName, whatIfAvailable: false })),
        ...(selection === undefined ? {} : { selectionPrompt: selection.prompt }),
      };
    }
    if (job.stage === "f1_f2_running") {
      const snapshot = await sessions.read(sessionId);
      if (snapshot?.initialScopeSelection === undefined) {
        throw createTypedError({ code: "evidence_mismatch", summary: "The confirmed worksheet selection is unavailable.", suggestedAction: "Upload the workbook and confirm the initial worksheet scope again.", affectedInputReferences: [sessionId] });
      }
      const selectionReference = readRegistry<Parameters<typeof runF1F2Confirmed>[0]["selectionReference"]>(rootDir, "f1-f2-selection", sessionId);
      if (selectionReference === undefined) {
        throw createTypedError({ code: "evidence_mismatch", summary: "The governed worksheet selection reference is unavailable.", suggestedAction: "Upload the workbook and prepare the TA workspace again.", affectedInputReferences: [sessionId] });
      }
      const result = runF1F2Confirmed({
        workbookPath,
        workbookContentHash: snapshot.initialScopeSelection.workbookContentHash,
        selectedWorksheetNames: snapshot.initialScopeSelection.selectedWorksheetNames,
        selectionReference,
        refreshF2: snapshot.priorRunReferences.some((reference) => reference.featureId === "F2"),
      }, context);
      writeRegistry(rootDir, "production-roots", sessionId, { f1Root: result.f1Root, f2Root: result.f2Root });
      return JSON.parse(JSON.stringify(result)) as unknown;
    }
    if (["f3_running", "f4_running", "f5_running", "f6_running"].includes(job.stage)) {
      const snapshot = await sessions.read(sessionId);
      const roots = readRegistry<ProductionRoots>(rootDir, "production-roots", sessionId);
      const baselineRunReference = snapshot?.priorRunReferences.findLast((reference) => reference.featureId === "F2" && typeof reference.runReference === "string")?.runReference;
      if (snapshot === undefined || roots === undefined || baselineRunReference === undefined) throw createTypedError({ code: "evidence_mismatch", summary: "Production stage lineage is unavailable.", suggestedAction: "Prepare the workbook again.", affectedInputReferences: [sessionId, job.stage] });
      const reviewContext = reviewContextFor(snapshot, baselineRunReference);
      const execution = await runProductionStage(job.stage, { repositoryRoot: process.cwd(), serverRoot: rootDir, sessionId, workbookPath, snapshot, roots, context, baselineRunReference, ...(reviewContext === undefined ? {} : { reviewContext }) });
      writeRegistry(rootDir, "production-roots", sessionId, execution.roots);
      return JSON.parse(JSON.stringify(execution.result)) as unknown;
    }
    throw createTypedError({ code: "dependency_error", summary: `No production runner is configured for ${job.stage}.`, suggestedAction: "Install the governed runner dependency for this stage.", affectedInputReferences: [job.stage] });
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
        ...(input.signedDirectionEvidence === true ? { signedDirectionEvidence: true } : {}),
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
    async calculateWorksheet(snapshot, input) {
      const { baselineRequest, table } = await loadBaseline(snapshot, input.worksheetName);
      for (const override of input.factorOverrides) {
        if (override.worksheetName !== input.worksheetName || override.tableId !== table.tableId || !table.rows.some((row) => row.sourceRow === override.sourceRow)) {
          throw createTypedError({ code: "evidence_mismatch", summary: "Worksheet Scenario factor identity does not match the governed baseline.", suggestedAction: "Refresh the worksheet before recalculating.", affectedInputReferences: [input.draftId] });
        }
      }
      const result = runF4WhatIfCalculation({
        draftId: input.draftId,
        baselineRequest,
        factorOverrides: input.factorOverrides.map(compactScenarioFactorOverride),
        ...(input.systemSpecification === undefined ? {} : { systemSpecification: compactScenarioSystemOverride(input.systemSpecification) }),
        ...(input.signedDirectionEvidence === true ? { signedDirectionEvidence: true } : {}),
      });
      if (result.status !== "completed") throw createTypedError({ code: "calculation_not_possible", summary: "Signed direction evidence is required for nominal Scenario changes.", suggestedAction: "Use tolerance/specification changes or provide governed direction evidence.", affectedInputReferences: [input.draftId] });
      return {
        contractVersion: "f8-scenario-draft-v1", draftId: input.draftId, sessionId: snapshot.sessionId, worksheetName: input.worksheetName, inputRevision: snapshot.inputRevision, status: "calculated", mode: "WHAT_IF",
        baselineWorkbookHash: baselineRequest.worksheetAnalysisAssets.workbook.contentHash, baselineRunReference: baselineRequest.runReference,
        calculationReference: result.calculationReference, calculationMetrics: result.metrics, factorResults: [...result.factors],
        factorOverrides: input.factorOverrides,
        ...(input.systemSpecification === undefined ? {} : { systemSpecification: input.systemSpecification }),
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
  const nextContent = renderF3AdoMarkdown(report).markdown;
  const payload = command.payload as { readonly decision: "create_new" | "use_existing"; readonly workItemReference?: string };
  return payload.decision === "create_new"
    ? { mode: "create", title: `TA Drawing Governance - ${report.workbook.fileName}`, nextContent, factorCount: report.summary.factorCount }
    : { mode: "existing", workItemReference: payload.workItemReference!, nextContent, factorCount: report.summary.factorCount };
}

async function createAdoPreview(
  rootDir: string,
  snapshot: F8SessionSnapshot,
  prepareRequest: Extract<HostActionRequest, { kind: "surface_validate" }>["prepareRequest"],
): Promise<AdoPreviewIdentity> {
  const f3References = snapshot.artifactRefs?.filter((reference) => reference.kind === "f3_report" && reference.revision === snapshot.inputRevision && reference.validated) ?? [];
  if (f3References.length !== 1) throw reviewContextMismatch(snapshot, "ADO preview requires one current validated F3 report.");
  const report = drawingGovernanceResultV2Schema.parse(await readSessionArtifactJson(rootDir, snapshot.sessionId, f3References[0]!.artifactId));
  if (report.status === "input_rejected") throw reviewContextMismatch(snapshot, "ADO preview cannot use an input-rejected F3 report.");
  const rendered = renderF3AdoMarkdown(report);
  const target = prepareRequest.mode === "create"
    ? { mode: "create" as const, title: `TA Drawing Governance - ${report.workbook.fileName}` }
    : { mode: "existing" as const, workItemReference: prepareRequest.workItemReference };
  const expectedPrepareRequest = prepareRequest.mode === "create"
    ? { mode: "create" as const, title: target.title, nextContent: rendered.markdown, factorCount: report.summary.factorCount }
    : { mode: "existing" as const, workItemReference: target.workItemReference, nextContent: rendered.markdown, factorCount: report.summary.factorCount };
  return {
    target,
    markdown: rendered.markdown,
    contentHash: rendered.contentHash,
    factorCount: report.summary.factorCount,
    matchesPrepareRequest: JSON.stringify(expectedPrepareRequest) === JSON.stringify(prepareRequest),
  };
}

function compactWhatIfPatch(patch: NonNullable<F8ScenarioDraft["change"]>): NonNullable<Parameters<typeof runF4WhatIfCalculation>[0]["patch"]> {
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
  private followUp: ((snapshot: F8SessionSnapshot) => Promise<void>) | undefined;

  constructor(
    private readonly rootDir: string,
    private readonly sessions: SessionRegistry,
    private readonly allowInternalFixtureAutoConfirmation: boolean,
  ) {}

  setFollowUp(followUp: (snapshot: F8SessionSnapshot) => Promise<void>): void {
    this.followUp = followUp;
  }

  async persistAttempt(): Promise<void> {}

  async markAttemptResult(attemptId: string, result: unknown, _expectedStatus: "running", _job?: StageJob): Promise<boolean> {
    const sessionId = readSessionId(_job?.payload);
    if (sessionId === undefined) return false;
    const current = await this.sessions.read(sessionId);
    if (current?.activeAttempt?.attemptId !== attemptId) return false;
    try {
      return await this.record(current, { result, status: "completed" });
    } catch (error) {
      writeSanitizedRunnerError(this.rootDir, sessionId, current.activeAttempt.stage, error);
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
      const f2Projection = result.status === "completed"
        ? await f2ProjectionFromRunnerResult(this.rootDir, snapshot, result.result)
        : undefined;
      const artifactReferenceOps = result.status === "completed"
        ? f2Projection?.artifactReferenceOps ?? await artifactReferenceOpsFromRunnerResult(this.rootDir, snapshot, result.result)
        : undefined;
      const worksheetCapabilities = readWorksheetCapabilities(result.result);
      const projectedSnapshot = {
        ...snapshot,
        ...(worksheetCapabilities === undefined ? {} : { worksheetCapabilities }),
        ...(f2Projection === undefined ? {} : { priorRunReferences: [...snapshot.priorRunReferences, f2Projection.runReference] }),
      };
      const receipt = await store.recordAttemptResult({
        attemptId: snapshot.activeAttempt!.attemptId,
        status: result.status,
        result: result.result,
        snapshot: acceptAttemptResult(projectedSnapshot, { attemptId: snapshot.activeAttempt!.attemptId, status: result.status, result: result.result }),
        ...(artifactReferenceOps === undefined ? {} : { artifactReferenceOps }),
      });
      if (receipt.accepted && result.status === "completed") {
        await this.applyAutoEntry(receipt.snapshot, result.result, snapshot.activeAttempt!.attemptId);
        await this.applyAutoDownstream(receipt.snapshot, result.result, snapshot.activeAttempt!.attemptId);
        await this.applyAutomaticStageDecisions(receipt.snapshot, snapshot.activeAttempt!.attemptId);
        if (receipt.snapshot.activeAttempt !== null) await this.followUp?.(receipt.snapshot);
      }
      if (receipt.accepted) await writeSessionRecord(this.rootDir, receipt.snapshot);
      return receipt.accepted;
    } finally {
      await store.close();
    }
  }

  private async applyAutoEntry(snapshot: F8SessionSnapshot, result: unknown, completedAttemptId: string): Promise<void> {
    if (!this.allowInternalFixtureAutoConfirmation) return;
    if (snapshot.state !== "initial_scope_required") return;
    const selectionPrompt = typeof result === "object" && result !== null && "selectionPrompt" in result ? result.selectionPrompt : undefined;
    const parsed = worksheetSelectionPromptSchema.safeParse(selectionPrompt);
    if (!parsed.success) return;
    const decision = createAutoEntryDecision(parsed.data);
    if (decision === undefined) return;
    const next = await this.sessions.applyCommand({
      contractVersion: "f8-session-command-v1",
      sessionId: snapshot.sessionId,
      commandId: `${completedAttemptId}:auto-scope`,
      expectedRevision: snapshot.revision,
      command: "auto_confirm_initial_scope",
      payload: { workbookHash: decision.workbookHash, worksheetNames: [...decision.worksheetNames], provenance: "internal_fixture" },
    });
    await this.followUp?.(next);
  }

  private async applyAutoDownstream(snapshot: F8SessionSnapshot, result: unknown, completedAttemptId: string): Promise<void> {
    if (!this.allowInternalFixtureAutoConfirmation) return;
    if (snapshot.state !== "downstream_scope_required") return;
    const candidate = result as { readonly report?: unknown };
    const report = f2UserReportSchema.safeParse(candidate.report);
    if (!report.success || report.data.status === "inputRejected") return;
    const worksheetNames = report.data.worksheets.filter(({ status }) => status === "ready").map(({ worksheetName }) => worksheetName);
    if (worksheetNames.length === 0 || snapshot.initialScopeSelection === undefined) return;
    const next = await this.sessions.applyCommand({ contractVersion: "f8-session-command-v1", sessionId: snapshot.sessionId, commandId: `${completedAttemptId}:auto-downstream`, expectedRevision: snapshot.revision, command: "confirm_downstream_scope", payload: { workbookHash: snapshot.initialScopeSelection.workbookContentHash, worksheetNames, provenance: "internal_fixture" } });
    await this.followUp?.(next);
  }

  private async applyAutomaticStageDecisions(snapshot: F8SessionSnapshot, completedAttemptId: string): Promise<void> {
    if (snapshot.state === "image_decision_required") {
      const next = await this.sessions.applyCommand({ contractVersion: "f8-session-command-v1", sessionId: snapshot.sessionId, commandId: `${completedAttemptId}:image-default`, expectedRevision: snapshot.revision, command: "confirm_image_decision", payload: { decision: "not_evaluated", rationale: "No additional image observation supplied." } });
      await this.followUp?.(next);
      return;
    }
    if (snapshot.state === "analysis_context_decision_required") {
      const contextDecision = await this.sessions.applyCommand({ contractVersion: "f8-session-command-v1", sessionId: snapshot.sessionId, commandId: `${completedAttemptId}:context-default`, expectedRevision: snapshot.revision, command: "confirm_analysis_context", payload: { decision: "not_provided", rationale: "No additional analysis context supplied." } });
      const next = await this.sessions.applyCommand({ contractVersion: "f8-session-command-v1", sessionId: snapshot.sessionId, commandId: `${completedAttemptId}:targets-default`, expectedRevision: contextDecision.revision, command: "confirm_optimization_targets", payload: { decision: "not_provided", rationale: "Use governed default optimization targets." } });
      await this.followUp?.(next);
    }
  }
}

async function f2ProjectionFromRunnerResult(
  rootDir: string,
  snapshot: F8SessionSnapshot,
  result: unknown,
): Promise<{ readonly artifactReferenceOps: SessionDeltaOperations<SessionArtifactReference>; readonly runReference: F8SessionSnapshot["priorRunReferences"][number] } | undefined> {
  const candidate = result as { readonly featureId?: unknown; readonly status?: unknown; readonly runId?: unknown; readonly f2Root?: unknown; readonly workbookContentHash?: unknown; readonly report?: unknown };
  if (candidate.featureId !== "F2" || (candidate.status !== "completed" && candidate.status !== "partiallyBlocked")) return undefined;
  if (typeof candidate.runId !== "string" || candidate.runId.length === 0 || typeof candidate.f2Root !== "string") {
    throw createTypedError({ code: "evidence_mismatch", summary: "F2 runner result is missing its governed run identity.", suggestedAction: "Rerun F1 and F2 for the current workbook.", affectedInputReferences: [snapshot.activeAttempt?.attemptId ?? snapshot.sessionId] });
  }
  const report = f2UserReportSchema.parse(candidate.report);
  if (report.status !== "completed" && report.status !== "partiallyBlocked") {
    throw createTypedError({ code: "evidence_mismatch", summary: "F2 runner did not produce any ready worksheet.", suggestedAction: "Resolve the reported input issues and rerun F2.", affectedInputReferences: [candidate.runId] });
  }
  const scope = snapshot.initialScopeSelection;
  if (scope?.confirmed !== true || candidate.workbookContentHash !== scope.workbookContentHash || report.workbook.contentHash !== scope.workbookContentHash) {
    throw createTypedError({ code: "evidence_mismatch", summary: "F2 report does not match the confirmed workbook lineage.", suggestedAction: "Rerun F1 and F2 for the current workbook.", affectedInputReferences: [candidate.runId] });
  }
  const reportPath = resolve(candidate.f2Root, "Feature2-Report.json");
  const relativePath = relative(resolve(rootDir), reportPath);
  if (relativePath.startsWith("..") || resolve(rootDir, relativePath) !== reportPath) {
    throw createTypedError({ code: "policy_denied", summary: "F2 report path is outside the managed workbench root.", suggestedAction: "Rerun F2 using the managed output root.", affectedInputReferences: [candidate.runId] });
  }
  const handle = await open(reportPath, "r");
  let bytes: Buffer;
  try {
    await assertOpenedFileContained(handle, rootDir, relativePath, "Feature2-Report.json");
    bytes = await handle.readFile();
  } finally {
    await handle.close();
  }
  const persistedReport = f2UserReportSchema.parse(JSON.parse(bytes.toString("utf8")) as unknown);
  if (JSON.stringify(persistedReport) !== JSON.stringify(report)) {
    throw createTypedError({ code: "evidence_mismatch", summary: "F2 report content does not match the governed runner result.", suggestedAction: "Rerun F2 for the current workbook.", affectedInputReferences: [candidate.runId] });
  }
  const artifactId = `f2-report:${snapshot.inputRevision}:${candidate.runId}`;
  const supersededArtifactIds = snapshot.artifactRefs
    ?.filter((reference) => reference.kind === "f2_report" && reference.revision === snapshot.inputRevision && reference.artifactId !== artifactId)
    .map((reference) => reference.artifactId) ?? [];
  return {
    artifactReferenceOps: {
      upsert: [{ artifactId, sessionId: snapshot.sessionId, inputRevision: snapshot.inputRevision, kind: "f2_report", relativePath, contentHash: createHash("sha256").update(bytes).digest("hex") }],
      ...(supersededArtifactIds.length === 0 ? {} : { delete: supersededArtifactIds }),
    },
    runReference: { featureId: "F2", referenceId: candidate.runId, contractVersion: report.contractVersion, workbookHash: scope.workbookContentHash, artifactId, runReference: candidate.runId },
  };
}

function readWorksheetCapabilities(value: unknown): F8SessionSnapshot["worksheetCapabilities"] | undefined {
  if (typeof value !== "object" || value === null || !("worksheetCapabilities" in value) || !Array.isArray(value.worksheetCapabilities)) return undefined;
  const capabilities = value.worksheetCapabilities.filter((candidate): candidate is { readonly worksheetName: string; readonly whatIfAvailable: boolean } =>
    typeof candidate === "object" && candidate !== null && "worksheetName" in candidate && typeof candidate.worksheetName === "string" && "whatIfAvailable" in candidate && typeof candidate.whatIfAvailable === "boolean");
  return capabilities.length === value.worksheetCapabilities.length && capabilities.length > 0 ? capabilities : undefined;
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
  if (["f3_running", "f4_running"].includes(snapshot.activeAttempt?.stage ?? "")) {
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
  const runReference = snapshot.priorRunReferences.findLast((candidate) =>
    candidate.featureId === "F2"
      && candidate.workbookHash === snapshot.downstreamScopeSelection?.workbookContentHash
      && typeof candidate.runReference === "string"
      && candidate.runReference.length > 0);
  if (runReference?.runReference === undefined) {
    throw reviewContextMismatch(snapshot, "The current session does not have one unambiguous validated F2 baseline lineage.");
  }
  return runReference.runReference;
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

function writeSanitizedRunnerError(rootDir: string, sessionId: string, stage: string, error: unknown): void {
  const typed = error as { readonly code?: unknown; readonly summary?: unknown; readonly affectedInputReferences?: unknown };
  writeRegistry(rootDir, "runner-errors", sessionId, {
    stage,
    code: typeof typed.code === "string" ? typed.code : "internal_error",
    summary: typeof typed.summary === "string" ? typed.summary : "Governed runner failed.",
    affectedInputReferences: Array.isArray(typed.affectedInputReferences)
      ? typed.affectedInputReferences.filter((value): value is string => typeof value === "string" && !value.includes(":\\"))
      : [],
  });
}

function loadOrCreateAuthKey(rootDir: string): Uint8Array {
  const directory = join(rootDir, "runtime", "workbench");
  const keyPath = join(directory, "auth.key");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { return new Uint8Array(readFileSync(keyPath)); } catch {
    const key = randomBytes(32);
    writeFileSync(keyPath, key, { flag: "wx", mode: 0o600 });
    return new Uint8Array(key);
  }
}

function compactScenarioFactorOverride(override: F8WorksheetWhatIfCalculationRequest["factorOverrides"][number]) {
  return { worksheetName: override.worksheetName, tableId: override.tableId, sourceRow: override.sourceRow, ...(override.nominalValue === undefined ? {} : { nominalValue: override.nominalValue }), ...(override.upperTolerance === undefined ? {} : { upperTolerance: override.upperTolerance }), ...(override.lowerTolerance === undefined ? {} : { lowerTolerance: override.lowerTolerance }) };
}

function compactScenarioSystemOverride(override: NonNullable<F8WorksheetWhatIfCalculationRequest["systemSpecification"]>) {
  return { ...(override.lowerSpecLimit === undefined ? {} : { lowerSpecLimit: override.lowerSpecLimit }), ...(override.upperSpecLimit === undefined ? {} : { upperSpecLimit: override.upperSpecLimit }), ...(override.additionalMeanShift === undefined ? {} : { additionalMeanShift: override.additionalMeanShift }) };
}