import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type NativeKeyboardMonitorEvent =
  | 'function-key-monitor-ready'
  | 'function-key-down'
  | 'function-key-up'
  | 'command-both-down'
  | 'command-both-up'
  | 'accessibility-permission-missing'
  | 'event-tap-create-failed'
  | 'run-loop-source-create-failed'

type NativeKeyboardMonitorEventListener = (event: NativeKeyboardMonitorEvent) => void
type NativeKeyboardMonitorErrorListener = (error: Error) => void

const NATIVE_KEYBOARD_MONITOR_BINARY_NAME = 'FunctionKeyMonitor'
const NATIVE_KEYBOARD_MONITOR_EVENTS = new Set<string>([
  'function-key-monitor-ready',
  'function-key-down',
  'function-key-up',
  'command-both-down',
  'command-both-up',
  'accessibility-permission-missing',
  'event-tap-create-failed',
  'run-loop-source-create-failed'
])

export class NativeKeyboardMonitorService {
  private process: ChildProcessWithoutNullStreams | null = null
  private stdoutBuffer = ''
  private readonly eventListeners = new Set<NativeKeyboardMonitorEventListener>()
  private readonly errorListeners = new Set<NativeKeyboardMonitorErrorListener>()

  start(): void {
    if (this.process) {
      return
    }

    const binaryPath = this.getBinaryPath()

    if (!existsSync(binaryPath)) {
      this.emitError(new Error(`Native keyboard monitor binary was not found at ${binaryPath}.`))
      return
    }

    const monitorProcess = spawn(binaryPath)
    this.process = monitorProcess
    console.log(`[native-keyboard] Started monitor: ${binaryPath}`)

    monitorProcess.stdout.setEncoding('utf8')
    monitorProcess.stdout.on('data', (chunk: string) => {
      this.handleStdout(chunk)
    })

    monitorProcess.stderr.setEncoding('utf8')
    monitorProcess.stderr.on('data', (chunk: string) => {
      const message = chunk.trim()
      if (message) {
        console.warn(`[native-keyboard] stderr: ${message}`)
      }
    })

    monitorProcess.on('error', (error) => {
      if (this.process === monitorProcess) {
        this.process = null
        this.stdoutBuffer = ''
      }

      this.emitError(error)
    })

    monitorProcess.on('exit', (code, signal) => {
      if (this.process === monitorProcess) {
        this.process = null
        this.stdoutBuffer = ''
      }

      console.log(`[native-keyboard] Monitor exited with code ${code ?? 'null'} signal ${signal ?? 'null'}.`)
    })
  }

  stop(): void {
    if (!this.process) {
      return
    }

    this.process.kill()
    this.process = null
    this.stdoutBuffer = ''
  }

  onEvent(listener: NativeKeyboardMonitorEventListener): () => void {
    this.eventListeners.add(listener)

    return () => {
      this.eventListeners.delete(listener)
    }
  }

  onError(listener: NativeKeyboardMonitorErrorListener): () => void {
    this.errorListeners.add(listener)

    return () => {
      this.errorListeners.delete(listener)
    }
  }

  private getBinaryPath(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'native', NATIVE_KEYBOARD_MONITOR_BINARY_NAME)
    }

    return join(app.getAppPath(), 'resources', 'native', NATIVE_KEYBOARD_MONITOR_BINARY_NAME)
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk

    while (this.stdoutBuffer.includes('\n')) {
      const newlineIndex = this.stdoutBuffer.indexOf('\n')
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim()
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1)

      if (line) {
        this.handleOutputLine(line)
      }
    }
  }

  private handleOutputLine(line: string): void {
    console.log(`[native-keyboard] ${line}`)

    if (NATIVE_KEYBOARD_MONITOR_EVENTS.has(line)) {
      this.emitEvent(line as NativeKeyboardMonitorEvent)
    }
  }

  private emitEvent(event: NativeKeyboardMonitorEvent): void {
    for (const listener of this.eventListeners) {
      listener(event)
    }
  }

  private emitError(error: Error): void {
    for (const listener of this.errorListeners) {
      listener(error)
    }
  }
}
