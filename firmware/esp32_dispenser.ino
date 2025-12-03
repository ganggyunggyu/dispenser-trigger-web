/*
 * ESP32 포토카드 배출기 컨트롤러
 * - GPIO12를 통한 릴레이 트리거
 * - REST API 서버 (CORS 지원)
 */

#include <WiFi.h>
#include <WebServer.h>

// Wi-Fi 설정 (여기에 본인 네트워크 정보 입력)
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ★★★ 고정 IP 설정 (원하는 IP로 변경) ★★★
// USE_STATIC_IP를 true로 바꾸면 항상 같은 IP로 연결됨
#define USE_STATIC_IP true
IPAddress staticIP(192, 168, 0, 200);      // ESP32가 사용할 고정 IP
IPAddress gateway(192, 168, 0, 1);         // 공유기 IP (게이트웨이)
IPAddress subnet(255, 255, 255, 0);        // 서브넷 마스크
IPAddress dns(8, 8, 8, 8);                 // DNS (구글)

// 하드웨어 설정
const int RELAY_PIN = 12;           // GPIO12 - 릴레이 트리거 핀
const int TRIGGER_DURATION = 250;   // 트리거 지속 시간 (ms)
const int LED_PIN = 2;              // 내장 LED (상태 표시)

WebServer server(80);

void setup() {
  Serial.begin(115200);

  // 핀 초기화
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  // Wi-Fi 연결
  connectWiFi();

  // 웹 서버 라우트 설정
  setupRoutes();

  server.begin();
  Serial.println("서버 시작됨");
  Serial.print("IP 주소: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  server.handleClient();

  // Wi-Fi 재연결 체크
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi 연결 끊김. 재연결 시도...");
    connectWiFi();
  }
}

void connectWiFi() {
  Serial.print("Wi-Fi 연결 중: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);

  // 고정 IP 사용 시 설정 적용
  #if USE_STATIC_IP
    if (!WiFi.config(staticIP, gateway, subnet, dns)) {
      Serial.println("고정 IP 설정 실패!");
    } else {
      Serial.print("고정 IP 사용: ");
      Serial.println(staticIP);
    }
  #endif

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN)); // LED 깜빡임
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi 연결됨!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    digitalWrite(LED_PIN, HIGH); // LED 켜짐 = 연결됨
  } else {
    Serial.println("\nWi-Fi 연결 실패");
    digitalWrite(LED_PIN, LOW);
  }
}

void setupRoutes() {
  // CORS 프리플라이트 처리
  server.on("/trigger", HTTP_OPTIONS, handleCORS);
  server.on("/health", HTTP_OPTIONS, handleCORS);

  // 메인 라우트
  server.on("/trigger", HTTP_POST, handleTrigger);
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/", HTTP_GET, handleRoot);

  // 404 처리
  server.onNotFound(handleNotFound);
}

void sendCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handleCORS() {
  sendCORSHeaders();
  server.send(204);
}

void handleTrigger() {
  sendCORSHeaders();

  Serial.println("트리거 요청 수신");

  // 릴레이 ON
  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(LED_PIN, LOW);

  delay(TRIGGER_DURATION);

  // 릴레이 OFF
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, HIGH);

  Serial.println("트리거 완료");

  String response = "{\"status\":\"ok\",\"duration\":" + String(TRIGGER_DURATION) + "}";
  server.send(200, "application/json", response);
}

void handleHealth() {
  sendCORSHeaders();

  String response = "{\"status\":\"ok\",\"ip\":\"" + WiFi.localIP().toString() + "\",\"rssi\":" + String(WiFi.RSSI()) + "}";
  server.send(200, "application/json", response);
}

void handleRoot() {
  sendCORSHeaders();

  String html = R"(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ESP32 Dispenser</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 2rem; background: #1e293b; color: white; }
    button { padding: 1rem 2rem; font-size: 1.5rem; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; }
    button:hover { background: #4f46e5; }
    .info { margin-top: 2rem; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>ESP32 배출기 컨트롤러</h1>
  <button onclick="trigger()">트리거 테스트</button>
  <div class="info">
    <p>IP: )" + WiFi.localIP().toString() + R"(</p>
    <p>RSSI: )" + String(WiFi.RSSI()) + R"( dBm</p>
  </div>
  <script>
    async function trigger() {
      try {
        const res = await fetch('/trigger', { method: 'POST' });
        const data = await res.json();
        alert('성공: ' + JSON.stringify(data));
      } catch (e) {
        alert('실패: ' + e.message);
      }
    }
  </script>
</body>
</html>
)";

  server.send(200, "text/html", html);
}

void handleNotFound() {
  sendCORSHeaders();
  server.send(404, "application/json", "{\"error\":\"not found\"}");
}
