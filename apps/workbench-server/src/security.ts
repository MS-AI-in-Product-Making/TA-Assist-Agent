import type { FastifyReply, FastifyRequest } from "fastify";

export const LOOPBACK_HOST = "127.0.0.1";

export function applySecurityHeaders(reply: FastifyReply): void {
  reply.header("cache-control", "no-store, max-age=0");
  reply.header("pragma", "no-cache");
  reply.header("x-frame-options", "DENY");
  reply.header("x-content-type-options", "nosniff");
  reply.header("referrer-policy", "no-referrer");
  reply.header("content-security-policy", "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
}

export function isAllowedHostHeader(hostHeader: string | undefined): boolean {
  if (hostHeader === undefined || hostHeader.length === 0) {
    return false;
  }

  const host = hostHeader.toLowerCase().replace(/^\[/, "").replace(/\](:\d+)?$/, "").replace(/:\d+$/, "");
  return host === LOOPBACK_HOST || host === "localhost" || host === "::1";
}

export function isAllowedOriginHeader(originHeader: string | undefined): boolean {
  if (originHeader === undefined) {
    return true;
  }

  try {
    const origin = new URL(originHeader);
    return origin.protocol === "http:" && isAllowedHostHeader(origin.host);
  } catch {
    return false;
  }
}

export function rejectIfUnsafeBrowserBoundary(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!isAllowedHostHeader(request.headers.host) || !isAllowedOriginHeader(request.headers.origin)) {
    reply.code(403).send({ error: "forbidden_loopback_boundary" });
    return true;
  }

  return false;
}

export function isMutation(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}