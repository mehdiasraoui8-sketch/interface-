import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import PageHeader from '../components/PageHeader'
import CoordBar from '../components/CoordBar'
import CalibrationButton from '../components/CalibrationButton'
import { useGrbl } from '../context/GrblContext'
import { shapeToGcode } from '../lib/grbl'

const shapes = [
  {
    id: 'carre', label: 'Carré', icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8">
        <rect x="5" y="5" width="30" height="30" rx="1" />
      </svg>
    ),
  },
  {
    id: 'cercle', label: 'Cercle', icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8">
        <circle cx="20" cy="20" r="15" />
      </svg>
    ),
  },
  {
    id: 'triangle', label: 'Triangle', icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8">
        <polygon points="20,4 36,36 4,36" />
      </svg>
    ),
  },
  {
    id: 'ligne', label: 'Ligne', icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8">
        <line x1="4" y1="36" x2="36" y2="4" />
      </svg>
    ),
  },
  {
    id: 'etoile', label: 'Étoile', icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
        <polygon points="20,3 24,14 36,14 26,21 30,33 20,26 10,33 14,21 4,14 16,14" />
      </svg>
    ),
  },
  {
    id: 'spiral', label: 'Spirale', icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
        <path d="M20 20 Q26 14 32 20 Q38 28 20 34 Q4 38 4 20 Q4 6 20 6 Q34 6 34 20" />
      </svg>
    ),
  },
]

const shapeParams = {
  carre: [
    { key: 'width', label: 'Largeur', min: 20, max: 200, unit: 'mm' },
    { key: 'height', label: 'Hauteur', min: 20, max: 200, unit: 'mm' },
  ],
  cercle: [
    { key: 'radius', label: 'Rayon', min: 10, max: 150, unit: 'mm' },
  ],
  triangle: [
    { key: 'base', label: 'Base', min: 20, max: 200, unit: 'mm' },
    { key: 'height', label: 'Hauteur', min: 20, max: 200, unit: 'mm' },
  ],
  ligne: [
    { key: 'length', label: 'Longueur', min: 20, max: 240, unit: 'mm' },
    { key: 'angle', label: 'Angle', min: 0, max: 180, unit: '°' },
  ],
  etoile: [
    { key: 'points', label: 'Pointes', min: 3, max: 10, unit: '' },
    { key: 'inner', label: 'Rayon interne', min: 10, max: 80, unit: 'mm' },
  ],
  spiral: [
    { key: 'turns', label: 'Tours', min: 1, max: 8, unit: '' },
    { key: 'spacing', label: 'Espacement', min: 5, max: 30, unit: 'mm' },
  ],
}

