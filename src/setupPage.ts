interface SetupPageParams {
  controllerUrl: string;
  deviceId: string;
  ingressPath?: string;
  pairingCode: string;
  expiresAt: string;
  albumCount: number;
  albumRefreshedAt?: string;
  personCount: number;
  personRefreshedAt?: string;
  globalKioskPasswordConfigured: boolean;
  mqtt: SetupPageMqttStatus;
  frameClaims: SetupPageFrameClaim[];
  devices: SetupPageDevice[];
}

interface SetupPageMqttDevice {
  topicId: string;
  availability: 'online' | 'offline' | 'unknown';
  ip?: string;
  stateReceivedAt?: string;
  boundDeviceId?: string;
  suggestedDeviceId?: string;
  telemetrySubscribers?: number;
}

interface SetupPageMqttStatus {
  enabled: boolean;
  connected: boolean;
  brokerUrl?: string;
  baseTopic?: string;
  lastError?: string;
  telemetrySubscribers?: number;
  devices: SetupPageMqttDevice[];
}

interface SetupPageFrameClaim {
  id: string;
  createdAt: string;
  expiresAt: string;
  claimedDeviceId?: string;
  claimedAt?: string;
  requestHost?: string;
  status: 'pending' | 'claimed' | 'expired';
}

interface SetupPageKioskConnection {
  status: 'ok' | 'unauthorized' | 'error';
  statusCode?: number;
  message: string;
  checkedAt: string;
}

interface SetupPageDevice {
  id: string;
  name: string;
  alias?: string;
  localControllerBaseUrl: string;
  externalControllerBaseUrl?: string;
  localKioskBaseUrl: string;
  externalKioskBaseUrl?: string;
  kioskPasswordConfigured: boolean;
  kioskPasswordSource: 'device' | 'global' | 'none';
  kioskConnection?: SetupPageKioskConnection;
  frameEventClients: number;
  deviceNetworkMode: string;
  pollIntervalSeconds: number;
  remoteControlType?: string;
  previewOrientation?: string;
  remoteApiUrl?: string;
  remoteApiAutoPort?: number;
  remoteApiAutoUrl?: string;
  remoteApiEffectiveUrl?: string;
  remoteApiEffectiveSource?: string;
  remoteApiConfigured?: boolean;
  lastSeenIp?: string;
  lastSeenAt?: string;
  remoteApiKeyConfigured?: boolean;
  mqttTopicId?: string;
  remoteAvailability?: string;
  isDefault: boolean;
  localFrameUrl: string;
  localStableFrameUrl: string;
  externalFrameUrl?: string;
  externalStableFrameUrl?: string;
  rendererUrl?: string;
  networkMode?: string;
  resolvedNetworkMode?: string;
  durationSeconds?: number;
  imageFit?: string;
  albumOrder?: string;
  showTime?: boolean;
  timeFormat?: string;
  showAmPm?: boolean;
  showSeconds?: boolean;
  showDate?: boolean;
  dateFormat?: string;
  clockSource?: string;
  showWeather?: boolean;
  weatherLocation?: string;
  weatherRotationInterval?: number;
  weatherShowForecast?: string;
  weatherShowHumidity?: string;
  weatherShowWind?: string;
  weatherShowWindDirection?: string;
  weatherShowVisibility?: string;
  weatherShowTemperatureRange?: string;
  weatherRoundTemperature?: string;
  transition?: string;
  layout?: string;
  imageEffect?: string;
  backgroundBlur?: boolean;
  backgroundBlurAmount?: number;
  fontSize?: number;
  frameless?: boolean;
  disableNavigation?: boolean;
  hideCursor?: boolean;
  showProgressBar?: boolean;
  showVideos?: boolean;
  excludeVideosOver?: number;
  showArchived?: boolean;
  showImageRating?: boolean;
  showOwner?: boolean;
  showAlbumName?: boolean;
  showPersonName?: boolean;
  showPersonAge?: boolean;
  showImageTime?: boolean;
  imageTimeFormat?: string;
  showImageDate?: boolean;
  imageDateFormat?: string;
  showImageDescription?: boolean;
  imageDescriptionScrollDuration?: number;
  imageDescriptionScrollSpeed?: number;
  imageDescriptionStartDelay?: number;
  imageDescriptionAreaHeight?: number;
  imageDescriptionOverlayOpacity?: number;
  imageDescriptionLongThresholdLines?: number;
  showImageCamera?: boolean;
  showImageExif?: boolean;
  showImageLocation?: boolean;
  showImageQr?: boolean;
  showImageId?: boolean;
  showUser?: boolean;
  showMoreInfo?: boolean;
  filterDate?: string;
  filterNewest?: number;
  upArrowAction?: string;
  downArrowAction?: string;
  progressBarPosition?: string;
  burnInInterval?: number;
  burnInDuration?: number;
  burnInOpacity?: number;
  sleepStart: string;
  sleepEnd: string;
  disableSleep: boolean;
}

