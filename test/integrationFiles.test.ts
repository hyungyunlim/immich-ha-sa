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
});
