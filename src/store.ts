import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import type {
  AlbumCache,
  ControllerApiToken,
  ControllerPairingState,
  FrameClaim,
  FrameDevice,
  FrameProfile,
  FrameState,
  PersonCache,
  StoreData,
} from './types.js';
import { createDefaultFrameState, createDefaultStore } from './defaults.js';

export class JsonStore {
  private data: StoreData;
  private readonly deviceSeenWriteIntervalMs = 5 * 60 * 1000;

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

  getDeviceByAlias(alias: string): FrameDevice | undefined {
    const normalized = alias.trim().toLowerCase();
    const device = Object.values(this.data.devices).find((candidate) => (
      candidate.alias === normalized || candidate.id === normalized
    ));
    return device ? structuredClone(device) : undefined;
  }

  aliasExists(alias: string, exceptDeviceId?: string): boolean {
    const normalized = alias.trim().toLowerCase();
    return Object.values(this.data.devices).some((candidate) => (
      candidate.id !== exceptDeviceId
      && (candidate.alias === normalized || candidate.id === normalized)
    ));
  }

  getFrameState(deviceId: string): FrameState | undefined {
    return structuredClone(this.data.frames[deviceId]);
  }

  createDevice(device: FrameDevice): FrameDevice | undefined {
    if (this.data.devices[device.id]) return undefined;
    if (device.alias && this.aliasExists(device.alias)) return undefined;
    this.data.devices[device.id] = structuredClone(device);
    this.data.frames[device.id] = createDefaultFrameState(device);
    this.save();
    return structuredClone(device);
  }

  updateDevice(deviceId: string, patch: Partial<FrameDevice>): FrameDevice | undefined {
    const current = this.data.devices[deviceId];
    if (!current) return undefined;
    if (patch.alias && this.aliasExists(patch.alias, deviceId)) return undefined;
    const next = {
      ...current,
      ...patch,
      id: current.id,
    };
    this.data.devices[deviceId] = next;
    if (patch.networkMode && this.data.frames[deviceId]) {
      this.data.frames[deviceId] = {
        ...this.data.frames[deviceId],
        networkMode: patch.networkMode,
        version: this.data.frames[deviceId].version + 1,
        updatedAt: new Date().toISOString(),
      };
    }
    this.save();
    return structuredClone(next);
  }

  markDeviceSeen(deviceId: string, ip: string, seenAt = new Date()): FrameDevice | undefined {
    const current = this.data.devices[deviceId];
    if (!current) return undefined;

    const nextSeenAt = seenAt.toISOString();
    const previousSeenAtMs = current.lastSeenAt ? Date.parse(current.lastSeenAt) : 0;
    const shouldSave = current.lastSeenIp !== ip
      || !current.lastSeenAt
      || Number.isNaN(previousSeenAtMs)
      || seenAt.getTime() - previousSeenAtMs >= this.deviceSeenWriteIntervalMs;

    if (!shouldSave) return structuredClone(current);

    const next = {
      ...current,
      lastSeenIp: ip,
      lastSeenAt: nextSeenAt,
    };
    this.data.devices[deviceId] = next;
    this.save();
    return structuredClone(next);
  }

