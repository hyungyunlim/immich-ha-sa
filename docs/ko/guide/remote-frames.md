# 원격 프레임 (Cloudflare Tunnel)

LAN 밖의 액자 — 예를 들어 부모님 댁의 액자 — 도 터널을 통해 같은 고정 URL 모델을 사용할 수 있습니다. 단일 공개 도메인을 권장합니다:

```text
https://frame.example.com/frame/lenovo
https://frame.example.com/kiosk/...
```

## 터널 라우팅

저장소의 `cloudflared.example.yml`은 `/kiosk/*`를 immich-kiosk로, 나머지 전부를 컨트롤러로 라우팅합니다. 터널은 선택한 컨트롤러 호스트 포트(예: `http://localhost:8082`)를 가리키게 하세요.

::: tip 터널은 컨트롤러를 향해야 합니다
터널 호스트네임은 Immich 서버나 immich-kiosk가 아니라 컨트롤러를 가리켜야 합니다. 컨트롤러 프록시 덕분에 공개 프레임은 컨트롤러 도메인만 있으면 되고, 별도의 공개 immich-kiosk URL은 선택사항입니다.
:::

## 컨트롤러 설정

1. 먼저 로컬에서 [페어링](./pairing)을 끝내세요 — 설정 페이지는 설정된 외부 컨트롤러 호스트로 들어온 요청을 차단합니다.
2. 애드온 옵션 또는 `.env`에 `external_public_controller_url`(필요하면 `external_public_kiosk_url`도)을 설정합니다.
3. [컨트롤러 콘솔](./controller-setup)이 디바이스마다 Local Frame URL과 External Frame URL을 모두 보여줍니다.
4. 원격 액자의 브라우저를 External Frame URL로 연결합니다.

## 네트워크 모드

해당 프레임의 네트워크 모드를 `external`(또는 `auto` 유지)로 설정해 컨트롤러가 공개 프록시 URL을 내보내게 합니다 — **Network Mode** select 엔티티 또는:

```yaml
service: immich_frame.set_network_mode
data:
  device_id: lenovo
  network_mode: external
```

## 터널 환경의 실시간 업데이트

프레임 페이지는 SSE로 업데이트를 받고, 터널에서 SSE가 불안정하면 폴링(`poll_interval_seconds`)으로 폴백합니다. 원격 액자가 변경에 느리게 반응한다면 폴링 폴백이 동작 중일 가능성이 높으며, 이는 정상 동작입니다.
