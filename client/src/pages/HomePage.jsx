import { useEffect, useState } from 'react'
import { Box, Button, Paper, TextField, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

function generateRoomId() {
  return Math.random().toString(36).substring(2, 10)
}

function HomePage() {
  const [roomId, setRoomId] = useState('')
  const [lastRoomId, setLastRoomId] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const stored = window.localStorage.getItem('lastRoomId')
    if (stored) {
      setLastRoomId(stored)
    }
  }, [])

  const handleCreateRoom = () => {
    const id = generateRoomId()
    window.localStorage.setItem('lastRoomId', id)
    navigate(`/room/${id}`)
  }

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      const trimmed = roomId.trim()
      window.localStorage.setItem('lastRoomId', trimmed)
      navigate(`/room/${trimmed}`)
    }
  }

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#f1f3f6',
        px: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          px: 5,
          py: 4,
          maxWidth: 520,
          width: '100%',
          borderRadius: 3,
          bgcolor: '#ffffff',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <Typography variant="h4" sx={{ fontSize: 26, fontWeight: 600 }} gutterBottom>
          Realtime Canvas
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Create a new collaborative whiteboard or join an existing room to draw together.
        </Typography>

        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleCreateRoom}
            sx={{ textTransform: 'none' }}
          >
            Create new room
          </Button>

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <TextField
              label="Enter room ID"
              variant="outlined"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              fullWidth
              size="small"
            />
            <Button
              variant="outlined"
              size="medium"
              onClick={handleJoinRoom}
              sx={{ whiteSpace: 'nowrap', textTransform: 'none' }}
            >
              Join
            </Button>
          </Box>

          {lastRoomId && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Last room:
              </Typography>
              <Button
                size="small"
                variant="text"
                sx={{ textTransform: 'none', ml: 1 }}
                onClick={() => navigate(`/room/${lastRoomId}`)}
              >
                Rejoin {lastRoomId}
              </Button>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  )
}

export default HomePage
