import type { FrameDevice } from './types.js';

interface FramePageOptions {
  preview?: boolean;
}

export function renderFramePage(device: FrameDevice, options: FramePageOptions = {}): string {
  const escapedDeviceId = escapeHtml(device.id);
  const previewMode = Boolean(options.preview);
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
    body.suspended #fallback {
      display: none;
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
      var ackUrl = '/api/frame/' + encodeURIComponent(deviceId) + '/commands/ack';
      var iframe = document.getElementById('renderer');
      var previewMode = ${JSON.stringify(previewMode)};
      var lastVersion = 0;
      var lastRendererUrl = '';
      var playbackState = 'playing';
      var rendererSuspended = false;
      var pollTimer = null;
      var pollIntervalMs = ${Math.max(previewMode ? 60 : 5, device.pollIntervalSeconds) * 1000};
      var frameVideoMuted = true;
      var keyMap = {
        next: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        previous: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        play: { key: 'P', code: 'KeyP', keyCode: 80, shiftKey: true },
        pause: { key: 'p', code: 'KeyP', keyCode: 80, shiftKey: false },
        'play-pause': { key: ' ', code: 'Space', keyCode: 32 },
        'mute-toggle': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 }
      };

      function bindRendererLoad(target) {
        target.addEventListener('load', function () {
          if (previewMode) return;
          try { target.contentWindow && target.contentWindow.focus(); } catch (error) {}
          if (playbackState === 'paused') {
            setTimeout(function () { applyPlaybackState('paused'); }, 0);
          }
        });
      }

      function createRenderer() {
        if (iframe && iframe.isConnected) return iframe;
        iframe = document.createElement('iframe');
        iframe.id = 'renderer';
        iframe.title = 'Immich frame renderer';
        iframe.referrerPolicy = 'no-referrer';
        bindRendererLoad(iframe);
        document.body.insertBefore(iframe, document.getElementById('fallback'));
        return iframe;
      }

      function suspendRenderer() {
        rendererSuspended = true;
        if (iframe) {
          iframe.remove();
          iframe = null;
        }
        document.body.className = 'suspended';
        return true;
      }

      function resumeRenderer() {
        rendererSuspended = false;
        var target = createRenderer();
        if (lastRendererUrl && target.getAttribute('src') !== lastRendererUrl) {
          target.src = lastRendererUrl;
          document.body.className = '';
        } else if (!lastRendererUrl) {
          document.body.className = 'empty';
        }
        return Boolean(target);
      }

      function applyState(state) {
        if (!state) return;
        if (state.version && state.version < lastVersion) return;
        var stateChanged = Boolean(state.version && state.version > lastVersion);
        if (state.version) lastVersion = state.version;
        if (state.rendererUrl) lastRendererUrl = state.rendererUrl;
        if (state.playbackState === 'playing' || state.playbackState === 'paused') {
          playbackState = state.playbackState;
        }
        if (state.rendererSuspended) {
          suspendRenderer();
          return;
        }
        var target = createRenderer();
        rendererSuspended = false;
        if (!lastRendererUrl) {
          document.body.className = 'empty';
          return;
        }
        if (target.getAttribute('src') === lastRendererUrl) {
          document.body.className = '';
          if (stateChanged) applyPlaybackState(playbackState);
          return;
        }
        target.src = lastRendererUrl;
        document.body.className = '';
      }

      function iframeDocument() {
        try {
          return iframe && iframe.contentWindow && iframe.contentWindow.document;
        } catch (error) {
          return null;
        }
      }

      function iframeWindow() {
        try {
          return iframe && iframe.contentWindow;
        } catch (error) {
          return null;
        }
      }

      function kioskVideoApi() {
        var win = iframeWindow();
        try {
          return win && win.immichKiosk && win.immichKiosk.video;
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
        if (command === 'play-pause') selector = '.navigation--play-pause, [aria-label="Play"], [aria-label="Pause"], [title="Play/Pause"]';
        if (command === 'mute-toggle') selector = '.navigation--mute, [aria-label="Mute"], [aria-label="Unmute"], [title="Mute"], [title="Unmute"], .mute, .unmute';
        if (!selector) return false;
        var control = doc.querySelector(selector);
        if (!control || typeof control.click !== 'function') return false;
        control.click();
        return true;
      }

      function readKioskMutedState() {
        var api = kioskVideoApi();
        if (api && typeof api.getMuted === 'function') {
          try {
            return Boolean(api.getMuted());
          } catch (error) {}
        }
        var doc = iframeDocument();
        var win = iframeWindow();
        var control = doc && doc.querySelector('.navigation--mute');
        if (control) return control.classList.contains('is-muted');
        try {
          var stored = win && win.localStorage && win.localStorage.getItem('kioskVideoIsMuted');
          if (stored === 'true') return true;
          if (stored === 'false') return false;
        } catch (error) {}
        return frameVideoMuted;
      }

      function setVideoMutedWithApi(muted) {
        var api = kioskVideoApi();
        if (!api || typeof api.setMuted !== 'function') return false;
        try {
          var result = api.setMuted(muted);
          if (typeof result === 'boolean' && result !== muted) return false;
          frameVideoMuted = muted;
          return true;
        } catch (error) {
          return false;
        }
      }

      function applyVideoMutedState(muted) {
        if (setVideoMutedWithApi(muted)) return true;
        var doc = iframeDocument();
        if (!doc) return false;
        var videos = Array.prototype.slice.call(doc.querySelectorAll('video'));
        var control = doc.querySelector('.navigation--mute');
        if (control && control.classList && control.classList.contains('is-muted') !== muted && typeof control.click === 'function') {
          control.click();
        }
        var win = iframeWindow();
        try {
          if (win && win.localStorage) {
            win.localStorage.setItem('kioskVideoIsMuted', JSON.stringify(muted));
          }
        } catch (error) {}
        videos.forEach(function (video) {
          video.muted = muted;
          if (!muted) video.volume = 1;
        });
        frameVideoMuted = muted;
        return Boolean(control || videos.length);
      }

      function syncVideoMutedFromKiosk() {
        return applyVideoMutedState(readKioskMutedState());
      }

      function toggleVideoMutedDirectly() {
        var muted = !readKioskMutedState();
        var win = iframeWindow();
        try {
          if (win && win.localStorage) {
            win.localStorage.setItem('kioskVideoIsMuted', JSON.stringify(muted));
          }
        } catch (error) {}
        return applyVideoMutedState(muted);
      }

      function toggleVideoMuted() {
        var api = kioskVideoApi();
        if (api && typeof api.toggleMuted === 'function') {
          try {
            var muted = api.toggleMuted();
            if (typeof muted === 'boolean') frameVideoMuted = muted;
            return true;
          } catch (error) {}
        }
        return clickKioskControl('mute-toggle') || toggleVideoMutedDirectly() || dispatchKioskKey('mute-toggle');
      }

      function dispatchKioskKey(command) {
        var target = keyMap[command];
        var doc = iframeDocument();
        var win = iframeWindow();
        if (!target || !doc || !win) return false;
        var eventInit = {
          key: target.key,
          code: target.code,
          keyCode: target.keyCode,
          which: target.keyCode,
          shiftKey: Boolean(target.shiftKey),
          bubbles: true,
          cancelable: true
        };
        var nodes = [doc.body, doc.documentElement, doc, win].filter(Boolean);
        nodes.forEach(function (node) {
          node.dispatchEvent(new KeyboardEvent('keydown', eventInit));
          node.dispatchEvent(new KeyboardEvent('keyup', eventInit));
        });
        return true;
      }

      function readPlaybackState() {
        var doc = iframeDocument();
        if (!doc || !doc.body) return 'unknown';
        return doc.body.classList.contains('polling-paused') ? 'paused' : 'playing';
      }

      function applyPlaybackState(targetState) {
        var current = readPlaybackState();
        if (current === targetState) {
          playbackState = targetState;
          return true;
        }
        if (current === 'unknown') return false;
        var command = targetState === 'paused' ? 'pause' : 'play';
        clickKioskControl('play-pause');
        if (readPlaybackState() !== targetState) dispatchKioskKey(command);
        var applied = readPlaybackState();
        if (applied !== targetState) return false;
        playbackState = applied;
        return true;
      }

      function togglePlaybackState() {
        var current = readPlaybackState();
        if (current === 'unknown') return false;
        return applyPlaybackState(current === 'paused' ? 'playing' : 'paused');
      }

      function previousAssetAvailable() {
        var doc = iframeDocument();
        if (!doc) return false;
        var history = doc.querySelectorAll('.kiosk-history--entry');
        if (history.length < 2) return false;
        return !history[0].value || history[0].value.charAt(0) !== '*';
      }

      function triggerKioskCommand(command) {
        if (command === 'renderer-suspend') return suspendRenderer();
        if (command === 'renderer-resume') return resumeRenderer();
        if (rendererSuspended) return false;
        if (command === 'reload') {
          try {
            if (iframe && iframe.contentWindow) iframe.contentWindow.location.reload();
            return true;
          } catch (error) {
            if (lastRendererUrl) createRenderer().src = lastRendererUrl;
            return false;
          }
        }
        if (command === 'play') return applyPlaybackState('playing');
        if (command === 'pause') return applyPlaybackState('paused');
        if (command === 'play-pause') return togglePlaybackState();
        if (command === 'previous' && !previousAssetAvailable()) return false;
        if (command === 'mute-on') {
          return applyVideoMutedState(true);
        }
        if (command === 'mute-off') {
          return applyVideoMutedState(false);
        }
        if (command === 'mute-toggle') {
          return toggleVideoMuted();
        }
        return triggerKioskApi(command) || clickKioskControl(command) || dispatchKioskKey(command);
      }

      function acknowledgeCommand(payload, success, error) {
        if (!payload || !payload.commandId || !payload.ackToken) return;
        var body = {
          commandId: payload.commandId,
          ackToken: payload.ackToken,
          success: Boolean(success),
          playbackState: readPlaybackState(),
          rendererSuspended: rendererSuspended
        };
        if (error) body.error = String(error);
        fetch(ackUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          cache: 'no-store',
          keepalive: true
        }).catch(function () {});
      }

      window.__immichFrameCommand = function (command, payload) {
        try {
          var result = triggerKioskCommand(command);
          acknowledgeCommand(payload, result, result ? undefined : 'Command was not supported by the current renderer state.');
          return result;
        } catch (error) {
          acknowledgeCommand(payload, false, error);
          return false;
        }
      };

      if (iframe) bindRendererLoad(iframe);

      document.addEventListener('keyup', function (event) {
        if (previewMode) return;
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
        if (previewMode) {
          startPolling();
          return;
        }
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
              if (payload && payload.command) window.__immichFrameCommand(payload.command, payload);
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
