import { mkdtempSync, rmSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer, type Server as NetServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBroker } from 'aedes';
import { connect, type MqttClient } from 'mqtt';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../src/config.js';
import { FreeKioskMqttBridge } from '../src/mqttClient.js';
import { createServer } from '../src/server.js';
import { JsonStore } from '../src/store.js';
import type { FrameDevice } from '../src/types.js';

const tempDirs: string[] = [];
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup();
  }
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function buildConfig(dir: string): AppConfig {
  const defaultDevice: FrameDevice = {
    id: 'lenovo',
    name: 'Lenovo',
    networkMode: 'auto',
    localControllerBaseUrl: 'http://10.0.0.10:18082',
    localKioskBaseUrl: 'http://10.0.0.10:3000',
    pollIntervalSeconds: 20,
  };
  return {
    port: 18082,
    dataDir: dir,
    storePath: join(dir, 'state.json'),
    defaultDevice,
  };
}

async function waitFor(check: () => boolean, label: string, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

const FREEKIOSK_STATE = {
  battery: { level: 85, charging: true },
  screen: { on: true, brightness: 37, screensaverActive: false },
  wifi: { ssid: 'TestNet', signalLevel: 70, ip: '10.0.0.55' },
  device: { ip: '10.0.0.55', version: '1.2.12' },
  sensors: { light: 150.5 },
  audio: { volume: 33 },
  webview: { currentUrl: 'http://10.0.0.10:18082/frame/lenovo', motionDetected: false },
};

// A frame reachable only through the broker: no routable IP, so the controller has
// no REST endpoint and uses MQTT for commands.
const MQTT_ONLY_STATE = {
  ...FREEKIOSK_STATE,
  wifi: { ssid: 'TestNet', signalLevel: 70 },
  device: { version: '1.2.12' },
};

async function startMockFreeKiosk(
  handler: (url: string) => { status?: number; body: unknown },
): Promise<{ url: string; requests: string[] }> {
  const requests: string[] = [];
  const server = createHttpServer((request, response) => {
    requests.push(`${request.method} ${request.url}`);
    const { status = 200, body } = handler(request.url ?? '');
    response.statusCode = status;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests };
}

interface MqttWorld {
  server: ReturnType<typeof createServer>;
  store: JsonStore;
  bridge: FreeKioskMqttBridge;
  fake: MqttClient;
  received: Array<{ topic: string; payload: string }>;
  brokerUrl: string;
}

async function setupMqttWorld(options: {
  availability?: 'online' | 'offline';
  state?: Record<string, unknown>;
  deviceOverrides?: Partial<FrameDevice>;
} = {}): Promise<MqttWorld> {
  const dir = mkdtempSync(join(tmpdir(), 'immich-frame-mqtt-'));
  tempDirs.push(dir);

  const aedes = createBroker();
  const broker: NetServer = createNetServer(aedes.handle);
  await new Promise<void>((resolve) => broker.listen(0, '127.0.0.1', resolve));
  const brokerUrl = `mqtt://127.0.0.1:${(broker.address() as AddressInfo).port}`;
  cleanups.push(async () => {
    await new Promise<void>((resolve) => broker.close(() => resolve()));
    await new Promise<void>((resolve) => aedes.close(() => resolve()));
  });

  const fake = connect(brokerUrl);
  const received: Array<{ topic: string; payload: string }> = [];
  fake.subscribe('freekiosk/lobby/set/#', { qos: 1 });
  fake.on('message', (topic, payload) => {
    received.push({ topic, payload: payload.toString('utf8') });
  });
  await new Promise<void>((resolve) => fake.once('connect', () => resolve()));
  fake.publish('freekiosk/lobby/availability', options.availability ?? 'online', { retain: true, qos: 1 });
  fake.publish('freekiosk/lobby/state', JSON.stringify(options.state ?? FREEKIOSK_STATE), { retain: true, qos: 0 });
  cleanups.push(async () => {
    await new Promise<void>((resolve) => fake.end(true, {}, () => resolve()));
  });

  const config = buildConfig(dir);
  const store = new JsonStore(config.storePath, config.defaultDevice);
  store.updateDevice('lenovo', {
    remoteControlType: 'freekiosk',
    mqttTopicId: 'lobby',
    ...options.deviceOverrides,
  });

  const bridge = new FreeKioskMqttBridge({ brokerUrl });
  const server = createServer({
    config,
    store,
    mqtt: bridge,
    kioskConnectionChecker: async () => ({
      status: 'ok',
      statusCode: 200,
      message: 'Reachable',
      checkedAt: '2026-06-10T00:00:00.000Z',
    }),
  });
  cleanups.push(async () => {
    await server.close();
  });

  await waitFor(
    () => bridge.getDevice('lobby')?.availability === (options.availability ?? 'online')
      && Boolean(bridge.getDevice('lobby')?.state),
    'retained FreeKiosk snapshot',
  );

  return { server, store, bridge, fake, received, brokerUrl };
}

describe('FreeKiosk MQTT bridge', () => {
  it('authenticates to a username/password-protected broker', async () => {
    const aedes = createBroker({
      authenticate: (client, username, password, done) => {
        if (username === 'frameuser' && password?.toString('utf8') === 'framepass') {
          done(null, true);
          return;
        }
        done(Object.assign(new Error('Auth failed'), { returnCode: 5 }), false);
      },
    });
    const broker: NetServer = createNetServer(aedes.handle);
    await new Promise<void>((resolve) => broker.listen(0, '127.0.0.1', resolve));
    const brokerUrl = `mqtt://127.0.0.1:${(broker.address() as AddressInfo).port}`;
    cleanups.push(async () => {
      await new Promise<void>((resolve) => broker.close(() => resolve()));
      await new Promise<void>((resolve) => aedes.close(() => resolve()));
    });

    const bridge = new FreeKioskMqttBridge({
      brokerUrl,
      username: 'frameuser',
      password: 'framepass',
    });
    bridge.connect();
    cleanups.push(async () => bridge.close());
    await waitFor(() => bridge.connected, 'authenticated connect');

    const rejected = new FreeKioskMqttBridge({
      brokerUrl,
      username: 'frameuser',
      password: 'wrong-password',
    });
    rejected.connect();
    cleanups.push(async () => rejected.close());
    await waitFor(() => Boolean(rejected.connectionError), 'auth rejection error');
    expect(rejected.connected).toBe(false);
  });

  it('serves remote status from the MQTT cache when REST is unreachable', async () => {
    const { server } = await setupMqttWorld();

    const response = await server.inject({
      method: 'GET',
      url: '/api/frames/lenovo/remote/status',
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.source).toBe('mqtt');
    expect(data.availability).toBe('online');
    expect(data.status.screen.brightness).toBe(37);
    expect(data.status.webview.motionDetected).toBe(false);
    expect(data.capabilities.brightnessControl).toBe(true);
  });

  it('returns an offline payload instead of an error when the device is offline', async () => {
    const { server } = await setupMqttWorld({ availability: 'offline' });

    const response = await server.inject({
      method: 'GET',
      url: '/api/frames/lenovo/remote/status',
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.availability).toBe('offline');
    expect(data.source).toBe('mqtt');
    expect(data.status).toBeUndefined();
  });

  it('publishes screen-off over MQTT with brightness capture and mute (broker-only frame)', async () => {
    const { server, store, received } = await setupMqttWorld({ state: MQTT_ONLY_STATE });

    const response = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'screen-off' },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.transport).toBe('mqtt');
    expect(data.topic).toBe('freekiosk/lobby/set/screen');
    expect(data.brightnessRestore).toMatchObject({ action: 'capture', captured: true, value: 37 });
    expect(data.deviceMute).toMatchObject({ action: 'mute', muted: true, changed: true, source: 'mqtt' });
    expect(store.getDevice('lenovo')?.remoteBrightnessRestoreValue).toBe(37);

    await waitFor(() => received.length >= 2, 'volume + screen publications');
    expect(received).toEqual([
      { topic: 'freekiosk/lobby/set/volume', payload: '0' },
      { topic: 'freekiosk/lobby/set/screen', payload: 'OFF' },
    ]);
  });

  it('publishes screen-on and restores brightness over MQTT (broker-only frame)', async () => {
    const { server, store, received } = await setupMqttWorld({ state: MQTT_ONLY_STATE });
    store.updateDevice('lenovo', { remoteBrightnessRestoreValue: 37 });

    const response = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'screen-on' },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.transport).toBe('mqtt');
    expect(data.brightnessRestore).toMatchObject({ action: 'restore', restored: true, value: 37, source: 'mqtt' });

    await waitFor(() => received.length >= 2, 'screen + brightness publications');
    expect(received).toEqual([
      { topic: 'freekiosk/lobby/set/screen', payload: 'ON' },
      { topic: 'freekiosk/lobby/set/brightness', payload: '37' },
    ]);
  });

  it('steps volume over MQTT from cached telemetry for a broker-only frame', async () => {
    const { server, received } = await setupMqttWorld({ state: MQTT_ONLY_STATE });

    const response = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'volume-up' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.transport).toBe('mqtt');

    await waitFor(() => received.length >= 1, 'volume publication');
    expect(received).toEqual([
      { topic: 'freekiosk/lobby/set/volume', payload: '43' },
    ]);
  });

  it('sets brightness over MQTT for a broker-only frame', async () => {
    const { server, received } = await setupMqttWorld({ state: MQTT_ONLY_STATE });

    const response = await server.inject({
      method: 'PUT',
      url: '/api/frames/lenovo/remote/brightness',
      payload: { value: 55 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.transport).toBe('mqtt');

    await waitFor(() => received.length >= 1, 'brightness publication');
    expect(received).toEqual([
      { topic: 'freekiosk/lobby/set/brightness', payload: '55' },
    ]);
  });

  it('prefers REST for screen-off when the frame is REST-reachable, not MQTT', async () => {
    const mock = await startMockFreeKiosk((url) => {
      if (url === '/api/status') {
        return { body: { success: true, data: { screen: { on: true, brightness: 37 }, audio: { volume: 33 } } } };
      }
      return { body: { success: true, data: { executed: true } } };
    });
    const { server, received } = await setupMqttWorld({
      state: MQTT_ONLY_STATE,
      deviceOverrides: { remoteApiUrl: mock.url },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'screen-off' },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.transport).toBeUndefined();
    expect(data.endpoint).toBe('/api/screen/off');
    expect(data.source).toBe('manual');
    // Brightness captured + mute applied over REST, and screen-off via REST.
    expect(mock.requests).toContain('GET /api/status');
    expect(mock.requests).toContain('POST /api/screen/off');
    // No screen command leaked onto MQTT.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(received.some((m) => m.topic === 'freekiosk/lobby/set/screen')).toBe(false);
  });

  it('falls back to MQTT for idempotent screen-off when REST is unreachable', async () => {
    // Manual REST URL points at a closed port, so REST fails; screen-off is
    // idempotent, so the controller retries over MQTT.
    const { server, received } = await setupMqttWorld({
      state: MQTT_ONLY_STATE,
      deviceOverrides: { remoteApiUrl: 'http://127.0.0.1:1' },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'screen-off' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.transport).toBe('mqtt');
    await waitFor(() => received.some((m) => m.topic === 'freekiosk/lobby/set/screen'), 'mqtt screen fallback');
    expect(received.some((m) => m.topic === 'freekiosk/lobby/set/screen' && m.payload === 'OFF')).toBe(true);
  });

  it('lists discovered devices with binding info and updates lastSeenIp from state', async () => {
    const { server, store } = await setupMqttWorld();

    await waitFor(() => store.getDevice('lenovo')?.lastSeenIp === '10.0.0.55', 'lastSeenIp sync');

    const response = await server.inject({ method: 'GET', url: '/api/mqtt/status' });
    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.enabled).toBe(true);
    expect(data.connected).toBe(true);
    expect(data.devices).toHaveLength(1);
    expect(data.devices[0]).toMatchObject({
      topicId: 'lobby',
      availability: 'online',
      ip: '10.0.0.55',
      boundDeviceId: 'lenovo',
    });
  });

  it('suggests a frame for an unbound topic whose IP matches a verified frame', async () => {
    const { server, store } = await setupMqttWorld();
    await waitFor(() => store.getDevice('lenovo')?.lastSeenIp === '10.0.0.55', 'lastSeenIp sync');
    store.updateDevice('lenovo', { mqttTopicId: undefined });

    const response = await server.inject({ method: 'GET', url: '/api/mqtt/status' });
    expect(response.statusCode).toBe(200);
    const entry = response.json().data.devices[0];
    expect(entry.boundDeviceId).toBeUndefined();
    expect(entry.suggestedDeviceId).toBe('lenovo');
  });

  it('binds and unbinds an MQTT topic through the device PATCH endpoint', async () => {
    const { server, store } = await setupMqttWorld();
    store.updateDevice('lenovo', { mqttTopicId: undefined });

    const bind = await server.inject({
      method: 'PATCH',
      url: '/api/devices/lenovo',
      payload: { mqttTopicId: 'lobby', remoteControlType: 'freekiosk' },
    });
    expect(bind.statusCode).toBe(200);
    expect(store.getDevice('lenovo')?.mqttTopicId).toBe('lobby');

    const invalid = await server.inject({
      method: 'PATCH',
      url: '/api/devices/lenovo',
      payload: { mqttTopicId: 'bad/topic' },
    });
    expect(invalid.statusCode).toBe(400);

    const unbind = await server.inject({
      method: 'PATCH',
      url: '/api/devices/lenovo',
      payload: { mqttTopicId: null },
    });
    expect(unbind.statusCode).toBe(200);
    expect(store.getDevice('lenovo')?.mqttTopicId).toBeUndefined();
  });

  it('rejects binding the same MQTT topic to a second frame', async () => {
    const { server, store } = await setupMqttWorld();
    expect(store.getDevice('lenovo')?.mqttTopicId).toBe('lobby');

    const created = await server.inject({
      method: 'POST',
      url: '/api/devices',
      payload: { id: 'kitchen', name: 'Kitchen Frame' },
    });
    expect(created.statusCode).toBe(200);

    const conflict = await server.inject({
      method: 'PATCH',
      url: '/api/devices/kitchen',
      payload: { mqttTopicId: 'lobby', remoteControlType: 'freekiosk' },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('MQTT_TOPIC_BOUND');
    expect(store.getDevice('kitchen')?.mqttTopicId).toBeUndefined();

    const createConflict = await server.inject({
      method: 'POST',
      url: '/api/devices',
      payload: { id: 'hallway', name: 'Hallway Frame', mqttTopicId: 'lobby' },
    });
    expect(createConflict.statusCode).toBe(409);

    // Re-saving the already-bound frame with its own topic stays allowed.
    const resave = await server.inject({
      method: 'PATCH',
      url: '/api/devices/lenovo',
      payload: { mqttTopicId: 'lobby' },
    });
    expect(resave.statusCode).toBe(200);
  });

  it('falls back to MQTT when REST answers but rejects the command', async () => {
    const rest = createHttpServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ success: false, error: 'keyboard unavailable' }));
    });
    await new Promise<void>((resolve) => rest.listen(0, '127.0.0.1', resolve));
    cleanups.push(async () => {
      await new Promise<void>((resolve) => rest.close(() => resolve()));
    });
    const restPort = (rest.address() as AddressInfo).port;

    const localState = structuredClone(FREEKIOSK_STATE);
    localState.device.ip = '127.0.0.1';
    localState.wifi.ip = '127.0.0.1';
    const { server, received } = await setupMqttWorld({
      state: localState,
      deviceOverrides: {
        remoteApiUrl: `http://127.0.0.1:${restPort}`,
        remoteApiAutoPort: restPort,
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'volume-up' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.transport).toBe('mqtt');
    await waitFor(() => received.length >= 1, 'volume publication');
    expect(received).toEqual([
      { topic: 'freekiosk/lobby/set/volume', payload: '43' },
    ]);
  });

  it('does not double-send over MQTT when REST fails without a response', async () => {
    // A non-idempotent key event may have executed even though the response was
    // lost, so the controller must not re-issue it over MQTT.
    const rest = createHttpServer((request, response) => {
      response.socket?.destroy();
    });
    await new Promise<void>((resolve) => rest.listen(0, '127.0.0.1', resolve));
    cleanups.push(async () => {
      await new Promise<void>((resolve) => rest.close(() => resolve()));
    });
    const restPort = (rest.address() as AddressInfo).port;

    const localState = structuredClone(FREEKIOSK_STATE);
    localState.device.ip = '127.0.0.1';
    localState.wifi.ip = '127.0.0.1';
    const { server, received } = await setupMqttWorld({
      state: localState,
      deviceOverrides: {
        remoteApiUrl: `http://127.0.0.1:${restPort}`,
        remoteApiAutoPort: restPort,
      },
    });

    const response = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'volume-up' },
    });

    expect(response.statusCode).toBe(502);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(received).toEqual([]);
  });

  it('fails hardware commands fast when the device is offline and REST is unreachable', async () => {
    const { server } = await setupMqttWorld({ availability: 'offline' });

    // The retained state still records the last-known IP, so the controller tries
    // REST with the shortened offline timeout and reports the failure.
    const startedAt = Date.now();
    const response = await server.inject({
      method: 'POST',
      url: '/api/frames/lenovo/command',
      payload: { command: 'screen-on' },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('REMOTE_COMMAND_FAILED');
    expect(Date.now() - startedAt).toBeLessThan(6_000);
  });
});

