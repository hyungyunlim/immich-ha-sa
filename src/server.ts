import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ControllerAuthManager } from './auth.js';
import type { AppConfig } from './config.js';
import { FrameEventHub } from './events.js';
import { renderFramePage } from './framePage.js';
import { fail, ok, requestContext } from './http.js';
import { ImmichClient } from './immichClient.js';
import { buildProxiedRendererUrl, buildRendererUrl, controllerBaseUrlForContext } from './rendererUrl.js';
import { renderSetupBlockedPage, renderSetupPage } from './setupPage.js';
import { JsonStore } from './store.js';
import type { AlbumCache, FrameCommand, FrameDevice, FrameState } from './types.js';

const FrameStatePatchSchema = z.object({
  activeAlbumIds: z.array(z.string().min(1)).optional(),
  activeProfileId: z.string().min(1).optional().nullable(),
  durationSeconds: z.number().int().min(5).max(3600).optional(),
  imageFit: z.enum(['contain', 'cover', 'none']).optional(),
  showTime: z.boolean().optional(),
  showDate: z.boolean().optional(),
  showWeather: z.boolean().optional(),
  showVideos: z.boolean().optional(),
  albumOrder: z.enum(['random', 'newest', 'oldest']).optional(),
  networkMode: z.enum(['auto', 'local', 'external']).optional(),
  transition: z.enum(['none', 'fade', 'cross-fade']).optional(),
  fadeTransitionDuration: z.number().min(0).max(20).optional(),
  crossFadeTransitionDuration: z.number().min(0).max(20).optional(),
  layout: z.enum(['single', 'portrait', 'landscape', 'splitview', 'splitview-landscape']).optional(),
  imageEffect: z.enum(['none', 'zoom', 'smart-zoom']).optional(),
  imageEffectAmount: z.number().int().min(100).max(1000).optional(),
  backgroundBlur: z.boolean().optional(),
  frameless: z.boolean().optional(),
  disableNavigation: z.boolean().optional(),
  hideCursor: z.boolean().optional(),
  showProgressBar: z.boolean().optional(),
  progressBarPosition: z.enum(['top', 'bottom']).optional(),
  burnInInterval: z.number().int().min(0).max(1440).optional(),
  burnInDuration: z.number().int().min(1).max(3600).optional(),
  burnInOpacity: z.number().int().min(0).max(100).optional(),
  sleepStart: z.string().max(4).optional(),
  sleepEnd: z.string().max(4).optional(),
  sleepIcon: z.boolean().optional(),
  sleepDimScreen: z.boolean().optional(),
  disableSleep: z.boolean().optional(),
});

const ProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  albumIds: z.array(z.string().min(1)),
  durationSeconds: z.number().int().min(5).max(3600),
  imageFit: z.enum(['contain', 'cover', 'none']),
  showTime: z.boolean(),
  showDate: z.boolean().default(false),
  showWeather: z.boolean(),
  showVideos: z.boolean().default(false),
  albumOrder: z.enum(['random', 'newest', 'oldest']),
  preferredNetworkMode: z.enum(['auto', 'local', 'external']),
  transition: z.enum(['none', 'fade', 'cross-fade']).default('none'),
  fadeTransitionDuration: z.number().min(0).max(20).default(1),
  crossFadeTransitionDuration: z.number().min(0).max(20).default(1),
  layout: z.enum(['single', 'portrait', 'landscape', 'splitview', 'splitview-landscape']).default('single'),
  imageEffect: z.enum(['none', 'zoom', 'smart-zoom']).default('none'),
  imageEffectAmount: z.number().int().min(100).max(1000).default(120),
  backgroundBlur: z.boolean().default(true),
  frameless: z.boolean().default(false),
  disableNavigation: z.boolean().default(false),
  hideCursor: z.boolean().default(true),
  showProgressBar: z.boolean().default(false),
  progressBarPosition: z.enum(['top', 'bottom']).default('top'),
  burnInInterval: z.number().int().min(0).max(1440).default(0),
  burnInDuration: z.number().int().min(1).max(3600).default(30),
  burnInOpacity: z.number().int().min(0).max(100).default(30),
  sleepStart: z.string().max(4).default(''),
  sleepEnd: z.string().max(4).default(''),
  sleepIcon: z.boolean().default(true),
  sleepDimScreen: z.boolean().default(false),
  disableSleep: z.boolean().default(false),
});

const PairingTokenSchema = z.object({
  pairingCode: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
});

const DeviceIdSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Use lowercase letters, numbers, hyphens, or underscores.'),
);

const DeviceNameSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z.string().min(1).max(80),
);

const OptionalUrlSchema = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().url().optional(),
);

const OptionalSecretSchema = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().optional(),
);

const RequiredUrlSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z.string().url(),
);

const DeviceCreateSchema = z.object({
  id: DeviceIdSchema,
  name: DeviceNameSchema,
  networkMode: z.enum(['auto', 'local', 'external']).default('auto'),
  localControllerBaseUrl: OptionalUrlSchema,
  externalControllerBaseUrl: OptionalUrlSchema,
  localKioskBaseUrl: OptionalUrlSchema,
  externalKioskBaseUrl: OptionalUrlSchema,
  pollIntervalSeconds: z.number().int().min(5).max(300).default(20),
  remoteControlType: z.enum(['none', 'freekiosk']).default('none'),
  remoteApiUrl: OptionalUrlSchema,
  remoteApiKey: OptionalSecretSchema,
});

const DevicePatchSchema = z.object({
  name: DeviceNameSchema.optional(),
  networkMode: z.enum(['auto', 'local', 'external']).optional(),
  localControllerBaseUrl: RequiredUrlSchema.optional(),
  externalControllerBaseUrl: OptionalUrlSchema,
  localKioskBaseUrl: RequiredUrlSchema.optional(),
  externalKioskBaseUrl: OptionalUrlSchema,
  pollIntervalSeconds: z.number().int().min(5).max(300).optional(),
  remoteControlType: z.enum(['none', 'freekiosk']).optional(),
  remoteApiUrl: OptionalUrlSchema,
  remoteApiKey: OptionalSecretSchema,
});

const FrameCommandSchema = z.object({
  command: z.enum(['next', 'previous', 'play-pause', 'reload', 'screen-on', 'screen-off', 'volume-up', 'volume-down']),
});

export interface ServerDeps {
  config: AppConfig;
  store?: JsonStore;
  immichClient?: ImmichClient;
  events?: FrameEventHub;
  auth?: ControllerAuthManager;
}

