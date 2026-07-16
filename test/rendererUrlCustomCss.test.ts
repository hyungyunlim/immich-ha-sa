import { describe, expect, it } from 'vitest';
import { createDefaultFrameState } from '../src/defaults.js';
import { buildRendererUrl } from '../src/rendererUrl.js';
import type { FrameDevice } from '../src/types.js';

const device: FrameDevice = {
  id: 'lenovo',
  name: 'Lenovo',
  networkMode: 'local',
  localControllerBaseUrl: 'http://10.0.0.10:18082',
  localKioskBaseUrl: 'http://10.0.0.10:3000',
  pollIntervalSeconds: 20,
};

describe('renderer URL custom CSS classes', () => {
  it('normalizes whitespace between multiple class names', () => {
    // Given
    const state = {
      ...createDefaultFrameState(device),
      customCssClass: '  art-gallery\t night-mode\n',
    };

    // When
    const rendererUrl = buildRendererUrl(device, state).rendererUrl;

    // Then
    expect(new URL(rendererUrl).searchParams.get('custom_css_class')).toBe('art-gallery night-mode');
  });
});
