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
  <title>Immich Frame Controller Setup</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f172a;
      color: #e5eef8;
    }
    body {
      margin: 0;
      min-height: 100vh;
      padding: 32px;
    }
    main {
      width: min(1040px, 100%);
      margin: 0 auto;
      background: #111827;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 28px;
      box-shadow: 0 24px 80px rgb(0 0 0 / 0.35);
    }
    h1 {
      margin: 0 0 18px;
      font-size: 24px;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin: 22px 0;
    }
    dt {
      color: #93a4b8;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 18px;
    }
    code {
      display: inline-block;
      padding: 10px 12px;
      border-radius: 6px;
      background: #020617;
      color: #f8fafc;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .code {
      font-size: 34px;
      letter-spacing: 0.08em;
    }
    p {
      color: #b8c4d3;
      line-height: 1.55;
    }
    section {
      border-top: 1px solid #334155;
      margin-top: 28px;
      padding-top: 24px;
    }
    h2 {
      font-size: 18px;
      margin: 0 0 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      overflow-wrap: anywhere;
    }
    th,
    td {
      border-bottom: 1px solid #273449;
      padding: 12px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: #93a4b8;
      font-size: 13px;
      font-weight: 600;
    }
    .muted {
      color: #93a4b8;
    }
    .pill {
      display: inline-block;
      border: 1px solid #475569;
      border-radius: 999px;
      padding: 3px 8px;
      color: #dbeafe;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <main>
    <h1>Immich Frame Controller</h1>
    <p>Use this add-on console for pairing, fixed frame URLs, and runtime diagnostics. Manage albums, timing, and sleep controls through Home Assistant entities and services.</p>
    <dl>
      <div>
        <dt>Controller URL</dt>
        <dd><code>${escapeHtml(params.controllerUrl)}</code></dd>
      </div>
      <div>
        <dt>Pairing Code</dt>
        <dd><code class="code">${escapeHtml(params.pairingCode)}</code></dd>
      </div>
      <div>
        <dt>Device ID</dt>
        <dd><code>${escapeHtml(params.deviceId)}</code></dd>
      </div>
      <div>
        <dt>Expires</dt>
        <dd>${escapeHtml(expires)}</dd>
      </div>
      <div>
        <dt>Album Cache</dt>
        <dd>${params.albumCount} albums<br><span class="muted">${escapeHtml(refreshedAt)}</span></dd>
      </div>
    </dl>
    <p>The pairing code is short-lived and is replaced after a successful pairing.</p>
    <section>
      <h2>Frames</h2>
      <table>
        <thead>
          <tr>
            <th>Device</th>
            <th>Frame URL</th>
            <th>Renderer</th>
            <th>Sleep</th>
          </tr>
        </thead>
        <tbody>
          ${params.devices.map(renderDeviceRow).join('')}
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

export function renderSetupBlockedPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Immich Frame Controller Setup</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f172a;
      color: #e5eef8;
    }
    main {
      max-width: 640px;
      background: #111827;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 28px;
    }
    p {
      color: #b8c4d3;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderDeviceRow(device: SetupPageDevice): string {
  const rendererUrl = device.rendererUrl
    ? redactSensitiveQueryParams(device.rendererUrl)
    : 'Not resolved yet';
  const sleepWindow = device.disableSleep
    ? 'Disabled by URL'
    : `${device.sleepStart || 'config'} -> ${device.sleepEnd || 'config'}`;
  return `<tr>
    <td><strong>${escapeHtml(device.name)}</strong><br><span class="muted">${escapeHtml(device.id)}</span></td>
    <td><code>${escapeHtml(device.frameUrl)}</code></td>
    <td><span class="pill">${escapeHtml(device.resolvedNetworkMode ?? device.networkMode ?? 'unknown')}</span><br><code>${escapeHtml(rendererUrl)}</code></td>
    <td>${escapeHtml(sleepWindow)}<br><span class="muted">Duration ${escapeHtml(String(device.durationSeconds ?? 'unknown'))}s</span></td>
  </tr>`;
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
