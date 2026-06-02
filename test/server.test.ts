import { mkdtempSync, rmSync } from 'node:fs';
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
});

