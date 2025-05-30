import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "./lib/utils";
import { Users, Video, MessageCircle, Upload } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { v4 as uuidv4 } from 'uuid';

// Minimal color palette
const COLORS = {
  bg: "#F7FAFC",
  card: "#FFFFFF",
  border: "#E5E7EB",
  accent: "#03346E",
  accent2: "#6EACDA",
  text: "#021526",
  muted: "#6B7280",
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
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: COLORS.bg,
      }}
    >
      <ToastContainer position="top-right" theme="light" />
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div
              className="h-14 w-14 rounded-xl flex items-center justify-center border"
              style={{
                background: COLORS.card,
                borderColor: COLORS.border,
              }}
            >
              <Video className="h-7 w-7" style={{ color: COLORS.accent }} />
            </div>
          </div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{
              color: COLORS.accent,
              letterSpacing: "-0.02em",
            }}
          >
            VideoPulse
          </h1>
          <p className="text-base" style={{ color: COLORS.muted }}>
            Connect, chat, and collaborate in real-time
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <Video className="h-7 w-7 mx-auto mb-1" style={{ color: COLORS.accent2 }} />
            <p className="text-xs" style={{ color: COLORS.muted }}>Video Chat</p>
          </div>
          <div className="text-center">
            <MessageCircle className="h-7 w-7 mx-auto mb-1" style={{ color: "#7be495" }} />
            <p className="text-xs" style={{ color: COLORS.muted }}>Real-time Chat</p>
          </div>
          <div className="text-center">
            <Upload className="h-7 w-7 mx-auto mb-1" style={{ color: COLORS.accent }} />
            <p className="text-xs" style={{ color: COLORS.muted }}>File Sharing</p>
          </div>
        </div>

        {/* Form */}
        <div
          className="rounded-xl p-6 border shadow-sm"
          style={{
            background: COLORS.card,
            borderColor: COLORS.border,
          }}
        >
          <div className="flex mb-5 gap-2">
            <button
              onClick={() => setIsCreating(false)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 border ${
                !isCreating
                  ? "bg-[#03346E] text-white border-[#03346E]"
                  : "bg-white text-[#03346E] border-[#E5E7EB]"
              }`}
            >
              Join Room
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 border ${
                isCreating
                  ? "bg-[#03346E] text-white border-[#03346E]"
                  : "bg-white text-[#03346E] border-[#E5E7EB]"
              }`}
            >
              Create Room
            </button>
          </div>

          <form onSubmit={isCreating ? createRoom : joinRoom} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: COLORS.text }}>
                Your Name *
              </label>
              <input
                type="text"
                name="userName"
                value={formData.userName}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg border bg-white text-[#021526] border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#03346E] transition-all"
                placeholder="Enter your name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: COLORS.text }}>
                Room Name *
              </label>
              <input
                type="text"
                name="roomName"
                value={formData.roomName}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg border bg-white text-[#021526] border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#03346E] transition-all"
                placeholder="Enter room name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: COLORS.text }}>
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg border bg-white text-[#021526] border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#03346E] transition-all"
                placeholder="Enter room password"
                required
              />
            </div>
            {isCreating && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: COLORS.text }}>
                  Description (Optional)
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 rounded-lg border bg-white text-[#021526] border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#03346E] transition-all resize-none"
                  placeholder="Room description"
                  rows="3"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg font-semibold bg-[#03346E] text-white hover:bg-[#021526] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              style={{
                letterSpacing: "0.01em",
              }}
            >
              {loading ? (
                "Processing..."
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
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