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
        <div class="frame-screen frame-screen-a">
          <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="118" cy="28" r="13" fill="#fff" opacity="0.9" />
            <path d="M0 100 L44 46 L78 100 Z" fill="#fff" opacity="0.65" />
            <path d="M52 100 L100 32 L152 100 Z" fill="#fff" opacity="0.9" />
          </svg>
        </div>
        <div class="frame-name">Living room</div>
        <code class="frame-url">/f/living-room</code>
      </div>
      <div class="diagram-frame">
        <div class="frame-screen frame-screen-b">
          <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="40" cy="28" r="12" fill="#fff" opacity="0.9" />
            <path d="M0 76 Q20 68 40 76 T80 76 T120 76 T160 76 V100 H0 Z" fill="#fff" opacity="0.8" />
            <path d="M0 90 Q20 84 40 90 T80 90 T120 90 T160 90 V100 H0 Z" fill="#fff" opacity="0.55" />
          </svg>
        </div>
        <div class="frame-name">Kitchen</div>
        <code class="frame-url">/f/kitchen</code>
      </div>
      <div class="diagram-frame">
        <div class="frame-screen frame-screen-c">
          <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="64" cy="36" r="11" fill="#fff" opacity="0.9" />
            <path d="M42 100 Q42 60 64 60 Q86 60 86 100 Z" fill="#fff" opacity="0.9" />
            <circle cx="102" cy="44" r="9" fill="#fff" opacity="0.7" />
            <path d="M84 100 Q84 66 102 66 Q120 66 120 100 Z" fill="#fff" opacity="0.7" />
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
