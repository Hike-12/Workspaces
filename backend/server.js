const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('./config/db');

const roomRoutes = require('./routes/chatRoomRoutes');
const fileRoutes = require('./routes/fileRoutes');
const messageRoutes = require('./routes/messageRoutes');

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173", 
  "http://localhost:80",
  "http://frontend:80",
  "https://focalpoint-gamma.vercel.app"
];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// REMOVE the manual CORS headers - they're causing conflicts
// Use only the cors middleware
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/messages', messageRoutes);

// Socket.io for real-time features
const activeRooms = new Map();
const userCalls = new Map();
const userSocketMap = new Map(); 

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join room
  socket.on('joinRoom', ({ room_id, user_id, user_name }) => {
    socket.join(room_id);
    socket.userId = user_id;
    socket.userName = user_name;
    socket.roomId = room_id;

    if (!activeRooms.has(room_id)) {
      activeRooms.set(room_id, new Map());
    }
    activeRooms.get(room_id).set(user_id, user_name);

    console.log(`User ${user_name} (${user_id}) joined room ${room_id}`);
  });

  // Handle chat messages
  socket.on('sendMessage', async (data) => {
    const { room_id, message, sender, userName, userId } = data;

    const messageData = {
      room_id,
      sender,
      content: message,
      timestamp: new Date(),
      userName,
      userId
    };

    // Broadcast to room
    io.to(room_id).emit('receiveMessage', messageData);
  });

  socket.on('draw', (data) => {
    // Broadcast the full drawing data object to all others in the room
    socket.to(data.roomId).emit('draw', data);
  });

  socket.on('syncCanvas', ({ roomId, image }) => {
    // Broadcast canvas sync to all OTHER users in the room
    socket.to(roomId).emit('syncCanvas', { image });
  });

  socket.on('clearCanvas', ({ roomId }) => {
    // Broadcast clear command to all OTHER users in the room
    socket.to(roomId).emit('clearCanvas');
  });

  socket.on('hand-draw', (data) => {
    // Broadcast the FULL drawing data to all others in the room
    socket.to(data.roomId).emit('hand-draw', {
      x: data.x,
      y: data.y,
      prev: data.prev,
      color: data.color,
      size: data.size,
      eraser: data.eraser
    });
  });

  socket.on('clear-canvas', ({ roomId }) => {
    // Broadcast clear command to all OTHER users in the room
    socket.to(roomId).emit('clear-canvas');
  });
  

  // Video call functionality
  socket.on('joinCall', ({ roomId, userId, userName }) => {
    const room = userCalls.get(roomId) || new Map();
    const participants = Array.from(room.entries()).map(([id, name]) => ({ userId: id, userName: name }));
    userSocketMap.set(userId, socket.id);
    
    // Send existing participants to new user
    socket.emit('existingParticipants', { participants });

    // Add user to call
    room.set(userId, userName);
    userCalls.set(roomId, room);

    // Notify others about new participant
    socket.to(roomId).emit('userJoined', { userId, userName });
  });

  socket.on('leaveCall', ({ roomId, userId, userName }) => {
    const room = userCalls.get(roomId);
    if (room) {
      room.delete(userId);
      if (room.size === 0) {
        userCalls.delete(roomId);
      } else {
        userCalls.set(roomId, room);
      }
    }

    socket.to(roomId).emit('userLeft', { userId, userName });
  });

  // WebRTC signaling
  socket.on('offer', ({ offer, to }) => {
    const targetId = userSocketMap.get(to);
    if (targetId) io.to(targetId).emit('offer', { offer, from: socket.userId });
  });

  socket.on('answer', ({ answer, to }) => {
    const targetId = userSocketMap.get(to);
    if (targetId) io.to(targetId).emit('answer', { answer, from: socket.userId });
  });

  socket.on('ice-candidate', ({ candidate, to }) => {
    const targetId = userSocketMap.get(to);
    if (targetId) io.to(targetId).emit('ice-candidate', { candidate, from: socket.userId });
  });

  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);

    if (socket.roomId && socket.userId) {
      userSocketMap.delete(socket.userId);
      const room = activeRooms.get(socket.roomId);
      if (room) {
        room.delete(socket.userId);
        if (room.size === 0) {
          activeRooms.delete(socket.roomId);
          // FIXED: Remove the problematic cleanupEmptyRoom call
          // If you need cleanup, implement it properly below
          console.log(`Room ${socket.roomId} is now empty and cleaned up`);
        }
      }

      const callRoom = userCalls.get(socket.roomId);
      if (callRoom) {
        callRoom.delete(socket.userId);
        if (callRoom.size === 0) {
          userCalls.delete(socket.roomId);
        } else {
          userCalls.set(socket.roomId, callRoom);
        }
        socket.to(socket.roomId).emit('userLeft', { userId: socket.userId, userName: socket.userName });
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});