export function renderSetupPage(params: SetupPageParams): string {
  const expires = new Date(params.expiresAt).toLocaleString();
  const refreshedAt = params.albumRefreshedAt
    ? new Date(params.albumRefreshedAt).toLocaleString()
    : 'Not refreshed yet';
  const peopleRefreshedAt = params.personRefreshedAt
    ? new Date(params.personRefreshedAt).toLocaleString()
    : 'People not refreshed yet';
  const defaultDevice = params.devices.find((device) => device.isDefault) ?? params.devices[0];
  const inheritedLocalControllerUrl = defaultDevice?.localControllerBaseUrl ?? params.controllerUrl;
  const inheritedLocalKioskUrl = defaultDevice?.localKioskBaseUrl ?? 'http://homeassistant.local:3000';
  const inheritedExternalControllerUrl = defaultDevice?.externalControllerBaseUrl;
  const inheritedExternalKioskUrl = defaultDevice?.externalKioskBaseUrl;
  const inheritedNetworkMode = defaultDevice?.networkMode ?? defaultDevice?.deviceNetworkMode ?? 'auto';
  const inheritedPollIntervalSeconds = defaultDevice?.pollIntervalSeconds ?? 20;
  const inheritedRemoteControlType = defaultDevice?.remoteControlType ?? 'none';
  const inheritedPreviewOrientation = previewOrientation(defaultDevice);
  const defaultFrameUrl = defaultDevice?.localStableFrameUrl
    ?? `${params.controllerUrl.replace(/\/+$/, '')}/frame/${params.deviceId}`;
  const pairUrl = `${params.controllerUrl.replace(/\/+$/, '')}/pair`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Immich Frame Controller</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f7fa;
      color: #171b22;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        linear-gradient(180deg, #eef4f8 0, #f7f8fa 360px),
        #f7f8fa;
    }
    main {
      width: min(1180px, 100%);
      margin: 0 auto;
      padding: 28px;
    }
    header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      align-items: end;
      margin-bottom: 18px;
    }
    h1,
    h2,
    h3,
    p {
      margin: 0;
    }
    h1 {
      font-size: 30px;
      line-height: 1.1;
      font-weight: 720;
    }
    h2 {
      font-size: 18px;
      line-height: 1.2;
      font-weight: 680;
    }
    h3 {
      font-size: 15px;
      line-height: 1.2;
      font-weight: 670;
    }
    .subtitle {
      color: #556170;
      margin-top: 8px;
      max-width: 760px;
      line-height: 1.45;
    }
    .eyebrow {
      color: #087e8b;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
    .panel,
    .device {
      background: #ffffff;
      border: 1px solid #dce3ea;
      border-radius: 8px;
      box-shadow: 0 12px 32px rgb(24 33 44 / 8%);
    }
    .panel {
      padding: 18px;
    }
    .grid {
      display: grid;
      gap: 14px;
    }
    .summary {
      grid-template-columns: minmax(220px, 1.3fr) repeat(4, minmax(140px, .7fr));
      margin-bottom: 18px;
    }
    .metric {
      min-width: 0;
    }
    .label {
      color: #697586;
      font-size: 12px;
      font-weight: 680;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .value {
      margin-top: 7px;
      color: #171b22;
      font-size: 18px;
      font-weight: 670;
      overflow-wrap: anywhere;
    }
    .value.large {
      font-size: 30px;
      letter-spacing: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .muted {
      color: #697586;
    }
    .help-text {
      color: #697586;
      font-size: 12px;
      line-height: 1.35;
    }
    [hidden] {
      display: none !important;
    }
    .url-missing {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      border: 1px dashed #cfd8e2;
      border-radius: 7px;
      padding: 10px 12px;
      color: #697586;
      background: #fbfcfd;
      font-size: 13px;
    }
    .url-missing span {
      min-width: min(440px, 100%);
      flex: 1;
    }
    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 24px 0 12px;
    }
    .device-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }
    .device {
      overflow: hidden;
    }
    .device-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid #e5ebf1;
      background: #fbfcfd;
    }
    .device-body {
      display: grid;
      gap: 16px;
      padding: 18px;
    }
    .device-content {
      display: grid;
      grid-template-columns: minmax(210px, 260px) minmax(0, 1fr);
      align-items: start;
    }
    .device-content.portrait {
      grid-template-columns: minmax(150px, 210px) minmax(0, 1fr);
    }
    .device-preview {
      padding: 18px 0 18px 18px;
    }
    .preview-frame {
      position: sticky;
      top: 18px;
      overflow: hidden;
      aspect-ratio: 16 / 10;
      border: 1px solid #d8e0e8;
      border-radius: 8px;
      background: #111827;
    }
    .preview-frame.portrait {
      width: min(170px, 100%);
      aspect-ratio: 10 / 16;
      margin: 0 auto;
    }
    .preview-frame iframe {
      width: 400%;
      height: 400%;
      border: 0;
      pointer-events: none;
      transform: scale(.25);
      transform-origin: top left;
      background: #111827;
    }
    .frame-details .kv {
      margin-top: 12px;
    }
    .stack {
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      min-width: 0;
    }
    .kv {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .kv div {
      min-width: 0;
      border: 1px solid #e5ebf1;
      border-radius: 7px;
      padding: 10px;
      background: #fafbfc;
    }
    .kv dt {
      color: #697586;
      font-size: 12px;
      font-weight: 650;
      margin-bottom: 4px;
    }
    .kv dd {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 14px;
      font-weight: 620;
    }
    code {
      display: block;
      width: 100%;
      overflow: auto;
      white-space: nowrap;
      border: 1px solid #d8e0e8;
      border-radius: 7px;
      padding: 10px 12px;
      color: #111827;
      background: #f6f8fa;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
    }
    .form-lead code,
    .help-text code {
      display: inline;
      width: auto;
      border: 0;
      padding: 0;
      background: transparent;
      font-size: inherit;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 25px;
      border: 1px solid #cfd8e2;
      border-radius: 999px;
      padding: 3px 9px;
      color: #314254;
      background: #ffffff;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .pill.ok {
      color: #065f46;
      border-color: #a7f3d0;
      background: #ecfdf5;
    }
    .pill.warn {
      color: #92400e;
      border-color: #fde68a;
      background: #fffbeb;
    }
    button {
      appearance: none;
      border: 1px solid #cfd8e2;
      border-radius: 7px;
      background: #ffffff;
      color: #263241;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      padding: 8px 11px;
    }
    button:hover {
      border-color: #8aa0b6;
      background: #f8fafc;
    }
    .primary {
      border-color: #087e8b;
      background: #087e8b;
      color: #ffffff;
    }
    .primary:hover {
      border-color: #066a75;
      background: #066a75;
    }
    .danger {
      color: #991b1b;
      border-color: #fecaca;
      background: #fff7f7;
    }
    .danger:hover {
      border-color: #fca5a5;
      background: #fee2e2;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .form-lead {
      grid-column: 1 / -1;
      max-width: 760px;
      color: #5d6877;
      font-size: 13px;
      line-height: 1.45;
    }
    .field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .field.full {
      grid-column: 1 / -1;
    }
    .checkbox-field {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #4b5563;
      font-size: 13px;
      line-height: 1.35;
    }
    .checkbox-field input {
      width: auto;
      min-height: auto;
    }
    input,
    select {
      width: 100%;
      min-height: 38px;
      border: 1px solid #cfd8e2;
      border-radius: 7px;
      padding: 8px 10px;
      background: #ffffff;
      color: #171b22;
      font: inherit;
      font-size: 14px;
    }
    input:focus,
    select:focus {
      outline: 2px solid rgb(8 126 139 / 22%);
      border-color: #087e8b;
    }
    .orientation-picker {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      width: 100%;
    }
    .orientation-picker label {
      display: block;
      position: relative;
      min-width: 0;
    }
    .orientation-picker input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
    .orientation-option {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-height: 68px;
      border: 1px solid #cfd8e2;
      border-radius: 8px;
      padding: 8px;
      background: #ffffff;
      color: #314254;
      font-weight: 700;
      cursor: pointer;
    }
    .orientation-picker input:checked + .orientation-option {
      border-color: #087e8b;
      background: #eefafa;
      color: #087e8b;
      box-shadow: 0 1px 6px rgb(15 23 42 / 12%);
    }
    .orientation-picker input:focus-visible + .orientation-option {
      outline: 2px solid rgb(8 126 139 / 22%);
      outline-offset: 2px;
    }
    .orientation-frame {
      display: grid;
      width: 52px;
      height: 52px;
      place-items: center;
      border-radius: 7px;
      background: #f8fafc;
    }
    .orientation-screen {
      display: block;
      border: 2px solid #4b5563;
      border-radius: 5px;
      background:
        linear-gradient(135deg, rgb(8 126 139 / 22%), rgb(244 168 62 / 18%)),
        #ffffff;
      box-shadow: inset 0 0 0 2px rgb(255 255 255 / 72%);
    }
    .orientation-screen.landscape {
      width: 44px;
      height: 28px;
    }
    .orientation-screen.portrait {
      width: 28px;
      height: 44px;
    }
    .orientation-picker input:checked + .orientation-option .orientation-screen {
      border-color: #087e8b;
    }
    .orientation-text {
      min-width: 0;
      overflow-wrap: anywhere;
      font-size: 13px;
      line-height: 1.2;
    }
    a {
      color: #087e8b;
      font-weight: 700;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .inline-link {
      margin-left: 8px;
      font-size: 12px;
      text-transform: none;
    }
    .label-with-info {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      width: fit-content;
    }
    .info-dot {
      display: inline-grid;
      width: 16px;
      height: 16px;
      place-items: center;
      border: 1px solid #a8b6c5;
      border-radius: 50%;
      color: #087e8b;
      background: #ffffff;
      font-size: 11px;
      font-weight: 800;
      line-height: 1;
      text-transform: none;
      cursor: help;
    }
    .info-popover {
      position: absolute;
      z-index: 20;
      top: calc(100% + 8px);
      left: 0;
      width: min(320px, 80vw);
      border: 1px solid #cfd8e2;
      border-radius: 8px;
      padding: 10px 12px;
      color: #475569;
      background: #ffffff;
      box-shadow: 0 12px 30px rgb(24 33 44 / 16%);
      font-size: 12px;
      font-weight: 500;
      line-height: 1.4;
      opacity: 0;
      pointer-events: none;
      text-transform: none;
      transform: translateY(-3px);
      transition: opacity .12s ease, transform .12s ease;
      visibility: hidden;
    }
    .label-with-info:hover .info-popover,
    .label-with-info:focus-within .info-popover {
      opacity: 1;
      transform: translateY(0);
      visibility: visible;
    }
    details {
      border: 1px solid #e5ebf1;
      border-radius: 8px;
      background: #ffffff;
      padding: 12px;
    }
    details.full {
      grid-column: 1 / -1;
    }
    summary {
      cursor: pointer;
      color: #263241;
      font-weight: 700;
    }
    .summary-hint {
      color: #697586;
      font-size: 12px;
      font-weight: 500;
      margin-left: 6px;
    }
    .advanced-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .inherited {
      color: #697586;
      font-size: 12px;
      line-height: 1.35;
    }
    .form-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
      grid-column: 1 / -1;
    }
    .form-status {
      flex: 1;
      min-width: 160px;
      color: #697586;
      font-size: 13px;
    }
    .recommendations {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }
    .recommendations article {
      border: 1px solid #e5ebf1;
      border-radius: 8px;
      background: #ffffff;
      padding: 14px;
    }
    .recommendations p {
      color: #5d6877;
      font-size: 13px;
      line-height: 1.45;
      margin-top: 7px;
    }
    .claim-list {
      display: grid;
      gap: 8px;
      grid-column: 1 / -1;
    }
    .claim-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      border: 1px solid #e5ebf1;
      border-radius: 7px;
      padding: 9px 11px;
      background: #fbfcfd;
      color: #475569;
      font-size: 13px;
    }
    @media (max-width: 780px) {
      main {
        padding: 18px;
      }
      header,
      .summary {
        grid-template-columns: 1fr;
      }
      .toolbar {
        justify-content: flex-start;
      }
      .kv {
        grid-template-columns: 1fr;
      }
      .device-content {
        grid-template-columns: 1fr;
      }
      .device-preview {
        padding: 14px 14px 0;
      }
      .preview-frame {
        position: static;
      }
      .form-grid {
        grid-template-columns: 1fr;
      }
      .advanced-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <div class="eyebrow">Home Assistant Add-on</div>
        <h1>Immich Frame Controller</h1>
        <p class="subtitle">Pair Home Assistant, verify frame URLs, and inspect the immich-kiosk renderer options applied to each fixed frame endpoint.</p>
      </div>
      <div class="toolbar">
        <button type="button" data-copy="${escapeAttribute(params.controllerUrl)}">Copy Controller URL</button>
        <button type="button" data-copy="${escapeAttribute(pairUrl)}">Copy Pair URL</button>
        <button type="button" data-copy="${escapeAttribute(defaultFrameUrl)}">Copy Default Frame URL</button>
      </div>
    </header>

    <section class="grid summary">
      <div class="panel metric">
        <div class="label">Pairing Code</div>
        <div class="value large">${escapeHtml(params.pairingCode)}</div>
        <p class="muted">Expires ${escapeHtml(expires)}</p>
      </div>
      <div class="panel metric">
        <div class="label">Controller</div>
        <div class="value">${escapeHtml(params.controllerUrl)}</div>
      </div>
      <div class="panel metric">
        <div class="label">Kiosk Password</div>
        <div class="value">${params.globalKioskPasswordConfigured ? 'Configured' : 'Not configured'}</div>
        <p class="muted">Global default</p>
      </div>
      <div class="panel metric">
        <div class="label">Default Device</div>
        <div class="value">${escapeHtml(params.deviceId)}</div>
      </div>
      <div class="panel metric">
        <div class="label">Immich Cache</div>
        <div class="value">${params.albumCount} albums</div>
        <p class="muted">${params.personCount} people / ${escapeHtml(refreshedAt)} / ${escapeHtml(peopleRefreshedAt)}</p>
      </div>
    </section>

    <div class="section-title">
      <h2>Frame Pairing</h2>
      <span class="pill">Short URL install</span>
    </div>
    <section class="panel">
      <form class="form-grid" data-frame-claim>
        <p class="form-lead">Open the Pair URL on a physical frame: <code>${escapeHtml(pairUrl)}</code>. The add-on root URL opens this setup console; <code>/pair</code> shows the six-digit frame code. The claimed frame gets a stable alias path like <code>/f/kitchen-frame-8k2p</code>.</p>
        <label class="field">
          <span class="label">Frame Code</span>
          <input name="claimCode" required inputmode="numeric" autocomplete="one-time-code" placeholder="842 193">
        </label>
        <label class="field">
          <span class="label">Name</span>
          <input name="name" required maxlength="80" placeholder="Kitchen Frame">
        </label>
        <label class="field">
          <span class="label">Alias</span>
          <input name="alias" maxlength="80" pattern="[a-z0-9][a-z0-9-]*" placeholder="auto">
          <span class="help-text">Optional. Blank generates a name-based alias with a short random suffix.</span>
        </label>
        <label class="field">
          <span class="label">Preview Orientation</span>
          <span class="orientation-picker">
            ${renderPreviewOrientationOptions(inheritedPreviewOrientation)}
          </span>
        </label>
        ${renderFrameClaimRows(params.frameClaims)}
        <div class="form-actions">
          <span class="form-status" data-form-status></span>
          <button type="submit" class="primary">Claim Frame</button>
        </div>
      </form>
    </section>

    <div class="section-title">
      <h2>Device Management</h2>
      <span class="pill ok">Separate frame state</span>
    </div>
    <section class="panel">
      <form class="form-grid" data-device-create>
        <p class="form-lead">Add a frame with a stable device ID and display name. Leave inherited URL fields blank unless this frame needs a different route than the add-on defaults.</p>
        <label class="field">
          <span class="label">Device ID</span>
          <input name="id" required pattern="[a-z0-9][a-z0-9_-]*" maxlength="64" placeholder="livingroom">
        </label>
        <label class="field">
          <span class="label">Name</span>
          <input name="name" required maxlength="80" placeholder="Living Room Frame">
        </label>
        <label class="field">
          <span class="label">Alias</span>
          <input name="alias" maxlength="80" pattern="[a-z0-9][a-z0-9-]*" placeholder="optional stable path">
        </label>
        <label class="field">
          <span class="label">Preview Orientation</span>
          <span class="orientation-picker">
            ${renderPreviewOrientationOptions(inheritedPreviewOrientation)}
          </span>
        </label>
        <label class="field">
          ${renderRemoteControlLabel()}
          <select name="remoteControlType">
            ${renderRemoteControlOptions(inheritedRemoteControlType)}
          </select>
        </label>
        <label class="field">
          <span class="label">Auto REST Port</span>
          <input name="remoteApiAutoPort" type="number" min="1" max="65535" step="1" value="8080">
          <span class="help-text">Used with the frame's verified FreeKiosk IP when manual URL is blank or unreachable.</span>
        </label>
        <label class="field full">
          <span class="label">Manual Remote API URL</span>
          <input name="remoteApiUrl" type="url" placeholder="http://192.168.1.160:8080">
          <span class="help-text">Optional FreeKiosk REST API address. Leave blank to use auto discovery from the frame's verified FreeKiosk IP and Auto REST Port.</span>
        </label>
        <details class="full">
          <summary>Advanced settings <span class="summary-hint">inherited URLs, external access, and password overrides</span></summary>
          <div class="advanced-grid">
            <label class="field">
              <span class="label">Network Mode</span>
              <select name="networkMode">
                ${renderNetworkModeOptions(inheritedNetworkMode)}
              </select>
            </label>
            <label class="field">
              <span class="label">Poll Interval</span>
              <input name="pollIntervalSeconds" type="number" min="5" max="300" step="1" value="${inheritedPollIntervalSeconds}">
            </label>
            <label class="field full">
              <span class="label">Local Controller URL</span>
              <input name="localControllerBaseUrl" type="url" placeholder="${escapeAttribute(inheritedLocalControllerUrl)}">
              <span class="inherited">Blank inherits ${escapeHtml(inheritedLocalControllerUrl)}.</span>
            </label>
            <label class="field full">
              <span class="label">Local Kiosk URL</span>
              <input name="localKioskBaseUrl" type="url" placeholder="${escapeAttribute(inheritedLocalKioskUrl)}">
              <span class="inherited">Blank inherits ${escapeHtml(inheritedLocalKioskUrl)}.</span>
            </label>
            <label class="field full">
              <span class="label">Kiosk Password Override</span>
              <input name="kioskPassword" type="password" autocomplete="new-password" placeholder="optional">
              <span class="help-text">Use only when this device's immich-kiosk password differs from the add-on global kiosk_password.</span>
            </label>
            <label class="field full">
              <span class="label">External Controller URL</span>
              <input name="externalControllerBaseUrl" type="url" placeholder="${escapeAttribute(inheritedExternalControllerUrl ?? 'https://frame.example.com')}">
              <span class="inherited">${inheritedExternalControllerUrl ? `Blank inherits ${escapeHtml(inheritedExternalControllerUrl)}.` : 'Blank leaves external frame URL unavailable.'}</span>
              <span class="help-text">Public tunnel to this controller add-on, such as https://frame.example.com. This creates the URL the frame should open.</span>
            </label>
            <label class="field full">
              <span class="label">External Kiosk Renderer URL</span>
              <input name="externalKioskBaseUrl" type="url" placeholder="${escapeAttribute(inheritedExternalKioskUrl ?? 'https://frame.example.com/kiosk')}">
              <span class="inherited">${inheritedExternalKioskUrl ? `Blank inherits ${escapeHtml(inheritedExternalKioskUrl)}.` : 'Optional. Use only for a separate public immich-kiosk renderer URL.'}</span>
              <span class="help-text">Do not put the controller add-on domain here unless that domain routes to immich-kiosk itself.</span>
            </label>
            <label class="field full">
              <span class="label">Remote API Key</span>
              <input name="remoteApiKey" type="password" autocomplete="new-password" placeholder="optional">
            </label>
          </div>
        </details>
        <div class="form-actions">
          <span class="form-status" data-form-status></span>
          <button type="submit" class="primary">Add Device</button>
        </div>
      </form>
    </section>

    ${renderMqttSection(params.mqtt, params.devices)}

    <div class="section-title">
      <h2>Frames</h2>
      <span class="pill">${params.devices.length} configured</span>
    </div>
    <section class="device-grid">
      ${params.devices.map((device) => renderDeviceCard(device, params.mqtt)).join('')}
    </section>

    <div class="section-title">
      <h2>Kiosk Review</h2>
      <span class="pill ok">URL overrides enabled</span>
    </div>
    <section class="recommendations">
      <article>
        <h3>Frame UX</h3>
        <p>Keep <code>disable_navigation</code> off when using FreeKiosk next/previous buttons because immich-kiosk treats it as a full navigation input lock.</p>
      </article>
      <article>
        <h3>Motion</h3>
        <p><code>transition</code>, <code>layout</code>, and <code>image_effect</code> can be automated from Home Assistant for time-of-day profiles.</p>
      </article>
      <article>
        <h3>Display Care</h3>
        <p><code>sleep_*</code> and <code>burn_in_*</code> are exposed separately so screen-off behavior and image-retention protection can be tuned independently.</p>
      </article>
      <article>
        <h3>Offline Mode</h3>
        <p>Offline mode needs a persistent asset volume and has URL override limitations, so it should be a separate add-on option set rather than a frame profile toggle.</p>
      </article>
    </section>
  </main>
  <script>
    for (const button of document.querySelectorAll('[data-copy]')) {
      button.addEventListener('click', async () => {
        const value = button.getAttribute('data-copy') || '';
        try {
          await navigator.clipboard.writeText(value);
          const original = button.textContent;
          button.textContent = 'Copied';
          setTimeout(() => { button.textContent = original; }, 1200);
        } catch {
          window.prompt('Copy value', value);
        }
      });
    }

    function setStatus(form, message, failed, clearAfterMs) {
      const status = form.querySelector('[data-form-status]');
      if (!status) return;
      if (status._clearTimer) {
        clearTimeout(status._clearTimer);
        status._clearTimer = null;
      }
      status.textContent = message || '';
      const normalizedMessage = String(message || '').toLowerCase();
      const succeeded = !failed && (
        normalizedMessage === 'saved'
        || normalizedMessage.startsWith('added')
        || normalizedMessage.startsWith('deleted')
        || normalizedMessage.startsWith('claimed')
      );
      status.style.color = failed ? '#991b1b' : (succeeded ? '#047857' : '#697586');
      if (message && clearAfterMs) {
        status._clearTimer = setTimeout(() => {
          status.textContent = '';
          status.style.color = '#697586';
          status._clearTimer = null;
        }, clearAfterMs);
      }
    }

    function reloadSoon() {
      setTimeout(() => window.location.reload(), 650);
    }

    function syncDeviceHeader(form, device) {
      const card = form.closest('.device');
      const name = card?.querySelector('[data-device-name]');
      if (name && device && device.name) {
        name.textContent = device.name;
      }
    }

    function optionalValue(formData, name) {
      const value = String(formData.get(name) || '').trim();
      return value ? value : undefined;
    }

    function buildFrameUrl(baseUrl, deviceId) {
      const base = String(baseUrl || '').trim().replace(/\\/+$/, '');
      return base ? base + '/frame/' + deviceId : '';
    }

    function buildStableFrameUrl(baseUrl, deviceId, alias) {
      const base = String(baseUrl || '').trim().replace(/\\/+$/, '');
      const pathName = String(alias || deviceId || '').trim().toLowerCase();
      return base && pathName ? base + '/f/' + encodeURIComponent(pathName) : '';
    }

    function previewFrameUrl(frameUrl) {
      return frameUrl ? frameUrl + (frameUrl.includes('?') ? '&' : '?') + 'preview=1' : '';
    }

    function syncFrameUrlElement(card, kind, value) {
      const code = card.querySelector('[data-' + kind + '-frame-url]');
      const copy = card.querySelector('[data-' + kind + '-frame-copy]');
      const missing = card.querySelector('[data-' + kind + '-frame-missing]');
      if (code) {
        code.textContent = value;
        code.hidden = !value;
      }
      if (copy) {
        copy.setAttribute('data-copy', value);
        copy.hidden = !value;
      }
      if (missing) {
        missing.hidden = Boolean(value);
      }
    }

    function syncExternalFrameUrlElement(card, value, externalKioskUrl) {
      syncFrameUrlElement(card, 'external', value);
      const missingText = card.querySelector('[data-external-frame-missing-text]');
      const useKiosk = card.querySelector('[data-use-external-kiosk-as-controller]');
      if (missingText) {
        missingText.textContent = externalKioskUrl
          ? 'External Kiosk Renderer URL is set, but External Frame URL needs External Controller URL. If this hostname routes to the controller add-on, copy it into External Controller URL and save.'
          : 'Set External Controller URL to show the remote frame URL.';
      }
      if (useKiosk) {
        useKiosk.hidden = Boolean(value) || !externalKioskUrl;
      }
    }

    function syncDeviceCard(form) {
      const deviceId = form.getAttribute('data-device-edit');
      if (!deviceId) return;
      const card = form.closest('.device');
      if (!card) return;
      const alias = form.querySelector('[name="alias"]')?.value;
      const localFrameUrl = buildFrameUrl(form.querySelector('[name="localControllerBaseUrl"]')?.value, deviceId);
      const localStableFrameUrl = buildStableFrameUrl(form.querySelector('[name="localControllerBaseUrl"]')?.value, deviceId, alias);
      const externalFrameUrl = buildStableFrameUrl(form.querySelector('[name="externalControllerBaseUrl"]')?.value, deviceId, alias);
      const externalKioskUrl = String(form.querySelector('[name="externalKioskBaseUrl"]')?.value || '').trim();
      syncFrameUrlElement(card, 'stable', localStableFrameUrl);
      syncFrameUrlElement(card, 'local', localFrameUrl);
      syncExternalFrameUrlElement(card, externalFrameUrl, externalKioskUrl);

      const orientation = form.querySelector('[name="previewOrientation"]:checked')?.value === 'portrait' ? 'portrait' : 'landscape';
      const content = card.querySelector('.device-content');
      const frame = card.querySelector('.preview-frame');
      content?.classList.toggle('portrait', orientation === 'portrait');
      content?.classList.toggle('landscape', orientation === 'landscape');
      frame?.classList.toggle('portrait', orientation === 'portrait');
      frame?.classList.toggle('landscape', orientation === 'landscape');
      const preview = card.querySelector('[data-frame-preview]');
      if (preview && localFrameUrl) {
        preview.setAttribute('src', previewFrameUrl(localFrameUrl));
      }
    }

    function payloadFromForm(form, includeId) {
      const formData = new FormData(form);
      const remoteApiUrl = optionalValue(formData, 'remoteApiUrl');
      const selectedRemoteControlType = String(formData.get('remoteControlType') || 'none');
      const payload = {
        name: String(formData.get('name') || '').trim(),
        alias: optionalValue(formData, 'alias'),
        networkMode: String(formData.get('networkMode') || 'auto'),
        previewOrientation: String(formData.get('previewOrientation') || 'landscape'),
        pollIntervalSeconds: Number(formData.get('pollIntervalSeconds') || 20),
        localControllerBaseUrl: optionalValue(formData, 'localControllerBaseUrl'),
        externalControllerBaseUrl: optionalValue(formData, 'externalControllerBaseUrl') ?? null,
        localKioskBaseUrl: optionalValue(formData, 'localKioskBaseUrl'),
        externalKioskBaseUrl: optionalValue(formData, 'externalKioskBaseUrl') ?? null,
        remoteControlType: remoteApiUrl && selectedRemoteControlType === 'none' ? 'freekiosk' : selectedRemoteControlType,
        remoteApiUrl: remoteApiUrl ?? (includeId ? undefined : null),
        remoteApiAutoPort: Number(formData.get('remoteApiAutoPort') || 8080),
      };
      const kioskPassword = optionalValue(formData, 'kioskPassword');
      if (!includeId && formData.get('clearKioskPassword') === 'on') {
        payload.kioskPassword = null;
      } else if (kioskPassword) {
        payload.kioskPassword = kioskPassword;
      }
      const remoteApiKey = optionalValue(formData, 'remoteApiKey');
      if (remoteApiKey) {
        payload.remoteApiKey = remoteApiKey;
      }
      if (formData.has('mqttTopicId')) {
        payload.mqttTopicId = optionalValue(formData, 'mqttTopicId') ?? (includeId ? undefined : null);
      }
      if (includeId) {
        payload.id = String(formData.get('id') || '').trim().toLowerCase();
      }
      return payload;
    }

    var ingressBasePath = ${JSON.stringify(params.ingressPath ?? '')};
    function controllerPath(path) {
      const cleanPath = String(path).replace(/^\\/+/, '');
      // Under Home Assistant ingress the page URL (panel route) is not a reliable
      // base for relative API calls, so anchor to the ingress prefix the server
      // reported. Direct LAN access has no prefix and resolves relative as before.
      if (ingressBasePath) {
        return window.location.origin + ingressBasePath + '/' + cleanPath;
      }
      return new URL(cleanPath, new URL('.', window.location.href)).toString();
    }

    async function requestJson(path, options) {
      const response = await fetch(controllerPath(path), {
        ...options,
        headers: {
          'content-type': 'application/json',
          ...(options && options.headers ? options.headers : {}),
        },
      });
      const text = await response.text().catch(() => '');
      let body = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch (error) {
          body = null;
        }
      }
      if (!response.ok || !body || body.success === false) {
        const status = response.status ? ' (' + response.status + (response.statusText ? ' ' + response.statusText : '') + ')' : '';
        throw new Error(body && body.error ? body.error.message : 'Request failed' + status);
      }
      return body;
    }

    for (const form of document.querySelectorAll('[data-device-create], [data-device-edit]')) {
      const remoteApiUrl = form.querySelector('[name="remoteApiUrl"]');
      const remoteControlType = form.querySelector('[name="remoteControlType"]');
      const alias = form.querySelector('[name="alias"]');
      const localControllerUrl = form.querySelector('[name="localControllerBaseUrl"]');
      const externalControllerUrl = form.querySelector('[name="externalControllerBaseUrl"]');
      const externalKioskUrl = form.querySelector('[name="externalKioskBaseUrl"]');
      remoteApiUrl?.addEventListener('input', () => {
        if (remoteApiUrl.value.trim() && remoteControlType?.value === 'none') {
          remoteControlType.value = 'freekiosk';
        }
      });
      alias?.addEventListener('input', () => syncDeviceCard(form));
      localControllerUrl?.addEventListener('input', () => syncDeviceCard(form));
      externalControllerUrl?.addEventListener('input', () => syncDeviceCard(form));
      externalKioskUrl?.addEventListener('input', () => syncDeviceCard(form));
      for (const option of form.querySelectorAll('[name="previewOrientation"]')) {
        option.addEventListener('change', () => syncDeviceCard(form));
      }
      syncDeviceCard(form);
    }

    for (const button of document.querySelectorAll('[data-use-external-kiosk-as-controller]')) {
      button.addEventListener('click', () => {
        const card = button.closest('.device');
        const form = card?.querySelector('[data-device-edit]');
        const externalKioskUrl = form?.querySelector('[name="externalKioskBaseUrl"]');
        const externalControllerUrl = form?.querySelector('[name="externalControllerBaseUrl"]');
        if (!externalKioskUrl || !externalControllerUrl) return;
        externalControllerUrl.value = externalKioskUrl.value.trim();
        syncDeviceCard(form);
        externalControllerUrl.focus();
      });
    }

    for (const form of document.querySelectorAll('[data-frame-claim]')) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const code = String(formData.get('claimCode') || '').trim();
        setStatus(form, 'Claiming frame...', false);
        try {
          await requestJson('/api/frame-claims/' + encodeURIComponent(code) + '/claim', {
            method: 'POST',
            body: JSON.stringify({
              name: String(formData.get('name') || '').trim(),
              alias: optionalValue(formData, 'alias'),
              previewOrientation: String(formData.get('previewOrientation') || 'landscape'),
            }),
          });
          setStatus(form, 'Claimed. Reloading...', false);
          reloadSoon();
        } catch (error) {
          setStatus(form, error instanceof Error ? error.message : String(error), true);
        }
      });
    }

    for (const form of document.querySelectorAll('[data-device-create]')) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus(form, 'Adding device...', false);
        try {
          await requestJson('/api/devices', {
            method: 'POST',
            body: JSON.stringify(payloadFromForm(form, true)),
          });
          setStatus(form, 'Added. Reloading...', false);
          reloadSoon();
        } catch (error) {
          setStatus(form, error instanceof Error ? error.message : String(error), true);
        }
      });
    }

    for (const form of document.querySelectorAll('[data-device-edit]')) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const deviceId = form.getAttribute('data-device-edit') || '';
        setStatus(form, 'Saving device...', false);
        try {
          const body = await requestJson('/api/devices/' + encodeURIComponent(deviceId), {
            method: 'PATCH',
            body: JSON.stringify(payloadFromForm(form, false)),
          });
          syncDeviceCard(form);
          syncDeviceHeader(form, body?.data?.device);
          setStatus(form, 'Saved', false, 1800);
        } catch (error) {
          setStatus(form, error instanceof Error ? error.message : String(error), true);
        }
      });
    }

    function setMqttRowStatus(row, message, failed) {
      const status = row?.querySelector('[data-mqtt-status]');
      if (!status) return;
      status.textContent = message || '';
      status.style.color = failed ? '#991b1b' : '#697586';
    }

    for (const button of document.querySelectorAll('[data-mqtt-bind]')) {
      button.addEventListener('click', async () => {
        const topicId = button.getAttribute('data-mqtt-bind') || '';
        const row = button.closest('[data-mqtt-row]');
        const deviceId = row?.querySelector('[data-mqtt-device-select]')?.value;
        if (!deviceId) return;
        setMqttRowStatus(row, 'Binding...', false);
        try {
          await requestJson('/api/devices/' + encodeURIComponent(deviceId), {
            method: 'PATCH',
            body: JSON.stringify({ mqttTopicId: topicId, remoteControlType: 'freekiosk' }),
          });
          setMqttRowStatus(row, 'Bound. Reloading...', false);
          reloadSoon();
        } catch (error) {
          setMqttRowStatus(row, error instanceof Error ? error.message : String(error), true);
        }
      });
    }

    for (const button of document.querySelectorAll('[data-mqtt-unbind]')) {
      button.addEventListener('click', async () => {
        const deviceId = button.getAttribute('data-mqtt-unbind') || '';
        const row = button.closest('[data-mqtt-row]');
        setMqttRowStatus(row, 'Unbinding...', false);
        try {
          await requestJson('/api/devices/' + encodeURIComponent(deviceId), {
            method: 'PATCH',
            body: JSON.stringify({ mqttTopicId: null }),
          });
          setMqttRowStatus(row, 'Unbound. Reloading...', false);
          reloadSoon();
        } catch (error) {
          setMqttRowStatus(row, error instanceof Error ? error.message : String(error), true);
        }
      });
    }

    for (const button of document.querySelectorAll('[data-delete-device]')) {
      button.addEventListener('click', async () => {
        const deviceId = button.getAttribute('data-delete-device') || '';
        if (!window.confirm('Delete ' + deviceId + '?')) return;
        const form = button.closest('form');
        if (form) setStatus(form, 'Deleting device...', false);
        try {
          await requestJson('/api/devices/' + encodeURIComponent(deviceId), { method: 'DELETE' });
          if (form) setStatus(form, 'Deleted. Reloading...', false);
          reloadSoon();
        } catch (error) {
          if (form) setStatus(form, error instanceof Error ? error.message : String(error), true);
        }
      });
    }
  </script>
