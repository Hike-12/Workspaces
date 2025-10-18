import { useRef, useState, useEffect } from "react";
import { toast } from "react-toastify";

export function useVideoCall({ socketRef, roomId, userId, userName }) {
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [remoteUserIds, setRemoteUserIds] = useState([]);
  const [remoteUsers, setRemoteUsers] = useState({});
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fullScreenVideoSrc, setFullScreenVideoSrc] = useState(null);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnections = useRef({});
  const remoteVideoRefs = useRef({});
  const isVideoCallActiveRef = useRef(false);

  // Set video source when call becomes active
  useEffect(() => {
    if (isVideoCallActive && localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [isVideoCallActive]);

  // WebRTC event listeners
  useEffect(() => {
    if (!socketRef.current) return;

    const handleUserJoinedEvent = ({ userId: remoteUserId, userName: remoteUserName }) => {
      setRemoteUserIds(prev => prev.includes(remoteUserId) ? prev : [...prev, remoteUserId]);
      setRemoteUsers(prev => ({ ...prev, [remoteUserId]: remoteUserName }));
      
      setTimeout(() => {
        if (isVideoCallActiveRef.current && localStreamRef.current) {
          handleUserJoined(remoteUserId);
        }
      }, 100);
      
      toast.info(`${remoteUserName || remoteUserId} joined the call`);
    };

    const handleUserLeftEvent = ({ userId: remoteUserId, userName: remoteUserName }) => {
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
      toast.info(`${remoteUserName || remoteUserId} left the call`);
    };

    const handleExistingParticipants = ({ participants }) => {
      const newUserIds = participants.map(p => p.userId).filter(id => id !== userId);
      setRemoteUserIds(prev => [...prev, ...newUserIds.filter(id => !prev.includes(id))]);
      setRemoteUsers(prev => {
        const updated = { ...prev };
        participants.forEach(p => {
          if (p.userId !== userId) updated[p.userId] = p.userName;
        });
        return updated;
      });
    };

    socketRef.current.on("userJoined", handleUserJoinedEvent);
    socketRef.current.on("userLeft", handleUserLeftEvent);
    socketRef.current.on("existingParticipants", handleExistingParticipants);
    socketRef.current.on("offer", handleOffer);
    socketRef.current.on("answer", handleAnswer);
    socketRef.current.on("ice-candidate", handleICECandidate);

    return () => {
      if (socketRef.current) {
        socketRef.current.off("userJoined", handleUserJoinedEvent);
        socketRef.current.off("userLeft", handleUserLeftEvent);
        socketRef.current.off("existingParticipants", handleExistingParticipants);
        socketRef.current.off("offer", handleOffer);
        socketRef.current.off("answer", handleAnswer);
        socketRef.current.off("ice-candidate", handleICECandidate);
      }
    };
  }, [socketRef, userId, userName, roomId]);

  const createPeerConnection = (remoteUserId) => {
    if (peerConnections.current[remoteUserId]) {
      return peerConnections.current[remoteUserId];
    }
    const pc = new RTCPeerConnection({
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
    if (pc.remoteDescription) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
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
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error("Failed to set remote answer:", err);
    }
  };

  const handleICECandidate = async ({ candidate, from }) => {
    const pc = peerConnections.current[from];
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("ICE add failed:", e);
    }
  };

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
          const pc = createPeerConnection(remoteUserId);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current.emit("offer", { offer, to: remoteUserId });
          } catch (err) {
            console.error("Error creating offer for", remoteUserId, err);
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

  return {
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
  };
}