export function createServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization'],
    },
  });
  const store = deps.store ?? new JsonStore(deps.config.storePath, deps.config.defaultDevice);
  const immich = deps.immichClient ?? new ImmichClient({
    baseUrl: deps.config.immichInternalUrl,
    apiKey: deps.config.immichApiKey,
  });
  const events = deps.events ?? new FrameEventHub();
  const auth = deps.auth ?? new ControllerAuthManager(store, deps.config.controllerApiToken);

  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });

  setInterval(() => events.heartbeat(), 25000).unref();

  app.get('/api/health', async () => {
    const data = store.getData();
    const immichStatus = await immich.checkConnection();
    return ok({
      controller: { ok: true },
      immich: immichStatus,
      albumCache: {
        count: data.albumCache.items.length,
        stale: data.albumCache.stale,
        refreshedAt: data.albumCache.refreshedAt,
        lastError: data.albumCache.lastError,
      },
      frames: Object.fromEntries(Object.entries(data.frames).map(([id, state]) => [id, {
        version: state.version,
        updatedAt: state.updatedAt,
        networkMode: state.networkMode,
      }])),
      publicUrls: Object.fromEntries(Object.entries(data.devices).map(([id, device]) => [id, {
        localControllerBaseUrl: device.localControllerBaseUrl,
        externalControllerBaseUrl: device.externalControllerBaseUrl,
        localKioskBaseUrl: device.localKioskBaseUrl,
        externalKioskBaseUrl: device.externalKioskBaseUrl,
        remoteControlType: device.remoteControlType ?? 'none',
        remoteApiConfigured: Boolean(device.remoteApiUrl),
      }])),
      auth: auth.status(),
    });
  });

  const setupHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const device = store.getDevice(deps.config.defaultDevice.id) ?? deps.config.defaultDevice;
    if (isExternalSetupRequest(device.externalControllerBaseUrl, request)) {
      reply.status(403).type('text/html; charset=utf-8').send(renderSetupBlockedPage());
      return;
    }
    const pairing = auth.ensurePairingCode();
    const data = store.getData();
    reply.type('text/html; charset=utf-8').send(renderSetupPage({
      controllerUrl: device.localControllerBaseUrl,
      deviceId: device.id,
      pairingCode: pairing.code,
      expiresAt: pairing.expiresAt,
      albumCount: data.albumCache.items.length,
      albumRefreshedAt: data.albumCache.refreshedAt,
      devices: Object.values(data.devices).map((candidate) => {
        const frameState = store.getFrameState(candidate.id);
        const resolved = frameState ? resolveFrameForRequest(candidate.id, request) : null;
        return {
          id: candidate.id,
          name: candidate.name,
          localControllerBaseUrl: candidate.localControllerBaseUrl,
          externalControllerBaseUrl: candidate.externalControllerBaseUrl,
          localKioskBaseUrl: candidate.localKioskBaseUrl,
          externalKioskBaseUrl: candidate.externalKioskBaseUrl,
          deviceNetworkMode: candidate.networkMode,
          pollIntervalSeconds: candidate.pollIntervalSeconds,
          remoteControlType: candidate.remoteControlType ?? 'none',
          remoteApiUrl: candidate.remoteApiUrl,
          remoteApiKeyConfigured: Boolean(candidate.remoteApiKey),
          isDefault: candidate.id === deps.config.defaultDevice.id,
          localFrameUrl: buildFrameUrl(candidate.localControllerBaseUrl, candidate.id),
          externalFrameUrl: candidate.externalControllerBaseUrl
            ? buildFrameUrl(candidate.externalControllerBaseUrl, candidate.id)
            : undefined,
          rendererUrl: resolved?.rendererUrl,
          networkMode: frameState?.networkMode ?? candidate.networkMode,
          resolvedNetworkMode: resolved?.resolvedNetworkMode,
          durationSeconds: frameState?.durationSeconds,
          imageFit: frameState?.imageFit,
          albumOrder: frameState?.albumOrder,
          transition: frameState?.transition,
          layout: frameState?.layout,
          imageEffect: frameState?.imageEffect,
          backgroundBlur: frameState?.backgroundBlur,
          frameless: frameState?.frameless,
          disableNavigation: frameState?.disableNavigation,
          hideCursor: frameState?.hideCursor,
          showProgressBar: frameState?.showProgressBar,
          showVideos: frameState?.showVideos,
          progressBarPosition: frameState?.progressBarPosition,
          burnInInterval: frameState?.burnInInterval,
          burnInDuration: frameState?.burnInDuration,
          burnInOpacity: frameState?.burnInOpacity,
          sleepStart: frameState?.sleepStart ?? '',
          sleepEnd: frameState?.sleepEnd ?? '',
          disableSleep: frameState?.disableSleep ?? false,
        };
      }),
    }));
  };

  app.get('/', setupHandler);
  app.get('//', setupHandler);
  app.get('/setup', setupHandler);
  app.get('//setup', setupHandler);

  app.get('/api/pairing/status', async () => ok(auth.status()));

  app.post('/api/pairing/token', async (request, reply) => {
    const parsed = PairingTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid pairing request.'));
      return;
    }
    const paired = auth.completePairing(parsed.data.pairingCode, parsed.data.name);
    if (!paired) {
      reply.status(401).send(fail('PAIRING_FAILED', 'Invalid or expired pairing code.'));
      return;
    }
    return ok(paired);
  });

  app.get('/api/devices', async (request, reply) => {
    if (!requireLocalConsoleAccess(request, reply)) return;
    const data = store.getData();
    return ok({
      items: Object.values(data.devices).map((device) => ({
        ...publicDevice(device),
        frameUrl: buildFrameUrl(device.localControllerBaseUrl, device.id),
        localFrameUrl: buildFrameUrl(device.localControllerBaseUrl, device.id),
        externalFrameUrl: device.externalControllerBaseUrl
          ? buildFrameUrl(device.externalControllerBaseUrl, device.id)
          : undefined,
        hasState: Boolean(data.frames[device.id]),
        isDefault: device.id === deps.config.defaultDevice.id,
      })),
    });
  });

  app.post('/api/devices', async (request, reply) => {
    if (!requireLocalConsoleAccess(request, reply)) return;
    const parsed = DeviceCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid device.'));
      return;
    }
    const device = createDeviceFromInput(parsed.data, deps.config.defaultDevice);
    const created = store.createDevice(device);
    if (!created) {
      reply.status(409).send(fail('DEVICE_EXISTS', `Device already exists: ${device.id}`));
      return;
    }
    return ok({
      device: publicDevice(created),
      state: store.getFrameState(created.id),
      frameUrl: buildFrameUrl(created.localControllerBaseUrl, created.id),
      localFrameUrl: buildFrameUrl(created.localControllerBaseUrl, created.id),
      externalFrameUrl: created.externalControllerBaseUrl
        ? buildFrameUrl(created.externalControllerBaseUrl, created.id)
        : undefined,
    });
  });

  app.patch('/api/devices/:deviceId', async (request, reply) => {
    if (!requireLocalConsoleAccess(request, reply)) return;
    const { deviceId } = request.params as { deviceId: string };
    const parsedDeviceId = DeviceIdSchema.safeParse(deviceId);
    if (!parsedDeviceId.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsedDeviceId.error.errors[0]?.message ?? 'Invalid device id.'));
      return;
    }
    const parsed = DevicePatchSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid device.'));
      return;
    }
    const updated = store.updateDevice(parsedDeviceId.data, normalizeDevicePatch(parsed.data));
    if (!updated) {
      reply.status(404).send(fail('DEVICE_NOT_FOUND', `Device not found: ${parsedDeviceId.data}`));
      return;
    }
    const state = store.getFrameState(updated.id);
    if (state) {
      events.emitState(updated.id, state, updated);
    }
    return ok({
      device: publicDevice(updated),
      state,
      frameUrl: buildFrameUrl(updated.localControllerBaseUrl, updated.id),
      localFrameUrl: buildFrameUrl(updated.localControllerBaseUrl, updated.id),
      externalFrameUrl: updated.externalControllerBaseUrl
        ? buildFrameUrl(updated.externalControllerBaseUrl, updated.id)
        : undefined,
    });
  });

  app.delete('/api/devices/:deviceId', async (request, reply) => {
    if (!requireLocalConsoleAccess(request, reply)) return;
    const { deviceId } = request.params as { deviceId: string };
    const parsedDeviceId = DeviceIdSchema.safeParse(deviceId);
    if (!parsedDeviceId.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsedDeviceId.error.errors[0]?.message ?? 'Invalid device id.'));
      return;
    }
    if (parsedDeviceId.data === deps.config.defaultDevice.id) {
      reply.status(400).send(fail('DEFAULT_DEVICE', 'The default device cannot be deleted.'));
      return;
    }
    if (!store.deleteDevice(parsedDeviceId.data)) {
      reply.status(404).send(fail('DEVICE_NOT_FOUND', `Device not found: ${parsedDeviceId.data}`));
      return;
    }
    return ok({ deleted: true, deviceId: parsedDeviceId.data });
  });

  app.get('/frame/:deviceId', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const device = store.getDevice(deviceId);
    if (!device) {
      reply.status(404).send('Unknown frame');
      return;
    }
    reply.type('text/html; charset=utf-8').send(renderFramePage(device));
  });

  app.all('/kiosk-proxy/:deviceId', proxyKioskRequest);
  app.all('/kiosk-proxy/:deviceId/*', proxyKioskRequest);

  app.get('/api/frame/:deviceId/state', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const resolved = resolveFrameForRequest(deviceId, request);
    if (!resolved) {
      reply.status(404).send(fail('FRAME_NOT_FOUND', `Frame not found: ${deviceId}`));
      return;
    }
    return ok(resolved, { version: resolved.version, updatedAt: resolved.updatedAt });
  });

  app.put('/api/frame/:deviceId/state', async (request, reply) => {
    if (!auth.requireMutationAuth(request, reply)) return;
    const { deviceId } = request.params as { deviceId: string };
    const parsed = FrameStatePatchSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid frame state.'));
      return;
    }
    const current = store.getFrameState(deviceId);
    const device = store.getDevice(deviceId);
    if (!current || !device) {
      reply.status(404).send(fail('FRAME_NOT_FOUND', `Frame not found: ${deviceId}`));
      return;
    }

    const validationError = validateAlbumIds(parsed.data.activeAlbumIds, store.getAlbumCache());
    if (validationError) {
      reply.status(400).send(fail('ALBUM_NOT_FOUND', validationError));
      return;
    }

    const updated = store.updateFrameState(deviceId, (state) => bumpState({
      ...state,
      ...stripNullProfile(parsed.data),
    }));
    const direct = buildRendererUrl(device, { ...updated, networkMode: 'local' }, undefined, {
      kioskPassword: deps.config.kioskPassword,
    });
    store.updateFrameState(deviceId, (state) => ({
      ...state,
      lastKnownGoodRendererUrl: direct.rendererUrl,
    }));
    events.emitState(deviceId, store.getFrameState(deviceId) ?? updated);
    const resolved = resolveFrameForRequest(deviceId, request);
    if (!resolved) {
      reply.status(404).send(fail('FRAME_NOT_FOUND', `Frame not found: ${deviceId}`));
      return;
    }
    return ok(resolved, { version: resolved.version, updatedAt: resolved.updatedAt });
  });

  app.post('/api/frames/:deviceId/command', async (request, reply) => {
    if (!auth.requireMutationAuth(request, reply)) return;
    const { deviceId } = request.params as { deviceId: string };
    const parsed = FrameCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid frame command.'));
      return;
    }
    const device = store.getDevice(deviceId);
    if (!device) {
      reply.status(404).send(fail('FRAME_NOT_FOUND', `Frame not found: ${deviceId}`));
      return;
    }
    if (commandUsesFrameEvents(parsed.data.command)) {
      const delivered = events.emitCommand(deviceId, {
        command: parsed.data.command,
        issuedAt: new Date().toISOString(),
      });
      return ok({
        command: parsed.data.command,
        frameEvent: {
          delivered,
        },
      });
    }
    try {
      const result = await sendRemoteCommand(device, parsed.data.command);
      return ok(result);
    } catch (error) {
      const remoteError = error instanceof RemoteCommandError
        ? error
        : new RemoteCommandError('REMOTE_COMMAND_FAILED', error instanceof Error ? error.message : String(error));
      reply.status(remoteError.statusCode).send(fail(remoteError.code, remoteError.message));
    }
  });

  app.get('/api/frame/:deviceId/events', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const device = store.getDevice(deviceId);
    const state = store.getFrameState(deviceId);
    if (!device || !state) {
      reply.status(404).send(fail('FRAME_NOT_FOUND', `Frame not found: ${deviceId}`));
      return;
    }
    events.subscribe(deviceId, {
      reply,
      device,
      context: requestContext(request),
      kioskPassword: deps.config.kioskPassword,
    }, state);
    return reply;
  });

  app.get('/api/immich/albums', async () => {
    const cache = store.getAlbumCache();
    return ok(cache, {
      refreshedAt: cache.refreshedAt,
      stale: cache.stale,
    });
  });

  app.post('/api/immich/albums/refresh', async (request, reply) => {
    if (!auth.requireMutationAuth(request, reply)) return;
    try {
      const items = await immich.listAlbums();
      const cache: AlbumCache = {
        items,
        refreshedAt: new Date().toISOString(),
        stale: false,
      };
      store.setAlbumCache(cache);
      return ok(cache, { refreshedAt: cache.refreshedAt, stale: false });
    } catch (error) {
      const current = store.getAlbumCache();
      const cache: AlbumCache = {
        ...current,
        stale: true,
        lastError: error instanceof Error ? error.message : String(error),
      };
      store.setAlbumCache(cache);
      reply.status(502).send(fail('IMMICH_REFRESH_FAILED', cache.lastError ?? 'Failed to refresh Immich albums.'));
    }
  });

  app.get('/api/profiles', async () => ok({ items: store.getProfiles() }));

  app.put('/api/profiles/:profileId', async (request, reply) => {
    if (!auth.requireMutationAuth(request, reply)) return;
    const { profileId } = request.params as { profileId: string };
    const parsed = ProfileSchema.safeParse({ ...(request.body as object), id: profileId });
    if (!parsed.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid profile.'));
      return;
    }
    const validationError = validateAlbumIds(parsed.data.albumIds, store.getAlbumCache());
    if (validationError) {
      reply.status(400).send(fail('ALBUM_NOT_FOUND', validationError));
      return;
    }
    return ok(store.upsertProfile(parsed.data));
  });

  app.post('/api/frames/:deviceId/apply-profile', async (request, reply) => {
    if (!auth.requireMutationAuth(request, reply)) return;
    const { deviceId } = request.params as { deviceId: string };
    const parsed = z.object({ profileId: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid profile request.'));
      return;
    }
    const profile = store.getProfile(parsed.data.profileId);
    const device = store.getDevice(deviceId);
    if (!profile) {
      reply.status(404).send(fail('PROFILE_NOT_FOUND', `Profile not found: ${parsed.data.profileId}`));
      return;
    }
    if (!device) {
      reply.status(404).send(fail('FRAME_NOT_FOUND', `Frame not found: ${deviceId}`));
      return;
    }
    const updated = store.updateFrameState(deviceId, (state) => bumpState({
      ...state,
      activeAlbumIds: profile.albumIds,
      activeProfileId: profile.id,
      durationSeconds: profile.durationSeconds,
      imageFit: profile.imageFit,
      showTime: profile.showTime,
      showDate: profile.showDate,
      showWeather: profile.showWeather,
      showVideos: profile.showVideos,
      albumOrder: profile.albumOrder,
      networkMode: profile.preferredNetworkMode,
      transition: profile.transition,
      fadeTransitionDuration: profile.fadeTransitionDuration,
      crossFadeTransitionDuration: profile.crossFadeTransitionDuration,
      layout: profile.layout,
      imageEffect: profile.imageEffect,
      imageEffectAmount: profile.imageEffectAmount,
      backgroundBlur: profile.backgroundBlur,
      frameless: profile.frameless,
      disableNavigation: profile.disableNavigation,
      hideCursor: profile.hideCursor,
      showProgressBar: profile.showProgressBar,
      progressBarPosition: profile.progressBarPosition,
      burnInInterval: profile.burnInInterval,
      burnInDuration: profile.burnInDuration,
      burnInOpacity: profile.burnInOpacity,
      sleepStart: profile.sleepStart,
      sleepEnd: profile.sleepEnd,
      sleepIcon: profile.sleepIcon,
      sleepDimScreen: profile.sleepDimScreen,
      disableSleep: profile.disableSleep,
    }));
    const direct = buildRendererUrl(device, { ...updated, networkMode: 'local' }, undefined, {
      kioskPassword: deps.config.kioskPassword,
    });
    store.updateFrameState(deviceId, (state) => ({
      ...state,
      lastKnownGoodRendererUrl: direct.rendererUrl,
    }));
    events.emitState(deviceId, store.getFrameState(deviceId) ?? updated);
    const resolved = resolveFrameForRequest(deviceId, request);
    if (!resolved) {
      reply.status(404).send(fail('FRAME_NOT_FOUND', `Frame not found: ${deviceId}`));
      return;
    }
    return ok(resolved, { version: resolved.version, updatedAt: resolved.updatedAt });
  });

  function requireLocalConsoleAccess(request: FastifyRequest, reply: FastifyReply): boolean {
    const device = store.getDevice(deps.config.defaultDevice.id) ?? deps.config.defaultDevice;
    if (!isExternalSetupRequest(device.externalControllerBaseUrl, request)) return true;
    reply.status(403).send(fail('CONSOLE_FORBIDDEN', 'Device management is only available from the local console.'));
    return false;
  }

  function resolveFrameForRequest(deviceId: string, request: Parameters<typeof requestContext>[0]) {
    const device = store.getDevice(deviceId);
    const state = store.getFrameState(deviceId);
    if (!device || !state) return null;
    try {
      const context = requestContext(request);
      return buildProxiedRendererUrl(device, state, context, {
        kioskPassword: deps.config.kioskPassword,
        controllerBaseUrl: controllerBaseUrlForContext(context, device.localControllerBaseUrl),
      });
    } catch (error) {
      if (!state.lastKnownGoodRendererUrl) throw error;
      return {
        ...state,
        resolvedNetworkMode: 'local' as const,
        rendererUrl: toControllerProxyUrl(device, state.lastKnownGoodRendererUrl, request),
      };
    }
  }

  async function proxyKioskRequest(request: FastifyRequest, reply: FastifyReply) {
    const { deviceId } = request.params as { deviceId: string };
    const device = store.getDevice(deviceId);
    if (!device) {
      reply.status(404).send(fail('FRAME_NOT_FOUND', `Frame not found: ${deviceId}`));
      return;
    }

    const incomingUrl = new URL(request.url, 'http://controller.local');
    const proxyPrefix = `/kiosk-proxy/${encodeURIComponent(device.id)}`;
    const targetPath = incomingUrl.pathname.startsWith(proxyPrefix)
      ? incomingUrl.pathname.slice(proxyPrefix.length) || '/'
      : '/';
    const targetUrl = new URL(`${targetPath}${incomingUrl.search}`, `${device.localKioskBaseUrl.replace(/\/+$/, '')}/`);

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: proxyRequestHeaders(request),
        body: proxyRequestBody(request),
        signal: AbortSignal.timeout(15000),
      });
      const contentType = response.headers.get('content-type') ?? '';
      const body = Buffer.from(await response.arrayBuffer());

      reply.status(response.status);
      forwardProxyHeaders(response, reply);
      if (isTextResponse(contentType)) {
        reply.type(contentType || 'text/plain; charset=utf-8').send(rewriteProxyText(body.toString('utf8'), proxyPrefix, contentType));
        return;
      }
      if (contentType) reply.type(contentType);
      reply.send(body);
    } catch (error) {
      reply.status(502).send(fail('KIOSK_PROXY_FAILED', error instanceof Error ? error.message : String(error)));
    }
  }

  return app;
}