</body>
</html>`;
}

export function renderSetupBlockedPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Immich Frame Controller</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f7fa;
      color: #171b22;
    }
    main {
      max-width: 640px;
      background: #ffffff;
      border: 1px solid #dce3ea;
      border-radius: 8px;
      padding: 28px;
      box-shadow: 0 12px 32px rgb(24 33 44 / 8%);
    }
    p {
      color: #5d6877;
      line-height: 1.55;
    }
  </style>
</head>
<body>
  <main>
    <h1>Pairing is only available locally</h1>
    <p>Open this setup page through the controller's LAN URL instead of the external tunnel domain.</p>
  </main>
</body>
</html>`;
}

function renderMqttSection(mqtt: SetupPageMqttStatus, devices: SetupPageDevice[]): string {
  const statusPill = !mqtt.enabled
    ? '<span class="pill">Off</span>'
    : mqtt.connected
      ? '<span class="pill ok">Connected</span>'
      : '<span class="pill warn">Disconnected</span>';
  const lead = mqtt.enabled
    ? `Broker <code>${escapeHtml(mqtt.brokerUrl ?? '')}</code> / base topic <code>${escapeHtml(mqtt.baseTopic ?? 'freekiosk')}</code>. FreeKiosk frames that publish to this broker appear below; bind one to a frame to get push hardware control, online/offline status, and live telemetry without IP discovery.`
    : 'MQTT is off. Set <code>mqtt_broker_url</code> in the add-on options (auto-detected when the Mosquitto add-on is installed) or the <code>MQTT_BROKER_URL</code> env for standalone Docker, then enable MQTT inside the FreeKiosk app on the frame.';
  const errorRow = mqtt.enabled && !mqtt.connected && mqtt.lastError
    ? `<div class="claim-row"><span>Last connection error: ${escapeHtml(mqtt.lastError)}</span></div>`
    : '';
  const pushSubscribers = mqtt.telemetrySubscribers ?? 0;
  const pushPill = mqtt.enabled
    ? (pushSubscribers > 0
      ? `<span class="pill ok">Real-time push: active (${pushSubscribers})</span>`
      : '<span class="pill warn">Real-time push: idle</span>')
    : '';
  return `<div class="section-title">
      <h2>MQTT Bridge</h2>
      <span class="row" style="gap: 8px;">${pushPill}${statusPill}</span>
    </div>
    <section class="panel">
      <div class="form-grid">
        <p class="form-lead">${lead}</p>
        <datalist id="mqtt-topic-options">
          ${mqtt.devices.map((entry) => `<option value="${escapeAttribute(entry.topicId)}"></option>`).join('')}
        </datalist>
        ${mqtt.enabled ? renderMqttDeviceRows(mqtt, devices) : ''}
        ${errorRow}
      </div>
    </section>`;
}

