import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "./lib/utils";
import { Users, Video, MessageCircle, Upload,Moon,Sun } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { v4 as uuidv4 } from "uuid";
import { useTheme } from "./contexts/ThemeContext";

const Home = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // Chat theme design principles
  const colors = theme.colors || {
    background: theme.name === "dark" ? "bg-neutral-900" : "bg-neutral-50",
    surface: theme.name === "dark" ? "bg-neutral-800" : "bg-white",
    accent: theme.name === "dark" ? "bg-yellow-900" : "bg-yellow-100",
    text: theme.name === "dark" ? "text-neutral-100" : "text-neutral-800",
    border: theme.name === "dark" ? "border-neutral-700" : "border-neutral-200",
    primary: theme.name === "dark" ? "text-yellow-400" : "text-yellow-700",
    secondary: theme.name === "dark" ? "bg-yellow-900" : "bg-yellow-50",
    icon: theme.name === "dark" ? "text-yellow-400" : "text-yellow-700",
    input: theme.name === "dark" ? "bg-neutral-800" : "bg-neutral-100",
  };

  const [formData, setFormData] = useState({
    userName: "",
    roomName: "",
    password: "",
    description: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("userId")) {
      localStorage.setItem("userId", uuidv4());
    }
  }, []);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, userId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, userId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
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
    <div className={`min-h-screen w-full flex flex-col items-center justify-center ${colors.background} ${colors.text} font-inter`}>
      <ToastContainer position="top-right" theme={theme.name === "dark" ? "dark" : "light"} />
      <div className={`w-full max-w-2xl mx-auto my-8 rounded-3xl shadow-lg ${colors.surface} px-8 py-8 flex flex-col gap-8`}>
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg mb-6 ${colors.input}`}>
            <Video className={`h-8 w-8 ${colors.icon}`} />
          </div>
          <h1 className={`text-4xl font-bold mb-3 ${colors.primary}`}>Focal Point</h1>
          <p className={`text-lg ${colors.text}`}>Connect, chat, and collaborate in real-time</p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className={`text-center p-4 rounded-xl ${colors.input}`}>
            <Video className={`h-8 w-8 mx-auto mb-2 ${colors.icon}`} />
            <p className={`text-sm font-medium ${colors.primary}`}>Video Chat</p>
          </div>
          <div className={`text-center p-4 rounded-xl ${colors.input}`}>
            <MessageCircle className={`h-8 w-8 mx-auto mb-2 ${colors.icon}`} />
            <p className={`text-sm font-medium ${colors.primary}`}>Real-time Chat</p>
          </div>
          <div className={`text-center p-4 rounded-xl ${colors.input}`}>
            <Upload className={`h-8 w-8 mx-auto mb-2 ${colors.icon}`} />
            <p className={`text-sm font-medium ${colors.primary}`}>File Sharing</p>
          </div>
        </div>

        {/* Form */}
        <div className={`rounded-2xl p-8 shadow-xl ${colors.surface} border ${colors.border}`}>
          <div className={`flex mb-6 gap-2 p-1 rounded-xl ${colors.input}`}>
            <button
              onClick={() => setIsCreating(false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200`}
              style={{
                background: !isCreating ? theme.name === "dark" ? "#FFD700" : "#0C1844" : "transparent",
                color: !isCreating ? theme.name === "dark" ? "#0C1844" : "#FFF5E1" : "",
              }}
            >
              Join Room
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200`}
              style={{
                background: isCreating ? theme.name === "dark" ? "#FFD700" : "#0C1844" : "transparent",
                color: isCreating ? theme.name === "dark" ? "#0C1844" : "#FFF5E1" : "",
              }}
            >
              Create Room
            </button>
            <button
              title="Toggle Theme"
              onClick={toggleTheme}
              className={`ml-2 rounded-lg p-2 flex items-center border-none ${colors.input}`}
            >
              {theme.name === "dark" ? (
                <Sun size={22} className={colors.icon} />
              ) : (
                <Moon size={22} className={colors.icon} />
              )}
            </button>
          </div>

          <form onSubmit={isCreating ? createRoom : joinRoom} className="space-y-5">
            <div>
              <label className={`block text-sm font-semibold mb-2 ${colors.text}`}>Your Name *</label>
              <input
                type="text"
                name="userName"
                value={formData.userName}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-yellow-200 ${colors.input} ${colors.text} ${colors.border}`}
                placeholder="Enter your name"
                required
              />
            </div>
            <div>
              <label className={`block text-sm font-semibold mb-2 ${colors.text}`}>Room Name *</label>
              <input
                type="text"
                name="roomName"
                value={formData.roomName}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-yellow-200 ${colors.input} ${colors.text} ${colors.border}`}
                placeholder="Enter room name"
                required
              />
            </div>
            <div>
              <label className={`block text-sm font-semibold mb-2 ${colors.text}`}>Password *</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-yellow-200 ${colors.input} ${colors.text} ${colors.border}`}
                placeholder="Enter room password"
                required
              />
            </div>
            {isCreating && (
              <div>
                <label className={`block text-sm font-semibold mb-2 ${colors.text}`}>Description (Optional)</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 rounded-lg border resize-none transition-all duration-200 focus:ring-2 focus:ring-yellow-200 ${colors.input} ${colors.text} ${colors.border}`}
                  placeholder="Room description"
                  rows="3"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-lg font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-xl ${colors.primary} ${theme.name === "dark" ? "bg-yellow-700 text-white" : "bg-yellow-700 text-white"}`}
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