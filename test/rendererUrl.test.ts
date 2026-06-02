import { describe, expect, it } from 'vitest';
import { buildRendererUrl, resolveNetworkMode } from '../src/rendererUrl.js';
import type { FrameDevice, FrameState } from '../src/types.js';

const device: FrameDevice = {
  id: 'lenovo',
  name: 'Lenovo',
  networkMode: 'auto',
  localControllerBaseUrl: 'http://10.0.0.10:18082',
  externalControllerBaseUrl: 'https://frame.example.com',
  localKioskBaseUrl: 'http://10.0.0.10:3000',
  externalKioskBaseUrl: 'https://frame.example.com/kiosk',
  pollIntervalSeconds: 20,
};

const state: FrameState = {
  deviceId: 'lenovo',
  activeAlbumIds: ['album-1', 'album-2'],
  activeProfileId: 'family',
  durationSeconds: 60,
  imageFit: 'contain',
  showTime: false,
  showDate: false,
  showWeather: true,
  showVideos: false,
  albumOrder: 'random',
  networkMode: 'auto',
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
  version: 3,
  updatedAt: '2026-06-02T00:00:00.000Z',
};

describe('renderer URL generation', () => {
  it('uses local URLs for local request hosts in auto mode', () => {
    expect(resolveNetworkMode(device, state, { host: '10.0.0.10:18082' })).toBe('local');
    const resolved = buildRendererUrl(device, state, { host: '10.0.0.10:18082' });
    expect(resolved.resolvedNetworkMode).toBe('local');
    expect(resolved.rendererUrl).toContain('http://10.0.0.10:3000/');
    expect(resolved.rendererUrl).toContain('album=album-1');
    expect(resolved.rendererUrl).toContain('album=album-2');
    expect(resolved.rendererUrl).toContain('duration=60');
  });

  it('uses external URLs for tunnel request hosts in auto mode', () => {
    const resolved = buildRendererUrl(device, state, { host: 'frame.example.com', protocol: 'https' });
    expect(resolved.resolvedNetworkMode).toBe('external');
    expect(resolved.rendererUrl).toContain('https://frame.example.com/kiosk');
  });

  it('honors explicit external network mode', () => {
    const resolved = buildRendererUrl(device, { ...state, networkMode: 'external' }, { host: '10.0.0.10:18082' });
    expect(resolved.resolvedNetworkMode).toBe('external');
    expect(resolved.rendererUrl).toContain('https://frame.example.com/kiosk');
  });

  it('adds kiosk password when configured', () => {
    const resolved = buildRendererUrl(device, state, { host: '10.0.0.10:18082' }, { kioskPassword: 'secret' });
    expect(resolved.rendererUrl).toContain('password=secret');
  });

  it('adds sleep mode URL overrides', () => {
    const resolved = buildRendererUrl(device, {
      ...state,
      sleepStart: '23',
      sleepEnd: '630',
      sleepIcon: false,
      sleepDimScreen: true,
      disableSleep: true,
    });
    expect(resolved.rendererUrl).toContain('sleep_start=23');
    expect(resolved.rendererUrl).toContain('sleep_end=630');
    expect(resolved.rendererUrl).toContain('sleep_icon=false');
    expect(resolved.rendererUrl).toContain('sleep_dim_screen=true');
    expect(resolved.rendererUrl).toContain('disable_sleep=true');
  });

  it('adds display and kiosk UX URL overrides', () => {
    const resolved = buildRendererUrl(device, {
      ...state,
      showVideos: true,
      transition: 'fade',
      fadeTransitionDuration: 1.5,
      layout: 'splitview',
      imageEffect: 'smart-zoom',
      imageEffectAmount: 240,
      backgroundBlur: false,
      frameless: true,
      disableNavigation: true,
      hideCursor: true,
      showProgressBar: true,
      progressBarPosition: 'bottom',
      burnInInterval: 30,
      burnInDuration: 20,
      burnInOpacity: 60,
    });
    expect(resolved.rendererUrl).toContain('transition=fade');
    expect(resolved.rendererUrl).toContain('fade_transition_duration=1.5');
    expect(resolved.rendererUrl).toContain('layout=splitview');
    expect(resolved.rendererUrl).toContain('image_effect=smart-zoom');
    expect(resolved.rendererUrl).toContain('image_effect_amount=240');
    expect(resolved.rendererUrl).toContain('show_videos=true');
    expect(resolved.rendererUrl).toContain('background_blur=false');
    expect(resolved.rendererUrl).toContain('frameless=true');
    expect(resolved.rendererUrl).toContain('disable_navigation=true');
    expect(resolved.rendererUrl).toContain('hide_cursor=true');
    expect(resolved.rendererUrl).toContain('show_progress_bar=true');
    expect(resolved.rendererUrl).toContain('progress_bar_position=bottom');
    expect(resolved.rendererUrl).toContain('burn_in_interval=30');
    expect(resolved.rendererUrl).toContain('burn_in_duration=20');
    expect(resolved.rendererUrl).toContain('burn_in_opacity=60');
  });
});
