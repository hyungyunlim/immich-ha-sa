// Frames panel: everything you do with the frames themselves, in one sidebar page.
//   Calls   - two-way WebRTC audio with frames running Frame Mic 0.6+. The offer goes through
//             Home Assistant (/api/immich_frame/call); audio flows straight to the frame.
//   Notices - short family notices the frames show as a pill over the slideshow.

const STRINGS = {
  en: {
    title: "Frames",
    tabCalls: "Calls",
    tabNotices: "Notices",
    call: "Call",
    hangup: "Hang up",
    mute: "Mute",
    unmute: "Unmute",
    ready: "Ready",
    off: "Turn on Frame Mic Stream to call",
    unsupported: "Needs Frame Mic 0.6 or newer",
    busy: "In a call on another device (calling takes over)",
    connecting: "Connecting…",
    connected: "On call",
    muted: "muted",
    ended: "Call ended",
    failed: "Could not connect. Calls need the home network or the VPN.",
    insecure: "Calls need HTTPS. Open Home Assistant through its https:// address.",
    noMic: "No frames have a Frame Mic key yet.",
    noticePlaceholder: "e.g. 🍽️ Dinner out at 7 tonight",
    allFrames: "All frames",
    forever: "Until deleted",
    hour: "1 hour",
    today: "Until tonight",
    tomorrow: "Until tomorrow night",
    week: "1 week",
    send: "Show on frames",
    remove: "Delete",
    untilDate: "until {date}",
    noNotices: "No notices on the frames right now.",
  },
  ko: {
    title: "액자",
    tabCalls: "통화",
    tabNotices: "공지",
    call: "통화",
    hangup: "끊기",
    mute: "음소거",
    unmute: "음소거 해제",
    ready: "대기",
    off: "Frame Mic Stream 스위치를 켜야 통화할 수 있어요",
    unsupported: "Frame Mic 0.6 이상이 필요해요",
    busy: "다른 기기에서 통화 중 (통화하면 넘겨받아요)",
    connecting: "연결 중…",
    connected: "통화 중",
    muted: "음소거",
    ended: "통화가 끝났어요",
    failed: "연결하지 못했어요. 집 와이파이나 VPN에서만 통화할 수 있어요.",
    insecure: "통화는 HTTPS에서만 돼요. https:// 주소로 Home Assistant에 접속하세요.",
    noMic: "Frame Mic 키가 설정된 액자가 없어요.",
    noticePlaceholder: "예: 🍽️ 오늘 저녁 7시 외식",
    allFrames: "모든 액자",
    forever: "지울 때까지",
    hour: "1시간",
    today: "오늘 밤까지",
    tomorrow: "내일 밤까지",
    week: "1주일",
    send: "액자에 띄우기",
    remove: "삭제",
    untilDate: "{date}까지",
    noNotices: "지금 액자에 띄운 공지가 없어요.",
  },
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const errorMessage = (err) => err?.body?.message || err?.message || err?.error || String(err);

// Waits until the offer holds every ICE candidate, so one request carries the whole offer.
const gatheringDone = (pc, ms) =>
  new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    pc.addEventListener("icegatheringstatechange", () => pc.iceGatheringState === "complete" && resolve());
    setTimeout(resolve, ms);
  });

// End of a local day, `days` from today.
const endOfDay = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 0, 0);
  return date;
};

const DURATIONS = {
  forever: () => null,
  hour: () => new Date(Date.now() + 3600_000),
  today: () => endOfDay(0),
  tomorrow: () => endOfDay(1),
  week: () => new Date(Date.now() + 7 * 86400_000),
};

class ImmichFramePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._frames = [];
    this._notices = [];
    this._errors = {};
    this._call = null; // { entryId, state, pc, stream, muted, rtt, stats }
    try {
      this._tab = localStorage.getItem("immich-frame-panel-tab") || "calls";
    } catch (err) {
      this._tab = "calls";
    }
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (this._menu) this._menu.hass = hass;
    if (first) {
      this._lang = (hass.language || "en").startsWith("ko") ? "ko" : "en";
      this._t = STRINGS[this._lang];
      this._build();
      this._startPolling();
    }
  }

  set narrow(narrow) {
    this._narrow = narrow;
    if (this._menu) this._menu.narrow = narrow;
  }

  connectedCallback() {
    if (this._hass) this._startPolling();
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._timer = null;
    this._hangup(); // leaving the panel ends the call
  }

  _startPolling() {
    if (this._timer) return;
    this._load();
    this._timer = setInterval(() => !this._call && this._load(), 10000);
  }

  async _load() {
    try {
      const [frames, notices] = await Promise.all([
        this._hass.callApi("GET", "immich_frame/frames"),
        this._hass.callApi("GET", "immich_frame/notices"),
      ]);
      this._frames = frames;
      this._notices = notices;
      this._loadError = null;
    } catch (err) {
      this._loadError = errorMessage(err);
    }
    this._renderCalls();
    this._renderNotices();
  }

  _selectTab(tab) {
    this._tab = tab;
    try {
      localStorage.setItem("immich-frame-panel-tab", tab);
    } catch (err) {
      // private mode: the tab is just not remembered
    }
    this.shadowRoot.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    this._callsEl.hidden = tab !== "calls";
    this._noticesEl.hidden = tab !== "notices";
  }

  // ---- Calls ---------------------------------------------------------------------------------------

  async _start(frame) {
    const t = this._t;
    this._hangup();
    this._errors = {};
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this._errors[frame.entry_id] = t.insecure;
      this._renderCalls();
      return;
    }
    const call = (this._call = { entryId: frame.entry_id, state: "connecting", muted: false });
    this._audio.play().catch(() => {}); // unlocks playback while still inside the click (iOS)
    this._renderCalls();
    try {
      call.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const pc = (call.pc = new RTCPeerConnection());
      call.stream.getTracks().forEach((track) => pc.addTrack(track, call.stream));
      pc.ontrack = (event) => {
        this._audio.srcObject = event.streams[0] || new MediaStream([event.track]);
        this._audio.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        if (this._call !== call) return;
        if (pc.connectionState === "connected") {
          call.state = "connected";
          this._renderCalls();
        } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          this._hangup();
          this._errors[frame.entry_id] = pc.connectionState === "failed" ? t.failed : t.ended;
          this._renderCalls();
        }
      };
      await pc.setLocalDescription(await pc.createOffer());
      await gatheringDone(pc, 2000);
      if (this._call !== call) return;
      const { sdp } = await this._hass.callApi("POST", `immich_frame/call/${frame.entry_id}`, {
        sdp: pc.localDescription.sdp,
      });
      if (this._call !== call) return;
      await pc.setRemoteDescription({ type: "answer", sdp });
      call.stats = setInterval(() => this._updateRtt(call), 2000);
    } catch (err) {
      if (this._call !== call) return;
      this._hangup(false);
      this._errors[frame.entry_id] = errorMessage(err);
      this._renderCalls();
    }
  }

  _hangup(notifyFrame = true) {
    const call = this._call;
    if (!call) return;
    this._call = null;
    clearInterval(call.stats);
    call.pc?.close();
    call.stream?.getTracks().forEach((track) => track.stop());
    if (this._audio) this._audio.srcObject = null;
    if (notifyFrame) this._hass.callApi("DELETE", `immich_frame/call/${call.entryId}`).catch(() => {});
    this._renderCalls();
  }

  _toggleMute() {
    const call = this._call;
    if (!call?.stream) return;
    call.muted = !call.muted;
    call.stream.getAudioTracks().forEach((track) => (track.enabled = !call.muted));
    this._renderCalls();
  }

  async _updateRtt(call) {
    const stats = await call.pc.getStats();
    stats.forEach((s) => {
      if (s.type === "candidate-pair" && s.nominated && s.state === "succeeded" && s.currentRoundTripTime != null) {
        call.rtt = Math.round(s.currentRoundTripTime * 1000);
      }
    });
    const status = this._call === call && this.shadowRoot.getElementById("status");
    if (status) status.textContent = this._statusText(call);
  }

  _statusText(call) {
    const t = this._t;
    if (call.state !== "connected") return t.connecting;
    return [t.connected, call.rtt != null && `RTT ${call.rtt} ms`, call.muted && t.muted].filter(Boolean).join(" · ");
  }

  _renderCalls() {
    if (!this._callsEl) return;
    const t = this._t;
    if (this._loadError) {
      this._callsEl.innerHTML = `<div class="error">${escapeHtml(this._loadError)}</div>`;
      return;
    }
    const frames = this._frames.filter((frame) => frame.mic);
    if (!frames.length) {
      this._callsEl.innerHTML = `<div class="empty">${escapeHtml(t.noMic)}</div>`;
      return;
    }
    this._callsEl.innerHTML = frames
      .map((frame) => {
        const call = this._call?.entryId === frame.entry_id ? this._call : null;
        const status = call
          ? this._statusText(call)
          : !frame.supported
            ? t.unsupported
            : !frame.enabled
              ? t.off
              : frame.call && frame.call !== "idle"
                ? t.busy
                : t.ready;
        const actions = call
          ? `<button class="quiet" data-action="mute">${escapeHtml(call.muted ? t.unmute : t.mute)}</button>
             <button class="danger" data-action="hangup">${escapeHtml(t.hangup)}</button>`
          : `<button data-action="call" data-entry="${escapeHtml(frame.entry_id)}"
               ${frame.supported && frame.enabled ? "" : "disabled"}>${escapeHtml(t.call)}</button>`;
        const error = this._errors[frame.entry_id];
        return `<ha-card>
          <div class="name">${escapeHtml(frame.name)}</div>
          <div class="status ${call?.state === "connected" ? "live" : ""}" ${call ? 'id="status"' : ""}>${escapeHtml(status)}</div>
          ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
          <div class="actions">${actions}</div>
        </ha-card>`;
      })
      .join("");
  }

  // ---- Notices -------------------------------------------------------------------------------------

  async _sendNotice(event) {
    event.preventDefault();
    const form = event.target;
    const text = form.text.value.trim();
    if (!text) return;
    const until = DURATIONS[form.duration.value]();
    form.send.disabled = true;
    this._noticeError = null;
    try {
      await this._hass.callApi("POST", "immich_frame/notices", {
        text,
        device_ids: form.frame.value ? [form.frame.value] : [],
        until: until ? until.toISOString() : undefined,
      });
      form.text.value = "";
      this._notices = await this._hass.callApi("GET", "immich_frame/notices");
    } catch (err) {
      this._noticeError = errorMessage(err);
    }
    form.send.disabled = false;
    this._renderNotices();
  }

  async _deleteNotice(id) {
    try {
      await this._hass.callApi("DELETE", `immich_frame/notices/${id}`);
      this._notices = this._notices.filter((notice) => notice.id !== id);
    } catch (err) {
      this._noticeError = errorMessage(err);
    }
    this._renderNotices();
  }

  _renderNotices() {
    if (!this._noticeListEl) return;
    const t = this._t;
    // Refresh the frame choices only when they change, so an open dropdown is left alone
    const targets = JSON.stringify(this._frames.map((f) => [f.device_id, f.name]));
    if (targets !== this._targets) {
      this._targets = targets;
      const select = this._noticeForm.frame; // not "target": that name is a built-in form property
      const current = select.value;
      select.innerHTML =
        `<option value="">${escapeHtml(t.allFrames)}</option>` +
        this._frames.map((f) => `<option value="${escapeHtml(f.device_id)}">${escapeHtml(f.name)}</option>`).join("");
      select.value = current;
    }
    this._noticeErrorEl.textContent = this._noticeError || "";
    if (!this._notices.length) {
      this._noticeListEl.innerHTML = `<div class="empty">${escapeHtml(t.noNotices)}</div>`;
      return;
    }
    const names = Object.fromEntries(this._frames.map((f) => [f.device_id, f.name]));
    const format = new Intl.DateTimeFormat(this._lang, { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
    this._noticeListEl.innerHTML = this._notices
      .map((notice) => {
        const where = notice.deviceIds?.length ? notice.deviceIds.map((id) => names[id] || id).join(", ") : t.allFrames;
        const when = notice.until ? t.untilDate.replace("{date}", format.format(new Date(notice.until))) : t.forever;
        return `<ha-card class="notice">
          <div class="notice-text">${escapeHtml(notice.text)}</div>
          <div class="row">
            <div class="status">${escapeHtml(where)} · ${escapeHtml(when)}</div>
            <button class="quiet" data-action="delete-notice" data-id="${escapeHtml(notice.id)}">${escapeHtml(t.remove)}</button>
          </div>
        </ha-card>`;
      })
      .join("");
  }

  // ---- Shell ---------------------------------------------------------------------------------------

  _build() {
    const t = this._t;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; min-height: 100vh; background: var(--primary-background-color); color: var(--primary-text-color); }
        .toolbar { display: flex; align-items: center; height: 56px; padding: 0 12px; gap: 12px;
          background: var(--app-header-background-color); color: var(--app-header-text-color, white); }
        .toolbar .title { font-size: 20px; }
        .tabs, section { max-width: 560px; margin: 0 auto; padding: 0 16px; box-sizing: border-box; }
        .tabs { display: flex; gap: 8px; padding-top: 16px; }
        .tabs button { flex: 1; }
        section { display: grid; gap: 12px; padding-top: 12px; padding-bottom: 24px; }
        section[hidden] { display: none; }
        ha-card { display: block; padding: 16px; }
        .name { font-size: 18px; font-weight: 500; }
        .status { color: var(--secondary-text-color); margin-top: 4px; flex: 1; }
        .status.live { color: var(--success-color, #43a047); }
        .error { color: var(--error-color); margin-top: 8px; }
        .error:empty { display: none; }
        .actions { display: flex; gap: 8px; margin-top: 12px; }
        .row { display: flex; align-items: center; gap: 12px; }
        .notice-text { font-size: 17px; line-height: 1.4; word-break: break-word; }
        .compose { display: grid; gap: 8px; }
        .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        input, select { font: inherit; padding: 10px 12px; border-radius: 10px; min-width: 0;
          border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
          background: var(--card-background-color, var(--primary-background-color)); color: var(--primary-text-color); }
        button { border: 0; border-radius: 18px; padding: 8px 20px; font: inherit; font-weight: 500; cursor: pointer;
          background: var(--primary-color); color: var(--text-primary-color, white); }
        button.quiet, .tabs button { background: var(--secondary-background-color); color: var(--primary-text-color); }
        .tabs button.active { background: var(--primary-color); color: var(--text-primary-color, white); }
        button.danger { background: var(--error-color); }
        button:disabled { opacity: 0.4; cursor: default; }
        .empty { color: var(--secondary-text-color); text-align: center; padding: 32px 0; }
      </style>
      <div class="toolbar"><ha-menu-button></ha-menu-button><div class="title">${escapeHtml(t.title)}</div></div>
      <div class="tabs">
        <button class="tab" data-tab="calls">${escapeHtml(t.tabCalls)}</button>
        <button class="tab" data-tab="notices">${escapeHtml(t.tabNotices)}</button>
      </div>
      <section id="calls"></section>
      <section id="notices">
        <ha-card>
          <form class="compose">
            <input name="text" maxlength="140" autocomplete="off" placeholder="${escapeHtml(t.noticePlaceholder)}">
            <div class="choices">
              <select name="frame"></select>
              <select name="duration">
                ${["today", "tomorrow", "hour", "week", "forever"]
                  .map((key) => `<option value="${key}">${escapeHtml(t[key])}</option>`)
                  .join("")}
              </select>
            </div>
            <div class="error"></div>
            <div class="actions"><button name="send">${escapeHtml(t.send)}</button></div>
          </form>
        </ha-card>
        <div id="notice-list" style="display: grid; gap: 12px"></div>
      </section>
      <audio autoplay playsinline></audio>`;
    const root = this.shadowRoot;
    this._callsEl = root.getElementById("calls");
    this._noticesEl = root.getElementById("notices");
    this._noticeListEl = root.getElementById("notice-list");
    this._noticeForm = root.querySelector("form");
    this._noticeErrorEl = root.querySelector("form .error");
    this._audio = root.querySelector("audio");
    this._menu = root.querySelector("ha-menu-button");
    this._menu.hass = this._hass;
    this._menu.narrow = this._narrow;
    this._noticeForm.addEventListener("submit", (event) => this._sendNotice(event));
    root.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.tab) return this._selectTab(button.dataset.tab);
      const frame = this._frames.find((f) => f.entry_id === button.dataset.entry);
      if (button.dataset.action === "call" && frame) this._start(frame);
      if (button.dataset.action === "hangup") this._hangup();
      if (button.dataset.action === "mute") this._toggleMute();
      if (button.dataset.action === "delete-notice") this._deleteNotice(button.dataset.id);
    });
    this._selectTab(this._tab);
  }
}

customElements.define("immich-frame-panel", ImmichFramePanel);
