import type { FastifyReply } from 'fastify';
import type { FrameDevice, FrameState, ResolvedFrameState } from './types.js';
import { buildRendererUrl, type RequestContext } from './rendererUrl.js';

interface SseClient {
  reply: FastifyReply;
  device: FrameDevice;
  context: RequestContext;
}

export class FrameEventHub {
  private readonly clients = new Map<string, Set<SseClient>>();

  subscribe(deviceId: string, client: SseClient, state: FrameState): void {
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
    this.send(client, 'state', buildRendererUrl(client.device, state, client.context));

    const cleanup = (): void => {
      clients.delete(client);
      if (clients.size === 0) this.clients.delete(deviceId);
    };
    client.reply.raw.on('close', cleanup);
  }

  emitState(deviceId: string, state: FrameState): void {
    const clients = this.clients.get(deviceId);
    if (!clients) return;
    for (const client of clients) {
      this.send(client, 'state', buildRendererUrl(client.device, state, client.context));
    }
  }

  heartbeat(): void {
    for (const clients of this.clients.values()) {
      for (const client of clients) {
        this.send(client, 'heartbeat', { at: new Date().toISOString() });
      }
    }
  }

  private send(client: SseClient, event: string, data: ResolvedFrameState | { at: string }): void {
    client.reply.raw.write(`event: ${event}\n`);
    client.reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

