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
export type KioskBooleanOverride = 'inherit' | 'true' | 'false';
export type RemoteControlType = 'none' | 'freekiosk';
export type PreviewOrientation = 'landscape' | 'portrait';
export type KioskArrowAction = 'none' | 'mute' | 'redirects' | 'pause' | 'more-info' | 'fullscreen';
export type PlaybackState = 'playing' | 'paused' | 'unknown';
export type FrameCommand = 'next' | 'previous' | 'play' | 'pause' | 'play-pause' | 'reload' | 'mute-toggle' | 'mute-on' | 'mute-off' | 'renderer-suspend' | 'renderer-resume' | 'screen-on' | 'screen-off' | 'volume-up' | 'volume-down' | 'device-mute-toggle' | 'dpad-up';

export interface FrameCommandEvent {
  command: FrameCommand;
  commandId: string;
  ackToken: string;
  issuedAt: string;
}

export interface FrameCommandAck {
  commandId: string;
  success: boolean;
  acknowledgedAt: string;
  playbackState?: PlaybackState;
  rendererSuspended?: boolean;
  error?: string;
}

export interface FrameDevice {
  id: string;
  name: string;
  alias?: string;
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
  remoteApiAutoPort?: number;
  lastSeenIp?: string;
  lastSeenAt?: string;
  remoteApiKey?: string;
  remoteBrightnessRestoreValue?: number;
  remoteVolumeRestoreValue?: number;
  mqttTopicId?: string;
}

export interface FrameState {
  deviceId: string;
  activeAlbumIds: string[];
  activePersonIds: string[];
  requireAllPeople: boolean;
  activeProfileId?: string;
  durationSeconds: number;
  imageFit: ImageFit;
  customCssClass: string;
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
  weatherShowForecast: KioskBooleanOverride;
  weatherShowHumidity: KioskBooleanOverride;
  weatherShowWind: KioskBooleanOverride;
  weatherShowWindDirection: KioskBooleanOverride;
  weatherShowVisibility: KioskBooleanOverride;
  weatherShowTemperatureRange: KioskBooleanOverride;
  weatherRoundTemperature: KioskBooleanOverride;
  showVideos: boolean;
  kioskVideoMuted: boolean;
  playbackState: PlaybackState;
  rendererSuspended: boolean;
  excludeVideosOver: number;
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
  imageDescriptionScrollDuration: number;
  imageDescriptionScrollSpeed: number;
  imageDescriptionStartDelay: number;
  imageDescriptionAreaHeight: number;
  imageDescriptionOverlayOpacity: number;
  imageDescriptionLongThresholdLines: number;
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
  personIds: string[];
  requireAllPeople: boolean;
  durationSeconds: number;
  imageFit: ImageFit;
  customCssClass: string;
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
  weatherShowForecast: KioskBooleanOverride;
  weatherShowHumidity: KioskBooleanOverride;
  weatherShowWind: KioskBooleanOverride;
  weatherShowWindDirection: KioskBooleanOverride;
  weatherShowVisibility: KioskBooleanOverride;
  weatherShowTemperatureRange: KioskBooleanOverride;
  weatherRoundTemperature: KioskBooleanOverride;
  showVideos: boolean;
  excludeVideosOver: number;
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
  imageDescriptionScrollDuration: number;
  imageDescriptionScrollSpeed: number;
  imageDescriptionStartDelay: number;
  imageDescriptionAreaHeight: number;
  imageDescriptionOverlayOpacity: number;
  imageDescriptionLongThresholdLines: number;
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

export interface PersonCacheEntry {
  id: string;
  name: string;
  assetCount?: number;
  thumbnailPath?: string;
  updatedAt: string;
}

export interface PersonCache {
  items: PersonCacheEntry[];
  refreshedAt?: string;
  stale: boolean;
  lastError?: string;
}

export interface StoreData {
  devices: Record<string, FrameDevice>;
  frames: Record<string, FrameState>;
  profiles: Record<string, FrameProfile>;
  albumCache: AlbumCache;
  personCache: PersonCache;
  frameClaims: Record<string, FrameClaim>;
  auth: ControllerAuth;
}

export interface FrameClaim {
  id: string;
  codeHash: string;
  createdAt: string;
  expiresAt: string;
  claimedDeviceId?: string;
  claimedAt?: string;
  requestHost?: string;
  userAgentHint?: string;
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
