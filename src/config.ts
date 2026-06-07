import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { FrameDevice, NetworkMode, PreviewOrientation } from './types.js';

const NetworkModeSchema = z.enum(['auto', 'local', 'external']);
const OptionalUrlSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
);

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  DATA_DIR: z.string().default('./data'),
  IMMICH_INTERNAL_URL: OptionalUrlSchema,
  IMMICH_API_KEY: z.string().optional(),
  KIOSK_INTERNAL_URL: OptionalUrlSchema,
  KIOSK_PASSWORD: z.string().optional(),
  LOCAL_PUBLIC_CONTROLLER_URL: z.string().url(),
  LOCAL_PUBLIC_KIOSK_URL: z.string().url(),
  EXTERNAL_PUBLIC_CONTROLLER_URL: OptionalUrlSchema,
  EXTERNAL_PUBLIC_KIOSK_URL: OptionalUrlSchema,
  DEFAULT_FRAME_ID: z.string().min(1).default('lenovo'),
  DEFAULT_FRAME_NAME: z.string().min(1).default('Lenovo Smart Frame'),
  DEFAULT_NETWORK_MODE: NetworkModeSchema.default('auto'),
  POLL_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(300).default(20),
  ALBUM_REFRESH_INTERVAL_SECONDS: z.coerce.number().int().min(0).max(86400).default(900),
  CONTROLLER_API_TOKEN: z.string().optional(),
});

export interface AppConfig {
  port: number;
  dataDir: string;
  storePath: string;
  immichInternalUrl?: string;
  immichApiKey?: string;
  kioskInternalUrl?: string;
  kioskPassword?: string;
  defaultDevice: FrameDevice;
  controllerApiToken?: string;
  albumRefreshIntervalSeconds?: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  const dataDir = resolve(parsed.DATA_DIR);
  mkdirSync(dataDir, { recursive: true });

  const defaultDevice: FrameDevice = {
    id: parsed.DEFAULT_FRAME_ID,
    name: parsed.DEFAULT_FRAME_NAME,
    networkMode: parsed.DEFAULT_NETWORK_MODE as NetworkMode,
    localControllerBaseUrl: trimTrailingSlash(parsed.LOCAL_PUBLIC_CONTROLLER_URL),
    externalControllerBaseUrl: parsed.EXTERNAL_PUBLIC_CONTROLLER_URL
      ? trimTrailingSlash(parsed.EXTERNAL_PUBLIC_CONTROLLER_URL)
      : undefined,
    localKioskBaseUrl: trimTrailingSlash(parsed.LOCAL_PUBLIC_KIOSK_URL),
    externalKioskBaseUrl: parsed.EXTERNAL_PUBLIC_KIOSK_URL
      ? trimTrailingSlash(parsed.EXTERNAL_PUBLIC_KIOSK_URL)
      : undefined,
    pollIntervalSeconds: parsed.POLL_INTERVAL_SECONDS,
    previewOrientation: 'landscape' as PreviewOrientation,
    remoteApiAutoPort: 8080,
  };

  return {
    port: parsed.PORT,
    dataDir,
    storePath: resolve(dataDir, 'state.json'),
    immichInternalUrl: parsed.IMMICH_INTERNAL_URL
      ? trimTrailingSlash(parsed.IMMICH_INTERNAL_URL)
      : undefined,
    immichApiKey: parsed.IMMICH_API_KEY,
    kioskInternalUrl: parsed.KIOSK_INTERNAL_URL
      ? trimTrailingSlash(parsed.KIOSK_INTERNAL_URL)
      : undefined,
    kioskPassword: parsed.KIOSK_PASSWORD || undefined,
    defaultDevice,
    controllerApiToken: parsed.CONTROLLER_API_TOKEN || undefined,
    albumRefreshIntervalSeconds: parsed.ALBUM_REFRESH_INTERVAL_SECONDS,
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
