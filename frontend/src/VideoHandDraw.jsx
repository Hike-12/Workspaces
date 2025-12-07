import React, { useRef, useEffect, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { io } from "socket.io-client";
import { Palette, Eraser, Trash2, Circle, Hand, Eye, EyeOff, Minimize2, Maximize2, Video, VideoOff, X } from "lucide-react";
import { cn, SOCKET_URL } from "./lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  { name: "Red", value: "#EF4444" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#10B981" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Orange", value: "#F59E0B" },
  { name: "Pink", value: "#EC4899" },
  { name: "Yellow", value: "#FCD34D" },
  { name: "White", value: "#FFFFFF" }
];

export default function VideoHandDraw({ roomId = "default-room", onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const lastPointRef = useRef(null);
  const smoothingBufferRef = useRef([]);
  const cameraRef = useRef(null);
  const handsRef = useRef(null);
  const containerRef = useRef(null);

  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [brushSize, setBrushSize] = useState(6);
  const [isEraser, setIsEraser] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [handDetected, setHandDetected] = useState(false);
  const [tracking, setTracking] = useState(true);
  const [showVideo, setShowVideo] = useState(true);
  const [minimized, setMinimized] = useState(false);

  // Refs to hold current state values for the closure
  const selectedColorRef = useRef(selectedColor);
  const brushSizeRef = useRef(brushSize);
  const isEraserRef = useRef(isEraser);

  // Sync refs with state
  useEffect(() => {
    selectedColorRef.current = selectedColor;
    brushSizeRef.current = brushSize;
    isEraserRef.current = isEraser;
  }, [selectedColor, brushSize, isEraser]);

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
    // Resize canvas to match container
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

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
      if (!canvas) return;
      
      const ctx = canvas.getContext("2d");
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        setHandDetected(true);
        const landmarks = results.multiHandLandmarks[0];
        const tip = landmarks[8];
        
        // Always use full canvas dimensions for drawing coordinates
        // Mirror X coordinate for natural feel
        const rawX = (1 - tip.x) * canvas.width;
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
              if (isEraserRef.current) {
                ctx.globalCompositeOperation = "destination-out";
                ctx.strokeStyle = "rgba(0,0,0,1)";
                ctx.lineWidth = brushSizeRef.current * 3;
              } else {
                ctx.globalCompositeOperation = "source-over";
                ctx.strokeStyle = selectedColorRef.current;
                ctx.lineWidth = brushSizeRef.current;
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
                color: selectedColorRef.current,
                size: brushSizeRef.current,
                eraser: isEraserRef.current
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
      if (!canvas) return;
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
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      if (cameraRef.current) cameraRef.current.stop();
      if (socketRef.current) socketRef.current.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [roomId, tracking]);

  useEffect(() => {
    if (cameraRef.current) {
      if (tracking) cameraRef.current.start();
      else cameraRef.current.stop();
    }
  }, [tracking]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "fixed z-50 bg-black/90 backdrop-blur-sm shadow-2xl overflow-hidden transition-all duration-300",
        minimized 
          ? "bottom-4 right-4 w-64 h-48 rounded-2xl border border-white/10" 
          : "inset-4 rounded-3xl border border-white/10"
      )}
    >
      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          <div className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 backdrop-blur-md border",
            handDetected 
              ? "bg-green-500/20 border-green-500/30 text-green-400" 
              : "bg-red-500/20 border-red-500/30 text-red-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", handDetected ? "bg-green-400 animate-pulse" : "bg-red-400")} />
            {handDetected ? "Hand Detected" : "No Hand Detected"}
          </div>
          
          {!minimized && (
            <div className="text-white/50 text-xs bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
              Raise index finger to draw
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMinimized(!minimized)}
            className="p-2 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-white/10 backdrop-blur-md border border-white/10 transition-colors"
          >
            {minimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 backdrop-blur-md border border-red-500/30 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div ref={containerRef} className="relative w-full h-full flex items-center justify-center bg-neutral-900">
        {/* Video Feed */}
        <video
          ref={videoRef}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transform scale-x-[-1]",
            !showVideo && "opacity-0"
          )}
          playsInline
        />
        
        {/* Drawing Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full z-10"
        />

        {!showVideo && (
          <div className="absolute inset-0 flex items-center justify-center text-white/20">
            <VideoOff size={48} />
          </div>
        )}
      </div>

      {/* Toolbar */}
      {!minimized && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl z-20">
          <button
            onClick={() => setTracking(!tracking)}
            className={cn(
              "p-3 rounded-xl transition-all duration-200",
              tracking ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/50 hover:bg-white/10"
            )}
            title={tracking ? "Stop Tracking" : "Start Tracking"}
          >
            <Hand size={20} />
          </button>

          <button
            onClick={() => setShowVideo(!showVideo)}
            className={cn(
              "p-3 rounded-xl transition-all duration-200",
              showVideo ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-white/50 hover:bg-white/10"
            )}
            title={showVideo ? "Hide Video" : "Show Video"}
          >
            {showVideo ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>

          <div className="w-px h-8 bg-white/10 mx-1" />

          <div className="flex items-center gap-1.5 px-2">
            {COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => {
                  setSelectedColor(c.value);
                  setIsEraser(false);
                }}
                className={cn(
                  "w-6 h-6 rounded-full border border-white/10 transition-transform hover:scale-110",
                  selectedColor === c.value && !isEraser && "ring-2 ring-offset-2 ring-offset-black ring-white scale-110"
                )}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>

          <div className="w-px h-8 bg-white/10 mx-1" />

          <button
            onClick={() => setIsEraser(!isEraser)}
            className={cn(
              "p-3 rounded-xl transition-all duration-200",
              isEraser ? "bg-white text-black" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            )}
            title="Eraser"
          >
            <Eraser size={20} />
          </button>

          <button
            onClick={clearCanvas}
            className="p-3 rounded-xl bg-white/5 text-white/70 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200"
            title="Clear Canvas"
          >
            <Trash2 size={20} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
