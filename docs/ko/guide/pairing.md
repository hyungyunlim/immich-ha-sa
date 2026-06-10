# 페어링

페어링은 각각 한 번씩 두 가지가 있습니다: Home Assistant ↔ 컨트롤러 페어링, 그리고 각 실물 액자의 고정 URL 클레임입니다.

## Home Assistant와 컨트롤러 페어링

통합은 짧은 페어링 코드로 발급되는 API 토큰으로 컨트롤러에 인증합니다 — 토큰 수동 복사도, SSH도 필요 없습니다.

1. [애드온](./addon-install)(또는 독립 컨테이너)을 시작합니다.
2. 통합 config flow에서 컨트롤러 URL을 입력하면 페어링 단계가 나타납니다.
3. Home Assistant가 보여주는 설정 페이지 링크를 열거나, 미리 채워진 Setup URL로 접속합니다:

```text
http://<controller-host>:8082/setup
```

4. 설정 콘솔에 표시된 짧은 코드를 config flow에 입력합니다.

페어링이 성공하면 발급된 컨트롤러 API 토큰이 config entry에 저장됩니다. `controller_api_token`은 고정 폴백 용도일 뿐, 보통은 필요 없습니다.

::: warning 외부 노출 전에 페어링 완료
[터널](./remote-frames)로 컨트롤러를 노출하기 전에, LAN에서만 접근 가능한 상태에서 페어링을 끝내세요. 설정 페이지는 설정된 외부 컨트롤러 호스트로 들어온 요청을 차단합니다.
:::

## 실물 액자 클레임

빠르게 시작하려면 액자 브라우저를 고정 디바이스 URL로 바로 연결해도 됩니다:

```text
http://<controller-host>:8082/frame/lenovo
```

관리형 설정에서는 클레임 절차로 각 실물 기기에 영구 URL을 부여합니다:

1. 액자 브라우저에서 컨트롤러 Pair URL을 엽니다:

```text
http://<controller-host>:8082/pair
```

2. 액자에 프레임 코드가 표시됩니다.
3. 컴퓨터에서 설정 콘솔(컨트롤러 루트 URL)을 열고 코드를 클레임합니다.
4. 콘솔이 해당 기기의 고정 프레임 경로를 생성합니다. 예:

```text
/f/kitchen-frame-8k2p
```

이 고정 경로를 Fully Kiosk / FreeKiosk의 시작 URL로 사용하세요.

## 다음 단계

- [컨트롤러 콘솔](./controller-setup) — 디바이스, URL, 오버라이드
- [FreeKiosk 원격 제어](./freekiosk) — 밝기, 볼륨, 화면 전원
