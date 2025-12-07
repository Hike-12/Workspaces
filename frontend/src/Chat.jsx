import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import { API_ENDPOINTS, SOCKET_URL, cn } from "./lib/utils";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTheme } from "./contexts/ThemeContext";
import {
  Send,
  LogOut,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Sun,
  Moon,
  Users,
  FileText,
  Monitor,
  X,
  User,
  Phone,
  PhoneOff,
  LayoutGrid,
  PenTool,
  Hand
} from "lucide-react";
import VideoHandDraw from "./VideoHandDraw";
import { motion, AnimatePresence } from "framer-motion";

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
  const [showHandDraw, setShowHandDraw] = useState(false);

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
      console.log("User joined event received:", remoteUserId, remoteUserName);
      setRemoteUserIds(prev => prev.includes(remoteUserId) ? prev : [...prev, remoteUserId]);
      setRemoteUsers(prev => ({ ...prev, [remoteUserId]: remoteUserName }));

      setTimeout(() => {
        if (isVideoCallActiveRef.current && localStreamRef.current) {
          console.log("Attempting to handle user joined for:", remoteUserId);
          handleUserJoined(remoteUserId);
        }
      }, 100);

      toast.info(`${remoteUserName || remoteUserId} joined the call or room`);
    });

    socketRef.current.on("userLeft", ({ userId: remoteUserId, userName: remoteUserName }) => {
      console.log("User left event received:", remoteUserId, remoteUserName);
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
      console.log("Existing participants received:", participants);
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

    socketRef.current.on("offer", (data) => {
      console.log("Offer received from:", data.from);
      handleOffer(data);
    });
    
    socketRef.current.on("answer", (data) => {
      console.log("Answer received from:", data.from);
      handleAnswer(data);
    });
    
    socketRef.current.on("ice-candidate", (data) => {
      console.log("ICE candidate received from:", data.from);
      handleICECandidate(data);
    });

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
      console.log("Starting video call...");
      if (!localStreamRef.current) {
        console.log("Getting user media...");
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        console.log("Got user media successfully");
      }

      setIsVideoCallActive(true);
      isVideoCallActiveRef.current = true;

      console.log("Emitting joinCall event to server");
      socketRef.current.emit("joinCall", { roomId, userId, userName });

      // Don't create offers immediately - wait for existing participants to send offers
      // or for the userJoined event to trigger for new participants
      console.log("Waiting for signaling from existing participants...");

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

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = e => {
      if (e.candidate) {
        console.log("Sending ICE candidate to:", remoteUserId);
        socketRef.current.emit("ice-candidate", { candidate: e.candidate, to: remoteUserId });
      }
    };

    pc.ontrack = e => {
      console.log("Received remote track from:", remoteUserId);
      const el = remoteVideoRefs.current[remoteUserId];
      if (el) el.srcObject = e.streams[0];
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state for", remoteUserId, ":", pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.error("Connection failed/disconnected for", remoteUserId);
        // Try to restart ICE
        if (pc.iceConnectionState === 'failed') {
          console.log("Attempting ICE restart for", remoteUserId);
          pc.restartIce();
        }
      } else if (pc.iceConnectionState === 'connected') {
        console.log("Successfully connected to", remoteUserId);
        toast.success(`Connected to ${remoteUsers[remoteUserId] || 'user'}`, { autoClose: 2000 });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state for", remoteUserId, ":", pc.connectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log("Signaling state for", remoteUserId, ":", pc.signalingState);
    };

    return pc;
  };

  const handleUserJoined = async (remoteUserId) => {
    if (!localStreamRef.current) {
      console.error("No local stream available");
      return;
    }
    try {
      const pc = createPeerConnection(remoteUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("Sending offer to:", remoteUserId);
      socketRef.current.emit("offer", { offer, to: remoteUserId });
    } catch (err) {
      console.error("Error in handleUserJoined:", err);
    }
  };

  const handleOffer = async ({ offer, from }) => {
    console.log("Handling offer from:", from);
    if (!localStreamRef.current) {
      console.error("Cannot handle offer - no local stream");
      return;
    }
    
    const pc = createPeerConnection(from);

    // If we already have a remote description, this is a glare condition
    if (pc.remoteDescription) {
      console.log("Already have remote description for", from, "- ignoring duplicate offer");
      return;
    }

    // If we have a local description (we sent an offer), we need to handle glare
    if (pc.localDescription) {
      console.log("Glare detected with", from, "- comparing IDs");
      // Use tie-breaker: lower userId accepts the offer, higher userId ignores it
      if (userId < from) {
        console.log("Our ID is lower - accepting offer and restarting");
        await pc.setLocalDescription({ type: 'rollback' });
      } else {
        console.log("Our ID is higher - ignoring offer");
        return;
      }
    }

    try {
      console.log("Setting remote description from offer");
      await pc.setRemoteDescription(new window.RTCSessionDescription(offer));
      
      console.log("Creating answer");
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log("Sending answer to:", from);
      socketRef.current.emit("answer", { answer, to: from });
    } catch (err) {
      console.error("Error handling offer:", err);
      pc.close();
      delete peerConnections.current[from];
    }
  };

  const handleAnswer = async ({ answer, from }) => {
    console.log("Handling answer from:", from);
    const pc = peerConnections.current[from];
    if (!pc) {
      console.error("No peer connection found for:", from);
      return;
    }
    
    if (pc.remoteDescription) {
      console.log("Already have remote description for", from, "- ignoring duplicate answer");
      return;
    }
    
    try {
      console.log("Setting remote description from answer");
      await pc.setRemoteDescription(new window.RTCSessionDescription(answer));
      console.log("Successfully set remote description for:", from);
    } catch (err) {
      console.error("Failed to set remote answer:", err);
    }
  };

  const handleICECandidate = async ({ candidate, from }) => {
    console.log("Handling ICE candidate from:", from);
    const pc = peerConnections.current[from];
    if (!pc) {
      console.error("No peer connection found for:", from);
      return;
    }
    
    if (!pc.remoteDescription) {
      console.warn("Received ICE candidate before remote description - this may cause issues");
    }
    
    try {
      await pc.addIceCandidate(new window.RTCIceCandidate(candidate));
      console.log("Successfully added ICE candidate from:", from);
    } catch (e) {
      console.error("Error adding ICE candidate:", e);
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

  return (
    <div className="min-h-screen w-full bg-bg-canvas text-fg-primary font-sans flex flex-col">
      <ToastContainer position="top-right" theme={theme} />
      
      {/* Header */}
      <header className="px-6 py-4 bg-bg-surface border-b border-border-subtle flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-accent-brand/10 rounded-xl flex items-center justify-center text-accent-brand">
            <LayoutGrid size={20} />
          </div>
          <div>
            <h1 className="font-serif text-xl font-semibold leading-tight">{roomName || "Workspace"}</h1>
            <div className="flex items-center gap-2 text-sm text-fg-secondary">
              <span className="flex items-center gap-1">
                <Users size={14} />
                {roomData?.participants?.length || 0} active
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl hover:bg-bg-canvas text-fg-secondary hover:text-fg-primary transition-colors"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="h-6 w-px bg-border-subtle mx-1" />
          <button
            onClick={() => navigate(`/room/${roomId}/files`)}
            className="p-2.5 rounded-xl hover:bg-bg-canvas text-fg-secondary hover:text-fg-primary transition-colors"
            title="Files"
          >
            <FileText size={20} />
          </button>
          <button
            onClick={leaveRoom}
            className="p-2.5 rounded-xl hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors"
            title="Leave"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid gap-6 grid-cols-1 lg:grid-cols-3">
        
        {/* Left Column: Chat & Video */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Video Call Section */}
          <div className="bg-bg-surface border border-border-subtle rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-lg font-medium">Conference</h2>
              {!isVideoCallActive ? (
                <button
                  onClick={startVideoCall}
                  className="px-4 py-2 rounded-lg bg-accent-brand text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <Phone size={16} />
                  Start Call
                </button>
              ) : (
                <button
                  onClick={endVideoCall}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <PhoneOff size={16} />
                  End Call
                </button>
              )}
            </div>

            <AnimatePresence>
              {isVideoCallActive && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-border-subtle group">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => handleVideoClick(localVideoRef.current)}
                      />
                      <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded-md text-xs text-white font-medium flex items-center gap-1">
                        You {isScreenSharing && <Monitor size={10} />}
                      </div>
                    </div>
                    {remoteUserIds.filter(id => id !== userId).map((remoteUserId) => (
                      <div key={remoteUserId} className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-border-subtle">
                        <video
                          ref={el => remoteVideoRefs.current[remoteUserId] = el}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => handleVideoClick(remoteVideoRefs.current[remoteUserId])}
                        />
                        <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded-md text-xs text-white font-medium">
                          {remoteUsers[remoteUserId] || "User"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-center gap-2">
                    <button
                      onClick={toggleMic}
                      className={cn(
                        "p-3 rounded-full transition-colors",
                        isMicEnabled ? "bg-bg-canvas hover:bg-border-subtle text-fg-primary" : "bg-red-100 text-red-600"
                      )}
                    >
                      {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                    </button>
                    <button
                      onClick={toggleCamera}
                      className={cn(
                        "p-3 rounded-full transition-colors",
                        isCameraEnabled ? "bg-bg-canvas hover:bg-border-subtle text-fg-primary" : "bg-red-100 text-red-600"
                      )}
                    >
                      {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                    </button>
                    <button
                      onClick={toggleScreenShare}
                      className={cn(
                        "p-3 rounded-full transition-colors",
                        isScreenSharing ? "bg-accent-brand text-white" : "bg-bg-canvas hover:bg-border-subtle text-fg-primary"
                      )}
                    >
                      <Monitor size={20} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Chat Section */}
          <div className="bg-bg-surface border border-border-subtle rounded-3xl p-6 shadow-sm flex-1 flex flex-col min-h-[500px]">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar mb-4">
              {messages.map((msg, index) => {
                const isMe = msg.userId === userId;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg._id || index}
                    className={cn(
                      "flex flex-col max-w-[80%]",
                      isMe ? "self-end items-end" : "self-start items-start"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-xs font-medium text-fg-secondary">
                        {isMe ? "You" : msg.userName || msg.sender}
                      </span>
                      <span className="text-[10px] text-fg-secondary/70">
                        {formatTime(msg.timestamp || msg.createdAt)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                        isMe
                          ? "bg-accent-brand text-white rounded-tr-sm"
                          : "bg-bg-canvas text-fg-primary rounded-tl-sm"
                      )}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="relative flex items-center gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="w-full pl-4 pr-12 py-3.5 rounded-xl bg-bg-canvas border border-border-subtle focus:border-accent-brand focus:ring-2 focus:ring-accent-brand/20 outline-none transition-all duration-200"
              />
              <button
                onClick={sendMessage}
                className="absolute right-2 p-2 rounded-lg bg-accent-brand text-white hover:opacity-90 transition-opacity"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Tools */}
        <div className="flex flex-col gap-6">
          <div className="bg-bg-surface border border-border-subtle rounded-3xl p-6 shadow-sm">
            <h2 className="font-serif text-lg font-medium mb-4">Participants</h2>
            <div className="space-y-3">
              {roomData?.participants?.map((user) => (
                <div key={user.userId} className="flex items-center gap-3 p-2 rounded-xl hover:bg-bg-canvas transition-colors">
                  <div className="h-8 w-8 rounded-full bg-accent-brand/10 flex items-center justify-center text-accent-brand text-xs font-bold">
                    {user.userName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-fg-primary">
                    {user.userName} {user.userId === userId && "(You)"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-bg-surface border border-border-subtle rounded-3xl p-6 shadow-sm">
            <h2 className="font-serif text-lg font-medium mb-4">Creative Tools</h2>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => navigate(`/room/${roomId}/whiteboard`)}
                className="flex items-center gap-3 p-4 rounded-2xl bg-bg-canvas border border-border-subtle hover:border-accent-brand/50 hover:shadow-md transition-all duration-200 group text-left"
              >
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <PenTool size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-fg-primary">Whiteboard</h3>
                  <p className="text-xs text-fg-secondary">Collaborative drawing</p>
                </div>
              </button>

              <button
                onClick={() => setShowHandDraw(true)}
                className="flex items-center gap-3 p-4 rounded-2xl bg-bg-canvas border border-border-subtle hover:border-accent-brand/50 hover:shadow-md transition-all duration-200 group text-left"
              >
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Hand size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-fg-primary">AI Hand Draw</h3>
                  <p className="text-xs text-fg-secondary">Gesture controlled canvas</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Fullscreen Video Modal */}
      <AnimatePresence>
        {isFullScreen && fullScreenVideoSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8"
          >
            <button
              onClick={closeFullScreen}
              className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X size={24} />
            </button>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="w-full max-w-6xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl"
            >
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Hand Draw Overlay */}
      <AnimatePresence>
        {showHandDraw && (
          <VideoHandDraw roomId={roomId} onClose={() => setShowHandDraw(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Chat;