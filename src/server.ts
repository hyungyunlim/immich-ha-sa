import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ControllerAuthManager } from './auth.js';
import type { AppConfig } from './config.js';
import { FrameEventHub } from './events.js';
import { renderFrameClaimPage } from './frameClaimPage.js';
import { renderFramePage } from './framePage.js';
import { fail, ok, requestContext } from './http.js';
import { ImmichClient } from './immichClient.js';
import { buildProxiedRendererUrl, buildRendererUrl, controllerBaseUrlForContext } from './rendererUrl.js';
import { renderSetupBlockedPage, renderSetupPage } from './setupPage.js';
import { JsonStore } from './store.js';
import type { AlbumCache, FrameClaim, FrameCommand, FrameDevice, FrameState, PersonCache } from './types.js';

const REMOTE_DISCOVERY_RETRY_MS = 30_000;
const REMOTE_DISCOVERY_TIMEOUT_MS = 1_500;
const REMOTE_BRIGHTNESS_RESTORE_DELAY_MS = 500;

const FrameStatePatchSchema = z.object({
  activeAlbumIds: z.array(z.string().min(1)).optional(),
  activePersonIds: z.array(z.string().min(1)).optional(),
  requireAllPeople: z.boolean().optional(),
  activeProfileId: z.string().min(1).optional().nullable(),
  durationSeconds: z.number().int().min(5).max(3600).optional(),
  imageFit: z.enum(['contain', 'cover', 'none']).optional(),
  showTime: z.boolean().optional(),
  timeFormat: z.enum(['12', '24']).optional(),
  showAmPm: z.boolean().optional(),
  showSeconds: z.boolean().optional(),
  showDate: z.boolean().optional(),
  dateFormat: z.string().min(1).max(64).optional(),
  clockSource: z.enum(['client', 'server']).optional(),
  showWeather: z.boolean().optional(),
  weatherLocation: z.string().max(80).optional(),
  weatherRotationInterval: z.number().int().min(10).max(3600).optional(),
  showVideos: z.boolean().optional(),
  kioskVideoMuted: z.boolean().optional(),
  excludeVideosOver: z.number().int().min(0).max(86400).optional(),
  showArchived: z.boolean().optional(),
  filterDate: z.string().max(128).optional(),
  filterNewest: z.number().int().min(0).max(50000).optional(),
  upArrowAction: z.enum(['none', 'mute', 'redirects', 'pause', 'more-info', 'fullscreen']).optional(),
  downArrowAction: z.enum(['none', 'mute', 'redirects', 'pause', 'more-info', 'fullscreen']).optional(),
  albumOrder: z.enum(['random', 'newest', 'oldest']).optional(),
  networkMode: z.enum(['auto', 'local', 'external']).optional(),
  transition: z.enum(['none', 'fade', 'cross-fade']).optional(),
  fadeTransitionDuration: z.number().min(0).max(20).optional(),
  crossFadeTransitionDuration: z.number().min(0).max(20).optional(),
  layout: z.enum(['single', 'portrait', 'landscape', 'splitview', 'splitview-landscape']).optional(),
  imageEffect: z.enum(['none', 'zoom', 'smart-zoom']).optional(),
  imageEffectAmount: z.number().int().min(100).max(1000).optional(),
  backgroundBlur: z.boolean().optional(),
  backgroundBlurAmount: z.number().int().min(0).max(100).optional(),
  fontSize: z.number().int().min(50).max(250).optional(),
  frameless: z.boolean().optional(),
  disableNavigation: z.boolean().optional(),
  hideCursor: z.boolean().optional(),
  showProgressBar: z.boolean().optional(),
  progressBarPosition: z.enum(['top', 'bottom']).optional(),
  showImageRating: z.boolean().optional(),
  showOwner: z.boolean().optional(),
  showAlbumName: z.boolean().optional(),
  showPersonName: z.boolean().optional(),
  showPersonAge: z.boolean().optional(),
  showImageTime: z.boolean().optional(),
  imageTimeFormat: z.enum(['12', '24']).optional(),
  showImageDate: z.boolean().optional(),
  imageDateFormat: z.string().min(1).max(64).optional(),
  showImageDescription: z.boolean().optional(),
  imageDescriptionScrollDuration: z.number().min(10).max(240).optional(),
  imageDescriptionAreaHeight: z.number().min(3).max(12).optional(),
  imageDescriptionOverlayOpacity: z.number().min(0).max(60).optional(),
  imageDescriptionLongThresholdLines: z.number().min(2).max(10).optional(),
  showImageCamera: z.boolean().optional(),
  showImageExif: z.boolean().optional(),
  showImageLocation: z.boolean().optional(),
  showImageQr: z.boolean().optional(),
  showImageId: z.boolean().optional(),
  showUser: z.boolean().optional(),
  showMoreInfo: z.boolean().optional(),
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
  personIds: z.array(z.string().min(1)).default([]),
  requireAllPeople: z.boolean().default(false),
  durationSeconds: z.number().int().min(5).max(3600),
  imageFit: z.enum(['contain', 'cover', 'none']),
  showTime: z.boolean(),
  timeFormat: z.enum(['12', '24']).default('24'),
  showAmPm: z.boolean().default(true),
  showSeconds: z.boolean().default(false),
  showDate: z.boolean().default(false),
  dateFormat: z.string().min(1).max(64).default('YYYY/MM/DD'),
  clockSource: z.enum(['client', 'server']).default('client'),
  showWeather: z.boolean(),
  weatherLocation: z.string().max(80).default(''),
  weatherRotationInterval: z.number().int().min(10).max(3600).default(60),
  showVideos: z.boolean().default(false),
  excludeVideosOver: z.number().int().min(0).max(86400).default(0),
  showArchived: z.boolean().default(false),
  filterDate: z.string().max(128).default(''),
  filterNewest: z.number().int().min(0).max(50000).default(0),
  albumOrder: z.enum(['random', 'newest', 'oldest']),
  preferredNetworkMode: z.enum(['auto', 'local', 'external']),
  transition: z.enum(['none', 'fade', 'cross-fade']).default('none'),
  fadeTransitionDuration: z.number().min(0).max(20).default(1),
  crossFadeTransitionDuration: z.number().min(0).max(20).default(1),
  layout: z.enum(['single', 'portrait', 'landscape', 'splitview', 'splitview-landscape']).default('single'),
  imageEffect: z.enum(['none', 'zoom', 'smart-zoom']).default('none'),
  imageEffectAmount: z.number().int().min(100).max(1000).default(120),
  backgroundBlur: z.boolean().default(true),
  backgroundBlurAmount: z.number().int().min(0).max(100).default(10),
  fontSize: z.number().int().min(50).max(250).default(100),
  frameless: z.boolean().default(false),
  disableNavigation: z.boolean().default(false),
  hideCursor: z.boolean().default(true),
  showProgressBar: z.boolean().default(false),
  progressBarPosition: z.enum(['top', 'bottom']).default('top'),
  showImageRating: z.boolean().default(false),
  showOwner: z.boolean().default(false),
  showAlbumName: z.boolean().default(false),
  showPersonName: z.boolean().default(false),
  showPersonAge: z.boolean().default(false),
  showImageTime: z.boolean().default(false),
  imageTimeFormat: z.enum(['12', '24']).default('24'),
  showImageDate: z.boolean().default(false),
  imageDateFormat: z.string().min(1).max(64).default('YYYY-MM-DD'),
  showImageDescription: z.boolean().default(false),
  imageDescriptionScrollDuration: z.number().min(10).max(240).default(52),
  imageDescriptionAreaHeight: z.number().min(3).max(12).default(5.75),
  imageDescriptionOverlayOpacity: z.number().min(0).max(60).default(10),
  imageDescriptionLongThresholdLines: z.number().min(2).max(10).default(3.25),
  showImageCamera: z.boolean().default(false),
  showImageExif: z.boolean().default(false),
  showImageLocation: z.boolean().default(false),
  showImageQr: z.boolean().default(false),
  showImageId: z.boolean().default(false),
  showUser: z.boolean().default(false),
  showMoreInfo: z.boolean().default(true),
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

const DeviceAliasSchema = z.preprocess(
  (value) => (typeof value === 'string' ? normalizeAlias(value) : value),
  z.string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers, and hyphens.'),
);

const OptionalDeviceAliasSchema = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return typeof value === 'string' ? normalizeAlias(value) : value;
  },
  DeviceAliasSchema.optional(),
);

const OptionalUrlSchema = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().url().optional(),
);

const OptionalSecretSchema = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().optional(),
);

const OptionalPatchSecretSchema = z.union([z.string().min(1), z.null()]).optional();

const RequiredUrlSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z.string().url(),
);

const DeviceCreateSchema = z.object({
  id: DeviceIdSchema,
  name: DeviceNameSchema,
  alias: OptionalDeviceAliasSchema,
  networkMode: z.enum(['auto', 'local', 'external']).default('auto'),
  previewOrientation: z.enum(['landscape', 'portrait']).default('landscape'),
  localControllerBaseUrl: OptionalUrlSchema,
  externalControllerBaseUrl: OptionalUrlSchema,
  localKioskBaseUrl: OptionalUrlSchema,
  externalKioskBaseUrl: OptionalUrlSchema,
  kioskPassword: OptionalSecretSchema,
  pollIntervalSeconds: z.number().int().min(5).max(300).default(20),
  remoteControlType: z.enum(['none', 'freekiosk']).default('none'),
  remoteApiUrl: OptionalUrlSchema,
  remoteApiAutoPort: z.number().int().min(1).max(65535).default(8080),
  remoteApiKey: OptionalSecretSchema,
});

const DevicePatchSchema = z.object({
  name: DeviceNameSchema.optional(),
  alias: OptionalDeviceAliasSchema.or(z.null()).optional(),
  networkMode: z.enum(['auto', 'local', 'external']).optional(),
  previewOrientation: z.enum(['landscape', 'portrait']).optional(),
  localControllerBaseUrl: RequiredUrlSchema.optional(),
  externalControllerBaseUrl: OptionalUrlSchema,
  localKioskBaseUrl: RequiredUrlSchema.optional(),
  externalKioskBaseUrl: OptionalUrlSchema,
  kioskPassword: OptionalPatchSecretSchema,
  pollIntervalSeconds: z.number().int().min(5).max(300).optional(),
  remoteControlType: z.enum(['none', 'freekiosk']).optional(),
  remoteApiUrl: OptionalUrlSchema,
  remoteApiAutoPort: z.number().int().min(1).max(65535).optional(),
  remoteApiKey: OptionalSecretSchema,
});

const FrameCommandSchema = z.object({
  command: z.enum(['next', 'previous', 'play-pause', 'reload', 'mute-toggle', 'screen-on', 'screen-off', 'volume-up', 'volume-down', 'device-mute-toggle', 'dpad-up']),
});

const RemoteLevelSchema = z.object({
  value: z.number().int().min(0).max(100),
});

const RemoteAutoBrightnessSchema = z.object({
  enabled: z.boolean(),
  min: z.number().int().min(0).max(100).optional(),
  max: z.number().int().min(0).max(100).optional(),
  offset: z.number().int().min(0).max(100).optional(),
});

