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
    /* Family notices and calendar events: a quiet pill near the bottom center, above immich-kiosk's date line, one at a time.
       WebView 74 safe (no inset/gap/clamp). */
    #notice {
      position: fixed;
      left: 50%;
      bottom: 11vmin;
      z-index: 10;
      max-width: 72vw;
      padding: 1.2vmin 3vmin;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.55);
      box-shadow: 0 0.4vmin 2vmin rgba(0, 0, 0, 0.25);
      color: #fff;
      font-size: 2.8vmin;
      line-height: 1.35;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0;
      transform: translateX(-50%);
      transition: opacity 0.6s;
      pointer-events: none;
    }
    #notice.show {
      opacity: 1;
    }
    .chip {
      display: inline-block;
      margin-right: 1.4vmin;
      padding: 0.2vmin 1.5vmin;
      border-radius: 999px;
      line-height: 1.45;
      background: rgba(255, 255, 255, 0.2);
      font-size: 0.82em;
      vertical-align: 0.08em;
    }
    .chip.today {
      background: rgba(255, 183, 77, 0.5);
    }
    .time {
      margin-right: 1.2vmin;
      opacity: 0.8;
    }
    body.suspended #notice {
      display: none;
    }
    /* Calendar widget: this month with today marked, next to today's notices and events. */
    #agenda-widget {
      position: fixed;
      left: 50%;
      bottom: 11vmin;
      z-index: 10;
      display: none;
      padding: 2.6vmin 3.2vmin;
      border-radius: 3vmin;
      background: rgba(0, 0, 0, 0.5);
      box-shadow: 0 0.4vmin 2.4vmin rgba(0, 0, 0, 0.3);
      color: #fff;
      font-size: 2.4vmin;
      white-space: nowrap;
      transform: translateX(-50%);
      pointer-events: none;
    }
    #agenda-widget.show {
      display: flex;
      align-items: flex-start;
    }
    #agenda-widget .cal {
      width: 30vmin;
    }
    #agenda-widget .cal-title,
    #agenda-widget .cal-today {
      margin-bottom: 1.2vmin;
      font-weight: 600;
    }
    #agenda-widget .cal-today {
      font-size: 2.9vmin;
    }
    #agenda-widget .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      font-size: 1.9vmin;
      line-height: 3.8vmin;
      text-align: center;
    }
    #agenda-widget .wd {
      font-size: 1.6vmin;
      opacity: 0.65;
    }
    #agenda-widget .sun {
      color: #ff9e9e;
    }
    #agenda-widget .sat {
      color: #9ec5ff;
    }
    #agenda-widget .day {
      position: relative;
    }
    #agenda-widget .day b {
      display: inline-block;
      width: 3.4vmin;
      line-height: 3.4vmin;
      border-radius: 50%;
      font-weight: 400;
    }
    #agenda-widget .day.today b {
      background: rgba(255, 183, 77, 0.9);
      color: #1a1a1a;
      font-weight: 600;
    }
    #agenda-widget .day.has::after {
      content: '';
      position: absolute;
      left: 50%;
      bottom: 0;
      width: 0.6vmin;
      height: 0.6vmin;
      margin-left: -0.3vmin;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.85);
    }
    #agenda-widget .cal-list {
      min-width: 28vmin;
      max-width: 46vmin;
      margin-left: 3vmin;
      padding-left: 3vmin;
      border-left: 1px solid rgba(255, 255, 255, 0.2);
    }
    #agenda-widget .row {
      line-height: 4.6vmin;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #agenda-widget .row.empty {
      opacity: 0.6;
    }
    body.suspended #agenda-widget {
      display: none;
    }
  </style>
