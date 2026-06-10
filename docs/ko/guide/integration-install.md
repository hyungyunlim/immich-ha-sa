# 통합 설치 (HACS)

통합은 Home Assistant 엔티티와 서비스를 제공합니다. 이 저장소를 HACS 커스텀 저장소로 추가해 설치합니다.

## 1. 커스텀 저장소 추가

[![Open repository in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=hyungyunlim&repository=immich-ha-sa&category=integration)

또는 수동으로: **HACS**를 열고 **커스텀 저장소**에서 `https://github.com/hyungyunlim/immich-ha-sa`를 카테고리 **Integration**으로 추가합니다.

## 2. 다운로드 후 재시작

**Immich Frame Controller**를 다운로드한 뒤 Home Assistant를 재시작합니다.

::: info 버전 관리
HACS는 최신 GitHub 릴리스 태그 버전을 설치합니다.
:::

## 3. 통합 추가

[![Add integration to my Home Assistant](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=immich_frame)

또는 **설정 → 기기 및 서비스 → 통합구성요소 추가 → Immich Frame Controller**로 이동해 다음을 입력합니다:

- **Controller URL** — 애드온이라면 미리 채워진 `http://homeassistant.local:8082` 유지, 독립 Docker라면 해당 호스트 URL
- **Device ID** — 기본값 `lenovo`. 페어링이 끝나면 config flow가 컨트롤러의 디바이스 목록을 읽어 선택지로 보여줍니다. 목록을 불러오지 못하면 ID를 직접 입력하세요.

이후 config flow는 [페어링 단계](./pairing)로 이어집니다.

**Controller API token** 필드는 선택적 폴백입니다. 컨트롤러에 `controller_api_token` / `CONTROLLER_API_TOKEN`을 설정한 경우가 아니라면 비워두세요.

## 여러 프레임 사용

프레임 디바이스 ID마다 통합을 한 번씩 추가합니다. 같은 디바이스 ID의 엔티티는 하나의 Home Assistant 디바이스 페이지로 묶이므로 `lenovo`, `kitchen`, `office`를 각각 독립적으로 제어할 수 있습니다. 디바이스 자체는 [컨트롤러 콘솔](./controller-setup#디바이스-관리)에서 생성합니다.

## YAML 설정 (고급)

관리형 배포에서는 YAML 설정도 지원합니다:

```yaml
immich_frame:
  controller_url: http://<controller-host>:8082
  api_token: !secret immich_frame_controller_token
  device_id: lenovo
```
