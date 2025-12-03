import { logger, type LogEntry, type LogLevel } from './logger'
import { stateMachine } from './state'
import { esp32 } from './esp32'
import { usbRelay } from './usb'
import { kioskMode } from './kiosk'

let panelVisible = false
let filterLevel: LogLevel | 'all' = 'all'

export function initDebugPanel(): void {
  createDebugButton()
  createDebugPanel()

  logger.subscribe(appendLogEntry)

  logger.info('DEBUG', '디버그 패널 초기화 완료')
  logger.info('SYSTEM', `User Agent: ${navigator.userAgent}`)
  logger.info('SYSTEM', `화면 크기: ${window.innerWidth}x${window.innerHeight}`)
  logger.info('SYSTEM', `WebUSB 지원: ${usbRelay.isSupported()}`)
  logger.info('SYSTEM', `BarcodeDetector 지원: ${'BarcodeDetector' in window}`)
}

function createDebugButton(): void {
  const btn = document.createElement('button')
  btn.id = 'debug-toggle'
  btn.innerHTML = '🔧'
  btn.title = '디버그 패널 열기'
  btn.addEventListener('click', togglePanel)
  document.body.appendChild(btn)
}

function createDebugPanel(): void {
  const panel = document.createElement('div')
  panel.id = 'debug-panel'
  panel.className = 'debug-panel hidden'

  panel.innerHTML = `
    <div class="debug-header">
      <h3>디버그 패널</h3>
      <div class="debug-actions">
        <button id="debug-clear" title="로그 지우기">🗑️</button>
        <button id="debug-close" title="닫기">✕</button>
      </div>
    </div>

    <div class="debug-tabs">
      <button class="debug-tab active" data-tab="logs">로그</button>
      <button class="debug-tab" data-tab="state">상태</button>
      <button class="debug-tab" data-tab="actions">액션</button>
    </div>

    <div class="debug-content">
      <div id="tab-logs" class="debug-tab-content active">
        <div class="log-filters">
          <button class="log-filter active" data-level="all">전체</button>
          <button class="log-filter" data-level="info">INFO</button>
          <button class="log-filter" data-level="success">SUCCESS</button>
          <button class="log-filter" data-level="warn">WARN</button>
          <button class="log-filter" data-level="error">ERROR</button>
          <button class="log-filter" data-level="debug">DEBUG</button>
        </div>
        <div id="log-container" class="log-container"></div>
      </div>

      <div id="tab-state" class="debug-tab-content">
        <div id="state-display" class="state-display"></div>
      </div>

      <div id="tab-actions" class="debug-tab-content">
        <div class="action-group">
          <h4>ESP32 테스트</h4>
          <div class="action-row">
            <input type="text" id="test-esp32-ip" placeholder="192.168.0.100" />
            <button id="action-esp32-health">Health 체크</button>
          </div>
          <button id="action-esp32-trigger" class="action-btn danger">ESP32 트리거</button>
        </div>

        <div class="action-group">
          <h4>USB 릴레이 테스트</h4>
          <button id="action-usb-connect" class="action-btn">USB 연결</button>
          <button id="action-usb-trigger" class="action-btn danger">USB 트리거</button>
        </div>

        <div class="action-group">
          <h4>상태 변경</h4>
          <button id="action-reset" class="action-btn">상태 리셋</button>
          <button id="action-test-flow" class="action-btn">전체 플로우 테스트</button>
        </div>

        <div class="action-group">
          <h4>카메라</h4>
          <button id="action-camera-info" class="action-btn">카메라 정보</button>
        </div>

        <div class="action-group">
          <h4>키오스크</h4>
          <button id="action-kiosk-toggle" class="action-btn">키오스크 모드 ON</button>
          <p style="font-size:11px;color:#94a3b8;margin-top:0.5rem">해제: 우상단 5회 탭 또는 Ctrl+Shift+K</p>
        </div>
      </div>
    </div>
  `

  document.body.appendChild(panel)

  setupEventListeners()
  startStateMonitor()
}

