import { stateMachine, type AppState } from './state'

export function initUI(): void {
  const app = document.getElementById('app')
  if (!app) return

  app.innerHTML = `
    <div class="container">
      <header class="header">
        <h1 class="logo">포토카드 키오스크</h1>
      </header>

      <main class="main">
        <div id="screen-initializing" class="screen">
          <div class="spinner"></div>
          <p class="message">시스템 초기화 중...</p>
        </div>

        <div id="screen-connecting" class="screen hidden">
          <div class="spinner"></div>
          <p class="message">기기 연결 중...</p>
          <div class="connection-options">
            <div class="ip-input-group">
              <input type="text" id="esp32-ip" placeholder="ESP32 IP (예: 192.168.0.100)" />
              <button id="btn-connect-esp32">연결</button>
            </div>
            <button id="btn-scan-network" class="btn-secondary">네트워크 스캔</button>
            <button id="btn-connect-usb" class="btn-secondary">USB 릴레이 연결</button>
          </div>
        </div>

        <div id="screen-scan-ready" class="screen hidden">
          <div class="camera-container">
            <video id="camera" autoplay playsinline muted></video>
            <div class="scan-guide">
              <div class="scan-frame"></div>
              <p class="guide-text">바코드를 여기에 비춰주세요</p>
            </div>
          </div>
          <div class="status-bar">
            <span id="device-status" class="device-status"></span>
          </div>
        </div>

        <div id="screen-scan-success" class="screen hidden">
          <div class="success-icon">✓</div>
          <p class="barcode-display" id="barcode-display"></p>
          <p class="message">바코드 인식 완료</p>
        </div>

        <div id="screen-dispensing" class="screen hidden">
          <div class="dispense-animation">
            <div class="card-icon">🎴</div>
          </div>
          <p class="message">포토카드 배출 중...</p>
        </div>

        <div id="screen-complete" class="screen hidden">
          <div class="complete-icon">🎉</div>
          <p class="message large">감사합니다!</p>
          <p class="submessage">포토카드를 꺼내주세요</p>
        </div>

        <div id="screen-error" class="screen hidden">
          <div class="error-icon">⚠️</div>
          <p class="message error" id="error-message"></p>
          <button id="btn-retry" class="btn-primary">다시 시도</button>
        </div>
      </main>
    </div>
  `

  stateMachine.subscribe(updateScreen)
}

function updateScreen({ state, barcode, errorMessage, deviceType, esp32Ip }: {
  state: AppState
  barcode: string | null
  errorMessage: string | null
  deviceType: 'esp32' | 'usb' | null
  esp32Ip: string | null
}): void {
  const screens = document.querySelectorAll('.screen')
  screens.forEach(screen => screen.classList.add('hidden'))

  const activeScreen = document.getElementById(`screen-${state.toLowerCase().replace('_', '-')}`)
  activeScreen?.classList.remove('hidden')

  if (state === 'SCAN_SUCCESS' && barcode) {
    const display = document.getElementById('barcode-display')
    if (display) display.textContent = barcode
  }

  if (state === 'ERROR' && errorMessage) {
    const errorEl = document.getElementById('error-message')
    if (errorEl) errorEl.textContent = errorMessage
  }

  if (state === 'SCAN_READY') {
    const statusEl = document.getElementById('device-status')
    if (statusEl && deviceType) {
      const text = deviceType === 'esp32'
        ? `ESP32 (${esp32Ip})`
        : 'USB 릴레이'
      statusEl.textContent = `연결됨: ${text}`
    }
  }
}

export function showScreen(screenId: string): void {
  const screens = document.querySelectorAll('.screen')
  screens.forEach(screen => screen.classList.add('hidden'))

  const target = document.getElementById(screenId)
  target?.classList.remove('hidden')
}
