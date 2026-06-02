import type { AlbumCache, FrameDevice, FrameProfile, FrameState, StoreData } from './types.js';

export function createDefaultFrameState(device: FrameDevice): FrameState {
  return {
    deviceId: device.id,
    activeAlbumIds: [],
    durationSeconds: 60,
    imageFit: 'contain',
    showTime: false,
    showDate: false,
    showWeather: true,
    albumOrder: 'random',
    networkMode: device.networkMode,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultProfiles(): Record<string, FrameProfile> {
  return {
    default: {
      id: 'default',
      name: 'Default',
      albumIds: [],
      durationSeconds: 60,
      imageFit: 'contain',
      showTime: false,
      showDate: false,
      showWeather: true,
      albumOrder: 'random',
      preferredNetworkMode: 'auto',
    },
  };
}

export function createEmptyAlbumCache(): AlbumCache {
  return {
    items: [],
    stale: true,
  };
}

export function createDefaultStore(device: FrameDevice): StoreData {
  return {
    devices: {
      [device.id]: device,
    },
    frames: {
      [device.id]: createDefaultFrameState(device),
    },
    profiles: createDefaultProfiles(),
    albumCache: createEmptyAlbumCache(),
    auth: {
      tokens: {},
    },
  };
}
