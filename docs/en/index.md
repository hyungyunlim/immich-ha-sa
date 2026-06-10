---
layout: home

hero:
  name: Immich Frame Controller
  text: Your Immich photos on any frame, driven by Home Assistant
  tagline: One fixed URL per frame. Albums, people, profiles, and display settings change from Home Assistant — the frame never needs to be touched again.
  actions:
    - theme: brand
      text: Get Started
      link: /en/guide/getting-started
    - theme: alt
      text: What is it?
      link: /en/guide/
    - theme: alt
      text: GitHub
      link: https://github.com/hyungyunlim/immich-ha-sa

features:
  - icon: 🖼️
    title: Fixed frame URL
    details: The frame browser keeps a single permanent URL. The controller decides what it shows — no more editing URLs on the device.
  - icon: 🏠
    title: Native Home Assistant control
    details: Albums, people, profiles, date filters, sleep schedules, and dozens of renderer options as entities and services.
  - icon: 📷
    title: immich-kiosk untouched
    details: Your existing immich-kiosk keeps rendering the photos. The controller only generates the URL and proxies it.
  - icon: 🎛️
    title: Hardware control via FreeKiosk
    details: Screen brightness, volume, screen on/off, and slideshow navigation through the FreeKiosk REST API.
---
