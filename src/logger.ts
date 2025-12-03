export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug'

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  category: string
  message: string
  data?: unknown
}

type LogListener = (entry: LogEntry) => void

class Logger {
  private logs: LogEntry[] = []
  private listeners: LogListener[] = []
  private maxLogs = 200

  subscribe(listener: LogListener): () => void {
    this.listeners.push(listener)
    this.logs.forEach(log => listener(log))
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  clear(): void {
    this.logs = []
  }

  private log(level: LogLevel, category: string, message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data
    }

    this.logs.push(entry)

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    this.listeners.forEach(l => l(entry))

    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'
    const prefix = `[${category}]`
    if (data !== undefined) {
      console[consoleMethod](prefix, message, data)
    } else {
      console[consoleMethod](prefix, message)
    }
  }

  info(category: string, message: string, data?: unknown): void {
    this.log('info', category, message, data)
  }

  warn(category: string, message: string, data?: unknown): void {
    this.log('warn', category, message, data)
  }

  error(category: string, message: string, data?: unknown): void {
    this.log('error', category, message, data)
  }

  success(category: string, message: string, data?: unknown): void {
    this.log('success', category, message, data)
  }

  debug(category: string, message: string, data?: unknown): void {
    this.log('debug', category, message, data)
  }
}

export const logger = new Logger()

window.addEventListener('error', (event) => {
  logger.error('GLOBAL', `${event.message}`, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  })
})

window.addEventListener('unhandledrejection', (event) => {
  logger.error('PROMISE', `Unhandled rejection: ${event.reason}`)
})
