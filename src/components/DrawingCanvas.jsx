import { useRef, useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'

export default function DrawingCanvas({
  label = 'Plan de dessin',
  allowDraw = false,
  className = '',
  machinePosition = { x: 0, y: 0 },
  onPathChange,
  clearTrigger = 0,
}) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState([])

  useEffect(() => {
    setPoints([])
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [clearTrigger])

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const x = (clientX - rect.left) * (canvas.width / rect.width)
    const y = (clientY - rect.top) * (canvas.height / rect.height)
    return { x: Math.max(0, Math.min(canvas.width, x)), y: Math.max(0, Math.min(canvas.height, y)) }
  }

  const machinePreview = useMemo(() => ({
    x: Math.max(0, Math.min(700, machinePosition.x * 3.5)),
    y: Math.max(0, Math.min(380, 380 - machinePosition.y * 1.9)),
  }), [machinePosition.x, machinePosition.y])

  function drawLine(ctx, pts) {
    if (pts.length < 2) return
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()
  }

  useEffect(() => {
    if (!allowDraw) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawLine(ctx, points)
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(machinePreview.x, machinePreview.y, 5, 0, Math.PI * 2)
    ctx.fill()
  }, [points, allowDraw, machinePreview])

  useEffect(() => {
    onPathChange?.(points)
  }, [onPathChange, points])

  function onStart(e) {
    if (!allowDraw) return
    const pos = getPos(e, canvasRef.current)
    setDrawing(true)
    setPoints([pos])
  }

  function onMove(e) {
    if (!drawing || !allowDraw) return
    e.preventDefault()
    const pos = getPos(e, canvasRef.current)
    setPoints((p) => [...p, pos])
  }

  function onEnd() {
    setDrawing(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={`relative bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden ${className}`}
      style={{ minHeight: '320px' }}
    >
      {allowDraw ? (
        <canvas
          ref={canvasRef}
          width={700}
          height={380}
          className="w-full h-full touch-none cursor-crosshair"
          style={{ display: 'block' }}
          onMouseDown={onStart}
          onMouseMove={onMove}
          onMouseUp={onEnd}
          onMouseLeave={onEnd}
          onTouchStart={onStart}
          onTouchMove={onMove}
          onTouchEnd={onEnd}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-gray-400 text-sm font-medium">{label}</span>
        </div>
      )}
    </motion.div>
  )
}
