# Frame Mic

A tiny Android companion app that lets Home Assistant listen to a frame's microphone on demand and call the frame like an intercom. It runs next to FreeKiosk on frames such as the Lenovo Smart Frame (Android 10).

- Listening is **off by default** and is switched on and off from Home Assistant (the *Frame Mic Stream* switch) through the controller.
- When on, the microphone opens only while someone is connected to the stream, and the Android notification shows who is listening (the *Frame Mic Notification* switch can hide those details).
- Calls (Home Assistant's *Frame Call* panel) are answered automatically while listening is on, and show a small *On call* pill on screen.
- Each install generates its own random key on first launch. Every request needs that key.

## Install

1. Download `frame-mic-<version>.apk` from the GitHub release and install it on the frame.
2. Open **Frame Mic** once and allow microphone access. The app shows its key and stream URL.
3. In the controller console, open the device and enter the key under **Frame Mic Key**.
4. Optional: allow *Display over other apps* (the app opens that setting) for the on-call pill, or run `adb shell appops set org.junlim.framemic SYSTEM_ALERT_WINDOW allow`.

The app starts again by itself after a reboot or an update (for example `adb install -r`). Uninstalling it deletes the key; a reinstall shows a new one.

## HTTP API

The app listens on port `8765`. Every endpoint needs `?k=<key>`.

| Endpoint | Purpose |
|---|---|
| `GET /status` | JSON state: `enabled`, `streaming`, `client`, `source`, `version` |
| `GET /enable` | Allow listening (persisted) |
| `GET /disable` | Stop any stream and refuse new ones (persisted, the default) |
| `GET /mic.aac` | Live AAC-LC (ADTS, 48 kbps) stream; plays as a live stream in most players and speakers |
| `GET /mic.wav` | Live 16 kHz mono WAV stream, lossless for speech recognition |
| `GET /notify?on=1\|0` | Show or hide the listener in the Android notification (persisted, default on) |
| `POST /call` | Two-way WebRTC audio: the body is an SDP offer with all its ICE candidates, the response the answer (`application/sdp`) |
| `GET /hangup` | End the call |

Streams and calls return `423` while disabled, and `/disable` also ends a call. A new stream request takes the mic over from the previous listener, because players such as nPlayer reconnect with `Range` requests right after the first connection. A call and a stream take the mic from each other the same way.

Calls use no STUN or TURN server, so the caller must reach the frame directly (home network or VPN). The frame cancels its own speaker echo with WebRTC's software echo canceller, and plays the call at the media volume.

The app picks the first Android audio source that delivers samples and remembers it. On the Lenovo Smart Frame `VOICE_COMMUNICATION` does not initialize, so it uses `VOICE_RECOGNITION` or `MIC`. Only one app can capture the microphone at a time, so close pages that use `getUserMedia` while listening.

## Credits

Calls use [WebRTC](https://webrtc.org/) (BSD 3-Clause, © The WebRTC project authors) through Stream's prebuilt [stream-webrtc-android](https://github.com/GetStream/stream-webrtc-android) (Apache 2.0).

## Build

The build uses the Android SDK command-line tools directly (no Gradle):

```bash
./build.sh
```

It needs build-tools and a platform in `$ANDROID_HOME` (default `~/Library/Android/sdk`) and JDK 17. The WebRTC library is downloaded from Maven Central on the first build and checked against a pinned SHA-256. The APK carries 64-bit ARM WebRTC code only (about 6 MB). Releases are signed with a keystore kept outside the repository (`FRAME_MIC_KEYSTORE`, default `~/.android/frame-mic-release.jks`, password in `FRAME_MIC_KEYSTORE_PASS` or `~/.android/frame-mic-release.pass`). Use the same keystore for every release, otherwise frames must uninstall the old app before updating.
