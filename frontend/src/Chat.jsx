import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import { Camera, Mic, MicOff, Monitor, Phone, PhoneOff, Video, VideoOff, LogOut, Users, Upload } from "lucide-react";
import { API_ENDPOINTS, SOCKET_URL } from "./lib/utils";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Chat = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const userName = localStorage.getItem("userName");
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
    if (!userName || !roomId) {
      navigate('/');
      return;
    }
  }, [userName, roomId, navigate]);

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
    
    socketRef.current.emit("joinRoom", { room_id: roomId, user_name: userName });
    
    socketRef.current.on("receiveMessage", (data) => {
      setMessages((prev) => [...prev, data]);
      if (data.sender !== userName) {
        toast.info(`New message from ${data.userName}`, { autoClose: 2000 });
      }
    });
    
    socketRef.current.on("error", (data) => {
      toast.error(data.message);
    });
    
    return () => {
      socketRef.current.disconnect();
    };
  }, [roomId, userName]);

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
    
    socketRef.current.on("userJoined", ({ userId: remoteUserId }) => {
      setRemoteUserIds(prev => [...prev, remoteUserId]);
      handleUserJoined(remoteUserId);
      toast.info(`${remoteUserId} joined the call`);
    });
    
    socketRef.current.on("userLeft", ({ userId: remoteUserId }) => {
      setRemoteUserIds(prev => prev.filter(id => id !== remoteUserId));
      if (peerConnections.current[remoteUserId]) {
        peerConnections.current[remoteUserId].close();
        delete peerConnections.current[remoteUserId];
      }
      toast.info(`${remoteUserId} left the call`);
    });

    socketRef.current.on("existingParticipants", async ({ participants }) => {
      setRemoteUserIds(prev => [...prev, ...participants]);
      
      if (isVideoCallActive && localStreamRef.current) {
        for (const remoteUserId of participants) {
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
      socketRef.current.emit("joinCall", roomId);
      
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
    socketRef.current.emit("leaveCall", roomId);
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
      userName: userName
    };

    socketRef.current.emit("sendMessage", {
      room_id: roomId,
      message,
      sender: userName,
      userName: userName
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
    <div className="bg-gradient-to-br from-[#030718] via-[#0A1428] to-[#0F2E6B] min-h-screen flex flex-col">
      <ToastContainer position="top-right" theme="dark" />
      
      {/* Header */}
      <div className="py-4 px-6 bg-[#030718]/90 backdrop-blur-lg shadow-lg">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Video className="h-6 w-6 text-white" />
            </div>
            <div className="ml-3">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-indigo-100">
                {roomName || "Chat Room"}
              </h1>
              <p className="text-sm text-blue-100/60">
                {roomData?.participants?.length || 0} participants
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {!isVideoCallActive ? (
              <button
                onClick={startVideoCall}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-green-500/30 transition-all duration-300 flex items-center"
              >
                <Phone className="w-4 h-4 mr-2" />
                Start Call
              </button>
            ) : (
              <button
                onClick={endVideoCall}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg hover:shadow-red-500/30 transition-all duration-300 flex items-center"
              >
                <PhoneOff className="w-4 h-4 mr-2" />
                End Call
              </button>
            )}

            <button
              onClick={() => navigate(`/room/${roomId}/files`)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg hover:shadow-purple-500/30 transition-all duration-300 flex items-center"
            >
              <Upload className="w-4 h-4 mr-2" />
              Files
            </button>
            
            <button
              onClick={leaveRoom}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg hover:shadow-gray-500/30 transition-all duration-300 flex items-center"
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
          <div className="w-2/3 bg-[#030718]/80 p-6 border-r border-blue-500/20">
            <div className="h-full flex flex-col">
              <div className="flex-1 flex gap-4 flex-wrap justify-center content-start">
                {/* Local Video */}
                <div className="relative w-72 h-48 backdrop-blur-md bg-white/5 border border-blue-500/20 rounded-xl overflow-hidden hover:shadow-blue-500/20 hover:shadow-lg transition-all duration-300">
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                    onClick={() => handleVideoClick(localVideoRef.current)} 
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <span className="text-white text-sm font-medium">
                      You {isScreenSharing ? '(Screen)' : ''}
                    </span>
                  </div>
                </div>

                {/* Remote Videos */}
                {remoteUserIds.map((remoteUserId) => (
                  <div 
                    key={remoteUserId}
                    className="relative w-72 h-48 backdrop-blur-md bg-white/5 border border-blue-500/20 rounded-xl overflow-hidden hover:shadow-blue-500/20 hover:shadow-lg transition-all duration-300"
                  >
                    <video
                      ref={el => remoteVideoRefs.current[remoteUserId] = el}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      onClick={() => handleVideoClick(remoteVideoRefs.current[remoteUserId])}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <span className="text-white text-sm font-medium">
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
                  className={`p-3 rounded-full transition-all ${
                    isMicEnabled 
                      ? "bg-blue-500 hover:bg-blue-600" 
                      : "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {isMicEnabled ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
                </button>
                
                <button
                  onClick={toggleCamera}
                  className={`p-3 rounded-full transition-all ${
                    isCameraEnabled 
                      ? "bg-blue-500 hover:bg-blue-600" 
                      : "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {isCameraEnabled ? <Camera className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
                </button>
                
                <button
                  onClick={toggleScreenShare}
                  className={`p-3 rounded-full transition-all ${
                    isScreenSharing 
                      ? "bg-green-500 hover:bg-green-600" 
                      : "bg-gray-500 hover:bg-gray-600"
                  }`}
                >
                  <Monitor className="w-5 h-5 text-white" />
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
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.sender === userName
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-blue-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium opacity-75">
                        {msg.userName || msg.sender}
                      </span>
                      <span className="text-xs opacity-50">
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
          <div className="p-6 border-t border-blue-500/20">
            <div className="flex space-x-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-blue-500/30 text-blue-100 placeholder-blue-100/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Type a message..."
              />
              <button
                onClick={sendMessage}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-medium hover:shadow-blue-500/50 transition-all duration-300"
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