export default function FormesPredefinies() {
  const [selected, setSelected] = useState(null)
  const [size, setSize] = useState(50)
  const [repeat, setRepeat] = useState(1)
  const [geometry, setGeometry] = useState({
    carre: { width: 80, height: 80 },
    cercle: { radius: 60 },
    triangle: { base: 100, height: 80 },
    ligne: { length: 140, angle: 45 },
    etoile: { points: 5, inner: 30 },
    spiral: { turns: 3, spacing: 12 },
  })

  const { senderState, startStream, pauseStream, resumeStream, stopStream, emergencyStop, workspace } = useGrbl()

  const currentParams = selected ? shapeParams[selected] : []
  const currentGeometry = useMemo(() => (selected ? geometry[selected] : {}), [geometry, selected])

  function updateParam(key, value) {
    if (!selected) return
    setGeometry((prev) => ({
      ...prev,
      [selected]: { ...prev[selected], [key]: value },
    }))
  }

  const gcode = useMemo(() => {
    if (!selected) return []
    return shapeToGcode(selected, currentGeometry, {
      feed: Math.max(300, size * 10),
      repeat,
      center: workspace.referenceFrame === 'center'
        ? { x: 0, y: 0 }
        : { x: workspace.width / 2, y: workspace.height / 2 },
    })
  }, [selected, currentGeometry, size, repeat, workspace])

  const progress = senderState.total ? Math.round((senderState.acked / senderState.total) * 100) : 0

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PageHeader title="Formes prédéfinies:" accentColor="#60a5fa" />

      <div className="flex-1 flex flex-col md:flex-row gap-6 px-8 md:px-10 py-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full md:w-80 flex flex-col gap-6 md:min-h-[520px]"
        >
          <div>
            <p className="text-sm text-gray-400 mb-3">Choisir une forme :</p>
            <div className="grid grid-cols-3 gap-2">
              {shapes.map((s, i) => (
                <motion.button
                  key={s.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelected(s.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    selected === s.id
                      ? 'border-blue-400 bg-blue-50 text-blue-600'
                      : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
                  }`}
                >
                  {s.icon}
                  <span className="text-xs font-medium">{s.label}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              <div>
                <p className="text-sm text-gray-400 mb-2">Taille (mm):</p>
                <div className="flex items-center gap-3">
                  <input type="range" min="10" max="200" value={size} onChange={(e) => setSize(+e.target.value)} className="flex-1" />
                  <span className="text-sm font-semibold text-gray-700 w-12 text-right">{size} mm</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-2">Répétitions:</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setRepeat((r) => Math.max(1, r - 1))} className="w-8 h-8 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-bold">−</button>
                  <span className="text-sm font-semibold w-8 text-center">{repeat}</span>
                  <button onClick={() => setRepeat((r) => Math.min(10, r + 1))} className="w-8 h-8 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-bold">+</button>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-2">Paramètres géométriques :</p>
                <div className="flex flex-col gap-3">
                  {currentParams.map((param) => (
                    <div key={param.key} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{param.label}</span>
                        <span className="font-semibold text-gray-700">
                          {currentGeometry[param.key]}
                          {param.unit ? ` ${param.unit}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={param.min}
                          max={param.max}
                          value={currentGeometry[param.key]}
                          onChange={(e) => updateParam(param.key, Number(e.target.value))}
                          className="flex-1"
                        />
                        <input
                          type="number"
                          min={param.min}
                          max={param.max}
                          value={currentGeometry[param.key]}
                          onChange={(e) => updateParam(param.key, Number(e.target.value))}
                          className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => startStream(gcode, 'predefined-shape')}
                className="flex items-center justify-center gap-2 bg-white/40 border border-white/70 text-gray-800 px-5 py-3 rounded-xl text-sm font-semibold backdrop-blur-md shadow-lg"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
                Commencer
              </motion.button>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={senderState.paused ? resumeStream : pauseStream} className="border border-gray-200 rounded-lg py-2 hover:bg-gray-50">{senderState.paused ? 'Resume' : 'Pause'}</button>
                <button onClick={stopStream} className="border border-gray-200 rounded-lg py-2 hover:bg-gray-50">Stop</button>
                <button onClick={emergencyStop} className="col-span-2 border border-red-200 text-red-600 rounded-lg py-2 hover:bg-red-50">Arrêt urgence</button>
              </div>
              <div className="text-xs text-gray-500">Progression: {senderState.acked}/{senderState.total} ({progress}%)</div>
            </motion.div>
          )}

          <div className="mt-auto pt-4">
            <CalibrationButton />
          </div>
        </motion.div>

        <div className="flex-1 flex flex-col gap-4 md:min-h-[520px]">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
            style={{ minHeight: '320px' }}
          >
            <div className="h-full flex items-center justify-center p-8">
              {selected ? (
                <motion.div key={selected} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
                  <div className="text-gray-700" style={{ width: `${Math.min(size * 1.5, 200)}px`, height: `${Math.min(size * 1.5, 200)}px` }}>
                    {shapes.find((s) => s.id === selected)?.icon}
                  </div>
                  <p className="text-sm text-gray-400">
                    {shapes.find((s) => s.id === selected)?.label} · {size}mm · ×{repeat}
                  </p>
                  <p className="text-xs text-gray-500">G-code généré: {gcode.length} lignes</p>
                </motion.div>
              ) : (
                <span className="text-gray-400 text-sm font-medium">Aperçu de la forme</span>
              )}
            </div>
          </motion.div>
          <CoordBar returnTo="/" className="mt-auto pt-4" />
        </div>
      </div>
    </div>
  )
}