function renderMqttDeviceRows(mqtt: SetupPageMqttStatus, devices: SetupPageDevice[]): string {
  if (mqtt.devices.length === 0) {
    return `<div class="claim-list"><div class="claim-row"><span>No FreeKiosk devices seen on the broker yet. In the FreeKiosk app open Advanced &gt; MQTT, point it at the same broker, set a Device Name, and press Connect.</span></div></div>`;
  }
  const rows = mqtt.devices.map((entry) => {
    const availabilityPill = entry.availability === 'online'
      ? '<span class="pill ok">online</span>'
      : entry.availability === 'offline'
        ? '<span class="pill warn">offline</span>'
        : '<span class="pill">unknown</span>';
    const details = [
      entry.ip ? `IP ${entry.ip}` : '',
      entry.stateReceivedAt ? `state ${formatTimestamp(entry.stateReceivedAt)}` : '',
    ].filter(Boolean).join(' / ');
    const bound = entry.boundDeviceId
      ? devices.find((device) => device.id === entry.boundDeviceId)
      : undefined;
    const pushNote = bound && (entry.telemetrySubscribers ?? 0) > 0
      ? ' <span class="pill ok">push</span>'
      : '';
    const action = bound
      ? `<span class="muted">Bound to <strong>${escapeHtml(bound.name)}</strong>${pushNote}</span>
        <button type="button" data-mqtt-unbind="${escapeAttribute(entry.boundDeviceId ?? '')}">Unbind</button>`
      : `<select data-mqtt-device-select>
          ${devices.map((device) => `<option value="${escapeAttribute(device.id)}"${device.id === entry.suggestedDeviceId ? ' selected' : ''}>${escapeHtml(device.name)}</option>`).join('')}
        </select>
        <button type="button" class="primary" data-mqtt-bind="${escapeAttribute(entry.topicId)}">Bind</button>`;
    const suggestion = !bound && entry.suggestedDeviceId
      ? `<span class="help-text">IP matches frame ${escapeHtml(entry.suggestedDeviceId)}.</span>`
      : '';
    return `<div class="claim-row" data-mqtt-row>
      <span><strong>${escapeHtml(entry.topicId)}</strong> ${availabilityPill}${details ? ` <span class="muted">${escapeHtml(details)}</span>` : ''} ${suggestion}</span>
      <span class="row" style="gap: 8px;">
        <span class="form-status" data-mqtt-status></span>
        ${action}
      </span>
    </div>`;
  }).join('');
  return `<div class="claim-list">${rows}</div>`;
}

