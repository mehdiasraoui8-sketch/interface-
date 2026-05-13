import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageHeader from '../components/PageHeader'
import CoordBar from '../components/CoordBar'
import CalibrationButton from '../components/CalibrationButton'
import DrawingCanvas from '../components/DrawingCanvas'
import { useGrbl } from '../context/GrblContext'

const MODES = ['Tapage de\ncoordonnées', 'Dessin sur écran']

export default function ModeManuel() {
  const [inputMode, setInputMode] = useState(0)
  const [speed, setSpeed] = useState(30)
  const [coords, setCoords] = useState({ x: '', y: '', z: '' })
  const [sequences, setSequences] = useState([])
  const [drawPoints, setDrawPoints] = useState([])
  const [clearTrigger, setClearTrigger] = useState(0)

  const {
    coords: machineCoords,
    senderState,
    machineState,
    lastError,
    workspace,
    startStream,
    pauseStream,
    resumeStream,
    stopStream,
    emergencyStop,
  } = useGrbl()

  function addSequence() {
    if (coords.x !== '' || coords.y !== '' || coords.z !== '') {
      setSequences((s) => [...s, { ...coords }])
      setCoords({ x: '', y: '', z: '' })
    }
  }

  function clearAll() {
    setSequences([])
    setDrawPoints([])
    setCoords({ x: '', y: '', z: '' })
  }

  const sequenceGcode = useMemo(() => {
    if (!sequences.length) return []
    const feed = Math.max(60, speed * 20)
    return ['G21', 'G90', ...sequences.map((s) => `G1 X${Number(s.x || 0).toFixed(3)} Y${Number(s.y || 0).toFixed(3)} Z${Number(s.z || 0).toFixed(3)} F${feed.toFixed(1)}`)]
  }, [sequences, speed])

  const drawingGcode = useMemo(() => {
    if (!drawPoints.length) return []
    const feed = Math.max(60, speed * 20)
    const toMachine = (p) => {
      const nx = (p.x / 700) * workspace.width
      const ny = (p.y / 380) * workspace.height
      if (workspace.referenceFrame === 'top-left') return { x: nx, y: ny }
      if (workspace.referenceFrame === 'center') return { x: nx - workspace.width / 2, y: workspace.height / 2 - ny }
      return { x: nx, y: workspace.height - ny }
    }
    const first = toMachine(drawPoints[0])
    const lines = ['G21', 'G90', 'G0 Z5', `G0 X${first.x.toFixed(3)} Y${first.y.toFixed(3)}`, `G1 Z0 F${feed.toFixed(1)}`]
    for (let i = 1; i < drawPoints.length; i += 1) {
      const p = toMachine(drawPoints[i])
      lines.push(`G1 X${p.x.toFixed(3)} Y${p.y.toFixed(3)} F${feed.toFixed(1)}`)
    }
    lines.push('G0 Z5')
    return lines
  }, [drawPoints, speed, workspace])

  const progress = senderState.total ? Math.round((senderState.acked / senderState.total) * 100) : 0

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PageHeader title="Mode manuel:" accentColor="#39FF14" />

      <div className="flex-1 flex flex-col md:flex-row gap-6 px-8 md:px-10 py-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full md:w-80 flex flex-col gap-5 md:min-h-[520px]"
        >
          <div className="border-t border-gray-200" />

          <div>
            <p className="text-sm text-gray-400 mb-3 font-medium">Mode de saisie :</p>
            <div className="flex items-stretch gap-1 border-b border-gray-200 pb-1">
              {MODES.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setInputMode(i)}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md leading-tight transition-all whitespace-pre-line text-center ${
                    inputMode === i ? 'bg-gray-100 text-gray-800 font-semibold' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {inputMode === 0 && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-1"
              >
                {['X', 'Y', 'Z'].map((axis) => (
                  <div key={axis} className="flex items-center gap-4 border-b border-gray-100 py-2">
                    <span className="text-sm font-semibold text-gray-700 w-4">{axis}</span>
                    <input
                      type="number"
                      placeholder="Value"
                      value={coords[axis.toLowerCase()]}
                      onChange={(e) => setCoords((c) => ({ ...c, [axis.toLowerCase()]: e.target.value }))}
                      className="flex-1 text-sm text-gray-500 bg-transparent outline-none placeholder-gray-300"
                    />
                  </div>
                ))}
                <button
                  onClick={addSequence}
                  className="flex items-center justify-between mt-2 text-sm text-gray-400 hover:text-gray-700 transition-colors py-1"
                >
                  <span>Ajouter une séquence</span>
                  <span className="text-2xl font-light leading-none">+</span>
                </button>
                {sequences.length > 0 && (
                  <div className="space-y-1 mt-1">
                    {sequences.map((s, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg px-3 py-1.5 text-xs text-gray-500 font-mono">
                        X:{s.x || 0} &nbsp;Y:{s.y || 0} &nbsp;Z:{s.z || 0}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => startStream(sequenceGcode, 'manual-coordinates')}
                  disabled={!sequenceGcode.length}
                  className="mt-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-semibold"
                >
                  Exécuter séquence
                </button>
                {sequences.length > 0 && (
                  <button
                    onClick={() => setSequences([])}
                    className="mt-1 text-xs text-gray-400 hover:text-red-500 transition-colors text-left"
                  >
                    Vider la séquence
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-400 mb-3 font-medium">Vitesse du dessin :</p>
            <div className="flex items-center gap-2">
              <svg width="22" height="22" viewBox="0 0 64 64" className="flex-shrink-0 opacity-50">
                <ellipse cx="32" cy="36" rx="18" ry="12" fill="#9ca3af" />
                <circle cx="32" cy="22" r="8" fill="#9ca3af" />
                <line x1="16" y1="44" x2="10" y2="54" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" />
                <line x1="24" y1="47" x2="20" y2="58" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" />
                <line x1="40" y1="47" x2="44" y2="58" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" />
                <line x1="48" y1="44" x2="54" y2="54" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" />
              </svg>

              <div className="relative flex-1" style={{ height: '22px' }}>
                <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-gray-200 rounded-full" />
                <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 h-1 bg-blue-500 rounded-full" style={{ width: `${speed}%` }} />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={speed}
                  onChange={(e) => setSpeed(+e.target.value)}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  style={{ zIndex: 2 }}
                />
                <div
                  className="absolute inset-y-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-gray-300 rounded-full shadow-md pointer-events-none"
                  style={{ left: `calc(${speed}% - 10px)`, zIndex: 1 }}
                />
              </div>

              <svg width="22" height="22" viewBox="0 0 64 64" className="flex-shrink-0 opacity-50">
                <ellipse cx="32" cy="40" rx="14" ry="10" fill="#9ca3af" />
                <ellipse cx="28" cy="20" rx="5" ry="12" fill="#9ca3af" transform="rotate(-10 28 20)" />
                <ellipse cx="38" cy="18" rx="5" ry="12" fill="#9ca3af" transform="rotate(10 38 18)" />
                <circle cx="32" cy="32" r="8" fill="#9ca3af" />
                <line x1="22" y1="48" x2="18" y2="58" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" />
                <line x1="42" y1="48" x2="46" y2="58" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1.5 px-0.5">
              <span>0 mm/s</span>
              <span>max mm/s</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button onClick={() => (inputMode === 1 ? startStream(drawingGcode, 'manual-drawing') : startStream(sequenceGcode, 'manual-coordinates'))} className="border border-gray-200 rounded-lg py-2 hover:bg-gray-50">Start</button>
            <button onClick={senderState.paused ? resumeStream : pauseStream} className="border border-gray-200 rounded-lg py-2 hover:bg-gray-50">{senderState.paused ? 'Resume' : 'Pause'}</button>
            <button onClick={stopStream} className="border border-gray-200 rounded-lg py-2 hover:bg-gray-50">Stop</button>
            <button onClick={emergencyStop} className="border border-red-200 text-red-600 rounded-lg py-2 hover:bg-red-50">Arrêt urgence</button>
            {inputMode === 1 && (
              <button onClick={() => { setDrawPoints([]); setClearTrigger((n) => n + 1) }} className="col-span-2 border border-gray-200 text-gray-500 rounded-lg py-2 hover:bg-gray-50">
                Effacer le dessin
              </button>
            )}
          </div>

          <div className="text-xs text-gray-500">
            Source: {senderState.source || '—'} · {senderState.acked}/{senderState.total} ({progress}%)
          </div>
          {lastError ? <div className="text-xs text-red-600">{lastError}</div> : null}
          <div className="text-xs text-gray-500">État machine: {machineState}</div>

          <div className="mt-auto pt-4">
            <CalibrationButton />
          </div>
        </motion.div>

        <div className="flex-1 flex flex-col gap-4 md:min-h-[520px]">
          <DrawingCanvas
            label="Plan de dessin"
            allowDraw={inputMode === 1}
            className="flex-1"
            machinePosition={machineCoords}
            onPathChange={setDrawPoints}
            clearTrigger={clearTrigger}
          />
          <CoordBar returnTo="/" className="mt-auto pt-4" />
        </div>
      </div>
    </div>
  )
}
