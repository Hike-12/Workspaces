import React, { useRef, useEffect, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { io } from "socket.io-client";
import { Palette, Eraser, Trash2, Circle } from "lucide-react";

const SOCKET_URL = "YOUR_SOCKET_URL"; // Replace with your socket URL

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
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [brushSize, setBrushSize] = useState(6);
  const [isEraser, setIsEraser] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [handDetected, setHandDetected] = useState(false);

  // Smooth the hand position using moving average
  const smoothPosition = (x, y) => {
    smoothingBufferRef.current.push({ x, y });
    if (smoothingBufferRef.current.length > 3) {
      smoothingBufferRef.current.shift();
    }
    const avgX = smoothingBufferRef.current.reduce((sum, p) => sum + p.x, 0) / smoothingBufferRef.current.length;
    const avgY = smoothingBufferRef.current.reduce((sum, p) => sum + p.y, 0) / smoothingBufferRef.current.length;
    return { x: avgX, y: avgY };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socketRef.current?.emit("clear-canvas", { roomId });
  };

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit("joinRoom", { room_id: roomId });

    // Setup MediaPipe Hands with better settings
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.8,
      minTrackingConfidence: 0.8,
    });

    hands.onResults((results) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        setHandDetected(true);
        const landmarks = results.multiHandLandmarks[0];
        
        // Index finger tip is landmark 8
        const tip = landmarks[8];
        // Index finger PIP joint is landmark 6 (for gesture detection)
        const pip = landmarks[6];
        
        const rawX = tip.x * canvas.width;
        const rawY = tip.y * canvas.height;
        
        // Apply smoothing
        const { x, y } = smoothPosition(rawX, rawY);

        // Check if finger is extended (drawing gesture)
        const isFingerExtended = tip.y < pip.y;

        if (isFingerExtended && lastPointRef.current) {
          const distance = Math.sqrt(
            Math.pow(x - lastPointRef.current.x, 2) + 
            Math.pow(y - lastPointRef.current.y, 2)
          );

          // Only draw if movement is reasonable (prevents jumpy lines)
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

            // Emit drawing event
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
        setHandDetected(false);
        lastPointRef.current = null;
        smoothingBufferRef.current = [];
      }
    });

    // Setup webcam
    let camera;
    if (videoRef.current) {
      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            await hands.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }

    // Listen for remote drawing events
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

    // Listen for clear canvas events
    socketRef.current.on("clear-canvas", () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      if (camera) camera.stop();
      socketRef.current?.disconnect();
    };
  }, [roomId, selectedColor, brushSize, isEraser]);

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-gray-900 rounded-xl">
      <div className="relative" style={{ width: 640, height: 480 }}>
        <video
          ref={videoRef}
          style={{
            width: 640,
            height: 480,
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 1,
            objectFit: "cover",
            borderRadius: "12px",
            transform: "scaleX(-1)"
          }}
          autoPlay
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 2,
            pointerEvents: "none",
            borderRadius: "12px",
            transform: "scaleX(-1)"
          }}
        />
        
        {/* Hand detection indicator */}
        <div
          className={`absolute top-4 right-4 z-10 px-3 py-2 rounded-full text-sm font-medium transition-all ${
            handDetected 
              ? "bg-green-500 text-white" 
              : "bg-gray-700 text-gray-300"
          }`}
        >
          {handDetected ? "✓ Hand Detected" : "No Hand"}
        </div>
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
            {/* Color Palette */}
            <div>
              <label className="text-gray-300 text-sm mb-2 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      setSelectedColor(color.value);
                      setIsEraser(false);
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
                  onClick={() => setIsEraser(!isEraser)}
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

            {/* Brush Size */}
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

            {/* Clear Button */}
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

      {/* Instructions */}
      <div className="bg-gray-800 rounded-lg p-4 max-w-2xl">
        <h4 className="text-white font-semibold mb-2">How to use:</h4>
        <ul className="text-gray-300 text-sm space-y-1">
          <li>• Point your index finger up to draw</li>
          <li>• Move your finger to create lines</li>
          <li>• Lower your finger to stop drawing</li>
          <li>• Select colors and adjust brush size below</li>
          <li>• Use eraser mode to remove strokes</li>
        </ul>
      </div>
    </div>
  );
}