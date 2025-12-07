import React, { useRef, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL, cn } from "./lib/utils";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "./contexts/ThemeContext";
import { 
  Pencil, Eraser, Square, Circle, Minus, Type, 
  Undo, Redo, Trash2, Download, ArrowLeft, Save
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";

const COLORS = [
  "#000000", "#EF4444", "#3B82F6", "#10B981", 
  "#F59E0B", "#8B5CF6", "#6B7280", "#FFFFFF"
];

const DrawingCanvas = () => {
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const socketRef = useRef(null);
  const containerRef = useRef(null);
  
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);
  const [startPos, setStartPos] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  // Initialize canvas size
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current && previewCanvasRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        
        // Save current content
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasRef.current.width;
        tempCanvas.height = canvasRef.current.height;
        tempCanvas.getContext('2d').drawImage(canvasRef.current, 0, 0);

        // Resize
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        previewCanvasRef.current.width = width;
        previewCanvasRef.current.height = height;

        // Restore content
        canvasRef.current.getContext('2d').drawImage(tempCanvas, 0, 0);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Socket setup
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit("joinRoom", { room_id: roomId });

    socketRef.current.on("draw", (data) => {
      drawRemote(data);
    });

    socketRef.current.on("syncCanvas", ({ image }) => {
      syncCanvas(image);
    });

    socketRef.current.on("clearCanvas", () => {
      clearCanvas(false);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [roomId]);

  const pushUndo = () => {
    const canvas = canvasRef.current;
    const temp = document.createElement("canvas");
    temp.width = canvas.width;
    temp.height = canvas.height;
    temp.getContext("2d").drawImage(canvas, 0, 0);
    setUndoStack((stack) => [...stack, temp]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const lastState = undoStack[undoStack.length - 1];
    
    // Save current state to redo stack
    const currentTemp = document.createElement("canvas");
    currentTemp.width = canvas.width;
    currentTemp.height = canvas.height;
    currentTemp.getContext("2d").drawImage(canvas, 0, 0);
    setRedoStack((stack) => [...stack, currentTemp]);

    // Restore last state
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(lastState, 0, 0);
    setUndoStack((stack) => stack.slice(0, -1));
    
    // Sync with others
    const dataURL = canvas.toDataURL();
    socketRef.current.emit("syncCanvas", { image: dataURL, roomId });
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const nextState = redoStack[redoStack.length - 1];

    // Save current state to undo stack
    const currentTemp = document.createElement("canvas");
    currentTemp.width = canvas.width;
    currentTemp.height = canvas.height;
    currentTemp.getContext("2d").drawImage(canvas, 0, 0);
    setUndoStack((stack) => [...stack, currentTemp]);

    // Restore next state
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(nextState, 0, 0);
    setRedoStack((stack) => stack.slice(0, -1));

    // Sync with others
    const dataURL = canvas.toDataURL();
    socketRef.current.emit("syncCanvas", { image: dataURL, roomId });
  };

  // Drawing primitives
  const drawLine = (x0, y0, x1, y1, color, width, emit = true) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.closePath();

    if (emit) {
      socketRef.current.emit("draw", { type: "line", x0, y0, x1, y1, color, width, roomId });
    }
  };

  const drawRect = (x0, y0, x1, y1, color, width, emit = true) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

    if (emit) {
      socketRef.current.emit("draw", { type: "rect", x0, y0, x1, y1, color, width, roomId });
    }
  };

  const drawCircle = (x0, y0, x1, y1, color, width, emit = true) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    const radius = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
    ctx.beginPath();
    ctx.arc(x0, y0, radius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.closePath();

    if (emit) {
      socketRef.current.emit("draw", { type: "circle", x0, y0, x1, y1, color, width, roomId });
    }
  };

  const drawText = (x, y, text, color, emit = true) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle = color;
    ctx.font = "20px Inter, sans-serif";
    ctx.fillText(text, x, y);

    if (emit) {
      socketRef.current.emit("draw", { type: "text", x, y, text, color, roomId });
    }
  };

  const erase = (x, y, width = 20, emit = true) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(x - width / 2, y - width / 2, width, width);

    if (emit) {
      socketRef.current.emit("draw", { type: "erase", x, y, width, roomId });
    }
  };

  const drawRemote = (data) => {
    switch (data.type) {
      case "line": drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width, false); break;
      case "rect": drawRect(data.x0, data.y0, data.x1, data.y1, data.color, data.width, false); break;
      case "circle": drawCircle(data.x0, data.y0, data.x1, data.y1, data.color, data.width, false); break;
      case "text": drawText(data.x, data.y, data.text, data.color, false); break;
      case "erase": erase(data.x, data.y, data.width, false); break;
      default: break;
    }
  };

  const syncCanvas = (image) => {
    const ctx = canvasRef.current.getContext("2d");
    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = image;
  };

  const clearCanvas = (emit = true) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (emit) {
      socketRef.current.emit("clearCanvas", { roomId });
    }
  };

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === "text") {
      setTextPos({ x, y });
      setShowTextInput(true);
      return;
    }

    setDrawing(true);
    setStartPos({ x, y });
    pushUndo();

    if (tool === "pen" || tool === "eraser") {
      const ctx = canvasRef.current.getContext("2d");
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const handleMouseMove = (e) => {
    if (!drawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === "pen") {
      drawLine(startPos.x, startPos.y, x, y, color, lineWidth);
      setStartPos({ x, y });
    } else if (tool === "eraser") {
      erase(x, y, lineWidth * 5);
    } else {
      // Preview shapes
      const ctx = previewCanvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = 0.5;

      if (tool === "rect") {
        ctx.strokeRect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
      } else if (tool === "circle") {
        const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (tool === "line") {
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = (e) => {
    if (!drawing) return;
    setDrawing(false);
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Clear preview
    const previewCtx = previewCanvasRef.current.getContext("2d");
    previewCtx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);

    // Finalize shape
    if (tool === "rect") drawRect(startPos.x, startPos.y, x, y, color, lineWidth);
    else if (tool === "circle") drawCircle(startPos.x, startPos.y, x, y, color, lineWidth);
    else if (tool === "line") drawLine(startPos.x, startPos.y, x, y, color, lineWidth);
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      drawText(textPos.x, textPos.y, textInput, color);
      pushUndo();
    }
    setShowTextInput(false);
    setTextInput("");
  };

  const downloadCanvas = () => {
    const link = document.createElement("a");
    link.download = `drawing-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <div className="h-screen w-full bg-bg-canvas flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-border-subtle bg-bg-surface flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/room/${roomId}`)}
            className="p-2 rounded-xl hover:bg-bg-canvas text-fg-secondary hover:text-fg-primary transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-serif text-xl font-medium text-fg-primary">Whiteboard</h1>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleUndo} className="p-2 rounded-lg hover:bg-bg-canvas text-fg-secondary hover:text-fg-primary" title="Undo">
            <Undo size={20} />
          </button>
          <button onClick={handleRedo} className="p-2 rounded-lg hover:bg-bg-canvas text-fg-secondary hover:text-fg-primary" title="Redo">
            <Redo size={20} />
          </button>
          <div className="w-px h-6 bg-border-subtle mx-2" />
          <button onClick={() => clearCanvas()} className="p-2 rounded-lg hover:bg-red-50 text-fg-secondary hover:text-red-500" title="Clear">
            <Trash2 size={20} />
          </button>
          <button onClick={downloadCanvas} className="p-2 rounded-lg hover:bg-bg-canvas text-fg-secondary hover:text-fg-primary" title="Download">
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Toolbar */}
        <div className="w-16 bg-bg-surface border-r border-border-subtle flex flex-col items-center py-4 gap-4 shrink-0 z-10">
          <div className="flex flex-col gap-2 w-full px-2">
            {[
              { id: "pen", icon: Pencil, label: "Pen" },
              { id: "eraser", icon: Eraser, label: "Eraser" },
              { id: "rect", icon: Square, label: "Rectangle" },
              { id: "circle", icon: Circle, label: "Circle" },
              { id: "line", icon: Minus, label: "Line" },
              { id: "text", icon: Type, label: "Text" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={cn(
                  "p-3 rounded-xl flex items-center justify-center transition-all duration-200",
                  tool === t.id 
                    ? "bg-accent-brand text-white shadow-lg shadow-accent-brand/25" 
                    : "text-fg-secondary hover:bg-bg-canvas hover:text-fg-primary"
                )}
                title={t.label}
              >
                <t.icon size={20} />
              </button>
            ))}
          </div>

          <div className="w-8 h-px bg-border-subtle my-2" />

          {/* Color Picker */}
          <div className="flex flex-col gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "w-6 h-6 rounded-full border border-border-subtle transition-transform hover:scale-110",
                  color === c && "ring-2 ring-offset-2 ring-accent-brand scale-110"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-8 h-px bg-border-subtle my-2" />

          {/* Line Width */}
          <div className="flex flex-col items-center gap-2">
            {[2, 4, 6, 8].map((w) => (
              <button
                key={w}
                onClick={() => setLineWidth(w)}
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center hover:bg-bg-canvas",
                  lineWidth === w && "bg-bg-canvas"
                )}
              >
                <div 
                  className={cn("rounded-full bg-fg-primary", lineWidth === w ? "bg-accent-brand" : "bg-fg-secondary")}
                  style={{ width: w, height: w }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Canvas Container */}
        <div ref={containerRef} className="flex-1 relative bg-white cursor-crosshair overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="absolute top-0 left-0 z-0"
          />
          <canvas
            ref={previewCanvasRef}
            className="absolute top-0 left-0 z-1 pointer-events-none"
          />

          {/* Text Input Overlay */}
          {showTextInput && (
            <div
              className="absolute z-20 bg-white p-2 rounded-lg shadow-xl border border-border-subtle"
              style={{ left: textPos.x, top: textPos.y }}
            >
              <input
                autoFocus
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
                onBlur={handleTextSubmit}
                className="border border-border-subtle rounded px-2 py-1 outline-none focus:border-accent-brand"
                placeholder="Type here..."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DrawingCanvas;