class RemoteCommandError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 502,
  ) {
    super(message);
  }
}

async function sendRemoteCommand(
  device: FrameDevice,
  command: FrameCommand,
): Promise<{
  provider: 'freekiosk';
  command: FrameCommand;
  endpoint: string;
  statusCode: number;
  result: unknown;
}> {
  if ((device.remoteControlType ?? 'none') !== 'freekiosk') {
    throw new RemoteCommandError('REMOTE_NOT_CONFIGURED', `Frame ${device.id} is not configured for FreeKiosk remote control.`, 400);
  }
  if (!device.remoteApiUrl) {
    throw new RemoteCommandError('REMOTE_NOT_CONFIGURED', `Frame ${device.id} is missing remoteApiUrl.`, 400);
  }

  const endpoint = freeKioskEndpoint(command);
  const url = `${trimTrailingSlash(device.remoteApiUrl)}${endpoint}`;
  const headers: Record<string, string> = {};
  if (device.remoteApiKey) {
    headers['X-Api-Key'] = device.remoteApiKey;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(7000),
  });
  const text = await response.text();
  const payload = parseJsonOrText(text);

  if (!response.ok || (isRecord(payload) && payload.success === false)) {
    const message = isRecord(payload) && isRecord(payload.error)
      ? String(payload.error.message ?? 'FreeKiosk command failed.')
      : `FreeKiosk command failed with HTTP ${response.status}.`;
    throw new RemoteCommandError('REMOTE_COMMAND_FAILED', message, 502);
  }

  return {
    provider: 'freekiosk',
    command,
    endpoint,
    statusCode: response.status,
    result: isRecord(payload) && 'data' in payload ? payload.data : payload,
  };
}

