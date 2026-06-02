export type NetworkMode = 'auto' | 'local' | 'external';
export type ResolvedNetworkMode = 'local' | 'external';
export type ImageFit = 'contain' | 'cover' | 'none';
export type AlbumOrder = 'random' | 'newest' | 'oldest';

export interface FrameDevice {
  id: string;
  name: string;
  networkMode: NetworkMode;
  localControllerBaseUrl: string;
  externalControllerBaseUrl?: string;
  localKioskBaseUrl: string;
  externalKioskBaseUrl?: string;
  pollIntervalSeconds: number;
}

export interface FrameState {
  deviceId: string;
  activeAlbumIds: string[];
  activeProfileId?: string;
  durationSeconds: number;
  imageFit: ImageFit;
  showTime: boolean;
  showDate: boolean;
  showWeather: boolean;
  albumOrder: AlbumOrder;
  networkMode: NetworkMode;
  version: number;
  updatedAt: string;
  lastKnownGoodRendererUrl?: string;
}

export interface ResolvedFrameState extends FrameState {
  resolvedNetworkMode: ResolvedNetworkMode;
  rendererUrl: string;
}

export interface FrameProfile {
  id: string;
  name: string;
  albumIds: string[];
  durationSeconds: number;
  imageFit: ImageFit;
  showTime: boolean;
  showDate: boolean;
  showWeather: boolean;
  albumOrder: AlbumOrder;
  preferredNetworkMode: NetworkMode;
}

export interface AlbumCacheEntry {
  id: string;
  albumName: string;
  assetCount?: number;
  thumbnailAssetId?: string;
  updatedAt: string;
}

export interface AlbumCache {
  items: AlbumCacheEntry[];
  refreshedAt?: string;
  stale: boolean;
  lastError?: string;
}

export interface StoreData {
  devices: Record<string, FrameDevice>;
  frames: Record<string, FrameState>;
  profiles: Record<string, FrameProfile>;
  albumCache: AlbumCache;
  auth: ControllerAuth;
}

export interface ControllerAuth {
  tokens: Record<string, ControllerApiToken>;
  pairing?: ControllerPairingState;
}

export interface ControllerApiToken {
  id: string;
  name: string;
  tokenHash: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface ControllerPairingState {
  codeHash: string;
  createdAt: string;
  expiresAt: string;
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiEnvelope<T> | ApiErrorEnvelope;