</head>
<body class="empty">
  <iframe id="renderer" title="Immich frame renderer" referrerpolicy="no-referrer"></iframe>
  <div id="fallback">Waiting for frame state...</div>
  <div id="notice"></div>
  <div id="agenda-widget"></div>
  <script>
    (function () {
      var deviceId = ${JSON.stringify(escapedDeviceId)};
      var stateUrl = '/api/frame/' + encodeURIComponent(deviceId) + '/state';
      var eventsUrl = '/api/frame/' + encodeURIComponent(deviceId) + '/events';
      var ackUrl = '/api/frame/' + encodeURIComponent(deviceId) + '/commands/ack';
      var noticesUrl = '/api/frame/' + encodeURIComponent(deviceId) + '/notices';
      var agendaUrl = '/api/frame/' + encodeURIComponent(deviceId) + '/agenda';
      var noticeEl = document.getElementById('notice');
      var notices = [];
      var agenda = { items: [], locale: 'en', widget: false };
      var noticeIndex = -1;
      var noticeKey = '';
      var widgetEl = document.getElementById('agenda-widget');
      var widgetHtml = '';
      var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      var agendaWords = {
        ko: {
          today: '오늘', tomorrow: '내일', allDay: '종일', noEvents: '다가오는 일정 없음',
          days: ['일', '월', '화', '수', '목', '금', '토'],
          monthTitle: function (year, month) { return year + '년 ' + (month + 1) + '월'; },
          todayTitle: function (date) {
            return (date.getMonth() + 1) + '월 ' + date.getDate() + '일 ' + ['일', '월', '화', '수', '목', '금', '토'][date.getDay()] + '요일';
          }
        },
        en: {
          today: 'Today', tomorrow: 'Tomorrow', allDay: 'All day', noEvents: 'No upcoming events',
          days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          monthTitle: function (year, month) { return months[month] + ' ' + year; },
          todayTitle: function (date) {
            return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()] + ', ' + months[date.getMonth()] + ' ' + date.getDate();
          }
        }
      };
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
        var serialized = JSON.stringify(body);
        try {
          var request = new XMLHttpRequest();
          request.open('POST', ackUrl, true);
          request.setRequestHeader('content-type', 'application/json');
          request.send(serialized);
          return;
        } catch (xhrError) {}
        try {
          fetch(ackUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: serialized,
            cache: 'no-store'
          }).catch(function () {});
        } catch (fetchError) {}
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

      // All-day events come as YYYY-MM-DD and mean local midnight, not UTC
      function eventDate(value, allDay) {
        return allDay ? new Date(value + 'T00:00:00') : new Date(value);
      }

      function midnight(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      }

      function pad(value) {
        return value < 10 ? '0' + value : String(value);
      }

      function eventEnd(item) {
        if (item.end) return eventDate(item.end, item.allDay);
        return new Date(eventDate(item.start, item.allDay).getTime() + (item.allDay ? 86400000 : 3600000));
      }

      // What rotates through the pill: notices first, then the next few calendar events
      function agendaWordsFor() {
        return agendaWords[String(agenda.locale).split('-')[0]] || agendaWords.en;
      }

      function escapeText(value) {
        return String(value).replace(/[&<>"]/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
      }

      function displayItems() {
        var now = new Date();
        var words = agendaWordsFor();
        var list = notices
          .filter(function (notice) { return !notice.until || Date.parse(notice.until) > now.getTime(); })
          .map(function (notice) { return { key: 'n' + notice.id + notice.text, text: notice.text }; });
        agenda.items
          .filter(function (item) { return eventEnd(item).getTime() > now.getTime(); })
          .slice(0, 5)
          .forEach(function (item) {
            var start = eventDate(item.start, item.allDay);
            var days = Math.round((midnight(start) - midnight(now)) / 86400000);
            var day = days <= 0 ? words.today : days === 1 ? words.tomorrow
              : (start.getMonth() + 1) + '/' + start.getDate() + ' ' + words.days[start.getDay()];
            list.push({
              key: 'a' + item.start + item.title + day,
              chip: day,
              today: days <= 0,
              time: item.allDay ? words.allDay : pad(start.getHours()) + ':' + pad(start.getMinutes()),
              text: item.title
            });
          });
        return list;
      }

      function renderNotice(item) {
        noticeEl.textContent = '';
        if (item.chip) {
          var chip = document.createElement('span');
          chip.className = item.today ? 'chip today' : 'chip';
          chip.textContent = item.chip;
          var time = document.createElement('span');
          time.className = 'time';
          time.textContent = item.time;
          noticeEl.appendChild(chip);
          noticeEl.appendChild(time);
        }
        noticeEl.appendChild(document.createTextNode(item.text));
      }

      // This month with today marked and dots on days with events, beside today's notices and events.
      function renderWidget() {
        var words = agendaWordsFor();
        var now = new Date();
        var year = now.getFullYear();
        var month = now.getMonth();
        var marked = {};
        agenda.items.forEach(function (item) {
          var day = new Date(midnight(eventDate(item.start, item.allDay)));
          var end = eventEnd(item).getTime();
          for (var i = 0; i < 62 && day.getTime() < end; i++) {
            if (day.getFullYear() === year && day.getMonth() === month) marked[day.getDate()] = true;
            day.setDate(day.getDate() + 1);
          }
        });
        var cells = words.days.map(function (name, i) {
          return '<span class="wd' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + name + '</span>';
        });
        var first = new Date(year, month, 1).getDay();
        var count = new Date(year, month + 1, 0).getDate();
        for (var blank = 0; blank < first; blank++) cells.push('<span></span>');
        for (var d = 1; d <= count; d++) {
          var weekday = (first + d - 1) % 7;
          cells.push('<span class="day' + (d === now.getDate() ? ' today' : '') + (marked[d] ? ' has' : '')
            + (weekday === 0 ? ' sun' : weekday === 6 ? ' sat' : '') + '"><b>' + d + '</b></span>');
        }
        var rows = displayItems().slice(0, 6).map(function (item) {
          return '<div class="row">' + (item.chip
            ? '<span class="chip' + (item.today ? ' today' : '') + '">' + escapeText(item.chip) + '</span>'
              + '<span class="time">' + escapeText(item.time) + '</span>'
            : '') + escapeText(item.text) + '</div>';
        });
        var html = '<div class="cal"><div class="cal-title">' + escapeText(words.monthTitle(year, month)) + '</div>'
          + '<div class="cal-grid">' + cells.join('') + '</div></div>'
          + '<div class="cal-list"><div class="cal-today">' + escapeText(words.todayTitle(now)) + '</div>'
          + (rows.length ? rows.join('') : '<div class="row empty">' + escapeText(words.noEvents) + '</div>') + '</div>';
        if (html !== widgetHtml) {
          widgetHtml = html;
          widgetEl.innerHTML = html;
        }
        widgetEl.className = 'show';
      }

      // Rotates through the items in the pill (fading out before swapping), or keeps the widget current.
      function showNextNotice() {
        if (agenda.widget) {
          noticeEl.className = ''; // notices are listed in the widget instead
          noticeKey = '';
          renderWidget();
          return;
        }
        widgetEl.className = '';
        var items = displayItems();
        if (!items.length) {
          noticeEl.className = '';
          noticeKey = '';
          return;
        }
        noticeIndex = (noticeIndex + 1) % items.length;
        var item = items[noticeIndex];
        if (noticeEl.className === 'show' && noticeKey === item.key) return;
        var delay = noticeEl.className === 'show' ? 600 : 0;
        noticeEl.className = '';
        noticeKey = item.key;
        setTimeout(function () {
          renderNotice(item);
          noticeEl.className = 'show';
        }, delay);
      }

      function setNotices(items) {
        notices = items || [];
        noticeIndex = -1;
        showNextNotice();
      }

      function setAgenda(value) {
        agenda = value && value.items ? value : { items: [], locale: 'en', widget: false };
        noticeIndex = -1;
        showNextNotice();
      }

      function loadAgenda() {
        return fetch(agendaUrl, { cache: 'no-store' })
          .then(function (response) { return response.json(); })
          .then(function (payload) {
            if (payload && payload.success) setAgenda(payload.data);
          })
          .catch(function () {});
      }

      function loadNotices() {
        return fetch(noticesUrl, { cache: 'no-store' })
          .then(function (response) { return response.json(); })
          .then(function (payload) {
            if (payload && payload.success) setNotices(payload.data.items);
          })
          .catch(function () {});
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
          source.addEventListener('notices', function (event) {
            try { setNotices(JSON.parse(event.data).items); } catch (error) {}
          });
          source.addEventListener('agenda', function (event) {
            try { setAgenda(JSON.parse(event.data)); } catch (error) {}
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
      loadNotices();
      loadAgenda();
      setInterval(showNextNotice, 8000);
      setInterval(function () { // safety net next to the live notices and agenda events
        loadNotices();
        loadAgenda();
      }, 60000);
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
