import React, { useRef, useEffect, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { io } from "socket.io-client";
import { Palette, Eraser, Trash2, Circle, Hand, Eye, EyeOff, Minimize2, Maximize2 } from "lucide-react";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL; // Replace with your socket URL

const COLORS = [
  { name: "Red", value: "#FF6B6B" },
  { name: "Blue", value: "#4ECDC4" },
  { name: "Green", value: "#51CF66" },
  { name: "Purple", value: "#9775FA" },
  { name: "Orange", value: "#FF922B" },
  { name: "Pink", value: "#FF6BC5" },
  { name: "Yellow", value: "#FFD43B" },
  { name: "White", value: "#FFFFFF" }
];

export default function VideoHandDraw({ roomId = "default-room" }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const lastPointRef = useRef(null);
  const smoothingBufferRef = useRef([]);
  const cameraRef = useRef(null);
  const handsRef = useRef(null);

  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [brushSize, setBrushSize] = useState(6);
  const [isEraser, setIsEraser] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [handDetected, setHandDetected] = useState(false);
  const [tracking, setTracking] = useState(true);
  const [showVideo, setShowVideo] = useState(true);
  const [minimized, setMinimized] = useState(false);

  // Clear drawing buffers when color changes
  const clearDrawingState = () => {
    smoothingBufferRef.current = [];
    lastPointRef.current = null;
  };

  // Smooth the hand position using weighted moving average
  const smoothPosition = (x, y) => {
    smoothingBufferRef.current.push({ x, y, weight: 1 });
    if (smoothingBufferRef.current.length > 5) {
      smoothingBufferRef.current.shift();
    }
    const totalWeight = smoothingBufferRef.current.reduce((sum, _, index) => sum + (index + 1), 0);
    const avgX = smoothingBufferRef.current.reduce((sum, p, index) => sum + p.x * (index + 1), 0) / totalWeight;
    const avgY = smoothingBufferRef.current.reduce((sum, p, index) => sum + p.y * (index + 1), 0) / totalWeight;
    return { x: avgX, y: avgY };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socketRef.current?.emit("clear-canvas", { roomId });
  };

  // Improved hand tracking with better gesture detection
  const isIndexFingerExtended = (landmarks) => {
    const tip = landmarks[8];
    const dip = landmarks[7];
    const pip = landmarks[6];
    const mcp = landmarks[5];
    const tipAbovePip = tip.y < pip.y;
    const tipAboveDip = tip.y < dip.y;
    const tipAboveMcp = tip.y < mcp.y;
    const thumbTip = landmarks[4];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const middleFolded = middleTip.y > landmarks[9].y;
    const ringFolded = ringTip.y > landmarks[13].y;
    const pinkyFolded = pinkyTip.y > landmarks[17].y;
    return tipAbovePip && tipAboveDip && tipAboveMcp && middleFolded && ringFolded && pinkyFolded;
  };

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit("joinRoom", { room_id: roomId });

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    handsRef.current = hands;

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.8,
      minTrackingConfidence: 0.8,
    });

    hands.onResults((results) => {
      if (!tracking) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        setHandDetected(true);
        const landmarks = results.multiHandLandmarks[0];
        const tip = landmarks[8];
        
        // Always use full canvas dimensions for drawing coordinates
        const rawX = tip.x * canvas.width;
        const rawY = tip.y * canvas.height;
        const { x, y } = smoothPosition(rawX, rawY);
        
        const isFingerExtended = isIndexFingerExtended(landmarks);
        if (isFingerExtended) {
          if (lastPointRef.current) {
            const distance = Math.sqrt(
              Math.pow(x - lastPointRef.current.x, 2) +
              Math.pow(y - lastPointRef.current.y, 2)
            );
            if (distance < 100) {
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              if (isEraser) {
                ctx.globalCompositeOperation = "destination-out";
                ctx.strokeStyle = "rgba(0,0,0,1)";
                ctx.lineWidth = brushSize * 3;
              } else {
                ctx.globalCompositeOperation = "source-over";
                ctx.strokeStyle = selectedColor;
                ctx.lineWidth = brushSize;
              }
              ctx.beginPath();
              ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
              ctx.lineTo(x, y);
              ctx.stroke();
              socketRef.current.emit("hand-draw", {
                roomId,
                x,
                y,
                prev: lastPointRef.current,
                color: selectedColor,
                size: brushSize,
                eraser: isEraser
              });
            }
          }
          lastPointRef.current = { x, y };
        } else {
          lastPointRef.current = null;
        }
      } else {
        setHandDetected(false);
        lastPointRef.current = null;
        smoothingBufferRef.current = [];
      }
    });

    if (videoRef.current) {
      cameraRef.current = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && tracking) {
            await hands.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });
      if (tracking) cameraRef.current.start();
    }

    socketRef.current.on("hand-draw", ({ x, y, prev, color, size, eraser }) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (prev) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (eraser) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
          ctx.lineWidth = size * 3;
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = color;
          ctx.lineWidth = size;
        }
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    });

    socketRef.current.on("clear-canvas", () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      if (cameraRef.current) cameraRef.current.stop();
      if (handsRef.current) handsRef.current.close();
      socketRef.current?.disconnect();
    };
  }, [roomId, selectedColor, brushSize, isEraser, tracking]);

  const handleToggleTracking = () => {
    setTracking((prev) => {
      const next = !prev;
      if (cameraRef.current) {
        if (next) {
          cameraRef.current.start();
          setShowVideo(true);
        } else {
          cameraRef.current.stop();
          setShowVideo(false);
        }
      }
      return next;
    });
    clearDrawingState();
  };

  const handleToggleVideo = () => {
    setShowVideo(!showVideo);
  };

  const handleToggleMinimize = () => {
    setMinimized((prev) => !prev);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-gray-900 rounded-xl">
      <div className="relative" style={{ width: 640, height: 480 }}>
        {/* Minimize/Maximize Button */}
        <button
          onClick={handleToggleMinimize}
          className={`absolute top-4 right-4 z-20 px-3 py-2 rounded-full font-medium flex items-center gap-2 transition-all ${
            minimized
              ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {minimized ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
          {minimized ? "Maximize Video" : "Minimize Video"}
        </button>

        {/* Video Feed - Always behind canvas */}
        <video
          ref={videoRef}
          style={{
            width: minimized ? 160 : 640,
            height: minimized ? 120 : 480,
            position: 'absolute',
            top: minimized ? 16 : 0,
            right: minimized ? 16 : 'auto',
            left: minimized ? 'auto' : 0,
            zIndex: 1, // Always behind canvas
            objectFit: 'cover',
            borderRadius: '12px',
            boxShadow: minimized ? '0 2px 12px rgba(0,0,0,0.25)' : '',
            transform: 'scaleX(-1)',
            display: showVideo ? 'block' : 'none',
            opacity: showVideo ? 1 : 0,
            transition: 'opacity 0.3s, width 0.3s, height 0.3s'
          }}
          autoPlay
          muted
          playsInline
        />

        {/* Canvas - Always on top, full size */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 2, // Always on top of video
            pointerEvents: 'none',
            borderRadius: '12px',
            transform: 'scaleX(-1)',
            backgroundColor: showVideo ? 'transparent' : 'white',
            transition: 'background-color 0.3s ease'
          }}
        />

        {/* Hand detection indicator */}
        <div
          className={`absolute top-16 right-4 z-10 px-3 py-2 rounded-full text-sm font-medium transition-all ${
            handDetected && tracking
              ? "bg-green-500 text-white"
              : tracking
              ? "bg-red-500 text-white"
              : "bg-gray-700 text-gray-300"
          }`}
        >
          {tracking 
            ? (handDetected ? "✓ Hand Detected" : "✗ No Hand") 
            : "Tracking Off"}
        </div>

        {/* Video Toggle Button */}
        <button
          onClick={handleToggleVideo}
          className={`absolute top-4 left-4 z-10 px-4 py-2 rounded-full font-medium flex items-center gap-2 transition-all ${
            showVideo
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          {showVideo ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          {showVideo ? "Hide Video" : "Show Video"}
        </button>

        {/* Tracking toggle */}
        <button
          onClick={handleToggleTracking}
          className={`absolute bottom-4 right-4 z-10 px-4 py-2 rounded-full font-medium flex items-center gap-2 transition-all ${
            tracking
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          <Hand className="w-5 h-5" />
          {tracking ? "Stop Tracking" : "Start Tracking"}
        </button>

        {/* Canvas-only overlay message */}
        {!showVideo && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-gray-800 bg-opacity-80 px-4 py-2 rounded-lg text-white text-center pointer-events-none">
            Canvas View: {tracking ? "Hand tracking active" : "Hand tracking paused"}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="w-full max-w-2xl bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Drawing Controls
          </h3>
          <button
            onClick={() => setShowControls(!showControls)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {showControls ? "Hide" : "Show"}
          </button>
        </div>
        {showControls && (
          <div className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm mb-2 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      setSelectedColor(color.value);
                      setIsEraser(false);
                      clearDrawingState();
                    }}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      selectedColor === color.value && !isEraser
                        ? "border-white scale-110"
                        : "border-gray-600 hover:border-gray-400"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
                <button
                  onClick={() => {
                    setIsEraser(!isEraser);
                    clearDrawingState();
                  }}
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                    isEraser
                      ? "border-white bg-gray-600 scale-110"
                      : "border-gray-600 bg-gray-700 hover:border-gray-400"
                  }`}
                  title="Eraser"
                >
                  <Eraser className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-2 block flex items-center gap-2">
                <Circle className="w-4 h-4" />
                Brush Size: {brushSize}px
              </label>
              <input
                type="range"
                min="2"
                max="20"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <button
              onClick={clearCanvas}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Clear Canvas
            </button>
          </div>
        )}
      </div>
      <div className="bg-gray-800 rounded-lg p-4 max-w-2xl">
        <h4 className="text-white font-semibold mb-2">How to use:</h4>
        <ul className="text-gray-300 text-sm space-y-1">
          <li>• <strong>Point your index finger up</strong> (with other fingers folded) to draw</li>
          <li>• Move your finger to create lines</li>
          <li>• Lower your finger to stop drawing</li>
          <li>• Select colors and adjust brush size below</li>
          <li>• Use eraser mode to remove strokes</li>
          <li>• <strong>"Stop Tracking"</strong> - Pauses hand detection and shows clean canvas</li>
          <li>• <strong>"Hide Video"</strong> - Hides camera feed, keeps canvas visible</li>
          <li>• <strong>"Minimize Video"</strong> - Shrinks video to corner, drawing continues on full canvas</li>
          <li>• Drawing always happens on the full canvas regardless of video size</li>
        </ul>
      </div>
    </div>
  );
}