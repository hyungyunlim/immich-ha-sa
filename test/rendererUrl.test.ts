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
  albumOrder: 'random',
  networkMode: 'auto',
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
});
