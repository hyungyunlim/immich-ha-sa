import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ControllerAuthManager } from './auth.js';
import type { AppConfig } from './config.js';
import { FrameEventHub } from './events.js';
import { renderFramePage } from './framePage.js';
import { fail, ok, requestContext } from './http.js';
import { ImmichClient } from './immichClient.js';
import { buildRendererUrl } from './rendererUrl.js';
import { renderSetupBlockedPage, renderSetupPage } from './setupPage.js';
import { JsonStore } from './store.js';
import type { AlbumCache, FrameState } from './types.js';

const FrameStatePatchSchema = z.object({
  activeAlbumIds: z.array(z.string().min(1)).optional(),
  activeProfileId: z.string().min(1).optional().nullable(),
  durationSeconds: z.number().int().min(5).max(3600).optional(),
  imageFit: z.enum(['contain', 'cover', 'none']).optional(),
  showTime: z.boolean().optional(),
  showDate: z.boolean().optional(),
  showWeather: z.boolean().optional(),
  albumOrder: z.enum(['random', 'newest', 'oldest']).optional(),
  networkMode: z.enum(['auto', 'local', 'external']).optional(),
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
  albumOrder: z.enum(['random', 'newest', 'oldest']),
  preferredNetworkMode: z.enum(['auto', 'local', 'external']),
});

const PairingTokenSchema = z.object({
  pairingCode: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
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
      }])),
      auth: auth.status(),
    });
  });

  app.get('/setup', async (request, reply) => {
    const device = store.getDevice(deps.config.defaultDevice.id) ?? deps.config.defaultDevice;
    if (isExternalSetupRequest(device.externalControllerBaseUrl, request)) {
      reply.status(403).type('text/html; charset=utf-8').send(renderSetupBlockedPage());
      return;
    }
    const pairing = auth.ensurePairingCode();
    reply.type('text/html; charset=utf-8').send(renderSetupPage({
      controllerUrl: controllerUrlForRequest(request, device.localControllerBaseUrl),
      deviceId: device.id,
      pairingCode: pairing.code,
      expiresAt: pairing.expiresAt,
    }));
  });

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

  app.get('/frame/:deviceId', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const device = store.getDevice(deviceId);
    if (!device) {
      reply.status(404).send('Unknown frame');
      return;
    }
    reply.type('text/html; charset=utf-8').send(renderFramePage(device));
  });

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
    const resolved = buildRendererUrl(device, updated, requestContext(request), {
      kioskPassword: deps.config.kioskPassword,
    });
    store.updateFrameState(deviceId, (state) => ({
      ...state,
      lastKnownGoodRendererUrl: resolved.rendererUrl,
    }));
    events.emitState(deviceId, store.getFrameState(deviceId) ?? updated);
    return ok(resolved, { version: resolved.version, updatedAt: resolved.updatedAt });
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
      albumOrder: profile.albumOrder,
      networkMode: profile.preferredNetworkMode,
    }));
    const resolved = buildRendererUrl(device, updated, requestContext(request), {
      kioskPassword: deps.config.kioskPassword,
    });
    store.updateFrameState(deviceId, (state) => ({
      ...state,
      lastKnownGoodRendererUrl: resolved.rendererUrl,
    }));
    events.emitState(deviceId, store.getFrameState(deviceId) ?? updated);
    return ok(resolved, { version: resolved.version, updatedAt: resolved.updatedAt });
  });

  function resolveFrameForRequest(deviceId: string, request: Parameters<typeof requestContext>[0]) {
    const device = store.getDevice(deviceId);
    const state = store.getFrameState(deviceId);
    if (!device || !state) return null;
    try {
      return buildRendererUrl(device, state, requestContext(request), {
        kioskPassword: deps.config.kioskPassword,
      });
    } catch (error) {
      if (!state.lastKnownGoodRendererUrl) throw error;
      return {
        ...state,
        resolvedNetworkMode: 'local' as const,
        rendererUrl: state.lastKnownGoodRendererUrl,
      };
    }
  }

  return app;
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

function validateAlbumIds(albumIds: string[] | undefined, cache: AlbumCache): string | undefined {
  if (!albumIds || albumIds.length === 0 || cache.items.length === 0) return undefined;
  const known = new Set(cache.items.map((album) => album.id));
  const missing = albumIds.filter((albumId) => !known.has(albumId));
  return missing.length > 0 ? `Unknown album ids: ${missing.join(', ')}` : undefined;
}
