import { useEffect, useRef, useState } from 'react'
import { Box, IconButton, Slider, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material'
import PanToolIcon from '@mui/icons-material/PanTool'
import BrushIcon from '@mui/icons-material/Brush'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'

const TOOL_PAN = 'pan'
const TOOL_PEN = 'pen'
const TOOL_RECT = 'rect'
const TOOL_ELLIPSE = 'ellipse'
const TOOL_LINE = 'line'
const TOOL_ARROW = 'arrow'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 4

function createElement({ id, type, points, x, y, w, h, color, strokeWidth, createdBy, createdAt }) {
  return { id, type, points, x, y, w, h, color, strokeWidth, createdBy, createdAt }
}

function drawElement(ctx, element) {
  const { type, points, x, y, w, h, color, strokeWidth } = element
  ctx.strokeStyle = color
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'

  if (type === TOOL_PEN) {
    if (!points || points.length < 2) return
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.stroke()
  } else if (type === TOOL_RECT) {
    ctx.strokeRect(x, y, w, h)
  } else if (type === TOOL_ELLIPSE) {
    ctx.beginPath()
    ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (type === TOOL_LINE || type === TOOL_ARROW) {
    const x1 = x
    const y1 = y
    const x2 = x + w
    const y2 = y + h

    // main line
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()

    if (type === TOOL_ARROW) {
      // arrowhead
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const headLen = 12
      const arrowAngle = Math.PI / 7

      const x3 = x2 - headLen * Math.cos(angle - arrowAngle)
      const y3 = y2 - headLen * Math.sin(angle - arrowAngle)
      const x4 = x2 - headLen * Math.cos(angle + arrowAngle)
      const y4 = y2 - headLen * Math.sin(angle + arrowAngle)

      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x3, y3)
      ctx.moveTo(x2, y2)
      ctx.lineTo(x4, y4)
      ctx.stroke()
    }
  }
}

function CanvasBoard({ socket, roomId, userId }) {
  const canvasRef = useRef(null)
  const [elements, setElements] = useState([])
  const [tool, setTool] = useState(TOOL_PEN)
  const [color, setColor] = useState('#222222')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [isPanning, setIsPanning] = useState(false)
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 })
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentElementId, setCurrentElementId] = useState(null)
  const historyRef = useRef({ undoStack: [], redoStack: [] })
  const lastPosRef = useRef({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef(null)
  const [spacePressed, setSpacePressed] = useState(false)

  const getHistoryStorageKey = () => `history_${roomId}_${userId}`

  const persistHistory = () => {
    const key = getHistoryStorageKey()
    const { undoStack, redoStack } = historyRef.current
    try {
      window.localStorage.setItem(key, JSON.stringify({ undoStack, redoStack }))
    } catch (_) {
      // ignore storage errors
    }
  }

  useEffect(() => {
    if (!socket) return

    socket.on('room-init', ({ elements: serverElements }) => {
      setElements(serverElements)

      // Reload stored per-user history and filter to existing elements
      const key = getHistoryStorageKey()
      try {
        const saved = window.localStorage.getItem(key)
        if (saved) {
          const parsed = JSON.parse(saved)
          const byId = new Map(serverElements.map((el) => [el.id, el]))

          const restoreStack = (stack) =>
            Array.isArray(stack)
              ? stack
                  .map((entry) => {
                    const el = byId.get(entry.element.id)
                    if (!el || el.createdBy !== userId) return null
                    return { type: entry.type, element: el }
                  })
                  .filter(Boolean)
              : []

          historyRef.current.undoStack = restoreStack(parsed.undoStack)
          historyRef.current.redoStack = restoreStack(parsed.redoStack)
        } else {
          historyRef.current.undoStack = []
          historyRef.current.redoStack = []
        }
      } catch (_) {
        historyRef.current.undoStack = []
        historyRef.current.redoStack = []
      }
    })

    socket.on('canvas-event', (event) => {
      setElements((prev) => {
        if (event.type === 'add-element') {
          return [...prev, event.payload]
        }
        if (event.type === 'update-element') {
          return prev.map((el) => (el.id === event.payload.id ? { ...el, ...event.payload } : el))
        }
        if (event.type === 'delete-element') {
          return prev.filter((el) => el.id !== event.payload.id)
        }
        return prev
      })
    })

    return () => {
      socket.off('room-init')
      socket.off('canvas-event')
    }
  }, [socket, roomId, userId])

  // Track window size and container size so the canvas always fills the available space
  useEffect(() => {
    const updateSize = () => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      setCanvasSize({ width: rect.width, height: rect.height })
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => {
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  // Track Space key for panning shortcut (Space + drag)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        setSpacePressed(true)
      }
    }

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setSpacePressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)

    // Apply camera transform
    ctx.translate(camera.x, camera.y)
    ctx.scale(camera.zoom, camera.zoom)

    // Light grid to give an infinite canvas feeling
    const gridSize = 50
    const visibleWorldWidth = width / camera.zoom
    const visibleWorldHeight = height / camera.zoom
    const leftWorldX = -camera.x / camera.zoom
    const topWorldY = -camera.y / camera.zoom

    ctx.strokeStyle = 'rgba(0,0,0,0.05)'
    ctx.lineWidth = 1 / camera.zoom

    const startX = Math.floor(leftWorldX / gridSize) * gridSize
    const endX = leftWorldX + visibleWorldWidth + gridSize
    const startY = Math.floor(topWorldY / gridSize) * gridSize
    const endY = topWorldY + visibleWorldHeight + gridSize

    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, topWorldY - gridSize)
      ctx.lineTo(x, topWorldY + visibleWorldHeight + gridSize)
      ctx.stroke()
    }

    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(leftWorldX - gridSize, y)
      ctx.lineTo(leftWorldX + visibleWorldWidth + gridSize, y)
      ctx.stroke()
    }

    // Draw elements on top of the grid
    elements.forEach((el) => {
      drawElement(ctx, el)
    })
  }, [elements, camera])

  const canvasToWorld = (x, y) => {
    return {
      x: (x - camera.x) / camera.zoom,
      y: (y - camera.y) / camera.zoom,
    }
  }

  const handlePointerDown = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Panning when Pan tool is active, or with middle/right button, or Space shortcut
    if (tool === TOOL_PAN || e.button === 1 || e.button === 2 || spacePressed) {
      setIsPanning(true)
      lastPosRef.current = { x: e.clientX, y: e.clientY }
      return
    }

    const world = canvasToWorld(x, y)

    const id = `${userId}_${Date.now()}`
    let newElement
    const createdAt = Date.now()
    if (tool === TOOL_PEN) {
      newElement = createElement({
        id,
        type: TOOL_PEN,
        points: [world],
        color,
        strokeWidth,
        createdBy: userId,
        createdAt,
      })
    } else {
      newElement = createElement({
        id,
        type: tool,
        x: world.x,
        y: world.y,
        w: 0,
        h: 0,
        color,
        strokeWidth,
        createdBy: userId,
        createdAt,
      })
    }

    setElements((prev) => [...prev, newElement])
    setIsDrawing(true)
    setCurrentElementId(id)

    socket.emit('canvas-event', {
      roomId,
      event: { type: 'add-element', payload: newElement },
    })
  }

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isPanning) {
      const dx = e.clientX - lastPosRef.current.x
      const dy = e.clientY - lastPosRef.current.y
      lastPosRef.current = { x: e.clientX, y: e.clientY }
      const smoothing = 0.8
      setCamera((prev) => ({
        ...prev,
        x: prev.x + dx * smoothing,
        y: prev.y + dy * smoothing,
      }))
      return
    }

    if (!isDrawing || !currentElementId) return

    const world = canvasToWorld(x, y)

    setElements((prev) => {
      return prev.map((el) => {
        if (el.id !== currentElementId) return el
        if (el.type === TOOL_PEN) {
          const updated = { ...el, points: [...el.points, world] }
          socket.emit('canvas-event', {
            roomId,
            event: { type: 'update-element', payload: updated },
          })
          return updated
        }

        const updated = {
          ...el,
          w: world.x - el.x,
          h: world.y - el.y,
        }
        socket.emit('canvas-event', {
          roomId,
          event: { type: 'update-element', payload: updated },
        })
        return updated
      })
    })
  }

  const handlePointerUp = () => {
    // FIXED: Save to history when drawing completes (final state)
    if (isDrawing && currentElementId) {
      setElements((prevElements) => {
        const finalElement = prevElements.find(el => el.id === currentElementId)
        
        if (finalElement) {
          // Deep clone the final element
          const elementToSave = {
            ...finalElement,
            points: finalElement.points ? [...finalElement.points] : undefined
          }
          
          // Add to undo stack with complete element
          historyRef.current.undoStack.push({ 
            type: 'add', 
            element: elementToSave 
          })
          
          // Clear redo stack (new action invalidates redo)
          historyRef.current.redoStack = []
          persistHistory()
        }
        
        return prevElements // Don't modify elements array
      })
    }
    
    setIsDrawing(false)
    setIsPanning(false)
    setCurrentElementId(null)
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = -e.deltaY
    const zoomFactor = delta > 0 ? 1.1 : 0.9
    setCamera((prev) => ({
      ...prev,
      zoom: Math.min(Math.max(prev.zoom * zoomFactor, MIN_ZOOM), MAX_ZOOM),
    }))
  }

  const undo = () => {
    const { undoStack, redoStack } = historyRef.current
    const last = undoStack.pop()
    if (!last) return

    if (last.type === 'add') {
      setElements((prev) => prev.filter((el) => el.id !== last.element.id))
      socket.emit('canvas-event', {
        roomId,
        event: { type: 'delete-element', payload: { id: last.element.id } },
      })
      redoStack.push(last)
      persistHistory()
    }
  }

  const redo = () => {
    const { undoStack, redoStack } = historyRef.current
    const last = redoStack.pop()
    if (!last) return

    if (last.type === 'add') {
      setElements((prev) => [...prev, last.element])
      socket.emit('canvas-event', {
        roomId,
        event: { type: 'add-element', payload: last.element },
      })
      undoStack.push(last)
      persistHistory()
    }
  }

  const zoomIn = () => {
    setCamera((prev) => ({
      ...prev,
      zoom: Math.min(prev.zoom * 1.1, MAX_ZOOM),
    }))
  }

  const zoomOut = () => {
    setCamera((prev) => ({
      ...prev,
      zoom: Math.max(prev.zoom / 1.1, MIN_ZOOM),
    }))
  }

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        position: 'relative',
        p: 1,
        boxSizing: 'border-box',
      }}
    >
      {/* Floating top toolbar */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2,
          py: 1,
          bgcolor: '#ffffff',
          borderRadius: 999,
          border: '1px solid rgba(0,0,0,0.08)',
          zIndex: 10,
        }}
      >
        <Tooltip title="Pan (drag canvas)">
          <Box>
            <ToggleButtonGroup
              size="small"
              value={tool}
              exclusive
              onChange={(_e, next) => next && setTool(next)}
            >
              <ToggleButton value={TOOL_PAN} aria-label="Pan">
                <PanToolIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value={TOOL_PEN} aria-label="Pen">
                <BrushIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value={TOOL_RECT} aria-label="Rectangle">
                <CropSquareIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value={TOOL_ELLIPSE} aria-label="Ellipse">
                <RadioButtonUncheckedIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value={TOOL_LINE} aria-label="Line">
                <ShowChartIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value={TOOL_ARROW} aria-label="Arrow">
                <ArrowRightAltIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Tooltip>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ width: 28, height: 28, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
          />
          <Box sx={{ width: 96 }}>
            <Slider
              size="small"
              min={1}
              max={10}
              value={strokeWidth}
              onChange={(_e, val) => setStrokeWidth(val)}
            />
          </Box>
        </Box>

        <Tooltip title="Undo (per user)">
          <span>
            <IconButton 
              size="small" 
              onClick={undo}
              disabled={historyRef.current.undoStack.length === 0}
            >
              <UndoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Redo (per user)">
          <span>
            <IconButton 
              size="small" 
              onClick={redo}
              disabled={historyRef.current.redoStack.length === 0}
            >
              <RedoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Canvas container fills background */}
      <Box
        ref={containerRef}
        sx={{
          height: '100%',
          width: '100%',
          borderRadius: 0,
          border: 'none',
          bgcolor: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: isPanning || tool === TOOL_PAN || spacePressed ? 'grab' : 'crosshair',
          }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
        />
      </Box>

      {/* Zoom controls (bottom-left) */}
      <Box
        sx={{
          position: 'absolute',
          left: 16,
          bottom: 16,
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 1.5,
            py: 0.75,
            bgcolor: '#eef0f6',
            borderRadius: 999,
            fontSize: 13,
          }}
        >
          <button
            type="button"
            onClick={zoomOut}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '2px 6px',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            -
          </button>
          <span>{`${Math.round(camera.zoom * 100)}%`}</span>
          <button
            type="button"
            onClick={zoomIn}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '2px 6px',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            +
          </button>
        </Box>
      </Box>
    </Box>
  )
}

export default CanvasBoard