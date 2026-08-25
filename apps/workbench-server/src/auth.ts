import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import type { FastifyRequest } from "fastify";

export const SESSION_COOKIE_NAME = "ta_session";
export const CSRF_HEADER_NAME = "x-csrf-token";

export type HostBearerScope = "host-actions:claim" | "host-actions:result" | "host-actions:read" | "sessions:read";

export interface AuthenticatedRequest {
  readonly kind: "browser" | "host";
  readonly sessionId: string;
  readonly scopes: readonly HostBearerScope[];
  readonly actionId?: string;
  readonly hostInstanceId?: string;
}

export interface TestAuthentication {
  readonly sessionId: string;
  readonly csrfToken: string;
  readonly cookieValue: string;
  readonly headers: Record<string, string>;
}

interface BrowserSession {
  readonly sessionId: string;
  readonly csrfToken: string;
}

interface HostBearer {
  readonly sessionId: string;
  readonly tokenHash: string;
  readonly scopes: readonly HostBearerScope[];
  readonly expiresAtMs: number;
  readonly actionId?: string;
  readonly hostInstanceId?: string;
}

export interface HostBearerOptions {
  readonly expiresAt?: string;
  readonly ttlMs?: number;
  readonly actionId?: string;
  readonly hostInstanceId?: string;
}

export class WorkbenchAuth {
  private readonly browserSessions = new Map<string, BrowserSession>();

  private readonly hostBearers = new Map<string, HostBearer>();

  issueBrowserSession(sessionId: string = randomUUID()): TestAuthentication {
    const cookieValue = randomBytes(32).toString("base64url");
    const csrfToken = randomBytes(32).toString("base64url");
    this.browserSessions.set(cookieValue, { sessionId, csrfToken });

    return {
      sessionId,
      csrfToken,
      cookieValue,
      headers: {
        host: "127.0.0.1:0",
        cookie: `${SESSION_COOKIE_NAME}=${cookieValue}`,
        [CSRF_HEADER_NAME]: csrfToken,
      },
    };
  }

  rotateBrowserSession(cookieValue: string | undefined, sessionId: string): TestAuthentication {
    if (cookieValue !== undefined) this.browserSessions.delete(cookieValue);
    return this.issueBrowserSession(sessionId);
  }

  issueHostBearer(sessionId: string, scopes: readonly HostBearerScope[], options: HostBearerOptions = {}): string {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const credential: HostBearer = {
      sessionId,
      tokenHash,
      scopes,
      expiresAtMs: options.expiresAt === undefined ? Date.now() + (options.ttlMs ?? 60_000) : Date.parse(options.expiresAt),
      ...(options.actionId === undefined ? {} : { actionId: options.actionId }),
      ...(options.hostInstanceId === undefined ? {} : { hostInstanceId: options.hostInstanceId }),
    };
    this.hostBearers.set(tokenHash, credential);
    return token;
  }

  readBrowserSession(cookieValue: string | undefined): BrowserSession | undefined {
    return cookieValue === undefined ? undefined : this.browserSessions.get(cookieValue);
  }

  authenticate(request: FastifyRequest): AuthenticatedRequest | undefined {
    const bearer = readBearerToken(request.headers.authorization);
    if (bearer !== undefined) {
      const tokenHash = hashToken(bearer);
      const credential = this.hostBearers.get(tokenHash);
      if (credential !== undefined && credential.expiresAtMs > Date.now() && safeTokenHashEqual(credential.tokenHash, tokenHash)) {
        return {
          kind: "host",
          sessionId: credential.sessionId,
          scopes: credential.scopes,
          ...(credential.actionId === undefined ? {} : { actionId: credential.actionId }),
          ...(credential.hostInstanceId === undefined ? {} : { hostInstanceId: credential.hostInstanceId }),
        };
      }
    }

    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const browserSession = this.readBrowserSession(cookies?.[SESSION_COOKIE_NAME]);
    return browserSession === undefined
      ? undefined
      : { kind: "browser", sessionId: browserSession.sessionId, scopes: [] };
  }

  verifyCsrf(request: FastifyRequest, authenticated: AuthenticatedRequest): boolean {
    if (authenticated.kind === "host") {
      return true;
    }

    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const browserSession = this.readBrowserSession(cookies?.[SESSION_COOKIE_NAME]);
    const csrfHeader = request.headers[CSRF_HEADER_NAME];
    return typeof csrfHeader === "string" && csrfHeader.length > 0 && csrfHeader === browserSession?.csrfToken;
  }

  readCsrfToken(sessionId: string, cookieValue: string | undefined): string | undefined {
    const browserSession = this.readBrowserSession(cookieValue);
    return browserSession?.sessionId === sessionId ? browserSession.csrfToken : undefined;
  }
}

export function hasScope(authenticated: AuthenticatedRequest, scope: HostBearerScope): boolean {
  return authenticated.kind === "host" && authenticated.scopes.includes(scope);
}

export function hostBearerMatches(authenticated: AuthenticatedRequest, actionId: string, hostInstanceId: string): boolean {
  return authenticated.kind === "host"
    && authenticated.actionId === actionId
    && authenticated.hostInstanceId === hostInstanceId;
}

function readBearerToken(authorization: string | undefined): string | undefined {
  if (authorization === undefined) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1];
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeTokenHashEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.byteLength === rightBuffer.byteLength && timingSafeEqual(leftBuffer, rightBuffer);
}