const FrameClaimCodeSchema = z.preprocess(
  (value) => (typeof value === 'string' ? normalizeFrameClaimCode(value) : value),
  z.string().regex(/^\d{6}$/, 'Use the six-digit code shown on the frame.'),
);

const FrameClaimCreateSchema = z.object({
  name: DeviceNameSchema.default('New Frame'),
  alias: OptionalDeviceAliasSchema,
  previewOrientation: z.enum(['landscape', 'portrait']).default('landscape'),
  remoteControlType: z.enum(['none', 'freekiosk']).default('none'),
  remoteApiUrl: OptionalUrlSchema,
  remoteApiAutoPort: z.number().int().min(1).max(65535).default(8080),
  remoteApiKey: OptionalSecretSchema,
});

export interface ServerDeps {
  config: AppConfig;
  store?: JsonStore;
  immichClient?: ImmichClient;
  events?: FrameEventHub;
  auth?: ControllerAuthManager;
  kioskConnectionChecker?: typeof checkKioskConnection;
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
  const remoteDiscoveryAttempts = new Map<string, number>();
  const remoteDiscoveryInFlight = new Set<string>();
  let albumRefreshInFlight: Promise<AlbumCache> | undefined;
  let personRefreshInFlight: Promise<PersonCache> | undefined;

  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });

  setInterval(() => events.heartbeat(), 25000).unref();
  const albumRefreshIntervalSeconds = deps.config.albumRefreshIntervalSeconds ?? 0;
  const runAutomaticMediaRefresh = () => {
    void refreshAlbumCache('automatic').catch((error) => {
      markAlbumRefreshFailed(error, 'automatic');
    });
    void refreshPersonCache('automatic').catch((error) => {
      markPersonRefreshFailed(error, 'automatic');
    });
  };
  let albumRefreshTimer: NodeJS.Timeout | undefined;
  const albumStartupRefreshTimer = albumRefreshIntervalSeconds > 0
    ? setTimeout(() => {
      runAutomaticMediaRefresh();
      albumRefreshTimer = setInterval(runAutomaticMediaRefresh, albumRefreshIntervalSeconds * 1000);
      albumRefreshTimer.unref();
    }, 1000)
    : undefined;
  albumStartupRefreshTimer?.unref();

  app.addHook('onClose', async () => {
    if (albumStartupRefreshTimer) clearTimeout(albumStartupRefreshTimer);
    if (albumRefreshTimer) clearInterval(albumRefreshTimer);
  });

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
        refreshIntervalSeconds: albumRefreshIntervalSeconds,
      },
      personCache: {
        count: data.personCache.items.length,
        stale: data.personCache.stale,
        refreshedAt: data.personCache.refreshedAt,
        lastError: data.personCache.lastError,
        refreshIntervalSeconds: albumRefreshIntervalSeconds,
      },
      frames: Object.fromEntries(Object.entries(data.frames).map(([id, state]) => [id, {
        version: state.version,
        updatedAt: state.updatedAt,
        networkMode: state.networkMode,
        frameEventClients: events.connectedClientCount(id),
      }])),
      publicUrls: Object.fromEntries(Object.entries(data.devices).map(([id, device]) => [id, {
        localControllerBaseUrl: device.localControllerBaseUrl,
        externalControllerBaseUrl: device.externalControllerBaseUrl,
        localKioskBaseUrl: device.localKioskBaseUrl,
        externalKioskBaseUrl: device.externalKioskBaseUrl,
        remoteControlType: device.remoteControlType ?? 'none',
        remoteApiConfigured: remoteEndpointSummary(device).configured,
        remoteApiEffectiveSource: remoteEndpointSummary(device).effectiveSource,
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
    const kioskConnectionChecker = deps.kioskConnectionChecker ?? checkKioskConnection;
    const kioskDiagnostics = await Promise.all(Object.values(data.devices).map(async (candidate) => [
      candidate.id,
      await kioskConnectionChecker(candidate, kioskPasswordForDevice(candidate, deps.config.kioskPassword)),
    ] as const));
    const kioskDiagnosticsByDevice = Object.fromEntries(kioskDiagnostics);
    reply.type('text/html; charset=utf-8').send(renderSetupPage({
      controllerUrl: device.localControllerBaseUrl,
      deviceId: device.id,
      pairingCode: pairing.code,
      expiresAt: pairing.expiresAt,
      albumCount: data.albumCache.items.length,
      albumRefreshedAt: data.albumCache.refreshedAt,
      personCount: data.personCache.items.length,
      personRefreshedAt: data.personCache.refreshedAt,
      globalKioskPasswordConfigured: Boolean(deps.config.kioskPassword),
      frameClaims: store.getFrameClaims().map((claim) => publicFrameClaim(claim)),
      devices: Object.values(data.devices).map((candidate) => {
        const frameState = store.getFrameState(candidate.id);
        const resolved = frameState ? resolveFrameForRequest(candidate.id, request) : null;
        return {
          id: candidate.id,
          name: candidate.name,
          alias: candidate.alias,
          localControllerBaseUrl: candidate.localControllerBaseUrl,
          externalControllerBaseUrl: candidate.externalControllerBaseUrl,
          localKioskBaseUrl: candidate.localKioskBaseUrl,
          externalKioskBaseUrl: candidate.externalKioskBaseUrl,
          kioskPasswordConfigured: Boolean(candidate.kioskPassword),
          kioskPasswordSource: kioskPasswordSource(candidate, deps.config.kioskPassword),
          kioskConnection: kioskDiagnosticsByDevice[candidate.id],
          frameEventClients: events.connectedClientCount(candidate.id),
          deviceNetworkMode: candidate.networkMode,
          pollIntervalSeconds: candidate.pollIntervalSeconds,
          remoteControlType: candidate.remoteControlType ?? 'none',
          previewOrientation: candidate.previewOrientation ?? 'landscape',
          remoteApiUrl: candidate.remoteApiUrl,
          remoteApiAutoPort: candidate.remoteApiAutoPort ?? 8080,
          remoteApiAutoUrl: remoteEndpointSummary(candidate).autoUrl,
          remoteApiEffectiveUrl: remoteEndpointSummary(candidate).effectiveUrl,
          remoteApiEffectiveSource: remoteEndpointSummary(candidate).effectiveSource,
          lastSeenIp: candidate.lastSeenIp,
          lastSeenAt: candidate.lastSeenAt,
          remoteApiKeyConfigured: Boolean(candidate.remoteApiKey),
          isDefault: candidate.id === deps.config.defaultDevice.id,
          localFrameUrl: buildFrameUrl(candidate.localControllerBaseUrl, candidate.id),
          localStableFrameUrl: buildStableFrameUrl(candidate.localControllerBaseUrl, candidate),
          externalFrameUrl: candidate.externalControllerBaseUrl
            ? buildFrameUrl(candidate.externalControllerBaseUrl, candidate.id)
            : undefined,
          externalStableFrameUrl: candidate.externalControllerBaseUrl
            ? buildStableFrameUrl(candidate.externalControllerBaseUrl, candidate)
            : undefined,
          rendererUrl: resolved?.rendererUrl,
          networkMode: frameState?.networkMode ?? candidate.networkMode,
          resolvedNetworkMode: resolved?.resolvedNetworkMode,
          durationSeconds: frameState?.durationSeconds,
          imageFit: frameState?.imageFit,
          albumOrder: frameState?.albumOrder,
          showTime: frameState?.showTime,
          timeFormat: frameState?.timeFormat,
          showAmPm: frameState?.showAmPm,
          showSeconds: frameState?.showSeconds,
          showDate: frameState?.showDate,
          dateFormat: frameState?.dateFormat,
          clockSource: frameState?.clockSource,
          showWeather: frameState?.showWeather,
          weatherLocation: frameState?.weatherLocation,
          weatherRotationInterval: frameState?.weatherRotationInterval,
          transition: frameState?.transition,
          layout: frameState?.layout,
          imageEffect: frameState?.imageEffect,
          backgroundBlur: frameState?.backgroundBlur,
          backgroundBlurAmount: frameState?.backgroundBlurAmount,
          fontSize: frameState?.fontSize,
          frameless: frameState?.frameless,
          disableNavigation: frameState?.disableNavigation,
          hideCursor: frameState?.hideCursor,
          showProgressBar: frameState?.showProgressBar,
          showVideos: frameState?.showVideos,
          kioskVideoMuted: frameState?.kioskVideoMuted,
          excludeVideosOver: frameState?.excludeVideosOver,
          showArchived: frameState?.showArchived,
          showImageRating: frameState?.showImageRating,
          showOwner: frameState?.showOwner,
          showAlbumName: frameState?.showAlbumName,
          showPersonName: frameState?.showPersonName,
          showPersonAge: frameState?.showPersonAge,
          showImageTime: frameState?.showImageTime,
          imageTimeFormat: frameState?.imageTimeFormat,
          showImageDate: frameState?.showImageDate,
          imageDateFormat: frameState?.imageDateFormat,
          showImageDescription: frameState?.showImageDescription,
          imageDescriptionScrollDuration: frameState?.imageDescriptionScrollDuration,
          imageDescriptionAreaHeight: frameState?.imageDescriptionAreaHeight,
          imageDescriptionOverlayOpacity: frameState?.imageDescriptionOverlayOpacity,
          imageDescriptionLongThresholdLines: frameState?.imageDescriptionLongThresholdLines,
          showImageCamera: frameState?.showImageCamera,
          showImageExif: frameState?.showImageExif,
          showImageLocation: frameState?.showImageLocation,
          showImageQr: frameState?.showImageQr,
          showImageId: frameState?.showImageId,
          showUser: frameState?.showUser,
          showMoreInfo: frameState?.showMoreInfo,
          filterDate: frameState?.filterDate,
          filterNewest: frameState?.filterNewest,
          upArrowAction: frameState?.upArrowAction,
          downArrowAction: frameState?.downArrowAction,
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

  const frameClaimEntryHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const context = requestContext(request);
    const { claim, code } = createFrameClaimForRequest(request);
    const setupUrl = `${controllerBaseUrlForContext(context, deps.config.defaultDevice.localControllerBaseUrl)}/setup`;
    reply.type('text/html; charset=utf-8').send(renderFrameClaimPage({
      claimId: claim.id,
      code,
      expiresAt: claim.expiresAt,
      setupUrl,
    }));
  };

  app.get('/', async (request, reply) => {
    const device = store.getDevice(deps.config.defaultDevice.id) ?? deps.config.defaultDevice;
    if (isExternalSetupRequest(device.externalControllerBaseUrl, request)) {
      await frameClaimEntryHandler(request, reply);
      return;
    }
    await setupHandler(request, reply);
  });
  app.get('//', setupHandler);
  app.get('/setup', setupHandler);
  app.get('//setup', setupHandler);
  app.get('/pair', frameClaimEntryHandler);

  app.get('/f/:alias', async (request, reply) => {
    const { alias } = request.params as { alias: string };
    const query = request.query as { preview?: string };
    const device = store.getDeviceByAlias(normalizeAlias(alias));
    if (!device) {
      reply.status(404).send('Unknown frame');
      return;
    }
    if (query.preview !== '1') {
      rememberFrameClient(device, request);
    }
    reply.type('text/html; charset=utf-8').send(renderFramePage(device, { preview: query.preview === '1' }));
  });

  app.get('/api/frame-claims', async (request, reply) => {
    if (!requireLocalConsoleAccess(request, reply)) return;
    return ok({
      items: store.getFrameClaims().map((claim) => publicFrameClaim(claim)),
    });
  });

  app.post('/api/frame-claims/:code/claim', async (request, reply) => {
    if (!requireLocalConsoleAccess(request, reply)) return;
    const { code } = request.params as { code: string };
    const parsedCode = FrameClaimCodeSchema.safeParse(code);
    if (!parsedCode.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsedCode.error.errors[0]?.message ?? 'Invalid frame claim code.'));
      return;
    }
    const claim = store.findFrameClaimByCodeHash(hashSecret(parsedCode.data));
    if (!claim) {
      reply.status(404).send(fail('FRAME_CLAIM_NOT_FOUND', 'Frame claim code was not found or has expired.'));
      return;
    }
    const parsed = FrameClaimCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid frame claim.'));
      return;
    }
    const device = createDeviceFromClaim(parsed.data, deps.config.defaultDevice);
    const created = store.createDevice(device);
    if (!created) {
      reply.status(409).send(fail('DEVICE_EXISTS', `Device or alias already exists: ${device.id}`));
      return;
    }
    store.markFrameClaimClaimed(claim.id, created.id);
    return ok({
      claim: publicFrameClaim(store.getFrameClaim(claim.id) ?? claim),
      device: publicDevice(created),
      state: store.getFrameState(created.id),
      localFrameUrl: buildStableFrameUrl(created.localControllerBaseUrl, created),
      externalFrameUrl: created.externalControllerBaseUrl
        ? buildStableFrameUrl(created.externalControllerBaseUrl, created)
        : undefined,
      framePath: stableFramePath(created),
    });
  });

  app.get('/api/frame-claims/:claimId', async (request, reply) => {
    const { claimId } = request.params as { claimId: string };
    const claim = store.getFrameClaim(claimId);
    if (!claim) {
      reply.status(404).send(fail('FRAME_CLAIM_NOT_FOUND', 'Frame claim was not found or has expired.'));
      return;
    }
    if (claim.claimedDeviceId) {
      const device = store.getDevice(claim.claimedDeviceId);
      return ok({
        status: 'claimed',
        deviceId: claim.claimedDeviceId,
        framePath: device ? stableFramePath(device) : `/frame/${encodeURIComponent(claim.claimedDeviceId)}`,
      });
    }
    if (Date.parse(claim.expiresAt) <= Date.now()) {
      reply.status(410).send(fail('FRAME_CLAIM_EXPIRED', 'Frame claim has expired.'));
      return;
    }
    return ok({
      status: 'pending',
      expiresAt: claim.expiresAt,
    });
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

  app.get('/api/devices', async (request, reply) => {
    if (!requireLocalConsoleAccess(request, reply)) return;
    const data = store.getData();
    return ok({
      items: Object.values(data.devices).map((device) => ({
        ...publicDevice(device),
        kioskPasswordSource: kioskPasswordSource(device, deps.config.kioskPassword),
        frameUrl: buildFrameUrl(device.localControllerBaseUrl, device.id),
        localFrameUrl: buildFrameUrl(device.localControllerBaseUrl, device.id),
        localStableFrameUrl: buildStableFrameUrl(device.localControllerBaseUrl, device),
        externalFrameUrl: device.externalControllerBaseUrl
          ? buildFrameUrl(device.externalControllerBaseUrl, device.id)
          : undefined,
        externalStableFrameUrl: device.externalControllerBaseUrl
          ? buildStableFrameUrl(device.externalControllerBaseUrl, device)
          : undefined,
        frameEventClients: events.connectedClientCount(device.id),
        hasState: Boolean(data.frames[device.id]),
        isDefault: device.id === deps.config.defaultDevice.id,
      })),
    });
  });

  app.get('/api/integration/devices', async (request, reply) => {
    if (!auth.requireMutationAuth(request, reply)) return;
    const data = store.getData();
    return ok({
      items: Object.values(data.devices).map((device) => ({
        id: device.id,
        name: device.name,
        networkMode: device.networkMode,
        localFrameUrl: buildFrameUrl(device.localControllerBaseUrl, device.id),
        localStableFrameUrl: buildStableFrameUrl(device.localControllerBaseUrl, device),
        externalFrameUrl: device.externalControllerBaseUrl
          ? buildFrameUrl(device.externalControllerBaseUrl, device.id)
          : undefined,
        externalStableFrameUrl: device.externalControllerBaseUrl
          ? buildStableFrameUrl(device.externalControllerBaseUrl, device)
          : undefined,
        remoteControlType: device.remoteControlType ?? 'none',
        remoteApiConfigured: remoteEndpointSummary(device).configured,
        frameEventClients: events.connectedClientCount(device.id),
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
      localStableFrameUrl: buildStableFrameUrl(created.localControllerBaseUrl, created),
      externalFrameUrl: created.externalControllerBaseUrl
        ? buildFrameUrl(created.externalControllerBaseUrl, created.id)
        : undefined,
      externalStableFrameUrl: created.externalControllerBaseUrl
        ? buildStableFrameUrl(created.externalControllerBaseUrl, created)
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
      localStableFrameUrl: buildStableFrameUrl(updated.localControllerBaseUrl, updated),
      externalFrameUrl: updated.externalControllerBaseUrl
        ? buildFrameUrl(updated.externalControllerBaseUrl, updated.id)
        : undefined,
      externalStableFrameUrl: updated.externalControllerBaseUrl
        ? buildStableFrameUrl(updated.externalControllerBaseUrl, updated)
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
    const query = request.query as { preview?: string };
    const device = store.getDevice(deviceId);
    if (!device) {
      reply.status(404).send('Unknown frame');
      return;
    }
    if (query.preview !== '1') {
      rememberFrameClient(device, request);
    }
    reply.type('text/html; charset=utf-8').send(renderFramePage(device, { preview: query.preview === '1' }));
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
    const personValidationError = validatePersonIds(parsed.data.activePersonIds, store.getPersonCache());
    if (personValidationError) {
      reply.status(400).send(fail('PERSON_NOT_FOUND', personValidationError));
      return;
    }

    const updated = store.updateFrameState(deviceId, (state) => bumpState({
      ...state,
      ...stripNullProfile(parsed.data),
    }));
    const direct = buildRendererUrl(device, { ...updated, networkMode: 'local' }, undefined, {
      kioskPassword: kioskPasswordForDevice(device, deps.config.kioskPassword),
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
    if (commandPrefersRemotePress(parsed.data.command) && remoteFallbackAvailable(device, parsed.data.command)) {
      try {
        const remoteFallback = await sendRemoteCommand(device, parsed.data.command);
        return ok({
          command: parsed.data.command,
          frameEvent: null,
          remoteFallback,
        });
      } catch (error) {
        if (events.connectedClientCount(deviceId) === 0) {
          const remoteError = error instanceof RemoteCommandError
            ? error
            : new RemoteCommandError('REMOTE_COMMAND_FAILED', error instanceof Error ? error.message : String(error));
          reply.status(remoteError.statusCode).send(fail(remoteError.code, remoteError.message));
          return;
        }
      }
    }

    if (commandUsesFrameEvents(parsed.data.command)) {
      const delivered = events.emitCommand(deviceId, {
        command: parsed.data.command,
        issuedAt: new Date().toISOString(),
      });
      const frameEvent = {
        connectedClients: events.connectedClientCount(deviceId),
        delivered,
      };
      if (delivered === 0 && remoteFallbackAvailable(device, parsed.data.command)) {
        try {
          const remoteFallback = await sendRemoteCommand(device, parsed.data.command);
          return ok({
            command: parsed.data.command,
            frameEvent,
            remoteFallback,
          });
        } catch (error) {
          const remoteError = error instanceof RemoteCommandError
            ? error
            : new RemoteCommandError('REMOTE_COMMAND_FAILED', error instanceof Error ? error.message : String(error));
          reply.status(remoteError.statusCode).send(fail(remoteError.code, remoteError.message));
          return;
        }
      }
      return ok({
        command: parsed.data.command,
        frameEvent,
        remoteFallback: null,
      });
    }
    try {
      const screenOffPreparation = parsed.data.command === 'screen-off'
        ? await prepareRemoteScreenOff(store, device)
        : undefined;
      const result = await sendRemoteCommand(device, parsed.data.command);
      app.log.info({
        deviceId,
        command: parsed.data.command,
        endpoint: result.endpoint,
        baseUrl: result.baseUrl,
        source: result.source,
        screenOffPreparation,
      }, 'FreeKiosk command completed');
      if (parsed.data.command === 'screen-on') {
        return ok({
          ...result,
          brightnessRestore: await restoreRemoteBrightnessAfterScreenOn(store, deviceId),
        });
      }
      return ok(screenOffPreparation ? { ...result, ...screenOffPreparation } : result);
    } catch (error) {
      const remoteError = error instanceof RemoteCommandError
        ? error
        : new RemoteCommandError('REMOTE_COMMAND_FAILED', error instanceof Error ? error.message : String(error));
      reply.status(remoteError.statusCode).send(fail(remoteError.code, remoteError.message));
    }
  });

  app.get('/api/frames/:deviceId/remote/status', async (request, reply) => {
    if (!auth.requireMutationAuth(request, reply)) return;
    const { deviceId } = request.params as { deviceId: string };
    const device = store.getDevice(deviceId);
    if (!device) {
      reply.status(404).send(fail('FRAME_NOT_FOUND', `Frame not found: ${deviceId}`));
      return;
    }
    try {
      return ok(await getRemoteStatus(device));
    } catch (error) {
      const remoteError = error instanceof RemoteCommandError
        ? error
        : new RemoteCommandError('REMOTE_STATUS_FAILED', error instanceof Error ? error.message : String(error));
      reply.status(remoteError.statusCode).send(fail(remoteError.code, remoteError.message));
    }
  });

  app.put('/api/frames/:deviceId/remote/brightness', async (request, reply) => {
    if (!auth.requireMutationAuth(request, reply)) return;
    const { deviceId } = request.params as { deviceId: string };
    const parsed = RemoteLevelSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid brightness value.'));
      return;
    }
    const device = store.getDevice(deviceId);
    if (!device) {
      reply.status(404).send(fail('FRAME_NOT_FOUND', `Frame not found: ${deviceId}`));
      return;
    }
    try {
      const result = await setRemoteLevel(device, 'brightness', parsed.data.value);
      store.updateDevice(deviceId, { remoteBrightnessRestoreValue: parsed.data.value });
      return ok({ ...result, brightnessRestoreValue: parsed.data.value });
    } catch (error) {
      const remoteError = error instanceof RemoteCommandError
        ? error
        : new RemoteCommandError('REMOTE_COMMAND_FAILED', error instanceof Error ? error.message : String(error));
      reply.status(remoteError.statusCode).send(fail(remoteError.code, remoteError.message));
    }
  });

  app.put('/api/frames/:deviceId/remote/volume', async (request, reply) => {
    if (!auth.requireMutationAuth(request, reply)) return;
    const { deviceId } = request.params as { deviceId: string };
    const parsed = RemoteLevelSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid volume value.'));
      return;
    }
    const device = store.getDevice(deviceId);
    if (!device) {
      reply.status(404).send(fail('FRAME_NOT_FOUND', `Frame not found: ${deviceId}`));
      return;
    }
    try {
      return ok(await setRemoteLevel(device, 'volume', parsed.data.value));
    } catch (error) {
      const remoteError = error instanceof RemoteCommandError
        ? error
        : new RemoteCommandError('REMOTE_COMMAND_FAILED', error instanceof Error ? error.message : String(error));
      reply.status(remoteError.statusCode).send(fail(remoteError.code, remoteError.message));
    }
  });

  app.put('/api/frames/:deviceId/remote/auto-brightness', async (request, reply) => {
    if (!auth.requireMutationAuth(request, reply)) return;
    const { deviceId } = request.params as { deviceId: string };
    const parsed = RemoteAutoBrightnessSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Invalid auto-brightness request.'));
      return;
    }
    const device = store.getDevice(deviceId);
    if (!device) {
      reply.status(404).send(fail('FRAME_NOT_FOUND', `Frame not found: ${deviceId}`));
      return;
    }
    try {
      return ok(await setRemoteAutoBrightness(device, parsed.data));
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
      globalKioskPassword: deps.config.kioskPassword,
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
      const cache = await refreshAlbumCache('manual');
      return ok(cache, { refreshedAt: cache.refreshedAt, stale: false });
    } catch (error) {
      const cache = markAlbumRefreshFailed(error, 'manual');
      reply.status(502).send(fail('IMMICH_REFRESH_FAILED', cache.lastError ?? 'Failed to refresh Immich albums.'));
    }
  });

  app.get('/api/immich/people', async () => {
    const cache = store.getPersonCache();
    return ok(cache, {
      refreshedAt: cache.refreshedAt,
      stale: cache.stale,
    });
  });

  app.post('/api/immich/people/refresh', async (request, reply) => {
    if (!auth.requireMutationAuth(request, reply)) return;
    try {
      const cache = await refreshPersonCache('manual');
      return ok(cache, { refreshedAt: cache.refreshedAt, stale: false });
    } catch (error) {
      const cache = markPersonRefreshFailed(error, 'manual');
      reply.status(502).send(fail('IMMICH_REFRESH_FAILED', cache.lastError ?? 'Failed to refresh Immich people.'));
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
    const personValidationError = validatePersonIds(parsed.data.personIds, store.getPersonCache());
    if (personValidationError) {
      reply.status(400).send(fail('PERSON_NOT_FOUND', personValidationError));
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
      activePersonIds: profile.personIds,
      requireAllPeople: profile.requireAllPeople,
      activeProfileId: profile.id,
      durationSeconds: profile.durationSeconds,
      imageFit: profile.imageFit,
      showTime: profile.showTime,
      timeFormat: profile.timeFormat,
      showAmPm: profile.showAmPm,
      showSeconds: profile.showSeconds,
      showDate: profile.showDate,
      dateFormat: profile.dateFormat,
      clockSource: profile.clockSource,
      showWeather: profile.showWeather,
      weatherLocation: profile.weatherLocation,
      weatherRotationInterval: profile.weatherRotationInterval,
      showVideos: profile.showVideos,
      excludeVideosOver: profile.excludeVideosOver,
      showArchived: profile.showArchived,
      filterDate: profile.filterDate,
      filterNewest: profile.filterNewest,
      albumOrder: profile.albumOrder,
      networkMode: profile.preferredNetworkMode,
      transition: profile.transition,
      fadeTransitionDuration: profile.fadeTransitionDuration,
      crossFadeTransitionDuration: profile.crossFadeTransitionDuration,
      layout: profile.layout,
      imageEffect: profile.imageEffect,
      imageEffectAmount: profile.imageEffectAmount,
      backgroundBlur: profile.backgroundBlur,
      backgroundBlurAmount: profile.backgroundBlurAmount,
      fontSize: profile.fontSize,
      frameless: profile.frameless,
      disableNavigation: profile.disableNavigation,
      hideCursor: profile.hideCursor,
      showProgressBar: profile.showProgressBar,
      progressBarPosition: profile.progressBarPosition,
      showImageRating: profile.showImageRating,
      showOwner: profile.showOwner,
      showAlbumName: profile.showAlbumName,
      showPersonName: profile.showPersonName,
      showPersonAge: profile.showPersonAge,
      showImageTime: profile.showImageTime,
      imageTimeFormat: profile.imageTimeFormat,
      showImageDate: profile.showImageDate,
      imageDateFormat: profile.imageDateFormat,
      showImageDescription: profile.showImageDescription,
      imageDescriptionScrollDuration: profile.imageDescriptionScrollDuration,
      imageDescriptionAreaHeight: profile.imageDescriptionAreaHeight,
      imageDescriptionOverlayOpacity: profile.imageDescriptionOverlayOpacity,
      imageDescriptionLongThresholdLines: profile.imageDescriptionLongThresholdLines,
      showImageCamera: profile.showImageCamera,
      showImageExif: profile.showImageExif,
      showImageLocation: profile.showImageLocation,
      showImageQr: profile.showImageQr,
      showImageId: profile.showImageId,
      showUser: profile.showUser,
      showMoreInfo: profile.showMoreInfo,
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
      kioskPassword: kioskPasswordForDevice(device, deps.config.kioskPassword),
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

  function createFrameClaimForRequest(request: FastifyRequest): { claim: FrameClaim; code: string } {
    const code = generateFrameClaimCode();
    const now = Date.now();
    const context = requestContext(request);
    const claim = store.createFrameClaim({
      id: randomBytes(10).toString('base64url'),
      codeHash: hashSecret(normalizeFrameClaimCode(code)),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
      requestHost: context.host,
      userAgentHint: request.headers['user-agent']?.slice(0, 120),
    });
    return { claim, code };
  }

  function createDeviceFromClaim(
    input: z.infer<typeof FrameClaimCreateSchema>,
    defaultDevice: FrameDevice,
  ): FrameDevice {
    const alias = input.alias ?? generateUniqueAlias(input.name);
    const id = generateUniqueDeviceId(alias);
    return {
      ...defaultDevice,
      id,
      name: input.name,
      alias,
      previewOrientation: input.previewOrientation,
      remoteControlType: input.remoteControlType,
      remoteApiUrl: input.remoteApiUrl ? trimTrailingSlash(input.remoteApiUrl) : undefined,
      remoteApiAutoPort: input.remoteApiAutoPort,
      remoteApiKey: input.remoteApiKey,
    };
  }

  function generateUniqueAlias(name: string): string {
    const base = normalizeAlias(name) || 'frame';
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const alias = `${base}-${randomAliasSuffix()}`;
      if (!store.aliasExists(alias)) return alias;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  function generateUniqueDeviceId(alias: string): string {
    const base = alias.replace(/-/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'frame';
    if (!store.getDevice(base)) return base;
    for (let index = 2; index < 100; index += 1) {
      const candidate = `${base}_${index}`;
      if (!store.getDevice(candidate)) return candidate;
    }
    return `${base}_${Date.now().toString(36)}`;
  }

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
        kioskPassword: kioskPasswordForDevice(device, deps.config.kioskPassword),
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

  async function refreshAlbumCache(source: 'manual' | 'automatic'): Promise<AlbumCache> {
    if (albumRefreshInFlight) return albumRefreshInFlight;

    albumRefreshInFlight = (async () => {
      const items = await immich.listAlbums();
      const cache: AlbumCache = {
        items,
        refreshedAt: new Date().toISOString(),
        stale: false,
      };
      store.setAlbumCache(cache);
      app.log.info({ source, count: items.length }, 'Immich album cache refreshed');
      return cache;
    })();

    try {
      return await albumRefreshInFlight;
    } finally {
      albumRefreshInFlight = undefined;
    }
  }

  function markAlbumRefreshFailed(error: unknown, source: 'manual' | 'automatic'): AlbumCache {
    const current = store.getAlbumCache();
    const cache: AlbumCache = {
      ...current,
      stale: true,
      lastError: error instanceof Error ? error.message : String(error),
    };
    store.setAlbumCache(cache);
    app.log.warn({ source, error: cache.lastError }, 'Immich album cache refresh failed');
    return cache;
  }

  async function refreshPersonCache(source: 'manual' | 'automatic'): Promise<PersonCache> {
    if (personRefreshInFlight) return personRefreshInFlight;

    personRefreshInFlight = (async () => {
      const items = await immich.listPeople();
      const cache: PersonCache = {
        items,
        refreshedAt: new Date().toISOString(),
        stale: false,
      };
      store.setPersonCache(cache);
      app.log.info({ source, count: items.length }, 'Immich person cache refreshed');
      return cache;
    })();

    try {
      return await personRefreshInFlight;
    } finally {
      personRefreshInFlight = undefined;
    }
  }

  function markPersonRefreshFailed(error: unknown, source: 'manual' | 'automatic'): PersonCache {
    const current = store.getPersonCache();
    const cache: PersonCache = {
      ...current,
      stale: true,
      lastError: error instanceof Error ? error.message : String(error),
    };
    store.setPersonCache(cache);
    app.log.warn({ source, error: cache.lastError }, 'Immich person cache refresh failed');
    return cache;
  }

  function rememberFrameClient(device: FrameDevice, request: FastifyRequest): void {
    if ((device.remoteControlType ?? 'none') !== 'freekiosk') return;
    if (!isLocalControllerRequest(device, request) || isPreviewRequest(request)) return;
    const ip = requestClientIp(request);
    if (!ip || !isAutoRemoteCandidateIp(ip)) return;
    const port = device.remoteApiAutoPort ?? 8080;
    const key = `${device.id}|${ip}|${port}`;
    const now = Date.now();
    const lastAttemptAt = remoteDiscoveryAttempts.get(key) ?? 0;
    if (remoteDiscoveryInFlight.has(key) || now - lastAttemptAt < REMOTE_DISCOVERY_RETRY_MS) return;

    remoteDiscoveryAttempts.set(key, now);
    remoteDiscoveryInFlight.add(key);
    void verifyAndRememberFrameClient(device, ip, port)
      .catch((error) => {
        app.log.debug({
          deviceId: device.id,
          ip,
          port,
          error: error instanceof Error ? error.message : String(error),
        }, 'FreeKiosk auto-discovery candidate rejected');
      })
      .finally(() => {
        remoteDiscoveryInFlight.delete(key);
      });
  }

  async function verifyAndRememberFrameClient(device: FrameDevice, ip: string, port: number): Promise<void> {
    const baseUrl = buildAutoRemoteApiUrl({ ...device, lastSeenIp: ip, remoteApiAutoPort: port });
    if (!baseUrl) return;

    const headers: Record<string, string> = {};
    if (device.remoteApiKey) headers['X-Api-Key'] = device.remoteApiKey;
    const response = await fetch(`${baseUrl}/api/status`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(REMOTE_DISCOVERY_TIMEOUT_MS),
    });
    const payload = parseJsonOrText(await response.text());
    if (!response.ok || !isFreeKioskStatusForDevice(payload, device, ip)) {
      throw new Error(`candidate did not match ${device.id}`);
    }

    const latest = store.getDevice(device.id);
    if (!latest || (latest.remoteApiAutoPort ?? 8080) !== port) return;
    const previousIp = latest.lastSeenIp;
    store.markDeviceSeen(device.id, ip);
    if (previousIp !== ip) {
      app.log.info({ deviceId: device.id, ip, port }, 'FreeKiosk auto-discovery updated frame endpoint');
    }
  }

  async function proxyKioskRequest(request: FastifyRequest, reply: FastifyReply) {
    const { deviceId } = request.params as { deviceId: string };
    const device = store.getDevice(deviceId);
    if (!device) {
      reply.status(404).send(fail('FRAME_NOT_FOUND', `Frame not found: ${deviceId}`));
      return;
    }
    rememberFrameClient(device, request);

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
        signal: proxyRequestSignal(request.method),
      });
      const contentType = response.headers.get('content-type') ?? '';

      if (isTextResponse(contentType)) {
        const body = Buffer.from(await response.arrayBuffer());
        reply.status(response.status);
        forwardProxyHeaders(response, reply);
        disableProxyTextCache(reply);
        reply.type(contentType || 'text/plain; charset=utf-8').send(rewriteProxyText(body.toString('utf8'), proxyPrefix, contentType));
        return;
      }
      if (request.method === 'HEAD' || !response.body) {
        reply.status(response.status);
        forwardProxyHeaders(response, reply, { includeContentLength: true });
        if (contentType) reply.type(contentType);
        reply.send();
        return;
      }
      await streamProxyResponse(response, reply, contentType);
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

type RemoteRequestMethod = 'GET' | 'POST';

interface RemoteRequestResult {
  endpoint: string;
  baseUrl: string;
  source: 'manual' | 'auto';
  statusCode: number;
  result: unknown;
}

async function sendRemoteCommand(
  device: FrameDevice,
  command: FrameCommand,
): Promise<{
  provider: 'freekiosk';
  command: FrameCommand;
  endpoint: string;
  baseUrl: string;
  source: 'manual' | 'auto';
  statusCode: number;
  result: unknown;
}> {
  const script = freeKioskJavaScriptCommand(command);
  if (script) {
    try {
      const remote = await sendRemoteRequest(device, '/api/js', {
        method: 'POST',
        body: { code: script },
      });
      return {
        provider: 'freekiosk',
        command,
        endpoint: remote.endpoint,
        baseUrl: remote.baseUrl,
        source: remote.source,
        statusCode: remote.statusCode,
        result: {
          strategy: 'webview-js',
          result: remote.result,
        },
      };
    } catch {
      // Older FreeKiosk builds or non-controller pages can still be driven by the native key endpoints.
    }
  }

  const endpoint = freeKioskEndpoint(command);
  const remote = await sendRemoteRequest(device, endpoint, { method: 'POST' });
  return {
    provider: 'freekiosk',
    command,
    endpoint,
    baseUrl: remote.baseUrl,
    source: remote.source,
    statusCode: remote.statusCode,
    result: remote.result,
  };
}

interface RemoteBrightnessCaptureResult {
  action: 'capture';
  captured: boolean;
  value?: number;
  endpoint?: string;
  baseUrl?: string;
  source?: 'manual' | 'auto';
  statusCode?: number;
  reason?: string;
}

interface RemoteBrightnessRestoreResult {
  action: 'restore';
  restored: boolean;
  value?: number;
  endpoint?: string;
  baseUrl?: string;
  source?: 'manual' | 'auto';
  statusCode?: number;
  reason?: string;
}

interface RemoteDeviceMuteResult {
  action: 'mute';
  muted: boolean;
  changed: boolean;
  endpoint?: string;
  baseUrl?: string;
  source?: 'manual' | 'auto';
  statusCode?: number;
  reason?: string;
}

interface RemoteScreenOffPreparationResult {
  brightnessRestore: RemoteBrightnessCaptureResult;
  deviceMute: RemoteDeviceMuteResult;
}

async function prepareRemoteScreenOff(
  store: JsonStore,
  device: FrameDevice,
): Promise<RemoteScreenOffPreparationResult> {
  try {
    const remote = await sendRemoteRequest(device, '/api/status', { method: 'GET' });
    return {
      brightnessRestore: captureRemoteBrightnessFromStatus(store, device, remote),
      deviceMute: await ensureRemoteDeviceMutedFromStatus(device, remote),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      brightnessRestore: {
        action: 'capture',
        captured: false,
        reason,
      },
      deviceMute: {
        action: 'mute',
        muted: false,
        changed: false,
        reason,
      },
    };
  }
}

async function restoreRemoteBrightnessAfterScreenOn(
  store: JsonStore,
  deviceId: string,
): Promise<RemoteBrightnessRestoreResult> {
  const device = store.getDevice(deviceId);
  const value = device?.remoteBrightnessRestoreValue;
  if (!device || typeof value !== 'number' || !Number.isInteger(value)) {
    return {
      action: 'restore',
      restored: false,
      reason: 'brightness-unavailable',
    };
  }

  await delay(REMOTE_BRIGHTNESS_RESTORE_DELAY_MS);
  try {
    const remote = await setRemoteLevel(device, 'brightness', value);
    return {
      action: 'restore',
      restored: true,
      value,
      endpoint: remote.endpoint,
      baseUrl: remote.baseUrl,
      source: remote.source,
      statusCode: remote.statusCode,
    };
  } catch (error) {
    return {
      action: 'restore',
      restored: false,
      value,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function captureRemoteBrightnessFromStatus(
  store: JsonStore,
  device: FrameDevice,
  remote: RemoteRequestResult,
): RemoteBrightnessCaptureResult {
  const value = remoteBrightnessValue(remote.result);
  if (value === undefined) {
    return {
      action: 'capture',
      captured: false,
      endpoint: remote.endpoint,
      baseUrl: remote.baseUrl,
      source: remote.source,
      statusCode: remote.statusCode,
      reason: 'brightness-unavailable',
    };
  }
  store.updateDevice(device.id, { remoteBrightnessRestoreValue: value });
  return {
    action: 'capture',
    captured: true,
    value,
    endpoint: remote.endpoint,
    baseUrl: remote.baseUrl,
    source: remote.source,
    statusCode: remote.statusCode,
  };
}

async function ensureRemoteDeviceMutedFromStatus(
  device: FrameDevice,
  remote: RemoteRequestResult,
): Promise<RemoteDeviceMuteResult> {
  const muted = remoteDeviceMutedValue(remote.result);
  if (muted === true) {
    return {
      action: 'mute',
      muted: true,
      changed: false,
      endpoint: remote.endpoint,
      baseUrl: remote.baseUrl,
      source: remote.source,
      statusCode: remote.statusCode,
    };
  }
  if (muted === undefined) {
    return {
      action: 'mute',
      muted: false,
      changed: false,
      endpoint: remote.endpoint,
      baseUrl: remote.baseUrl,
      source: remote.source,
      statusCode: remote.statusCode,
      reason: 'mute-state-unavailable',
    };
  }

  try {
    const result = await setRemoteLevel(device, 'volume', 0);
    return {
      action: 'mute',
      muted: true,
      changed: true,
      endpoint: result.endpoint,
      baseUrl: result.baseUrl,
      source: result.source,
      statusCode: result.statusCode,
    };
  } catch (error) {
    return {
      action: 'mute',
      muted: false,
      changed: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function remoteBrightnessValue(status: unknown): number | undefined {
  if (!isRecord(status) || !isRecord(status.screen)) return undefined;
  const value = status.screen.brightness;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 100) return undefined;
  return rounded;
}

function remoteDeviceMutedValue(status: unknown): boolean | undefined {
  if (!isRecord(status) || !isRecord(status.audio)) return undefined;
  const muted = status.audio.muted;
  if (typeof muted === 'boolean') return muted;
  const volume = status.audio.volume;
  if (typeof volume !== 'number' || !Number.isFinite(volume)) return undefined;
  return volume <= 0;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function freeKioskJavaScriptCommand(command: FrameCommand): string | null {
  if (
    command !== 'next'
    && command !== 'previous'
    && command !== 'play-pause'
    && command !== 'mute-toggle'
  ) {
    return null;
  }

  return `
(function () {
  var command = ${JSON.stringify(command)};
  function callController() {
    if (command === 'mute-toggle') return false;
    var handler = window.__immichFrameCommand;
    if (typeof handler !== 'function') return false;
    try {
      return handler(command) !== false;
    } catch (error) {
      return false;
    }
  }
  function iframeWindow() {
    var iframe = document.getElementById('renderer');
    try {
      return iframe && iframe.contentWindow;
    } catch (error) {
      return null;
    }
  }
  function iframeDocument() {
    var win = iframeWindow();
    try {
      return win && win.document;
    } catch (error) {
      return null;
    }
  }
  function triggerKioskApi() {
    var win = iframeWindow();
    try {
      if (command === 'next' && win && win.kiosk && typeof win.kiosk.triggerNewAsset === 'function') {
        win.kiosk.triggerNewAsset();
        return true;
      }
    } catch (error) {}
    return false;
  }
  function clickControl() {
    var doc = iframeDocument();
    if (!doc) return false;
    var selector = null;
    if (command === 'next') selector = '.navigation--next-asset, [aria-label="Next"], [title="Next"]';
    if (command === 'previous') selector = '.navigation--prev-asset, [aria-label="Previous"], [title="Previous"]';
    if (command === 'mute-toggle') selector = '.navigation--mute, [aria-label="Mute"], [aria-label="Unmute"], [title="Mute"], [title="Unmute"], .mute, .unmute';
    if (!selector) return false;
    var control = doc.querySelector(selector);
    if (!control || typeof control.click !== 'function') return false;
    control.click();
    return true;
  }
  function dispatchKey() {
    var map = {
      next: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
      previous: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
      'play-pause': { key: ' ', code: 'Space', keyCode: 32 },
      'mute-toggle': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 }
    };
    var target = map[command];
    if (!target) return false;
    var doc = iframeDocument();
    var win = iframeWindow();
    var eventInit = {
      key: target.key,
      code: target.code,
      keyCode: target.keyCode,
      which: target.keyCode,
      bubbles: true,
      cancelable: true
    };
    var nodes = [document.body, document.documentElement, document, window];
    if (doc) nodes.push(doc.body, doc.documentElement, doc);
    if (win) nodes.push(win);
    nodes.filter(Boolean).forEach(function (node) {
      node.dispatchEvent(new KeyboardEvent('keydown', eventInit));
      node.dispatchEvent(new KeyboardEvent('keyup', eventInit));
    });
    return true;
  }
  return callController() || triggerKioskApi() || clickControl() || dispatchKey();
})();`.trim();
}

async function getRemoteStatus(device: FrameDevice): Promise<{
  provider: 'freekiosk';
  endpoint: string;
  baseUrl: string;
  source: 'manual' | 'auto';
  statusCode: number;
  status: unknown;
  capabilities: ReturnType<typeof inferFreeKioskCapabilities>;
}> {
  const remote = await sendRemoteRequest(device, '/api/status', { method: 'GET' });
  const capabilities = await getRemoteCapabilities(device, remote.result);
  return {
    provider: 'freekiosk',
    endpoint: remote.endpoint,
    baseUrl: remote.baseUrl,
    source: remote.source,
    statusCode: remote.statusCode,
    status: remote.result,
    capabilities,
  };
}

async function setRemoteLevel(
  device: FrameDevice,
  property: 'brightness' | 'volume',
  value: number,
): Promise<{
  provider: 'freekiosk';
  property: 'brightness' | 'volume';
  value: number;
  endpoint: string;
  baseUrl: string;
  source: 'manual' | 'auto';
  statusCode: number;
  result: unknown;
}> {
  const endpoint = `/api/${property}`;
  const remote = await sendRemoteRequest(device, endpoint, {
    method: 'POST',
    body: { value },
  });
  return {
    provider: 'freekiosk',
    property,
    value,
    endpoint,
    baseUrl: remote.baseUrl,
    source: remote.source,
    statusCode: remote.statusCode,
    result: remote.result,
  };
}

async function setRemoteAutoBrightness(
  device: FrameDevice,
  options: z.infer<typeof RemoteAutoBrightnessSchema>,
): Promise<{
  provider: 'freekiosk';
  enabled: boolean;
  endpoint: string;
  baseUrl: string;
  source: 'manual' | 'auto';
  statusCode: number;
  result: unknown;
}> {
  const endpoint = options.enabled ? '/api/autoBrightness/enable' : '/api/autoBrightness/disable';
  const { enabled: _enabled, ...body } = options;
  const remote = await sendRemoteRequest(device, endpoint, {
    method: 'POST',
    body: options.enabled ? body : undefined,
  });
  return {
    provider: 'freekiosk',
    enabled: options.enabled,
    endpoint,
    baseUrl: remote.baseUrl,
    source: remote.source,
    statusCode: remote.statusCode,
    result: remote.result,
  };
}

async function sendRemoteRequest(
  device: FrameDevice,
  endpoint: string,
  options: {
    method: RemoteRequestMethod;
    body?: Record<string, unknown>;
  },
): Promise<RemoteRequestResult> {
  if ((device.remoteControlType ?? 'none') !== 'freekiosk') {
    throw new RemoteCommandError('REMOTE_NOT_CONFIGURED', `Frame ${device.id} is not configured for FreeKiosk remote control.`, 400);
  }
  const candidates = remoteEndpointCandidates(device);
  if (candidates.length === 0) {
    throw new RemoteCommandError('REMOTE_NOT_CONFIGURED', `Frame ${device.id} is missing a manual remoteApiUrl and has no verified FreeKiosk endpoint for auto discovery.`, 400);
  }

  const headers: Record<string, string> = {};
  if (device.remoteApiKey) {
    headers['X-Api-Key'] = device.remoteApiKey;
  }
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  let lastError: RemoteCommandError | undefined;
  for (const candidate of candidates) {
    try {
      const url = `${candidate.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(7000),
      });
      const text = await response.text();
      const payload = parseJsonOrText(text);

      if (!response.ok || (isRecord(payload) && payload.success === false)) {
        const message = remoteErrorMessage(payload, response.status);
        const code = response.status === 404 ? 'REMOTE_UNSUPPORTED' : 'REMOTE_COMMAND_FAILED';
        throw new RemoteCommandError(code, `${message} (${candidate.source}: ${candidate.baseUrl})`, response.status === 404 ? 404 : 502);
      }

      return {
        endpoint,
        baseUrl: candidate.baseUrl,
        source: candidate.source,
        statusCode: response.status,
        result: isRecord(payload) && 'data' in payload ? payload.data : payload,
      };
    } catch (error) {
      lastError = error instanceof RemoteCommandError
        ? error
        : new RemoteCommandError(
          'REMOTE_COMMAND_FAILED',
          `${error instanceof Error ? error.message : String(error)} (${candidate.source}: ${candidate.baseUrl})`,
          502,
        );
    }
  }

  throw lastError ?? new RemoteCommandError('REMOTE_COMMAND_FAILED', `FreeKiosk command failed for ${device.id}.`);
}

async function getRemoteCapabilities(
  device: FrameDevice,
  status: unknown,
): Promise<ReturnType<typeof inferFreeKioskCapabilities>> {
  try {
    const root = await sendRemoteRequest(device, '/', { method: 'GET' });
    return inferFreeKioskCapabilities(status, root.result);
  } catch {
    return inferFreeKioskCapabilities(status);
  }
}

function inferFreeKioskCapabilities(status: unknown, apiIndex?: unknown): {
  status: boolean;
  brightnessControl: boolean;
  volumeControl: boolean;
  sensors: boolean;
  autoBrightnessStatus: boolean;
  autoBrightnessControl: boolean;
} {
  return {
    status: true,
    brightnessControl: hasEndpoint(apiIndex, '/api/brightness') || hasStatusPath(status, ['screen', 'brightness']),
    volumeControl: hasEndpoint(apiIndex, '/api/volume') || hasStatusPath(status, ['audio', 'volume']),
    sensors: hasEndpoint(apiIndex, '/api/sensors') || hasStatusPath(status, ['sensors']),
    autoBrightnessStatus: hasEndpoint(apiIndex, '/api/autoBrightness') || hasStatusPath(status, ['autoBrightness']),
    autoBrightnessControl: hasEndpoint(apiIndex, '/api/autoBrightness/enable')
      && hasEndpoint(apiIndex, '/api/autoBrightness/disable'),
  };
}

function hasEndpoint(apiIndex: unknown, endpoint: string): boolean {
  if (!isRecord(apiIndex) || !isRecord(apiIndex.endpoints)) return false;
  return Object.values(apiIndex.endpoints).some((entries) => (
    Array.isArray(entries) && entries.some((entry) => String(entry).startsWith(endpoint))
  ));
}

function hasStatusPath(status: unknown, path: string[]): boolean {
  let cursor = status;
  for (const segment of path) {
    if (!isRecord(cursor) || !(segment in cursor)) return false;
    cursor = cursor[segment];
  }
  return true;
}

function remoteErrorMessage(payload: unknown, statusCode: number): string {
  if (isRecord(payload)) {
    if (typeof payload.error === 'string') return payload.error;
    if (isRecord(payload.error)) return String(payload.error.message ?? 'FreeKiosk command failed.');
  }
  return `FreeKiosk command failed with HTTP ${statusCode}.`;
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
    case 'mute-toggle':
      return '/api/remote/up';
    case 'screen-on':
      return '/api/screen/on';
    case 'screen-off':
      return '/api/screen/off';
    case 'volume-up':
      return '/api/remote/keyboard/volumeup';
    case 'volume-down':
      return '/api/remote/keyboard/volumedown';
    case 'device-mute-toggle':
      return '/api/remote/keyboard/mute';
    case 'dpad-up':
      return '/api/remote/up';
  }
}

function commandUsesFrameEvents(command: FrameCommand): boolean {
  return command === 'next'
    || command === 'previous'
    || command === 'play-pause'
    || command === 'reload'
    || command === 'mute-toggle';
}

function commandPrefersRemotePress(command: FrameCommand): boolean {
  return command === 'mute-toggle';
}

function remoteFallbackAvailable(device: FrameDevice, command: FrameCommand): boolean {
  return commandUsesFrameEvents(command)
    && (device.remoteControlType ?? 'none') === 'freekiosk'
    && remoteEndpointCandidates(device).length > 0;
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

function proxyRequestSignal(method: string): AbortSignal | undefined {
  return method === 'GET' || method === 'HEAD' ? undefined : AbortSignal.timeout(15000);
}

interface ForwardProxyHeadersOptions {
  includeContentLength?: boolean;
}

function forwardProxyHeaders(
  response: Response,
  reply: FastifyReply,
  options: ForwardProxyHeadersOptions = {},
): void {
  for (const header of PROXY_RESPONSE_HEADERS) {
    const value = response.headers.get(header);
    if (value) reply.header(header, value);
  }
  if (options.includeContentLength) {
    const contentLength = response.headers.get('content-length');
    if (contentLength) reply.header('content-length', contentLength);
  }
}

function disableProxyTextCache(reply: FastifyReply): void {
  reply.header('cache-control', 'no-store, max-age=0');
  reply.header('pragma', 'no-cache');
  reply.header('expires', '0');
}

async function streamProxyResponse(response: Response, reply: FastifyReply, contentType: string): Promise<void> {
  if (!response.body) {
    reply.status(response.status).send();
    return;
  }

  reply.hijack();
  reply.raw.statusCode = response.status;
  if (contentType) reply.raw.setHeader('content-type', contentType);
  for (const header of PROXY_RESPONSE_HEADERS) {
    const value = response.headers.get(header);
    if (value) reply.raw.setHeader(header, value);
  }
  const contentLength = response.headers.get('content-length');
  if (contentLength) reply.raw.setHeader('content-length', contentLength);
  await pipeline(Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>), reply.raw);
}

const PROXY_RESPONSE_HEADERS = [
  'accept-ranges',
  'cache-control',
  'content-disposition',
  'content-range',
  'etag',
  'expires',
  'last-modified',
  'set-cookie',
  'vary',
] as const;

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
    const rewritten = value.replace(/(["'`])\/(assets|asset)(?=[/"'`?])/g, `$1${normalizedPrefix}/$2`);
    return `${rewritten}\n${KIOSK_PROXY_COMPAT_JS}`;
  }
  if (normalizedContentType.startsWith('text/css')) {
    const rewritten = value.replace(/url\((["']?)\/(?!\/|kiosk-proxy\/)/g, `url($1${normalizedPrefix}/`);
    return rewritten.includes('.frame--background') ? `${rewritten}\n${KIOSK_PROXY_COMPAT_CSS}` : rewritten;
  }
  const rewritten = value
    .replace(/\b(href|src|action|poster|manifest|hx-get|hx-post|hx-put|hx-patch|hx-delete)=("|')\/(?!\/|kiosk-proxy\/)/g, `$1=$2${normalizedPrefix}/`)
    .replace(/url\((["']?)\/(?!\/|kiosk-proxy\/)/g, `url($1${normalizedPrefix}/`);
  return appendProxyCacheBuster(rewritten, normalizedPrefix);
}

function appendProxyCacheBuster(value: string, proxyPrefix: string): string {
  const escapedPrefix = escapeRegExp(proxyPrefix);
  const version = encodeURIComponent(process.env.BUILD_VERSION ?? process.env.npm_package_version ?? 'dev');
  const proxyAssetPattern = new RegExp(
    `\\b(href|src)=("|')(${escapedPrefix}/[^"'?#]+\\.(?:css|js))(\\?[^"']*)?\\2`,
    'g',
  );

  return value.replace(proxyAssetPattern, (match, attribute: string, quote: string, path: string, query?: string) => {
    if (query?.includes('_ifc=')) return match;
    const separator = query ? '&' : '?';
    return `${attribute}=${quote}${path}${query ?? ''}${separator}_ifc=${version}${quote}`;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KIOSK_PROXY_COMPAT_CSS = `
/* Immich Frame Controller: legacy Android WebView background-fill fix. */
.frame {
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
}
.frame--background {
  top: -8% !important;
  right: -8% !important;
  bottom: -8% !important;
  left: -8% !important;
  width: auto !important;
  height: auto !important;
  overflow: hidden !important;
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}
.frame--background img {
  position: absolute !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 100% !important;
  min-height: 100% !important;
  object-fit: cover !important;
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
}

/* Immich Frame Controller: bottom slide-up image description treatment. */
:root {
  --ifc-description-scroll-duration: 52s;
  --ifc-description-area-height: 5.75rem;
  --ifc-description-mobile-area-height: 5.25rem;
  --ifc-description-overlay-opacity: 0.1;
}
.asset-metadata-container {
  box-sizing: border-box !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
}
.asset--metadata {
  flex: 1 1 auto !important;
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
}
.asset--metadata--description {
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: 72rem !important;
  align-items: flex-start !important;
  gap: 0.6rem !important;
  overflow: hidden !important;
  padding: 0.45rem 0.65rem !important;
  border-radius: 0.375rem !important;
  background: rgba(0, 0, 0, var(--ifc-description-overlay-opacity, 0.1)) !important;
}
.asset--metadata--description .asset--metadata--icon {
  flex: 0 0 0.9rem !important;
  margin-top: 0.18rem !important;
  opacity: 0.68 !important;
}
.asset--metadata--description > div:last-child {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  max-height: var(--ifc-description-area-height, 5.75rem) !important;
  overflow: hidden !important;
}
.asset--metadata--description.immich-frame-description-is-long {
  max-height: calc(var(--ifc-description-area-height, 5.75rem) + 1.45rem) !important;
}
.asset--metadata--description.immich-frame-description-is-long > div:last-child {
  height: var(--ifc-description-area-height, 5.75rem) !important;
  overflow: hidden !important;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 14%, #000 84%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 14%, #000 84%, transparent 100%);
}
.asset--metadata--description small {
  display: block !important;
  font-size: 1.16rem !important;
  line-height: 1.45 !important;
  overflow-wrap: anywhere !important;
  white-space: normal !important;
  transform: none !important;
}
.asset--metadata--description.immich-frame-description-is-long small {
  animation: immich-frame-description-slide-up var(--ifc-description-scroll-duration, 52s) linear infinite;
  will-change: transform;
}
@keyframes immich-frame-description-slide-up {
  0% {
    transform: translateY(0);
  }
  16% {
    transform: translateY(0);
  }
  82% {
    transform: translateY(var(--ifc-description-scroll-distance, 0px));
  }
  92% {
    transform: translateY(var(--ifc-description-scroll-distance, 0px));
  }
  100% {
    transform: translateY(0);
  }
}
@media screen and (max-width: 31.25rem) {
  .asset--metadata {
    max-width: 100% !important;
  }
  .asset--metadata--description {
    padding: 0.4rem 0.55rem !important;
  }
  .asset--metadata--description.immich-frame-description-is-long {
    max-height: calc(var(--ifc-description-mobile-area-height, 5.25rem) + 1.35rem) !important;
  }
  .asset--metadata--description.immich-frame-description-is-long > div:last-child {
    height: var(--ifc-description-mobile-area-height, 5.25rem) !important;
  }
  .asset--metadata--description > div:last-child {
    max-height: var(--ifc-description-mobile-area-height, 5.25rem) !important;
  }
  .asset--metadata--description small {
    font-size: 0.95rem !important;
  }
  @keyframes immich-frame-description-slide-up {
    0% {
      transform: translateY(0);
    }
    16% {
      transform: translateY(0);
    }
    82% {
      transform: translateY(var(--ifc-description-scroll-distance, 0px));
    }
    92% {
      transform: translateY(var(--ifc-description-scroll-distance, 0px));
    }
    100% {
      transform: translateY(0);
    }
  }
}
@media (prefers-reduced-motion: reduce) {
  .asset--metadata--description.immich-frame-description-is-long small {
    animation: none !important;
    transform: none !important;
  }
}
`;

const KIOSK_PROXY_COMPAT_JS = `
/* Immich Frame Controller: image description overflow helper. */
;(function () {
  if (typeof window === 'undefined' || !window.document || window.__immichFrameDescriptionHelper) return;
  window.__immichFrameDescriptionHelper = true;

  var LONG_CLASS = 'immich-frame-description-is-long';
  var DEFAULTS = {
    scrollDuration: 52,
    areaHeight: 5.75,
    overlayOpacity: 10,
    longThresholdLines: 3.25,
  };
  var settings = {
    areaHeight: DEFAULTS.areaHeight,
    mobileAreaHeight: 5.25,
    longThresholdLines: DEFAULTS.longThresholdLines,
  };
  var scheduled = false;

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function numericPx(value, fallback) {
    var parsed = parseFloat(value);
    return isFiniteNumber(parsed) ? parsed : fallback;
  }

  function rounded(value) {
    return String(Math.round(value * 1000) / 1000);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function decodeQueryValue(value) {
    try {
      return decodeURIComponent(value.replace(/\\+/g, ' '));
    } catch (_error) {
      return value;
    }
  }

  function queryParam(name) {
    var query = window.location.search ? window.location.search.substring(1).split('&') : [];
    for (var index = 0; index < query.length; index += 1) {
      var pair = query[index].split('=');
      if (decodeQueryValue(pair[0] || '') === name) {
        return decodeQueryValue(pair.slice(1).join('='));
      }
    }
    return '';
  }

  function readNumber(name, fallback, min, max) {
    var raw = queryParam(name);
    var parsed = parseFloat(raw);
    if (!isFiniteNumber(parsed)) return fallback;
    return clamp(parsed, min, max);
  }

  function viewportUsesMobileArea() {
    return Boolean(window.matchMedia && window.matchMedia('screen and (max-width: 31.25rem)').matches);
  }

  function elementHeight(element) {
    var rect = element.getBoundingClientRect();
    return Math.max(element.scrollHeight || 0, element.offsetHeight || 0, rect.height || 0);
  }

  function applySettings() {
    var duration = readNumber('ifc_description_scroll_duration', DEFAULTS.scrollDuration, 10, 240);
    var areaHeight = readNumber('ifc_description_area_height', DEFAULTS.areaHeight, 3, 12);
    var overlayOpacity = readNumber('ifc_description_overlay_opacity', DEFAULTS.overlayOpacity, 0, 60);
    var longThresholdLines = readNumber(
      'ifc_description_long_threshold_lines',
      DEFAULTS.longThresholdLines,
      2,
      10
    );
    var mobileAreaHeight = Math.max(3, areaHeight - 0.5);
    var root = document.documentElement;

    settings.areaHeight = areaHeight;
    settings.mobileAreaHeight = mobileAreaHeight;
    settings.longThresholdLines = longThresholdLines;
    root.style.setProperty('--ifc-description-scroll-duration', rounded(duration) + 's');
    root.style.setProperty('--ifc-description-area-height', rounded(areaHeight) + 'rem');
    root.style.setProperty('--ifc-description-mobile-area-height', rounded(mobileAreaHeight) + 'rem');
    root.style.setProperty('--ifc-description-overlay-opacity', rounded(overlayOpacity / 100));
  }

  function updateDescription(description) {
    var text = description.querySelector('small');
    if (!text) return;

    var style = window.getComputedStyle(text);
    var fontSize = numericPx(style.fontSize, 16);
    var lineHeight = numericPx(style.lineHeight, fontSize * 1.45);
    var rootStyle = window.getComputedStyle(document.documentElement);
    var rootFontSize = numericPx(rootStyle.fontSize, 16);
    var visibleAreaHeight = (viewportUsesMobileArea() ? settings.mobileAreaHeight : settings.areaHeight) * rootFontSize;
    var naturalHeight = elementHeight(text);
    var exceedsLineThreshold = naturalHeight > lineHeight * settings.longThresholdLines;
    var exceedsAreaHeight = naturalHeight > visibleAreaHeight + 1;
    var isLong = exceedsLineThreshold && exceedsAreaHeight;

    if (isLong) {
      var scrollDistance = Math.min(0, visibleAreaHeight - naturalHeight - Math.max(4, lineHeight * 0.35));
      description.style.setProperty('--ifc-description-scroll-distance', rounded(scrollDistance) + 'px');
      description.classList.add(LONG_CLASS);
    } else {
      description.style.removeProperty('--ifc-description-scroll-distance');
      description.classList.remove(LONG_CLASS);
    }
  }

  function scanDescriptions() {
    scheduled = false;
    applySettings();
    var descriptions = document.querySelectorAll('.asset--metadata--description');
    for (var index = 0; index < descriptions.length; index += 1) {
      updateDescription(descriptions[index]);
    }
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame
      ? window.requestAnimationFrame(scanDescriptions)
      : window.setTimeout(scanDescriptions, 16);
  }

  document.addEventListener('DOMContentLoaded', scheduleScan);
  window.addEventListener('load', scheduleScan);
  window.addEventListener('resize', scheduleScan);

  if (window.MutationObserver) {
    new MutationObserver(scheduleScan).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  } else {
    window.setInterval(scheduleScan, 1500);
  }

  scheduleScan();
})();
`;

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

function publicDevice(device: FrameDevice): Omit<FrameDevice, 'remoteApiKey' | 'kioskPassword'> & {
  remoteApiKeyConfigured: boolean;
  kioskPasswordConfigured: boolean;
  remoteApiAutoUrl?: string;
  remoteApiEffectiveUrl?: string;
  remoteApiEffectiveSource: 'manual' | 'auto' | 'none';
  remoteApiConfigured: boolean;
} {
  const { remoteApiKey: _remoteApiKey, kioskPassword: _kioskPassword, ...publicFields } = device;
  const remote = remoteEndpointSummary(device);
  return {
    ...publicFields,
    remoteControlType: publicFields.remoteControlType ?? 'none',
    remoteApiKeyConfigured: Boolean(_remoteApiKey),
    kioskPasswordConfigured: Boolean(_kioskPassword),
    remoteApiAutoPort: publicFields.remoteApiAutoPort ?? 8080,
    remoteApiAutoUrl: remote.autoUrl,
    remoteApiEffectiveUrl: remote.effectiveUrl,
    remoteApiEffectiveSource: remote.effectiveSource,
    remoteApiConfigured: remote.configured,
  };
}

function remoteEndpointSummary(device: FrameDevice): {
  autoUrl?: string;
  effectiveUrl?: string;
  effectiveSource: 'manual' | 'auto' | 'none';
  configured: boolean;
} {
  const candidates = remoteEndpointCandidates(device);
  const effective = candidates[0];
  return {
    autoUrl: buildAutoRemoteApiUrl(device),
    effectiveUrl: effective?.baseUrl,
    effectiveSource: effective?.source ?? 'none',
    configured: candidates.length > 0,
  };
}

function remoteEndpointCandidates(device: FrameDevice): Array<{ baseUrl: string; source: 'manual' | 'auto' }> {
  const candidates: Array<{ baseUrl: string; source: 'manual' | 'auto' }> = [];
  if (device.remoteApiUrl) {
    candidates.push({ baseUrl: trimTrailingSlash(device.remoteApiUrl), source: 'manual' });
  }
  const autoUrl = buildAutoRemoteApiUrl(device);
  if (autoUrl && !candidates.some((candidate) => candidate.baseUrl === autoUrl)) {
    candidates.push({ baseUrl: autoUrl, source: 'auto' });
  }
  return candidates;
}

function buildAutoRemoteApiUrl(device: FrameDevice): string | undefined {
  if (!device.lastSeenIp || !isAutoRemoteCandidateIp(device.lastSeenIp)) return undefined;
  const port = device.remoteApiAutoPort ?? 8080;
  const host = device.lastSeenIp.includes(':') ? `[${device.lastSeenIp}]` : device.lastSeenIp;
  return `http://${host}:${port}`;
}

function requestClientIp(request: FastifyRequest): string | undefined {
  const forwardedFor = request.headers['x-forwarded-for'];
  const firstForwardedFor = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const raw = firstForwardedFor?.split(',')[0]?.trim() || request.ip;
  return normalizeIp(raw);
}

function normalizeIp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let candidate = value.trim();
  if (candidate.startsWith('::ffff:')) candidate = candidate.slice('::ffff:'.length);
  if (candidate.startsWith('[') && candidate.includes(']')) {
    candidate = candidate.slice(1, candidate.indexOf(']'));
  } else if (candidate.includes(':') && candidate.split(':').length === 2 && isIP(candidate) === 0) {
    candidate = candidate.split(':')[0] ?? candidate;
  }
  return isIP(candidate) ? candidate : undefined;
}

function isAutoRemoteCandidateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map((part) => Number(part));
    const [a, b] = parts;
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    return a === 10
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 169 && b === 254)
      || (a === 100 && b >= 64 && b <= 127);
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    return normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80:');
  }
  return false;
}

function isFreeKioskStatusForDevice(payload: unknown, device: FrameDevice, ip: string): boolean {
  const data = freeKioskStatusData(payload);
  if (!data || !isRecord(data.device) || !isRecord(data.webview)) return false;

  const statusIp = typeof data.device.ip === 'string' ? normalizeIp(data.device.ip) : undefined;
  if (statusIp && statusIp !== ip) return false;

  const currentUrl = data.webview.currentUrl;
  return typeof currentUrl === 'string' && isFrameUrlForDevice(currentUrl, device);
}

function freeKioskStatusData(payload: unknown): Record<string, unknown> | undefined {
  if (!isRecord(payload)) return undefined;
  if ('success' in payload && payload.success !== true) return undefined;
  return isRecord(payload.data) ? payload.data : payload;
}

function isFrameUrlForDevice(value: string, device: FrameDevice): boolean {
  let path: string;
  try {
    path = new URL(value, device.localControllerBaseUrl).pathname;
  } catch {
    return false;
  }

  const normalizedPath = trimTrailingSlash(path);
  const id = encodeURIComponent(device.id);
  const alias = encodeURIComponent(device.alias ?? device.id);
  const candidates = [
    `/frame/${id}`,
    `/f/${alias}`,
    `/kiosk-proxy/${id}`,
  ];
  return candidates.some((candidate) => (
    normalizedPath === candidate || normalizedPath.startsWith(`${candidate}/`)
  ));
}

function isLocalControllerRequest(device: FrameDevice, request: FastifyRequest): boolean {
  const context = requestContext(request);
  if (!context.host) return false;
  try {
    return normalizeHost(context.host) === normalizeHost(new URL(device.localControllerBaseUrl).host);
  } catch {
    return false;
  }
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\/+$/, '');
}

function isPreviewRequest(request: FastifyRequest): boolean {
  const referer = Array.isArray(request.headers.referer) ? request.headers.referer[0] : request.headers.referer;
  return request.url.includes('preview=1')
    || Boolean(referer && (referer.includes('preview=1') || referer.includes('/setup')));
}

function publicFrameClaim(claim: FrameClaim): Omit<FrameClaim, 'codeHash'> & {
  status: 'pending' | 'claimed' | 'expired';
} {
  const { codeHash: _codeHash, ...publicFields } = claim;
  const expired = !claim.claimedDeviceId && Date.parse(claim.expiresAt) <= Date.now();
  return {
    ...publicFields,
    status: claim.claimedDeviceId ? 'claimed' : expired ? 'expired' : 'pending',
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
    alias: input.alias,
    networkMode: input.networkMode,
    previewOrientation: input.previewOrientation,
    localControllerBaseUrl: trimTrailingSlash(input.localControllerBaseUrl ?? defaultDevice.localControllerBaseUrl),
    externalControllerBaseUrl: input.externalControllerBaseUrl
      ? trimTrailingSlash(input.externalControllerBaseUrl)
      : defaultDevice.externalControllerBaseUrl,
    localKioskBaseUrl: trimTrailingSlash(input.localKioskBaseUrl ?? defaultDevice.localKioskBaseUrl),
    externalKioskBaseUrl: input.externalKioskBaseUrl
      ? trimTrailingSlash(input.externalKioskBaseUrl)
      : defaultDevice.externalKioskBaseUrl,
    kioskPassword: input.kioskPassword,
    pollIntervalSeconds: input.pollIntervalSeconds,
    remoteControlType: input.remoteControlType,
    remoteApiUrl: input.remoteApiUrl ? trimTrailingSlash(input.remoteApiUrl) : undefined,
    remoteApiAutoPort: input.remoteApiAutoPort,
    remoteApiKey: input.remoteApiKey,
  };
}

function normalizeDevicePatch(input: z.infer<typeof DevicePatchSchema>): Partial<FrameDevice> {
  const patch: Partial<FrameDevice> = {};

  if (hasPatchKey(input, 'name')) patch.name = input.name;
  if (hasPatchKey(input, 'alias')) patch.alias = input.alias ?? undefined;
  if (hasPatchKey(input, 'networkMode')) patch.networkMode = input.networkMode;
  if (hasPatchKey(input, 'previewOrientation')) patch.previewOrientation = input.previewOrientation;
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
  if (hasPatchKey(input, 'kioskPassword')) {
    patch.kioskPassword = input.kioskPassword ?? undefined;
  }
  if (hasPatchKey(input, 'pollIntervalSeconds')) patch.pollIntervalSeconds = input.pollIntervalSeconds;
  if (hasPatchKey(input, 'remoteControlType')) patch.remoteControlType = input.remoteControlType;
  if (hasPatchKey(input, 'remoteApiUrl')) {
    patch.remoteApiUrl = input.remoteApiUrl ? trimTrailingSlash(input.remoteApiUrl) : input.remoteApiUrl;
  }
  if (hasPatchKey(input, 'remoteApiAutoPort')) patch.remoteApiAutoPort = input.remoteApiAutoPort;
  if (hasPatchKey(input, 'remoteApiKey')) patch.remoteApiKey = input.remoteApiKey;

  return patch;
}

function hasPatchKey(input: z.infer<typeof DevicePatchSchema>, key: keyof z.infer<typeof DevicePatchSchema>): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeAlias(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function randomAliasSuffix(): string {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
  let value = '';
  const bytes = randomBytes(4);
  for (let index = 0; index < 4; index += 1) {
    value += alphabet[bytes[index] % alphabet.length];
  }
  return value;
}

function generateFrameClaimCode(): string {
  const digits = String(randomBytes(4).readUInt32BE(0) % 1000000).padStart(6, '0');
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

function normalizeFrameClaimCode(value: string): string {
  return value.replace(/\D/g, '');
}

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function buildFrameUrl(controllerBaseUrl: string, deviceId: string): string {
  return `${trimTrailingSlash(controllerBaseUrl)}/frame/${deviceId}`;
}

function stableFramePath(device: FrameDevice): string {
  return `/f/${encodeURIComponent(device.alias ?? device.id)}`;
}

function buildStableFrameUrl(controllerBaseUrl: string, device: FrameDevice): string {
  return `${trimTrailingSlash(controllerBaseUrl)}${stableFramePath(device)}`;
}

function kioskPasswordForDevice(device: FrameDevice, globalKioskPassword: string | undefined): string | undefined {
  return device.kioskPassword || globalKioskPassword;
}

function kioskPasswordSource(device: FrameDevice, globalKioskPassword: string | undefined): 'device' | 'global' | 'none' {
  if (device.kioskPassword) return 'device';
  if (globalKioskPassword) return 'global';
  return 'none';
}

async function checkKioskConnection(
  device: FrameDevice,
  kioskPassword: string | undefined,
): Promise<{
  status: 'ok' | 'unauthorized' | 'error';
  statusCode?: number;
  message: string;
  checkedAt: string;
}> {
  const checkedAt = new Date().toISOString();
  let url: URL;
  try {
    url = new URL('/', `${trimTrailingSlash(device.localKioskBaseUrl)}/`);
    if (kioskPassword) url.searchParams.set('password', kioskPassword);
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      checkedAt,
    };
  }

  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(1500),
    });
    await response.body?.cancel().catch(() => undefined);
    if (response.status >= 200 && response.status < 400) {
      return {
        status: 'ok',
        statusCode: response.status,
        message: 'Reachable',
        checkedAt,
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        status: 'unauthorized',
        statusCode: response.status,
        message: kioskPassword
          ? 'Unauthorized. Check the kiosk password.'
          : 'Unauthorized. Set kiosk_password or a device override.',
        checkedAt,
      };
    }
    return {
      status: 'error',
      statusCode: response.status,
      message: `Kiosk returned HTTP ${response.status}`,
      checkedAt,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      checkedAt,
    };
  }
}

function validateAlbumIds(albumIds: string[] | undefined, cache: AlbumCache): string | undefined {
  if (!albumIds || albumIds.length === 0 || cache.items.length === 0) return undefined;
  const known = new Set(cache.items.map((album) => album.id));
  const missing = albumIds.filter((albumId) => !known.has(albumId));
  return missing.length > 0 ? `Unknown album ids: ${missing.join(', ')}` : undefined;
}

function validatePersonIds(personIds: string[] | undefined, cache: PersonCache): string | undefined {
  if (!personIds || personIds.length === 0 || cache.items.length === 0) return undefined;
  const known = new Set(cache.items.map((person) => person.id));
  const missing = personIds.filter((personId) => personId !== 'all' && !known.has(personId));
  return missing.length > 0 ? `Unknown person ids: ${missing.join(', ')}` : undefined;
}
