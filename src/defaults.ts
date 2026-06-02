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
    transition: 'none',
    fadeTransitionDuration: 1,
    crossFadeTransitionDuration: 1,
    layout: 'single',
    imageEffect: 'none',
    imageEffectAmount: 120,
    backgroundBlur: true,
    frameless: false,
    disableNavigation: true,
    hideCursor: true,
    showProgressBar: false,
    progressBarPosition: 'top',
    burnInInterval: 0,
    burnInDuration: 30,
    burnInOpacity: 30,
    sleepStart: '',
    sleepEnd: '',
    sleepIcon: true,
    sleepDimScreen: false,
    disableSleep: false,
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
      transition: 'none',
      fadeTransitionDuration: 1,
      crossFadeTransitionDuration: 1,
      layout: 'single',
      imageEffect: 'none',
      imageEffectAmount: 120,
      backgroundBlur: true,
      frameless: false,
      disableNavigation: true,
      hideCursor: true,
      showProgressBar: false,
      progressBarPosition: 'top',
      burnInInterval: 0,
      burnInDuration: 30,
      burnInOpacity: 30,
      sleepStart: '',
      sleepEnd: '',
      sleepIcon: true,
      sleepDimScreen: false,
      disableSleep: false,
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