  deleteDevice(deviceId: string): boolean {
    if (!this.data.devices[deviceId]) return false;
    delete this.data.devices[deviceId];
    delete this.data.frames[deviceId];
    this.save();
    return true;
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

  getPersonCache(): PersonCache {
    return structuredClone(this.data.personCache);
  }

  getAuthTokens(): ControllerApiToken[] {
    return Object.values(this.data.auth.tokens).map((token) => structuredClone(token));
  }

  getPairingState(): ControllerPairingState | undefined {
    return this.data.auth.pairing ? structuredClone(this.data.auth.pairing) : undefined;
  }

  getFrameClaim(claimId: string): FrameClaim | undefined {
    const claim = this.data.frameClaims[claimId];
    return claim ? structuredClone(claim) : undefined;
  }

  getFrameClaims(): FrameClaim[] {
    this.pruneExpiredFrameClaims();
    return Object.values(this.data.frameClaims).map((claim) => structuredClone(claim));
  }

  createFrameClaim(claim: FrameClaim): FrameClaim {
    this.pruneExpiredFrameClaims();
    this.data.frameClaims[claim.id] = structuredClone(claim);
    this.save();
    return structuredClone(claim);
  }

  findFrameClaimByCodeHash(codeHash: string): FrameClaim | undefined {
    this.pruneExpiredFrameClaims();
    const claim = Object.values(this.data.frameClaims).find((candidate) => (
      !candidate.claimedDeviceId
      && candidate.codeHash === codeHash
      && Date.parse(candidate.expiresAt) > Date.now()
    ));
    return claim ? structuredClone(claim) : undefined;
  }

  markFrameClaimClaimed(claimId: string, deviceId: string): FrameClaim | undefined {
    const claim = this.data.frameClaims[claimId];
    if (!claim) return undefined;
    const next = {
      ...claim,
      claimedDeviceId: deviceId,
      claimedAt: new Date().toISOString(),
    };
    this.data.frameClaims[claimId] = next;
    this.save();
    return structuredClone(next);
  }

  setPairingState(pairing: ControllerPairingState | undefined): void {
    if (pairing) {
      this.data.auth.pairing = structuredClone(pairing);
    } else {
      delete this.data.auth.pairing;
    }
    this.save();
  }

  upsertAuthToken(token: ControllerApiToken): ControllerApiToken {
    this.data.auth.tokens[token.id] = structuredClone(token);
    this.save();
    return structuredClone(token);
  }

  markAuthTokenUsed(tokenId: string): void {
    const token = this.data.auth.tokens[tokenId];
    if (!token) return;
    token.lastUsedAt = new Date().toISOString();
    this.save();
  }

  setAlbumCache(albumCache: AlbumCache): void {
    this.data.albumCache = structuredClone(albumCache);
    this.save();
  }

  setPersonCache(personCache: PersonCache): void {
    this.data.personCache = structuredClone(personCache);
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
    const deviceIds = new Set([
      ...Object.keys(defaults.devices),
      ...Object.keys(data.devices ?? {}),
    ]);
    return {
      devices: Object.fromEntries(
        [...deviceIds].map((deviceId) => [
          deviceId,
          this.mergeDeviceWithDefaults(deviceId, data.devices?.[deviceId], defaults),
        ]),
      ),
      frames: {
        ...defaults.frames,
        ...Object.fromEntries(
          Object.entries(data.frames ?? {}).map(([deviceId, state]) => [
            deviceId,
            {
              ...createDefaultFrameState(this.dataDeviceOrDefault(deviceId, data)),
              ...state,
            },
          ]),
        ),
      },
      profiles: {
        ...defaults.profiles,
        ...Object.fromEntries(
          Object.entries(data.profiles ?? {}).map(([profileId, profile]) => [
            profileId,
            {
              ...defaults.profiles.default,
              ...profile,
            },
          ]),
        ),
      },
      albumCache: data.albumCache ?? defaults.albumCache,
      personCache: data.personCache ?? defaults.personCache,
      frameClaims: data.frameClaims ?? defaults.frameClaims,
      auth: {
        tokens: {
          ...defaults.auth.tokens,
          ...(data.auth?.tokens ?? {}),
        },
        pairing: data.auth?.pairing,
      },
    };
  }

  private save(): void {
    this.write(this.data);
  }

  private dataDeviceOrDefault(deviceId: string, data: StoreData): FrameDevice {
    return this.mergeDeviceWithDefaults(deviceId, data.devices?.[deviceId], createDefaultStore(this.defaultDevice));
  }

  private mergeDeviceWithDefaults(
    deviceId: string,
    device: FrameDevice | undefined,
    defaults: StoreData,
  ): FrameDevice {
    const fallback = defaults.devices[deviceId] ?? {
      ...this.defaultDevice,
      id: deviceId,
      name: device?.name ?? deviceId,
    };
    const merged = {
      ...fallback,
      ...(device ?? {}),
      id: device?.id ?? fallback.id,
      name: device?.name ?? fallback.name,
      remoteControlType: device?.remoteControlType ?? fallback.remoteControlType ?? 'none',
      previewOrientation: device?.previewOrientation ?? fallback.previewOrientation ?? 'landscape',
      remoteApiAutoPort: device?.remoteApiAutoPort ?? fallback.remoteApiAutoPort ?? 8080,
    };

    return {
      ...merged,
      networkMode: merged.networkMode ?? fallback.networkMode,
      localControllerBaseUrl: merged.localControllerBaseUrl ?? fallback.localControllerBaseUrl,
      localKioskBaseUrl: merged.localKioskBaseUrl ?? fallback.localKioskBaseUrl,
      pollIntervalSeconds: merged.pollIntervalSeconds ?? fallback.pollIntervalSeconds,
    };
  }

  private write(data: StoreData): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`);
    renameSync(tempPath, this.filePath);
  }

  private pruneExpiredFrameClaims(): void {
    const now = Date.now();
    let changed = false;
    for (const [claimId, claim] of Object.entries(this.data.frameClaims ?? {})) {
      if (!claim.claimedDeviceId && Date.parse(claim.expiresAt) <= now) {
        delete this.data.frameClaims[claimId];
        changed = true;
      }
    }
    if (changed) this.save();
  }
}
