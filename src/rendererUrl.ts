import type {
  FrameDevice,
  FrameState,
  ResolvedFrameState,
  ResolvedNetworkMode,
} from './types.js';

export interface RequestContext {
  host?: string;
  protocol?: string;
}

export interface RendererUrlOptions {
  kioskPassword?: string;
}

export interface ProxiedRendererUrlOptions extends RendererUrlOptions {
  controllerBaseUrl: string;
}

export function resolveNetworkMode(
  device: FrameDevice,
  state: Pick<FrameState, 'networkMode'>,
  request?: RequestContext,
): ResolvedNetworkMode {
  const mode = state.networkMode === 'auto' ? device.networkMode : state.networkMode;
  if (mode === 'local' || mode === 'external') return mode;

  const host = normalizeHost(request?.host);
  if (host) {
    if (matchesUrlHost(host, device.externalControllerBaseUrl) || matchesUrlHost(host, device.externalKioskBaseUrl)) {
      return 'external';
    }
    if (matchesUrlHost(host, device.localControllerBaseUrl) || matchesUrlHost(host, device.localKioskBaseUrl)) {
      return 'local';
    }
  }

  if (request?.protocol === 'https' && device.externalKioskBaseUrl) {
    return 'external';
  }

  return 'local';
}

export function buildRendererUrl(
  device: FrameDevice,
  state: FrameState,
  request?: RequestContext,
  options: RendererUrlOptions = {},
): ResolvedFrameState {
  const resolvedNetworkMode = resolveNetworkMode(device, state, request);
  const baseUrl = selectKioskBaseUrl(device, resolvedNetworkMode);
  const url = new URL(baseUrl);

  if (state.activeAlbumIds.length > 0) {
    url.searchParams.delete('album');
    for (const albumId of state.activeAlbumIds) {
      url.searchParams.append('album', albumId);
    }
  }
  if (options.kioskPassword) {
    url.searchParams.set('password', options.kioskPassword);
  }
  url.searchParams.set('duration', String(state.durationSeconds));
  url.searchParams.set('image_fit', state.imageFit);
  url.searchParams.set('album_order', state.albumOrder);
  url.searchParams.set('show_time', String(state.showTime));
  url.searchParams.set('time_format', state.timeFormat);
  url.searchParams.set('show_am_pm', String(state.showAmPm));
  url.searchParams.set('show_seconds', String(state.showSeconds));
  url.searchParams.set('show_date', String(state.showDate));
  url.searchParams.set('date_format', state.dateFormat);
  url.searchParams.set('clock_source', state.clockSource);
  url.searchParams.set('show_weather', String(state.showWeather));
  url.searchParams.delete('weather');
  if (!state.showWeather) {
    url.searchParams.set('weather', 'none');
  } else if (state.weatherLocation.trim()) {
    url.searchParams.set('weather', state.weatherLocation.trim());
  }
  url.searchParams.set('rotation_interval', String(state.weatherRotationInterval));
  url.searchParams.set('show_videos', String(state.showVideos));
  url.searchParams.set('show_archived', String(state.showArchived));
  url.searchParams.delete('filter_date');
  if (state.filterDate.trim()) {
    url.searchParams.set('filter_date', state.filterDate.trim());
  }
  url.searchParams.delete('filter_newest');
  if (state.filterNewest > 0) {
    url.searchParams.set('filter_newest', String(state.filterNewest));
  }
  if (state.upArrowAction !== 'none') {
    url.searchParams.set('up_arrow_action', state.upArrowAction);
  }
  if (state.downArrowAction !== 'none') {
    url.searchParams.set('down_arrow_action', state.downArrowAction);
  }
  url.searchParams.set('transition', state.transition);
  url.searchParams.set('fade_transition_duration', String(state.fadeTransitionDuration));
  url.searchParams.set('cross_fade_transition_duration', String(state.crossFadeTransitionDuration));
  url.searchParams.set('layout', state.layout);
  url.searchParams.set('image_effect', state.imageEffect);
  url.searchParams.set('image_effect_amount', String(state.imageEffectAmount));
  url.searchParams.set('background_blur', String(state.backgroundBlur));
  url.searchParams.set('background_blur_amount', String(state.backgroundBlurAmount));
  url.searchParams.set('font_size', String(state.fontSize));
  url.searchParams.set('frameless', String(state.frameless));
  url.searchParams.set('disable_navigation', String(state.disableNavigation));
  url.searchParams.set('hide_cursor', String(state.hideCursor));
  url.searchParams.set('show_progress_bar', String(state.showProgressBar));
  url.searchParams.set('progress_bar_position', state.progressBarPosition);
  url.searchParams.set('show_image_rating', String(state.showImageRating));
  url.searchParams.set('show_owner', String(state.showOwner));
  url.searchParams.set('show_album_name', String(state.showAlbumName));
  url.searchParams.set('show_person_name', String(state.showPersonName));
  url.searchParams.set('show_person_age', String(state.showPersonAge));
  url.searchParams.set('show_image_time', String(state.showImageTime));
  url.searchParams.set('image_time_format', state.imageTimeFormat);
  url.searchParams.set('show_image_date', String(state.showImageDate));
  url.searchParams.set('image_date_format', state.imageDateFormat);
  url.searchParams.set('show_image_description', String(state.showImageDescription));
  url.searchParams.set('show_image_camera', String(state.showImageCamera));
  url.searchParams.set('show_image_exif', String(state.showImageExif));
  url.searchParams.set('show_image_location', String(state.showImageLocation));
  url.searchParams.set('show_image_qr', String(state.showImageQr));
  url.searchParams.set('show_image_id', String(state.showImageId));
  url.searchParams.set('show_user', String(state.showUser));
  url.searchParams.set('show_more_info', String(state.showMoreInfo));
  url.searchParams.set('burn_in_interval', String(state.burnInInterval));
  url.searchParams.set('burn_in_duration', String(state.burnInDuration));
  url.searchParams.set('burn_in_opacity', String(state.burnInOpacity));
  if (state.sleepStart) {
    url.searchParams.set('sleep_start', state.sleepStart);
  }
  if (state.sleepEnd) {
    url.searchParams.set('sleep_end', state.sleepEnd);
  }
  url.searchParams.set('sleep_icon', String(state.sleepIcon));
  url.searchParams.set('sleep_dim_screen', String(state.sleepDimScreen));
  url.searchParams.set('disable_sleep', String(state.disableSleep));

  return {
    ...state,
    resolvedNetworkMode,
    rendererUrl: url.toString(),
    lastKnownGoodRendererUrl: url.toString(),
  };
}

