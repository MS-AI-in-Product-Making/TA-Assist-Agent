import { randomBytes, randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";

import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

import type { ConversationTurn } from "@ai-assist/conversation";
import type { hostActionClaimSchema, hostActionRequestSchema, hostActionResultSchema } from "@ai-assist/contracts";
import type { F8SessionCommand, F8SessionSnapshot } from "@ai-assist/workbench";

import { WorkbenchAuth, SESSION_COOKIE_NAME, type AuthenticatedRequest, type TestAuthentication } from "./auth.js";
import { createBrowserBootstrapRendezvous, renderBootstrapPage, type BrowserBootstrapRendezvous } from "./bootstrap.js";
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
  issueHostBearer(sessionId: string, scopes: readonly string[]): string;
}

export interface ArtifactRegistry {
  authorize(sessionId: string, artifactId: string, relativePath: string, fileName: string): void;
  read(sessionId: string, artifactId: string): { readonly relativePath: string; readonly fileName: string } | undefined;
}

export interface SessionRegistry {
  create(sessionId: string): F8SessionSnapshot;
  read(sessionId: string): F8SessionSnapshot | undefined;
  applyCommand(command: F8SessionCommand): F8SessionSnapshot;
}

export interface ConversationRegistry {
  append(turn: ConversationTurn): ConversationTurn;
  read(sessionId: string): readonly ConversationTurn[];
}

export interface HostActionRegistry {
  create(request: HostActionRequest): HostActionRequest;
  claim(actionId: string, hostInstanceId: string): HostActionClaim | undefined;
  complete(result: HostActionResult): boolean;
}

export interface WorkbenchServerContext {
  readonly rootDir: string;
  readonly auth: WorkbenchAuth;
  readonly sessions: SessionRegistry;
  readonly conversation: ConversationRegistry;
  readonly hostActions: HostActionRegistry;
  readonly artifacts: ArtifactRegistry;
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
    testAuthenticate: { value: async (sessionId?: string) => auth.issueBrowserSession(sessionId as `${string}-${string}-${string}-${string}-${string}` | undefined), enumerable: true },
    issueHostBearer: { value: (sessionId: string, scopes: readonly string[]) => auth.issueHostBearer(sessionId, scopes as never), enumerable: true },
  });

  app.addHook("onRequest", async (request, reply) => {
    applySecurityHeaders(reply);
    rejectIfUnsafeBrowserBoundary(request, reply);
  });

  await app.register(cookie, { hook: "onRequest" });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 8 } });

  app.get("/", async (_request, reply) => reply.type("text/html; charset=utf-8").send(renderBootstrapPage()));
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
  const sessions = new MemorySessionRegistry();
  return {
    rootDir,
    auth,
    sessions,
    conversation: new MemoryConversationRegistry(),
    hostActions: new MemoryHostActionRegistry(),
    artifacts: new MemoryArtifactRegistry(),
    requireAuthenticated(request, reply) {
      const authenticated = auth.authenticate(request);
      if (authenticated === undefined) {
        reply.code(401).send({ error: "authentication_required" });
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

class MemorySessionRegistry implements SessionRegistry {
  private readonly snapshots = new Map<string, F8SessionSnapshot>();

  create(sessionId: string): F8SessionSnapshot {
    const snapshot = createSnapshot(sessionId, 0, "workbook_required");
    this.snapshots.set(sessionId, snapshot);
    return snapshot;
  }

  read(sessionId: string): F8SessionSnapshot | undefined {
    return this.snapshots.get(sessionId);
  }

  applyCommand(command: F8SessionCommand): F8SessionSnapshot {
    const current = this.snapshots.get(command.sessionId) ?? createSnapshot(command.sessionId, 0, "workbook_required");
    const next = createSnapshot(command.sessionId, current.revision + 1, current.state);
    this.snapshots.set(command.sessionId, next);
    return next;
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

  complete(result: HostActionResult): boolean {
    const action = this.actions.get(result.actionId);
    if (action?.claim?.leaseId !== result.leaseId) {
      return false;
    }

    if (result.resultHash !== createHash("sha256").update(JSON.stringify(result.payload)).digest("hex")) {
      return false;
    }

    this.actions.set(result.actionId, { request: action.request, claim: action.claim, result });
    return true;
  }
}

class MemoryArtifactRegistry implements ArtifactRegistry {
  private readonly artifacts = new Map<string, { readonly sessionId: string; readonly relativePath: string; readonly fileName: string }>();

  authorize(sessionId: string, artifactId: string, relativePath: string, fileName: string): void {
    this.artifacts.set(artifactId, { sessionId, relativePath, fileName });
  }

  read(sessionId: string, artifactId: string): { readonly relativePath: string; readonly fileName: string } | undefined {
    const artifact = this.artifacts.get(artifactId);
    return artifact?.sessionId === sessionId ? artifact : undefined;
  }
}

function createSnapshot(sessionId: string, revision: number, state: F8SessionSnapshot["state"]): F8SessionSnapshot {
  return {
    contractVersion: "f8-session-snapshot-v1",
    sessionId,
    revision,
    inputRevision: 0,
    state,
    activeAttempt: null,
    priorRunReferences: [],
  };
}