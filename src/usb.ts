import { logger } from './logger'

const JK_USR1_VENDOR_ID = 0x16c0
const JK_USR1_PRODUCT_ID = 0x05df

const RELAY_ON_CMD = new Uint8Array([0xFF, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
const RELAY_OFF_CMD = new Uint8Array([0xFC, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

export class USBRelayController {
  private device: USBDevice | null = null
  private connected: boolean = false

  isSupported(): boolean {
    return 'usb' in navigator
  }

  isConnected(): boolean {
    return this.connected && this.device !== null
  }

  async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      logger.warn('USB', 'WebUSB 미지원 브라우저')
      return false
    }

    logger.info('USB', '디바이스 연결 시도...')

    try {
      this.device = await navigator.usb.requestDevice({
        filters: [{ vendorId: JK_USR1_VENDOR_ID, productId: JK_USR1_PRODUCT_ID }]
      })

      logger.debug('USB', '디바이스 선택됨', {
        vendorId: this.device.vendorId.toString(16),
        productId: this.device.productId.toString(16),
        productName: this.device.productName
      })

      await this.device.open()
      logger.debug('USB', '디바이스 열림')

      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1)
        logger.debug('USB', 'Configuration 선택됨')
      }

      await this.device.claimInterface(0)
      logger.debug('USB', 'Interface claimed')

      this.connected = true
      this.setupDisconnectHandler()

      logger.success('USB', '릴레이 연결 완료')
      return true
    } catch (err) {
      logger.error('USB', '연결 실패', err)
      this.connected = false
      return false
    }
  }

  private setupDisconnectHandler(): void {
    navigator.usb.addEventListener('disconnect', (event) => {
      if (event.device === this.device) {
        this.connected = false
        this.device = null
        logger.warn('USB', '릴레이 분리됨')
      }
    })
  }

  async trigger(durationMs: number = 250): Promise<boolean> {
    if (!this.device || !this.connected) {
      logger.error('USB', '릴레이 미연결 상태에서 트리거 시도')
      return false
    }

    logger.info('USB', `트리거 시작 (${durationMs}ms)`)

    try {
      await this.sendCommand(RELAY_ON_CMD)
      logger.debug('USB', 'RELAY ON 명령 전송')

      await this.delay(durationMs)

      await this.sendCommand(RELAY_OFF_CMD)
      logger.debug('USB', 'RELAY OFF 명령 전송')

      logger.success('USB', '트리거 완료')
      return true
    } catch (err) {
      logger.error('USB', '트리거 실패', err)
      return false
    }
  }

  private async sendCommand(cmd: Uint8Array): Promise<void> {
    if (!this.device) throw new Error('디바이스 없음')

    await this.device.controlTransferOut({
      requestType: 'class',
      recipient: 'interface',
      request: 0x09,
      value: 0x0300,
      index: 0x00
    }, cmd.buffer as ArrayBuffer)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.releaseInterface(0)
        await this.device.close()
      } catch {
        // 무시
      }
      this.device = null
      this.connected = false
    }
  }
}

export const usbRelay = new USBRelayController()
