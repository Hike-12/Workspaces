import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "./lib/utils";
import { Users, Video, MessageCircle, Upload } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
      const response = await fetch(API_ENDPOINTS.CREATE_ROOM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
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
      const response = await fetch(API_ENDPOINTS.JOIN_ROOM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
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
    <div className="bg-gradient-to-br from-[#030718] via-[#0A1428] to-[#0F2E6B] min-h-screen flex items-center justify-center p-6">
      <ToastContainer position="top-right" theme="dark" />
      
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Video className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-indigo-100 mb-2">
            VideoPulse
          </h1>
          <p className="text-blue-100/70">
            Connect, chat, and collaborate in real-time
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <Video className="h-8 w-8 text-blue-400 mx-auto mb-2" />
            <p className="text-xs text-blue-100/70">Video Chat</p>
          </div>
          <div className="text-center">
            <MessageCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-xs text-blue-100/70">Real-time Chat</p>
          </div>
          <div className="text-center">
            <Upload className="h-8 w-8 text-purple-400 mx-auto mb-2" />
            <p className="text-xs text-blue-100/70">File Sharing</p>
          </div>
        </div>

        {/* Form */}
        <div className="backdrop-blur-md bg-white/5 border border-blue-500/20 rounded-xl p-6">
          <div className="flex mb-6">
            <button
              onClick={() => setIsCreating(false)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                !isCreating
                  ? "bg-blue-500 text-white"
                  : "bg-transparent text-blue-100/70 hover:text-blue-100"
              }`}
            >
              Join Room
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                isCreating
                  ? "bg-blue-500 text-white"
                  : "bg-transparent text-blue-100/70 hover:text-blue-100"
              }`}
            >
              Create Room
            </button>
          </div>

          <form onSubmit={isCreating ? createRoom : joinRoom} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-100/80 mb-1">
                Your Name *
              </label>
              <input
                type="text"
                name="userName"
                value={formData.userName}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-blue-500/30 text-blue-100 placeholder-blue-100/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Enter your name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-100/80 mb-1">
                Room Name *
              </label>
              <input
                type="text"
                name="roomName"
                value={formData.roomName}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-blue-500/30 text-blue-100 placeholder-blue-100/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Enter room name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-100/80 mb-1">
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-blue-500/30 text-blue-100 placeholder-blue-100/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Enter room password"
                required
              />
            </div>

            {isCreating && (
              <div>
                <label className="block text-sm font-medium text-blue-100/80 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-blue-500/30 text-blue-100 placeholder-blue-100/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                  placeholder="Room description"
                  rows="3"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-medium hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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