function setupEventListeners(): void {
  document.getElementById('debug-close')?.addEventListener('click', togglePanel)
  document.getElementById('debug-clear')?.addEventListener('click', clearLogs)

  document.querySelectorAll('.debug-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const tabName = target.dataset.tab
      if (tabName) switchTab(tabName)
    })
  })

  document.querySelectorAll('.log-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const level = target.dataset.level as LogLevel | 'all'
      setLogFilter(level)
    })
  })

  document.getElementById('action-esp32-health')?.addEventListener('click', testEsp32Health)
  document.getElementById('action-esp32-trigger')?.addEventListener('click', testEsp32Trigger)
  document.getElementById('action-usb-connect')?.addEventListener('click', testUsbConnect)
  document.getElementById('action-usb-trigger')?.addEventListener('click', testUsbTrigger)
  document.getElementById('action-reset')?.addEventListener('click', resetState)
  document.getElementById('action-test-flow')?.addEventListener('click', testFullFlow)
  document.getElementById('action-camera-info')?.addEventListener('click', getCameraInfo)
  document.getElementById('action-kiosk-toggle')?.addEventListener('click', toggleKioskMode)
}

function togglePanel(): void {
  panelVisible = !panelVisible
  const panel = document.getElementById('debug-panel')
  const btn = document.getElementById('debug-toggle')

  if (panelVisible) {
    panel?.classList.remove('hidden')
    btn?.classList.add('active')
    updateStateDisplay()
  } else {
    panel?.classList.add('hidden')
    btn?.classList.remove('active')
  }
}

function switchTab(tabName: string): void {
  document.querySelectorAll('.debug-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.debug-tab-content').forEach(c => c.classList.remove('active'))

  document.querySelector(`.debug-tab[data-tab="${tabName}"]`)?.classList.add('active')
  document.getElementById(`tab-${tabName}`)?.classList.add('active')

  if (tabName === 'state') updateStateDisplay()
}

function setLogFilter(level: LogLevel | 'all'): void {
  filterLevel = level

  document.querySelectorAll('.log-filter').forEach(b => b.classList.remove('active'))
  document.querySelector(`.log-filter[data-level="${level}"]`)?.classList.add('active')

  const container = document.getElementById('log-container')
  if (!container) return

  container.innerHTML = ''
  logger.getLogs().forEach(appendLogEntry)
}

