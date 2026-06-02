import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('loadConfig', () => {
  it('defaults to an internal app port and treats empty optional URLs as unset', () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'immich-frame-config-'));
    tempDirs.push(dataDir);

    const config = loadConfig({
      DATA_DIR: dataDir,
      LOCAL_PUBLIC_CONTROLLER_URL: 'http://10.0.0.10:18082',
      LOCAL_PUBLIC_KIOSK_URL: 'http://10.0.0.10:3000',
      EXTERNAL_PUBLIC_CONTROLLER_URL: '',
      EXTERNAL_PUBLIC_KIOSK_URL: '',
    });

    expect(config.port).toBe(8080);
    expect(config.defaultDevice.localControllerBaseUrl).toBe('http://10.0.0.10:18082');
    expect(config.defaultDevice.externalControllerBaseUrl).toBeUndefined();
    expect(config.defaultDevice.externalKioskBaseUrl).toBeUndefined();
  });
});
