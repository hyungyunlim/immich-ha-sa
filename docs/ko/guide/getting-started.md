# 시작하기

## 사전 요구사항

- 실행 중인 **Immich** 서버와 Immich API 키
- 실행 중인 **immich-kiosk** 인스턴스
- **Home Assistant 2026.3.0** 이상
- 애드온 사용 시: **Home Assistant OS** 또는 **Supervised**. Container/Core 사용자는 [독립 Docker](./standalone-docker)로 컨트롤러를 실행합니다.
- 키오스크 브라우저가 설치된 액자 — 안드로이드의 Fully Kiosk Browser 또는 FreeKiosk

::: tip Kiosk 비밀번호
immich-kiosk에서 `KIOSK_PASSWORD`를 사용 중이라면 컨트롤러에도 같은 값을 설정하세요 (애드온 옵션 `kiosk_password`, 독립 Docker는 `KIOSK_PASSWORD` 환경변수). 컨트롤러가 렌더러 URL을 생성할 때 필요한 `password` 쿼리 파라미터를 자동으로 덧붙입니다.
:::

## 설치 개요

컨트롤러와 Home Assistant 통합은 별도로 설치합니다. 애드온(또는 독립 컨테이너)이 컨트롤러를 실행하고, 통합이 엔티티와 서비스를 제공합니다. 둘 다 설치하세요.

| 단계 | 내용 | 위치 |
| --- | --- | --- |
| 1 | [애드온 설치](./addon-install) — 컨트롤러 실행 | 설정 → 애드온 |
| 2 | [통합 설치](./integration-install) — 엔티티와 서비스 | HACS |
| 3 | [페어링 후 액자 연결](./pairing) — 고정 URL 지정 | 액자 브라우저 |

## 설치가 끝나면

- `http://<home-assistant-host>:8082/setup`에서 디바이스, URL, 페어링 코드를 보여주는 컨트롤러 콘솔
- 프레임마다 앨범, 인물, 프로필, 필터, 화면 옵션 엔티티가 있는 Home Assistant 디바이스
- 절대 바뀌지 않는 URL로 Immich 사진을 보여주는 액자:

```text
http://<home-assistant-host>:8082/frame/lenovo
```

이후에는 대시보드, 자동화, 음성 비서 등 Home Assistant에서 액자에 보여줄 내용을 바꿉니다.
