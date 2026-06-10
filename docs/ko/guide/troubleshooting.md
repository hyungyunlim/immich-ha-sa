# 문제 해결

## 새 Immich 앨범이 Home Assistant에 안 보여요

앨범 선택지는 컨트롤러 캐시에서 나옵니다. 통합은 캐시를 30초마다 읽고, 컨트롤러는 `album_refresh_interval_seconds`(기본 900초)마다 Immich에서 캐시를 갱신합니다. 즉시 반영하려면 **Refresh Albums** 버튼을 누르거나 `immich_frame.refresh_albums` 서비스를 호출하세요.

## 비디오가 포스터만 보이고 재생되지 않아요

- 프레임의 **Show Videos** 스위치를 켜세요 (`show_videos=true`).
- immich-kiosk는 비디오 재생에 서버 측 `kiosk.prefetch` / `KIOSK_PREFETCH` 활성화도 요구합니다. 이 설정은 URL로 오버라이드할 수 없습니다.
- 컨트롤러 프록시는 WebView 비디오 재생에 필요한 HTTP range 헤더를 보존합니다. 그래도 재생되지 않으면 컨트롤러가 `0.1.13` 이상인지 확인하세요.

## 앨범에서 "Error Retrieving asset"이 떠요

선택한 앨범이 아카이브된 자산만 담고 있을 가능성이 큽니다. immich-kiosk는 기본적으로 아카이브 자산을 제외합니다 — 프레임의 **Show Archived** 스위치를 켜세요 (`show_archived=true`).

## Next / Previous 버튼이 동작하지 않아요

프레임의 `disableNavigation` 렌더러 옵션을 **꺼두세요**. immich-kiosk의 `disable_navigation`은 터치, 키보드, 메뉴 내비게이션을 차단하므로, 켜져 있는 동안 브리지된 명령과 물리 키 이벤트가 무시됩니다.

## 날씨 위치가 이상하거나 원치 않게 표시돼요

날씨 API 키와 위치는 컨트롤러가 아니라 immich-kiosk의 `config.yaml`에 있습니다. 프레임의 **Weather Location** text 엔티티에 설정된 위치 이름을 넣거나, 비워서 kiosk 기본값을 쓰거나, `rotate`로 설정된 위치들을 순환하세요. **Show Weather**를 끄면 `weather=none`이 전송되어 immich-kiosk가 기본 위치를 자동 선택하지 않습니다. 날씨 상세 select(`Use Kiosk Config` / `Show` / `Hide`)로 프레임별 상속/오버라이드를 정합니다.

## 원격 액자가 변경에 느리게 반응해요

터널에서는 SSE가 불안정할 수 있고, 그 경우 프레임은 `poll_interval_seconds`(기본 20초) 주기 폴링으로 폴백합니다. 정상 동작입니다 — 더 빠른 반응이 필요하면 주기를 줄이세요.

## 컨트롤러 포트를 바꿨더니 동작이 깨졌어요

세 곳을 함께 수정해야 합니다: `local_public_controller_url`(애드온 옵션 / env), 통합의 컨트롤러 URL, 액자 브라우저의 고정 URL.

## 사진에 비밀번호가 걸려 있거나 인증 오류가 나요

immich-kiosk가 `KIOSK_PASSWORD`를 사용하면 컨트롤러에도 같은 값이 필요합니다 (애드온 옵션 `kiosk_password` 또는 `KIOSK_PASSWORD` env). 디바이스별 오버라이드는 [컨트롤러 콘솔](./controller-setup#디바이스-관리)에서 설정합니다.

## HACS가 통합 설치를 거부해요

통합은 Home Assistant **2026.3.0** 이상이 필요합니다. Home Assistant를 업데이트한 뒤 다시 시도하세요.

## 인물 + 앨범 선택 결과가 이상해요

immich-kiosk 문서상 `require_all_people`은 앨범·날짜 범위 같은 다른 소스 버킷과 호환되지 않습니다. **Require All People**은 인물 단독 선택에서만 사용하세요 (먼저 Album select를 `No Album Filter`로).

## 그래도 안 되면

컨트롤러 헬스 엔드포인트와 로그를 확인하세요:

```text
http://<controller-host>:8082/api/health
```

애드온 로그와 함께 [GitHub 이슈](https://github.com/hyungyunlim/immich-ha-sa/issues)를 열어주세요.
