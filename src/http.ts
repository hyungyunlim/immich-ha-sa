import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorEnvelope, ApiEnvelope } from './types.js';

export function ok<T>(data: T, meta?: Record<string, unknown>): ApiEnvelope<T> {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function fail(code: string, message: string): ApiErrorEnvelope {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

export function requestContext(request: FastifyRequest): { host?: string; protocol?: string } {
  const forwardedHost = request.headers['x-forwarded-host'];
  const forwardedProto = request.headers['x-forwarded-proto'];
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost ?? request.headers.host;
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return {
    host,
    protocol: protocol ?? request.protocol,
  };
}

export function requireMutationAuth(
  token: string | undefined,
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  if (!token) return true;
  const authorization = request.headers.authorization;
  if (authorization === `Bearer ${token}`) return true;
  reply.status(401).send(fail('UNAUTHORIZED', 'Missing or invalid controller API token.'));
  return false;
}

