import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import type {
  FrameCommand,
  FrameCommandAck,
  FrameCommandEvent,
  FrameDevice,
  FrameState,
  ResolvedFrameState,
} from './types.js';
import { buildProxiedRendererUrl, controllerBaseUrlForContext, type RequestContext } from './rendererUrl.js';

interface SseClient {
  reply: FastifyReply;
  device: FrameDevice;
  context: RequestContext;
  globalKioskPassword?: string;
}

interface PendingFrameCommand {
  deviceId: string;
  ackToken: string;
  ack?: FrameCommandAck;
  waiters: Set<(ack: FrameCommandAck | undefined) => void>;
  expiresAt: NodeJS.Timeout;
}

export interface FrameCommandDelivery {
  event: FrameCommandEvent;
  connectedClients: number;
  delivered: number;
}

export interface FrameCommandAckInput {
  commandId: string;
  ackToken: string;
  success: boolean;
  playbackState?: FrameCommandAck['playbackState'];
  rendererSuspended?: boolean;
  error?: string;
}

export class FrameEventHub {
  private readonly clients = new Map<string, Set<SseClient>>();
  private readonly pendingCommands = new Map<string, PendingFrameCommand>();

  connectedClientCount(deviceId: string): number {
    return this.clients.get(deviceId)?.size ?? 0;
  }

  subscribe(deviceId: string, client: SseClient, state: FrameState): void {
    const initialState = buildProxiedRendererUrl(client.device, state, client.context, {
      kioskPassword: kioskPasswordForDevice(client.device, client.globalKioskPassword),
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
          kioskPassword: kioskPasswordForDevice(device ?? client.device, client.globalKioskPassword),
          controllerBaseUrl: controllerBaseUrlForContext(client.context, (device ?? client.device).localControllerBaseUrl),
        }));
      } catch {
        clients.delete(client);
      }
    }
  }

  issueCommand(deviceId: string, command: FrameCommand): FrameCommandDelivery {
    const event: FrameCommandEvent = {
      command,
      commandId: randomUUID(),
      ackToken: randomBytes(24).toString('base64url'),
      issuedAt: new Date().toISOString(),
    };
    const clients = this.clients.get(deviceId);
    const connectedClients = clients?.size ?? 0;
    let delivered = 0;
    if (clients) {
      for (const client of clients) {
        try {
          this.send(client, 'command', event);
          delivered += 1;
        } catch {
          clients.delete(client);
        }
      }
    }
    if (delivered > 0) {
      const expiresAt = setTimeout(() => {
        const pending = this.pendingCommands.get(event.commandId);
        if (!pending) return;
        this.pendingCommands.delete(event.commandId);
        for (const waiter of pending.waiters) waiter(undefined);
      }, 30_000);
      expiresAt.unref();
      this.pendingCommands.set(event.commandId, {
        deviceId,
        ackToken: event.ackToken,
        waiters: new Set(),
        expiresAt,
      });
    }
    return { event, connectedClients, delivered };
  }

  acknowledgeCommand(deviceId: string, input: FrameCommandAckInput): FrameCommandAck | undefined {
    const pending = this.pendingCommands.get(input.commandId);
    if (!pending || pending.deviceId !== deviceId || pending.ackToken !== input.ackToken) return undefined;
    const ack: FrameCommandAck = {
      commandId: input.commandId,
      success: input.success,
      acknowledgedAt: new Date().toISOString(),
      playbackState: input.playbackState,
      rendererSuspended: input.rendererSuspended,
      error: input.error,
    };
    pending.ack = ack;
    for (const waiter of pending.waiters) waiter(ack);
    return ack;
  }

  waitForCommandAck(commandId: string, timeoutMs: number): Promise<FrameCommandAck | undefined> {
    const pending = this.pendingCommands.get(commandId);
    if (!pending) return Promise.resolve(undefined);
    if (pending.ack) {
      this.finishPendingCommand(commandId, pending);
      return Promise.resolve(pending.ack);
    }
    return new Promise((resolve) => {
      let timeout: NodeJS.Timeout;
      const finish = (ack: FrameCommandAck | undefined): void => {
        clearTimeout(timeout);
        pending.waiters.delete(finish);
        this.finishPendingCommand(commandId, pending);
        resolve(ack);
      };
      pending.waiters.add(finish);
      timeout = setTimeout(() => finish(undefined), timeoutMs);
      timeout.unref();
    });
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

  private finishPendingCommand(commandId: string, pending: PendingFrameCommand): void {
    if (this.pendingCommands.get(commandId) !== pending) return;
    clearTimeout(pending.expiresAt);
    this.pendingCommands.delete(commandId);
  }
}

function kioskPasswordForDevice(device: FrameDevice, globalKioskPassword: string | undefined): string | undefined {
  return device.kioskPassword || globalKioskPassword;
}
