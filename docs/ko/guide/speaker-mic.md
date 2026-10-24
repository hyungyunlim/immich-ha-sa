# 액자 스피커와 마이크

[FreeKiosk 원격 제어](./freekiosk)를 쓰는 액자마다 Home Assistant에 오디오 엔티티 두 개가 생깁니다.

- **Frame Speaker** (`media_player`): 액자 스피커로 소리를 재생합니다.
- **Frame Mic Stream** (`switch`): Frame Mic 보조 앱을 통해 액자 마이크를 들을 수 있게 합니다.

같은 앱으로 사이드바의 **Frames** 패널에서 양방향 통화도 할 수 있습니다.

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

Home Assistant 안에서 바로 들으려면 **미디어** > **Immich Frame Mic**에서 액자를 고릅니다(스위치가 꺼져 있으면 *switch off*로 표시됩니다). Home Assistant가 자체 로그인으로 스트림을 중계하므로, 액자의 LAN 주소에 닿지 않는 HTTPS 대시보드나 외부의 컴패니언 앱에서도 들을 수 있습니다.

스위치를 끄면 진행 중인 스트림이 끊기고 새 접속도 거부됩니다. 한 번에 한 기기만 들을 수 있고, 새 접속이 들어오면 이전 접속에서 넘겨받습니다.

누군가 듣는 동안에는 액자의 안드로이드 알림에 누가 듣는지 표시됩니다. **Frame Mic Notification** 스위치(기본 켜짐)를 끄면 그 정보가 숨겨집니다. 앱이 실행되는 동안 안드로이드는 단순한 *Frame Mic* 알림은 계속 유지합니다.

앱은 FreeKiosk REST와 같은 주소의 `8765` 포트를 씁니다. 다른 공유기 뒤에 있는 액자라면 REST 포트와 같은 방식으로 이 포트도 포워딩하세요.

## 통화

Home Assistant 사이드바 **Frames** 패널의 **통화** 탭에서 인터폰처럼 액자에 전화를 겁니다. 액자가 스스로 받아서 내 목소리를 스피커로 내보내고, 마이크 소리를 돌려보냅니다. 지연이 1초도 안 돼서 평소처럼 대화할 수 있습니다.

- Frame Mic 0.6 이상이 필요하고 **Frame Mic Stream** 스위치가 켜져 있어야 합니다. 스위치를 끄면 통화도 끊깁니다.
- Home Assistant에 `https://` 주소로 접속하세요. 브라우저는 HTTPS에서만 마이크를 허용합니다.
- 소리는 가능하면 내 기기와 액자 사이를 직접 오갑니다. Cloudflare 공개 STUN 서버 덕분에 집 밖에서 거는 통화도 상당수는 직접 연결됩니다. 직접 연결이 안 되는 경우(대부분의 모바일 망)를 위해 무료 [Cloudflare TURN 키](#집-밖에서-통화하기)를 넣으면 소리를 중계합니다. 집 밖 통화에는 Frame Mic 0.7 이상이 필요합니다.
- Frame Mic에 *다른 앱 위에 표시* 권한이 있으면 통화 중에 액자 화면 위쪽에 작은 *On call* 표시가 나옵니다(앱을 열면 권한을 요청합니다). 안드로이드 설정에서 한 번 허용하거나 adb로 `adb shell appops set org.junlim.framemic SYSTEM_ALERT_WINDOW allow`를 실행하세요.
- 패널을 벗어나면 통화가 끊깁니다. 통화와 Frame Mic 스트림은 마이크를 같이 쓰므로 나중에 시작한 쪽이 넘겨받습니다.
- 액자는 자기 스피커 소리를 소프트웨어로 제거합니다. 상대가 메아리를 듣는다면 듣는 동안 내 쪽을 음소거하세요.

통화 소리는 액자의 미디어 볼륨으로 나오며, 슬라이드쇼와 Frame Speaker와 같은 볼륨입니다. 화면을 끄면(Screen Off) 이 볼륨이 0이 되므로, 액자 볼륨이 40% 아래면 컨트롤러가 통화 동안 70%로 올렸다가 통화가 끝나면 어떻게 끝났든 원래대로 되돌립니다.

### 집 밖에서 통화하기

1. Cloudflare 대시보드에서 **Realtime** > **TURN Server**로 가서 키를 만들고 **Turn Token ID**와 **API Token**을 복사합니다.
2. 애드온 **구성**에서 **Cloudflare TURN 키 ID**와 **Cloudflare TURN API 토큰**에 넣고 애드온을 재시작합니다.

그러면 컨트롤러가 통화마다 짧게 쓰는 Cloudflare TURN 자격 증명을 나눠 줍니다. 집 네트워크에서는 여전히 직접 연결됩니다. 중계되는 통화는 같은 지역 안에서 수십 ms 정도 지연이 늘고, Cloudflare는 매달 1,000GB까지 무료입니다(통화 1시간에 약 40MB).

::: warning 개인정보
방에 있는 모든 사람이 알고 있는 액자에서만 듣기와 통화 기능을 켜세요.
:::

### 문제 해결

- **스위치가 사용할 수 없음으로 표시됨**: 디바이스에 Frame Mic Key가 없거나, `8765` 포트로 앱에 연결되지 않습니다.
- **앱 업데이트 후 멈춤**: 안드로이드가 업데이트 후 Frame Mic을 항상 다시 켜지는 않습니다. 액자에서 앱을 한 번 여세요.
- **스트림 시작이 느리거나 끊김**: 다른 앱이 마이크를 쓰고 있습니다. 안드로이드는 한 번에 한 앱만 마이크를 쓸 수 있으니, FreeKiosk에 띄운 `getUserMedia` 테스트 페이지처럼 마이크를 쓰는 화면을 닫으세요.
