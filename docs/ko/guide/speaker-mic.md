# 액자 스피커와 마이크

[FreeKiosk 원격 제어](./freekiosk)를 쓰는 액자마다 Home Assistant에 오디오 엔티티 두 개가 생깁니다.

- **Frame Speaker** (`media_player`): 액자 스피커로 소리를 재생합니다.
- **Frame Mic Stream** (`switch`): Frame Mic 보조 앱을 통해 액자 마이크를 들을 수 있게 합니다.

## Frame Speaker

액자가 접근할 수 있는 오디오 주소라면 FreeKiosk의 오디오 플레이어로 재생합니다.

- Home Assistant **미디어 브라우저**에서 파일(로컬 미디어, 녹음)을 골라 Frame Speaker로 재생합니다.
- `tts.speak`의 미디어 플레이어로 Frame Speaker를 지정해 음성 안내를 보냅니다.
- 미디어 플레이어 카드에서 정지와 볼륨을 조절합니다. 볼륨은 액자의 미디어 볼륨이라 슬라이드쇼 플레이어와 공유됩니다.

```yaml
action: tts.speak
target:
  entity_id: tts.google_translate_ko_kr
data:
  media_player_entity_id: media_player.living_room_frame_speaker
  message: "저녁 준비됐어요"
```

액자는 Home Assistant 내부 URL에서 오디오를 받아오므로 액자에서 그 주소에 접근할 수 있어야 합니다(원격 액자는 VPN을 통해). FreeKiosk가 재생 종료를 알려주지 않기 때문에 Home Assistant에서는 스피커가 계속 대기 상태로 보입니다.

## Frame Mic Stream

듣기 기능에는 액자에 **Frame Mic** 보조 앱이 필요합니다. 스위치를 켜기 전까지는 꺼져 있고, 켠 뒤에도 누군가 스트림을 재생하는 동안에만 마이크가 열립니다.

1. [GitHub 릴리스](https://github.com/hyungyunlim/immich-ha-sa/releases)에서 `frame-mic-<버전>.apk`를 받아 액자에 설치합니다.
2. **Frame Mic**을 한 번 실행해 마이크 권한을 허용합니다. 앱 화면에 **키**와 스트림 주소가 나옵니다.
3. [컨트롤러 콘솔](./controller-setup)에서 디바이스를 열고 **Frame Mic Key**에 그 키를 입력합니다.
4. Home Assistant에서 **Frame Mic Stream**을 켭니다. `stream_url` 속성이 AAC 실시간 스트림입니다(Frame Mic 0.5 이상). VLC, nPlayer처럼 인터넷 라디오를 재생할 수 있는 플레이어로 엽니다. `wav_url`은 같은 소리를 무손실 WAV로 제공합니다.

스위치를 끄면 진행 중인 스트림이 끊기고 새 접속도 거부됩니다. 한 번에 한 기기만 들을 수 있고, 새 접속이 들어오면 이전 접속에서 넘겨받습니다.

누군가 듣는 동안에는 액자의 안드로이드 알림에 누가 듣는지 표시됩니다. **Frame Mic Notification** 스위치(기본 켜짐)를 끄면 그 정보가 숨겨집니다. 앱이 실행되는 동안 안드로이드는 단순한 *Frame Mic* 알림은 계속 유지합니다.

앱은 FreeKiosk REST와 같은 주소의 `8765` 포트를 씁니다. 다른 공유기 뒤에 있는 액자라면 REST 포트와 같은 방식으로 이 포트도 포워딩하세요.

::: warning 개인정보
방에 있는 모든 사람이 알고 있는 액자에서만 듣기 기능을 켜세요.
:::

### 문제 해결

- **스위치가 사용할 수 없음으로 표시됨**: 디바이스에 Frame Mic Key가 없거나, `8765` 포트로 앱에 연결되지 않습니다.
- **스트림 시작이 느리거나 끊김**: 다른 앱이 마이크를 쓰고 있습니다. 안드로이드는 한 번에 한 앱만 마이크를 쓸 수 있으니, FreeKiosk에 띄운 `getUserMedia` 테스트 페이지처럼 마이크를 쓰는 화면을 닫으세요.