export function buildProxiedRendererUrl(
  device: FrameDevice,
  state: FrameState,
  request: RequestContext | undefined,
  options: ProxiedRendererUrlOptions,
): ResolvedFrameState {
  const localTarget = buildRendererUrl(device, { ...state, networkMode: 'local' }, undefined, options);
  const rendererUrl = toKioskProxyUrl(device.id, localTarget.rendererUrl, options.controllerBaseUrl);

  return {
    ...state,
    resolvedNetworkMode: resolveNetworkMode(device, state, request),
    rendererUrl,
    lastKnownGoodRendererUrl: rendererUrl,
  };
}

export function selectKioskBaseUrl(device: FrameDevice, mode: ResolvedNetworkMode): string {
  if (mode === 'external') {
    if (!device.externalKioskBaseUrl) {
      throw new Error(`Frame ${device.id} is missing externalKioskBaseUrl`);
    }
    return device.externalKioskBaseUrl;
  }
  return device.localKioskBaseUrl;
}

export function controllerBaseUrlForContext(context: RequestContext | undefined, fallback: string): string {
  if (!context?.host) return fallback.replace(/\/+$/, '');
  return `${context.protocol ?? 'http'}://${context.host}`.replace(/\/+$/, '');
}

function toKioskProxyUrl(deviceId: string, rendererUrl: string, controllerBaseUrl: string): string {
  const source = new URL(rendererUrl);
  const proxy = new URL(`/kiosk-proxy/${encodeURIComponent(deviceId)}${source.pathname}`, `${controllerBaseUrl.replace(/\/+$/, '')}/`);
  proxy.search = source.search;
  proxy.hash = source.hash;
  return proxy.toString();
}

function normalizeHost(host: string | undefined): string | undefined {
  return host?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

function matchesUrlHost(host: string, urlString: string | undefined): boolean {
  if (!urlString) return false;
  try {
    return host === new URL(urlString).host.toLowerCase();
  } catch {
    return false;
  }
}
