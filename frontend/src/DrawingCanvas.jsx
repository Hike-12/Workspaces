import React, { useRef, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "./lib/utils";
import { useParams } from "react-router-dom";
import { useTheme } from "./contexts/ThemeContext";

const cloneCanvas = (canvas) => {
  const temp = document.createElement("canvas");
  temp.width = canvas.width;
  temp.height = canvas.height;
  temp.getContext("2d").drawImage(canvas, 0, 0);
  return temp;
};

const COLORS = [
  "black", "red", "blue", "green", "orange", "purple", "gray",
  "#FFD700", "#0C1844", "#F0F3F8", "#111426", "#FFB76B", "#4C9AFF"
];
const TOOLS = ["pen", "eraser", "rect", "circle", "line", ];

const DrawingCanvas = () => {
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const socketRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("black");
  const [lineWidth, setLineWidth] = useState(2);
  const [startPos, setStartPos] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const { roomId } = useParams();
  const { theme } = useTheme();

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
    // eslint-disable-next-line
  }, [roomId]);

  // Save canvas state for undo
  const pushUndo = () => {
    const canvas = canvasRef.current;
    const temp = document.createElement("canvas");
    temp.width = canvas.width;
    temp.height = canvas.height;
    temp.getContext("2d").drawImage(canvas, 0, 0);
    setUndoStack((stack) => [...stack, temp]);
    setRedoStack([]);
  };

  // Drawing functions
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
      socketRef.current.emit("draw", {
        type: "line",
        x0, y0, x1, y1, color, width, roomId
      });
    }
  };

  const drawRect = (x0, y0, x1, y1, color, width, emit = true) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

    if (emit) {
      socketRef.current.emit("draw", {
        type: "rect",
        x0, y0, x1, y1, color, width, roomId
      });
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
      socketRef.current.emit("draw", {
        type: "circle",
        x0, y0, x1, y1, color, width, roomId
      });
    }
  };

  const drawText = (x, y, text, color, emit = true) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle = color;
    ctx.font = "20px Inter, Poppins, sans-serif";
    ctx.fillText(text, x, y);

    if (emit) {
      socketRef.current.emit("draw", {
        type: "text",
        x, y, text, color, roomId
      });
    }
  };

  const erase = (x, y, width = 20, emit = true) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(x - width / 2, y - width / 2, width, width);

    if (emit) {
      socketRef.current.emit("draw", {
        type: "erase",
        x, y, width, roomId
      });
    }
  };

  // Remote draw handler
  const drawRemote = (data) => {
    switch (data.type) {
      case "line":
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.width, false);
        break;
      case "rect":
        drawRect(data.x0, data.y0, data.x1, data.y1, data.color, data.width, false);
        break;
      case "circle":
        drawCircle(data.x0, data.y0, data.x1, data.y1, data.color, data.width, false);
        break;
      case "text":
        drawText(data.x, data.y, data.text, data.color, false);
        break;
      case "erase":
        erase(data.x, data.y, data.width, false);
        break;
      default:
        break;
    }
  };

  // Sync canvas from image data
  const syncCanvas = (image) => {
    const ctx = canvasRef.current.getContext("2d");
    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = image;
  };

  // Preview drawing for shapes
  const drawPreview = (x0, y0, x1, y1, tool) => {
    const previewCtx = previewCanvasRef.current.getContext("2d");
    previewCtx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
    previewCtx.strokeStyle = color;
    previewCtx.lineWidth = lineWidth;
    previewCtx.globalAlpha = 0.5;

    if (tool === "rect") {
      previewCtx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    } else if (tool === "circle") {
      const radius = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
      previewCtx.beginPath();
      previewCtx.arc(x0, y0, radius, 0, 2 * Math.PI);
      previewCtx.stroke();
      previewCtx.closePath();
    } else if (tool === "line") {
      previewCtx.beginPath();
      previewCtx.moveTo(x0, y0);
      previewCtx.lineTo(x1, y1);
      previewCtx.stroke();
      previewCtx.closePath();
    }
    previewCtx.globalAlpha = 1.0;
  };

  // Mouse events
  const handleMouseDown = (e) => {
    if (tool !== "text") {
      pushUndo();
    }
    setDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });

    if (tool === "text") {
      setShowTextInput(true);
      setTextInput("");
    }
  };

  const handleMouseMove = (e) => {
    if (!drawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === "pen") {
      drawLine(startPos.x, startPos.y, x, y, color, lineWidth, true);
      setStartPos({ x, y });
    } else if (tool === "eraser") {
      erase(x, y, 20, true);
      setStartPos({ x, y });
    } else if (tool === "rect" || tool === "circle" || tool === "line") {
      drawPreview(startPos.x, startPos.y, x, y, tool);
    }
  };

  const handleMouseUp = (e) => {
    if (!drawing) return;
    setDrawing(false);

    if (tool === "text") {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Clear preview
    const previewCtx = previewCanvasRef.current.getContext("2d");
    previewCtx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);

    if (tool === "rect") {
      drawRect(startPos.x, startPos.y, x, y, color, lineWidth, true);
    } else if (tool === "circle") {
      drawCircle(startPos.x, startPos.y, x, y, color, lineWidth, true);
    } else if (tool === "line") {
      drawLine(startPos.x, startPos.y, x, y, color, lineWidth, true);
    }

    setStartPos(null);
  };

  // Text input handler
  const handleTextSubmit = () => {
    if (showTextInput && startPos && textInput.trim()) {
      pushUndo();
      drawText(startPos.x, startPos.y, textInput, color, true);
      // Sync canvas after text
      const image = canvasRef.current.toDataURL();
      socketRef.current.emit("syncCanvas", { roomId, image });
    }
    setShowTextInput(false);
    setTextInput("");
    setStartPos(null);
    setDrawing(false);
  };

  // Undo/Redo
