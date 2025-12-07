import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS, cn } from "./lib/utils";
import { Users, Video, MessageCircle, Upload, Moon, Sun, ArrowRight, LayoutGrid, ShieldCheck } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { v4 as uuidv4 } from "uuid";
import { useTheme } from "./contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";

const Home = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }
  };

  return (
    <div className="min-h-screen w-full bg-bg-canvas text-fg-primary font-sans selection:bg-accent-brand selection:text-white overflow-x-hidden">
      <ToastContainer position="top-right" theme={theme} />
      
      {/* Navbar */}
      <nav className="w-full px-6 py-6 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-accent-brand rounded-lg flex items-center justify-center text-white">
            <LayoutGrid size={18} />
          </div>
          <span className="font-serif text-xl font-bold tracking-tight">Workspaces</span>
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-bg-surface border border-transparent hover:border-border-subtle transition-all duration-200"
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 lg:py-20 grid lg:grid-cols-12 gap-12 items-start">
        
        {/* Left Column: Hero & Bento Grid */}
        <motion.div 
          className="lg:col-span-7 flex flex-col gap-8"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={itemVariants}>
            <h1 className="font-serif text-5xl lg:text-7xl font-medium leading-[1.1] mb-6">
              Collaborate <br/>
              <span className="text-fg-secondary">without limits.</span>
            </h1>
            <p className="text-lg text-fg-secondary max-w-md leading-relaxed">
              A unified workspace for video conferencing, real-time chat, and file sharing. Designed for humans, built for speed.
            </p>
          </motion.div>

          {/* Bento Grid */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full"
            variants={itemVariants}
          >
            <div className="bg-bg-surface border border-border-subtle p-6 rounded-3xl flex flex-col gap-4 hover:shadow-lg transition-shadow duration-300">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Video size={20} />
              </div>
              <div>
                <h3 className="font-serif text-xl font-medium mb-1">HD Video</h3>
                <p className="text-sm text-fg-secondary">Crystal clear video calls with low latency.</p>
              </div>
            </div>

            <div className="bg-bg-surface border border-border-subtle p-6 rounded-3xl flex flex-col gap-4 hover:shadow-lg transition-shadow duration-300">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                <MessageCircle size={20} />
              </div>
              <div>
                <h3 className="font-serif text-xl font-medium mb-1">Live Chat</h3>
                <p className="text-sm text-fg-secondary">Instant messaging with rich text support.</p>
              </div>
            </div>

            <div className="md:col-span-2 bg-bg-surface border border-border-subtle p-6 rounded-3xl flex flex-row items-center gap-6 hover:shadow-lg transition-shadow duration-300">
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                <Upload size={24} />
              </div>
              <div>
                <h3 className="font-serif text-xl font-medium mb-1">Secure File Sharing</h3>
                <p className="text-sm text-fg-secondary">Share documents and media securely within your room.</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Column: Auth Form */}
        <motion.div 
          className="lg:col-span-5 w-full"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <div className="bg-bg-surface border border-border-subtle rounded-[2rem] p-8 shadow-xl shadow-black/5">
            
            {/* Tabs */}
            <div className="flex p-1 bg-bg-canvas rounded-xl mb-8">
              <button
                onClick={() => setIsCreating(false)}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                  !isCreating ? "bg-bg-surface text-fg-primary shadow-sm" : "text-fg-secondary hover:text-fg-primary"
                )}
              >
                Join Room
              </button>
              <button
                onClick={() => setIsCreating(true)}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                  isCreating ? "bg-bg-surface text-fg-primary shadow-sm" : "text-fg-secondary hover:text-fg-primary"
                )}
              >
                Create Room
              </button>
            </div>

            <form onSubmit={isCreating ? createRoom : joinRoom} className="flex flex-col gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-fg-secondary ml-1">Display Name</label>
                <input
                  type="text"
                  name="userName"
                  value={formData.userName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl bg-bg-canvas border border-border-subtle focus:border-accent-brand focus:ring-2 focus:ring-accent-brand/20 outline-none transition-all duration-200"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-fg-secondary ml-1">Room Name</label>
                <input
                  type="text"
                  name="roomName"
                  value={formData.roomName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl bg-bg-canvas border border-border-subtle focus:border-accent-brand focus:ring-2 focus:ring-accent-brand/20 outline-none transition-all duration-200"
                  placeholder="Project Alpha"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-fg-secondary ml-1">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl bg-bg-canvas border border-border-subtle focus:border-accent-brand focus:ring-2 focus:ring-accent-brand/20 outline-none transition-all duration-200"
                    placeholder="••••••••"
                    required
                  />
                  <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-secondary/50" size={18} />
                </div>
              </div>

              <AnimatePresence>
                {isCreating && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5 pt-1">
                      <label className="text-sm font-medium text-fg-secondary ml-1">Description</label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-xl bg-bg-canvas border border-border-subtle focus:border-accent-brand focus:ring-2 focus:ring-accent-brand/20 outline-none transition-all duration-200 resize-none"
                        placeholder="What's this room about?"
                        rows="3"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="mt-2 w-full py-3.5 rounded-xl bg-accent-brand text-white font-medium shadow-lg shadow-accent-brand/25 hover:shadow-xl hover:shadow-accent-brand/30 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  "Processing..."
                ) : (
                  <>
                    {isCreating ? "Create Workspace" : "Join Workspace"}
                    <ArrowRight size={18} />
                  </>
                )}
              </motion.button>
            </form>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Home;