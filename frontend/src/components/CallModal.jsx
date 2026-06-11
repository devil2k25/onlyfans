import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function CallModal({ session, targetUser, callType, isIncoming, onEnd }) {
  const { socket } = useSocket();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const [callState, setCallState] = useState(isIncoming ? 'incoming' : 'connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef(null);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  }, []);

  const endCall = useCallback(() => {
    if (socket && session) {
      socket.emit('call:end', { sessionId: session.id, targetUserId: targetUser?.id });
    }
    cleanup();
    onEnd && onEnd();
  }, [socket, session, targetUser, cleanup, onEnd]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('call:ice-candidate', {
          sessionId: session?.id,
          targetUserId: targetUser?.id,
          candidate: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('active');
        startTimer();
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        cleanup();
        onEnd && onEnd();
      }
    };

    return pc;
  }, [socket, session, targetUser, startTimer, cleanup, onEnd]);

  const getLocalMedia = useCallback(async () => {
    try {
      const constraints =
        callType === 'video'
          ? { video: true, audio: true }
          : { video: false, audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Failed to get local media:', err);
      return null;
    }
  }, [callType]);

  // Outgoing call flow
  useEffect(() => {
    if (isIncoming || !socket || !session) return;

    let cancelled = false;

    const startOutgoing = async () => {
      const stream = await getLocalMedia();
      if (!stream || cancelled) return;

      const pc = createPeerConnection();
      pcRef.current = pc;

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call:offer', {
        sessionId: session.id,
        targetUserId: targetUser?.id,
        offer,
      });
    };

    startOutgoing();

    return () => {
      cancelled = true;
    };
  }, [isIncoming, socket, session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleAnswer = async ({ answer }) => {
      if (pcRef.current && answer) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleOffer = async ({ offer, callerSocketId }) => {
      if (!isIncoming || callState !== 'accepting') return;
      const pc = pcRef.current;
      if (!pc || !offer) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:answer', {
        sessionId: session?.id,
        targetUserId: targetUser?.id,
        answer,
      });
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (pcRef.current && candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      }
    };

    const handleCallEnded = () => {
      cleanup();
      onEnd && onEnd();
    };

    socket.on('call:answer', handleAnswer);
    socket.on('call:offer', handleOffer);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:ended', handleCallEnded);

    return () => {
      socket.off('call:answer', handleAnswer);
      socket.off('call:offer', handleOffer);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:ended', handleCallEnded);
    };
  }, [socket, isIncoming, callState, session, targetUser, cleanup, onEnd]);

  const handleAccept = useCallback(async () => {
    setCallState('accepting');
    const stream = await getLocalMedia();
    if (!stream) return;

    const pc = createPeerConnection();
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    // Signal readiness to caller
    socket?.emit('call:accept', {
      sessionId: session?.id,
      targetUserId: targetUser?.id,
    });
  }, [getLocalMedia, createPeerConnection, socket, session, targetUser]);

  const handleReject = useCallback(() => {
    socket?.emit('call:reject', {
      sessionId: session?.id,
      targetUserId: targetUser?.id,
    });
    cleanup();
    onEnd && onEnd();
  }, [socket, session, targetUser, cleanup, onEnd]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsMuted((m) => !m);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsVideoOff((v) => !v);
    }
  };

  const displayName = targetUser?.display_name || targetUser?.username || 'Unknown';
  const avatarLetter = displayName[0]?.toUpperCase() || '?';

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center">
      <div className="relative w-full h-full md:w-[640px] md:h-[480px] md:rounded-2xl overflow-hidden bg-[#0a0a0a] border border-[#2a2a2a]">

        {/* Remote video / audio placeholder */}
        {callType === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            {targetUser?.avatar_url ? (
              <img
                src={targetUser.avatar_url}
                alt={displayName}
                className="w-32 h-32 rounded-full object-cover border-4 border-[#00b8ff]"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-[#00b8ff] flex items-center justify-center text-white text-5xl font-bold">
                {avatarLetter}
              </div>
            )}
            <p className="text-white text-2xl font-semibold">{displayName}</p>
            {callType === 'audio' && (
              <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
            )}
          </div>
        )}

        {/* Status overlay */}
        <div className="absolute top-4 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none">
          <p className="text-white font-semibold text-lg drop-shadow">{displayName}</p>
          <p className="text-gray-300 text-sm drop-shadow">
            {callState === 'connecting' && 'Calling…'}
            {callState === 'incoming' && 'Incoming call'}
            {callState === 'accepting' && 'Connecting…'}
            {callState === 'active' && formatDuration(duration)}
          </p>
        </div>

        {/* Local video (picture-in-picture) */}
        {callType === 'video' && (
          <div className="absolute bottom-24 right-4 w-28 h-20 rounded-lg overflow-hidden border-2 border-[#2a2a2a] bg-[#1a1a1a]">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Incoming call buttons */}
        {callState === 'incoming' && (
          <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-16">
            <button
              onClick={handleReject}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors shadow-lg"
              title="Reject"
            >
              <PhoneOff size={28} className="text-white" />
            </button>
            <button
              onClick={handleAccept}
              className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center transition-colors shadow-lg"
              title="Accept"
            >
              <Phone size={28} className="text-white" />
            </button>
          </div>
        )}

        {/* In-call controls */}
        {callState !== 'incoming' && (
          <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-4">
            <button
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-[#2a2a2a] hover:bg-[#3a3a3a]'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <MicOff size={20} className="text-white" />
              ) : (
                <Mic size={20} className="text-white" />
              )}
            </button>

            {callType === 'video' && (
              <button
                onClick={toggleVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  isVideoOff ? 'bg-red-600 hover:bg-red-500' : 'bg-[#2a2a2a] hover:bg-[#3a3a3a]'
                }`}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
              >
                {isVideoOff ? (
                  <VideoOff size={20} className="text-white" />
                ) : (
                  <Video size={20} className="text-white" />
                )}
              </button>
            )}

            <button
              onClick={endCall}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors shadow-lg"
              title="End call"
            >
              <PhoneOff size={24} className="text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
