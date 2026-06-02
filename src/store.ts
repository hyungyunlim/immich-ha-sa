import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import type {
  AlbumCache,
  FrameDevice,
  FrameProfile,
  FrameState,
  StoreData,
} from './types.js';
import { createDefaultFrameState, createDefaultStore } from './defaults.js';

export class JsonStore {
  private data: StoreData;

  constructor(
    private readonly filePath: string,
    private readonly defaultDevice: FrameDevice,
  ) {
    this.data = this.load();
  }

  getData(): StoreData {
    return structuredClone(this.data);
  }

  getDevice(deviceId: string): FrameDevice | undefined {
    return structuredClone(this.data.devices[deviceId]);
  }

  getFrameState(deviceId: string): FrameState | undefined {
    return structuredClone(this.data.frames[deviceId]);
  }

  getProfiles(): FrameProfile[] {
    return Object.values(this.data.profiles).map((profile) => structuredClone(profile));
  }

  getProfile(profileId: string): FrameProfile | undefined {
    return structuredClone(this.data.profiles[profileId]);
  }

  getAlbumCache(): AlbumCache {
    return structuredClone(this.data.albumCache);
  }

  setAlbumCache(albumCache: AlbumCache): void {
    this.data.albumCache = structuredClone(albumCache);
    this.save();
  }

  updateFrameState(deviceId: string, updater: (state: FrameState) => FrameState): FrameState {
    const current = this.data.frames[deviceId] ?? createDefaultFrameState(this.ensureDevice(deviceId));
    const next = updater(structuredClone(current));
    this.data.frames[deviceId] = next;
    this.save();
    return structuredClone(next);
  }

  upsertProfile(profile: FrameProfile): FrameProfile {
    this.data.profiles[profile.id] = structuredClone(profile);
    this.save();
    return structuredClone(profile);
  }

  private ensureDevice(deviceId: string): FrameDevice {
    if (!this.data.devices[deviceId]) {
      this.data.devices[deviceId] = {
        ...this.defaultDevice,
        id: deviceId,
        name: deviceId,
      };
    }
    return this.data.devices[deviceId];
  }

  private load(): StoreData {
    if (!existsSync(this.filePath)) {
      const initial = createDefaultStore(this.defaultDevice);
      this.write(initial);
      return initial;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as StoreData;
      const merged = this.mergeWithDefaults(parsed);
      this.write(merged);
      return merged;
    } catch {
      const backupPath = `${this.filePath}.corrupt.${Date.now()}`;
      renameSync(this.filePath, backupPath);
      const initial = createDefaultStore(this.defaultDevice);
      this.write(initial);
      return initial;
    }
  }

  private mergeWithDefaults(data: StoreData): StoreData {
    const defaults = createDefaultStore(this.defaultDevice);
    return {
      devices: {
        ...defaults.devices,
        ...(data.devices ?? {}),
      },
      frames: {
        ...defaults.frames,
        ...(data.frames ?? {}),
      },
      profiles: {
        ...defaults.profiles,
        ...(data.profiles ?? {}),
      },
      albumCache: data.albumCache ?? defaults.albumCache,
    };
  }

  private save(): void {
    this.write(this.data);
  }

  private write(data: StoreData): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`);
    renameSync(tempPath, this.filePath);
  }
}

