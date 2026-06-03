export type NetworkMode = 'auto' | 'local' | 'external';
export type ResolvedNetworkMode = 'local' | 'external';
export type ImageFit = 'contain' | 'cover' | 'none';
export type AlbumOrder = 'random' | 'newest' | 'oldest';
export type KioskTransition = 'none' | 'fade' | 'cross-fade';
export type KioskLayout = 'single' | 'portrait' | 'landscape' | 'splitview' | 'splitview-landscape';
export type ImageEffect = 'none' | 'zoom' | 'smart-zoom';
export type ProgressBarPosition = 'top' | 'bottom';
export type RemoteControlType = 'none' | 'freekiosk';
export type KioskArrowAction = 'none' | 'mute' | 'redirects' | 'pause' | 'more-info' | 'fullscreen';
export type FrameCommand = 'next' | 'previous' | 'play-pause' | 'reload' | 'mute-toggle' | 'screen-on' | 'screen-off' | 'volume-up' | 'volume-down' | 'device-mute-toggle';

export interface FrameCommandEvent {
  command: FrameCommand;
  issuedAt: string;
}

export interface FrameDevice {
  id: string;
  name: string;
  networkMode: NetworkMode;
  localControllerBaseUrl: string;
  externalControllerBaseUrl?: string;
  localKioskBaseUrl: string;
  externalKioskBaseUrl?: string;
  kioskPassword?: string;
  pollIntervalSeconds: number;
  remoteControlType?: RemoteControlType;
  remoteApiUrl?: string;
  remoteApiKey?: string;
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
  showVideos: boolean;
  upArrowAction: KioskArrowAction;
  downArrowAction: KioskArrowAction;
  albumOrder: AlbumOrder;
  networkMode: NetworkMode;
  transition: KioskTransition;
  fadeTransitionDuration: number;
  crossFadeTransitionDuration: number;
  layout: KioskLayout;
  imageEffect: ImageEffect;
  imageEffectAmount: number;
  backgroundBlur: boolean;
  frameless: boolean;
  disableNavigation: boolean;
  hideCursor: boolean;
  showProgressBar: boolean;
  progressBarPosition: ProgressBarPosition;
  burnInInterval: number;
  burnInDuration: number;
  burnInOpacity: number;
  sleepStart: string;
  sleepEnd: string;
  sleepIcon: boolean;
  sleepDimScreen: boolean;
  disableSleep: boolean;
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
  showVideos: boolean;
  albumOrder: AlbumOrder;
  preferredNetworkMode: NetworkMode;
  transition: KioskTransition;
  fadeTransitionDuration: number;
  crossFadeTransitionDuration: number;
  layout: KioskLayout;
  imageEffect: ImageEffect;
  imageEffectAmount: number;
  backgroundBlur: boolean;
  frameless: boolean;
  disableNavigation: boolean;
  hideCursor: boolean;
  showProgressBar: boolean;
  progressBarPosition: ProgressBarPosition;
  burnInInterval: number;
  burnInDuration: number;
  burnInOpacity: number;
  sleepStart: string;
  sleepEnd: string;
  sleepIcon: boolean;
  sleepDimScreen: boolean;
  disableSleep: boolean;
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
