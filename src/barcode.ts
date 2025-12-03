import { logger } from './logger'

type BarcodeCallback = (code: string) => void

export class BarcodeScanner {
  private video: HTMLVideoElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private stream: MediaStream | null = null
  private scanning: boolean = false
  private animationId: number | null = null
  private onDetect: BarcodeCallback | null = null
  private lastDetectedCode: string = ''
  private lastDetectedTime: number = 0
  private barcodeDetector: BarcodeDetector | null = null
  private frameCount: number = 0
  private lastFpsTime: number = 0

  async init(videoElement: HTMLVideoElement): Promise<boolean> {
    this.video = videoElement

    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })

    logger.info('CAMERA', '카메라 초기화 시작')

    if ('BarcodeDetector' in window) {
      try {
        const formats = await BarcodeDetector.getSupportedFormats()
        logger.debug('CAMERA', '지원 바코드 포맷', formats)

        this.barcodeDetector = new BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39']
        })
        logger.success('CAMERA', 'BarcodeDetector 초기화 완료')
      } catch (err) {
        logger.warn('CAMERA', 'BarcodeDetector 초기화 실패', err)
      }
    } else {
      logger.warn('CAMERA', 'BarcodeDetector API 미지원')
    }

    try {
      logger.info('CAMERA', '카메라 권한 요청 중...')

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })

      const videoTrack = this.stream.getVideoTracks()[0]
      const settings = videoTrack.getSettings()

      logger.success('CAMERA', '카메라 연결됨', {
        label: videoTrack.label,
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        facingMode: settings.facingMode
      })

      this.video.srcObject = this.stream
      await this.video.play()

      this.canvas.width = this.video.videoWidth || 640
      this.canvas.height = this.video.videoHeight || 480

      logger.info('CAMERA', `캔버스 크기: ${this.canvas.width}x${this.canvas.height}`)

      return true
    } catch (err) {
      logger.error('CAMERA', '카메라 초기화 실패', err)
      return false
    }
  }

  start(callback: BarcodeCallback): void {
    this.onDetect = callback
    this.scanning = true
    this.frameCount = 0
    this.lastFpsTime = Date.now()
    logger.info('SCANNER', '바코드 스캔 시작')
    this.scanLoop()
  }

  stop(): void {
    this.scanning = false
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    logger.info('SCANNER', '바코드 스캔 중지')
  }

  destroy(): void {
    this.stop()
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
      logger.info('CAMERA', '카메라 스트림 해제')
    }
    if (this.video) {
      this.video.srcObject = null
    }
  }

  private scanLoop(): void {
    if (!this.scanning) return

    this.frameCount++
    const now = Date.now()
    if (now - this.lastFpsTime >= 5000) {
      const fps = (this.frameCount / 5).toFixed(1)
      logger.debug('SCANNER', `스캔 FPS: ${fps}`)
      this.frameCount = 0
      this.lastFpsTime = now
    }

    this.detectBarcode()
    this.animationId = requestAnimationFrame(() => this.scanLoop())
  }

  private async detectBarcode(): Promise<void> {
    if (!this.video || !this.ctx || !this.canvas) return

    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height)

    if (this.barcodeDetector) {
      try {
        const barcodes = await this.barcodeDetector.detect(this.canvas)
        if (barcodes.length > 0) {
          this.handleDetection(barcodes[0].rawValue)
        }
      } catch {
        // 스캔 루프에서는 에러 무시 (성능)
      }
    }
  }

  private handleDetection(code: string): void {
    const now = Date.now()

    if (code === this.lastDetectedCode && now - this.lastDetectedTime < 3000) {
      return
    }

    this.lastDetectedCode = code
    this.lastDetectedTime = now

    logger.success('SCANNER', `바코드 인식: ${code}`)

    if (this.onDetect) {
      this.onDetect(code)
    }
  }
}

declare global {
  interface Window {
    BarcodeDetector: typeof BarcodeDetector
  }

  class BarcodeDetector {
    constructor(options?: { formats: string[] })
    detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]>
    static getSupportedFormats(): Promise<string[]>
  }
}

export const scanner = new BarcodeScanner()
