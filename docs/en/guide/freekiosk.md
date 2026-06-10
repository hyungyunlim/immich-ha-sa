# FreeKiosk Remote Control

If the frame runs FreeKiosk, the controller can drive display and audio hardware through the FreeKiosk REST API: brightness, volume, screen power, and slideshow navigation.

## 1. Enable the REST API on the frame

In the FreeKiosk app on the frame device, enable the **Remote API** (REST). Note the device's LAN IP and the API port — `8080` by default — and set an API key if you want one.

## 2. Configure the device in the controller

Open the device settings in the [controller console](./controller-setup) and set:

- **Remote Control**: `freekiosk`
- **Remote API URL**: the FreeKiosk REST base URL, for example `http://192.168.1.160:8080`
- **Remote API Key**: optional, only if enabled in FreeKiosk

## What you get in Home Assistant

Number entities:

- **Display Brightness** — manual brightness via `/api/brightness`
- **Media Volume**

Status entities (when FreeKiosk status is available):

- **Light Level**
- **Auto Brightness Active**

Buttons:

- **Next**, **Previous**, **Play/Pause**, **Reload**
- **Screen On**, **Screen Off**
- **Volume Up**, **Volume Down**, **Device Mute Toggle**

## How commands are delivered

Next, previous, play/pause, and reload are sent to the fixed frame page over the controller event stream, then bridged into the same-origin immich-kiosk iframe. If no frame browser is connected, these commands fall back to FreeKiosk REST.

Screen, volume, and device mute controls always require the FreeKiosk REST endpoints (`/api/screen/on`, `/api/screen/off`, `/api/remote/keyboard/volumeup`, `/api/remote/keyboard/volumedown`, `/api/remote/keyboard/mute`).

::: warning Keep navigation enabled
Keep the frame's `disableNavigation` renderer option **off** when using the next/previous buttons. immich-kiosk's `disable_navigation` blocks touch, keyboard, and menu navigation, so bridged commands are ignored when it is enabled.
:::

## Audio: device mute vs. video mute

- **Device Mute Toggle**, **Volume Up/Down** — Android device audio, sent as key events through FreeKiosk. Use these for reliable frame-wide audio state.
- **Kiosk Video Mute** — a press button that controls immich-kiosk's own video mute. It clicks the kiosk's `.navigation--mute` control first, then falls back to toggling the video element's muted state. It is a press button (not a switch) because immich-kiosk does not expose a reliable readable mute state.

## Known FreeKiosk limitations

FreeKiosk 1.2.16 reports auto-brightness state in `/api/status` but does not expose the documented `/api/autoBrightness/enable` / `/api/autoBrightness/disable` endpoints. Use **Display Brightness** for manual control; FreeKiosk disables auto-brightness when needed via `/api/brightness`.