function freeKioskEndpoint(command: FrameCommand): string {
  switch (command) {
    case 'next':
      return '/api/remote/right';
    case 'previous':
      return '/api/remote/left';
    case 'play-pause':
      return '/api/remote/playpause';
    case 'reload':
      return '/api/reload';
    case 'screen-on':
      return '/api/screen/on';
    case 'screen-off':
      return '/api/screen/off';
    case 'volume-up':
      return '/api/remote/keyboard/volumeup';
    case 'volume-down':
      return '/api/remote/keyboard/volumedown';
  }
}

function commandUsesFrameEvents(command: FrameCommand): boolean {
  return command === 'next' || command === 'previous' || command === 'play-pause' || command === 'reload';
}

function parseJsonOrText(value: string): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function proxyRequestHeaders(request: FastifyRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value || shouldSkipProxyRequestHeader(key)) continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return headers;
}

function shouldSkipProxyRequestHeader(header: string): boolean {
  return ['host', 'connection', 'content-length', 'accept-encoding'].includes(header.toLowerCase());
}

function proxyRequestBody(request: FastifyRequest): BodyInit | undefined {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const body = request.body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (typeof body === 'string') return body;
  if (body === undefined || body === null) return undefined;
  return JSON.stringify(body);
}

function forwardProxyHeaders(response: Response, reply: FastifyReply): void {
  for (const header of [
    'accept-ranges',
    'cache-control',
    'content-disposition',
    'content-range',
    'etag',
    'expires',
    'last-modified',
    'set-cookie',
    'vary',
  ]) {
    const value = response.headers.get(header);
    if (value) reply.header(header, value);
  }
}

