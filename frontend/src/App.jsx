import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import Chat from './Chat';
import FileManager from './FileManager';
import DrawingCanvas from './DrawingCanvas';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Chat />} />
        <Route path="/room/:roomId/files" element={<FileManager />} />
        <Route path="/room/:roomId/whiteboard" element={<DrawingCanvas />} />
      </Routes>
    </Router>
  );
}

export default App;