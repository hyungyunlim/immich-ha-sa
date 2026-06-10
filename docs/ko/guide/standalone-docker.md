# 독립 Docker

Home Assistant Container/Core 사용자거나 Home Assistant가 컨트롤러를 관리하지 않길 원한다면, 컨트롤러를 일반 Docker 컨테이너로 실행합니다. 통합과 모든 엔티티는 동일하게 동작합니다.

## 1. 환경 구성

저장소를 클론(또는 예제 파일 복사)한 뒤:

```bash
cp .env.example .env
```

`.env`를 편집합니다:

```text
IMMICH_INTERNAL_URL=http://127.0.0.1:2283
IMMICH_API_KEY=...
KIOSK_INTERNAL_URL=http://127.0.0.1:3000
KIOSK_PASSWORD=...
PORT=8080
CONTROLLER_HOST_PORT=8082
LOCAL_PUBLIC_CONTROLLER_URL=http://<controller-host>:8082
LOCAL_PUBLIC_KIOSK_URL=http://<controller-host>:3000
EXTERNAL_PUBLIC_CONTROLLER_URL=https://frame.example.com
EXTERNAL_PUBLIC_KIOSK_URL=https://frame.example.com/kiosk
ALBUM_REFRESH_INTERVAL_SECONDS=900
CONTROLLER_API_TOKEN=
MQTT_BROKER_URL=
MQTT_USERNAME=
MQTT_PASSWORD=
```

- `PORT`는 내부 앱 포트, `CONTROLLER_HOST_PORT`는 Docker 호스트 포트입니다. `8082`가 사용 중이면 다른 포트를 고르고 `LOCAL_PUBLIC_CONTROLLER_URL`, 통합의 컨트롤러 URL, 액자 URL을 함께 수정하세요.
- `CONTROLLER_API_TOKEN`은 선택적 고정 폴백입니다 — 비워두고 [페어링](./pairing)을 사용하세요.
- `MQTT_BROKER_URL`은 선택이며 [FreeKiosk MQTT push 제어](./freekiosk#_3-선택-mqtt-push-제어)를 활성화합니다. 호스트만(`192.168.1.10`) 쓰거나 `mqtt://host:1883` 형식을 사용하고, 비워두면 MQTT가 꺼집니다.

## 2. 컨테이너 시작

저장소의 `docker-compose.example.yml`을 출발점으로 사용하세요. `/data` 볼륨에 프레임 상태, 프로필, 앨범 캐시가 저장됩니다.

```bash
docker compose --env-file .env -f docker-compose.example.yml up -d --build
```

컨트롤러가 Immich Docker 네트워크에 합류하면 `IMMICH_INTERNAL_URL`과 `KIOSK_INTERNAL_URL`에 컨테이너 이름을 쓸 수 있습니다. 브라우저용 URL은 여전히 액자에서 접근 가능해야 합니다.

## 3. 확인

```text
http://<controller-host>:8082/api/health
http://<controller-host>:8082/setup
http://<controller-host>:8082/frame/lenovo
```

이후 [통합 설치](./integration-install)로 이어가세요 — config flow의 컨트롤러 URL에 `http://<controller-host>:8082`를 입력합니다.
