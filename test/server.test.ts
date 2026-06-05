import { mkdtempSync, rmSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '../src/server.js';
import { JsonStore } from '../src/store.js';
import type { AppConfig } from '../src/config.js';
import type { ImmichClient } from '../src/immichClient.js';
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

function createTestServer(deps: Parameters<typeof createServer>[0]) {
  return createServer({
    kioskConnectionChecker: async () => ({
      status: 'ok',
      statusCode: 200,
      message: 'Reachable',
      checkedAt: '2026-06-02T00:00:00.000Z',
    }),
    ...deps,
  });
}

describe('controller API', () => {
  it('returns resolved frame state', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createTestServer({ config });

    const response = await server.inject({
      method: 'GET',
      url: '/api/frame/lenovo/state',
      headers: { host: 'frame.example.com', 'x-forwarded-proto': 'https' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.resolvedNetworkMode).toBe('external');
    expect(body.data.rendererUrl).toContain('https://frame.example.com/kiosk-proxy/lenovo/');
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
    const server = createTestServer({ config, store });

    const response = await server.inject({
      method: 'PUT',
      url: '/api/frame/lenovo/state',
      payload: { activeAlbumIds: ['missing-album'] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('ALBUM_NOT_FOUND');
    await server.close();
  });

  it('updates kiosk asset filters in frame state and renderer URL', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createTestServer({ config });

    const response = await server.inject({
      method: 'PUT',
      url: '/api/frame/lenovo/state',
      payload: {
        filterDate: 'last-30-days',
        filterNewest: 200,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.filterDate).toBe('last-30-days');
    expect(body.data.filterNewest).toBe(200);
    expect(body.data.rendererUrl).toContain('filter_date=last-30-days');
    expect(body.data.rendererUrl).toContain('filter_newest=200');
    await server.close();
  });

  it('returns authenticated integration device choices without local console access', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = {
      ...buildConfig(dir),
      controllerApiToken: 'test-token',
    };
    const store = new JsonStore(config.storePath, config.defaultDevice);
    store.createDevice({
      ...config.defaultDevice,
      id: 'office',
      name: 'Office Frame',
      remoteControlType: 'freekiosk',
      remoteApiUrl: 'http://10.0.0.23:8080',
    });
    const server = createTestServer({ config, store });

    const localConsoleResponse = await server.inject({
      method: 'GET',
      url: '/api/devices',
      headers: { host: 'frame.example.com', 'x-forwarded-proto': 'https' },
    });
    expect(localConsoleResponse.statusCode).toBe(403);

    const unauthenticated = await server.inject({
      method: 'GET',
      url: '/api/integration/devices',
      headers: { host: 'frame.example.com', 'x-forwarded-proto': 'https' },
    });
    expect(unauthenticated.statusCode).toBe(401);

    const response = await server.inject({
      method: 'GET',
      url: '/api/integration/devices',
      headers: {
        authorization: 'Bearer test-token',
        host: 'frame.example.com',
        'x-forwarded-proto': 'https',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'lenovo',
        name: 'Lenovo',
        remoteApiConfigured: false,
      }),
      expect.objectContaining({
        id: 'office',
        name: 'Office Frame',
        remoteControlType: 'freekiosk',
        remoteApiConfigured: true,
      }),
    ]));
    expect(JSON.stringify(body)).not.toContain('test-token');
    expect(JSON.stringify(body)).not.toContain('10.0.0.23:8080');
    await server.close();
  });

  it('automatically refreshes the album cache from Immich', async () => {
    vi.useFakeTimers();
    try {
      const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
      tempDirs.push(dir);
      const config = {
        ...buildConfig(dir),
        albumRefreshIntervalSeconds: 2,
      };
      const store = new JsonStore(config.storePath, config.defaultDevice);
      const album: AlbumCacheEntry = {
        id: 'auto-album',
        albumName: 'Auto Album',
        updatedAt: '2026-06-04T00:00:00.000Z',
      };
      const immichClient = {
        checkConnection: vi.fn(async () => ({ ok: true })),
        listAlbums: vi.fn(async () => [album]),
      } as unknown as ImmichClient;
      const server = createTestServer({ config, store, immichClient });

      await vi.advanceTimersByTimeAsync(1000);

      expect(immichClient.listAlbums).toHaveBeenCalledTimes(1);
      const albums = await server.inject({
        method: 'GET',
        url: '/api/immich/albums',
      });
      expect(albums.statusCode).toBe(200);
      expect(albums.json().data.items).toEqual([album]);
      expect(albums.json().data.stale).toBe(false);

      const health = await server.inject({
        method: 'GET',
        url: '/api/health',
      });
      expect(health.json().data.albumCache.refreshIntervalSeconds).toBe(2);

      await server.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('issues paired API tokens for authenticated controllers', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = {
      ...buildConfig(dir),
      controllerApiToken: 'static-secret',
    };
    const server = createTestServer({ config });

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
    const server = createTestServer({ config });

    const response = await server.inject({
      method: 'GET',
      url: '/setup',
      headers: { host: 'frame.example.com', 'x-forwarded-proto': 'https' },
    });

    expect(response.statusCode).toBe(403);
    await server.close();
  });

  it('shows local and external frame URLs in setup console', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createTestServer({ config });

    const response = await server.inject({
      method: 'GET',
      url: '/setup',
      headers: { host: '10.0.0.10:18082' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Stable Frame URL');
    expect(response.body).toContain('Local Frame URL');
    expect(response.body).toContain('External Frame URL');
    expect(response.body).toContain('http://10.0.0.10:18082/f/lenovo');
    expect(response.body).toContain('https://frame.example.com/f/lenovo');
    expect(response.body).toContain('http://10.0.0.10:18082/frame/lenovo');
    expect(response.body).toContain('Copy Pair URL');
    expect(response.body).toContain('http://10.0.0.10:18082/pair');
    expect(response.body).toContain('The add-on root URL opens this setup console');
    expect(response.body).toContain('Pair URL ending in <code>/pair</code>');
    expect(response.body).toContain('Advanced settings');
    expect(response.body).toContain('Blank inherits http://10.0.0.10:3000.');
    expect(response.body).toContain('title="Lenovo preview"');
    expect(response.body).toContain('http://10.0.0.10:18082/frame/lenovo?preview=1');
    expect(response.body).toContain('Preview Orientation');
    expect(response.body).toContain('FreeKiosk enables Android REST controls');
    expect(response.body).toContain('https://freekiosk.app/docs/');
    expect(response.body).toContain('External Kiosk Renderer URL');
    expect(response.body).toContain('<details class="frame-details">');
    expect(response.body).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(response.body).toContain("setStatus(form, 'Saved', false, 1800);");
    expect(response.body).toContain('function reloadSoon()');
    expect(response.body).toContain('data-device-name');
    expect(response.body).toContain('function controllerPath(path)');
    expect(response.body).toContain('fetch(controllerPath(path),');
    expect(response.body).toContain("'Request failed' + status");
    expect(response.body).not.toContain('fetch(path,');
    await server.close();
  });

  it('explains that an external kiosk renderer URL is not the external frame URL', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    config.defaultDevice.externalControllerBaseUrl = undefined;
    config.defaultDevice.externalKioskBaseUrl = 'https://frame.example.com';
    const server = createTestServer({ config });

    const response = await server.inject({
      method: 'GET',
      url: '/setup',
      headers: { host: '10.0.0.10:18082' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('External Kiosk Renderer URL is set, but External Frame URL needs External Controller URL');
    expect(response.body).toContain('Copy to Controller URL');
    expect(response.body).toContain('data-use-external-kiosk-as-controller');
    await server.close();
  });

  it('renders frame preview mode without event client behavior', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createTestServer({ config });

    const normal = await server.inject({
      method: 'GET',
      url: '/frame/lenovo',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(normal.statusCode).toBe(200);
    expect(normal.body).toContain('var previewMode = false;');
    expect(normal.body).toContain('var pollIntervalMs = 20000;');

    const preview = await server.inject({
      method: 'GET',
      url: '/frame/lenovo?preview=1',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain('var previewMode = true;');
    expect(preview.body).toContain('var pollIntervalMs = 60000;');

    const stable = await server.inject({
      method: 'GET',
      url: '/f/lenovo',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(stable.statusCode).toBe(200);
    expect(stable.body).toContain('var deviceId = "lenovo"');

    await server.close();
  });

  it('claims an external root pairing code into a stable alias frame path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createTestServer({ config });

    const pairing = await server.inject({
      method: 'GET',
      url: '/',
      headers: { host: 'frame.example.com', 'x-forwarded-proto': 'https' },
    });
    expect(pairing.statusCode).toBe(200);
    expect(pairing.body).toContain('Pair this frame');
    expect(pairing.body).toContain('min-height: 100dvh;');
    expect(pairing.body).toContain('font-size: clamp(48px, 15vmin, 150px);');
    expect(pairing.body).toContain('white-space: nowrap;');
    const code = pairing.body.match(/<div class="code">([^<]+)<\/div>/)?.[1];
    expect(code).toMatch(/^\d{3} \d{3}$/);

    const pending = await server.inject({
      method: 'GET',
      url: '/api/frame-claims',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(pending.statusCode).toBe(200);
    expect(pending.json().data.items).toHaveLength(1);
    const claimId = pending.json().data.items[0].id;

    const claimed = await server.inject({
      method: 'POST',
      url: `/api/frame-claims/${encodeURIComponent(code ?? '')}/claim`,
      headers: { host: '10.0.0.10:18082' },
      payload: {
        name: 'Kitchen Frame',
        alias: 'kitchen-frame',
        previewOrientation: 'portrait',
      },
    });
    expect(claimed.statusCode).toBe(200);
    expect(claimed.json().data.device.alias).toBe('kitchen-frame');
    expect(claimed.json().data.localFrameUrl).toBe('http://10.0.0.10:18082/f/kitchen-frame');
    expect(claimed.json().data.externalFrameUrl).toBe('https://frame.example.com/f/kitchen-frame');

    const status = await server.inject({
      method: 'GET',
      url: `/api/frame-claims/${claimId}`,
      headers: { host: 'frame.example.com', 'x-forwarded-proto': 'https' },
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().data.status).toBe('claimed');
    expect(status.json().data.framePath).toBe('/f/kitchen-frame');

    const frame = await server.inject({
      method: 'GET',
      url: '/f/kitchen-frame',
      headers: { host: 'frame.example.com', 'x-forwarded-proto': 'https' },
    });
    expect(frame.statusCode).toBe(200);
    expect(frame.body).toContain('var deviceId = "kitchen_frame"');

    await server.close();
  });

  it('manages multiple devices with separate frame state', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createTestServer({ config });

    const created = await server.inject({
      method: 'POST',
      url: '/api/devices',
      headers: { host: '10.0.0.10:18082' },
      payload: { id: 'kitchen', name: 'Kitchen Frame' },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().data.device.id).toBe('kitchen');
    expect(created.json().data.device.previewOrientation).toBe('landscape');
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
    const server = createTestServer({ config });

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
        alias: 'office-desk',
        networkMode: 'local',
        previewOrientation: 'portrait',
        localControllerBaseUrl: 'http://10.0.0.11:18082/',
        localKioskBaseUrl: 'http://10.0.0.11:3000/',
        pollIntervalSeconds: 15,
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.device.name).toBe('Office Desk');
    expect(updated.json().data.device.alias).toBe('office-desk');
    expect(updated.json().data.device.previewOrientation).toBe('portrait');
    expect(updated.json().data.localStableFrameUrl).toBe('http://10.0.0.11:18082/f/office-desk');
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

  it('preserves device URLs when patching remote settings only', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createTestServer({ config });

    const updated = await server.inject({
      method: 'PATCH',
      url: '/api/devices/lenovo',
      headers: { host: '10.0.0.10:18082' },
      payload: {
        remoteControlType: 'freekiosk',
        remoteApiUrl: 'http://10.0.0.50:8080/',
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.device.localControllerBaseUrl).toBe('http://10.0.0.10:18082');
    expect(updated.json().data.device.localKioskBaseUrl).toBe('http://10.0.0.10:3000');
    expect(updated.json().data.device.remoteApiUrl).toBe('http://10.0.0.50:8080');
    expect(updated.json().data.frameUrl).toBe('http://10.0.0.10:18082/frame/lenovo');

    const state = await server.inject({
      method: 'GET',
      url: '/api/frame/lenovo/state',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(state.statusCode).toBe(200);
    expect(state.json().data.rendererUrl).toContain('http://10.0.0.10:18082/kiosk-proxy/lenovo/');

    await server.close();
  });

  it('uses device kiosk password override without leaking it through device APIs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = {
      ...buildConfig(dir),
      kioskPassword: 'global-secret',
    };
    const store = new JsonStore(config.storePath, config.defaultDevice);
    store.updateDevice('lenovo', { kioskPassword: 'device-secret' });
    const server = createTestServer({ config, store });

    const state = await server.inject({
      method: 'GET',
      url: '/api/frame/lenovo/state',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(state.statusCode).toBe(200);
    expect(state.json().data.rendererUrl).toContain('password=device-secret');
    expect(state.json().data.rendererUrl).not.toContain('global-secret');

    const devices = await server.inject({
      method: 'GET',
      url: '/api/devices',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(devices.statusCode).toBe(200);
    const item = devices.json().data.items.find((device: { id: string }) => device.id === 'lenovo');
    expect(item.kioskPasswordConfigured).toBe(true);
    expect(item.kioskPasswordSource).toBe('device');
    expect(JSON.stringify(item)).not.toContain('device-secret');

    await server.close();
  });

  it('blocks device management from the external controller host', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createTestServer({ config });

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
    const server = createTestServer({ config, store });

    const response = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'screen-on' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.endpoint).toBe('/api/screen/on');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: '/api/screen/on',
      apiKey: 'test-key',
    });

    const volume = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'volume-up' },
    });

    expect(volume.statusCode).toBe(200);
    expect(volume.json().data.endpoint).toBe('/api/remote/keyboard/volumeup');
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({
      method: 'POST',
      url: '/api/remote/keyboard/volumeup',
      apiKey: 'test-key',
    });

    const deviceMute = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'device-mute-toggle' },
    });

    expect(deviceMute.statusCode).toBe(200);
    expect(deviceMute.json().data.endpoint).toBe('/api/remote/keyboard/mute');
    expect(requests).toHaveLength(3);
    expect(requests[2]).toMatchObject({
      method: 'POST',
      url: '/api/remote/keyboard/mute',
      apiKey: 'test-key',
    });

    const mute = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'mute-toggle' },
    });

    expect(mute.statusCode).toBe(200);
    expect(mute.json().data.frameEvent).toMatchObject({ connectedClients: 0, delivered: 0 });
    expect(mute.json().data.remoteFallback.endpoint).toBe('/api/remote/up');
    expect(requests).toHaveLength(4);
    expect(requests[3]).toMatchObject({
      method: 'POST',
      url: '/api/remote/up',
      apiKey: 'test-key',
    });

    await server.close();
    await new Promise<void>((resolve) => remote.close(() => resolve()));
  });

  it('proxies FreeKiosk status, brightness, and volume controls', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const requests: Array<{ method?: string; url?: string; body?: unknown; apiKey?: string | string[] }> = [];
    const remote = createHttpServer((request, response) => {
      let raw = '';
      request.on('data', (chunk) => {
        raw += String(chunk);
      });
      request.on('end', () => {
        requests.push({
          method: request.method,
          url: request.url,
          body: raw ? JSON.parse(raw) as unknown : undefined,
          apiKey: request.headers['x-api-key'],
        });
        response.setHeader('content-type', 'application/json');

        if (request.url === '/') {
          response.end(JSON.stringify({
            success: true,
            data: {
              endpoints: {
                GET: ['/api/status - Full device status', '/api/sensors - Device sensors'],
                POST: ['/api/brightness - Set brightness {value: 0-100}', '/api/volume - Set volume {value: 0-100}'],
              },
            },
          }));
          return;
        }

        if (request.url === '/api/status') {
          response.end(JSON.stringify({
            success: true,
            data: {
              screen: { on: true, brightness: 55 },
              audio: { volume: 42 },
              sensors: { light: 123, proximity: 0 },
              autoBrightness: { enabled: false, min: 0, max: 100, currentLightLevel: 123 },
            },
          }));
          return;
        }

        if (request.url === '/api/brightness' || request.url === '/api/volume') {
          response.end(JSON.stringify({ success: true, data: { executed: true } }));
          return;
        }

        response.statusCode = 404;
        response.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
      });
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
    const server = createTestServer({ config, store });

    const status = await server.inject({
      method: 'GET',
      url: '/api/frames/lenovo/remote/status',
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().data.status.screen.brightness).toBe(55);
    expect(status.json().data.status.audio.volume).toBe(42);
    expect(status.json().data.status.sensors.light).toBe(123);
    expect(status.json().data.capabilities.autoBrightnessStatus).toBe(true);
    expect(status.json().data.capabilities.autoBrightnessControl).toBe(false);

    const brightness = await server.inject({
      method: 'PUT',
      url: '/api/frames/lenovo/remote/brightness',
      payload: { value: 61 },
    });
    expect(brightness.statusCode).toBe(200);
    expect(brightness.json().data.endpoint).toBe('/api/brightness');

    const volume = await server.inject({
      method: 'PUT',
      url: '/api/frames/lenovo/remote/volume',
      payload: { value: 33 },
    });
    expect(volume.statusCode).toBe(200);
    expect(volume.json().data.endpoint).toBe('/api/volume');

    expect(requests).toEqual([
      { method: 'GET', url: '/api/status', body: undefined, apiKey: 'test-key' },
      { method: 'GET', url: '/', body: undefined, apiKey: 'test-key' },
      { method: 'POST', url: '/api/brightness', body: { value: 61 }, apiKey: 'test-key' },
      { method: 'POST', url: '/api/volume', body: { value: 33 }, apiKey: 'test-key' },
    ]);

    await server.close();
    await new Promise<void>((resolve) => remote.close(() => resolve()));
  });

  it('emits frame commands without requiring a remote backend', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createTestServer({ config });

    const response = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'mute-toggle' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.command).toBe('mute-toggle');
    expect(response.json().data.frameEvent).toMatchObject({ connectedClients: 0, delivered: 0 });
    expect(response.json().data.remoteFallback).toBeNull();
    await server.close();
  });

  it('rejects screen commands when no remote backend is configured', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createTestServer({ config });

    const response = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'screen-off' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('REMOTE_NOT_CONFIGURED');
    await server.close();
  });

  it('proxies immich-kiosk through the controller origin', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const kioskRequests: string[] = [];
    const kiosk = createHttpServer((request, response) => {
      kioskRequests.push(request.url ?? '');
      if (request.url?.startsWith('/style.css')) {
        response.setHeader('content-type', 'text/css');
        response.end('body{background-image:url("/image")}.frame--background{position:absolute;inset:-5%}.frame--background img{width:100%;height:100%;object-fit:cover}');
        return;
      }
      if (request.url?.startsWith('/kiosk.js')) {
        response.setHeader('content-type', 'text/javascript');
        response.end('const dataAttr = /^data-[\\w]+$/; navigator.serviceWorker.register("/assets/js/sw.js"); if (path.startsWith("/asset/")) startPolling();');
        return;
      }
      if (request.url?.startsWith('/video')) {
        response.statusCode = request.headers.range ? 206 : 200;
        response.setHeader('accept-ranges', 'bytes');
        response.setHeader('content-range', 'bytes 0-3/8');
        response.setHeader('content-type', 'video/mp4');
        response.end(Buffer.from([0, 1, 2, 3]));
        return;
      }
      if (request.url?.startsWith('/image')) {
        response.setHeader('content-type', 'image/gif');
        response.end(Buffer.from([71, 73, 70, 56, 57, 97]));
        return;
      }
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end('<link href="/style.css"><script src="/kiosk.js"></script><main hx-post="/asset/new"><img src="/image"></main>');
    });
    await new Promise<void>((resolve) => kiosk.listen(0, '127.0.0.1', resolve));

    const config = buildConfig(dir);
    const store = new JsonStore(config.storePath, config.defaultDevice);
    const kioskPort = (kiosk.address() as AddressInfo).port;
    store.updateDevice('lenovo', {
      localKioskBaseUrl: `http://127.0.0.1:${kioskPort}`,
    });
    const server = createTestServer({ config, store });

    const state = await server.inject({
      method: 'GET',
      url: '/api/frame/lenovo/state',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(state.statusCode).toBe(200);
    expect(state.json().data.rendererUrl).toContain('http://10.0.0.10:18082/kiosk-proxy/lenovo/');

    const html = await server.inject({
      method: 'GET',
      url: '/kiosk-proxy/lenovo/?duration=60',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(html.statusCode).toBe(200);
    expect(html.body).toContain('href="/kiosk-proxy/lenovo/style.css"');
    expect(html.body).toContain('src="/kiosk-proxy/lenovo/kiosk.js"');
    expect(html.body).toContain('hx-post="/kiosk-proxy/lenovo/asset/new"');
    expect(html.body).toContain('src="/kiosk-proxy/lenovo/image"');

    const css = await server.inject({
      method: 'GET',
      url: '/kiosk-proxy/lenovo/style.css',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(css.statusCode).toBe(200);
    expect(css.body).toContain('url("/kiosk-proxy/lenovo/image")');
    expect(css.body).toContain('legacy Android WebView background-fill fix');
    expect(css.body).toContain('.frame--background img');
    expect(css.body).toContain('-webkit-transform: translateZ(0)');

    const javascript = await server.inject({
      method: 'GET',
      url: '/kiosk-proxy/lenovo/kiosk.js',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(javascript.statusCode).toBe(200);
    expect(javascript.body).toContain('const dataAttr = /^data-[\\w]+$/;');
    expect(javascript.body).toContain('register("/kiosk-proxy/lenovo/assets/js/sw.js")');
    expect(javascript.body).toContain('startsWith("/kiosk-proxy/lenovo/asset/")');
    expect(javascript.body).not.toContain('/kiosk-proxy/lenovo/^data');

    const video = await server.inject({
      method: 'GET',
      url: '/kiosk-proxy/lenovo/video/asset-1',
      headers: { host: '10.0.0.10:18082', range: 'bytes=0-3' },
    });
    expect(video.statusCode).toBe(206);
    expect(video.headers['accept-ranges']).toBe('bytes');
    expect(video.headers['content-range']).toBe('bytes 0-3/8');
    expect(video.headers['content-type']).toContain('video/mp4');
    expect(video.body.length).toBe(4);

    const image = await server.inject({
      method: 'GET',
      url: '/kiosk-proxy/lenovo/image',
      headers: { host: '10.0.0.10:18082' },
    });
    expect(image.statusCode).toBe(200);
    expect(image.headers['content-type']).toContain('image/gif');
    expect(image.body).toBe('GIF89a');

    expect(kioskRequests).toContain('/?duration=60');
    expect(kioskRequests).toContain('/style.css');
    expect(kioskRequests).toContain('/kiosk.js');
    expect(kioskRequests).toContain('/video/asset-1');
    expect(kioskRequests).toContain('/image');

    await server.close();
    await new Promise<void>((resolve) => kiosk.close(() => resolve()));
  });

  it('serves the add-on console from root and double-slash setup paths', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-api-'));
    tempDirs.push(dir);
    const config = buildConfig(dir);
    const server = createTestServer({ config });

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
