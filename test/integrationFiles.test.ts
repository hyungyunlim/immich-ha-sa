import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Home Assistant integration files', () => {
  it('shows an explicit all-photos state for the album select entity', () => {
    const source = readFileSync(join(root, 'custom_components/immich_frame/select.py'), 'utf8');

    expect(source).toContain('ALBUM_OPTION_ALL_PHOTOS = "All Photos"');
    expect(source).toContain('ALBUM_OPTION_MULTIPLE_ALBUMS = "Multiple Albums"');
    expect(source).toContain('return ALBUM_OPTION_ALL_PHOTOS');
    expect(source).toContain('return ALBUM_OPTION_MULTIPLE_ALBUMS');
    expect(source).toContain('update_frame_state({"activeAlbumIds": []})');
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
});
