import { randomBytes, randomUUID } from "node:crypto";

import type { FastifyRequest } from "fastify";

export const SESSION_COOKIE_NAME = "ta_session";
export const CSRF_HEADER_NAME = "x-csrf-token";

export type HostBearerScope = "host-actions:claim" | "host-actions:result" | "host-actions:read" | "sessions:read";

export interface AuthenticatedRequest {
  readonly kind: "browser" | "host";
  readonly sessionId: string;
  readonly scopes: readonly HostBearerScope[];
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
  readonly scopes: readonly HostBearerScope[];
}

export class WorkbenchAuth {
  private readonly browserSessions = new Map<string, BrowserSession>();

  private readonly hostBearers = new Map<string, HostBearer>();

  issueBrowserSession(sessionId = randomUUID()): TestAuthentication {
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

  issueHostBearer(sessionId: string, scopes: readonly HostBearerScope[]): string {
    const token = randomBytes(32).toString("base64url");
    this.hostBearers.set(token, { sessionId, scopes });
    return token;
  }

  readBrowserSession(cookieValue: string | undefined): BrowserSession | undefined {
    return cookieValue === undefined ? undefined : this.browserSessions.get(cookieValue);
  }

  authenticate(request: FastifyRequest): AuthenticatedRequest | undefined {
    const bearer = readBearerToken(request.headers.authorization);
    if (bearer !== undefined) {
      const credential = this.hostBearers.get(bearer);
      if (credential !== undefined) {
        return { kind: "host", sessionId: credential.sessionId, scopes: credential.scopes };
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

function readBearerToken(authorization: string | undefined): string | undefined {
  if (authorization === undefined) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1];
}