describe('loadConfig MQTT options', () => {
  it('leaves MQTT off when no broker is configured', () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-mqtt-config-'));
    tempDirs.push(dir);
    const config = loadConfig({
      DATA_DIR: dir,
      LOCAL_PUBLIC_CONTROLLER_URL: 'http://10.0.0.10:18082',
      LOCAL_PUBLIC_KIOSK_URL: 'http://10.0.0.10:3000',
      MQTT_BROKER_URL: '',
    });
    expect(config.mqtt).toBeUndefined();
  });

  it('normalizes a bare broker host and applies defaults', () => {
    const dir = mkdtempSync(join(tmpdir(), 'immich-frame-mqtt-config-'));
    tempDirs.push(dir);
    const config = loadConfig({
      DATA_DIR: dir,
      LOCAL_PUBLIC_CONTROLLER_URL: 'http://10.0.0.10:18082',
      LOCAL_PUBLIC_KIOSK_URL: 'http://10.0.0.10:3000',
      MQTT_BROKER_URL: '192.168.1.10',
      MQTT_USERNAME: 'frame',
      MQTT_PASSWORD: 'secret',
    });
    expect(config.mqtt).toMatchObject({
      brokerUrl: 'mqtt://192.168.1.10',
      username: 'frame',
      password: 'secret',
      baseTopic: 'freekiosk',
    });
  });
});
