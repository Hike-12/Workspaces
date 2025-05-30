const express = require('express');
const Message = require('../models/Message');
const router = express.Router();

// Get messages for a room
router.get('/messages', async (req, res) => {
  try {
    const { room_id } = req.query;
    
    const messages = await Message.find({ room_id })
      .sort({ createdAt: 1 });
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Save message
router.post('/messages', async (req, res) => {
  try {
    const { room_id, sender, content, userName, userId } = req.body;

    const message = new Message({
      room_id,
      sender,
      content,
      userName,
      userId
    });

    await message.save();

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;