# Remote Frames (Cloudflare Tunnel)

A frame outside your LAN — at a parent's home, for example — can use the same fixed-URL model through a tunnel. Prefer a single public domain:

```text
https://frame.example.com/frame/lenovo
https://frame.example.com/kiosk/...
```

## Tunnel routing

`cloudflared.example.yml` in the repository routes `/kiosk/*` to immich-kiosk and everything else to the controller. Point the tunnel at the controller host port you chose, for example `http://localhost:8082`.

::: tip Point the tunnel at the controller
The tunnel hostname should point to the controller, not at the Immich server or immich-kiosk directly. With the controller proxy, the public frame only needs the controller domain — a separate public immich-kiosk URL is optional.
:::

## Controller configuration

1. Complete [pairing](./pairing) locally first — the setup page rejects requests that arrive on the configured external controller host.
2. Set `external_public_controller_url` (and optionally `external_public_kiosk_url`) in the add-on options or `.env`.
3. The [controller console](./controller-setup) then shows both a Local Frame URL and an External Frame URL for each device.
4. Point the remote frame's browser at the external frame URL.

## Network mode

Set the frame's network mode to `external` (or leave `auto`) so the controller emits public proxy URLs for that device — via the **Network Mode** select entity or:

```yaml
service: immich_frame.set_network_mode
data:
  device_id: lenovo
  network_mode: external
```

## Live updates through tunnels

The frame page receives updates over SSE and falls back to polling (`poll_interval_seconds`) when SSE is unreliable through the tunnel. If a remote frame reacts slowly to changes, the polling fallback is likely active — that is expected behavior.

## Hardware control needs a shared network {#remote-hardware-control}

The tunnel only carries browser-facing traffic: the frame loading its fixed URL, and the bridged slideshow commands (next, previous, play/pause, reload) that travel over the controller event stream.

[FreeKiosk hardware control](./freekiosk) works in the opposite direction — the controller calls the FreeKiosk REST API on the frame's own address (for example `http://192.168.1.160:8080`). A remote frame's LAN address is not reachable through the tunnel, so screen power, brightness, volume, and mute do not work over the tunnel alone.

To control hardware on a remote frame, put the controller host and the frame on the same network with a VPN or overlay network such as **WireGuard** or **Tailscale**:

1. Install WireGuard or Tailscale on the host running the controller — Home Assistant OS has a WireGuard add-on and a community Tailscale add-on — and the matching Android app on the frame.
2. In the [controller console](./controller-setup#device-management), set the device's **Remote API URL** to the frame's VPN address, for example `http://100.x.y.z:8080` (Tailscale) or the WireGuard peer IP.
3. Slideshow navigation keeps using the event stream; screen, brightness, volume, and mute now go over the VPN.

Without a VPN, a remote frame still works fully for photos and navigation — only the hardware controls are unavailable.
