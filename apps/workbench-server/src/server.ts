import { randomBytes, randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";

import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

import type { ConversationTurn } from "@ai-assist/conversation";
import type { hostActionClaimSchema, hostActionRequestSchema, hostActionResultSchema } from "@ai-assist/contracts";
import { createSessionStore, openSessionStore, reduceSessionCommand, type F8SessionCommand, type F8SessionSnapshot } from "@ai-assist/workbench";

import { WorkbenchAuth, SESSION_COOKIE_NAME, type HostBearerOptions, type AuthenticatedRequest, type TestAuthentication } from "./auth.js";
import { createBrowserBootstrapRendezvous, renderBootstrapPage, renderBootstrapScript, type BrowserBootstrapRendezvous } from "./bootstrap.js";
import { applySecurityHeaders, isMutation, LOOPBACK_HOST, rejectIfUnsafeBrowserBoundary } from "./security.js";
import { artifactsRoutes } from "./routes/artifacts.js";
import { commandsRoutes } from "./routes/commands.js";
import { conversationRoutes } from "./routes/conversation.js";
import { filesRoutes } from "./routes/files.js";
import { hostActionsRoutes } from "./routes/host-actions.js";
import { sessionsRoutes } from "./routes/sessions.js";

type HostActionClaim = ReturnType<typeof hostActionClaimSchema.parse>;
type HostActionRequest = ReturnType<typeof hostActionRequestSchema.parse>;
type HostActionResult = ReturnType<typeof hostActionResultSchema.parse>;

export interface StartWorkbenchServerOptions {
  readonly rootDir: string;
  readonly port?: number;
  readonly bootstrap?: BrowserBootstrapRendezvous;
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
  claim(actionId: string, hostInstanceId: string): HostActionClaim | undefined;
  complete(result: HostActionResult): "accepted" | "rejected" | "duplicate";
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
  requireAuthenticated(request: FastifyRequest, reply: FastifyReply): AuthenticatedRequest | undefined;
  requireBrowserMutation(request: FastifyRequest, reply: FastifyReply): AuthenticatedRequest | undefined;
}

export async function buildWorkbenchServer(options: StartWorkbenchServerOptions): Promise<WorkbenchServer> {
  await mkdir(options.rootDir, { recursive: true });

  const auth = new WorkbenchAuth();
  const context = createWorkbenchServerContext(options.rootDir, auth);
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
    const authenticated = context.requireAuthenticated(request, reply);
    if (authenticated === undefined || authenticated.kind !== "browser") {
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

function createWorkbenchServerContext(rootDir: string, auth: WorkbenchAuth): WorkbenchServerContext {
  const sessions = new StoreBackedSessionRegistry(rootDir);
  return {
    rootDir,
    auth,
    sessions,
    conversation: new MemoryConversationRegistry(),
    hostActions: new MemoryHostActionRegistry(),
    artifacts: new MemoryArtifactRegistry(),
    events: new MemoryEventSource(),
    requireAuthenticated(request, reply) {
      const authenticated = auth.authenticate(request);
      if (authenticated === undefined) {
        reply.code(request.headers.authorization === undefined ? 401 : 403).send({ error: "authentication_required" });
      }

      return authenticated;
    },
    requireBrowserMutation(request, reply) {
      const authenticated = auth.authenticate(request);
      if (authenticated === undefined) {
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

class MemoryConversationRegistry implements ConversationRegistry {
  private readonly turns = new Map<string, ConversationTurn[]>();

  append(turn: ConversationTurn): ConversationTurn {
    const turns = this.turns.get(turn.sessionId) ?? [];
    turns.push(turn);
    this.turns.set(turn.sessionId, turns);
    return turn;
  }

  read(sessionId: string): readonly ConversationTurn[] {
    return this.turns.get(sessionId) ?? [];
  }
}

class MemoryHostActionRegistry implements HostActionRegistry {
  private readonly actions = new Map<string, { request: HostActionRequest; claim?: HostActionClaim; result?: HostActionResult }>();

  create(request: HostActionRequest): HostActionRequest {
    this.actions.set(request.actionId, { request });
    return request;
  }

  claim(actionId: string, hostInstanceId: string): HostActionClaim | undefined {
    const action = this.actions.get(actionId);
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
    this.actions.set(actionId, { ...action, claim });
    return claim;
  }

  complete(result: HostActionResult): "accepted" | "rejected" | "duplicate" {
    const action = this.actions.get(result.actionId);
    if (action?.result !== undefined) {
      return "duplicate";
    }

    if (action?.claim?.leaseId !== result.leaseId || action.claim.hostInstanceId !== result.hostInstanceId || Date.parse(action.claim.leaseExpiresAt) <= Date.now()) {
      return "rejected";
    }

    if (result.resultHash !== createHash("sha256").update(JSON.stringify(result.payload)).digest("hex")) {
      return "rejected";
    }

    this.actions.set(result.actionId, { request: action.request, claim: action.claim, result });
    return "accepted";
  }
}

class MemoryArtifactRegistry implements ArtifactRegistry {
  private readonly artifacts = new Map<string, { readonly sessionId: string; readonly relativePath: string; readonly fileName: string; readonly classification: ArtifactClassification; readonly mimeType: string }>();

  authorize(sessionId: string, artifactId: string, relativePath: string, fileName: string, classification: ArtifactClassification, mimeType: string): void {
    this.artifacts.set(artifactId, { sessionId, relativePath, fileName, classification, mimeType });
  }

  read(sessionId: string, artifactId: string): { readonly relativePath: string; readonly fileName: string; readonly classification: ArtifactClassification; readonly mimeType: string } | undefined {
    const artifact = this.artifacts.get(artifactId);
    return artifact?.sessionId === sessionId ? artifact : undefined;
  }
}

class MemoryEventSource implements EventSource {
  private readonly events = new Map<string, StoredEvent[]>();

  private readonly subscribers = new Map<string, Set<(event: StoredEvent) => void>>();

  publish(sessionId: string, eventName: string, payload: unknown): void {
    const events = this.events.get(sessionId) ?? [];
    const event = { id: String(events.length + 1), eventName, payload };
    events.push(event);
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