import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { io } from 'socket.io-client'
import CanvasBoard from '../components/CanvasBoard'

const SOCKET_URL = 'http://localhost:4000'

function createUserId() {
  return `user_${Math.random().toString(36).substring(2, 10)}`
}

function RoomPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [socket, setSocket] = useState(null)
  const [userId] = useState(() => {
    const key = `userId_${roomId}`
    const existing = window.localStorage.getItem(key)
    if (existing) return existing
    const id = createUserId()
    window.localStorage.setItem(key, id)
    return id
  })

  const shareUrl = useMemo(() => window.location.href, [])

  useEffect(() => {
    const s = io(SOCKET_URL)
    setSocket(s)

    s.on('connect', () => {
      s.emit('join-room', { roomId, userId })
    })

    return () => {
      s.disconnect()
    }
  }, [roomId, userId])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      if (!shareDialogOpen) {
        setShareDialogOpen(true)
      }
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: '#f1f3f6',
        position: 'relative',
      }}
    >
      {/* Floating header actions (Home + Share) */}
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          zIndex: 10,
        }}
      >
        <Button
          variant="outlined"
          size="small"
          onClick={() => navigate('/')}
          sx={{ textTransform: 'none' }}
        >
          Home
        </Button>
        <Tooltip title={copied ? 'Copied!' : 'Copy link'}>
          <Button
            variant="contained"
            size="small"
            color="primary"
            onClick={() => setShareDialogOpen(true)}
            sx={{ textTransform: 'none' }}
          >
            Share
          </Button>
        </Tooltip>
      </Box>

      {/* FULLSCREEN CANVAS AREA */}
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        {socket && (
          <CanvasBoard socket={socket} roomId={roomId} userId={userId} />
        )}
      </Box>

      <Dialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Share room</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Room link"
            fullWidth
            value={shareUrl}
            InputProps={{ readOnly: true }}
          />
          <Box sx={{ mt: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleCopyLink}
              sx={{ textTransform: 'none' }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default RoomPage
