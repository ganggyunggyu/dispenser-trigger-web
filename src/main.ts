import { initUI } from './ui'
import { stateMachine } from './state'
import { esp32 } from './esp32'
import { usbRelay } from './usb'
import { scanner } from './barcode'
import { logger } from './logger'
import { initDebugPanel } from './debug-panel'
import { initNumpadTrigger } from './numpad'
import { kioskMode } from './kiosk'
import '../styles/ui.css'

const DISPENSE_DURATION = 250
const COMPLETE_DISPLAY_TIME = 2000

async function init(): Promise<void> {
  logger.info('APP', '앱 초기화 시작')

  initUI()
  initDebugPanel()
  setupEventListeners()
  initNumpadTrigger()
  kioskMode.init()

  logger.info('APP', 'UI 초기화 완료')
  stateMachine.setConnecting()
}

function setupEventListeners(): void {
  document.getElementById('btn-connect-esp32')?.addEventListener('click', handleEsp32Connect)
  document.getElementById('btn-scan-network')?.addEventListener('click', handleNetworkScan)
  document.getElementById('btn-connect-usb')?.addEventListener('click', handleUsbConnect)
  document.getElementById('btn-retry')?.addEventListener('click', handleRetry)

  document.getElementById('esp32-ip')?.addEventListener('keypress', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      handleEsp32Connect()
    }
  })

  logger.debug('APP', '이벤트 리스너 등록 완료')
}

async function handleEsp32Connect(): Promise<void> {
  const input = document.getElementById('esp32-ip') as HTMLInputElement
  const ip = input?.value.trim()

  if (!ip) {
    logger.warn('APP', 'IP 주소 미입력')
    alert('IP 주소를 입력하세요')
    return
  }

  logger.info('APP', `ESP32 연결 시도: ${ip}`)
  esp32.setIp(ip)
  const connected = await esp32.checkConnection()

  if (connected) {
    localStorage.setItem('esp32_ip', ip)
    logger.success('APP', 'ESP32 연결 성공, 스캐너 시작')
    stateMachine.setDeviceConnected('esp32', ip)
    startScanner()
  } else {
    logger.error('APP', 'ESP32 연결 실패')
    alert('ESP32에 연결할 수 없습니다')
  }
}

async function handleNetworkScan(): Promise<void> {
  const btn = document.getElementById('btn-scan-network') as HTMLButtonElement
  btn.textContent = '스캔 중...'
  btn.disabled = true

  logger.info('APP', '네트워크 스캔 시작')

  try {
    const foundIps = await esp32.scanNetwork()

    if (foundIps.length > 0) {
      const ip = foundIps[0]
      const input = document.getElementById('esp32-ip') as HTMLInputElement
      if (input) input.value = ip
      logger.success('APP', `ESP32 발견: ${ip}`)
      alert(`ESP32 발견: ${ip}`)
    } else {
      logger.warn('APP', 'ESP32를 찾을 수 없음')
      alert('ESP32를 찾을 수 없습니다')
    }
  } finally {
    btn.textContent = '네트워크 스캔'
    btn.disabled = false
  }
}

async function handleUsbConnect(): Promise<void> {
  if (!usbRelay.isSupported()) {
    logger.error('APP', 'WebUSB 미지원')
    alert('이 브라우저는 WebUSB를 지원하지 않습니다')
    return
  }

  logger.info('APP', 'USB 릴레이 연결 시도')
  const connected = await usbRelay.connect()

  if (connected) {
    logger.success('APP', 'USB 릴레이 연결 성공, 스캐너 시작')
    stateMachine.setDeviceConnected('usb')
    startScanner()
  } else {
    logger.error('APP', 'USB 릴레이 연결 실패')
    alert('USB 릴레이 연결 실패')
  }
}

async function startScanner(): Promise<void> {
  const video = document.getElementById('camera') as HTMLVideoElement

  logger.info('APP', '카메라 스캐너 초기화')
  const initialized = await scanner.init(video)

  if (!initialized) {
    logger.error('APP', '카메라 초기화 실패')
    stateMachine.setError('카메라를 사용할 수 없습니다')
    return
  }

  logger.success('APP', '스캐너 시작')
  scanner.start(handleBarcodeDetected)
}

async function handleBarcodeDetected(code: string): Promise<void> {
  logger.info('APP', `바코드 감지됨: ${code}`)

  scanner.stop()
  stateMachine.setScanSuccess(code)

  await delay(500)

  stateMachine.setDispensing()
  logger.info('APP', '배출 프로세스 시작')

  const { deviceType } = stateMachine.getState()
  let success = false

  if (deviceType === 'esp32') {
    logger.info('APP', 'ESP32로 트리거 전송')
    const result = await esp32.trigger()
    success = result.status === 'ok'
  } else if (deviceType === 'usb') {
    logger.info('APP', 'USB 릴레이로 트리거 전송')
    success = await usbRelay.trigger(DISPENSE_DURATION)
  }

  if (success) {
    logger.success('APP', '배출 성공')
    stateMachine.setComplete()
    await delay(COMPLETE_DISPLAY_TIME)
    stateMachine.reset()
    logger.info('APP', '스캐너 재시작')
    scanner.start(handleBarcodeDetected)
  } else {
    logger.error('APP', '배출 실패')
    stateMachine.setError('배출 실패. 다시 시도해주세요.')
  }
}

function handleRetry(): void {
  logger.info('APP', '재시도 버튼 클릭')
  stateMachine.reset()
  scanner.start(handleBarcodeDetected)
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function loadSavedIp(): void {
  const savedIp = localStorage.getItem('esp32_ip')
  if (savedIp) {
    const input = document.getElementById('esp32-ip') as HTMLInputElement
    if (input) {
      input.value = savedIp
      logger.info('APP', `저장된 IP 로드: ${savedIp}`)
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init()
  setTimeout(loadSavedIp, 100)
})
