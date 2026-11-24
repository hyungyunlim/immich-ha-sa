import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { ControllerAuthManager } from '../src/auth.js';
import { JsonStore } from '../src/store.js';
import type { FrameDevice } from '../src/types.js';

const device: FrameDevice = {
  id: 'lenovo',
  name: 'Lenovo',
  networkMode: 'auto',
  localControllerBaseUrl: 'http://10.0.0.10:18082',
  localKioskBaseUrl: 'http://10.0.0.10:3000',
  pollIntervalSeconds: 20,
};

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function storePath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'immich-frame-auth-'));
  tempDirs.push(dir);
  return join(dir, 'state.json');
}

function accepts(auth: ControllerAuthManager, token: string): boolean {
  const request = { headers: { authorization: `Bearer ${token}` } } as FastifyRequest;
  const reply = { status: () => reply, send: () => reply } as unknown as FastifyReply;
  return auth.requireMutationAuth(request, reply);
}

describe('ControllerAuthManager.ensureDiscoveryToken', () => {
  it('issues one token that survives a restart and authorizes the integration', () => {
    const path = storePath();
    const token = new ControllerAuthManager(new JsonStore(path, device), undefined).ensureDiscoveryToken();
    expect(token).toMatch(/^ifha_/);

    const restarted = new ControllerAuthManager(new JsonStore(path, device), undefined);
    expect(restarted.ensureDiscoveryToken()).toBe(token);
    expect(restarted.status().issuedTokenCount).toBe(1);
    expect(accepts(restarted, token!)).toBe(true);
    expect(accepts(restarted, 'ifha_wrong')).toBe(false);
  });

  it('issues none for a controller already paired with a code or a static token', () => {
    const paired = new ControllerAuthManager(new JsonStore(storePath(), device), undefined);
    expect(paired.completePairing(paired.ensurePairingCode().code)).toBeTruthy();
    expect(paired.ensureDiscoveryToken()).toBeUndefined();
    expect(paired.status().issuedTokenCount).toBe(1);

    const staticToken = new ControllerAuthManager(new JsonStore(storePath(), device), 'static-secret');
    expect(staticToken.ensureDiscoveryToken()).toBeUndefined();
    expect(staticToken.status().issuedTokenCount).toBe(0);
  });
});
