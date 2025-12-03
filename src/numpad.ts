import { logger } from './logger'

type NumpadCallback = (value: string) => void

let currentValue = ''
let onConfirm: NumpadCallback | null = null

export function showNumpad(initialValue: string, callback: NumpadCallback): void {
  currentValue = initialValue
  onConfirm = callback

  createNumpadIfNeeded()
  updateDisplay()

  const overlay = document.getElementById('numpad-overlay')
  overlay?.classList.remove('hidden')

  logger.info('NUMPAD', '키패드 열림')
}

export function hideNumpad(): void {
  const overlay = document.getElementById('numpad-overlay')
  overlay?.classList.add('hidden')
}

function createNumpadIfNeeded(): void {
  if (document.getElementById('numpad-overlay')) return

  const overlay = document.createElement('div')
  overlay.id = 'numpad-overlay'
  overlay.className = 'numpad-overlay hidden'

  overlay.innerHTML = `
    <div class="numpad-container">
      <div class="numpad-header">
        <span class="numpad-title">ESP32 IP 입력</span>
        <button class="numpad-close" id="numpad-close">✕</button>
      </div>

      <div class="numpad-display">
        <input type="text" id="numpad-value" readonly />
      </div>

      <div class="numpad-presets">
        <button class="numpad-preset" data-ip="192.168.0.">192.168.0._</button>
        <button class="numpad-preset" data-ip="192.168.1.">192.168.1._</button>
        <button class="numpad-preset" data-ip="192.168.4.">192.168.4._</button>
      </div>

      <div class="numpad-grid">
        <button class="numpad-key" data-key="1">1</button>
        <button class="numpad-key" data-key="2">2</button>
        <button class="numpad-key" data-key="3">3</button>
        <button class="numpad-key" data-key="4">4</button>
        <button class="numpad-key" data-key="5">5</button>
        <button class="numpad-key" data-key="6">6</button>
        <button class="numpad-key" data-key="7">7</button>
        <button class="numpad-key" data-key="8">8</button>
        <button class="numpad-key" data-key="9">9</button>
        <button class="numpad-key dot" data-key=".">.</button>
        <button class="numpad-key" data-key="0">0</button>
        <button class="numpad-key backspace" data-key="backspace">⌫</button>
      </div>

      <div class="numpad-actions">
        <button class="numpad-cancel" id="numpad-cancel">취소</button>
        <button class="numpad-confirm" id="numpad-confirm">확인</button>
      </div>
    </div>
  `

  document.body.appendChild(overlay)
  setupEventListeners()
}

function setupEventListeners(): void {
  document.getElementById('numpad-close')?.addEventListener('click', hideNumpad)
  document.getElementById('numpad-cancel')?.addEventListener('click', hideNumpad)

  document.getElementById('numpad-confirm')?.addEventListener('click', () => {
    if (onConfirm && currentValue) {
      logger.success('NUMPAD', `IP 확정: ${currentValue}`)
      onConfirm(currentValue)
    }
    hideNumpad()
  })

  document.querySelectorAll('.numpad-key').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = (e.target as HTMLElement).dataset.key
      if (key) handleKeyPress(key)
    })
  })

  document.querySelectorAll('.numpad-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const ip = (e.target as HTMLElement).dataset.ip
      if (ip) {
        currentValue = ip
        updateDisplay()
        logger.debug('NUMPAD', `프리셋 선택: ${ip}`)
      }
    })
  })

  document.getElementById('numpad-overlay')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'numpad-overlay') {
      hideNumpad()
    }
  })
}

function handleKeyPress(key: string): void {
  if (key === 'backspace') {
    currentValue = currentValue.slice(0, -1)
  } else if (key === '.') {
    const parts = currentValue.split('.')
    if (parts.length < 4 && !currentValue.endsWith('.')) {
      currentValue += '.'
    }
  } else {
    if (currentValue.length < 15) {
      currentValue += key
    }
  }

  updateDisplay()
}

function updateDisplay(): void {
  const input = document.getElementById('numpad-value') as HTMLInputElement
  if (input) {
    input.value = currentValue || '_._._._ '
  }
}

export function initNumpadTrigger(): void {
  const ipInput = document.getElementById('esp32-ip')
  if (!ipInput) return

  ipInput.addEventListener('focus', (e) => {
    e.preventDefault()
    ;(e.target as HTMLInputElement).blur()

    const currentIp = (document.getElementById('esp32-ip') as HTMLInputElement)?.value || ''

    showNumpad(currentIp, (newIp) => {
      const input = document.getElementById('esp32-ip') as HTMLInputElement
      if (input) {
        input.value = newIp
        logger.info('NUMPAD', `IP 설정됨: ${newIp}`)
      }
    })
  })

  ipInput.addEventListener('click', (e) => {
    e.preventDefault()
    const currentIp = (document.getElementById('esp32-ip') as HTMLInputElement)?.value || ''

    showNumpad(currentIp, (newIp) => {
      const input = document.getElementById('esp32-ip') as HTMLInputElement
      if (input) {
        input.value = newIp
      }
    })
  })

  logger.debug('NUMPAD', 'IP 입력 필드에 키패드 연결됨')
}
