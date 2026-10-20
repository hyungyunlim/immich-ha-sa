# Frame Speaker and Mic

Each frame that uses [FreeKiosk remote control](./freekiosk) gets two audio entities in Home Assistant:

- **Frame Speaker** (`media_player`) plays audio on the frame speaker.
- **Frame Mic Stream** (`switch`) lets you listen to the frame microphone through the Frame Mic companion app.

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
4. In Home Assistant, turn on **Frame Mic Stream**. Its `stream_url` attribute is a live 16 kHz WAV stream; open it in VLC or any player that plays HTTP audio.

Turn the switch off to end any running stream and refuse new ones. The frame shows an Android notification while someone listens.

The app talks to the controller on port `8765` at the same address as the FreeKiosk REST endpoint. For a frame behind another router, forward that port the same way as the REST port.

::: warning Privacy
Only enable listening on frames where everyone in the room knows about it.
:::

### Troubleshooting

- **Switch unavailable**: the device has no Frame Mic Key, or the app is not reachable on port `8765`.
- **Stream starts slowly or cuts out**: another app is using the microphone. Android lets only one app capture at a time, so close pages that use the microphone, such as a `getUserMedia` test page in FreeKiosk.
