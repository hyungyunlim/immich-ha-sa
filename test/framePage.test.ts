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
  it('uses the immich-kiosk video mute API before legacy mute fallbacks', () => {
    const html = renderFramePage(device);

    expect(html).toContain('immichKiosk');
    expect(html).toContain('api.setMuted(muted)');
    expect(html).toContain('.navigation--mute');
    expect(html).toContain('toggleVideoMutedDirectly');
    expect(html).toContain("if (command === 'mute-toggle')");
    expect(html).toContain("if (command === 'mute-on')");
    expect(html).toContain("if (command === 'mute-off')");
    expect(html).not.toContain('setTimeout(syncVideoMutedFromKiosk');
  });

  it('unmounts the renderer while suspended and acknowledges commands', () => {
    const html = renderFramePage(device);

    expect(html).toContain("if (command === 'renderer-suspend') return suspendRenderer()");
    expect(html).toContain("if (command === 'renderer-resume') return resumeRenderer()");
    expect(html).toContain('iframe.remove()');
    expect(html).toContain('/commands/ack');
    expect(html).toContain('ackToken: payload.ackToken');
    expect(html).toContain('rendererSuspended: rendererSuspended');
  });

  it('supports explicit play and pause commands with state verification', () => {
    const html = renderFramePage(device);

    expect(html).toContain("if (command === 'play') return applyPlaybackState('playing')");
    expect(html).toContain("if (command === 'pause') return applyPlaybackState('paused')");
    expect(html).toContain("doc.body.classList.contains('polling-paused')");
    expect(html).toContain("selector = '.navigation--play-pause");
    expect(html).toContain('previousAssetAvailable');
    expect(html).toContain('if (stateChanged) applyPlaybackState(playbackState)');
  });
});
