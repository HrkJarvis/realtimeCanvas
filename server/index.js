const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// In-memory room state
// roomId -> { elements: Map<elementId, element>, users: Map<socketId, userId> }
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      elements: new Map(),
      users: new Map(),
    });
  }
  return rooms.get(roomId);
}

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId, userId }) => {
    socket.join(roomId);
    const room = getOrCreateRoom(roomId);
    room.users.set(socket.id, userId);

    // Send current state to the new user
    const elements = Array.from(room.elements.values());
    socket.emit('room-init', { elements });

    socket.to(roomId).emit('user-joined', { userId });
  });

  socket.on('canvas-event', ({ roomId, event }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Apply event to room state
    switch (event.type) {
      case 'add-element': {
        room.elements.set(event.payload.id, event.payload);
        break;
      }
      case 'update-element': {
        const existing = room.elements.get(event.payload.id);
        if (existing) {
          room.elements.set(event.payload.id, { ...existing, ...event.payload });
        }
        break;
      }
      case 'delete-element': {
        room.elements.delete(event.payload.id);
        break;
      }
      default:
        break;
    }

    // Broadcast to others in the room
    socket.to(roomId).emit('canvas-event', event);
  });

  socket.on('cursor-move', ({ roomId, userId, position }) => {
    socket.to(roomId).emit('cursor-move', { userId, position });
  });

  socket.on('disconnecting', () => {
    const roomsJoined = [...socket.rooms].filter((r) => r !== socket.id);
    roomsJoined.forEach((roomId) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const userId = room.users.get(socket.id);
      room.users.delete(socket.id);

      io.to(roomId).emit('user-left', { userId });
    });
  });
});

app.get('/', (_req, res) => {
  res.send('Realtime Canvas Server running');
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
