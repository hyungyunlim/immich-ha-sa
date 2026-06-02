import { mkdtempSync, rmSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';
import { JsonStore } from '../src/store.js';
import type { AppConfig } from '../src/config.js';
import type { AlbumCacheEntry, FrameDevice } from '../src/types.js';

const tempDirs: string[] = [];

function buildConfig(dir: string): AppConfig {
  const defaultDevice: FrameDevice = {
    id: 'lenovo',
    name: 'Lenovo',
    networkMode: 'auto',
    localControllerBaseUrl: 'http://10.0.0.10:18082',
    externalControllerBaseUrl: 'https://frame.example.com',
    localKioskBaseUrl: 'http://10.0.0.10:3000',
    externalKioskBaseUrl: 'https://frame.example.com/kiosk',
    pollIntervalSeconds: 20,
  };
  return {
    port: 18082,
    dataDir: dir,
    storePath: join(dir, 'state.json'),
    defaultDevice,
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('controller API', () => {
  it('returns resolved frame state', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createServer({ config });

    const response = await server.inject({
      method: 'GET',
      url: '/api/frame/lenovo/state',
      headers: { host: 'frame.example.com', 'x-forwarded-proto': 'https' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.resolvedNetworkMode).toBe('external');
    expect(body.data.rendererUrl).toContain('https://frame.example.com/kiosk');
    await server.close();
  });

  it('rejects unknown album ids when cache is populated', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const store = new JsonStore(config.storePath, config.defaultDevice);
    const album: AlbumCacheEntry = {
      id: 'known-album',
      albumName: 'Known',
      updatedAt: '2026-06-02T00:00:00.000Z',
    };
    store.setAlbumCache({ items: [album], stale: false, refreshedAt: '2026-06-02T00:00:00.000Z' });
    const server = createServer({ config, store });

    const response = await server.inject({
      method: 'PUT',
      url: '/api/frame/lenovo/state',
      payload: { activeAlbumIds: ['missing-album'] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('ALBUM_NOT_FOUND');
    await server.close();
  });

  it('issues paired API tokens for authenticated controllers', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = {
      ...buildConfig(dir),
      controllerApiToken: 'static-secret',
    };
    const server = createServer({ config });

    const unauthenticated = await server.inject({
      method: 'PUT',
      url: '/api/frame/lenovo/state',
      payload: { durationSeconds: 90 },
    });
    expect(unauthenticated.statusCode).toBe(401);

    const setup = await server.inject({
      method: 'GET',
      url: '/setup',
      headers: { host: '10.0.0.10:18082' },
    });
    const pairingCode = setup.body.match(/<div class="value large">([^<]+)<\/div>/)?.[1];
    expect(pairingCode).toBeTruthy();

    const paired = await server.inject({
      method: 'POST',
      url: '/api/pairing/token',
      payload: { pairingCode, name: 'Home Assistant Test' },
    });
    expect(paired.statusCode).toBe(200);
    const apiToken = paired.json().data.apiToken;
    expect(apiToken).toMatch(/^ifha_/);

    const authenticated = await server.inject({
      method: 'PUT',
      url: '/api/frame/lenovo/state',
      headers: { authorization: `Bearer ${apiToken}` },
      payload: { durationSeconds: 90 },
    });
    expect(authenticated.statusCode).toBe(200);
    expect(authenticated.json().data.durationSeconds).toBe(90);

    await server.close();
  });

  it('blocks setup page from the external controller host', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createServer({ config });

    const response = await server.inject({
      method: 'GET',
      url: '/setup',
      headers: { host: 'frame.example.com', 'x-forwarded-proto': 'https' },
    });

    expect(response.statusCode).toBe(403);
    await server.close();
  });

  it('manages multiple devices with separate frame state', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createServer({ config });

    const created = await server.inject({
      method: 'POST',
      url: '/api/devices',
      headers: { host: '10.0.0.10:18082' },
      payload: { id: 'kitchen', name: 'Kitchen Frame' },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().data.device.id).toBe('kitchen');
    expect(created.json().data.frameUrl).toBe('http://10.0.0.10:18082/frame/kitchen');

    const kitchenUpdate = await server.inject({
      method: 'PUT',
      url: '/api/frame/kitchen/state',
      payload: { durationSeconds: 120, layout: 'splitview' },
    });
    expect(kitchenUpdate.statusCode).toBe(200);

    const kitchenState = await server.inject({
      method: 'GET',
      url: '/api/frame/kitchen/state',
      headers: { host: '10.0.0.10:18082' },
    });
    const lenovoState = await server.inject({
      method: 'GET',
      url: '/api/frame/lenovo/state',
      headers: { host: '10.0.0.10:18082' },
    });

    expect(kitchenState.statusCode).toBe(200);
    expect(kitchenState.json().data.durationSeconds).toBe(120);
    expect(kitchenState.json().data.layout).toBe('splitview');
    expect(lenovoState.json().data.durationSeconds).toBe(60);
    expect(lenovoState.json().data.layout).toBe('single');

    await server.close();
  });

  it('updates and deletes console-managed devices', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createServer({ config });

    await server.inject({
      method: 'POST',
      url: '/api/devices',
      headers: { host: '10.0.0.10:18082' },
      payload: { id: 'office', name: 'Office Frame' },
    });

    const updated = await server.inject({
      method: 'PATCH',
      url: '/api/devices/office',
      headers: { host: '10.0.0.10:18082' },
      payload: {
        name: 'Office Desk',
        networkMode: 'local',
        localControllerBaseUrl: 'http://10.0.0.11:18082/',
        localKioskBaseUrl: 'http://10.0.0.11:3000/',
        pollIntervalSeconds: 15,
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.device.name).toBe('Office Desk');
    expect(updated.json().data.device.localControllerBaseUrl).toBe('http://10.0.0.11:18082');
    expect(updated.json().data.state.networkMode).toBe('local');

    const defaultDelete = await server.inject({
      method: 'DELETE',
      url: '/api/devices/lenovo',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(defaultDelete.statusCode).toBe(400);

    const deleted = await server.inject({
      method: 'DELETE',
      url: '/api/devices/office',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(deleted.statusCode).toBe(200);

    const missing = await server.inject({
      method: 'GET',
      url: '/api/frame/office/state',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(missing.statusCode).toBe(404);

    await server.close();
  });

  it('blocks device management from the external controller host', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createServer({ config });

    const response = await server.inject({
      method: 'POST',
      url: '/api/devices',
      headers: { host: 'frame.example.com', 'x-forwarded-proto': 'https' },
      payload: { id: 'remote', name: 'Remote Frame' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('CONSOLE_FORBIDDEN');
    await server.close();
  });

  it('sends FreeKiosk remote commands for configured frames', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const requests: Array<{ method?: string; url?: string; apiKey?: string | string[] }> = [];
    const remote = createHttpServer((request, response) => {
      requests.push({
        method: request.method,
        url: request.url,
        apiKey: request.headers['x-api-key'],
      });
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ success: true, data: { executed: true, command: 'remoteKey' } }));
    });
    await new Promise<void>((resolve) => remote.listen(0, '127.0.0.1', resolve));

    const config = buildConfig(dir);
    const store = new JsonStore(config.storePath, config.defaultDevice);
    const remotePort = (remote.address() as AddressInfo).port;
    store.updateDevice('lenovo', {
      remoteControlType: 'freekiosk',
      remoteApiUrl: `http://127.0.0.1:${remotePort}`,
      remoteApiKey: 'test-key',
    });
    const server = createServer({ config, store });

    const response = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'next' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.endpoint).toBe('/api/remote/right');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: '/api/remote/right',
      apiKey: 'test-key',
    });

    await server.close();
    await new Promise<void>((resolve) => remote.close(() => resolve()));
  });

  it('rejects remote commands when no remote backend is configured', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createServer({ config });

    const response = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'next' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('REMOTE_NOT_CONFIGURED');
    await server.close();
  });

  it('serves the add-on console from root and double-slash setup paths', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createServer({ config });

    const root = await server.inject({
      method: 'GET',
      url: '/',
      headers: { host: '10.0.0.10:18082' },
    });
    const doubleSlash = await server.inject({
      method: 'GET',
      url: '//setup',
      headers: { host: '10.0.0.10:18082' },
    });
    const doubleSlashRoot = await server.inject({
      method: 'GET',
      url: '//',
      headers: { host: '10.0.0.10:18082' },
    });

    expect(root.statusCode).toBe(200);
    expect(root.body).toContain('Immich Frame Controller');
    expect(doubleSlash.statusCode).toBe(200);
    expect(doubleSlash.body).toContain('Pairing Code');
    expect(doubleSlashRoot.statusCode).toBe(200);
    expect(doubleSlashRoot.body).toContain('Immich Frame Controller');
    await server.close();
  });
});
