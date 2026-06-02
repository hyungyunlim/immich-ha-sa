import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { fail } from './http.js';
import type { JsonStore } from './store.js';

const PAIRING_TTL_MS = 15 * 60 * 1000;
const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface ActivePairingCode {
  code: string;
  codeHash: string;
  expiresAt: string;
}

export class ControllerAuthManager {
  private activePairingCode?: ActivePairingCode;

  constructor(
    private readonly store: JsonStore,
    private readonly staticToken: string | undefined,
  ) {}

  authRequired(): boolean {
    return Boolean(this.staticToken) || this.store.getAuthTokens().length > 0;
  }

  status(): {
    authRequired: boolean;
    paired: boolean;
    issuedTokenCount: number;
    pairingExpiresAt?: string;
  } {
    const tokens = this.store.getAuthTokens();
    const pairing = this.currentPairingState();
    return {
      authRequired: this.authRequired(),
      paired: Boolean(this.staticToken) || tokens.length > 0,
      issuedTokenCount: tokens.length,
      pairingExpiresAt: pairing?.expiresAt,
    };
  }

  ensurePairingCode(): ActivePairingCode {
    const now = Date.now();
    if (this.activePairingCode && Date.parse(this.activePairingCode.expiresAt) > now) {
      return this.activePairingCode;
    }

    const code = generatePairingCode();
    const codeHash = hashSecret(normalizePairingCode(code));
    const expiresAt = new Date(now + PAIRING_TTL_MS).toISOString();
    const createdAt = new Date(now).toISOString();
    this.activePairingCode = { code, codeHash, expiresAt };
    this.store.setPairingState({ codeHash, createdAt, expiresAt });
    return this.activePairingCode;
  }

  completePairing(
    pairingCode: string,
    name = 'Home Assistant',
  ): { apiToken: string; tokenId: string; createdAt: string } | undefined {
    const pairing = this.currentPairingState();
    if (!pairing) return undefined;

    const codeHash = hashSecret(normalizePairingCode(pairingCode));
    if (!safeHashEquals(pairing.codeHash, codeHash)) return undefined;

    const apiToken = `ifha_${randomBytes(32).toString('base64url')}`;
    const tokenId = randomBytes(8).toString('hex');
    const createdAt = new Date().toISOString();
    this.store.upsertAuthToken({
      id: tokenId,
      name,
      tokenHash: hashSecret(apiToken),
      createdAt,
    });
    this.activePairingCode = undefined;
    this.store.setPairingState(undefined);
    return { apiToken, tokenId, createdAt };
  }

  requireMutationAuth(request: FastifyRequest, reply: FastifyReply): boolean {
    if (!this.authRequired()) return true;

    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    if (!token) {
      reply.status(401).send(fail('UNAUTHORIZED', 'Missing or invalid controller API token.'));
      return false;
    }

    if (this.staticToken && safeSecretEquals(this.staticToken, token)) return true;

    const tokenHash = hashSecret(token);
    const matched = this.store.getAuthTokens().find((candidate) => (
      safeHashEquals(candidate.tokenHash, tokenHash)
    ));
    if (matched) {
      this.store.markAuthTokenUsed(matched.id);
      return true;
    }

    reply.status(401).send(fail('UNAUTHORIZED', 'Missing or invalid controller API token.'));
    return false;
  }

  private currentPairingState() {
    const pairing = this.store.getPairingState();
    if (!pairing) return undefined;
    if (Date.parse(pairing.expiresAt) <= Date.now()) {
      this.activePairingCode = undefined;
      this.store.setPairingState(undefined);
      return undefined;
    }
    return pairing;
  }
}

function generatePairingCode(): string {
  let value = '';
  for (let index = 0; index < 8; index += 1) {
    value += PAIRING_ALPHABET[randomBytes(1)[0] % PAIRING_ALPHABET.length];
  }
  return `${value.slice(0, 4)}-${value.slice(4)}`;
}

function normalizePairingCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeSecretEquals(expected: string, actual: string): boolean {
  return safeHashEquals(hashSecret(expected), hashSecret(actual));
}

function safeHashEquals(expectedHash: string, actualHash: string): boolean {
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(actualHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
