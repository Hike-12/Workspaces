const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  room_id: {
    type: String,
    required: true
  },
  uploaded_by: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('File', fileSchema);