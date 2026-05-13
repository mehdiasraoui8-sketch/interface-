/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_BAUD_RATES,
  GRBL_PARAMETERS,
  parseFirmwareParameter,
  parseStatusReport,
  sanitizeGcodeLine,
  toHBotBelts,
} from '../lib/grbl'

const GrblContext = createContext(null)

export function GrblProvider({ children }) {
  const [serialSupported] = useState(() => typeof navigator !== 'undefined' && 'serial' in navigator)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [baudRate, setBaudRate] = useState(115200)
  const [machineState, setMachineState] = useState('Disconnected')
  const [coords, setCoords] = useState({ x: 0, y: 0, z: 0 })
  const [hbot, setHbot] = useState({ a: 0, b: 0 })
  const [alarm, setAlarm] = useState('')
  const [lastError, setLastError] = useState('')
  const homingStateRef = useRef('idle')
  const [homingState, setHomingState] = useState('idle')
  const setHomingStateSynced = (val) => {
    homingStateRef.current = val
    setHomingState(val)
  }
  const [limitsState, setLimitsState] = useState('')
  const [senderState, setSenderState] = useState({
    running: false,
    paused: false,
    source: '',
    total: 0,
    sent: 0,
    acked: 0,
    currentLine: '',
  })
  const [parameters, setParameters] = useState(() =>
    Object.fromEntries(GRBL_PARAMETERS.map((p) => [p.id, p.defaultValue])),
  )
  const [workspace, setWorkspace] = useState({ width: 200, height: 200, referenceFrame: 'bottom-left' })

  const portRef = useRef(null)
  const readerRef = useRef(null)
  const writerRef = useRef(null)
  const readBufferRef = useRef('')
  const txQueueRef = useRef([])
  const awaitingAckRef = useRef(false)
  const streamRef = useRef({ lines: [], pointer: 0, source: '', running: false, paused: false })

  const sendRealtime = useCallback(async (text) => {
    if (!writerRef.current || !connected) return false
    try {
      await writerRef.current.write(new TextEncoder().encode(text))
      return true
    } catch (error) {
      setLastError(error.message || 'Realtime send failed')
      return false
    }
  }, [connected])

  const parseLine = useCallback((line) => {
    if (!line) return

    const status = parseStatusReport(line)
    if (status) {
      setMachineState(status.machineState)
      const machineCoords = status.wpos || status.mpos || coords
      setCoords(machineCoords)
      setHbot(toHBotBelts(machineCoords.x, machineCoords.y))
      setLimitsState(status.limits || '')
      if (status.machineState.startsWith('Alarm')) setAlarm(status.machineState)
      if (status.machineState === 'Home' || status.machineState === 'Homing') setHomingStateSynced('running')
      if (status.machineState === 'Idle' && homingStateRef.current === 'running') setHomingStateSynced('done')
      return
    }

    if (line.toLowerCase() === 'ok') {
      awaitingAckRef.current = false
      setSenderState((prev) => ({ ...prev, acked: Math.min(prev.total, prev.acked + 1) }))
      return
    }

    if (line.toLowerCase().startsWith('error')) {
      awaitingAckRef.current = false
      setLastError(line)
      setSenderState((prev) => ({ ...prev, running: false, paused: false }))
      streamRef.current.running = false
      return
    }

    if (line.toLowerCase().startsWith('alarm')) {
      awaitingAckRef.current = false
      setAlarm(line)
      setMachineState('Alarm')
      setSenderState((prev) => ({ ...prev, running: false, paused: false }))
      streamRef.current.running = false
      return
    }

    const parsedParameter = parseFirmwareParameter(line)
    if (parsedParameter) {
      setParameters((prev) => ({ ...prev, [parsedParameter.id]: parsedParameter.value }))
    }
  }, [coords])

  const processQueue = useCallback(async () => {
    if (!connected || awaitingAckRef.current || !writerRef.current) return

    const queueItem = txQueueRef.current.shift()
    if (!queueItem) {
      if (streamRef.current.running && !streamRef.current.paused && streamRef.current.pointer >= streamRef.current.lines.length) {
        streamRef.current.running = false
        setSenderState((prev) => ({ ...prev, running: false, paused: false, currentLine: '' }))
      }
      return
    }

    try {
      await writerRef.current.write(new TextEncoder().encode(`${queueItem}\n`))
      awaitingAckRef.current = true
      setSenderState((prev) => ({
        ...prev,
        sent: Math.min(prev.total, prev.sent + 1),
        currentLine: queueItem,
      }))
    } catch (error) {
      setLastError(error.message || 'Send command failed')
      awaitingAckRef.current = false
    }
  }, [connected])

  useEffect(() => {
    if (!connected) return undefined
    const interval = setInterval(() => {
      if (!awaitingAckRef.current) processQueue()
    }, 30)
    return () => clearInterval(interval)
  }, [connected, processQueue])

  const readLoop = useCallback(async () => {
    while (readerRef.current && connected) {
      try {
        const { value, done } = await readerRef.current.read()
        if (done) break
        if (!value) continue

        const text = new TextDecoder().decode(value)
        readBufferRef.current += text
        const parts = readBufferRef.current.split(/\r?\n/)
        readBufferRef.current = parts.pop() || ''

        parts.forEach(parseLine)
      } catch (error) {
        setLastError(error.message || 'Serial read failed')
        break
      }
    }
  }, [connected, parseLine])

  const disconnect = useCallback(async () => {
    streamRef.current = { lines: [], pointer: 0, source: '', running: false, paused: false }
    txQueueRef.current = []
    awaitingAckRef.current = false

    try { await readerRef.current?.cancel() } catch (error) { void error }
    try { readerRef.current?.releaseLock() } catch (error) { void error }
    try { writerRef.current?.releaseLock() } catch (error) { void error }
    try { await portRef.current?.close() } catch (error) { void error }

    readerRef.current = null
    writerRef.current = null
    portRef.current = null

    setConnected(false)
    setMachineState('Disconnected')
    setHomingStateSynced('idle')
    setSenderState((prev) => ({ ...prev, running: false, paused: false }))
  }, [])

  const connect = useCallback(async (targetBaud = baudRate) => {
    if (!serialSupported || connecting || connected) return
    setConnecting(true)
    setLastError('')

    try {
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: Number(targetBaud) || 115200 })
      portRef.current = port
      writerRef.current = port.writable.getWriter()
      readerRef.current = port.readable.getReader()

      setConnected(true)
      setBaudRate(Number(targetBaud) || 115200)
      setMachineState('Connected')
      setAlarm('')
      setHomingStateSynced('idle')
      readLoop()
    } catch (error) {
      setLastError(error.message || 'Connection failed')
      await disconnect()
    } finally {
      setConnecting(false)
    }
  }, [baudRate, connected, connecting, disconnect, readLoop, serialSupported])

  const enqueue = useCallback((line) => {
    const clean = sanitizeGcodeLine(line)
    if (!clean) return
    txQueueRef.current.push(clean)
  }, [])

  const sendCommand = useCallback((line) => {
    enqueue(line)
  }, [enqueue])

  const startStream = useCallback((lines, source = 'stream') => {
    const cleanLines = lines.map(sanitizeGcodeLine).filter(Boolean)
    if (!cleanLines.length) return

    txQueueRef.current = [...txQueueRef.current, ...cleanLines]
    streamRef.current = {
      lines: cleanLines,
      pointer: cleanLines.length,
      source,
      running: true,
      paused: false,
    }
    setSenderState({
      running: true,
      paused: false,
      source,
      total: cleanLines.length,
      sent: 0,
      acked: 0,
      currentLine: '',
    })
    setLastError('')
  }, [])

  const pauseStream = useCallback(async () => {
    streamRef.current.paused = true
    setSenderState((prev) => ({ ...prev, paused: true, running: true }))
    await sendRealtime('!')
  }, [sendRealtime])

  const resumeStream = useCallback(async () => {
    streamRef.current.paused = false
    setSenderState((prev) => ({ ...prev, paused: false, running: true }))
    await sendRealtime('~')
  }, [sendRealtime])

  const stopStream = useCallback(async () => {
    txQueueRef.current = []
    streamRef.current.running = false
    streamRef.current.paused = false
    setSenderState((prev) => ({ ...prev, running: false, paused: false, currentLine: '' }))
    await sendRealtime('!')
  }, [sendRealtime])

  const emergencyStop = useCallback(async () => {
    txQueueRef.current = []
    streamRef.current.running = false
    streamRef.current.paused = false
    awaitingAckRef.current = false
    setSenderState((prev) => ({ ...prev, running: false, paused: false, currentLine: '' }))
    await sendRealtime('\x18')
    setMachineState('Reset')
  }, [sendRealtime])

  const requestStatus = useCallback(async () => {
    await sendRealtime('?')
  }, [sendRealtime])

  const home = useCallback(() => {
    setHomingStateSynced('running')
    sendCommand('$H')
  }, [sendCommand])

  const unlock = useCallback(() => sendCommand('$X'), [sendCommand])

  const refreshParameters = useCallback(() => {
    sendCommand('$$')
  }, [sendCommand])

  const saveParameter = useCallback((id, value) => {
    const textValue = String(value).trim()
    if (!/^[-+]?\d*\.?\d+$/.test(textValue)) {
      setLastError(`Valeur invalide pour $${id}`)
      return false
    }
    sendCommand(`$${id}=${textValue}`)
    setParameters((prev) => ({ ...prev, [id]: textValue }))
    return true
  }, [sendCommand])

  useEffect(() => {
    if (!connected) return undefined
    const poll = setInterval(() => {
      if (!awaitingAckRef.current) sendRealtime('?')
    }, 250)
    return () => clearInterval(poll)
  }, [connected, sendRealtime])

  const value = useMemo(() => ({
    serialSupported,
    connected,
    connecting,
    baudRate,
    setBaudRate,
    baudRates: DEFAULT_BAUD_RATES,
    machineState,
    coords,
    hbot,
    alarm,
    lastError,
    homingState,
    limitsState,
    senderState,
    parameters,
    parameterDefinitions: GRBL_PARAMETERS,
    workspace,
    setWorkspace,
    connect,
    disconnect,
    sendCommand,
    startStream,
    pauseStream,
    resumeStream,
    stopStream,
    emergencyStop,
    requestStatus,
    home,
    unlock,
    refreshParameters,
    saveParameter,
  }), [
    serialSupported,
    connected,
    connecting,
    baudRate,
    machineState,
    coords,
    hbot,
    alarm,
    lastError,
    homingState,
    limitsState,
    senderState,
    parameters,
    workspace,
    connect,
    disconnect,
    sendCommand,
    startStream,
    pauseStream,
    resumeStream,
    stopStream,
    emergencyStop,
    requestStatus,
    home,
    unlock,
    refreshParameters,
    saveParameter,
  ])

  return <GrblContext.Provider value={value}>{children}</GrblContext.Provider>
}

export function useGrbl() {
  const context = useContext(GrblContext)
  if (!context) throw new Error('useGrbl must be used within GrblProvider')
  return context
}
