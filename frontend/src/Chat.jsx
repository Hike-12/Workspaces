import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaVideo,
  FaMicrophone,
  FaMicrophoneSlash,
  FaDesktop,
  FaPhone,
  FaPhoneSlash,
  FaVideoSlash,
  FaSignOutAlt,
  FaFileUpload,
  FaPaperPlane,
  FaExpand,
  FaTimes,
  FaUserCircle,
  FaMoon,
  FaSun
} from "react-icons/fa";
import { API_ENDPOINTS, SOCKET_URL } from "./lib/utils";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useVideoCall } from "./hooks/useVideoCall";
import { useTheme } from "./contexts/ThemeContext";

const Chat = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const userName = localStorage.getItem("userName");
  const userId = localStorage.getItem("userId");
  const roomName = localStorage.getItem("roomName");

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [roomData, setRoomData] = useState(null);

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // Use video call hook
  const {
    isVideoCallActive,
    remoteUserIds,
    remoteUsers,
    isCameraEnabled,
    isScreenSharing,
    isMicEnabled,
    isFullScreen,
    fullScreenVideoSrc,
    localVideoRef,
    remoteVideoRefs,
    startVideoCall,
    endVideoCall,
    toggleCamera,
    toggleMic,
    toggleScreenShare,
    handleVideoClick,
    closeFullScreen,
  } = useVideoCall({ socketRef, roomId, userId, userName });

  // Redirect if no user data
  useEffect(() => {
    if (!userName || !roomId || !userId) {
      navigate('/');
      return;
    }
  }, [userName, roomId, userId, navigate]);

  const leaveRoom = async () => {
    try {
      await fetch(`${API_ENDPOINTS.NODE_BASE_URL}/api/rooms/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roomId, userId })
      });
    } catch (error) {
      console.error('Error leaving room:', error);
    }
    localStorage.removeItem("userName");
    localStorage.removeItem("roomId");
    localStorage.removeItem("roomName");
    navigate('/');
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit("joinRoom", { room_id: roomId, user_id: userId, user_name: userName });

    socketRef.current.on("receiveMessage", (data) => {
      setMessages((prev) => [...prev, data]);
      if (data.userId !== userId) {
        toast.info(`New message from ${data.userName}`, { autoClose: 2000 });
      }
    });

    socketRef.current.on("error", (data) => {
      toast.error(data.message);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [roomId, userId, userName]);

  // Fetch initial messages and room data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const messagesResponse = await fetch(`${API_ENDPOINTS.GET_MESSAGES}?room_id=${roomId}`);
        const messagesData = await messagesResponse.json();
        setMessages(messagesData);

        const roomResponse = await fetch(API_ENDPOINTS.GET_ROOM(roomId));
        const roomData = await roomResponse.json();
        setRoomData(roomData.room);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load room data");
      }
    };
    fetchData();
  }, [roomId]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    const newMessage = {
      room_id: roomId,
      sender: userName,
      content: message,
      userName: userName,
      userId: userId
    };

    socketRef.current.emit("sendMessage", {
      room_id: roomId,
      message,
      sender: userName,
      userName: userName,
      userId: userId
    });

    try {
      await fetch(API_ENDPOINTS.SEND_MESSAGE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMessage),
      });
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: theme.colors.background,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      <ToastContainer position="top-right" theme={theme.name === 'dark' ? 'dark' : 'light'} />

      {/* Header */}
      <div
        className="border-b flex items-center justify-between px-4 py-2"
        style={{
          background: theme.colors.surface,
          borderColor: theme.colors.border,
          boxShadow: theme.colors.shadow,
        }}
      >
        <div className="flex items-center gap-3">
          <FaVideo className="h-6 w-6 text-white bg-blue-500 rounded-lg p-1" />
          <div>
            <h1
              className="text-lg font-bold"
              style={{
                color: theme.colors.textPrimary,
                fontWeight: theme.typography.headingWeight,
              }}
            >
              {roomName || "Chat Room"}
            </h1>
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: theme.colors.success }}
              />
              <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                {roomData?.participants?.length || 0} online
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border"
            style={{
              background: theme.colors.surface,
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
            }}
            title="Toggle theme"
          >
            {theme.name === "dark" ? <FaSun /> : <FaMoon />}
          </button>
          {!isVideoCallActive ? (
            <button
              onClick={startVideoCall}
              className="px-3 py-2 rounded-lg font-semibold flex items-center gap-2"
              style={{
                background: theme.colors.accentCool,
                color: "white",
                boxShadow: theme.colors.shadow,
                fontSize: "14px"
              }}
            >
              <FaPhone />
              <span className="hidden sm:inline">Call</span>
            </button>
          ) : (
            <button
              onClick={endVideoCall}
              className="px-3 py-2 rounded-lg font-semibold flex items-center gap-2"
              style={{
                background: theme.colors.error,
                color: "white",
                boxShadow: theme.colors.shadow,
                fontSize: "14px"
              }}
            >
              <FaPhoneSlash />
              <span className="hidden sm:inline">End</span>
            </button>
          )}
          <button
            onClick={() => navigate(`/room/${roomId}/files`)}
            className="px-3 py-2 rounded-lg font-semibold flex items-center gap-2"
            style={{
              background: theme.colors.surface,
              color: theme.colors.textPrimary,
              border: `1px solid ${theme.colors.border}`,
              fontSize: "14px"
            }}
          >
            <FaFileUpload />
            <span className="hidden sm:inline">Files</span>
          </button>
          <button
            onClick={leaveRoom}
            className="px-3 py-2 rounded-lg font-semibold flex items-center gap-2"
            style={{
              background: "transparent",
              color: theme.colors.error,
              border: `1px solid ${theme.colors.error}`,
              fontSize: "14px"
            }}
          >
            <FaSignOutAlt />
            <span className="hidden md:inline">Leave</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Video Call Area */}
        {isVideoCallActive && (
          <div
            className="w-full lg:w-2/3 px-4 py-3 border-b lg:border-b-0 lg:border-r"
            style={{
              background: theme.colors.background,
              borderColor: theme.colors.border,
            }}
          >
            {/* Video Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-[calc(100%-56px)] overflow-y-auto">
              {/* Local Video */}
              <div
                className="relative rounded-xl overflow-hidden transition-transform hover:scale-[1.01] cursor-pointer group"
                style={{
                  background: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`,
                  boxShadow: theme.colors.shadow,
                }}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  onClick={() => handleVideoClick(localVideoRef.current)}
                />
                <div className="absolute top-2 left-2 px-2 py-1 rounded bg-opacity-80"
                  style={{
                    background: theme.colors.surface,
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: theme.colors.textPrimary }}>
                    You {isScreenSharing ? '(Screen)' : ''}
                  </span>
                </div>
                <button
                  onClick={() => handleVideoClick(localVideoRef.current)}
                  className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: theme.colors.surface,
                  }}
                >
                  <FaExpand style={{ color: theme.colors.textPrimary }} />
                </button>
              </div>

              {/* Remote Videos */}
              {remoteUserIds.filter(id => id !== userId).map((remoteUserId) => (
                <div
                  key={remoteUserId}
                  className="relative rounded-xl overflow-hidden transition-transform hover:scale-[1.01] cursor-pointer group"
                  style={{
                    background: theme.colors.surface,
                    border: `1px solid ${theme.colors.border}`,
                    boxShadow: theme.colors.shadow,
                  }}
                >
                  <video
                    ref={el => remoteVideoRefs.current[remoteUserId] = el}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    onClick={() => handleVideoClick(remoteVideoRefs.current[remoteUserId])}
                  />
                  <div className="absolute top-2 left-2 px-2 py-1 rounded bg-opacity-80"
                    style={{
                      background: theme.colors.surface,
                    }}
                  >
                    <span className="text-xs font-semibold flex items-center gap-1" style={{ color: theme.colors.textPrimary }}>
                      <FaUserCircle />
                      <span>{remoteUsers[remoteUserId] || remoteUserId}</span>
                    </span>
                  </div>
                  <button
                    onClick={() => handleVideoClick(remoteVideoRefs.current[remoteUserId])}
                    className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      background: theme.colors.surface,
                    }}
                  >
                    <FaExpand style={{ color: theme.colors.textPrimary }} />
                  </button>
                </div>
              ))}
            </div>
            {/* Video Controls - below video grid */}
            <div className="flex justify-center gap-3 mt-3">
              <button
                onClick={toggleMic}
                className="p-2 rounded-full transition-all duration-200"
                style={{
                  background: isMicEnabled ? theme.colors.accentCool : theme.colors.error,
                  color: "white",
                  boxShadow: theme.colors.shadow,
                }}
                title={isMicEnabled ? "Mute Mic" : "Unmute Mic"}
              >
                {isMicEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
              </button>
              <button
                onClick={toggleCamera}
                className="p-2 rounded-full transition-all duration-200"
                style={{
                  background: isCameraEnabled ? theme.colors.accentCool : theme.colors.error,
                  color: "white",
                  boxShadow: theme.colors.shadow,
                }}
                title={isCameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
              >
                {isCameraEnabled ? <FaVideo /> : <FaVideoSlash />}
              </button>
              <button
                onClick={toggleScreenShare}
                className="p-2 rounded-full transition-all duration-200"
                style={{
                  background: isScreenSharing ? theme.colors.accentWarm : theme.colors.surface,
                  color: isScreenSharing ? "white" : theme.colors.textPrimary,
                  border: `1px solid ${theme.colors.border}`,
                  boxShadow: theme.colors.shadow,
                }}
                title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
              >
                <FaDesktop />
              </button>
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className={`${isVideoCallActive ? 'w-full lg:w-1/3' : 'w-full'} flex flex-col`}>
          {/* Messages */}
          <div className="flex-1 px-4 py-3 overflow-y-auto">
            <div className="space-y-3">
              {messages.map((msg, index) => (
                <div
                  key={msg._id || index}
                  className={`flex ${msg.userId === userId ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-xs lg:max-w-md px-3 py-2 rounded-xl"
                    style={{
                      background: msg.userId === userId
                        ? theme.colors.accentCool
                        : theme.colors.surface,
                      color: msg.userId === userId ? "white" : theme.colors.textPrimary,
                      boxShadow: theme.colors.shadow,
                    }}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold opacity-80">
                        {msg.userName || msg.sender}
                      </span>
                      <span className="text-xs opacity-60 ml-2">
                        {formatTime(msg.timestamp || msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Message Input */}
          <div
            className="px-4 py-2 border-t"
            style={{
              background: theme.colors.surface,
              borderColor: theme.colors.border,
            }}
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 px-3 py-2 rounded-lg transition-all duration-200"
                style={{
                  background: theme.colors.inputBackground,
                  color: theme.colors.textPrimary,
                  border: `1px solid ${theme.colors.border}`,
                  fontSize: "15px"
                }}
                placeholder="Type a message..."
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200"
                style={{
                  background: theme.colors.accentCool,
                  color: "white",
                  boxShadow: theme.colors.shadow,
                  fontSize: "15px"
                }}
              >
                <FaPaperPlane />
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Video Modal */}
      {isFullScreen && fullScreenVideoSrc && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50">
          <button
            onClick={closeFullScreen}
            className="absolute top-4 right-4 p-3 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all"
          >
            <FaTimes className="text-white text-xl" />
          </button>
          {fullScreenVideoSrc instanceof MediaStream ? (
            <video
              ref={el => {
                if (el && fullScreenVideoSrc) el.srcObject = fullScreenVideoSrc;
              }}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              src={fullScreenVideoSrc}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Chat;