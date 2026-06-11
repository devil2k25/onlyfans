import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Box, Typography, Stack, Chip, IconButton, TextField, Button,
  CircularProgress, Divider, Dialog, DialogTitle, DialogContent,
  DialogActions, Avatar,
} from '@mui/material';
import { SendRounded, VisibilityRounded, LockRounded, AccessTimeRounded } from '@mui/icons-material';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { getStream } from '../api/streams';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = new Date(targetDate) - new Date();
      if (diff <= 0) { setTimeLeft(''); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setTimeLeft(h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}

export default function WatchStream() {
  const { id } = useParams();
  const { socket } = useSocket();
  const { user } = useAuth();

  const [streamData, setStreamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streamEnded, setStreamEnded] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [joined, setJoined] = useState(false);

  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const chatEndRef = useRef(null);
  const countdown = useCountdown(streamData?.status === 'scheduled' ? streamData.scheduled_at : null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    const fetchStream = async () => {
      try {
        const res = await getStream(id);
        if (res.data.success) setStreamData(res.data.data);
      } catch {}
      setLoading(false);
    };
    fetchStream();
  }, [id]);

  useEffect(() => {
    if (!socket || !streamData || streamData.status !== 'live' || joined) return;

    setJoined(true);
    socket.emit('stream:viewer-join', { streamId: streamData.id });

    const handleOffer = async ({ offer }) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.ontrack = (e) => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('stream:ice-candidate-to-broadcaster', {
            streamId: streamData.id,
            candidate: e.candidate,
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('stream:answer', { streamId: streamData.id, answer });
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (pcRef.current && candidate) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
    };

    const handleStreamEnded = () => {
      setStreamEnded(true);
      pcRef.current?.close();
      pcRef.current = null;
    };

    const handleChatMessage = ({ message, sender, timestamp }) => {
      setChatMessages((prev) => [...prev, { message, sender, timestamp }]);
    };

    socket.on('stream:offer', handleOffer);
    socket.on('stream:ice-candidate-from-broadcaster', handleIceCandidate);
    socket.on('stream:ended', handleStreamEnded);
    socket.on('stream:chat-message', handleChatMessage);

    return () => {
      socket.off('stream:offer', handleOffer);
      socket.off('stream:ice-candidate-from-broadcaster', handleIceCandidate);
      socket.off('stream:ended', handleStreamEnded);
      socket.off('stream:chat-message', handleChatMessage);
      pcRef.current?.close();
    };
  }, [socket, streamData, joined]);

  const handleSendChat = () => {
    if (!chatInput.trim() || !socket) return;
    socket.emit('stream:chat', { streamId: streamData?.id, message: chatInput.trim() });
    setChatMessages((prev) => [
      ...prev,
      { message: chatInput.trim(), sender: { username: user?.username, display_name: user?.display_name }, timestamp: Date.now(), isSelf: true },
    ]);
    setChatInput('');
  };

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!streamData) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <Box textAlign="center">
          <Typography variant="h6" gutterBottom>Stream not found</Typography>
          <Typography component={Link} to="/streams" color="primary" variant="body2">
            Browse streams
          </Typography>
        </Box>
      </Box>
    );
  }

  const isPaidAndNotSubscribed = streamData.is_paid && !streamData.is_subscribed && streamData.creator_id !== user?.id;

  return (
    <Box display="flex" height="100vh" flexDirection={{ xs: 'column', md: 'row' }}>
      {/* Video panel */}
      <Box
        flex={1}
        position="relative"
        bgcolor="black"
        display="flex"
        alignItems="center"
        justifyContent="center"
        sx={{ minHeight: { xs: '50vh', md: '100vh' } }}
      >
        {/* Scheduled countdown */}
        {streamData.status === 'scheduled' && (
          <Box textAlign="center" p={4}>
            <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'rgba(0,184,255,0.1)', border: '1px solid rgba(0,184,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <AccessTimeRounded color="primary" sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="h5" fontWeight="bold" color="white" gutterBottom>
              {streamData.title}
            </Typography>
            <Typography variant="body2" color="grey.400" mb={2}>Stream starts in</Typography>
            <Typography variant="h3" fontWeight="bold" color="primary" fontFamily="monospace">
              {countdown || 'Soon'}
            </Typography>
            <Typography variant="body2" color="grey.500" mt={1}>
              {new Date(streamData.scheduled_at).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        )}

        {/* Payment wall */}
        {streamData.status === 'live' && isPaidAndNotSubscribed && (
          <Box textAlign="center" p={4}>
            <LockRounded sx={{ fontSize: 64, color: 'grey.500', mb: 2 }} />
            <Typography variant="h5" fontWeight="bold" color="white" gutterBottom>Paid Stream</Typography>
            <Typography variant="body1" color="grey.400" mb={3}>
              Subscribe to {streamData.creator?.display_name || streamData.creator?.username} to watch this stream.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              component={Link}
              to={`/${streamData.creator?.username}`}
            >
              View Profile
            </Button>
          </Box>
        )}

        {/* Live video */}
        {streamData.status === 'live' && !isPaidAndNotSubscribed && (
          <>
            <Box
              component="video"
              ref={remoteVideoRef}
              autoPlay
              playsInline
              sx={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, display: 'block' }}
            />

            {/* Top badges */}
            <Box sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 1, zIndex: 1 }}>
              {!streamEnded ? (
                <Chip
                  label="LIVE"
                  color="error"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              ) : (
                <Chip label="ENDED" size="small" sx={{ bgcolor: '#2a2a2a', color: 'grey.300', fontWeight: 700 }} />
              )}
            </Box>

            {/* Stream ended overlay */}
            {streamEnded && (
              <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <Box textAlign="center">
                  <Typography variant="h4" fontWeight="bold" color="white" gutterBottom>Stream Ended</Typography>
                  <Typography component={Link} to="/streams" color="primary" variant="body2">
                    Browse other streams
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Stream info overlay */}
            {!streamEnded && (
              <Box sx={{ position: 'absolute', bottom: 16, left: 16, zIndex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                  <Avatar
                    src={streamData.creator?.avatar_url || undefined}
                    sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.75rem', fontWeight: 'bold' }}
                  >
                    {(streamData.creator?.display_name || streamData.creator?.username || 'C')[0].toUpperCase()}
                  </Avatar>
                  <Typography variant="body2" color="white" fontWeight={600} sx={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                    {streamData.creator?.display_name || streamData.creator?.username}
                  </Typography>
                  {streamData.viewer_count != null && (
                    <Chip
                      label={`${streamData.viewer_count}`}
                      size="small"
                      icon={<VisibilityRounded sx={{ fontSize: 12, color: 'white !important' }} />}
                      sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: 'white', height: 22, fontSize: '0.7rem' }}
                    />
                  )}
                </Stack>
                <Typography variant="body1" fontWeight="bold" color="white" sx={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                  {streamData.title}
                </Typography>
              </Box>
            )}
          </>
        )}

        {/* Ended status */}
        {streamData.status === 'ended' && (
          <Box textAlign="center" p={4}>
            <Typography variant="h5" fontWeight="bold" color="white" gutterBottom>Stream Ended</Typography>
            <Typography component={Link} to="/streams" color="primary" variant="body2">
              Browse other streams
            </Typography>
          </Box>
        )}
      </Box>

      {/* Chat panel */}
      <Box
        sx={{
          width: { xs: '100%', md: 320 },
          borderLeft: { md: '1px solid' },
          borderTop: { xs: '1px solid', md: 'none' },
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="body1" fontWeight={600} p={2}>
          {streamData.viewer_count != null ? `${streamData.viewer_count} watching` : 'Live Chat'}
        </Typography>
        <Divider />

        <Box flex={1} overflow="auto" p={1.5} sx={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
          {chatMessages.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" mt={2}>
              No messages yet
            </Typography>
          )}
          {chatMessages.map((msg, i) => (
            <Typography key={i} variant="body2">
              <Typography
                component="span"
                variant="body2"
                fontWeight={700}
                color={msg.isSelf ? 'primary.main' : 'text.primary'}
                mr={0.5}
              >
                {msg.sender?.display_name || msg.sender?.username}:
              </Typography>
              <Typography component="span" variant="body2" color="text.secondary">
                {msg.message}
              </Typography>
            </Typography>
          ))}
          <div ref={chatEndRef} />
        </Box>

        {user ? (
          <Stack direction="row" spacing={1} p={1.5} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Say something…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              disabled={streamEnded || isPaidAndNotSubscribed}
            />
            <IconButton
              color="primary"
              onClick={handleSendChat}
              disabled={!chatInput.trim() || streamEnded || isPaidAndNotSubscribed}
            >
              <SendRounded />
            </IconButton>
          </Stack>
        ) : (
          <Box p={2} sx={{ borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
            <Typography component={Link} to="/login" color="primary" variant="body2">
              Log in to chat
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
