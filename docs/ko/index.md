---
layout: page
title: Immich Frame Controller
---

<div class="landing">
  <section class="landing-hero">
    <h1>Immich Frame Controller</h1>
    <p class="landing-tagline">집 안의 모든 디지털 액자를 Home Assistant에서.</p>
    <p class="landing-sub">컨트롤러 하나로 여러 액자를. 사진은 Immich에, 렌더링은 immich-kiosk에 그대로.</p>
    <div class="landing-actions">
      <a class="landing-btn landing-btn-primary" href="/ko/guide/getting-started">시작하기</a>
      <a class="landing-btn" href="/ko/guide/">동작 원리</a>
      <a class="landing-btn" href="https://github.com/hyungyunlim/immich-ha-sa">GitHub</a>
    </div>
  </section>

  <section class="landing-diagram" aria-label="동작 구조">
    <div class="diagram-node">
      <span class="diagram-label">Home Assistant</span>
      <span class="diagram-desc">앨범 · 인물 · 프로필 · 슬립 · 밝기 · 자동화</span>
    </div>
    <div class="diagram-vline"></div>
    <div class="diagram-node diagram-controller">
      <span class="diagram-label">Frame Controller</span>
      <span class="diagram-desc">모든 액자를 담당하는 하나의 서비스 — 애드온 또는 Docker</span>
    </div>
    <div class="diagram-frames">
      <div class="diagram-frame">
        <div class="frame-screen frame-screen-a">
          <img src="/frames/living.webp" alt="" loading="lazy" width="640" height="640" />
        </div>
        <div class="frame-name">거실</div>
        <code class="frame-url">/f/living-room</code>
      </div>
      <div class="diagram-frame">
        <div class="frame-screen frame-screen-b">
          <img src="/frames/kitchen.webp" alt="" loading="lazy" width="640" height="640" />
        </div>
        <div class="frame-name">주방</div>
        <code class="frame-url">/f/kitchen</code>
      </div>
      <div class="diagram-frame">
        <div class="frame-screen frame-screen-c">
          <img src="/frames/parents.webp" alt="" loading="lazy" width="640" height="640" />
        </div>
        <div class="frame-name">부모님 댁</div>
        <code class="frame-url">/f/parents</code>
        <span class="frame-note">원격, 터널 경유</span>
      </div>
    </div>
    <p class="diagram-caption">액자마다 고정 URL 하나. 기기에서 한 번만 설정하면 다시 만질 일이 없습니다.</p>
    <p class="diagram-foot">사진은 내 immich-kiosk가 렌더링하고, 내 Immich에 저장되어 있습니다.</p>
  </section>

  <section class="landing-points">
    <div class="landing-point">
      <h3>액자 설정은 한 번만</h3>
      <p>액자 브라우저는 영구 URL 하나만 바라봅니다. 어떤 사진을 어떻게 보여줄지는 서버에서, 액자별로 결정됩니다.</p>
    </div>
    <div class="landing-point">
      <h3>Home Assistant로 제어</h3>
      <p>앨범, 인물, 저장된 프로필, 날짜 필터, 슬립 스케줄, 밝기까지 엔티티와 서비스로 — 자동화에 바로 쓸 수 있습니다.</p>
    </div>
    <div class="landing-point">
      <h3>아무것도 대체하지 않음</h3>
      <p>기존 Immich와 immich-kiosk는 하던 일을 그대로 합니다. API 키와 비밀번호는 서버에만 있고 액자에는 가지 않습니다.</p>
    </div>
  </section>
</div>
