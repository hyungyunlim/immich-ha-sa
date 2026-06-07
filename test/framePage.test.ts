import { describe, expect, it } from 'vitest';
import { renderFramePage } from '../src/framePage.js';
import type { FrameDevice } from '../src/types.js';

const device: FrameDevice = {
  id: 'lenovo',
  name: 'Lenovo',
  networkMode: 'auto',
  localControllerBaseUrl: 'http://10.0.0.10:18082',
  localKioskBaseUrl: 'http://10.0.0.10:3000',
  pollIntervalSeconds: 20,
};

describe('frame page', () => {
  it('uses the immich-kiosk mute menu control before keyboard fallback', () => {
    const html = renderFramePage(device);

    expect(html).toContain('.navigation--mute');
    expect(html).toContain('toggleVideoMutedDirectly');
    expect(html).toContain("if (command === 'mute-toggle')");
    expect(html).not.toContain('kioskVideoMuted');
    expect(html).not.toContain('desiredVideoMuted');
    expect(html).not.toContain("if (command === 'mute-on')");
    expect(html).not.toContain("if (command === 'mute-off')");
    expect(html).not.toContain('setVideoMutedDirectly');
  });
});
