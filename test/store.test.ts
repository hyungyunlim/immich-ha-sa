import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonStore } from '../src/store.js';
import type { FrameDevice } from '../src/types.js';

const tempDirs: string[] = [];

const device: FrameDevice = {
  id: 'lenovo',
  name: 'Lenovo',
  networkMode: 'auto',
  localControllerBaseUrl: 'http://10.0.0.10:18082',
  localKioskBaseUrl: 'http://10.0.0.10:3000',
  pollIntervalSeconds: 20,
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('JsonStore', () => {
  it('persists frame state across store instances', () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-store-'));
    tempDirs.push(dir);
    const path = join(dir, 'state.json');

    const first = new JsonStore(path, device);
    first.updateFrameState('lenovo', (state) => ({
      ...state,
      activeAlbumIds: ['album-1'],
      version: state.version + 1,
    }));

    const second = new JsonStore(path, device);
    expect(second.getFrameState('lenovo')?.activeAlbumIds).toEqual(['album-1']);
  });

  it('backfills required device URLs from defaults for old store data', () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-store-'));
    tempDirs.push(dir);
    const path = join(dir, 'state.json');

    writeFileSync(path, `${JSON.stringify({
      devices: {
        lenovo: {
          id: 'lenovo',
          name: 'Lenovo',
          networkMode: 'auto',
          localControllerBaseUrl: 'http://10.0.0.10:18082',
          pollIntervalSeconds: 20,
        },
      },
      frames: {},
      profiles: {},
      albumCache: { items: [], stale: true },
      auth: { tokens: {} },
    })}\n`);

    const store = new JsonStore(path, device);
    expect(store.getDevice('lenovo')?.localKioskBaseUrl).toBe('http://10.0.0.10:3000');
    expect(store.getFrameState('lenovo')?.deviceId).toBe('lenovo');
  });
});