const handleUndo = (emit = true) => {
  if (undoStack.length === 0) return;
  
  // Save current canvas state to redo stack
  const currentCanvas = cloneCanvas(canvasRef.current);
  setRedoStack((stack) => [...stack, currentCanvas]);
  
  // Get previous state
  const prev = undoStack[undoStack.length - 1];
  
  // Apply it to canvas
  const ctx = canvasRef.current.getContext("2d");
  ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  ctx.drawImage(prev, 0, 0);
  
  // Remove from undo stack
  setUndoStack((stack) => stack.slice(0, -1));
  
  if (emit) {
    // Use setTimeout to ensure canvas is fully rendered before getting data
    setTimeout(() => {
      const image = canvasRef.current.toDataURL();
      socketRef.current.emit("syncCanvas", { roomId, image });
    }, 0);
  }
};

const handleRedo = (emit = true) => {
  if (redoStack.length === 0) return;
  
  // Save current canvas state to undo stack
  const currentCanvas = cloneCanvas(canvasRef.current);
  setUndoStack((stack) => [...stack, currentCanvas]);
  
  // Get next state from redo stack
  const next = redoStack[redoStack.length - 1];
  
  // Apply it to canvas
  const ctx = canvasRef.current.getContext("2d");
  ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  ctx.drawImage(next, 0, 0);
  
  // Remove from redo stack
  setRedoStack((stack) => stack.slice(0, -1));
  
  if (emit) {
    // Use setTimeout to ensure canvas is fully rendered before getting data
    setTimeout(() => {
      const image = canvasRef.current.toDataURL();
      socketRef.current.emit("syncCanvas", { roomId, image });
    }, 0);
  }
};

  // Touch events for mobile
  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMouseDown({
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => {},
    });
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMouseMove({
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => {},
    });
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    handleMouseUp({
      clientX: 0,
      clientY: 0,
      preventDefault: () => {},
    });
  };

  // Clear canvas (local and remote)
  const clearCanvas = (emit = true) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    const previewCtx = previewCanvasRef.current.getContext("2d");
    previewCtx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
    setUndoStack([]);
    setRedoStack([]);
    if (emit) {
      socketRef.current.emit("clearCanvas", { roomId });
      // Also sync blank canvas
      const image = canvasRef.current.toDataURL();
      socketRef.current.emit("syncCanvas", { roomId, image });
    }
  };

  // Fix dropdown text color for theme
  const selectStyle = {
    background: theme.colors.surface,
    color: theme.colors.textPrimary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: "16px",
    outline: "none",
    marginRight: 8,
  };

  const buttonStyle = {
    background: theme.colors.surface,
    color: theme.colors.textPrimary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 4,
    padding: "4px 12px",
    fontSize: "14px",
    cursor: "pointer",
  };

  return (
    <div style={{ width: 620, margin: "20px auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <select value={tool} onChange={e => setTool(e.target.value)} style={selectStyle}>
          {TOOLS.map(t => (
            <option key={t} value={t} style={{ color: theme.colors.textPrimary, background: theme.colors.surface }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <select value={color} onChange={e => setColor(e.target.value)} style={selectStyle}>
          {COLORS.map(c => (
            <option key={c} value={c} style={{ color: c, background: theme.colors.surface }}>
              {c.charAt(0) === "#" ? c : c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
        <input
          type="range"
          min={1}
          max={10}
          value={lineWidth}
          onChange={e => setLineWidth(Number(e.target.value))}
          style={{ width: 80 }}
        />
        <button onClick={() => handleUndo(true)} disabled={undoStack.length === 0} style={buttonStyle}>Undo</button>
        <button onClick={() => handleRedo(true)} disabled={redoStack.length === 0} style={buttonStyle}>Redo</button>
        <button onClick={() => clearCanvas(true)} style={buttonStyle}>Clear</button>
      </div>
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          style={{ 
            border: "2px solid #222", 
            background: "#fff", 
            borderRadius: "12px",
            position: "absolute",
            top: 0,
            left: 0
          }}
        />
        <canvas
          ref={previewCanvasRef}
          width={600}
          height={400}
          style={{ 
            border: "2px solid #222", 
            borderRadius: "12px",
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none"
          }}
        />
        <div
          style={{
            width: 600,
            height: 400,
            position: "relative",
            cursor: "crosshair"
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        {showTextInput && startPos && (
          <div
            style={{
              position: "absolute",
              left: startPos.x,
              top: startPos.y,
              zIndex: 10,
            }}
          >
            <input
              type="text"
              autoFocus
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              style={{
                fontSize: 20,
                border: "2px solid #222",
                borderRadius: 4,
                padding: 4,
                background: "#fff",
                color: "#000",
                minWidth: "200px"
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  handleTextSubmit();
                } else if (e.key === "Escape") {
                  setShowTextInput(false);
                  setTextInput("");
                  setStartPos(null);
                  setDrawing(false);
                }
              }}
              onBlur={handleTextSubmit}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawingCanvas;