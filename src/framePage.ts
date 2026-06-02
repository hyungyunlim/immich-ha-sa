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
      var keyMap = {
        next: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        previous: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        'play-pause': { key: ' ', code: 'Space', keyCode: 32 }
      };

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

      function iframeDocument() {
        try {
          return iframe.contentWindow && iframe.contentWindow.document;
        } catch (error) {
          return null;
        }
      }

      function iframeWindow() {
        try {
          return iframe.contentWindow;
        } catch (error) {
          return null;
        }
      }

      function triggerKioskApi(command) {
        var win = iframeWindow();
        if (!win || !win.kiosk) return false;
        try {
          if (command === 'next' && typeof win.kiosk.triggerNewAsset === 'function') {
            win.kiosk.triggerNewAsset();
            return true;
          }
        } catch (error) {}
        return false;
      }

      function clickKioskControl(command) {
        var doc = iframeDocument();
        if (!doc) return false;
        var selector = null;
        if (command === 'next') selector = '.navigation--next-asset, [aria-label="Next"], [title="Next"]';
        if (command === 'previous') selector = '.navigation--prev-asset, [aria-label="Previous"], [title="Previous"]';
        if (!selector) return false;
        var control = doc.querySelector(selector);
        if (!control || typeof control.click !== 'function') return false;
        control.click();
        return true;
      }

      function dispatchKioskKey(command) {
        var target = keyMap[command];
        var doc = iframeDocument();
        if (!target || !doc || !iframe.contentWindow) return false;
        var eventInit = {
          key: target.key,
          code: target.code,
          keyCode: target.keyCode,
          which: target.keyCode,
          bubbles: true,
          cancelable: true
        };
        var nodes = [doc.body, doc.documentElement, doc, iframe.contentWindow].filter(Boolean);
        nodes.forEach(function (node) {
          node.dispatchEvent(new KeyboardEvent('keydown', eventInit));
          node.dispatchEvent(new KeyboardEvent('keyup', eventInit));
        });
        return true;
      }

      function triggerKioskCommand(command) {
        if (command === 'reload') {
          try {
            if (iframe.contentWindow) iframe.contentWindow.location.reload();
            return true;
          } catch (error) {
            if (lastRendererUrl) iframe.src = lastRendererUrl;
            return false;
          }
        }
        return triggerKioskApi(command) || clickKioskControl(command) || dispatchKioskKey(command);
      }

      iframe.addEventListener('load', function () {
        try { iframe.contentWindow && iframe.contentWindow.focus(); } catch (error) {}
      });

      document.addEventListener('keyup', function (event) {
        if (event.key === 'ArrowRight') {
          if (triggerKioskCommand('next')) event.preventDefault();
        } else if (event.key === 'ArrowLeft') {
          if (triggerKioskCommand('previous')) event.preventDefault();
        } else if (event.key === ' ' || event.key === 'Spacebar') {
          if (triggerKioskCommand('play-pause')) event.preventDefault();
        }
      });

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
          source.addEventListener('command', function (event) {
            try {
              var payload = JSON.parse(event.data);
              if (payload && payload.command) triggerKioskCommand(payload.command);
            } catch (error) {}
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
