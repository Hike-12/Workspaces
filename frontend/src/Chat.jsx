import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import { Camera, Mic, MicOff, Monitor, Phone, PhoneOff, Video, VideoOff, LogOut, Upload } from "lucide-react";
import { API_ENDPOINTS, SOCKET_URL } from "./lib/utils";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const COLORS = {
  bg: "#0C1844",         // main background (navy)
  card: "#FFF5E1",       // card/panel (cream)
  border: "#0C1844",     // border (navy)
  accent: "#0C1844",     // primary accent (navy)
  accent2: "#FFF5E1",    // secondary accent (cream)
  text: "#0C1844",       // main text (navy on cream)
  textLight: "#FFF5E1",  // light text (cream on navy)
  muted: "#0C1844",      // muted text (navy)
  myMessage: "#1a3d72",  // my messages background (lighter navy)
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
  const [remoteUsers, setRemoteUsers] = useState({});

  // Refs
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnections = useRef({});
  const remoteVideoRefs = useRef({});
  const isVideoCallActiveRef = useRef(false);

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

  const leaveRoom = async () => {
  try {
    // Call backend to leave room
    await fetch(`${API_ENDPOINTS.NODE_BASE_URL}/api/rooms/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomId,
        userId
      })
    });
  } catch (error) {
    console.error('Error leaving room:', error);
  }
  
  // Clean up local storage and navigate
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

  // WebRTC event listeners - moved here to avoid dependency issues
  socketRef.current.on("userJoined", ({ userId: remoteUserId, userName: remoteUserName }) => {
    console.log("User joined:", remoteUserId, "Current video call active:", isVideoCallActiveRef.current);
    setRemoteUserIds(prev => prev.includes(remoteUserId) ? prev : [...prev, remoteUserId]);
    setRemoteUsers(prev => ({ ...prev, [remoteUserId]: remoteUserName }));
    
    // Only create peer connection if video call is active at the time
    setTimeout(() => {
      if (isVideoCallActiveRef.current && localStreamRef.current) {
        handleUserJoined(remoteUserId);
      }
    }, 100);
    
    toast.info(`${remoteUserName || remoteUserId} joined the room`);
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
    toast.info(`${remoteUserName || remoteUserId} left the room`);
  });

  socketRef.current.on("existingParticipants", async ({ participants }) => {
    console.log("Existing participants:", participants);
    
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

    // Create peer connections for existing participants if video call is active
    if (isVideoCallActiveRef.current && localStreamRef.current) {
      for (const participant of participants) {
        if (participant.userId !== userId) {
          const remoteUserId = participant.userId;
          setTimeout(async () => {
            const peerConnection = await createPeerConnection(remoteUserId);
            try {
              const offer = await peerConnection.createOffer();
              await peerConnection.setLocalDescription(offer);
              socketRef.current.emit("offer", { offer, to: remoteUserId });
            } catch (error) {
              console.error("Error creating offer for existing participant:", error);
              toast.error("Connection error");
            }
          }, 100);
        }
      }
    }
  });

  socketRef.current.on("offer", handleOffer);
  socketRef.current.on("answer", handleAnswer);
  socketRef.current.on("ice-candidate", handleICECandidate);

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

const startVideoCall = async () => {
  try {
    console.log("Starting video call with existing users:", remoteUserIds);
    
    if (!localStreamRef.current) {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    }

    setIsVideoCallActive(true);
    isVideoCallActiveRef.current = true;
    
    socketRef.current.emit("joinCall", { roomId, userId, userName });

    // Create connections for existing users after a short delay
    setTimeout(() => {
      const validRemoteUsers = remoteUserIds.filter(id => id !== userId);
      console.log("Creating connections for existing users:", validRemoteUsers);
      
      validRemoteUsers.forEach((remoteUserId) => {
        setTimeout(() => {
          handleUserJoined(remoteUserId);
        }, 200);
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
  isVideoCallActiveRef.current = false; // Set ref immediately
  socketRef.current.emit("leaveCall", { roomId, userId, userName });
  toast.info("Video call ended");
};



// 1) single factory:
const createPeerConnection = (remoteUserId) => {
  if (peerConnections.current[remoteUserId]) {
    return peerConnections.current[remoteUserId];
  }
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    ]
  });
  peerConnections.current[remoteUserId] = pc;

  // add local tracks
  localStreamRef.current.getTracks().forEach(track => {
    pc.addTrack(track, localStreamRef.current);
  });

  // send our ICE
  pc.onicecandidate = e => {
    if (e.candidate) {
      socketRef.current.emit("ice-candidate", { candidate: e.candidate, to: remoteUserId });
    }
  };

  // attach remote
  pc.ontrack = e => {
    const el = remoteVideoRefs.current[remoteUserId];
    if (el) el.srcObject = e.streams[0];
  };

  return pc;
};

// 2) on new peer:
const handleUserJoined = async (remoteUserId) => {
  if (!localStreamRef.current) return;
  const pc = createPeerConnection(remoteUserId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socketRef.current.emit("offer", { offer, to: remoteUserId });
};

// 3) on OFFER:
const handleOffer = async ({ offer, from }) => {
  if (!localStreamRef.current) return;

  const pc = createPeerConnection(from);

  // ignore duplicate offers
  if (pc.remoteDescription) {
    console.log("⏩ ignore duplicate offer from", from);
    return;
  }

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit("answer", { answer, to: from });
    console.log("✅ answered offer from", from);
  } catch (err) {
    console.error("❌ error handling offer:", err);
    pc.close();
    delete peerConnections.current[from];
  }
};

// 4) on ANSWER:
const handleAnswer = async ({ answer, from }) => {
  const pc = peerConnections.current[from];
  if (!pc) {
    console.log("⏩ ignore answer, no pc for", from);
    return;
  }

  // only proceed if *we* created an offer
  if (
    pc.localDescription?.type !== 'offer' ||
    pc.signalingState !== 'have-local-offer'
  ) {
    console.log(
      "⏩ ignore answer, wrong state:",
      pc.signalingState,
      "localDesc:",
      pc.localDescription?.type
    );
    return;
  }

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("✅ remote-answer set for", from);
  } catch (err) {
    console.error("❌ failed to set remote answer:", err);
  }
};

// 5) on ICE:
const handleICECandidate = async ({ candidate, from }) => {
  const pc = peerConnections.current[from];
  if (!pc) return;
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.warn("ICE add failed:", e);
  }
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
      <ToastContainer position="top-right" theme="dark" />
      {/* Header */}
      <div
        className="py-4 px-4 sm:px-6 shadow-lg"
        style={{
          background: COLORS.card,
          borderBottom: `2px solid ${COLORS.border}`,
        }}
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shadow-md"
              style={{
                background: COLORS.bg,
                border: `2px solid ${COLORS.border}`,
              }}
            >
              <Video className="h-6 w-6" style={{ color: COLORS.accent2 }} />
            </div>
            <div className="ml-4">
              <h1
                className="text-xl sm:text-2xl font-bold"
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
          <div className="flex items-center space-x-2 sm:space-x-3">
            {!isVideoCallActive ? (
              <button
                onClick={startVideoCall}
                className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center"
                style={{
                  background: COLORS.accent,
                  color: COLORS.textLight,
                }}
              >
                <Phone className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Start Call</span>
                <span className="sm:hidden">Call</span>
              </button>
            ) : (
              <button
                onClick={endVideoCall}
                className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center"
                style={{
                  background: "#E74C3C",
                  color: COLORS.textLight,
                }}
              >
                <PhoneOff className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">End Call</span>
                <span className="sm:hidden">End</span>
              </button>
            )}
            <button
              onClick={() => navigate(`/room/${roomId}/files`)}
              className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center"
              style={{
                background: COLORS.accent,
                color: COLORS.textLight,
              }}
            >
              <Upload className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Files</span>
            </button>
            <button
              onClick={leaveRoom}
              className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center border"
              style={{
                background: "transparent",
                color: COLORS.accent,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <LogOut className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Video Call Area */}
        {isVideoCallActive && (
          <div
            className="w-full lg:w-2/3 p-4 sm:p-6 border-b-2 lg:border-b-0 lg:border-r-2"
            style={{
              background: COLORS.bg,
              borderColor: COLORS.border,
            }}
          >
            <div className="h-full flex flex-col">
              <div className="flex-1 flex gap-4 sm:gap-6 flex-wrap justify-center content-start">
                {/* Local Video */}
                <div
                  className="relative w-48 h-32 sm:w-64 sm:h-40 rounded-xl overflow-hidden shadow-lg transition-transform hover:scale-105 cursor-pointer"
                  style={{
                    background: COLORS.card,
                    border: `2px solid ${COLORS.border}`,
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
                  <div className="absolute bottom-0 left-0 right-0 p-3"
                  >
                    <span className="text-xs font-semibold" style={{ color: COLORS.accent }}>
                      You {isScreenSharing ? '(Screen)' : ''}
                    </span>
                  </div>
                </div>
                {/* Remote Videos */}
                {remoteUserIds.filter(id => id !== userId).map((remoteUserId) => (
                  <div
                    key={remoteUserId}
                    className="relative w-48 h-32 sm:w-64 sm:h-40 rounded-xl overflow-hidden shadow-lg transition-transform hover:scale-105 cursor-pointer"
                    style={{
                      background: COLORS.card,
                      border: `2px solid ${COLORS.border}`,
                    }}
                  >
                    <video
                      ref={el => remoteVideoRefs.current[remoteUserId] = el}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      onClick={() => handleVideoClick(remoteVideoRefs.current[remoteUserId])}
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-3"
                    >
                      <span className="text-xs font-semibold" style={{ color: COLORS.accent }}>
                        {remoteUsers[remoteUserId] || remoteUserId}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Video Controls */}
              <div className="flex justify-center space-x-4 sm:space-x-6 mt-6">
                <button
                  onClick={toggleMic}
                  className="p-3 sm:p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                  style={{
                    background: isMicEnabled ? COLORS.accent : "#E74C3C",
                    color: COLORS.textLight,
                  }}
                >
                  {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={toggleCamera}
                  className="p-3 sm:p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                  style={{
                    background: isCameraEnabled ? COLORS.accent : "#E74C3C",
                    color: COLORS.textLight,
                  }}
                >
                  {isCameraEnabled ? <Camera className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={toggleScreenShare}
                  className="p-3 sm:p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-110 border"
                  style={{
                    background: isScreenSharing ? COLORS.accent2 : COLORS.accent,
                    color: isScreenSharing ? COLORS.accent : COLORS.textLight,
                    border: `1px solid ${COLORS.accent}`,
                  }}
                >
                  <Monitor className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Chat Area */}
        <div className={`${isVideoCallActive ? 'w-full lg:w-1/3' : 'w-full'} flex flex-col`}>
          {/* Messages */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto"
            style={{
              background: COLORS.bg,
            }}
          >
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={msg._id || index}
                  className={`flex ${msg.userId === userId ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs sm:max-w-sm lg:max-w-md px-4 py-3 rounded-xl shadow-md`}
                    style={{
                      background: msg.userId === userId ? COLORS.myMessage : COLORS.card,
                      color: msg.userId === userId ? COLORS.textLight : COLORS.text,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold opacity-80" style={{ color: msg.userId === userId ? COLORS.accent2 : COLORS.accent }}>
                        {msg.userName || msg.sender}
                      </span>
                      <span className="text-xs opacity-60" style={{ color: msg.userId === userId ? COLORS.accent2 : COLORS.muted }}>
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
            className="p-4 sm:p-6 shadow-lg"
            style={{
              borderTop: `2px solid ${COLORS.border}`,
              background: COLORS.card,
            }}
          >
            <div className="flex space-x-3">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-blue-200"
                style={{
                  background: "rgba(12, 24, 68, 0.02)",
                  color: COLORS.text,
                  border: `1px solid rgba(12, 24, 68, 0.2)`,
                }}
                placeholder="Type a message..."
              />
              <button
                onClick={sendMessage}
                className="px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                style={{
                  background: COLORS.accent,
                  color: COLORS.textLight,
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Full Screen Video Modal */}
      {(isFullScreen && fullScreenVideoSrc) && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" onClick={closeFullScreen}>
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
}

export default Chat;