function appendLogEntry(entry: LogEntry): void {
  if (filterLevel !== 'all' && entry.level !== filterLevel) return

  const container = document.getElementById('log-container')
  if (!container) return

  const el = document.createElement('div')
  el.className = `log-entry log-${entry.level}`

  const time = entry.timestamp.toLocaleTimeString('ko-KR', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  } as Intl.DateTimeFormatOptions)

  let dataStr = ''
  if (entry.data !== undefined) {
    try {
      dataStr = typeof entry.data === 'string'
        ? entry.data
        : JSON.stringify(entry.data, null, 2)
    } catch {
      dataStr = String(entry.data)
    }
  }

  el.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-level">${entry.level.toUpperCase()}</span>
    <span class="log-category">[${entry.category}]</span>
    <span class="log-message">${entry.message}</span>
    ${dataStr ? `<pre class="log-data">${dataStr}</pre>` : ''}
  `

  container.appendChild(el)
  container.scrollTop = container.scrollHeight
}

function clearLogs(): void {
  logger.clear()
  const container = document.getElementById('log-container')
  if (container) container.innerHTML = ''
  logger.info('DEBUG', '로그 클리어됨')
}

function startStateMonitor(): void {
  stateMachine.subscribe(() => {
    if (panelVisible) updateStateDisplay()
  })
}

function updateStateDisplay(): void {
  const display = document.getElementById('state-display')
  if (!display) return

  const ctx = stateMachine.getState()

  display.innerHTML = `
    <div class="state-item">
      <label>현재 상태</label>
      <span class="state-value state-${ctx.state.toLowerCase()}">${ctx.state}</span>
    </div>
    <div class="state-item">
      <label>디바이스 타입</label>
      <span class="state-value">${ctx.deviceType ?? '미연결'}</span>
    </div>
    <div class="state-item">
      <label>ESP32 IP</label>
      <span class="state-value">${ctx.esp32Ip ?? '-'}</span>
    </div>
    <div class="state-item">
      <label>마지막 바코드</label>
      <span class="state-value mono">${ctx.barcode ?? '-'}</span>
    </div>
    <div class="state-item">
      <label>에러 메시지</label>
      <span class="state-value error">${ctx.errorMessage ?? '-'}</span>
    </div>
    <div class="state-item">
      <label>ESP32 연결</label>
      <span class="state-value">${esp32.isConnected() ? '✅ 연결됨' : '❌ 미연결'}</span>
    </div>
    <div class="state-item">
      <label>USB 연결</label>
      <span class="state-value">${usbRelay.isConnected() ? '✅ 연결됨' : '❌ 미연결'}</span>
    </div>
  `
}

async function testEsp32Health(): Promise<void> {
  const input = document.getElementById('test-esp32-ip') as HTMLInputElement
  const ip = input?.value.trim() || esp32.getIp()

  if (!ip) {
    logger.warn('ESP32', 'IP 주소를 입력해주세요')
    return
  }

  logger.info('ESP32', `Health 체크 시작: ${ip}`)
  esp32.setIp(ip)

  const connected = await esp32.checkConnection()
  if (connected) {
    logger.success('ESP32', `연결 성공: ${ip}`)
  } else {
    logger.error('ESP32', `연결 실패: ${ip}`)
  }
  updateStateDisplay()
}

async function testEsp32Trigger(): Promise<void> {
  if (!esp32.isConnected()) {
    logger.warn('ESP32', 'ESP32가 연결되어 있지 않음')
    return
  }

  logger.info('ESP32', '트리거 요청 전송...')
  const result = await esp32.trigger()

  if (result.status === 'ok') {
    logger.success('ESP32', `트리거 성공 (${result.duration}ms)`)
  } else {
    logger.error('ESP32', `트리거 실패: ${result.message}`)
  }
}

async function testUsbConnect(): Promise<void> {
  if (!usbRelay.isSupported()) {
    logger.error('USB', 'WebUSB 미지원 브라우저')
    return
  }

  logger.info('USB', 'USB 릴레이 연결 시도...')
  const connected = await usbRelay.connect()

  if (connected) {
    logger.success('USB', 'USB 릴레이 연결 성공')
  } else {
    logger.error('USB', 'USB 릴레이 연결 실패')
  }
  updateStateDisplay()
}

async function testUsbTrigger(): Promise<void> {
  if (!usbRelay.isConnected()) {
    logger.warn('USB', 'USB 릴레이가 연결되어 있지 않음')
    return
  }

  logger.info('USB', '트리거 요청 전송...')
  const success = await usbRelay.trigger(250)

  if (success) {
    logger.success('USB', '트리거 성공')
  } else {
    logger.error('USB', '트리거 실패')
  }
}

function resetState(): void {
  logger.info('STATE', '상태 리셋')
  stateMachine.reset()
  updateStateDisplay()
}

async function testFullFlow(): Promise<void> {
  logger.info('TEST', '전체 플로우 테스트 시작')

  logger.info('TEST', '1. SCAN_SUCCESS 상태로 전환')
  stateMachine.setScanSuccess('TEST-BARCODE-12345')

  await delay(1000)

  logger.info('TEST', '2. DISPENSING 상태로 전환')
  stateMachine.setDispensing()

  await delay(1500)

  logger.info('TEST', '3. COMPLETE 상태로 전환')
  stateMachine.setComplete()

  await delay(2000)

  logger.info('TEST', '4. SCAN_READY로 리셋')
  stateMachine.reset()

  logger.success('TEST', '전체 플로우 테스트 완료')
}

async function getCameraInfo(): Promise<void> {
  logger.info('CAMERA', '카메라 정보 조회 중...')

  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cameras = devices.filter(d => d.kind === 'videoinput')

    logger.info('CAMERA', `발견된 카메라: ${cameras.length}개`)
    cameras.forEach((cam, i) => {
      logger.debug('CAMERA', `카메라 ${i + 1}: ${cam.label || '이름 없음'}`, {
        deviceId: cam.deviceId.slice(0, 20) + '...',
        groupId: cam.groupId.slice(0, 20) + '...'
      })
    })
  } catch (err) {
    logger.error('CAMERA', `카메라 정보 조회 실패: ${err}`)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function toggleKioskMode(): void {
  kioskMode.toggle()
  const btn = document.getElementById('action-kiosk-toggle')
  if (btn) {
    btn.textContent = kioskMode.isEnabled() ? '키오스크 모드 OFF' : '키오스크 모드 ON'
  }
  togglePanel()
}
