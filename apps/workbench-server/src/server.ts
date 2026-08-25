import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, realpath, stat } from "node:fs/promises";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

import type { ConversationTurn } from "@ai-assist/conversation";
import type { hostActionClaimSchema, hostActionRequestSchema, hostActionResultSchema } from "@ai-assist/contracts";
import { acceptAttemptResult, canonicalSelectedWorksheetSetHash, createSessionStore, openSessionStore, reduceSessionCommand, type F8SessionCommand, type F8SessionSnapshot, type ReviewContextIdentity, type SessionArtifactReference, type SessionDeltaOperations } from "@ai-assist/workbench";
import { createTypedError } from "@ai-assist/contracts";
import { createHostActionStore } from "@ai-assist/workbench";

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
}

export interface ConversationRegistry {
  append(turn: ConversationTurn): ConversationTurn;
  read(sessionId: string): readonly ConversationTurn[];
}

export interface HostActionRegistry {
  create(request: HostActionRequest): Promise<HostActionRequest | undefined>;
  claim(sessionId: string, actionId: string, hostInstanceId: string): Promise<HostActionClaim | undefined>;
  complete(sessionId: string, result: HostActionResult): Promise<"accepted" | "rejected" | "duplicate">;
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
  const context = await createWorkbenchServerContext(options.rootDir, auth, options.runner, options.queueFactory);
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

  app.get("/", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderBootstrapPage()));
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
  app.addHook("onClose", async () => {
    (context.events as SqliteEventSource).close();
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

async function createWorkbenchServerContext(rootDir: string, auth: WorkbenchAuth, runner: StartWorkbenchServerOptions["runner"], queueFactory: StartWorkbenchServerOptions["queueFactory"]): Promise<WorkbenchServerContext> {
  const sessions = new StoreBackedSessionRegistry(rootDir);
  const artifacts = new FileBackedArtifactRegistry(rootDir);
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
    conversation: new FileBackedConversationRegistry(rootDir),
    hostActions: new SqliteHostActionRegistry(rootDir),
    artifacts,
    events: await createSqliteEventSource({ rootDir }),
    queue,
    async createPendingHostAction(snapshot, command) {
      if (snapshot.state !== "ado_action_pending" || command.command !== "confirm_ado_decision") return;
      const decision = (command.payload as { readonly decision: "create_new" | "use_existing" | "local_only" }).decision;
      if (decision === "local_only") return;
      const actionId = `ado-validation:${snapshot.sessionId}:${snapshot.revision}`;
      const confirmationHash = createHash("sha256").update(JSON.stringify({ decision, inputRevision: snapshot.inputRevision })).digest("hex");
      const created = await (new SqliteHostActionRegistry(rootDir)).create({
        contractVersion: "f8-host-action-request-v1",
        actionId,
        sessionId: snapshot.sessionId,
        expectedRevision: snapshot.revision,
        kind: "surface_validate",
        confirmationHash,
        expectedTargetVersion: "ado-decision-v1",
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
}

class FileBackedConversationRegistry implements ConversationRegistry {
  constructor(private readonly rootDir: string) {}

  append(turn: ConversationTurn): ConversationTurn {
    const turns = [...this.read(turn.sessionId)];
    turns.push(turn);
    writeRegistry(this.rootDir, "conversation", turn.sessionId, turns);
    return turn;
  }

  read(sessionId: string): readonly ConversationTurn[] {
    return readRegistry<ConversationTurn[]>(this.rootDir, "conversation", sessionId) ?? [];
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