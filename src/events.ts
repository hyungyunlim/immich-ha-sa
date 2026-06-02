import type { FastifyReply } from 'fastify';
import type { FrameCommandEvent, FrameDevice, FrameState, ResolvedFrameState } from './types.js';
import { buildProxiedRendererUrl, controllerBaseUrlForContext, type RequestContext } from './rendererUrl.js';

interface SseClient {
  reply: FastifyReply;
  device: FrameDevice;
  context: RequestContext;
  kioskPassword?: string;
}

export class FrameEventHub {
  private readonly clients = new Map<string, Set<SseClient>>();

  subscribe(deviceId: string, client: SseClient, state: FrameState): void {
    const initialState = buildProxiedRendererUrl(client.device, state, client.context, {
      kioskPassword: client.kioskPassword,
      controllerBaseUrl: controllerBaseUrlForContext(client.context, client.device.localControllerBaseUrl),
    });
    const clients = this.clients.get(deviceId) ?? new Set<SseClient>();
    clients.add(client);
    this.clients.set(deviceId, clients);

    client.reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    client.reply.raw.write('\n');
    this.send(client, 'state', initialState);

    const cleanup = (): void => {
      clients.delete(client);
      if (clients.size === 0) this.clients.delete(deviceId);
    };
    client.reply.raw.on('close', cleanup);
  }

  emitState(deviceId: string, state: FrameState, device?: FrameDevice): void {
    const clients = this.clients.get(deviceId);
    if (!clients) return;
    for (const client of clients) {
      if (device) {
        client.device = device;
      }
      try {
        this.send(client, 'state', buildProxiedRendererUrl(device ?? client.device, state, client.context, {
          kioskPassword: client.kioskPassword,
          controllerBaseUrl: controllerBaseUrlForContext(client.context, (device ?? client.device).localControllerBaseUrl),
        }));
      } catch {
        clients.delete(client);
      }
    }
  }

  emitCommand(deviceId: string, event: FrameCommandEvent): number {
    const clients = this.clients.get(deviceId);
    if (!clients) return 0;
    let delivered = 0;
    for (const client of clients) {
      try {
        this.send(client, 'command', event);
        delivered += 1;
      } catch {
        clients.delete(client);
      }
    }
    return delivered;
  }

  heartbeat(): void {
    for (const clients of this.clients.values()) {
      for (const client of clients) {
        this.send(client, 'heartbeat', { at: new Date().toISOString() });
      }
    }
  }

  private send(client: SseClient, event: string, data: ResolvedFrameState | { at: string } | FrameCommandEvent): void {
    client.reply.raw.write(`event: ${event}\n`);
    client.reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
