import { logger } from './logger'

const TRIGGER_ENDPOINT = '/trigger'
const HEALTH_ENDPOINT = '/health'
const DEFAULT_TIMEOUT = 5000

interface TriggerResponse {
  status: 'ok' | 'error'
  duration?: number
  message?: string
}

export class ESP32Controller {
  private baseUrl: string = ''
  private connected: boolean = false

  setIp(ip: string): void {
    this.baseUrl = `http://${ip}`
    this.connected = false
    logger.info('ESP32', `IP 설정: ${ip}`)
  }

  getIp(): string {
    return this.baseUrl.replace('http://', '')
  }

  isConnected(): boolean {
    return this.connected
  }

  async checkConnection(): Promise<boolean> {
    if (!this.baseUrl) {
      logger.warn('ESP32', 'IP가 설정되지 않음')
      return false
    }

    logger.info('ESP32', `연결 확인 중: ${this.baseUrl}`)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)

      const startTime = Date.now()
      const response = await fetch(`${this.baseUrl}${HEALTH_ENDPOINT}`, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const latency = Date.now() - startTime

      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        this.connected = true
        logger.success('ESP32', `연결 성공 (${latency}ms)`, data)
        return true
      } else {
        logger.error('ESP32', `연결 실패: HTTP ${response.status}`)
        this.connected = false
        return false
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류'
      logger.error('ESP32', `연결 실패: ${message}`)
      this.connected = false
      return false
    }
  }

  async trigger(): Promise<TriggerResponse> {
    if (!this.baseUrl) {
      logger.error('ESP32', 'IP가 설정되지 않은 상태에서 트리거 시도')
      return { status: 'error', message: 'ESP32 IP가 설정되지 않음' }
    }

    logger.info('ESP32', '트리거 요청 전송...')

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)

      const startTime = Date.now()
      const response = await fetch(`${this.baseUrl}${TRIGGER_ENDPOINT}`, {
        method: 'POST',
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const latency = Date.now() - startTime

      if (!response.ok) {
        logger.error('ESP32', `트리거 실패: HTTP ${response.status}`)
        return { status: 'error', message: `HTTP ${response.status}` }
      }

      const data = await response.json()
      logger.success('ESP32', `트리거 성공 (응답: ${latency}ms, 릴레이: ${data.duration ?? 250}ms)`)
      return { status: 'ok', duration: data.duration ?? 250 }
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류'
      logger.error('ESP32', `트리거 실패: ${message}`)
      return { status: 'error', message }
    }
  }

  async scanNetwork(): Promise<string[]> {
    logger.info('ESP32', '네트워크 스캔 시작...')

    const foundIps: string[] = []
    const baseIp = '192.168.'
    const subnets = ['0', '1', '4']
    const checkPromises: Promise<void>[] = []

    let checked = 0
    const total = subnets.length * 254

    for (const subnet of subnets) {
      for (let i = 1; i <= 254; i++) {
        const ip = `${baseIp}${subnet}.${i}`
        const promise = this.quickCheck(ip).then(found => {
          checked++
          if (checked % 100 === 0) {
            logger.debug('ESP32', `스캔 진행: ${checked}/${total}`)
          }
          if (found) {
            logger.success('ESP32', `발견: ${ip}`)
            foundIps.push(ip)
          }
        })
        checkPromises.push(promise)
      }
    }

    await Promise.allSettled(checkPromises)
    logger.info('ESP32', `스캔 완료: ${foundIps.length}개 발견`)
    return foundIps
  }

  private async quickCheck(ip: string): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1000)

      const response = await fetch(`http://${ip}${HEALTH_ENDPOINT}`, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch {
      return false
    }
  }
}

export const esp32 = new ESP32Controller()
