import { logger } from './logger'

const UNLOCK_TAP_COUNT = 5
const UNLOCK_TAP_TIMEOUT = 3000

class KioskMode {
  private enabled: boolean = false
  private overlay: HTMLDivElement | null = null
  private unlockBtn: HTMLButtonElement | null = null
  private tapCount: number = 0
  private tapTimer: number | null = null

  init(): void {
    this.createOverlay()
    this.createUnlockButton()
    this.setupKeyboardShortcut()
    logger.info('KIOSK', '키오스크 모드 초기화 완료')
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div')
    this.overlay.id = 'kiosk-overlay'
    this.overlay.className = 'kiosk-overlay hidden'

    this.overlay.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })
    this.overlay.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
    this.overlay.addEventListener('click', (e) => e.stopPropagation())
    this.overlay.addEventListener('contextmenu', (e) => e.preventDefault())

    document.body.appendChild(this.overlay)
  }

  private createUnlockButton(): void {
    this.unlockBtn = document.createElement('button')
    this.unlockBtn.id = 'kiosk-unlock-btn'
    this.unlockBtn.className = 'kiosk-unlock-btn hidden'
    this.unlockBtn.setAttribute('aria-label', '키오스크 모드 해제')

    this.unlockBtn.addEventListener('click', () => this.handleUnlockTap())
    this.unlockBtn.addEventListener('touchend', (e) => {
      e.preventDefault()
      this.handleUnlockTap()
    })

    document.body.appendChild(this.unlockBtn)
  }

  private handleUnlockTap(): void {
    this.tapCount++
    logger.debug('KIOSK', `해제 탭: ${this.tapCount}/${UNLOCK_TAP_COUNT}`)

    if (this.tapTimer !== null) {
      clearTimeout(this.tapTimer)
    }

    if (this.tapCount >= UNLOCK_TAP_COUNT) {
      this.disable()
      this.tapCount = 0
      return
    }

    this.tapTimer = window.setTimeout(() => {
      this.tapCount = 0
      logger.debug('KIOSK', '탭 카운트 리셋')
    }, UNLOCK_TAP_TIMEOUT)
  }

  private setupKeyboardShortcut(): void {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        this.toggle()
      }
    })
  }

  enable(): void {
    if (this.enabled) return

    this.enabled = true
    this.overlay?.classList.remove('hidden')
    this.unlockBtn?.classList.remove('hidden')

    document.body.classList.add('kiosk-active')

    logger.success('KIOSK', '키오스크 모드 활성화')
  }

  disable(): void {
    if (!this.enabled) return

    this.enabled = false
    this.overlay?.classList.add('hidden')
    this.unlockBtn?.classList.add('hidden')

    document.body.classList.remove('kiosk-active')

    logger.info('KIOSK', '키오스크 모드 비활성화')
  }

  toggle(): void {
    if (this.enabled) {
      this.disable()
    } else {
      this.enable()
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }
}

export const kioskMode = new KioskMode()
