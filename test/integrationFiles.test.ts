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

  it('exposes album order as a Home Assistant select entity', () => {
    const source = readFileSync(join(root, 'custom_components/immich_frame/select.py'), 'utf8');

    expect(source).toContain('"album_order"');
    expect(source).toContain('"Album Order"');
    expect(source).toContain('"albumOrder"');
    expect(source).toContain('["random", "newest", "oldest"]');
  });

  it('exposes weather detail overrides as Home Assistant select entities and services', () => {
    const selectSource = readFileSync(join(root, 'custom_components/immich_frame/select.py'), 'utf8');
    const initSource = readFileSync(join(root, 'custom_components/immich_frame/__init__.py'), 'utf8');
    const servicesSource = readFileSync(join(root, 'custom_components/immich_frame/services.yaml'), 'utf8');
    const profileSource = readFileSync(join(root, 'custom_components/immich_frame/profile_helpers.py'), 'utf8');

    expect(selectSource).toContain('WEATHER_OVERRIDE_OPTIONS');
    expect(selectSource).toContain('"Weather Forecast"');
    expect(selectSource).toContain('"weatherShowForecast"');
    expect(selectSource).toContain('"Weather Humidity"');
    expect(selectSource).toContain('"weatherShowHumidity"');
    expect(selectSource).toContain('"Weather Wind Direction"');
    expect(selectSource).toContain('"weatherShowWindDirection"');
    expect(selectSource).toContain('"Weather Temperature Range"');
    expect(selectSource).toContain('"weatherShowTemperatureRange"');
    expect(selectSource).toContain('"Weather Round Temperature"');
    expect(selectSource).toContain('"weatherRoundTemperature"');
    expect(initSource).toContain('vol.Optional("weatherShowForecast")');
    expect(initSource).toContain('vol.Optional("weatherRoundTemperature")');
    expect(servicesSource).toContain('weatherShowForecast:');
    expect(servicesSource).toContain('weatherRoundTemperature:');
    expect(profileSource).toContain('"weatherShowForecast"');
    expect(profileSource).toContain('"weatherRoundTemperature"');
  });

  it('does not expose the unreliable FreeKiosk D-pad up command button', () => {
    const source = readFileSync(join(root, 'custom_components/immich_frame/button.py'), 'utf8');

    expect(source).not.toContain('"dpad_up"');
    expect(source).not.toContain('"D-pad Up"');
    expect(source).not.toContain('"dpad-up"');
  });

  it('exposes kiosk video mute as a stateful switch and a regular press button', () => {
    const buttonSource = readFileSync(join(root, 'custom_components/immich_frame/button.py'), 'utf8');
    const switchSource = readFileSync(join(root, 'custom_components/immich_frame/switch.py'), 'utf8');

    expect(buttonSource).toContain('"kiosk_video_mute"');
    expect(buttonSource).toContain('"Kiosk Video Mute"');
    expect(buttonSource).toContain('"mute-toggle"');
    expect(switchSource).toContain('"kiosk_video_mute"');
    expect(switchSource).toContain('Frame Kiosk Video Mute');
    expect(switchSource).toContain('"mute-on" if muted else "mute-off"');
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
    expect(mediaPlayerSource).toContain('MediaPlayerEntityFeature.PREVIOUS_TRACK');
    expect(mediaPlayerSource).toContain('MediaPlayerEntityFeature.VOLUME_MUTE');
    expect(mediaPlayerSource).toContain('MediaPlayerEntityFeature.VOLUME_SET');
    expect(mediaPlayerSource).toContain('async_media_play_pause');
    expect(mediaPlayerSource).toContain('async_mute_volume');
    expect(mediaPlayerSource).toContain('async_set_volume_level');
    expect(mediaPlayerSource).not.toContain('"mute-on" if mute else "mute-off"');
    expect(mediaPlayerSource).not.toContain('update_frame_state({"kioskVideoMuted": mute})');
    expect(mediaPlayerSource).toContain('send_command("device-mute-toggle")');
    expect(switchSource).toContain('"remote_screen"');
    expect(switchSource).toContain('"screen-on"');
    expect(switchSource).toContain('"screen-off"');
    expect(switchSource).toContain('"remote_device_mute"');
    expect(switchSource).toContain('"device-mute-toggle"');
    expect(remoteStatusSource).toContain('audio.volume_zero');
    expect(numberSource).toContain('"remote_volume"');
  });

  it('routes kiosk mute press through FreeKiosk first', () => {
    const serverSource = readFileSync(join(root, 'src/server.ts'), 'utf8');

    expect(serverSource).toContain('commandPrefersRemotePress(parsed.data.command)');
    expect(serverSource).toContain("return command === 'mute-toggle'");
    expect(serverSource).toContain("if (command === 'mute-toggle') return false;");
    expect(serverSource).toContain("if (command === 'mute-toggle') selector");
    expect(serverSource).toContain("command === 'mute-on'");
    expect(serverSource).toContain("command === 'mute-off'");
    expect(serverSource).toContain('api.setMuted(muted)');
    expect(serverSource).not.toContain('commandNeedsRemoteReconciliation');
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

  it('exposes custom CSS class state through Home Assistant and profiles', () => {
    // Given
    const textSource = readFileSync(join(root, 'custom_components/immich_frame/text.py'), 'utf8');
    const initSource = readFileSync(join(root, 'custom_components/immich_frame/__init__.py'), 'utf8');
    const profileSource = readFileSync(join(root, 'custom_components/immich_frame/profile_helpers.py'), 'utf8');
    const servicesSource = readFileSync(join(root, 'custom_components/immich_frame/services.yaml'), 'utf8');

    // When / Then
    expect(textSource).toContain('"custom_css_class"');
    expect(textSource).toContain('"Custom CSS Class"');
    expect(textSource).toContain('"customCssClass"');
    expect(initSource).toContain('vol.Optional("customCssClass")');
    expect(initSource).toContain('vol.Length(max=128)');
    expect(profileSource).toContain('"customCssClass"');
    expect(servicesSource).toContain('customCssClass:');
  });

  it('registers the FreeKiosk accelerometer orientation binary sensor', () => {
    // Given
    const source = readFileSync(join(root, 'custom_components/immich_frame/binary_sensor.py'), 'utf8');

    // When / Then
    expect(source).toContain('ImmichFrameRemoteOrientationAxisBinarySensor(coordinator)');
    expect(source).toContain('remote_orientation_x_axis_dominant');
    expect(source).toContain('"remote_orientation_x_axis_dominant"');
  });

  it('exposes image description scroll controls and services', () => {
    const initSource = readFileSync(join(root, 'custom_components/immich_frame/__init__.py'), 'utf8');
    const numberSource = readFileSync(join(root, 'custom_components/immich_frame/number.py'), 'utf8');
    const servicesSource = readFileSync(join(root, 'custom_components/immich_frame/services.yaml'), 'utf8');

    expect(numberSource).toContain('"image_description_scroll_duration"');
    expect(numberSource).toContain('"imageDescriptionScrollDuration"');
    expect(numberSource).toContain('"image_description_scroll_speed"');
    expect(numberSource).toContain('"imageDescriptionScrollSpeed"');
    expect(numberSource).toContain('"image_description_start_delay"');
    expect(numberSource).toContain('"imageDescriptionStartDelay"');
    expect(numberSource).toContain('"image_description_area_height"');
    expect(numberSource).toContain('"imageDescriptionAreaHeight"');
    expect(numberSource).toContain('"image_description_overlay_opacity"');
    expect(numberSource).toContain('"imageDescriptionOverlayOpacity"');
    expect(numberSource).toContain('"image_description_long_threshold_lines"');
    expect(numberSource).toContain('"imageDescriptionLongThresholdLines"');
    expect(initSource).toContain('vol.Optional("imageDescriptionScrollDuration")');
    expect(initSource).toContain('vol.Optional("imageDescriptionScrollSpeed")');
    expect(initSource).toContain('vol.Optional("imageDescriptionStartDelay")');
    expect(initSource).toContain('vol.Optional("imageDescriptionAreaHeight")');
    expect(initSource).toContain('vol.Optional("imageDescriptionOverlayOpacity")');
    expect(initSource).toContain('vol.Optional("imageDescriptionLongThresholdLines")');
    expect(servicesSource).toContain('imageDescriptionScrollDuration:');
    expect(servicesSource).toContain('imageDescriptionScrollSpeed:');
    expect(servicesSource).toContain('imageDescriptionStartDelay:');
    expect(servicesSource).toContain('imageDescriptionAreaHeight:');
    expect(servicesSource).toContain('imageDescriptionOverlayOpacity:');
    expect(servicesSource).toContain('imageDescriptionLongThresholdLines:');
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

  it('exposes profile save and delete controls', () => {
    const apiSource = readFileSync(join(root, 'custom_components/immich_frame/api.py'), 'utf8');
    const buttonSource = readFileSync(join(root, 'custom_components/immich_frame/button.py'), 'utf8');
    const constSource = readFileSync(join(root, 'custom_components/immich_frame/const.py'), 'utf8');
    const initSource = readFileSync(join(root, 'custom_components/immich_frame/__init__.py'), 'utf8');
    const servicesSource = readFileSync(join(root, 'custom_components/immich_frame/services.yaml'), 'utf8');
    const textSource = readFileSync(join(root, 'custom_components/immich_frame/text.py'), 'utf8');

    expect(apiSource).toContain('upsert_profile');
    expect(apiSource).toContain('delete_profile');
    expect(apiSource).toContain("quote(profile_id, safe='')");
    expect(buttonSource).toContain('Frame Save Profile');
    expect(buttonSource).toContain('Frame Delete Profile');
    expect(buttonSource).toContain('"save_profile"');
    expect(buttonSource).toContain('"delete_profile"');
    expect(constSource).toContain('SERVICE_SAVE_PROFILE = "save_profile"');
    expect(constSource).toContain('SERVICE_DELETE_PROFILE = "delete_profile"');
    expect(initSource).toContain('SERVICE_SAVE_PROFILE');
    expect(initSource).toContain('SERVICE_DELETE_PROFILE');
    expect(initSource).toContain('profile_from_frame_state');
    expect(servicesSource).toContain('save_profile:');
    expect(servicesSource).toContain('delete_profile:');
    expect(textSource).toContain('"Profile Name"');
    expect(textSource).toContain('"Profile ID"');
  });
});
