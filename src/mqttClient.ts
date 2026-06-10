import { connect, type MqttClient } from 'mqtt';

export type FreeKioskAvailability = 'online' | 'offline';

export interface FreeKioskMqttSnapshot {
  topicId: string;
  /** Unset until an availability message arrives — retained-topic order is not guaranteed. */
  availability?: FreeKioskAvailability;
  availabilityChangedAt?: string;
  state?: Record<string, unknown>;
  stateReceivedAt?: string;
  ip?: string;
}

export interface FreeKioskMqttBridgeLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  debug(payload: Record<string, unknown>, message: string): void;
}

export type FreeKioskMqttDeviceUpdateHandler = (
  snapshot: FreeKioskMqttSnapshot,
  kind: 'availability' | 'state',
) => void;

export interface FreeKioskMqttBridgeOptions {
  brokerUrl: string;
  username?: string;
  password?: string;
  baseTopic?: string;
  clientId?: string;
  logger?: FreeKioskMqttBridgeLogger;
}

export class FreeKioskMqttPublishError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Subscribes to FreeKiosk availability/state topics on a user-provided broker and
 * publishes `set/{entity}` commands. The retained-state cache is only trusted while
 * the matching availability topic reports `online`; LWT acts as the freshness gate.
 */
export class FreeKioskMqttBridge {
  private client?: MqttClient;
  private connectedFlag = false;
  private closed = false;
  private lastError?: string;
  private updateHandler?: FreeKioskMqttDeviceUpdateHandler;
  private readonly devices = new Map<string, FreeKioskMqttSnapshot>();
  private readonly baseTopic: string;

  constructor(private readonly options: FreeKioskMqttBridgeOptions) {
    this.baseTopic = normalizeBaseTopic(options.baseTopic);
  }

  onDeviceUpdate(handler: FreeKioskMqttDeviceUpdateHandler): void {
    this.updateHandler = handler;
  }

