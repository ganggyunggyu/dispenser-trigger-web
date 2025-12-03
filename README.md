# Dispenser Trigger Web

포토카드 배출기 키오스크 웹 애플리케이션. 바코드/QR 코드를 스캔하면 배출기가 작동한다.

## 주요 기능

- **바코드/QR 스캔**: 브라우저 BarcodeDetector API 활용
- **ESP32 WiFi 제어**: HTTP REST API를 통한 무선 릴레이 트리거
- **USB 릴레이 제어**: WebUSB를 통한 유선 릴레이 제어
- **PWA 지원**: 오프라인 설치 및 전체화면 모드

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | TypeScript, Vite |
| 하드웨어 통신 | ESP32 (WiFi HTTP), WebUSB |
| 바코드 인식 | BarcodeDetector API |
| 펌웨어 | Arduino (ESP32) |

## 폴더 구조

```
├── src/
│   ├── main.ts         # 앱 진입점
│   ├── esp32.ts        # ESP32 WiFi 통신 모듈
│   ├── usb.ts          # WebUSB 릴레이 제어
│   ├── barcode.ts      # 바코드 스캐너
│   ├── state.ts        # 상태 관리
│   ├── ui.ts           # UI 렌더링
│   ├── logger.ts       # 로거
│   ├── debug-panel.ts  # 디버그 패널
│   └── numpad.ts       # 숫자패드 트리거
├── firmware/
│   └── esp32_dispenser.ino  # ESP32 펌웨어
├── styles/             # CSS 스타일
├── public/             # 정적 파일
└── dist/               # 빌드 결과물
```

## 설치 및 실행

### 요구사항

- Node.js 18+
- pnpm (권장) 또는 npm

### 설치

```bash
pnpm install
# 또는
npm install
```

### 개발 서버 실행

```bash
pnpm dev
# 또는
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 빌드

```bash
pnpm build
# 또는
npm run build
```

빌드 결과물은 `dist/` 폴더에 생성된다.

## 하드웨어 설정

### ESP32 (WiFi 방식)

1. Arduino IDE에서 ESP32 보드 설치
2. `firmware/esp32_dispenser.ino` 파일 열기
3. WiFi SSID/비밀번호 수정:
   ```cpp
   const char* WIFI_SSID = "YOUR_WIFI_SSID";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   ```
4. 고정 IP 설정 (선택):
   ```cpp
   #define USE_STATIC_IP true
   IPAddress staticIP(192, 168, 0, 200);
   ```
5. ESP32에 업로드
6. 웹 앱에서 ESP32 IP 입력 후 연결

**ESP32 API 엔드포인트:**
- `GET /health` - 연결 상태 확인
- `POST /trigger` - 릴레이 트리거

### USB 릴레이 (유선 방식)

- 지원 장치: JK-USR1 USB 릴레이 (VID: 0x16C0, PID: 0x05DF)
- Chrome 또는 Edge 브라우저 필요 (WebUSB 지원)
- USB 연결 후 웹 앱에서 "USB 연결" 버튼 클릭

## 브라우저 호환성

| 기능 | Chrome | Edge | Safari | Firefox |
|------|--------|------|--------|---------|
| BarcodeDetector | O | O | X | X |
| WebUSB | O | O | X | X |
| 카메라 | O | O | O | O |

**권장 브라우저**: Chrome 또는 Edge

## 사용 방법

1. ESP32 또는 USB 릴레이 연결
2. 카메라 권한 허용
3. 바코드/QR 코드를 카메라에 비추기
4. 스캔 성공 시 배출기 자동 작동

## 라이선스

MIT
# dispenser-trigger-web
