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
  activePersonIds: [],
  requireAllPeople: false,
  activeProfileId: 'family',
  durationSeconds: 60,
  imageFit: 'contain',
  showTime: false,
  timeFormat: '24',
  showAmPm: true,
  showSeconds: false,
  showDate: false,
  dateFormat: 'YYYY/MM/DD',
  clockSource: 'client',
  showWeather: true,
  weatherLocation: '',
  weatherRotationInterval: 60,
  showVideos: false,
  kioskVideoMuted: true,
  excludeVideosOver: 0,
  showArchived: false,
  filterDate: '',
  filterNewest: 0,
  upArrowAction: 'mute',
  downArrowAction: 'none',
  albumOrder: 'random',
  networkMode: 'auto',
  transition: 'none',
  fadeTransitionDuration: 1,
  crossFadeTransitionDuration: 1,
  layout: 'single',
  imageEffect: 'none',
  imageEffectAmount: 120,
  backgroundBlur: true,
  backgroundBlurAmount: 10,
  fontSize: 100,
  frameless: false,
  disableNavigation: true,
  hideCursor: true,
  showProgressBar: false,
  progressBarPosition: 'top',
  showImageRating: false,
  showOwner: false,
  showAlbumName: false,
  showPersonName: false,
  showPersonAge: false,
  showImageTime: false,
  imageTimeFormat: '24',
  showImageDate: false,
  imageDateFormat: 'YYYY-MM-DD',
  showImageDescription: false,
  imageDescriptionScrollDuration: 52,
  imageDescriptionScrollSpeed: 2.5,
  imageDescriptionStartDelay: 3,
  imageDescriptionAreaHeight: 5.75,
  imageDescriptionOverlayOpacity: 10,
  imageDescriptionLongThresholdLines: 3.25,
  showImageCamera: false,
  showImageExif: false,
  showImageLocation: false,
  showImageQr: false,
  showImageId: false,
  showUser: false,
  showMoreInfo: true,
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

  it('adds kiosk arrow action overrides', () => {
    const resolved = buildRendererUrl(device, {
      ...state,
      upArrowAction: 'mute',
      downArrowAction: 'pause',
    });
    expect(resolved.rendererUrl).toContain('up_arrow_action=mute');
    expect(resolved.rendererUrl).toContain('down_arrow_action=pause');
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
      showTime: true,
      timeFormat: '12',
      showAmPm: false,
      showSeconds: true,
      showDate: true,
      dateFormat: 'YYYY-MM-DD',
      clockSource: 'server',
      showWeather: true,
      weatherLocation: 'rotate',
      weatherRotationInterval: 120,
      transition: 'fade',
      excludeVideosOver: 45,
      showArchived: true,
      fadeTransitionDuration: 1.5,
      layout: 'splitview',
      imageEffect: 'smart-zoom',
      imageEffectAmount: 240,
      backgroundBlur: false,
      backgroundBlurAmount: 18,
      fontSize: 120,
      frameless: true,
      disableNavigation: true,
      hideCursor: true,
      showProgressBar: true,
      progressBarPosition: 'bottom',
      showImageRating: true,
      showOwner: true,
      showAlbumName: true,
      showPersonName: true,
      showPersonAge: true,
      showImageTime: true,
      imageTimeFormat: '12',
      showImageDate: true,
      imageDateFormat: 'YYYY/MM/DD',
      showImageDescription: true,
      imageDescriptionScrollDuration: 64,
      imageDescriptionScrollSpeed: 3.75,
      imageDescriptionStartDelay: 4.5,
      imageDescriptionAreaHeight: 6.5,
      imageDescriptionOverlayOpacity: 8,
      imageDescriptionLongThresholdLines: 4,
      showImageCamera: true,
      showImageExif: true,
      showImageLocation: true,
      showImageQr: true,
      showImageId: true,
      showUser: true,
      showMoreInfo: false,
      burnInInterval: 30,
      burnInDuration: 20,
      burnInOpacity: 60,
    });
    expect(resolved.rendererUrl).toContain('transition=fade');
    expect(resolved.rendererUrl).toContain('fade_transition_duration=1.5');
    expect(resolved.rendererUrl).toContain('layout=splitview');
    expect(resolved.rendererUrl).toContain('image_effect=smart-zoom');
    expect(resolved.rendererUrl).toContain('image_effect_amount=240');
    expect(resolved.rendererUrl).toContain('show_time=true');
    expect(resolved.rendererUrl).toContain('time_format=12');
    expect(resolved.rendererUrl).toContain('show_am_pm=false');
    expect(resolved.rendererUrl).toContain('show_seconds=true');
    expect(resolved.rendererUrl).toContain('show_date=true');
    expect(resolved.rendererUrl).toContain('date_format=YYYY-MM-DD');
    expect(resolved.rendererUrl).toContain('clock_source=server');
    expect(resolved.rendererUrl).toContain('show_weather=true');
    expect(resolved.rendererUrl).toContain('weather=rotate');
    expect(resolved.rendererUrl).toContain('rotation_interval=120');
    expect(resolved.rendererUrl).toContain('show_videos=true');
    expect(resolved.rendererUrl).toContain('exclude_videos_over=45');
    expect(resolved.rendererUrl).toContain('show_archived=true');
    expect(resolved.rendererUrl).toContain('background_blur=false');
    expect(resolved.rendererUrl).toContain('background_blur_amount=18');
    expect(resolved.rendererUrl).toContain('font_size=120');
    expect(resolved.rendererUrl).toContain('frameless=true');
    expect(resolved.rendererUrl).toContain('disable_navigation=true');
    expect(resolved.rendererUrl).toContain('hide_cursor=true');
    expect(resolved.rendererUrl).toContain('show_progress_bar=true');
    expect(resolved.rendererUrl).toContain('progress_bar_position=bottom');
    expect(resolved.rendererUrl).toContain('show_image_rating=true');
    expect(resolved.rendererUrl).toContain('show_owner=true');
    expect(resolved.rendererUrl).toContain('show_album_name=true');
    expect(resolved.rendererUrl).toContain('show_person_name=true');
    expect(resolved.rendererUrl).toContain('show_person_age=true');
    expect(resolved.rendererUrl).toContain('show_image_time=true');
    expect(resolved.rendererUrl).toContain('image_time_format=12');
    expect(resolved.rendererUrl).toContain('show_image_date=true');
    expect(resolved.rendererUrl).toContain('image_date_format=YYYY%2FMM%2FDD');
    expect(resolved.rendererUrl).toContain('show_image_description=true');
    expect(resolved.rendererUrl).toContain('ifc_description_scroll_duration=64');
    expect(resolved.rendererUrl).toContain('ifc_description_scroll_speed=3.75');
    expect(resolved.rendererUrl).toContain('ifc_description_start_delay=4.5');
    expect(resolved.rendererUrl).toContain('ifc_description_area_height=6.5');
    expect(resolved.rendererUrl).toContain('ifc_description_overlay_opacity=8');
    expect(resolved.rendererUrl).toContain('ifc_description_long_threshold_lines=4');
    expect(resolved.rendererUrl).toContain('show_image_camera=true');
    expect(resolved.rendererUrl).toContain('show_image_exif=true');
    expect(resolved.rendererUrl).toContain('show_image_location=true');
    expect(resolved.rendererUrl).toContain('show_image_qr=true');
    expect(resolved.rendererUrl).toContain('show_image_id=true');
    expect(resolved.rendererUrl).toContain('show_user=true');
    expect(resolved.rendererUrl).toContain('show_more_info=false');
    expect(resolved.rendererUrl).toContain('burn_in_interval=30');
    expect(resolved.rendererUrl).toContain('burn_in_duration=20');
    expect(resolved.rendererUrl).toContain('burn_in_opacity=60');
  });

  it('adds kiosk asset filter URL overrides', () => {
    const resolved = buildRendererUrl(device, {
      ...state,
      filterDate: '2021-01-01_to_today',
      filterNewest: 200,
    });
    expect(resolved.rendererUrl).toContain('filter_date=2021-01-01_to_today');
    expect(resolved.rendererUrl).toContain('filter_newest=200');
  });

  it('adds person filter URL overrides', () => {
    const resolved = buildRendererUrl(device, {
      ...state,
      activePersonIds: ['person-1', 'person-2'],
      requireAllPeople: true,
    });
    expect(resolved.rendererUrl).toContain('person=person-1');
    expect(resolved.rendererUrl).toContain('person=person-2');
    expect(resolved.rendererUrl).toContain('require_all_people=true');
  });

  it('omits disabled kiosk asset filters', () => {
    const resolved = buildRendererUrl(device, {
      ...state,
      filterDate: '   ',
      filterNewest: 0,
    });
    expect(resolved.rendererUrl).not.toContain('filter_date=');
    expect(resolved.rendererUrl).not.toContain('filter_newest=');
  });

  it('sets weather=none when weather display is disabled', () => {
    const resolved = buildRendererUrl(device, {
      ...state,
      showWeather: false,
      weatherLocation: 'rotate',
    });
    expect(resolved.rendererUrl).toContain('show_weather=false');
    expect(resolved.rendererUrl).toContain('weather=none');
  });
});