function renderDeviceCard(device: SetupPageDevice, mqtt: SetupPageMqttStatus): string {
  const rendererUrl = device.rendererUrl
    ? redactSensitiveQueryParams(device.rendererUrl)
    : 'Not resolved yet';
  const externalFrameUrl = device.externalStableFrameUrl ?? '';
  const externalKioskUrl = device.externalKioskBaseUrl ?? '';
  const externalMissingText = externalKioskUrl
    ? 'External Kiosk Renderer URL is set, but External Frame URL needs External Controller URL. If this hostname routes to the controller add-on, copy it into External Controller URL and save.'
    : 'Set External Controller URL to show the remote frame URL.';
  const sleepWindow = device.disableSleep
    ? 'Disabled'
    : `${device.sleepStart || 'config'} -> ${device.sleepEnd || 'config'}`;
  const orientation = previewOrientation(device);
  return `<article class="device">
    <div class="device-head">
      <div class="stack">
        <h3 data-device-name>${escapeHtml(device.name)}</h3>
        <span class="muted">${escapeHtml(device.id)}</span>
      </div>
      ${renderStatusPill(device.resolvedNetworkMode ?? device.networkMode ?? 'unknown')}
    </div>
    <div class="device-content ${escapeAttribute(orientation)}">
      <div class="device-preview">
        <div class="preview-frame ${escapeAttribute(orientation)}">
          <iframe data-frame-preview src="${escapeAttribute(framePreviewUrl(device.localFrameUrl))}" title="${escapeAttribute(`${device.name} preview`)}" loading="lazy"></iframe>
        </div>
      </div>
      <div class="device-body">
      <div class="stack">
        <div class="row">
          <span class="label">Stable Frame URL</span>
          <button type="button" data-copy="${escapeAttribute(device.localStableFrameUrl)}" data-stable-frame-copy>Copy</button>
        </div>
        <code data-stable-frame-url>${escapeHtml(device.localStableFrameUrl)}</code>
      </div>
      <div class="stack">
        <div class="row">
          <span class="label">Local Frame URL</span>
          <button type="button" data-copy="${escapeAttribute(device.localFrameUrl)}" data-local-frame-copy>Copy</button>
        </div>
        <code data-local-frame-url>${escapeHtml(device.localFrameUrl)}</code>
      </div>
      <div class="stack">
        <div class="row">
          <span class="label">External Frame URL</span>
          <button type="button" data-copy="${escapeAttribute(externalFrameUrl)}" data-external-frame-copy${externalFrameUrl ? '' : ' hidden'}>Copy</button>
        </div>
        <code data-external-frame-url${externalFrameUrl ? '' : ' hidden'}>${escapeHtml(externalFrameUrl)}</code>
        <div class="url-missing" data-external-frame-missing${externalFrameUrl ? ' hidden' : ''}>
          <span data-external-frame-missing-text>${escapeHtml(externalMissingText)}</span>
          <button type="button" data-use-external-kiosk-as-controller${externalKioskUrl ? '' : ' hidden'}>Copy to Controller URL</button>
        </div>
      </div>
      <div class="stack">
        <div class="row">
          <span class="label">Renderer URL</span>
          <button type="button" data-copy="${escapeAttribute(rendererUrl)}">Copy</button>
        </div>
        <code>${escapeHtml(rendererUrl)}</code>
      </div>
      <details class="frame-details">
        <summary>Frame Details</summary>
        <dl class="kv">
        ${renderKeyValue('Duration', `${device.durationSeconds ?? 'unknown'}s`)}
        ${renderKeyValue('Fit / Order', `${device.imageFit ?? 'config'} / ${device.albumOrder ?? 'config'}`)}
        ${renderKeyValue('Clock', renderClockSummary(device))}
        ${renderKeyValue('Weather', renderWeatherSummary(device))}
        ${renderKeyValue('Kiosk Password', renderKioskPasswordSource(device.kioskPasswordSource))}
        ${renderKeyValue('Kiosk Connection', renderKioskConnection(device.kioskConnection))}
        ${renderKeyValue('Frame Connection', `${device.frameEventClients} live`)}
        ${renderKeyValue('Transition', device.transition ?? 'config')}
        ${renderKeyValue('Layout', device.layout ?? 'config')}
        ${renderKeyValue('Preview', orientation)}
        ${renderKeyValue('Image Effect', device.imageEffect ?? 'config')}
        ${renderKeyValue('Background', `${boolLabel(device.backgroundBlur)} / blur ${device.backgroundBlurAmount ?? 10} / font ${device.fontSize ?? 100}%`)}
        ${renderKeyValue('Frameless', boolLabel(device.frameless))}
        ${renderKeyValue('Navigation', device.disableNavigation ? 'Disabled' : 'Enabled')}
        ${renderKeyValue('Cursor', device.hideCursor ? 'Hidden' : 'Visible')}
        ${renderKeyValue('Progress Bar', `${boolLabel(device.showProgressBar)} / ${device.progressBarPosition ?? 'top'}`)}
        ${renderKeyValue('Media', renderMediaSummary(device))}
        ${renderKeyValue('Archived Assets', boolLabel(device.showArchived))}
        ${renderKeyValue('Metadata', renderMetadataSummary(device))}
        ${renderKeyValue('Description Scroll', renderDescriptionScrollSummary(device))}
        ${renderKeyValue('Asset Filters', renderAssetFilters(device))}
        ${renderKeyValue('Arrow Actions', `${device.upArrowAction ?? 'none'} / ${device.downArrowAction ?? 'none'}`)}
        ${renderKeyValue('Burn-in', `${device.burnInInterval ?? 0}m / ${device.burnInDuration ?? 30}s / ${device.burnInOpacity ?? 30}%`)}
        ${renderKeyValue('Sleep', sleepWindow)}
        ${renderKeyValue('Remote', renderRemoteSummary(device))}
        ${renderKeyValue('Remote Endpoint', renderRemoteEndpointSummary(device))}
        ${renderKeyValue('MQTT', renderMqttBindingSummary(device, mqtt))}
        </dl>
      </details>
      <details>
        <summary>Device Settings</summary>
        <form class="form-grid" data-device-edit="${escapeAttribute(device.id)}">
          <label class="field">
            <span class="label">Name</span>
            <input name="name" required maxlength="80" value="${escapeAttribute(device.name)}">
          </label>
          <label class="field">
            <span class="label">Alias</span>
            <input name="alias" maxlength="80" pattern="[a-z0-9][a-z0-9-]*" value="${escapeAttribute(device.alias ?? '')}" placeholder="optional stable path">
          </label>
          <label class="field">
            <span class="label">Network Mode</span>
            <select name="networkMode">
              ${renderNetworkModeOptions(device.networkMode ?? device.deviceNetworkMode)}
            </select>
          </label>
          <label class="field">
            <span class="label">Preview Orientation</span>
            <span class="orientation-picker">
              ${renderPreviewOrientationOptions(previewOrientation(device))}
            </span>
          </label>
          <label class="field full">
            <span class="label">Local Controller URL</span>
            <input name="localControllerBaseUrl" type="url" required value="${escapeAttribute(device.localControllerBaseUrl)}">
          </label>
          <label class="field full">
            <span class="label">Local Kiosk URL</span>
            <input name="localKioskBaseUrl" type="url" required value="${escapeAttribute(device.localKioskBaseUrl)}">
          </label>
          <label class="field full">
            <span class="label">Kiosk Password Override</span>
            <input name="kioskPassword" type="password" autocomplete="new-password" placeholder="${device.kioskPasswordConfigured ? 'configured; leave blank to keep' : 'optional; inherits global kiosk_password'}">
            <span class="help-text">This is the immich-kiosk password, not the Immich API key, HA token, or FreeKiosk key.</span>
          </label>
          ${device.kioskPasswordConfigured
            ? `<label class="field full checkbox-field"><input name="clearKioskPassword" type="checkbox"><span>Clear this device password override and inherit the global kiosk_password</span></label>`
            : ''}
          <label class="field full">
            <span class="label">External Controller URL</span>
            <input name="externalControllerBaseUrl" type="url" value="${escapeAttribute(device.externalControllerBaseUrl ?? '')}">
            <span class="help-text">Public tunnel to this controller add-on, such as https://frame.example.com. The frame should open /f/${escapeHtml(device.alias ?? device.id)} from this hostname.</span>
          </label>
          <label class="field full">
            <span class="label">External Kiosk Renderer URL</span>
            <input name="externalKioskBaseUrl" type="url" value="${escapeAttribute(device.externalKioskBaseUrl ?? '')}">
            <span class="help-text">Optional separate public immich-kiosk renderer URL. Do not put the controller add-on domain here unless that domain routes to immich-kiosk itself.</span>
          </label>
          <label class="field">
            <span class="label">Poll Interval</span>
            <input name="pollIntervalSeconds" type="number" min="5" max="300" step="1" value="${device.pollIntervalSeconds}">
          </label>
          <label class="field">
            ${renderRemoteControlLabel()}
            <select name="remoteControlType">
              ${renderRemoteControlOptions(device.remoteControlType ?? 'none')}
            </select>
          </label>
          <label class="field">
            <span class="label">Auto REST Port</span>
            <input name="remoteApiAutoPort" type="number" min="1" max="65535" step="1" value="${device.remoteApiAutoPort ?? 8080}">
          </label>
          <label class="field full">
            <span class="label">Manual Remote API URL</span>
            <input name="remoteApiUrl" type="url" value="${escapeAttribute(device.remoteApiUrl ?? '')}" placeholder="http://192.168.1.160:8080">
            <span class="help-text">Optional. Manual URL is tried first; if it is blank or unreachable, the controller tries the verified auto endpoint.</span>
            <span class="help-text">${escapeHtml(renderRemoteEndpointHelp(device))}</span>
          </label>
          <label class="field full">
            <span class="label">Remote API Key</span>
            <input name="remoteApiKey" type="password" autocomplete="new-password" placeholder="${device.remoteApiKeyConfigured ? 'configured; leave blank to keep' : 'optional'}">
          </label>
          <label class="field full">
            <span class="label">MQTT Topic ID</span>
            <input name="mqttTopicId" list="mqtt-topic-options" value="${escapeAttribute(device.mqttTopicId ?? '')}" placeholder="FreeKiosk device name, e.g. lobby">
            <span class="help-text">FreeKiosk Device Name as used in its MQTT topics (<code>freekiosk/&lt;topic&gt;/state</code>). Blank disables MQTT control for this frame; the MQTT Bridge section above can bind this automatically.</span>
          </label>
          <div class="form-actions">
            <span class="form-status" data-form-status></span>
            ${device.isDefault ? '' : `<button type="button" class="danger" data-delete-device="${escapeAttribute(device.id)}">Delete</button>`}
            <button type="submit" class="primary">Save Device</button>
          </div>
        </form>
      </details>
      </div>
    </div>
  </article>`;
}

