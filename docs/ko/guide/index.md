# Immich Frame Controller란?

Immich Frame Controller는 Fully Kiosk Browser나 FreeKiosk를 실행하는 안드로이드 액자(예: Lenovo Smart Frame)를 Home Assistant에서 제어하는 프로젝트입니다. 사진 렌더링은 기존 [immich-kiosk](https://github.com/damongolding/immich-kiosk)가 그대로 담당합니다.

핵심 아이디어: 액자 브라우저는 **고정 URL 하나**를 영원히 유지합니다.

```text
http://<controller-host>:8082/frame/lenovo
```

어떤 앨범과 인물을 보여줄지, 전환 효과, 시계·날씨 오버레이, 슬립 스케줄 — 나머지는 모두 컨트롤러가 결정하고 Home Assistant에서 바꿉니다. 액자를 다시 만질 필요가 없습니다.

## 아키텍처

```text
Home Assistant 통합 (HACS)
        |
        v
Frame Controller
  - Home Assistant 애드온, 또는
  - 독립 Docker 컨테이너
        |
        v
액자 브라우저  /frame/<device-id>
        |
        v
immich-kiosk 렌더러
        |
        v
Immich
```

| 구성요소 | 역할 |
| --- | --- |
| **컨트롤러** | 프레임별 상태를 관리하고, 브라우저용 immich-kiosk URL을 생성·프록시하며, 설정 콘솔과 REST API를 제공합니다. Home Assistant 애드온 또는 독립 Docker 컨테이너로 실행됩니다. |
| **Home Assistant 통합** | 앨범, 인물, 프로필, 필터, 렌더러 옵션을 엔티티(select, switch, number, button 등)와 서비스로 노출합니다. HACS로 설치합니다. |
| **immich-kiosk** | 실제 슬라이드쇼를 렌더링합니다. 컨트롤러는 URL 쿼리 오버라이드만 덧붙이므로 kiosk 설정은 그대로 유지됩니다. |
| **Immich** | 사진 라이브러리. API 자격증명은 컨트롤러 서버 측에만 보관되며 액자 브라우저에는 절대 노출되지 않습니다. |

## Home Assistant에서 제어할 수 있는 것

- 앨범·인물 선택 (다중 선택, 새로고침 서비스 포함)
- 저장된 프로필 (예: "아침" 프로필) — 수동 또는 자동화로 전환
- 날짜 필터, 최신 N장 필터, 앨범 정렬
- 렌더러 옵션: 전환 효과, 레이아웃, 이미지 핏, 시계, 날짜, 날씨, 이미지 메타데이터, 폰트 크기, 배경 블러, 진행 바, 번인 방지, 슬립 스케줄
- 비디오 재생, 아카이브 자산 표시
- [FreeKiosk REST API](./freekiosk)를 통한 화면 밝기, 볼륨, 화면 전원

## 보안 모델

컨트롤러는 Immich API 키와 kiosk 비밀번호를 서버 측에 보관하고, **내부** 서비스 URL(컨트롤러 → Immich/kiosk)과 액자 브라우저가 접근하는 **공개** URL을 분리합니다. Home Assistant는 일회성 [페어링](./pairing)으로 발급된 토큰으로 컨트롤러에 인증합니다 — 토큰을 수동으로 복사할 일이 없습니다.

## 다음 단계

- [시작하기](./getting-started) — 사전 요구사항과 3단계 설치
- [애드온 설치](./addon-install) — Home Assistant OS / Supervised
- [독립 Docker](./standalone-docker) — Home Assistant Container / Core
