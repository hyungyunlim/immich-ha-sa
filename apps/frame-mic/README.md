# Frame Mic

A tiny Android companion app that lets Home Assistant listen to a frame's microphone on demand. It runs next to FreeKiosk on frames such as the Lenovo Smart Frame (Android 10).

- Listening is **off by default** and is switched on and off from Home Assistant (the *Frame Mic Stream* switch) through the controller.
- When on, the microphone opens only while someone is connected to the stream, and the Android notification shows who is listening.
- Each install generates its own random key on first launch. Every request needs that key.

## Install

1. Download `frame-mic-<version>.apk` from the GitHub release and install it on the frame.
2. Open **Frame Mic** once and allow microphone access. The app shows its key and stream URL.
3. In the controller console, open the device and enter the key under **Frame Mic Key**.

The app starts again by itself after a reboot. Uninstalling it deletes the key; a reinstall shows a new one.

## HTTP API

The app listens on port `8765`. Every endpoint needs `?k=<key>`.

| Endpoint | Purpose |
|---|---|
| `GET /status` | JSON state: `enabled`, `streaming`, `client`, `source`, `version` |
| `GET /enable` | Allow listening (persisted) |
| `GET /disable` | Stop any stream and refuse new ones (persisted, the default) |
| `GET /mic.wav` | Live 16 kHz mono WAV stream; `423` while disabled, `409` while someone else listens |

The app picks the first Android audio source that delivers samples and remembers it. On the Lenovo Smart Frame `VOICE_COMMUNICATION` does not initialize, so it uses `VOICE_RECOGNITION` or `MIC`. Only one app can capture the microphone at a time, so close pages that use `getUserMedia` while listening.

## Build

The build uses the Android SDK command-line tools directly (no Gradle):

```bash
./build.sh
```

It needs build-tools and a platform in `$ANDROID_HOME` (default `~/Library/Android/sdk`) and JDK 17. Releases are signed with a keystore kept outside the repository (`FRAME_MIC_KEYSTORE`, default `~/.android/frame-mic-release.jks`, password in `FRAME_MIC_KEYSTORE_PASS` or `~/.android/frame-mic-release.pass`). Use the same keystore for every release, otherwise frames must uninstall the old app before updating.
