export type AppState =
  | 'INITIALIZING'
  | 'CONNECTING'
  | 'SCAN_READY'
  | 'SCAN_SUCCESS'
  | 'DISPENSING'
  | 'COMPLETE'
  | 'ERROR'

export interface StateContext {
  state: AppState
  barcode: string | null
  errorMessage: string | null
  deviceType: 'esp32' | 'usb' | null
  esp32Ip: string | null
}

type StateListener = (ctx: StateContext) => void

class StateMachine {
  private ctx: StateContext = {
    state: 'INITIALIZING',
    barcode: null,
    errorMessage: null,
    deviceType: null,
    esp32Ip: null
  }

  private listeners: StateListener[] = []

  getState(): StateContext {
    return { ...this.ctx }
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.push(listener)
    listener(this.getState())
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notify(): void {
    const snapshot = this.getState()
    this.listeners.forEach(l => l(snapshot))
  }

  setConnecting(): void {
    this.ctx.state = 'CONNECTING'
    this.ctx.errorMessage = null
    this.notify()
  }

  setDeviceConnected(type: 'esp32' | 'usb', ip?: string): void {
    this.ctx.deviceType = type
    if (type === 'esp32' && ip) {
      this.ctx.esp32Ip = ip
    }
    this.ctx.state = 'SCAN_READY'
    this.ctx.errorMessage = null
    this.notify()
  }

  setScanSuccess(barcode: string): void {
    this.ctx.state = 'SCAN_SUCCESS'
    this.ctx.barcode = barcode
    this.notify()
  }

  setDispensing(): void {
    this.ctx.state = 'DISPENSING'
    this.notify()
  }

  setComplete(): void {
    this.ctx.state = 'COMPLETE'
    this.notify()
  }

  setError(message: string): void {
    this.ctx.state = 'ERROR'
    this.ctx.errorMessage = message
    this.notify()
  }

  reset(): void {
    this.ctx.state = 'SCAN_READY'
    this.ctx.barcode = null
    this.ctx.errorMessage = null
    this.notify()
  }
}

export const stateMachine = new StateMachine()
