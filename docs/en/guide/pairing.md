# Pairing

Two pairings happen once each: Home Assistant pairs with the controller, and each physical frame claims its stable URL.

## Pair Home Assistant with the controller

The integration authenticates to the controller with an API token issued through a short pairing code — no manual token copying, no SSH.

1. Start the [add-on](./addon-install) (or the standalone container).
2. In the integration config flow, after entering the controller URL, the pairing step appears.
3. Open the setup page link shown by Home Assistant — or the prefilled Setup URL:

```text
http://<controller-host>:8082/setup
```

4. Enter the short code displayed on the setup console into the config flow.

When pairing succeeds, Home Assistant stores the issued controller API token in the config entry. You normally never need `controller_api_token`; it exists only as a static fallback.

::: warning Pair before exposing externally
Complete pairing while the controller is reachable only on the LAN, before exposing it through a [tunnel](./remote-frames). The setup page rejects requests that arrive on the configured external controller host.
:::

## Claim a physical frame

For a quick start, you can point the frame browser directly at the fixed device URL:

```text
http://<controller-host>:8082/frame/lenovo
```

For a managed setup, use the claim flow to give each physical device a durable URL:

1. On the frame browser, open the controller Pair URL:

```text
http://<controller-host>:8082/pair
```

2. The frame shows a frame code.
3. Open the setup console (the controller root URL) on your computer and claim the code.
4. The console generates a stable frame path for that device, for example:

```text
/f/kitchen-frame-8k2p
```

Use that stable path as the device's long-lived start URL in Fully Kiosk / FreeKiosk.

## Next steps

- [Controller console](./controller-setup) — devices, URLs, and overrides
- [FreeKiosk remote control](./freekiosk) — brightness, volume, and screen power
