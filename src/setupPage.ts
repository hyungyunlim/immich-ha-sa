interface SetupPageParams {
  controllerUrl: string;
  deviceId: string;
  pairingCode: string;
  expiresAt: string;
}

export function renderSetupPage(params: SetupPageParams): string {
  const expires = new Date(params.expiresAt).toLocaleString();
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
      display: grid;
      place-items: center;
      padding: 32px;
    }
    main {
      width: min(720px, 100%);
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
  </style>
</head>
<body>
  <main>
    <h1>Immich Frame Controller Setup</h1>
    <p>Open Home Assistant, add the Immich Frame Controller integration, then enter these values.</p>
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
    </dl>
    <p>The pairing code is short-lived and is replaced after a successful pairing.</p>
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
