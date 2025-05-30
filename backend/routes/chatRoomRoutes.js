const express = require('express');
const Room = require('../models/ChatRoom');
const router = express.Router();

// Create room
router.post('/create', async (req, res) => {
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
router.post('/join', async (req, res) => {
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
router.get('/:roomId', async (req, res) => {
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

module.exports = router;