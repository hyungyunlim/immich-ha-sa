# Frame Speaker and Mic

Each frame that uses [FreeKiosk remote control](./freekiosk) gets two audio entities in Home Assistant:

- **Frame Speaker** (`media_player`) plays audio on the frame speaker.
- **Frame Mic Stream** (`switch`) lets you listen to the frame microphone through the Frame Mic companion app.

The **Frames** sidebar panel adds two-way calls with the same app.

## Frame Speaker

The speaker plays any audio URL the frame can reach, through FreeKiosk's audio player.

- Pick a file in the Home Assistant **media browser** (local media, recordings) and play it on the Frame Speaker.
- Send speech with `tts.speak` and the Frame Speaker as the media player.
- Use stop and volume from the media player card. Volume is the frame's media volume, shared with the slideshow player.

```yaml
action: tts.speak
target:
  entity_id: tts.google_translate_ko_kr
data:
  media_player_entity_id: media_player.living_room_frame_speaker
  message: "Dinner is ready"
```

The frame fetches the audio from Home Assistant's internal URL, so that URL must be reachable from the frame (for remote frames, through the VPN). FreeKiosk does not report when a clip ends, so the speaker stays idle in Home Assistant.

## Frame Mic Stream

Listening needs the **Frame Mic** companion app on the frame. It stays off until you turn the switch on, and even then the microphone opens only while someone plays the stream.

1. Download `frame-mic-<version>.apk` from the [GitHub release](https://github.com/hyungyunlim/immich-ha-sa/releases) and install it on the frame.
2. Open **Frame Mic** once and allow microphone access. The app shows its **key** and stream URL.
3. In the [controller console](./controller-setup), open the device and enter the key under **Frame Mic Key**.
4. In Home Assistant, turn on **Frame Mic Stream**. Its `stream_url` attribute is a live AAC stream (Frame Mic 0.5+); open it in VLC, nPlayer, or any player that plays internet radio. `wav_url` is the same audio as lossless WAV.

To listen right in Home Assistant, open **Media** > **Immich Frame Mic** and pick the frame (it shows *switch off* until the switch is on). Home Assistant relays the stream with its own login, so this also works on an HTTPS dashboard or in the companion app away from home, where the frame's LAN address is out of reach.

Turn the switch off to end any running stream and refuse new ones. One device listens at a time; a new connection takes over from the previous one.

While someone listens, the frame's Android notification shows who it is. The **Frame Mic Notification** switch (on by default) hides those details; Android still keeps a plain *Frame Mic* notification while the app runs.

The app talks to the controller on port `8765` at the same address as the FreeKiosk REST endpoint. For a frame behind another router, forward that port the same way as the REST port.

## Calls

The **Calls** tab of the **Frames** panel in the Home Assistant sidebar calls a frame like an intercom: the frame answers by itself, plays your voice on its speaker, and sends its microphone back. The delay is a fraction of a second, so you can talk normally.

- Needs Frame Mic 0.6 or newer and the **Frame Mic Stream** switch on. Turning the switch off ends a call.
- Open Home Assistant through its `https://` address; browsers allow the microphone only on HTTPS.
- Audio goes directly between your device and the frame whenever it can. Cloudflare's public STUN server lets many calls from outside the home connect directly too. For calls that cannot (most mobile networks), add a free [Cloudflare TURN key](#calls-from-outside) to relay the audio. Calls from outside need Frame Mic 0.7 or newer.
- The frame shows a small *On call* pill at the top of the screen when Frame Mic may *Display over other apps* (the app asks for it when opened). Allow it once in Android settings, or with adb: `adb shell appops set org.junlim.framemic SYSTEM_ALERT_WINDOW allow`.
- Leaving the panel hangs up. A call and a Frame Mic stream share the microphone, so whichever starts last takes it over.
- The frame cancels its own speaker echo in software. If the other side hears an echo, mute yourself while listening.

The call plays at the frame's media volume, the same one the slideshow and the Frame Speaker use.

### Calls from outside

1. In the Cloudflare dashboard, open **Realtime** > **TURN Server** and create a key. Copy the **Turn Token ID** and the **API Token**.
2. In the add-on **Configuration**, enter them as **Cloudflare TURN key ID** and **Cloudflare TURN API token**, then restart the add-on.

The controller then hands each call short-lived Cloudflare TURN credentials. Calls on the home network still connect directly. A relayed call adds a few tens of milliseconds within the same region, and Cloudflare's first 1,000 GB a month are free (an hour of call audio is about 40 MB).

::: warning Privacy
Only enable listening and calls on frames where everyone in the room knows about it.
:::

### Troubleshooting

- **Switch unavailable**: the device has no Frame Mic Key, or the app is not reachable on port `8765`.
- **Stopped after updating the app**: Android does not always restart Frame Mic after an update; open the app once on the frame.
- **Stream starts slowly or cuts out**: another app is using the microphone. Android lets only one app capture at a time, so close pages that use the microphone, such as a `getUserMedia` test page in FreeKiosk.
