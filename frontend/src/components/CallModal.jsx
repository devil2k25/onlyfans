import { useEffect, useRef, useState, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Fab from '@mui/material/Fab';
import Avatar from '@mui/material/Avatar';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import PhoneIcon from '@mui/icons-material/Phone';
import PhoneDisabledIcon from '@mui/icons-material/PhoneDisabled';
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
    <Dialog
      open
      fullScreen
      PaperProps={{ sx: { bgcolor: '#000' } }}
    >
      <Box sx={{ position: 'relative', width: '100%', height: '100%', bgcolor: '#0a0a0a' }}>
        {/* Remote video / audio placeholder */}
        {callType === 'video' ? (
          <Box
            component="video"
            ref={remoteVideoRef}
            autoPlay
            playsInline
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <Avatar
              src={targetUser?.avatar_url || undefined}
              sx={{
                width: 128,
                height: 128,
                bgcolor: 'primary.main',
                color: '#000',
                fontSize: '3rem',
                fontWeight: 700,
                border: '4px solid',
                borderColor: 'primary.main',
              }}
            >
              {!targetUser?.avatar_url && avatarLetter}
            </Avatar>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600 }}>
              {displayName}
            </Typography>
            {/* Hidden audio element for audio calls */}
            <Box
              component="video"
              ref={remoteVideoRef}
              autoPlay
              playsInline
              sx={{ display: 'none' }}
            />
          </Box>
        )}

        {/* Status overlay */}
        <Box
          sx={{
            position: 'absolute',
            top: 24,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            pointerEvents: 'none',
          }}
        >
          <Typography
            variant="h6"
            sx={{ color: '#fff', fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
          >
            {displayName}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'rgba(255,255,255,0.8)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
          >
            {callState === 'connecting' && 'Calling…'}
            {callState === 'incoming' && 'Incoming call'}
            {callState === 'accepting' && 'Connecting…'}
            {callState === 'active' && formatDuration(duration)}
          </Typography>
        </Box>

        {/* Local video (picture-in-picture) */}
        {callType === 'video' && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 112,
              right: 16,
              width: 112,
              height: 80,
              borderRadius: 2,
              overflow: 'hidden',
              border: '2px solid #2a2a2a',
              bgcolor: '#1a1a1a',
            }}
          >
            <Box
              component="video"
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
        )}

        {/* Incoming call buttons */}
        {callState === 'incoming' && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 48,
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Fab
              onClick={handleReject}
              size="large"
              sx={{ bgcolor: '#d32f2f', '&:hover': { bgcolor: '#b71c1c' }, color: '#fff' }}
              title="Reject"
            >
              <PhoneDisabledIcon />
            </Fab>
            <Fab
              onClick={handleAccept}
              size="large"
              sx={{ bgcolor: '#388e3c', '&:hover': { bgcolor: '#2e7d32' }, color: '#fff' }}
              title="Accept"
            >
              <PhoneIcon />
            </Fab>
          </Box>
        )}

        {/* In-call controls */}
        {callState !== 'incoming' && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 48,
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <IconButton
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
              sx={{
                width: 52,
                height: 52,
                bgcolor: isMuted ? '#d32f2f' : '#2a2a2a',
                color: '#fff',
                '&:hover': { bgcolor: isMuted ? '#b71c1c' : '#3a3a3a' },
              }}
            >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
            </IconButton>

            {callType === 'video' && (
              <IconButton
                onClick={toggleVideo}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                sx={{
                  width: 52,
                  height: 52,
                  bgcolor: isVideoOff ? '#d32f2f' : '#2a2a2a',
                  color: '#fff',
                  '&:hover': { bgcolor: isVideoOff ? '#b71c1c' : '#3a3a3a' },
                }}
              >
                {isVideoOff ? <VideocamOffIcon /> : <VideocamIcon />}
              </IconButton>
            )}

            <Fab
              onClick={endCall}
              size="large"
              sx={{ bgcolor: '#d32f2f', '&:hover': { bgcolor: '#b71c1c' }, color: '#fff' }}
              title="End call"
            >
              <CallEndIcon />
            </Fab>
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
