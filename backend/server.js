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
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
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

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join room
  socket.on('joinRoom', ({ room_id, user_name }) => {
    socket.join(room_id);
    socket.userName = user_name;
    socket.roomId = room_id;
    
    if (!activeRooms.has(room_id)) {
      activeRooms.set(room_id, new Set());
    }
    activeRooms.get(room_id).add(user_name);
    
    console.log(`User ${user_name} joined room ${room_id}`);
  });

  // Handle chat messages
  socket.on('sendMessage', async (data) => {
    const { room_id, message, sender, userName } = data;
    
    const messageData = {
      room_id,
      sender,
      content: message,
      timestamp: new Date(),
      userName
    };

    // Broadcast to room
    io.to(room_id).emit('receiveMessage', messageData);
  });

  // Video call functionality
  socket.on('joinCall', (roomId) => {
    const room = userCalls.get(roomId) || new Set();
    const participants = Array.from(room);
    
    // Send existing participants to new user
    socket.emit('existingParticipants', { participants });
    
    // Add user to call
    room.add(socket.userName);
    userCalls.set(roomId, room);
    
    // Notify others about new participant
    socket.to(roomId).emit('userJoined', { userId: socket.userName });
  });

  socket.on('leaveCall', (roomId) => {
    const room = userCalls.get(roomId);
    if (room) {
      room.delete(socket.userName);
      if (room.size === 0) {
        userCalls.delete(roomId);
      } else {
        userCalls.set(roomId, room);
      }
    }
    
    socket.to(roomId).emit('userLeft', { userId: socket.userName });
  });

  // WebRTC signaling
  socket.on('offer', ({ offer, to }) => {
    socket.to(socket.roomId).emit('offer', { offer, from: socket.userName });
  });

  socket.on('answer', ({ answer, to }) => {
    socket.to(socket.roomId).emit('answer', { answer, from: socket.userName });
  });

  socket.on('ice-candidate', ({ candidate, to }) => {
    socket.to(socket.roomId).emit('ice-candidate', { candidate, from: socket.userName });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    if (socket.roomId && socket.userName) {
      const room = activeRooms.get(socket.roomId);
      if (room) {
        room.delete(socket.userName);
        if (room.size === 0) {
          activeRooms.delete(socket.roomId);
        }
      }
      
      const callRoom = userCalls.get(socket.roomId);
      if (callRoom) {
        callRoom.delete(socket.userName);
        if (callRoom.size === 0) {
          userCalls.delete(socket.roomId);
        } else {
          userCalls.set(socket.roomId, callRoom);
        }
        socket.to(socket.roomId).emit('userLeft', { userId: socket.userName });
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});