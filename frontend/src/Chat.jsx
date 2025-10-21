import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import { API_ENDPOINTS, SOCKET_URL } from "./lib/utils";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTheme } from "./contexts/ThemeContext";
import {
  FiSend,
  FiLogOut,
  FiVideo,
  FiVideoOff,
  FiMic,
  FiMicOff,
  FiSun,
  FiMoon,
  FiUsers,
  FiFileText,
  FiMonitor,
  FiX,
  FiUser,
} from "react-icons/fi";
import DrawingCanvas from "./DrawingCanvas";

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

  // Video call states
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [remoteUserIds, setRemoteUserIds] = useState([]);
  const [remoteUsers, setRemoteUsers] = useState({});
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fullScreenVideoSrc, setFullScreenVideoSrc] = useState(null);

  // Refs
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnections = useRef({});
  const remoteVideoRefs = useRef({});
  const isVideoCallActiveRef = useRef(false);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- SOCKET & WEBRTC LOGIC ---
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

    // --- Video Call Events ---
    socketRef.current.on("userJoined", ({ userId: remoteUserId, userName: remoteUserName }) => {
      setRemoteUserIds(prev => prev.includes(remoteUserId) ? prev : [...prev, remoteUserId]);
      setRemoteUsers(prev => ({ ...prev, [remoteUserId]: remoteUserName }));

      setTimeout(() => {
        if (isVideoCallActiveRef.current && localStreamRef.current) {
          handleUserJoined(remoteUserId);
        }
      }, 100);

      toast.info(`${remoteUserName || remoteUserId} joined the call or room`);
    });

    socketRef.current.on("userLeft", ({ userId: remoteUserId, userName: remoteUserName }) => {
      setRemoteUserIds(prev => prev.filter(id => id !== remoteUserId));
      setRemoteUsers(prev => {
        const updated = { ...prev };
        delete updated[remoteUserId];
        return updated;
      });
      if (peerConnections.current[remoteUserId]) {
        peerConnections.current[remoteUserId].close();
        delete peerConnections.current[remoteUserId];
      }
      toast.info(`${remoteUserName || remoteUserId} left the call or room`);
    });

    socketRef.current.on("existingParticipants", ({ participants }) => {
      const newUserIds = participants
        .map(p => p.userId)
        .filter(id => id !== userId);

      setRemoteUserIds(prev => [
        ...prev,
        ...newUserIds.filter(id => !prev.includes(id))
      ]);

      setRemoteUsers(prev => {
        const updated = { ...prev };
        participants.forEach(p => {
          if (p.userId !== userId) updated[p.userId] = p.userName;
        });
        return updated;
      });
    });

    socketRef.current.on("offer", handleOffer);
    socketRef.current.on("answer", handleAnswer);
    socketRef.current.on("ice-candidate", handleICECandidate);

    return () => {
      socketRef.current.disconnect();
    };
  }, [roomId, userId, userName]);

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

  // --- VIDEO CALL LOGIC ---
  useEffect(() => {
    if (isVideoCallActive && localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [isVideoCallActive]);

  const startVideoCall = async () => {
    try {
      if (!localStreamRef.current) {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }

      setIsVideoCallActive(true);
      isVideoCallActiveRef.current = true;

      socketRef.current.emit("joinCall", { roomId, userId, userName });

      setTimeout(() => {
        const validRemoteUsers = remoteUserIds.filter(id => id !== userId);
        validRemoteUsers.forEach(async (remoteUserId) => {
          if (!peerConnections.current[remoteUserId]) {
            const pc = createPeerConnection(remoteUserId);
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socketRef.current.emit("offer", { offer, to: remoteUserId });
            } catch (err) {
              console.error("Error creating offer for", remoteUserId, err);
            }
          }
        });
      }, 500);

      toast.success("Video call started successfully!");
    } catch (error) {
      console.error("Error starting video call:", error);
      toast.error("Could not access camera/microphone. Please check permissions.");
    }
  };

  const endVideoCall = () => {
    Object.values(peerConnections.current).forEach(connection => connection.close());
    peerConnections.current = {};

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    Object.values(remoteVideoRefs.current).forEach(video => {
      if (video) video.srcObject = null;
    });

    setIsVideoCallActive(false);
    isVideoCallActiveRef.current = false;
    socketRef.current.emit("leaveCall", { roomId, userId, userName });
    toast.info("Video call ended");
  };

  const createPeerConnection = (remoteUserId) => {
    if (peerConnections.current[remoteUserId]) {
      return peerConnections.current[remoteUserId];
    }
    const pc = new window.RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "turn:relay1.expressturn.com:3478", username: "efrelayusername", credential: "efrelaypassword" },
        { urls: "turn:a.relay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:a.relay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
      ]
    });
    peerConnections.current[remoteUserId] = pc;

    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.onicecandidate = e => {
      if (e.candidate) {
        socketRef.current.emit("ice-candidate", { candidate: e.candidate, to: remoteUserId });
      }
    };

    pc.ontrack = e => {
      const el = remoteVideoRefs.current[remoteUserId];
      if (el) el.srcObject = e.streams[0];
    };

    return pc;
  };

  const handleUserJoined = async (remoteUserId) => {
    if (!localStreamRef.current) return;
    const pc = createPeerConnection(remoteUserId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current.emit("offer", { offer, to: remoteUserId });
  };

  const handleOffer = async ({ offer, from }) => {
    if (!localStreamRef.current) return;
    const pc = createPeerConnection(from);

    if (pc.remoteDescription) {
      return;
    }

    try {
      await pc.setRemoteDescription(new window.RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit("answer", { answer, to: from });
    } catch (err) {
      console.error("Error handling offer:", err);
      pc.close();
      delete peerConnections.current[from];
    }
  };

  const handleAnswer = async ({ answer, from }) => {
    const pc = peerConnections.current[from];
    if (!pc || pc.remoteDescription) return;
    try {
      await pc.setRemoteDescription(new window.RTCSessionDescription(answer));
    } catch (err) {
      console.error("Failed to set remote answer:", err);
    }
  };

  const handleICECandidate = async ({ candidate, from }) => {
    const pc = peerConnections.current[from];
    if (!pc) return;
    try {
      await pc.addIceCandidate(new window.RTCIceCandidate(candidate));
    } catch (e) {
      // ignore
    }
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsCameraEnabled(prev => !prev);
    toast.info(videoTracks[0].enabled ? "Camera turned on" : "Camera turned off", { autoClose: 1500 });
  };

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsMicEnabled(prev => !prev);
    toast.info(audioTracks[0].enabled ? "Microphone unmuted" : "Microphone muted", { autoClose: 1500 });
  };

  const toggleScreenShare = async () => {
    if (!navigator.mediaDevices.getDisplayMedia) {
      toast.error("Screen sharing is not supported on your device/browser.");
      return;
    }
    if (isScreenSharing) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);

      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });

        localVideoRef.current.srcObject = localStreamRef.current;
        toast.info("Screen sharing stopped", { autoClose: 1500 });
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream);
        setIsScreenSharing(true);

        const screenTrack = stream.getVideoTracks()[0];
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        localVideoRef.current.srcObject = stream;
        toast.success("Screen sharing started", { autoClose: 1500 });

        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (error) {
        console.error("Error sharing screen:", error);
        toast.error("Failed to share screen");
      }
    }
  };

  const handleVideoClick = (videoElement) => {
    if (videoElement) {
      if (videoElement.srcObject) {
        setFullScreenVideoSrc(videoElement.srcObject);
      } else {
        setFullScreenVideoSrc(videoElement.src);
      }
      setIsFullScreen(true);
    }
  };

  const closeFullScreen = () => {
    setIsFullScreen(false);
    setFullScreenVideoSrc(null);
  };

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

  // --- Styling ---
  const colors = theme.colors || {
    background: "bg-neutral-50",
    surface: "bg-white",
    accent: "bg-yellow-100",
    text: "text-neutral-800",
    border: "border-neutral-200",
    primary: "bg-yellow-700",
    secondary: "bg-yellow-50",
    icon: "text-yellow-700",
    input: "bg-neutral-100",
  };

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-center ${colors.background} ${colors.text} font-inter`}>
      <ToastContainer position="top-right" theme={theme.name === 'dark' ? 'dark' : 'light'} />
      <div className={`w-full max-w-2xl mx-auto my-8 rounded-3xl shadow-lg ${colors.surface} px-8 py-8 flex flex-col gap-8`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <FiUser size={32} className={colors.icon} />
            <div>
              <h1 className={`text-2xl font-semibold m-0 ${colors.text}`}>{roomName || "Chat Room"}</h1>
              <span className={`text-base flex items-center gap-2 mt-1 ${colors.primary}`}>
                <FiUsers size={18} className={colors.primary} />
                {roomData?.participants?.length || 0} online
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              title="Toggle Theme"
              onClick={toggleTheme}
              className={`rounded-xl p-2 ${colors.input} flex items-center border-none`}
            >
              {theme.name === "dark" ? <FiSun size={22} className={colors.icon} /> : <FiMoon size={22} className={colors.icon} />}
            </button>
            <button
              title="Files"
              onClick={() => navigate(`/room/${roomId}/files`)}
              className={`rounded-xl p-2 ${colors.input} flex items-center border-none`}
            >
              <FiFileText size={22} className={colors.icon} />
            </button>
            <button
              title="Leave Room"
              onClick={leaveRoom}
              className={`rounded-xl p-2 ${colors.input} flex items-center border-none`}
            >
              <FiLogOut size={22} className={colors.icon} />
            </button>
          </div>
        </div>

        {/* Video Call Controls */}
        <div className="flex gap-3 items-center mb-2">
          {!isVideoCallActive ? (
            <button
              onClick={startVideoCall}
              className="rounded-xl px-5 py-2 font-medium text-base flex items-center gap-2 shadow-sm bg-yellow-700 text-white hover:bg-yellow-800 transition"
            >
              <FiVideo size={20} />
              Start Call
            </button>
          ) : (
            <button
              onClick={endVideoCall}
              className="rounded-xl px-5 py-2 font-medium text-base flex items-center gap-2 shadow-sm bg-yellow-700 text-white hover:bg-yellow-800 transition"
            >
              <FiVideoOff size={20} />
              End Call
            </button>
          )}
        </div>

        {/* Video Call Area */}
        {isVideoCallActive && (
          <div className={`rounded-2xl p-4 mb-2 flex flex-col gap-5 ${colors.input}`}>
            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-1 flex-1">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full max-w-[180px] h-[120px] rounded-xl bg-black border-2 ${colors.border} cursor-pointer`}
                  onClick={() => handleVideoClick(localVideoRef.current)}
                />
                <span className={`text-sm font-medium mt-1 ${colors.primary}`}>
                  You {isScreenSharing ? <FiMonitor size={14} /> : ""}
                </span>
              </div>
              {remoteUserIds.filter(id => id !== userId).map((remoteUserId) => (
                <div key={remoteUserId} className="flex flex-col items-center gap-1 flex-1">
                  <video
                    ref={el => remoteVideoRefs.current[remoteUserId] = el}
                    autoPlay
                    playsInline
                    className={`w-full max-w-[180px] h-[120px] rounded-xl bg-black border-2 ${colors.border} cursor-pointer`}
                    onClick={() => handleVideoClick(remoteVideoRefs.current[remoteUserId])}
                  />
                  <span className={`text-sm font-medium mt-1 ${colors.primary}`}>
                    {remoteUsers[remoteUserId] || remoteUserId}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-center mt-2">
              <button
                onClick={toggleMic}
                className={`rounded-lg p-2 flex items-center shadow-sm ${colors.surface} border-none`}
              >
                {isMicEnabled ? <FiMic size={20} className={colors.icon} /> : <FiMicOff size={20} className={colors.icon} />}
              </button>
              <button
                onClick={toggleCamera}
                className={`rounded-lg p-2 flex items-center shadow-sm ${colors.surface} border-none`}
              >
                {isCameraEnabled ? <FiVideo size={20} className={colors.icon} /> : <FiVideoOff size={20} className={colors.icon} />}
              </button>
              <button
                onClick={toggleScreenShare}
                className={`rounded-lg p-2 flex items-center shadow-sm ${colors.surface} border-none`}
              >
                <FiMonitor size={20} className={colors.icon} />
              </button>
            </div>
          </div>
        )}

        {roomData?.participants && (
          <div className="flex gap-3 mt-3 flex-wrap">
            {roomData.participants.map((user) => (
              <div key={user.userId} className={`flex items-center rounded-lg px-3 py-1 gap-2 text-base ${colors.input} ${colors.text}`}>
                <FiUser size={18} className={colors.primary} />
                {user.userName}
                {user.userId === userId && <span className="font-medium text-yellow-700">(You)</span>}
              </div>
            ))}
          </div>
        )}

        {/* Chat Messages */}
        <div className={`rounded-2xl p-4 min-h-[220px] max-h-[320px] overflow-y-auto flex flex-col gap-3 border ${colors.border} ${colors.input}`}>
          {messages.map((msg, index) => (
            <div
              key={msg._id || index}
              className={`rounded-xl px-4 py-3 mb-1 shadow-sm max-w-[80%] ${msg.userId === userId ? 'self-end bg-yellow-50' : `${colors.surface} self-start`}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-medium flex items-center gap-1 text-base ${colors.primary}`}>
                  <FiUser size={16} className={colors.primary} />
                  {msg.userName || msg.sender}
                </span>
                <span className={`text-xs ml-2 ${colors.icon}`}>
                  {formatTime(msg.timestamp || msg.createdAt)}
                </span>
              </div>
              <p className={`text-base m-0 break-words leading-relaxed ${colors.text}`}>{msg.content}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="flex items-center gap-3 mt-1">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className={`flex-1 rounded-xl px-4 py-3 text-base outline-none transition border ${colors.border} ${colors.input} ${colors.text} shadow-sm`}
          />
          <button
            onClick={sendMessage}
            className="rounded-xl px-4 py-3 font-medium text-base flex items-center gap-2 shadow-sm bg-yellow-700 text-white hover:bg-yellow-800 transition"
            title="Send"
          >
            <FiSend size={22} />
          </button>
        </div>

        {/* Fullscreen Video */}
        {isFullScreen && fullScreenVideoSrc && (
          <div className="fixed top-0 left-0 w-screen h-screen bg-black/80 z-[9999] flex items-center justify-center">
            <button
              onClick={closeFullScreen}
              className={`absolute top-8 right-8 rounded-xl p-3 cursor-pointer shadow-lg ${colors.surface} flex items-center`}
              title="Close"
            >
              <FiX size={28} className={colors.icon} />
            </button>
            {fullScreenVideoSrc instanceof MediaStream ? (
              <video
                ref={el => {
                  if (el && fullScreenVideoSrc) el.srcObject = fullScreenVideoSrc;
                }}
                autoPlay
                playsInline
                muted
                className="w-[80vw] h-[80vh] rounded-3xl bg-black shadow-2xl"
              />
            ) : (
              <video
                src={fullScreenVideoSrc}
                autoPlay
                playsInline
                muted
                className="w-[80vw] h-[80vh] rounded-3xl bg-black shadow-2xl"
              />
            )}
          </div>
        )}
      </div>
      <DrawingCanvas />
    </div>
  );
};

export default Chat;