  connect(): void {
    if (this.client || this.closed) return;
    const client = connect(this.options.brokerUrl, {
      username: this.options.username,
      password: this.options.password,
      clientId: this.options.clientId ?? `immich-frame-controller-${Math.random().toString(36).slice(2, 10)}`,
      reconnectPeriod: 5_000,
      connectTimeout: 10_000,
    });
    this.client = client;

    client.on('connect', () => {
      this.connectedFlag = true;
      this.lastError = undefined;
      this.options.logger?.info({ brokerUrl: this.redactedBrokerUrl }, 'FreeKiosk MQTT bridge connected');
      client.subscribe(
        [`${this.baseTopic}/+/availability`, `${this.baseTopic}/+/state`],
        { qos: 1 },
        (error) => {
          if (error) {
            this.options.logger?.warn({ error: error.message }, 'FreeKiosk MQTT subscribe failed');
          }
        },
      );
    });
    client.on('close', () => {
      if (this.connectedFlag) {
        this.options.logger?.warn({ brokerUrl: this.redactedBrokerUrl }, 'FreeKiosk MQTT bridge disconnected');
      }
      this.connectedFlag = false;
    });
    client.on('error', (error) => {
      this.lastError = error.message;
      this.options.logger?.debug({ error: error.message }, 'FreeKiosk MQTT bridge error');
    });
    client.on('message', (topic, payload) => {
      try {
        this.handleMessage(topic, payload.toString('utf8'));
      } catch (error) {
        this.options.logger?.debug({
          topic,
          error: error instanceof Error ? error.message : String(error),
        }, 'FreeKiosk MQTT message ignored');
      }
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    const client = this.client;
    this.client = undefined;
    this.connectedFlag = false;
    if (!client) return;
    client.removeAllListeners();
    await new Promise<void>((resolve) => {
      client.end(true, {}, () => resolve());
    });
  }

  get connected(): boolean {
    return this.connectedFlag;
  }

  get connectionError(): string | undefined {
    return this.lastError;
  }

  get topicPrefix(): string {
    return this.baseTopic;
  }

  get redactedBrokerUrl(): string {
    try {
      const url = new URL(this.options.brokerUrl);
      url.username = '';
      url.password = '';
      return url.toString().replace(/\/+$/, '');
    } catch {
      return 'mqtt://[unparseable-url-redacted]';
    }
  }

  listDevices(): FreeKioskMqttSnapshot[] {
    return [...this.devices.values()].map((snapshot) => ({ ...snapshot }));
  }

  getDevice(topicId: string): FreeKioskMqttSnapshot | undefined {
    const snapshot = this.devices.get(topicId);
    return snapshot ? { ...snapshot } : undefined;
  }

  isOnline(topicId: string): boolean {
    return this.devices.get(topicId)?.availability === 'online';
  }

  async publishCommand(topicId: string, suffix: string, payload: string): Promise<{ topic: string; payload: string }> {
    const client = this.client;
    if (!client || !this.connectedFlag) {
      throw new FreeKioskMqttPublishError('MQTT broker is not connected.');
    }
    const topic = `${this.baseTopic}/${topicId}/set/${suffix}`;
    await new Promise<void>((resolve, reject) => {
      client.publish(topic, payload, { qos: 1 }, (error) => {
        if (error) {
          reject(new FreeKioskMqttPublishError(error.message));
        } else {
          resolve();
        }
      });
    });
    return { topic, payload };
  }

  private handleMessage(topic: string, payload: string): void {
    const parsed = parseFreeKioskTopic(topic, this.baseTopic);
    if (!parsed) return;
    const { topicId, kind } = parsed;

    if (kind === 'availability') {
      const availability = payload.trim().toLowerCase();
      if (availability !== 'online' && availability !== 'offline') return;
      const current = this.devices.get(topicId);
      const next: FreeKioskMqttSnapshot = {
        ...(current ?? { topicId }),
        topicId,
        availability,
        availabilityChangedAt: current?.availability === availability
          ? current.availabilityChangedAt
          : new Date().toISOString(),
      };
      this.devices.set(topicId, next);
      if (current?.availability !== availability) {
        this.options.logger?.info({ topicId, availability }, 'FreeKiosk MQTT availability changed');
      }
      this.updateHandler?.({ ...next }, 'availability');
      return;
    }

    const state = parseStatePayload(payload);
    if (!state) return;
    const current = this.devices.get(topicId);
    const next: FreeKioskMqttSnapshot = {
      ...(current ?? { topicId }),
      topicId,
      state,
      stateReceivedAt: new Date().toISOString(),
      ip: extractStateIp(state) ?? current?.ip,
    };
    this.devices.set(topicId, next);
    this.updateHandler?.({ ...next }, 'state');
  }
}

function parseFreeKioskTopic(
  topic: string,
  baseTopic: string,
): { topicId: string; kind: 'availability' | 'state' } | undefined {
  if (!topic.startsWith(`${baseTopic}/`)) return undefined;
  const rest = topic.slice(baseTopic.length + 1).split('/');
  if (rest.length !== 2 || !rest[0]) return undefined;
  if (rest[1] !== 'availability' && rest[1] !== 'state') return undefined;
  return { topicId: rest[0], kind: rest[1] };
}

function parseStatePayload(payload: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(payload) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function extractStateIp(state: Record<string, unknown>): string | undefined {
  const device = state.device;
  if (device && typeof device === 'object' && typeof (device as Record<string, unknown>).ip === 'string') {
    return (device as Record<string, unknown>).ip as string;
  }
  const wifi = state.wifi;
  if (wifi && typeof wifi === 'object' && typeof (wifi as Record<string, unknown>).ip === 'string') {
    return (wifi as Record<string, unknown>).ip as string;
  }
  return undefined;
}

function normalizeBaseTopic(value: string | undefined): string {
  const trimmed = (value ?? 'freekiosk').trim().replace(/^\/+|\/+$/g, '');
  return trimmed || 'freekiosk';
}

export function normalizeMqttBrokerUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.includes('://') ? trimmed : `mqtt://${trimmed}`;
}
