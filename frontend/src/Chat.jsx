import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import { Camera, Mic, MicOff, Monitor, Phone, PhoneOff, Video, VideoOff, LogOut, Users, Upload } from "lucide-react";
import { API_ENDPOINTS, SOCKET_URL } from "./lib/utils";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const COLORS = {
  bg: "#F7FAFC",
  card: "#FFFFFF",
  border: "#E5E7EB",
  accent: "#03346E",
  accent2: "#6EACDA",
  text: "#021526",
  muted: "#6B7280",
};

const Chat = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const userName = localStorage.getItem("userName");
  const userId = localStorage.getItem("userId");
  const roomName = localStorage.getItem("roomName");
  
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [remoteUserIds, setRemoteUserIds] = useState([]);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fullScreenVideoSrc, setFullScreenVideoSrc] = useState(null);
  const [roomData, setRoomData] = useState(null);

  // Refs
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnections = useRef({});
  const remoteVideoRefs = useRef({});

  // Redirect if no user data
  useEffect(() => {
    if (!userName || !roomId || !userId) {
      navigate('/');
      return;
    }
  }, [userName, roomId, userId, navigate]);

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

  const leaveRoom = () => {
    localStorage.removeItem("userName");
    localStorage.removeItem("roomId");
    localStorage.removeItem("roomName");
    navigate('/');
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Set video source when call becomes active
  useEffect(() => {
    if (isVideoCallActive && localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [isVideoCallActive]);

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
        // Fetch messages
        const messagesResponse = await fetch(`${API_ENDPOINTS.GET_MESSAGES}?room_id=${roomId}`);
        const messagesData = await messagesResponse.json();
        setMessages(messagesData);

        // Fetch room data
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

  // WebRTC signaling setup
  useEffect(() => {
    if (!socketRef.current) return;

    socketRef.current.on("userJoined", ({ userId: remoteUserId, userName: remoteUserName }) => {
      setRemoteUserIds(prev => [...prev, remoteUserId]);
      handleUserJoined(remoteUserId);
      toast.info(`${remoteUserName || remoteUserId} joined the call`);
    });
    
    socketRef.current.on("userLeft", ({ userId: remoteUserId, userName: remoteUserName }) => {
      setRemoteUserIds(prev => prev.filter(id => id !== remoteUserId));
      if (peerConnections.current[remoteUserId]) {
        peerConnections.current[remoteUserId].close();
        delete peerConnections.current[remoteUserId];
      }
      toast.info(`${remoteUserName || remoteUserId} left the call`);
    });

    socketRef.current.on("existingParticipants", async ({ participants }) => {
      setRemoteUserIds(prev => [...prev, ...participants.map(p => p.userId)]);

      if (isVideoCallActive && localStreamRef.current) {
        for (const participant of participants) {
          const remoteUserId = participant.userId;
          const peerConnection = await createPeerConnection(remoteUserId);
          try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socketRef.current.emit("offer", { offer, to: remoteUserId });
          } catch (error) {
            console.error("Error creating offer for existing participant:", error);
            toast.error("Connection error");
          }
        }
      }
    });
    
    socketRef.current.on("offer", handleOffer);
    socketRef.current.on("answer", handleAnswer);
    socketRef.current.on("ice-candidate", handleICECandidate);

    return () => {
      socketRef.current.off("userJoined");
      socketRef.current.off("userLeft");
      socketRef.current.off("offer");
      socketRef.current.off("answer");
      socketRef.current.off("ice-candidate");
      socketRef.current.off("existingParticipants");
    };
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
      socketRef.current.emit("joinCall", { roomId, userId, userName });
      
      remoteUserIds.forEach((remoteUserId) => {
        handleUserJoined(remoteUserId);
      });

      toast.success("Video call started successfully!");
    } catch (error) {
      console.error("Error starting video call:", error);
      toast.error("Could not access camera/microphone. Please check permissions.");
    }
  };

  const endVideoCall = () => {
    Object.values(peerConnections.current).forEach(connection => connection.close());
    peerConnections.current = {};
    setRemoteUserIds([]);

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
    socketRef.current.emit("leaveCall", { roomId, userId, userName });
    toast.info("Video call ended");
  };

  const handleUserJoined = async (remoteUserId) => {
    if (isVideoCallActive && localStreamRef.current) {
      const peerConnection = await createPeerConnection(remoteUserId);
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socketRef.current.emit("offer", { offer, to: remoteUserId });
      } catch (error) {
        console.error("Error creating offer:", error);
        toast.error("Failed to connect with new participant");
      }
    }
  };

  const handleOffer = async ({ offer, from }) => {
    if (isVideoCallActive && localStreamRef.current) {
      const peerConnection = await createPeerConnection(from);
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socketRef.current.emit("answer", { answer, to: from });
      } catch (error) {
        console.error("Error handling offer:", error);
        toast.error("Connection error");
      }
    }
  };

  const handleAnswer = async ({ answer, from }) => {
    try {
      const peerConnection = peerConnections.current[from];
      if (peerConnection && peerConnection.signalingState === "have-local-offer") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  };

  const handleICECandidate = async ({ candidate, from }) => {
    try {
      if (peerConnections.current[from]) {
        await peerConnections.current[from].addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      }
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
    }
  };

  const createPeerConnection = async (remoteUserId) => {
    if (!localStreamRef.current) return null;

    if (peerConnections.current[remoteUserId]) {
      peerConnections.current[remoteUserId].close();
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    peerConnections.current[remoteUserId] = peerConnection;

    peerConnection.ontrack = (event) => {
      if (event.streams[0]) {
        setTimeout(() => {
          const remoteVideo = remoteVideoRefs.current[remoteUserId];
          if (remoteVideo && !remoteVideo.srcObject) {
            remoteVideo.srcObject = event.streams[0];
          }
        }, 100);
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", { 
          candidate: event.candidate, 
          to: remoteUserId 
        });
      }
    };

    localStreamRef.current.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStreamRef.current);
    });

    return peerConnection;
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
        background: COLORS.bg,
      }}
    >
      <ToastContainer position="top-right" theme="light" />
      {/* Header */}
      <div
        className="py-4 px-6 border-b"
        style={{
          background: COLORS.card,
          borderBottomColor: COLORS.border,
        }}
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center border"
              style={{
                background: COLORS.card,
                borderColor: COLORS.border,
              }}
            >
              <Video className="h-6 w-6" style={{ color: COLORS.accent }} />
            </div>
            <div className="ml-3">
              <h1
                className="text-xl font-bold"
                style={{
                  color: COLORS.accent,
                  letterSpacing: "-0.01em",
                }}
              >
                {roomName || "Chat Room"}
              </h1>
              <p className="text-sm" style={{ color: COLORS.muted }}>
                {roomData?.participants?.length || 0} participants
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!isVideoCallActive ? (
              <button
                onClick={startVideoCall}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#03346E] text-white hover:bg-[#021526] transition-all"
              >
                <Phone className="w-4 h-4 mr-2" />
                Start Call
              </button>
            ) : (
              <button
                onClick={endVideoCall}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-700 transition-all"
              >
                <PhoneOff className="w-4 h-4 mr-2" />
                End Call
              </button>
            )}
            <button
              onClick={() => navigate(`/room/${roomId}/files`)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#03346E] text-white hover:bg-[#021526] transition-all"
            >
              <Upload className="w-4 h-4 mr-2" />
              Files
            </button>
            <button
              onClick={leaveRoom}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-[#03346E] hover:bg-gray-300 transition-all"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Leave
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 flex">
        {/* Video Call Area */}
        {isVideoCallActive && (
          <div
            className="w-2/3 p-8 border-r"
            style={{
              background: COLORS.bg,
              borderRightColor: COLORS.border,
              borderRightWidth: 1,
            }}
          >
            <div className="h-full flex flex-col">
              <div className="flex-1 flex gap-5 flex-wrap justify-center content-start">
                {/* Local Video */}
                <div
                  className="relative w-64 h-40 rounded-lg overflow-hidden border shadow-sm"
                  style={{
                    background: COLORS.card,
                    borderColor: COLORS.border,
                  }}
                >
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => handleVideoClick(localVideoRef.current)}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-white/70 p-1">
                    <span className="text-xs font-medium text-[#03346E]">
                      You {isScreenSharing ? '(Screen)' : ''}
                    </span>
                  </div>
                </div>
                {/* Remote Videos */}
                {remoteUserIds.map((remoteUserId) => (
                  <div
                    key={remoteUserId}
                    className="relative w-64 h-40 rounded-lg overflow-hidden border shadow-sm"
                    style={{
                      background: COLORS.card,
                      borderColor: COLORS.border,
                    }}
                  >
                    <video
                      ref={el => remoteVideoRefs.current[remoteUserId] = el}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => handleVideoClick(remoteVideoRefs.current[remoteUserId])}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-white/70 p-1">
                      <span className="text-xs font-medium text-[#03346E]">
                        {remoteUserId}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Video Controls */}
              <div className="flex justify-center space-x-4 mt-6">
                <button
                  onClick={toggleMic}
                  className={`p-3 rounded-full border transition-all ${
                    isMicEnabled
                      ? "bg-[#03346E] text-white border-[#03346E]"
                      : "bg-red-500 text-white border-red-500"
                  }`}
                >
                  {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={toggleCamera}
                  className={`p-3 rounded-full border transition-all ${
                    isCameraEnabled
                      ? "bg-[#03346E] text-white border-[#03346E]"
                      : "bg-red-500 text-white border-red-500"
                  }`}
                >
                  {isCameraEnabled ? <Camera className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={toggleScreenShare}
                  className={`p-3 rounded-full border transition-all ${
                    isScreenSharing
                      ? "bg-green-500 text-white border-green-500"
                      : "bg-gray-200 text-[#03346E] border-gray-200"
                  }`}
                >
                  <Monitor className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Chat Area */}
        <div className={`${isVideoCallActive ? 'w-1/3' : 'w-full'} flex flex-col`}>
          {/* Messages */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.sender === userName ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg border shadow-sm ${
                      msg.sender === userName
                        ? 'bg-[#03346E] text-white border-[#03346E]'
                        : 'bg-white text-[#021526] border-[#E5E7EB]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold opacity-80">
                        {msg.userName || msg.sender}
                      </span>
                      <span className="text-xs opacity-60">
                        {formatTime(msg.timestamp || msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
          {/* Message Input */}
          <div
            className="p-4 border-t"
            style={{
              borderTopColor: COLORS.border,
              background: COLORS.card,
            }}
          >
            <div className="flex space-x-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 px-4 py-2 rounded-lg border bg-white text-[#021526] border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#03346E] transition-all"
                placeholder="Type a message..."
              />
              <button
                onClick={sendMessage}
                className="px-5 py-2 rounded-lg font-semibold bg-[#03346E] text-white hover:bg-[#021526] transition-all"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Full Screen Video Modal */}
      {isFullScreen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" onClick={closeFullScreen}>
          {fullScreenVideoSrc instanceof MediaStream ? (
            <video
              ref={(el) => {
                if (el) el.srcObject = fullScreenVideoSrc;
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
              className="w-full h-full object-contain"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Chat;