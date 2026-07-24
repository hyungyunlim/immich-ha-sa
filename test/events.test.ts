import { EventEmitter } from 'node:events';
import type { FastifyReply } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultFrameState } from '../src/defaults.js';
import { FrameEventHub } from '../src/events.js';
import type { FrameDevice } from '../src/types.js';

const device: FrameDevice = {
  id: 'lenovo',
  name: 'Lenovo',
  networkMode: 'local',
  localControllerBaseUrl: 'http://10.0.0.10:18082',
  localKioskBaseUrl: 'http://10.0.0.10:3000',
  pollIntervalSeconds: 20,
};

function subscribe(hub: FrameEventHub): string[] {
  const chunks: string[] = [];
  const raw = new EventEmitter() as EventEmitter & {
    writeHead: ReturnType<typeof vi.fn>;
    write: (chunk: string) => boolean;
  };
  raw.writeHead = vi.fn();
  raw.write = (chunk: string) => {
    chunks.push(chunk);
    return true;
  };
  hub.subscribe('lenovo', {
    reply: { raw } as unknown as FastifyReply,
    device,
    context: { host: '10.0.0.10:18082', protocol: 'http' },
  }, createDefaultFrameState(device));
  return chunks;
}

describe('FrameEventHub command acknowledgements', () => {
  it('delivers a one-time command token and resolves its acknowledgement', async () => {
    const hub = new FrameEventHub();
    const chunks = subscribe(hub);

    const delivery = hub.issueCommand('lenovo', 'pause');
    const wait = hub.waitForCommandAck(delivery.event.commandId, 100);
    const ack = hub.acknowledgeCommand('lenovo', {
      commandId: delivery.event.commandId,
      ackToken: delivery.event.ackToken,
      success: true,
      playbackState: 'paused',
      rendererSuspended: false,
    });

    expect(delivery).toMatchObject({ connectedClients: 1, delivered: 1 });
    expect(chunks.join('')).toContain(`"commandId":"${delivery.event.commandId}"`);
    expect(chunks.join('')).toContain(`"ackToken":"${delivery.event.ackToken}"`);
    expect(ack).toMatchObject({
      success: true,
      playbackState: 'paused',
      rendererSuspended: false,
    });
    await expect(wait).resolves.toMatchObject({ success: true, playbackState: 'paused' });
  });

  it('rejects an acknowledgement with the wrong token', async () => {
    const hub = new FrameEventHub();
    subscribe(hub);
    const delivery = hub.issueCommand('lenovo', 'renderer-suspend');

    expect(hub.acknowledgeCommand('lenovo', {
      commandId: delivery.event.commandId,
      ackToken: 'invalid-token-that-is-long-enough',
      success: true,
    })).toBeUndefined();

    const wait = hub.waitForCommandAck(delivery.event.commandId, 100);
    hub.acknowledgeCommand('lenovo', {
      commandId: delivery.event.commandId,
      ackToken: delivery.event.ackToken,
      success: true,
      rendererSuspended: true,
    });
    await expect(wait).resolves.toMatchObject({ rendererSuspended: true });
  });
});
