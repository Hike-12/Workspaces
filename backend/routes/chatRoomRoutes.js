const express = require('express');
const Room = require('../models/ChatRoom');
const auth = require('../middleware/auth');
const router = express.Router();

// Create room
router.post('/create', auth, async (req, res) => {
  try {
    const { roomName, password, description, userName, userId } = req.body;

    // Check if room already exists
    const existingRoom = await Room.findOne({ name: roomName });
    if (existingRoom) {
      return res.status(400).json({ message: 'Room already exists' });
    }

    const room = new Room({
      name: roomName,
      password,
      description: description || '',
      participants: [{ userId, userName }],
      createdBy: userName
    });

    await room.save();

    res.status(201).json({
      message: 'Room created successfully',
      room: {
        id: room._id,
        name: room.name,
        description: room.description
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Join room
router.post('/join', auth, async (req, res) => {
  try {
    const { roomName, password, userName, userId } = req.body;

    const room = await Room.findOne({ name: roomName });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.password !== password) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Add user to participants if not already there (by userId)
    if (!room.participants.some(p => p.userId === userId)) {
      room.participants.push({ userId, userName });
      await room.save();
    }

    res.json({
      message: 'Successfully joined room',
      room: {
        id: room._id,
        name: room.name,
        description: room.description,
        participants: room.participants
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get room details
router.get('/:roomId', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json({
      room: {
        id: room._id,
        name: room.name,
        description: room.description,
        participants: room.participants
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/leave', auth, async (req, res) => {
  try {
    const { roomId, userId } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Remove user from participants
    room.participants = room.participants.filter(p => p.userId !== userId);
    
    if (room.participants.length === 0) {
      // If no participants left, trigger cleanup
      await cleanupEmptyRoom(roomId);
      return res.json({ message: 'Room deleted - no participants remaining' });
    } else {
      // Save updated room
      await room.save();
      return res.json({ 
        message: 'Left room successfully',
        participants: room.participants.length 
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add the cleanup function to this file as well
const cleanupEmptyRoom = async (roomId) => {
  try {
    const Message = require('../models/Message');
    const File = require('../models/File');
    const fs = require('fs');
    
    console.log(`Starting cleanup for room ${roomId}`);
    
    // Delete all files associated with the room
    const files = await File.find({ room_id: roomId });
    for (const file of files) {
      // Delete file from filesystem
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`Deleted file: ${file.path}`);
      }
    }
    
    // Delete file records from database
    await File.deleteMany({ room_id: roomId });
    console.log(`Deleted ${files.length} file records for room ${roomId}`);
    
    // Delete all messages for the room
    const messageCount = await Message.countDocuments({ room_id: roomId });
    await Message.deleteMany({ room_id: roomId });
    console.log(`Deleted ${messageCount} messages for room ${roomId}`);
    
    // Delete the room itself
    await Room.findByIdAndDelete(roomId);
    console.log(`Deleted room ${roomId} from database`);
    
  } catch (error) {
    console.error(`Error cleaning up room ${roomId}:`, error);
  }
};

module.exports = router;