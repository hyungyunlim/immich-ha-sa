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
): ResolvedFrameState {
  const resolvedNetworkMode = resolveNetworkMode(device, state, request);
  const baseUrl = selectKioskBaseUrl(device, resolvedNetworkMode);
  const url = new URL(baseUrl);

  if (state.activeAlbumIds.length > 0) {
    url.searchParams.set('albums', state.activeAlbumIds.join(','));
  }
  url.searchParams.set('duration', String(state.durationSeconds));
  url.searchParams.set('image_fit', state.imageFit);
  url.searchParams.set('album_order', state.albumOrder);
  url.searchParams.set('show_time', String(state.showTime));
  url.searchParams.set('show_date', String(state.showDate));
  url.searchParams.set('show_weather', String(state.showWeather));

  return {
    ...state,
    resolvedNetworkMode,
    rendererUrl: url.toString(),
    lastKnownGoodRendererUrl: url.toString(),
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