function renderAssetFilters(device: SetupPageDevice): string {
  const filters = [
    device.filterDate ? `date ${device.filterDate}` : '',
    device.filterNewest && device.filterNewest > 0 ? `newest ${device.filterNewest}` : '',
  ].filter(Boolean);
  return filters.length > 0 ? filters.join(' / ') : 'Off';
}

function renderMediaSummary(device: SetupPageDevice): string {
  const content = device.showVideos ? 'images + videos' : 'images only';
  const videoLimit = device.excludeVideosOver && device.excludeVideosOver > 0
    ? ` / max video ${device.excludeVideosOver}s`
    : '';
  return `${content}${videoLimit}`;
}

function renderFrameClaimRows(claims: SetupPageFrameClaim[]): string {
  const activeClaims = claims
    .filter((claim) => claim.status === 'pending')
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  if (activeClaims.length === 0) {
    return `<div class="claim-list"><div class="claim-row"><span>No pending frame codes. Open the controller Pair URL ending in <code>/pair</code> on a frame to generate one.</span></div></div>`;
  }
  return `<div class="claim-list">${activeClaims.map((claim) => {
    const expiresAt = new Date(claim.expiresAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const host = claim.requestHost ? ` from ${claim.requestHost}` : '';
    return `<div class="claim-row"><span>Pending frame${escapeHtml(host)}</span><span>Expires ${escapeHtml(expiresAt)}</span></div>`;
  }).join('')}</div>`;
}

function framePreviewUrl(frameUrl: string): string {
  return `${frameUrl}${frameUrl.includes('?') ? '&' : '?'}preview=1`;
}

function renderClockSummary(device: SetupPageDevice): string {
  const pieces = [
    device.showTime ? `time ${device.timeFormat ?? '24'}h` : '',
    device.showDate ? `date ${device.dateFormat ?? 'default'}` : '',
    device.showSeconds ? 'seconds' : '',
    device.clockSource && device.clockSource !== 'client' ? device.clockSource : '',
  ].filter(Boolean);
  return pieces.length > 0 ? pieces.join(' / ') : 'Off';
}

function renderWeatherSummary(device: SetupPageDevice): string {
  if (device.showWeather === false) return 'Off';
  const location = device.weatherLocation?.trim() || 'default';
  const rotation = location === 'rotate' ? ` / ${device.weatherRotationInterval ?? 60}s` : '';
  const details = [
    renderWeatherOverride('forecast', device.weatherShowForecast),
    renderWeatherOverride('humidity', device.weatherShowHumidity),
    renderWeatherOverride('wind', device.weatherShowWind),
    renderWeatherOverride('wind dir', device.weatherShowWindDirection),
    renderWeatherOverride('visibility', device.weatherShowVisibility),
    renderWeatherOverride('range', device.weatherShowTemperatureRange),
    renderWeatherOverride('round', device.weatherRoundTemperature),
  ].filter(Boolean);
  return details.length > 0 ? `${location}${rotation} / ${details.join(', ')}` : `${location}${rotation}`;
}

function renderWeatherOverride(label: string, value?: string): string {
  if (!value || value === 'inherit') return '';
  return `${label} ${value}`;
}

function renderMetadataSummary(device: SetupPageDevice): string {
  const fields = [
    device.showImageDate ? 'date' : '',
    device.showImageTime ? 'time' : '',
    device.showAlbumName ? 'album' : '',
    device.showPersonName ? 'person' : '',
    device.showImageLocation ? 'location' : '',
    device.showImageCamera ? 'camera' : '',
    device.showImageExif ? 'exif' : '',
    device.showImageDescription ? 'description' : '',
    device.showOwner ? 'owner' : '',
    device.showImageRating ? 'rating' : '',
    device.showUser ? 'user' : '',
  ].filter(Boolean);
  return fields.length > 0 ? fields.join(', ') : 'Off';
}

function renderDescriptionScrollSummary(device: SetupPageDevice): string {
  return `${device.imageDescriptionScrollSpeed ?? 2.5}px/s / max ${device.imageDescriptionScrollDuration ?? 52}s / wait ${device.imageDescriptionStartDelay ?? 3}s / ${device.imageDescriptionAreaHeight ?? 5.75}rem / ${device.imageDescriptionOverlayOpacity ?? 10}% / ${device.imageDescriptionLongThresholdLines ?? 3.25} lines`;
}

function renderRemoteSummary(device: SetupPageDevice): string {
  const type = device.remoteControlType ?? 'none';
  if (type !== 'freekiosk') return type;
  const source = device.remoteApiEffectiveSource ?? 'none';
  if (source === 'manual') return 'freekiosk / manual';
  if (source === 'auto') return 'freekiosk / verified auto';
  return 'freekiosk / waiting for verified IP';
}

function renderMqttBindingSummary(device: SetupPageDevice, mqtt: SetupPageMqttStatus): string {
  if (!mqtt.enabled) return 'Bridge off';
  if ((device.remoteControlType ?? 'none') !== 'freekiosk') return 'Off';
  if (!device.mqttTopicId) return 'Not bound';
  const availability = device.remoteAvailability ?? 'unknown';
  return `${device.mqttTopicId} / ${availability}`;
}

function renderRemoteEndpointSummary(device: SetupPageDevice): string {
  if ((device.remoteControlType ?? 'none') !== 'freekiosk') return 'Off';
  if (device.remoteApiEffectiveUrl) {
    return `${device.remoteApiEffectiveUrl} (${device.remoteApiEffectiveSource ?? 'unknown'})`;
  }
  if (device.lastSeenIp) {
    return `${device.lastSeenIp}:${device.remoteApiAutoPort ?? 8080} verified`;
  }
  return 'No verified FreeKiosk IP yet';
}

function renderRemoteEndpointHelp(device: SetupPageDevice): string {
  const parts = [];
  if (device.remoteApiEffectiveUrl) {
    parts.push(`Effective endpoint: ${device.remoteApiEffectiveUrl} (${device.remoteApiEffectiveSource ?? 'unknown'}).`);
  } else {
    parts.push('Effective endpoint: unavailable until a manual URL is set or the frame opens its local frame URL and FreeKiosk status is verified.');
  }
  if (device.remoteApiAutoUrl) {
    parts.push(`Verified auto endpoint: ${device.remoteApiAutoUrl}.`);
  }
  if (device.lastSeenIp && device.lastSeenAt) {
    parts.push(`Last verified: ${device.lastSeenIp} at ${formatTimestamp(device.lastSeenAt)}.`);
  } else {
    parts.push('Last verified: not recorded yet.');
  }
  return parts.join(' ');
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function renderKeyValue(label: string, value: string): string {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function renderStatusPill(value: string): string {
  const className = value === 'local' || value === 'external' ? 'ok' : 'warn';
  return `<span class="pill ${className}">${escapeHtml(value)}</span>`;
}

function renderNetworkModeOptions(value: string): string {
  return ['auto', 'local', 'external']
    .map((option) => `<option value="${option}"${option === value ? ' selected' : ''}>${option}</option>`)
    .join('');
}

function renderRemoteControlOptions(value: string): string {
  return ['none', 'freekiosk']
    .map((option) => `<option value="${option}"${option === value ? ' selected' : ''}>${option}</option>`)
    .join('');
}

function renderRemoteControlLabel(): string {
  return `<span class="label label-with-info">Remote Control
    <span class="info-dot" tabindex="0" aria-label="FreeKiosk remote control information">i</span>
    <span class="info-popover">FreeKiosk enables Android REST controls for this frame, including next, previous, brightness, volume, and mute. See the <a href="https://freekiosk.app/docs/" target="_blank" rel="noreferrer">docs</a> or <a href="https://github.com/RushB-fr/freekiosk" target="_blank" rel="noreferrer">GitHub</a>.</span>
  </span>`;
}

function renderPreviewOrientationOptions(value: string): string {
  return [
    ['landscape', 'Landscape'],
    ['portrait', 'Portrait'],
  ]
    .map(([option, label]) => `<label><input name="previewOrientation" type="radio" value="${option}"${option === value ? ' checked' : ''}><span class="orientation-option"><span class="orientation-frame" aria-hidden="true"><span class="orientation-screen ${option}"></span></span><span class="orientation-text">${label}</span></span></label>`)
    .join('');
}

function previewOrientation(device: Pick<SetupPageDevice, 'previewOrientation'> | undefined): 'landscape' | 'portrait' {
  return device?.previewOrientation === 'portrait' ? 'portrait' : 'landscape';
}

function boolLabel(value: boolean | undefined): string {
  if (value === undefined) return 'config';
  return value ? 'On' : 'Off';
}

function renderKioskPasswordSource(value: 'device' | 'global' | 'none'): string {
  switch (value) {
    case 'device':
      return 'Device override';
    case 'global':
      return 'Global';
    case 'none':
      return 'Not configured';
  }
}

function renderKioskConnection(value: SetupPageKioskConnection | undefined): string {
  if (!value) return 'Not checked';
  const status = value.status === 'ok'
    ? 'OK'
    : value.status === 'unauthorized'
      ? 'Unauthorized'
      : 'Error';
  const statusCode = value.statusCode ? ` ${value.statusCode}` : '';
  return `${status}${statusCode}: ${value.message}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function redactSensitiveQueryParams(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of parsed.searchParams.keys()) {
      if (['api_key', 'apikey', 'key', 'password', 'secret', 'token'].includes(key.toLowerCase())) {
        parsed.searchParams.set(key, '[redacted]');
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
