interface SetupPageParams {
  controllerUrl: string;
  deviceId: string;
  pairingCode: string;
  expiresAt: string;
  albumCount: number;
  albumRefreshedAt?: string;
  devices: SetupPageDevice[];
}

interface SetupPageDevice {
  id: string;
  name: string;
  frameUrl: string;
  rendererUrl?: string;
  networkMode?: string;
  resolvedNetworkMode?: string;
  durationSeconds?: number;
  imageFit?: string;
  albumOrder?: string;
  transition?: string;
  layout?: string;
  imageEffect?: string;
  backgroundBlur?: boolean;
  frameless?: boolean;
  disableNavigation?: boolean;
  hideCursor?: boolean;
  showProgressBar?: boolean;
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
      grid-template-columns: 1.3fr repeat(3, minmax(150px, .7fr));
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
    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 24px 0 12px;
    }
    .device-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
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
        <button type="button" data-copy="${escapeAttribute(`${params.controllerUrl.replace(/\/+$/, '')}/frame/${params.deviceId}`)}">Copy Default Frame URL</button>
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
        <div class="label">Default Device</div>
        <div class="value">${escapeHtml(params.deviceId)}</div>
      </div>
      <div class="panel metric">
        <div class="label">Album Cache</div>
        <div class="value">${params.albumCount} albums</div>
        <p class="muted">${escapeHtml(refreshedAt)}</p>
      </div>
    </section>

    <div class="section-title">
      <h2>Frames</h2>
      <span class="pill">${params.devices.length} configured</span>
    </div>
    <section class="device-grid">
      ${params.devices.map(renderDeviceCard).join('')}
    </section>

    <div class="section-title">
      <h2>Kiosk Review</h2>
      <span class="pill ok">URL overrides enabled</span>
    </div>
    <section class="recommendations">
      <article>
        <h3>Frame UX</h3>
        <p><code>disable_navigation</code> and <code>hide_cursor</code> are controlled per frame to reduce accidental UI on touch panels and kiosk browsers.</p>
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

function renderDeviceCard(device: SetupPageDevice): string {
  const rendererUrl = device.rendererUrl
    ? redactSensitiveQueryParams(device.rendererUrl)
    : 'Not resolved yet';
  const sleepWindow = device.disableSleep
    ? 'Disabled'
    : `${device.sleepStart || 'config'} -> ${device.sleepEnd || 'config'}`;
  return `<article class="device">
    <div class="device-head">
      <div class="stack">
        <h3>${escapeHtml(device.name)}</h3>
        <span class="muted">${escapeHtml(device.id)}</span>
      </div>
      ${renderStatusPill(device.resolvedNetworkMode ?? device.networkMode ?? 'unknown')}
    </div>
    <div class="device-body">
      <div class="stack">
        <div class="row">
          <span class="label">Frame URL</span>
          <button type="button" data-copy="${escapeAttribute(device.frameUrl)}">Copy</button>
        </div>
        <code>${escapeHtml(device.frameUrl)}</code>
      </div>
      <div class="stack">
        <div class="row">
          <span class="label">Renderer URL</span>
          <button type="button" data-copy="${escapeAttribute(rendererUrl)}">Copy</button>
        </div>
        <code>${escapeHtml(rendererUrl)}</code>
      </div>
      <dl class="kv">
        ${renderKeyValue('Duration', `${device.durationSeconds ?? 'unknown'}s`)}
        ${renderKeyValue('Fit / Order', `${device.imageFit ?? 'config'} / ${device.albumOrder ?? 'config'}`)}
        ${renderKeyValue('Transition', device.transition ?? 'config')}
        ${renderKeyValue('Layout', device.layout ?? 'config')}
        ${renderKeyValue('Image Effect', device.imageEffect ?? 'config')}
        ${renderKeyValue('Background', boolLabel(device.backgroundBlur))}
        ${renderKeyValue('Frameless', boolLabel(device.frameless))}
        ${renderKeyValue('Navigation', device.disableNavigation ? 'Disabled' : 'Enabled')}
        ${renderKeyValue('Cursor', device.hideCursor ? 'Hidden' : 'Visible')}
        ${renderKeyValue('Progress Bar', `${boolLabel(device.showProgressBar)} / ${device.progressBarPosition ?? 'top'}`)}
        ${renderKeyValue('Burn-in', `${device.burnInInterval ?? 0}m / ${device.burnInDuration ?? 30}s / ${device.burnInOpacity ?? 30}%`)}
        ${renderKeyValue('Sleep', sleepWindow)}
      </dl>
    </div>
  </article>`;
}

function renderKeyValue(label: string, value: string): string {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function renderStatusPill(value: string): string {
  const className = value === 'local' || value === 'external' ? 'ok' : 'warn';
  return `<span class="pill ${className}">${escapeHtml(value)}</span>`;
}

function boolLabel(value: boolean | undefined): string {
  if (value === undefined) return 'config';
  return value ? 'On' : 'Off';
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
