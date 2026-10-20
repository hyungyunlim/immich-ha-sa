// Frame Call panel: two-way WebRTC audio with frames running Frame Mic 0.6+.
// The offer goes through Home Assistant (/api/immich_frame/call); audio flows straight to the frame.

const STRINGS = {
  en: {
    title: "Frame Call",
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
    none: "No frames have a Frame Mic key yet.",
  },
  ko: {
    title: "액자 통화",
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
    none: "Frame Mic 키가 설정된 액자가 없어요.",
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

class ImmichFrameCallPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._frames = [];
    this._errors = {};
    this._call = null; // { entryId, state, pc, stream, muted, rtt, stats }
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (this._menu) this._menu.hass = hass;
    if (first) {
      this._t = STRINGS[(hass.language || "en").startsWith("ko") ? "ko" : "en"];
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
      this._frames = await this._hass.callApi("GET", "immich_frame/call");
      this._loadError = null;
    } catch (err) {
      this._loadError = errorMessage(err);
    }
    this._render();
  }

  async _start(frame) {
    const t = this._t;
    this._hangup();
    this._errors = {};
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this._errors[frame.entry_id] = t.insecure;
      this._render();
      return;
    }
    const call = (this._call = { entryId: frame.entry_id, state: "connecting", muted: false });
    this._audio.play().catch(() => {}); // unlocks playback while still inside the click (iOS)
    this._render();
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
          this._render();
        } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          this._hangup();
          this._errors[frame.entry_id] = pc.connectionState === "failed" ? t.failed : t.ended;
          this._render();
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
      this._render();
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
    this._render();
  }

  _toggleMute() {
    const call = this._call;
    if (!call?.stream) return;
    call.muted = !call.muted;
    call.stream.getAudioTracks().forEach((track) => (track.enabled = !call.muted));
    this._render();
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

  _render() {
    if (!this._hass) return;
    const t = this._t;
    if (!this._main) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; min-height: 100vh; background: var(--primary-background-color); color: var(--primary-text-color); }
          .toolbar { display: flex; align-items: center; height: 56px; padding: 0 12px; gap: 12px;
            background: var(--app-header-background-color); color: var(--app-header-text-color, white); }
          .toolbar .title { font-size: 20px; }
          main { max-width: 560px; margin: 0 auto; padding: 16px; display: grid; gap: 12px; }
          ha-card { display: block; padding: 16px; }
          .row { display: flex; align-items: center; gap: 12px; }
          .name { flex: 1; font-size: 18px; font-weight: 500; }
          .status { color: var(--secondary-text-color); margin-top: 4px; }
          .status.live { color: var(--success-color, #43a047); }
          .error { color: var(--error-color); margin-top: 8px; }
          .actions { display: flex; gap: 8px; margin-top: 12px; }
          button { border: 0; border-radius: 18px; padding: 8px 20px; font: inherit; font-weight: 500; cursor: pointer;
            background: var(--primary-color); color: var(--text-primary-color, white); }
          button.quiet { background: var(--secondary-background-color); color: var(--primary-text-color); }
          button.danger { background: var(--error-color); }
          button:disabled { opacity: 0.4; cursor: default; }
          .empty { color: var(--secondary-text-color); text-align: center; padding: 32px 0; }
        </style>
        <div class="toolbar"><ha-menu-button></ha-menu-button><div class="title">${escapeHtml(t.title)}</div></div>
        <main></main>
        <audio autoplay playsinline></audio>`;
      this._main = this.shadowRoot.querySelector("main");
      this._audio = this.shadowRoot.querySelector("audio");
      this._menu = this.shadowRoot.querySelector("ha-menu-button");
      this._menu.hass = this._hass;
      this._menu.narrow = this._narrow;
      this._main.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        const frame = this._frames.find((f) => f.entry_id === button.dataset.entry);
        if (button.dataset.action === "call" && frame) this._start(frame);
        if (button.dataset.action === "hangup") this._hangup();
        if (button.dataset.action === "mute") this._toggleMute();
      });
    }

    if (this._loadError) {
      this._main.innerHTML = `<div class="error">${escapeHtml(this._loadError)}</div>`;
      return;
    }
    if (!this._frames.length) {
      this._main.innerHTML = `<div class="empty">${escapeHtml(t.none)}</div>`;
      return;
    }
    this._main.innerHTML = this._frames
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
          <div class="row"><div class="name">${escapeHtml(frame.name)}</div></div>
          <div class="status ${call?.state === "connected" ? "live" : ""}" ${call ? 'id="status"' : ""}>${escapeHtml(status)}</div>
          ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
          <div class="actions">${actions}</div>
        </ha-card>`;
      })
      .join("");
  }
}

customElements.define("immich-frame-call-panel", ImmichFrameCallPanel);
