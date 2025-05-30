import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "./lib/utils";
import { Users, Video, MessageCircle, Upload } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { v4 as uuidv4 } from 'uuid';

const COLORS = {
  bg: "#0C1844",         // main background (navy)
  card: "#FFF5E1",       // card/panel (cream)
  border: "#0C1844",     // border (navy)
  accent: "#0C1844",     // primary accent (navy)
  accent2: "#FFF5E1",    // secondary accent (cream)
  text: "#0C1844",       // main text (navy on cream)
  textLight: "#FFF5E1",  // light text (cream on navy)
  muted: "#0C1844",      // muted text (navy)
};

const Home = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    userName: "",
    roomName: "",
    password: "",
    description: ""
  });
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Ensure userId exists in localStorage
  React.useEffect(() => {
    if (!localStorage.getItem("userId")) {
      localStorage.setItem("userId", uuidv4());
    }
  }, []);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const createRoom = async (e) => {
    e.preventDefault();
    if (!formData.userName || !formData.roomName || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const userId = localStorage.getItem("userId");
      const response = await fetch(API_ENDPOINTS.CREATE_ROOM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...formData, userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      localStorage.setItem("userName", formData.userName);
      localStorage.setItem("roomId", data.room.id);
      localStorage.setItem("roomName", data.room.name);
      
      toast.success("Room created successfully!");
      navigate(`/room/${data.room.id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    if (!formData.userName || !formData.roomName || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const userId = localStorage.getItem("userId");
      const response = await fetch(API_ENDPOINTS.JOIN_ROOM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...formData, userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      localStorage.setItem("userName", formData.userName);
      localStorage.setItem("roomId", data.room.id);
      localStorage.setItem("roomName", data.room.name);
      
      toast.success("Joined room successfully!");
      navigate(`/room/${data.room.id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6"
      style={{
        background: COLORS.bg,
      }}
    >
      <ToastContainer position="top-right" theme="dark" />
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                background: COLORS.card,
                border: `2px solid ${COLORS.border}`,
              }}
            >
              <Video className="h-8 w-8" style={{ color: COLORS.accent }} />
            </div>
          </div>
          <h1
            className="text-4xl font-bold mb-3"
            style={{
              color: COLORS.textLight,
              letterSpacing: "-0.02em",
            }}
          >
            VideoPulse
          </h1>
          <p className="text-lg" style={{ color: COLORS.accent2 }}>
            Connect, chat, and collaborate in real-time
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center p-4 rounded-xl" style={{ background: "rgba(255, 245, 225, 0.1)" }}>
            <Video className="h-8 w-8 mx-auto mb-2" style={{ color: COLORS.accent2 }} />
            <p className="text-sm font-medium" style={{ color: COLORS.textLight }}>Video Chat</p>
          </div>
          <div className="text-center p-4 rounded-xl" style={{ background: "rgba(255, 245, 225, 0.1)" }}>
            <MessageCircle className="h-8 w-8 mx-auto mb-2" style={{ color: COLORS.accent2 }} />
            <p className="text-sm font-medium" style={{ color: COLORS.textLight }}>Real-time Chat</p>
          </div>
          <div className="text-center p-4 rounded-xl" style={{ background: "rgba(255, 245, 225, 0.1)" }}>
            <Upload className="h-8 w-8 mx-auto mb-2" style={{ color: COLORS.accent2 }} />
            <p className="text-sm font-medium" style={{ color: COLORS.textLight }}>File Sharing</p>
          </div>
        </div>

        {/* Form */}
        <div
          className="rounded-2xl p-8 shadow-xl"
          style={{
            background: COLORS.card,
            border: `1px solid rgba(12, 24, 68, 0.1)`,
          }}
        >
          <div className="flex mb-6 gap-2 p-1 rounded-xl" style={{ background: "rgba(12, 24, 68, 0.05)" }}>
            <button
              onClick={() => setIsCreating(false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200`}
              style={{
                background: !isCreating ? COLORS.accent : "transparent",
                color: !isCreating ? COLORS.textLight : COLORS.text,
              }}
            >
              Join Room
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200`}
              style={{
                background: isCreating ? COLORS.accent : "transparent",
                color: isCreating ? COLORS.textLight : COLORS.text,
              }}
            >
              Create Room
            </button>
          </div>

          <form onSubmit={isCreating ? createRoom : joinRoom} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: COLORS.text }}>
                Your Name *
              </label>
              <input
                type="text"
                name="userName"
                value={formData.userName}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-200"
                style={{
                  background: "rgba(12, 24, 68, 0.02)",
                  color: COLORS.text,
                  border: `1px solid rgba(12, 24, 68, 0.2)`,
                }}
                placeholder="Enter your name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: COLORS.text }}>
                Room Name *
              </label>
              <input
                type="text"
                name="roomName"
                value={formData.roomName}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-200"
                style={{
                  background: "rgba(12, 24, 68, 0.02)",
                  color: COLORS.text,
                  border: `1px solid rgba(12, 24, 68, 0.2)`,
                }}
                placeholder="Enter room name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: COLORS.text }}>
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-200"
                style={{
                  background: "rgba(12, 24, 68, 0.02)",
                  color: COLORS.text,
                  border: `1px solid rgba(12, 24, 68, 0.2)`,
                }}
                placeholder="Enter room password"
                required
              />
            </div>
            {isCreating && (
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: COLORS.text }}>
                  Description (Optional)
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border resize-none transition-all duration-200 focus:ring-2 focus:ring-blue-200"
                  style={{
                    background: "rgba(12, 24, 68, 0.02)",
                    color: COLORS.text,
                    border: `1px solid rgba(12, 24, 68, 0.2)`,
                  }}
                  placeholder="Room description"
                  rows="3"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-lg font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-xl"
              style={{
                background: COLORS.accent,
                color: COLORS.textLight,
              }}
            >
              {loading ? (
                "Processing..."
              ) : (
                <>
                  <Users className="w-5 h-5 mr-2" />
                  {isCreating ? "Create Room" : "Join Room"}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Home;