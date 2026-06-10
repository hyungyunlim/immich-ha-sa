# Troubleshooting

## A new Immich album does not appear in Home Assistant

Album options come from the controller cache. The integration reads the cache every 30 seconds and the controller refreshes it from Immich every `album_refresh_interval_seconds` (default 900). Press the **Refresh Albums** button (or call `immich_frame.refresh_albums`) to force an immediate refresh.

## Videos show a poster but do not play

- Turn on the frame's **Show Videos** switch (`show_videos=true`).
- immich-kiosk additionally requires server-side `kiosk.prefetch` / `KIOSK_PREFETCH` to be enabled for video playback; that setting cannot be overridden through the URL.
- The controller proxy preserves the HTTP range headers WebView needs for video. If videos still do not start, confirm the controller is running `0.1.13` or newer.

## "Error Retrieving asset" on an album

The selected album probably contains only archived assets. immich-kiosk excludes archived assets by default — turn on the frame's **Show Archived** switch (`show_archived=true`).

## Next / Previous buttons do nothing

Keep the frame's `disableNavigation` renderer option **off**. immich-kiosk's `disable_navigation` blocks touch, keyboard, and menu navigation, so bridged commands and physical key events are ignored while it is enabled.

## Wrong or unwanted weather location

Weather API keys and locations live in immich-kiosk's `config.yaml`, not in the controller. Set the frame's **Weather Location** text entity to a configured location name, leave it empty for the kiosk default, or `rotate` to cycle through configured locations. Turning **Show Weather** off sends `weather=none` so immich-kiosk does not auto-select its default location. The weather detail selects (`Use Kiosk Config` / `Show` / `Hide`) inherit or override per frame.

## Remote frame reacts slowly to changes

Through a tunnel, SSE can be unreliable; the frame falls back to polling every `poll_interval_seconds` (default 20). This is expected — lower the interval if you need faster reaction.

## I changed the controller port and things broke

Update all three places together: `local_public_controller_url` (add-on option / env), the integration's controller URL, and the frame browser's fixed URL.

## Photos require a password / kiosk shows an auth error

If immich-kiosk uses `KIOSK_PASSWORD`, the controller needs the same value (`kiosk_password` add-on option or `KIOSK_PASSWORD` env). Per-device overrides are available in the [controller console](./controller-setup#device-management).

## HACS refuses to install the integration

The integration requires Home Assistant **2026.3.0** or newer. Update Home Assistant, then retry.

## Person + album selection gives unexpected results

immich-kiosk documents `require_all_people` as incompatible with other source buckets such as albums and date ranges. Use **Require All People** only with a person-only selection (set the Album select to `No Album Filter` first).

## Still stuck?

Check the controller health endpoint and logs:

```text
http://<controller-host>:8082/api/health
```

Then open an issue on [GitHub](https://github.com/hyungyunlim/immich-ha-sa/issues) with the add-on log output.
