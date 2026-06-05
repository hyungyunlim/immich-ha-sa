interface FrameClaimPageParams {
  claimId: string;
  code: string;
  expiresAt: string;
  setupUrl: string;
}

export function renderFrameClaimPage(params: FrameClaimPageParams): string {
  const expiresAt = new Date(params.expiresAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <meta name="robots" content="noindex,nofollow">
  <title>Pair Frame</title>
  <style>
    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #05070a;
      color: #f8fafc;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      padding: 6vh 6vw;
      text-align: center;
    }
    .stack {
      display: grid;
      gap: 3vh;
      justify-items: center;
    }
    .label {
      color: #94a3b8;
      font-size: clamp(18px, 3vw, 32px);
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .code {
      color: #ffffff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: clamp(58px, 17vw, 170px);
      font-weight: 850;
      line-height: 1;
      letter-spacing: .04em;
    }
    .hint {
      max-width: 900px;
      color: #cbd5e1;
      font-size: clamp(16px, 2.4vw, 28px);
      line-height: 1.35;
    }
    .minor {
      color: #64748b;
      font-size: clamp(13px, 1.8vw, 20px);
    }
  </style>
</head>
<body>
  <main>
    <div class="stack">
      <div class="label">Pair this frame</div>
      <div class="code">${escapeHtml(params.code)}</div>
      <div class="hint">Enter this code in the Immich Frame Controller add-on console.</div>
      <div class="minor">Expires around ${escapeHtml(expiresAt)}. Setup: ${escapeHtml(params.setupUrl)}</div>
    </div>
  </main>
  <script>
    (function () {
      var claimId = ${JSON.stringify(params.claimId)};
      function controllerPath(path) {
        var cleanPath = String(path).replace(/^\\/+/, '');
        return new URL(cleanPath, new URL('.', window.location.href)).toString();
      }
      function poll() {
        fetch(controllerPath('/api/frame-claims/' + encodeURIComponent(claimId)), { cache: 'no-store' })
          .then(function (response) { return response.json(); })
          .then(function (payload) {
            if (payload && payload.success && payload.data && payload.data.status === 'claimed' && payload.data.framePath) {
              window.location.replace(payload.data.framePath);
            }
          })
          .catch(function () {});
      }
      setInterval(poll, 3000);
      poll();
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
