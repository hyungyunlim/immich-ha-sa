import type { FrameDevice } from './types.js';

export function renderFramePage(device: FrameDevice): string {
  const escapedDeviceId = escapeHtml(device.id);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(device.name)}</title>
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #000;
      color: #d1d5db;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #renderer {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
      background: #000;
    }
    #fallback {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: #000;
      color: #9ca3af;
      font-size: 18px;
    }
    body.empty #fallback {
      display: flex;
    }
  </style>
</head>
<body class="empty">
  <iframe id="renderer" title="Immich frame renderer" referrerpolicy="no-referrer"></iframe>
  <div id="fallback">Waiting for frame state...</div>
  <script>
    (function () {
      var deviceId = ${JSON.stringify(escapedDeviceId)};
      var stateUrl = '/api/frame/' + encodeURIComponent(deviceId) + '/state';
      var eventsUrl = '/api/frame/' + encodeURIComponent(deviceId) + '/events';
      var iframe = document.getElementById('renderer');
      var lastVersion = 0;
      var lastRendererUrl = '';
      var pollTimer = null;
      var pollIntervalMs = ${Math.max(5, device.pollIntervalSeconds) * 1000};

      function applyState(state) {
        if (!state || !state.rendererUrl) return;
        if (state.version && state.version < lastVersion) return;
        if (state.version) lastVersion = state.version;
        if (state.rendererUrl === lastRendererUrl) {
          document.body.className = '';
          return;
        }
        lastRendererUrl = state.rendererUrl;
        iframe.src = state.rendererUrl;
        document.body.className = '';
      }

      function loadState() {
        return fetch(stateUrl, { cache: 'no-store' })
          .then(function (response) { return response.json(); })
          .then(function (payload) {
            if (payload && payload.success) applyState(payload.data);
          })
          .catch(function () {});
      }

      function startPolling() {
        if (pollTimer) return;
        pollTimer = setInterval(loadState, pollIntervalMs);
      }

      function startEvents() {
        if (!window.EventSource) {
          startPolling();
          return;
        }
        try {
          var source = new EventSource(eventsUrl);
          source.addEventListener('state', function (event) {
            try { applyState(JSON.parse(event.data)); } catch (error) {}
          });
          source.onerror = function () {
            startPolling();
          };
        } catch (error) {
          startPolling();
        }
      }

      loadState().then(function () {
        startEvents();
        startPolling();
      });
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

