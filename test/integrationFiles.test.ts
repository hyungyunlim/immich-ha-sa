import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Home Assistant integration files', () => {
  it('shows an explicit no-filter state for the album select entity', () => {
    const source = readFileSync(join(root, 'custom_components/immich_frame/select.py'), 'utf8');
    const textSource = readFileSync(join(root, 'custom_components/immich_frame/text.py'), 'utf8');

    expect(source).toContain('ALBUM_OPTION_NO_FILTER = "No Album Filter"');
    expect(source).toContain('ALBUM_OPTION_ALL_PHOTOS_LEGACY = "All Photos"');
    expect(source).toContain('ALBUM_OPTION_MULTIPLE_ALBUMS = "Multiple Albums"');
    expect(source).toContain('return ALBUM_OPTION_NO_FILTER');
    expect(source).toContain('return ALBUM_OPTION_MULTIPLE_ALBUMS');
    expect(source).toContain('update_frame_state({"activeAlbumIds": []})');
    expect(textSource).toContain('"no album filter"');
  });

  it('exposes image fit as a Home Assistant select entity', () => {
    const source = readFileSync(join(root, 'custom_components/immich_frame/select.py'), 'utf8');

    expect(source).toContain('"image_fit"');
    expect(source).toContain('"Image Fit"');
    expect(source).toContain('"imageFit"');
    expect(source).toContain('["contain", "cover", "none"]');
  });

  it('exposes a FreeKiosk D-pad up command button', () => {
    const source = readFileSync(join(root, 'custom_components/immich_frame/button.py'), 'utf8');

    expect(source).toContain('"dpad_up"');
    expect(source).toContain('"D-pad Up"');
    expect(source).toContain('"dpad-up"');
  });

  it('exposes FreeKiosk screen and audio status controls', () => {
    const initSource = readFileSync(join(root, 'custom_components/immich_frame/__init__.py'), 'utf8');
    const binarySensorSource = readFileSync(join(root, 'custom_components/immich_frame/binary_sensor.py'), 'utf8');
    const lightSource = readFileSync(join(root, 'custom_components/immich_frame/light.py'), 'utf8');
    const mediaPlayerSource = readFileSync(join(root, 'custom_components/immich_frame/media_player.py'), 'utf8');
    const switchSource = readFileSync(join(root, 'custom_components/immich_frame/switch.py'), 'utf8');
    const remoteStatusSource = readFileSync(join(root, 'custom_components/immich_frame/remote_status.py'), 'utf8');
    const numberSource = readFileSync(join(root, 'custom_components/immich_frame/number.py'), 'utf8');

    expect(initSource).toContain('Platform.LIGHT');
    expect(initSource).toContain('Platform.MEDIA_PLAYER');
    expect(binarySensorSource).toContain('"remote_screen_on"');
    expect(binarySensorSource).toContain('Frame Screen On');
    expect(binarySensorSource).toContain('"remote_device_muted"');
    expect(binarySensorSource).toContain('Frame Device Muted');
    expect(lightSource).toContain('Frame Display');
    expect(lightSource).toContain('"remote_display_light"');
    expect(lightSource).toContain('set_remote_brightness');
    expect(mediaPlayerSource).toContain('Frame Slideshow');
    expect(mediaPlayerSource).toContain('"slideshow_media_player"');
    expect(mediaPlayerSource).toContain('MediaPlayerEntityFeature.NEXT_TRACK');
    expect(mediaPlayerSource).toContain('async_media_play_pause');
    expect(switchSource).toContain('"remote_screen"');
    expect(switchSource).toContain('"screen-on"');
    expect(switchSource).toContain('"screen-off"');
    expect(switchSource).toContain('"remote_device_mute"');
    expect(switchSource).toContain('"device-mute-toggle"');
    expect(remoteStatusSource).toContain('audio.volume_zero');
    expect(numberSource).toContain('"remote_volume"');
  });

  it('exposes friendly media content and orientation controls', () => {
    const selectSource = readFileSync(join(root, 'custom_components/immich_frame/select.py'), 'utf8');
    const numberSource = readFileSync(join(root, 'custom_components/immich_frame/number.py'), 'utf8');

    expect(selectSource).toContain('Frame Media Content');
    expect(selectSource).toContain('"Images + Videos"');
    expect(selectSource).toContain('{"showVideos": option == "Images + Videos"}');
    expect(selectSource).toContain('Frame Orientation');
    expect(selectSource).toContain('"Portrait only": "portrait"');
    expect(selectSource).toContain('"Landscape only": "landscape"');
    expect(numberSource).toContain('"max_video_length"');
    expect(numberSource).toContain('"excludeVideosOver"');
  });

  it('exposes person filter controls and services', () => {
    const selectSource = readFileSync(join(root, 'custom_components/immich_frame/select.py'), 'utf8');
    const sensorSource = readFileSync(join(root, 'custom_components/immich_frame/sensor.py'), 'utf8');
    const textSource = readFileSync(join(root, 'custom_components/immich_frame/text.py'), 'utf8');
    const switchSource = readFileSync(join(root, 'custom_components/immich_frame/switch.py'), 'utf8');
    const buttonSource = readFileSync(join(root, 'custom_components/immich_frame/button.py'), 'utf8');
    const servicesSource = readFileSync(join(root, 'custom_components/immich_frame/services.yaml'), 'utf8');

    expect(selectSource).toContain('Frame Person');
    expect(selectSource).toContain('PERSON_OPTION_NO_FILTER = "No Person Filter"');
    expect(selectSource).toContain('PERSON_OPTION_ALL_NAMED_PEOPLE = "All Named People"');
    expect(selectSource).toContain('def _selectable_people');
    expect(sensorSource).toContain('Frame Current People');
    expect(sensorSource).toContain('"current_people"');
    expect(sensorSource).toContain('"person_ids"');
    expect(textSource).toContain('Frame People');
    expect(textSource).toContain('"activePersonIds"');
    expect(switchSource).toContain('"require_all_people"');
    expect(switchSource).toContain('"requireAllPeople"');
    expect(buttonSource).toContain('"refresh_people"');
    expect(servicesSource).toContain('set_people:');
    expect(servicesSource).toContain('refresh_people:');
  });
});
