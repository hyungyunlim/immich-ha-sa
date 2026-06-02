# Immich Frame Controller

Runs the Immich Frame Controller as a Home Assistant add-on.

Use this add-on when Home Assistant OS or Home Assistant Supervised should manage the controller container. The Home Assistant integration is still required for entities, services, album selection, and automations.

After the add-on starts, open the Web UI or visit:

```text
http://<home-assistant-host>:8082/
```

The Web UI shows the pairing code, configured devices, fixed frame URLs, resolved renderer URLs, and active immich-kiosk URL override state.

Then add the `Immich Frame Controller` integration and use the same controller URL:

```text
http://<home-assistant-host>:8082
```

Album, renderer, network mode, sleep cycle, layout, transition, image effect, frame UI, progress bar, and burn-in changes are controlled through the Home Assistant integration entities and services.
