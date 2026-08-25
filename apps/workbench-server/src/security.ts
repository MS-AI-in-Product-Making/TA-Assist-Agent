import type { FastifyReply, FastifyRequest } from "fastify";
import type { TypedError, TypedErrorCode } from "@ai-assist/contracts";

export const LOOPBACK_HOST = "127.0.0.1";

export function applySecurityHeaders(reply: FastifyReply): void {
  reply.header("cache-control", "no-store, max-age=0");
  reply.header("pragma", "no-cache");
  reply.header("x-frame-options", "DENY");
  reply.header("x-content-type-options", "nosniff");
  reply.header("referrer-policy", "no-referrer");
  reply.header("content-security-policy", "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
}

export function safeErrorResponse(error: unknown, fallbackCode: TypedErrorCode = "validation_error"): { readonly error: TypedError } {
  const typed = typeof error === "object" && error !== null ? error as Partial<TypedError> : undefined;
  return {
    error: {
      code: isTypedErrorCode(typed?.code) ? typed.code : fallbackCode,
      runId: typeof typed?.runId === "string" ? typed.runId : crypto.randomUUID(),
      summary: isTypedErrorCode(typed?.code) ? String(typed.summary ?? "Request rejected.") : "Request rejected.",
      retryable: typeof typed?.retryable === "boolean" ? typed.retryable : false,
      suggestedAction: typeof typed?.suggestedAction === "string" ? typed.suggestedAction : "Review the request and try again.",
      affectedInputReferences: Array.isArray(typed?.affectedInputReferences) ? typed.affectedInputReferences.filter((value): value is string => typeof value === "string") : [],
    },
  };
}

export function errorStatusCode(error: unknown): number {
  const statusCode = (error as { readonly statusCode?: unknown } | undefined)?.statusCode;
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 600) return statusCode;
  const code = typeof error === "object" && error !== null ? (error as { readonly code?: unknown }).code : undefined;
  if (code === "validation_error") return 409;
  if (code === "evidence_mismatch") return 409;
  if (code === "policy_denied") return 403;
  return 400;
}

function isTypedErrorCode(value: unknown): value is TypedErrorCode {
  return value === "validation_error" || value === "policy_denied" || value === "evidence_mismatch" || value === "prerequisite_not_ready" || value === "calculation_not_possible" || value === "feature_not_available" || value === "dependency_error" || value === "transient_error" || value === "internal_error";
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