function isTextResponse(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return normalized.startsWith('text/')
    || normalized.includes('application/javascript')
    || normalized.includes('application/json')
    || normalized.includes('application/xhtml+xml')
    || normalized.includes('image/svg+xml');
}

function rewriteProxyText(value: string, proxyPrefix: string, contentType: string): string {
  const normalizedPrefix = proxyPrefix.replace(/\/+$/, '');
  const normalizedContentType = contentType.toLowerCase();
  if (normalizedContentType.includes('javascript')) {
    return value.replace(/(["'`])\/(assets)(?=[/"'`?])/g, `$1${normalizedPrefix}/$2`);
  }
  if (normalizedContentType.startsWith('text/css')) {
    return value.replace(/url\((["']?)\/(?!\/|kiosk-proxy\/)/g, `url($1${normalizedPrefix}/`);
  }
  return value
    .replace(/\b(href|src|action|poster|manifest|hx-get|hx-post|hx-put|hx-patch|hx-delete)=("|')\/(?!\/|kiosk-proxy\/)/g, `$1=$2${normalizedPrefix}/`)
    .replace(/url\((["']?)\/(?!\/|kiosk-proxy\/)/g, `url($1${normalizedPrefix}/`);
}

function toControllerProxyUrl(
  device: FrameDevice,
  rendererUrl: string,
  request: Parameters<typeof requestContext>[0],
): string {
  const source = new URL(rendererUrl);
  const context = requestContext(request);
  const controllerBaseUrl = controllerBaseUrlForContext(context, device.localControllerBaseUrl);
  const proxy = new URL(`/kiosk-proxy/${encodeURIComponent(device.id)}${source.pathname}`, `${controllerBaseUrl}/`);
  proxy.search = source.search;
  proxy.hash = source.hash;
  return proxy.toString();
}

function publicDevice(device: FrameDevice): Omit<FrameDevice, 'remoteApiKey'> & { remoteApiKeyConfigured: boolean } {
  const { remoteApiKey: _remoteApiKey, ...publicFields } = device;
  return {
    ...publicFields,
    remoteControlType: publicFields.remoteControlType ?? 'none',
    remoteApiKeyConfigured: Boolean(_remoteApiKey),
  };
}

function controllerUrlForRequest(request: Parameters<typeof requestContext>[0], fallback: string): string {
  const context = requestContext(request);
  if (!context.host) return fallback;
  return `${context.protocol ?? 'http'}://${context.host}`.replace(/\/+$/, '');
}

function isExternalSetupRequest(externalControllerBaseUrl: string | undefined, request: Parameters<typeof requestContext>[0]): boolean {
  if (!externalControllerBaseUrl) return false;
  const context = requestContext(request);
  if (!context.host) return false;
  try {
    const externalHostname = new URL(externalControllerBaseUrl).hostname.toLowerCase();
    const requestHostname = context.host.split(':')[0]?.toLowerCase();
    return externalHostname === requestHostname;
  } catch {
    return false;
  }
}

function bumpState(state: FrameState): FrameState {
  return {
    ...state,
    version: state.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

function stripNullProfile(patch: z.infer<typeof FrameStatePatchSchema>): Partial<FrameState> {
  if (patch.activeProfileId === null) {
    const { activeProfileId: _activeProfileId, ...rest } = patch;
    return {
      ...rest,
      activeProfileId: undefined,
    };
  }
  return patch as Partial<FrameState>;
}

function createDeviceFromInput(
  input: z.infer<typeof DeviceCreateSchema>,
  defaultDevice: FrameDevice,
): FrameDevice {
  return {
    ...defaultDevice,
    id: input.id,
    name: input.name,
    networkMode: input.networkMode,
    localControllerBaseUrl: trimTrailingSlash(input.localControllerBaseUrl ?? defaultDevice.localControllerBaseUrl),
    externalControllerBaseUrl: input.externalControllerBaseUrl
      ? trimTrailingSlash(input.externalControllerBaseUrl)
      : defaultDevice.externalControllerBaseUrl,
    localKioskBaseUrl: trimTrailingSlash(input.localKioskBaseUrl ?? defaultDevice.localKioskBaseUrl),
    externalKioskBaseUrl: input.externalKioskBaseUrl
      ? trimTrailingSlash(input.externalKioskBaseUrl)
      : defaultDevice.externalKioskBaseUrl,
    pollIntervalSeconds: input.pollIntervalSeconds,
    remoteControlType: input.remoteControlType,
    remoteApiUrl: input.remoteApiUrl ? trimTrailingSlash(input.remoteApiUrl) : undefined,
    remoteApiKey: input.remoteApiKey,
  };
}

function normalizeDevicePatch(input: z.infer<typeof DevicePatchSchema>): Partial<FrameDevice> {
  const patch: Partial<FrameDevice> = {};

  if (hasPatchKey(input, 'name')) patch.name = input.name;
  if (hasPatchKey(input, 'networkMode')) patch.networkMode = input.networkMode;
  if (hasPatchKey(input, 'localControllerBaseUrl')) {
    patch.localControllerBaseUrl = input.localControllerBaseUrl
      ? trimTrailingSlash(input.localControllerBaseUrl)
      : input.localControllerBaseUrl;
  }
  if (hasPatchKey(input, 'externalControllerBaseUrl')) {
    patch.externalControllerBaseUrl = input.externalControllerBaseUrl
      ? trimTrailingSlash(input.externalControllerBaseUrl)
      : input.externalControllerBaseUrl;
  }
  if (hasPatchKey(input, 'localKioskBaseUrl')) {
    patch.localKioskBaseUrl = input.localKioskBaseUrl
      ? trimTrailingSlash(input.localKioskBaseUrl)
      : input.localKioskBaseUrl;
  }
  if (hasPatchKey(input, 'externalKioskBaseUrl')) {
    patch.externalKioskBaseUrl = input.externalKioskBaseUrl
      ? trimTrailingSlash(input.externalKioskBaseUrl)
      : input.externalKioskBaseUrl;
  }
  if (hasPatchKey(input, 'pollIntervalSeconds')) patch.pollIntervalSeconds = input.pollIntervalSeconds;
  if (hasPatchKey(input, 'remoteControlType')) patch.remoteControlType = input.remoteControlType;
  if (hasPatchKey(input, 'remoteApiUrl')) {
    patch.remoteApiUrl = input.remoteApiUrl ? trimTrailingSlash(input.remoteApiUrl) : input.remoteApiUrl;
  }
  if (hasPatchKey(input, 'remoteApiKey')) patch.remoteApiKey = input.remoteApiKey;

  return patch;
}

function hasPatchKey(input: z.infer<typeof DevicePatchSchema>, key: keyof z.infer<typeof DevicePatchSchema>): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function buildFrameUrl(controllerBaseUrl: string, deviceId: string): string {
  return `${trimTrailingSlash(controllerBaseUrl)}/frame/${deviceId}`;
}

function validateAlbumIds(albumIds: string[] | undefined, cache: AlbumCache): string | undefined {
  if (!albumIds || albumIds.length === 0 || cache.items.length === 0) return undefined;
  const known = new Set(cache.items.map((album) => album.id));
  const missing = albumIds.filter((albumId) => !known.has(albumId));
  return missing.length > 0 ? `Unknown album ids: ${missing.join(', ')}` : undefined;
}
