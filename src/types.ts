export type NetworkMode = 'auto' | 'local' | 'external';
export type ResolvedNetworkMode = 'local' | 'external';
export type ImageFit = 'contain' | 'cover' | 'none';
export type AlbumOrder = 'random' | 'newest' | 'oldest';
export type KioskTransition = 'none' | 'fade' | 'cross-fade';
export type KioskLayout = 'single' | 'portrait' | 'landscape' | 'splitview' | 'splitview-landscape';
export type ImageEffect = 'none' | 'zoom' | 'smart-zoom';
export type ProgressBarPosition = 'top' | 'bottom';
export type KioskTimeFormat = '12' | '24';
export type KioskClockSource = 'client' | 'server';
export type RemoteControlType = 'none' | 'freekiosk';
export type PreviewOrientation = 'landscape' | 'portrait';
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
  previewOrientation?: PreviewOrientation;
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
  timeFormat: KioskTimeFormat;
  showAmPm: boolean;
  showSeconds: boolean;
  showDate: boolean;
  dateFormat: string;
  clockSource: KioskClockSource;
  showWeather: boolean;
  weatherLocation: string;
  weatherRotationInterval: number;
  showVideos: boolean;
  showArchived: boolean;
  filterDate: string;
  filterNewest: number;
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
  backgroundBlurAmount: number;
  fontSize: number;
  frameless: boolean;
  disableNavigation: boolean;
  hideCursor: boolean;
  showProgressBar: boolean;
  progressBarPosition: ProgressBarPosition;
  showImageRating: boolean;
  showOwner: boolean;
  showAlbumName: boolean;
  showPersonName: boolean;
  showPersonAge: boolean;
  showImageTime: boolean;
  imageTimeFormat: KioskTimeFormat;
  showImageDate: boolean;
  imageDateFormat: string;
  showImageDescription: boolean;
  showImageCamera: boolean;
  showImageExif: boolean;
  showImageLocation: boolean;
  showImageQr: boolean;
  showImageId: boolean;
  showUser: boolean;
  showMoreInfo: boolean;
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
  timeFormat: KioskTimeFormat;
  showAmPm: boolean;
  showSeconds: boolean;
  showDate: boolean;
  dateFormat: string;
  clockSource: KioskClockSource;
  showWeather: boolean;
  weatherLocation: string;
  weatherRotationInterval: number;
  showVideos: boolean;
  showArchived: boolean;
  filterDate: string;
  filterNewest: number;
  albumOrder: AlbumOrder;
  preferredNetworkMode: NetworkMode;
  transition: KioskTransition;
  fadeTransitionDuration: number;
  crossFadeTransitionDuration: number;
  layout: KioskLayout;
  imageEffect: ImageEffect;
  imageEffectAmount: number;
  backgroundBlur: boolean;
  backgroundBlurAmount: number;
  fontSize: number;
  frameless: boolean;
  disableNavigation: boolean;
  hideCursor: boolean;
  showProgressBar: boolean;
  progressBarPosition: ProgressBarPosition;
  showImageRating: boolean;
  showOwner: boolean;
  showAlbumName: boolean;
  showPersonName: boolean;
  showPersonAge: boolean;
  showImageTime: boolean;
  imageTimeFormat: KioskTimeFormat;
  showImageDate: boolean;
  imageDateFormat: string;
  showImageDescription: boolean;
  showImageCamera: boolean;
  showImageExif: boolean;
  showImageLocation: boolean;
  showImageQr: boolean;
  showImageId: boolean;
  showUser: boolean;
  showMoreInfo: boolean;
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
