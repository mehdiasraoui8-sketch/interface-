import { useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageHeader from '../components/PageHeader'
import CoordBar from '../components/CoordBar'
import CalibrationButton from '../components/CalibrationButton'
import { useGrbl } from '../context/GrblContext'
import { sanitizeGcodeLine, svgToGcode } from '../lib/grbl'

export default function ModeImport() {
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewName, setPreviewName] = useState('')
  const [lineCount, setLineCount] = useState(0)
  const inputRef = useRef()

  const {
    workspace,
    senderState,
    lastError,
    startStream,
    pauseStream,
    resumeStream,
    stopStream,
    emergencyStop,
  } = useGrbl()

  async function handleFile(f) {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['gcode', 'svg', 'nc', 'txt', 'jcc'].includes(ext)) {
      alert('G-code/JCC or SVG files only')
      return
    }
    setFile(f)
    setPreviewName(f.name)
    const text = await readText(f)
    if (ext === 'svg') {
      const lines = svgToGcode(text, { workspace, referenceFrame: workspace.referenceFrame, feed: 700 })
      setLineCount(lines.length)
    } else {
      const lines = text.split(/\r?\n/).map(sanitizeGcodeLine).filter(Boolean)
      setLineCount(lines.length)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  async function readText(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Read failed'))
      reader.readAsText(f)
    })
  }

  async function startUpload() {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    const text = await readText(file)
    const lines = ext === 'svg'
      ? svgToGcode(text, { workspace, referenceFrame: workspace.referenceFrame, feed: 700 })
      : text.split(/\r?\n/).map(sanitizeGcodeLine).filter(Boolean)

    startStream(lines, ext === 'svg' ? 'svg-import' : 'gcode-import')
  }

  function cancel() {
    setFile(null)
    setPreviewName('')
    setLineCount(0)
    stopStream()
  }

  const progress = useMemo(() => (senderState.total ? Math.round((senderState.acked / senderState.total) * 100) : 0), [senderState])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PageHeader title="Mode Import :" accentColor="#facc15" />

      <div className="flex-1 flex flex-col md:flex-row gap-6 px-8 md:px-10 py-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full md:w-80 flex flex-col gap-6 md:min-h-[520px]"
        >
          <div>
            <p className="text-sm text-gray-400 mb-4">Importer le fichier G-code:</p>

            <div
              onClick={() => inputRef.current.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl py-10 cursor-pointer transition-all ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5">
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
              </svg>
              <p className="text-sm font-semibold text-gray-700">
                {file ? file.name : 'Sélectionner votre fichier'}
              </p>
               <p className="text-xs text-gray-400 text-center">G-code/JCC ou SVG seuls sont<br />acceptés</p>
               <input ref={inputRef} type="file" accept=".gcode,.jcc,.svg,.nc,.txt" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
              {!file && (
                <button
                  onClick={(e) => { e.stopPropagation(); inputRef.current.click() }}
                  className="mt-1 bg-gray-900 hover:bg-gray-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Sélectionner
                </button>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={cancel}
                className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={startUpload}
                disabled={!file || senderState.running}
                className="flex-1 bg-gray-700 hover:bg-gray-900 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                Téléverser
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
              <button onClick={senderState.paused ? resumeStream : pauseStream} className="border border-gray-200 rounded-lg py-2 hover:bg-gray-50">{senderState.paused ? 'Resume' : 'Pause'}</button>
              <button onClick={stopStream} className="border border-gray-200 rounded-lg py-2 hover:bg-gray-50">Stop</button>
              <button onClick={emergencyStop} className="col-span-2 border border-red-200 text-red-600 rounded-lg py-2 hover:bg-red-50">Arrêt urgence</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center mt-auto pt-4">
            <CalibrationButton />
            <div className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-2 text-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-gray-500">Lignes:</span>
              <span className="font-semibold text-gray-800">{senderState.total || lineCount}</span>
            </div>
          </div>
        </motion.div>

        <div className="flex-1 flex flex-col gap-4 md:min-h-[520px]">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
            style={{ minHeight: '320px' }}
          >
            <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
              {!senderState.running && progress === 0 && (
                <span className="text-gray-400 text-sm font-medium">Progrès en temps réel</span>
              )}
              <AnimatePresence>
                {(senderState.running || progress > 0) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full max-w-xs flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">{previewName || senderState.source}</span>
                      <span className="text-blue-600 font-bold">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <motion.div className="h-full bg-blue-500 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.1 }} />
                    </div>
                    <p className="text-xs text-gray-500">{senderState.acked}/{senderState.total} · {senderState.currentLine || 'attente ack...'}</p>
                    {progress === 100 && <p className="text-green-600 text-sm font-semibold text-center">✓ Fichier envoyé avec succès</p>}
                    {lastError ? <p className="text-red-600 text-xs text-center">{lastError}</p> : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
          <CoordBar returnTo="/" className="mt-auto pt-4" />
        </div>
      </div>
    </div>
  )
}
