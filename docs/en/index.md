---
layout: page
title: Immich Frame Controller
---

<div class="landing">
  <section class="landing-hero">
    <h1>Immich Frame Controller</h1>
    <p class="landing-tagline">Run every photo frame in the house from Home Assistant.</p>
    <p class="landing-sub">One controller, many frames. Photos stay in your Immich — rendering stays in your immich-kiosk.</p>
    <div class="landing-actions">
      <a class="landing-btn landing-btn-primary" href="/en/guide/getting-started">Get Started</a>
      <a class="landing-btn" href="/en/guide/">How it works</a>
      <a class="landing-btn" href="https://github.com/hyungyunlim/immich-ha-sa">GitHub</a>
    </div>
  </section>

  <section class="landing-diagram" aria-label="How it works">
    <div class="diagram-node">
      <span class="diagram-label">Home Assistant</span>
      <span class="diagram-desc">albums · people · profiles · sleep · brightness · automations</span>
    </div>
    <div class="diagram-vline"></div>
    <div class="diagram-node diagram-controller">
      <span class="diagram-label">Frame Controller</span>
      <span class="diagram-desc">one service for all frames — add-on or Docker</span>
    </div>
    <div class="diagram-frames">
      <div class="diagram-frame">
        <div class="frame-mat">
          <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="62" cy="36" r="11" />
              <path d="M16 102 L42 66 L58 88 L70 74 L84 102" />
              <path d="M14 102 H86" />
            </g>
          </svg>
        </div>
        <div class="frame-name">Living room</div>
        <code class="frame-url">/f/living-room</code>
      </div>
      <div class="diagram-frame">
        <div class="frame-mat">
          <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M40 102 Q34 84 44 74 L56 74 Q66 84 60 102 Z" />
              <path d="M50 74 C50 58 42 54 36 44" />
              <path d="M50 74 C50 56 58 50 66 38" />
              <circle cx="34" cy="40" r="2.5" />
              <circle cx="68" cy="34" r="2.5" />
              <path d="M26 102 H74" />
            </g>
          </svg>
        </div>
        <div class="frame-name">Kitchen</div>
        <code class="frame-url">/f/kitchen</code>
      </div>
      <div class="diagram-frame">
        <div class="frame-mat">
          <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="40" cy="58" r="10" />
              <path d="M24 104 Q24 74 40 74 Q56 74 56 104" />
              <circle cx="66" cy="64" r="8" />
              <path d="M52 104 Q52 80 66 80 Q80 80 80 104" />
            </g>
          </svg>
        </div>
        <div class="frame-name">Parents' home</div>
        <code class="frame-url">/f/parents</code>
        <span class="frame-note">remote, via tunnel</span>
      </div>
    </div>
    <p class="diagram-caption">Each frame keeps one fixed URL. Set it once on the device — never touch it again.</p>
    <p class="diagram-foot">Photos rendered by your immich-kiosk, stored in your Immich.</p>
  </section>

  <section class="landing-points">
    <div class="landing-point">
      <h3>Set up the frame once</h3>
      <p>The frame browser points at a single permanent URL. Which photos it shows, and how, is decided server-side — per frame.</p>
    </div>
    <div class="landing-point">
      <h3>Control from Home Assistant</h3>
      <p>Albums, people, saved profiles, date filters, sleep schedules, and brightness as entities and services — ready for automations.</p>
    </div>
    <div class="landing-point">
      <h3>Nothing gets replaced</h3>
      <p>Your existing Immich and immich-kiosk keep doing their jobs. API keys and passwords stay on the server, never on the frame.</p>
    </div>
  </section>
</div>
