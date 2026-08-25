import { randomBytes, randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

import type { ConversationTurn } from "@ai-assist/conversation";
import type { hostActionClaimSchema, hostActionRequestSchema, hostActionResultSchema } from "@ai-assist/contracts";
import { acceptAttemptResult, createSessionStore, openSessionStore, reduceSessionCommand, type F8SessionCommand, type F8SessionSnapshot } from "@ai-assist/workbench";
import { createTypedError } from "@ai-assist/contracts";

import { WorkbenchAuth, SESSION_COOKIE_NAME, type HostBearerOptions, type AuthenticatedRequest, type TestAuthentication } from "./auth.js";
import { createBrowserBootstrapRendezvous, renderBootstrapPage, renderBootstrapScript, type BrowserBootstrapRendezvous } from "./bootstrap.js";
import { applySecurityHeaders, isMutation, LOOPBACK_HOST, rejectIfUnsafeBrowserBoundary } from "./security.js";
import { artifactsRoutes } from "./routes/artifacts.js";
import { commandsRoutes } from "./routes/commands.js";
import { conversationRoutes } from "./routes/conversation.js";
import { filesRoutes } from "./routes/files.js";
import { hostActionsRoutes } from "./routes/host-actions.js";
import { sessionsRoutes } from "./routes/sessions.js";
import { createPersistentWorkerQueue, type PersistentWorkerQueue, type QueueSessionStore, type StageJob } from "./worker-queue.js";

type HostActionClaim = ReturnType<typeof hostActionClaimSchema.parse>;
type HostActionRequest = ReturnType<typeof hostActionRequestSchema.parse>;
type HostActionResult = ReturnType<typeof hostActionResultSchema.parse>;

export interface StartWorkbenchServerOptions {
  readonly rootDir: string;
  readonly port?: number;
  readonly bootstrap?: BrowserBootstrapRendezvous;
  readonly runner?: (job: StageJob) => Promise<unknown>;
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
  create(request: HostActionRequest): HostActionRequest;
  claim(sessionId: string, actionId: string, hostInstanceId: string): HostActionClaim | undefined;
  complete(sessionId: string, result: HostActionResult): "accepted" | "rejected" | "duplicate";
}

export interface EventSource {
  publish(sessionId: string, eventName: string, payload: unknown): void;
  replay(sessionId: string, afterEventId: string | undefined): readonly StoredEvent[];
  subscribe(sessionId: string, listener: (event: StoredEvent) => void): () => void;
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
  enqueueActiveAttempt(snapshot: F8SessionSnapshot): Promise<void>;
  requireAuthenticated(request: FastifyRequest, reply: FastifyReply): AuthenticatedRequest | undefined;
  requireBrowserSession(request: FastifyRequest, reply: FastifyReply): AuthenticatedRequest | undefined;
  requireBrowserMutation(request: FastifyRequest, reply: FastifyReply): AuthenticatedRequest | undefined;
}

export async function buildWorkbenchServer(options: StartWorkbenchServerOptions): Promise<WorkbenchServer> {
  await mkdir(options.rootDir, { recursive: true });

  const auth = new WorkbenchAuth();
  const context = await createWorkbenchServerContext(options.rootDir, auth, options.runner);
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

async function createWorkbenchServerContext(rootDir: string, auth: WorkbenchAuth, runner: StartWorkbenchServerOptions["runner"]): Promise<WorkbenchServerContext> {
  const sessions = new StoreBackedSessionRegistry(rootDir);
  const queue = await createPersistentWorkerQueue({
    rootDir: join(rootDir, "runtime", "workbench"),
    sessionStore: new StoreBackedQueueSessionStore(rootDir, sessions),
    worker: async (job) => {
      if (runner !== undefined) return runner(job);
      throw createTypedError({
        code: "dependency_error",
        summary: "No workbench runner is configured.",
        suggestedAction: "Configure a runner executor before starting analysis.",
        affectedInputReferences: ["runner"],
      });
    },
  });
  await queue.reconcile();
  return {
    rootDir,
    auth,
    sessions,
    conversation: new FileBackedConversationRegistry(rootDir),
    hostActions: new FileBackedHostActionRegistry(rootDir),
    artifacts: new FileBackedArtifactRegistry(rootDir),
    events: new MemoryEventSource(),
    queue,
    async enqueueActiveAttempt(snapshot) {
      const attempt = snapshot.activeAttempt;
      if (attempt === null) return;
      await queue.enqueue({
        jobId: attempt.attemptId,
        attemptId: attempt.attemptId,
        kind: attempt.stage === "f1_f2_running" || attempt.stage === "f3_running" ? "excel" : attempt.stage === "ado_action_pending" ? "host" : "calculation",
        stage: attempt.stage,
        payload: { sessionId: snapshot.sessionId },
      });
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

type StoredHostAction = { request: HostActionRequest; claim?: HostActionClaim; result?: HostActionResult };

class FileBackedHostActionRegistry implements HostActionRegistry {
  constructor(private readonly rootDir: string) {}

  create(request: HostActionRequest): HostActionRequest {
    const actions = this.readActions(request.sessionId);
    writeRegistry(this.rootDir, "host-actions", request.sessionId, { ...actions, [request.actionId]: { request } });
    return request;
  }

  claim(sessionId: string, actionId: string, hostInstanceId: string): HostActionClaim | undefined {
    const actions = this.readActions(sessionId);
    const action = actions[actionId];
    if (action === undefined || action.claim !== undefined || Date.parse(action.request.expiresAt) <= Date.now()) {
      return undefined;
    }

    const claim: HostActionClaim = {
      contractVersion: "f8-host-action-claim-v1",
      actionId,
      hostInstanceId,
      leaseId: randomUUID(),
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    writeRegistry(this.rootDir, "host-actions", sessionId, { ...actions, [actionId]: { ...action, claim } });
    return claim;
  }

  complete(sessionId: string, result: HostActionResult): "accepted" | "rejected" | "duplicate" {
    const actions = this.readActions(sessionId);
    const action = actions[result.actionId];
    if (action?.result !== undefined) {
      return "duplicate";
    }

    if (action?.claim?.leaseId !== result.leaseId || action.claim.hostInstanceId !== result.hostInstanceId || Date.parse(action.claim.leaseExpiresAt) <= Date.now()) {
      return "rejected";
    }

    if (result.resultHash !== createHash("sha256").update(JSON.stringify(result.payload)).digest("hex")) {
      return "rejected";
    }

    writeRegistry(this.rootDir, "host-actions", sessionId, { ...actions, [result.actionId]: { request: action.request, claim: action.claim, result } });
    return "accepted";
  }

  private readActions(sessionId: string): Record<string, StoredHostAction> {
    return readRegistry<Record<string, StoredHostAction>>(this.rootDir, "host-actions", sessionId) ?? {};
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

class MemoryEventSource implements EventSource {
  private static readonly MAX_EVENTS_PER_SESSION = 256;

  private readonly events = new Map<string, StoredEvent[]>();

  private readonly subscribers = new Map<string, Set<(event: StoredEvent) => void>>();

  publish(sessionId: string, eventName: string, payload: unknown): void {
    const events = this.events.get(sessionId) ?? [];
    const event = { id: String(events.length + 1), eventName, payload };
    events.push(event);
    if (events.length > MemoryEventSource.MAX_EVENTS_PER_SESSION) events.splice(0, events.length - MemoryEventSource.MAX_EVENTS_PER_SESSION);
    this.events.set(sessionId, events);
    for (const listener of this.subscribers.get(sessionId) ?? []) {
      listener(event);
    }
  }

  replay(sessionId: string, afterEventId: string | undefined): readonly StoredEvent[] {
    const afterId = Number(afterEventId ?? 0);
    return (this.events.get(sessionId) ?? []).filter((event) => Number(event.id) > afterId);
  }

  subscribe(sessionId: string, listener: (event: StoredEvent) => void): () => void {
    const listeners = this.subscribers.get(sessionId) ?? new Set<(event: StoredEvent) => void>();
    listeners.add(listener);
    this.subscribers.set(sessionId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.subscribers.delete(sessionId);
    };
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
    await this.record(current, { result, status: "completed" });
    return true;
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

  private async record(snapshot: F8SessionSnapshot, result: { readonly status: "completed" | "failed"; readonly result: unknown }): Promise<void> {
    const store = await openSessionStore({ rootDir: this.rootDir, sessionId: snapshot.sessionId });
    try {
      await store.recordAttemptResult({
        attemptId: snapshot.activeAttempt!.attemptId,
        status: result.status,
        result: result.result,
        snapshot: acceptAttemptResult(snapshot, { attemptId: snapshot.activeAttempt!.attemptId, status: result.status, result: result.result }),
      });
    } finally {
      await store.close();
    }
  }
}

function readSessionId(value: unknown): string | undefined {
  return typeof value === "object" && value !== null && "sessionId" in value && typeof value.sessionId === "string" ? value.sessionId : undefined;
}