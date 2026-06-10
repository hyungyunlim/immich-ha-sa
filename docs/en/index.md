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
        <div class="frame-screen frame-screen-a"></div>
        <div class="frame-name">Living room</div>
        <code class="frame-url">/f/living-room</code>
      </div>
      <div class="diagram-frame">
        <div class="frame-screen frame-screen-b"></div>
        <div class="frame-name">Kitchen</div>
        <code class="frame-url">/f/kitchen</code>
      </div>
      <div class="diagram-frame">
        <div class="frame-screen frame-screen-c"></div>
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
