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
  localControllerBaseUrl: string;
  externalControllerBaseUrl?: string;
  localKioskBaseUrl: string;
  externalKioskBaseUrl?: string;
  deviceNetworkMode: string;
  pollIntervalSeconds: number;
  remoteControlType?: string;
  remoteApiUrl?: string;
  remoteApiKeyConfigured?: boolean;
  isDefault: boolean;
  localFrameUrl: string;
  externalFrameUrl?: string;
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
  showVideos?: boolean;
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
    .help-text {
      color: #697586;
      font-size: 12px;
      line-height: 1.35;
    }
    .url-missing {
      border: 1px dashed #cfd8e2;
      border-radius: 7px;
      padding: 10px 12px;
      color: #697586;
      background: #fbfcfd;
      font-size: 13px;
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
    .field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .field.full {
      grid-column: 1 / -1;
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
    details {
      border: 1px solid #e5ebf1;
      border-radius: 8px;
      background: #ffffff;
      padding: 12px;
    }
    summary {
      cursor: pointer;
      color: #263241;
      font-weight: 700;
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
      .form-grid {
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
      <h2>Device Management</h2>
      <span class="pill ok">Separate frame state</span>
    </div>
    <section class="panel">
      <form class="form-grid" data-device-create>
        <label class="field">
          <span class="label">Device ID</span>
          <input name="id" required pattern="[a-z0-9][a-z0-9_-]*" maxlength="64" placeholder="kitchen">
        </label>
        <label class="field">
          <span class="label">Name</span>
          <input name="name" required maxlength="80" placeholder="Kitchen Frame">
        </label>
        <label class="field">
          <span class="label">Network Mode</span>
          <select name="networkMode">
            <option value="auto">auto</option>
            <option value="local">local</option>
            <option value="external">external</option>
          </select>
        </label>
        <label class="field">
          <span class="label">Poll Interval</span>
          <input name="pollIntervalSeconds" type="number" min="5" max="300" step="1" value="20">
        </label>
        <label class="field">
          <span class="label">Remote Control</span>
          <select name="remoteControlType">
            <option value="none">none</option>
            <option value="freekiosk">freekiosk</option>
          </select>
        </label>
        <label class="field full">
          <span class="label">Local Controller URL</span>
          <input name="localControllerBaseUrl" type="url" placeholder="${escapeAttribute(params.controllerUrl)}">
        </label>
        <label class="field full">
          <span class="label">Local Kiosk URL</span>
          <input name="localKioskBaseUrl" type="url" placeholder="http://homeassistant.local:3000">
        </label>
        <label class="field full">
          <span class="label">External Controller URL</span>
          <input name="externalControllerBaseUrl" type="url" placeholder="https://frame.example.com">
          <span class="help-text">Use a tunnel hostname that routes to this controller add-on, not the Immich server or direct immich-kiosk URL.</span>
        </label>
        <label class="field full">
          <span class="label">External Kiosk URL</span>
          <input name="externalKioskBaseUrl" type="url" placeholder="https://frame.example.com/kiosk">
        </label>
        <label class="field full">
          <span class="label">Remote API URL</span>
          <input name="remoteApiUrl" type="url" placeholder="http://192.168.1.160:8080">
        </label>
        <label class="field full">
          <span class="label">Remote API Key</span>
          <input name="remoteApiKey" type="password" autocomplete="new-password" placeholder="optional">
        </label>
        <div class="form-actions">
          <span class="form-status" data-form-status></span>
          <button type="submit" class="primary">Add Device</button>
        </div>
      </form>
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

    function setStatus(form, message, failed) {
      const status = form.querySelector('[data-form-status]');
      if (!status) return;
      status.textContent = message || '';
      status.style.color = failed ? '#991b1b' : '#697586';
    }

    function optionalValue(formData, name) {
      const value = String(formData.get(name) || '').trim();
      return value ? value : undefined;
    }

    function payloadFromForm(form, includeId) {
      const formData = new FormData(form);
      const payload = {
        name: String(formData.get('name') || '').trim(),
        networkMode: String(formData.get('networkMode') || 'auto'),
        pollIntervalSeconds: Number(formData.get('pollIntervalSeconds') || 20),
        localControllerBaseUrl: optionalValue(formData, 'localControllerBaseUrl'),
        externalControllerBaseUrl: optionalValue(formData, 'externalControllerBaseUrl') ?? null,
        localKioskBaseUrl: optionalValue(formData, 'localKioskBaseUrl'),
        externalKioskBaseUrl: optionalValue(formData, 'externalKioskBaseUrl') ?? null,
        remoteControlType: String(formData.get('remoteControlType') || 'none'),
        remoteApiUrl: optionalValue(formData, 'remoteApiUrl'),
      };
      const remoteApiKey = optionalValue(formData, 'remoteApiKey');
      if (remoteApiKey) {
        payload.remoteApiKey = remoteApiKey;
      }
      if (includeId) {
        payload.id = String(formData.get('id') || '').trim().toLowerCase();
      }
      return payload;
    }

    async function requestJson(path, options) {
      const response = await fetch(path, {
        ...options,
        headers: {
          'content-type': 'application/json',
          ...(options && options.headers ? options.headers : {}),
        },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body || body.success === false) {
        throw new Error(body && body.error ? body.error.message : 'Request failed');
      }
      return body;
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
          window.location.reload();
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
          await requestJson('/api/devices/' + encodeURIComponent(deviceId), {
            method: 'PATCH',
            body: JSON.stringify(payloadFromForm(form, false)),
          });
          window.location.reload();
        } catch (error) {
          setStatus(form, error instanceof Error ? error.message : String(error), true);
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
          window.location.reload();
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
          <span class="label">Local Frame URL</span>
          <button type="button" data-copy="${escapeAttribute(device.localFrameUrl)}">Copy</button>
        </div>
        <code>${escapeHtml(device.localFrameUrl)}</code>
      </div>
      <div class="stack">
        <div class="row">
          <span class="label">External Frame URL</span>
          ${device.externalFrameUrl ? `<button type="button" data-copy="${escapeAttribute(device.externalFrameUrl)}">Copy</button>` : ''}
        </div>
        ${device.externalFrameUrl
          ? `<code>${escapeHtml(device.externalFrameUrl)}</code>`
          : '<div class="url-missing">Set External Controller URL to show the remote frame URL.</div>'}
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
        ${renderKeyValue('Videos', boolLabel(device.showVideos))}
        ${renderKeyValue('Burn-in', `${device.burnInInterval ?? 0}m / ${device.burnInDuration ?? 30}s / ${device.burnInOpacity ?? 30}%`)}
        ${renderKeyValue('Sleep', sleepWindow)}
        ${renderKeyValue('Remote', `${device.remoteControlType ?? 'none'}${device.remoteApiUrl ? ' / configured' : ''}`)}
      </dl>
      <details>
        <summary>Device Settings</summary>
        <form class="form-grid" data-device-edit="${escapeAttribute(device.id)}">
          <label class="field">
            <span class="label">Name</span>
            <input name="name" required maxlength="80" value="${escapeAttribute(device.name)}">
          </label>
          <label class="field">
            <span class="label">Network Mode</span>
            <select name="networkMode">
              ${renderNetworkModeOptions(device.networkMode ?? device.deviceNetworkMode)}
            </select>
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
            <span class="label">External Controller URL</span>
            <input name="externalControllerBaseUrl" type="url" value="${escapeAttribute(device.externalControllerBaseUrl ?? '')}">
            <span class="help-text">For remote frames, point this to the controller add-on tunnel. The frame will load /frame/${escapeHtml(device.id)} from that hostname.</span>
          </label>
          <label class="field full">
            <span class="label">External Kiosk URL</span>
            <input name="externalKioskBaseUrl" type="url" value="${escapeAttribute(device.externalKioskBaseUrl ?? '')}">
          </label>
          <label class="field">
            <span class="label">Poll Interval</span>
            <input name="pollIntervalSeconds" type="number" min="5" max="300" step="1" value="${device.pollIntervalSeconds}">
          </label>
          <label class="field">
            <span class="label">Remote Control</span>
            <select name="remoteControlType">
              ${renderRemoteControlOptions(device.remoteControlType ?? 'none')}
            </select>
          </label>
          <label class="field full">
            <span class="label">Remote API URL</span>
            <input name="remoteApiUrl" type="url" value="${escapeAttribute(device.remoteApiUrl ?? '')}" placeholder="http://192.168.1.160:8080">
          </label>
          <label class="field full">
            <span class="label">Remote API Key</span>
            <input name="remoteApiKey" type="password" autocomplete="new-password" placeholder="${device.remoteApiKeyConfigured ? 'configured; leave blank to keep' : 'optional'}">
          </label>
          <div class="form-actions">
            <span class="form-status" data-form-status></span>
            ${device.isDefault ? '' : `<button type="button" class="danger" data-delete-device="${escapeAttribute(device.id)}">Delete</button>`}
            <button type="submit" class="primary">Save Device</button>
          </div>
        </form>
      </details>
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
