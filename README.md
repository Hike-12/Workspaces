# FocalPoint - Real-time Video Chat & Collaboration Platform

A modern, real-time video conferencing and chat application built with React, Node.js, Socket.io, and WebRTC. Features include video calls, screen sharing, real-time messaging, and file sharing capabilities.


## 🚀 Features

### Video Conferencing
- **Multi-participant video calls** with WebRTC
- **Screen sharing** functionality
- **Camera and microphone controls** (mute/unmute, camera on/off)
- **Full-screen video viewing**
- **Real-time participant management**

### Real-time Chat
- **Instant messaging** with Socket.io
- **Message persistence** with MongoDB
- **Real-time notifications** for new messages
- **User presence indicators**

### Room Management
- **Create and join rooms** with unique room IDs
- **Room-based isolation** for private conversations
- **Participant tracking** and management
- **Automatic cleanup** of empty rooms

### File Sharing *(Coming Soon)*
- File upload and sharing within rooms
- File management interface

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern UI library
- **React Router** - Client-side routing
- **Socket.io Client** - Real-time communication
- **WebRTC** - Peer-to-peer video/audio
- **Lucide React** - Modern icon library
- **React Toastify** - Toast notifications
- **Tailwind CSS** - Utility-first styling

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **Socket.io** - Real-time bidirectional communication
- **MongoDB** - Document database
- **Mongoose** - MongoDB object modeling
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

## 📁 Project Structure

```
Workspaces/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── Chat.jsx         # Main chat/video component
│   │   ├── lib/
│   │   │   └── utils.js     # API endpoints and utilities
│   │   └── ...
│   ├── package.json
│   └── ...
├── backend/                  # Node.js backend server
│   ├── server.js            # Main server file
│   ├── config/
│   │   └── db.js           # Database configuration
│   ├── routes/
│   │   ├── chatRoomRoutes.js
│   │   ├── fileRoutes.js
│   │   └── messageRoutes.js
│   ├── models/              # MongoDB models
│   ├── package.json
│   └── ...
└── README.md               # Project documentation
```

## 🚦 Getting Started

### Prerequisites
- **Node.js** (v16 or higher)
- **MongoDB** (local installation or MongoDB Atlas)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Hike-12/Workspaces.git
   cd Workspaces
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Environment Configuration**
   
   Create a `.env` file in the backend directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/focalpoint
   # Or for MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/focalpoint
   ```

5. **Start the Applications**
   
   **Backend** (from backend directory):
   ```bash
   npm start
   # or for development with nodemon:
   npm run dev
   ```

   **Frontend** (from frontend directory):
   ```bash
   npm run dev
   # Usually runs on http://localhost:5173
   ```

### Quick Start
1. Open your browser and navigate to `http://localhost:5173`
2. Enter your name and create/join a room
3. Share the room ID with others to invite them
4. Start chatting and use the "Start Call" button for video conferencing

## 🎮 Usage Guide

### Creating/Joining a Room
1. Enter your display name
2. Either create a new room or enter an existing room ID
3. Click "Join Room" or "Create Room"

### Video Calling
1. Click "Start Call" to begin a video conference
2. Allow camera and microphone permissions when prompted
3. Use the control buttons to:
   - 🎤 **Mute/Unmute** microphone
   - 📹 **Turn camera on/off**
   - 🖥️ **Share your screen**
   - 📞 **End the call**

### Chat Features
- Type messages in the chat input
- Messages are delivered instantly to all room participants
- Chat history is preserved even after leaving and rejoining

### Screen Sharing
1. Click the screen share button during a video call
2. Select the window or screen you want to share
3. Click the button again to stop sharing

## 🔧 Technical Details

### WebRTC Implementation
- **STUN/TURN servers** for NAT traversal
- **Peer-to-peer connections** for optimal performance
- **ICE candidate exchange** via Socket.io signaling
- **Multiple peer connection management**

### Real-time Communication
- **Socket.io** handles signaling for WebRTC
- **Room-based message broadcasting**
- **User presence management**
- **Automatic reconnection** handling

### Database Schema
```javascript
// Room Model
{
  room_id: String,
  room_name: String,
  participants: [String],
  created_at: Date,
  is_active: Boolean
}

// Message Model
{
  room_id: String,
  sender: String,
  content: String,
  timestamp: Date,
  userName: String,
  userId: String
}
```

## 🌐 Deployment

### Frontend (Vercel)
The frontend is deployed on Vercel at: `https://focalpoint-gamma.vercel.app`

### Backend (Your hosting service)
Configure environment variables:
- `MONGODB_URI`
- `PORT`
- CORS origins for production

### CORS Configuration
The application is configured to work with:
- `http://localhost:3000`
- `http://localhost:5173`
- `https://focalpoint-gamma.vercel.app`

## 🔒 Security Considerations

- **Input validation** on all user inputs
- **Room isolation** prevents cross-room data leakage
- **CORS properly configured** for allowed origins
- **Environment variables** for sensitive configuration

## 🚧 Known Issues & Limitations

- **Mobile browser compatibility** may vary for WebRTC features
- **Large group calls** (10+ participants) may impact performance
- **Network quality** directly affects video/audio quality
- **File sharing** feature is not yet implemented

## 🛣️ Roadmap

- [ ] **File sharing and management**
- [ ] **User authentication and profiles**
- [ ] **Room passwords and privacy settings**
- [ ] **Mobile app development**
- [ ] **Recording functionality**
- [ ] **Chat message reactions and replies**
- [ ] **Virtual backgrounds**
- [ ] **Improved mobile responsiveness**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **WebRTC** community for excellent documentation
- **Socket.io** for real-time communication
- **React** team for the amazing framework
- **MongoDB** for reliable data storage
- **Vercel** for seamless deployment

*FocalPoint - Bringing people together through seamless video communication*

