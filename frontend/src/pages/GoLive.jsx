import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Stack, Chip, IconButton, Fab,
  FormControlLabel, Switch, Paper, Divider, Button, CircularProgress, Alert,
} from '@mui/material';
import { SendRounded, StopRounded, VisibilityRounded, RadioRounded, AccessTimeRounded } from '@mui/icons-material';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { createStream, endStream } from '../api/streams';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function GoLive() {
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Setup form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [scheduleType, setScheduleType] = useState('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [starting, setStarting] = useState(false);
  const [setupError, setSetupError] = useState('');

  // Live state
  const [phase, setPhase] = useState('setup'); // 'setup' | 'live'
  const [stream, setStream] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [ending, setEnding] = useState(false);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const timerRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (phase === 'live') {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  useEffect(() => {
    if (!socket || phase !== 'live') return;

    const handleNewViewer = async ({ viewerSocketId }) => {
      setViewerCount((c) => c + 1);
      const localStream = localStreamRef.current;
      if (!localStream) return;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current.set(viewerSocketId, pc);

      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('stream:ice-candidate-to-viewer', {
            viewerSocketId,
            candidate: e.candidate,
            streamId: stream?.id,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
          peerConnectionsRef.current.delete(viewerSocketId);
          setViewerCount((c) => Math.max(0, c - 1));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('stream:offer-viewer', {
        viewerSocketId,
        offer,
        streamId: stream?.id,
      });
    };

    const handleAnswer = async ({ viewerSocketId, answer }) => {
      const pc = peerConnectionsRef.current.get(viewerSocketId);
      if (pc && answer) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleIceCandidate = async ({ viewerSocketId, candidate }) => {
      const pc = peerConnectionsRef.current.get(viewerSocketId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      }
    };

    const handleChatMessage = ({ message, sender, timestamp }) => {
      setChatMessages((prev) => [...prev, { message, sender, timestamp: timestamp || Date.now() }]);
    };

    const handleViewerLeft = ({ viewerSocketId }) => {
      const pc = peerConnectionsRef.current.get(viewerSocketId);
      if (pc) { pc.close(); peerConnectionsRef.current.delete(viewerSocketId); }
      setViewerCount((c) => Math.max(0, c - 1));
    };

    socket.on('stream:new-viewer', handleNewViewer);
    socket.on('stream:answer', handleAnswer);
    socket.on('stream:ice-candidate-from-viewer', handleIceCandidate);
    socket.on('stream:chat-message', handleChatMessage);
    socket.on('stream:viewer-left', handleViewerLeft);

    return () => {
      socket.off('stream:new-viewer', handleNewViewer);
      socket.off('stream:answer', handleAnswer);
      socket.off('stream:ice-candidate-from-viewer', handleIceCandidate);
      socket.off('stream:chat-message', handleChatMessage);
      socket.off('stream:viewer-left', handleViewerLeft);
    };
  }, [socket, phase, stream]);

  const handleStartStream = async () => {
    if (!title.trim()) { setSetupError('Title is required.'); return; }
    setSetupError('');
    setStarting(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        is_paid: isPaid,
        price_cents: isPaid ? Math.round(parseFloat(price || 0) * 100) : 0,
        scheduled_at: scheduleType === 'scheduled' ? scheduledAt : null,
      };
      const res = await createStream(payload);
      const newStream = res.data?.data || res.data;
      setStream(newStream);

      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = mediaStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }

      setPhase('live');

      if (scheduleType === 'now') {
        socket?.emit('stream:go-live', { streamId: newStream.id });
      }
    } catch (err) {
      setSetupError(err?.response?.data?.error || 'Failed to start stream.');
    }
    setStarting(false);
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || !socket) return;
    socket.emit('stream:chat', {
      streamId: stream?.id,
      message: chatInput.trim(),
    });
    setChatMessages((prev) => [
      ...prev,
      { message: chatInput.trim(), sender: { username: user?.username, display_name: user?.display_name }, timestamp: Date.now(), isSelf: true },
    ]);
    setChatInput('');
  };

  const handleEndStream = async () => {
    setEnding(true);
    try {
      socket?.emit('stream:end', { streamId: stream?.id });
      if (stream?.id) await endStream(stream.id);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      navigate(`/${user?.username}`);
    } catch {
      setEnding(false);
    }
  };

  const formatDuration = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerConnectionsRef.current.forEach((pc) => pc.close());
      clearInterval(timerRef.current);
    };
  }, []);

  if (phase === 'setup') {
    return (
      <Box maxWidth={600} mx="auto" px={3} py={3}>
        <Stack direction="row" alignItems="center" spacing={2} mb={4}>
          <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: 'error.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RadioRounded sx={{ color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight="bold">Go Live</Typography>
            <Typography variant="body2" color="text.secondary">Start a live stream for your fans</Typography>
          </Box>
        </Stack>

        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 3 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Stream Title"
              fullWidth
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's this stream about?"
            />

            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell your audience what to expect..."
            />

            <FormControlLabel
              control={<Switch checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} color="primary" />}
              label={<Typography variant="body2" fontWeight={500}>Paid Stream</Typography>}
            />

            {isPaid && (
              <TextField
                label="Ticket price ($)"
                type="number"
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 4.99"
              />
            )}

            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>When</Typography>
              <Stack direction="row" spacing={1} mb={1.5}>
                {[{ value: 'now', label: 'Start Now' }, { value: 'scheduled', label: 'Schedule' }].map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={scheduleType === value ? 'contained' : 'outlined'}
                    color={scheduleType === value ? 'primary' : 'inherit'}
                    onClick={() => setScheduleType(value)}
                    sx={{ flex: 1 }}
                  >
                    {label}
                  </Button>
                ))}
              </Stack>
              {scheduleType === 'scheduled' && (
                <TextField
                  type="datetime-local"
                  fullWidth
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              )}
            </Box>

            {setupError && <Alert severity="error">{setupError}</Alert>}

            <Button
              variant="contained"
              color="error"
              fullWidth
              size="large"
              onClick={handleStartStream}
              disabled={starting}
              startIcon={starting ? <CircularProgress size={18} color="inherit" /> : <RadioRounded />}
            >
              {starting ? 'Starting…' : scheduleType === 'now' ? 'Go Live Now' : 'Schedule Stream'}
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  // Live phase
  return (
    <Box display="flex" height="100vh" flexDirection={{ xs: 'column', md: 'row' }}>
      {/* Video panel */}
      <Box flex={1} position="relative" bgcolor="black" sx={{ minHeight: { xs: '50vh', md: '100vh' } }}>
        <Box
          component="video"
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* Overlay top */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Stack direction="row" spacing={1}>
            <Chip
              label="LIVE"
              color="error"
              size="small"
              icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'white', animation: 'pulse 1s infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />}
              sx={{ fontWeight: 700 }}
            />
            <Chip
              label={formatDuration(duration)}
              size="small"
              icon={<AccessTimeRounded sx={{ fontSize: 14 }} />}
              sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: 'white', '& .MuiChip-icon': { color: 'white' } }}
            />
          </Stack>
          <Chip
            label={`${viewerCount} viewers`}
            size="small"
            icon={<VisibilityRounded sx={{ fontSize: 14 }} />}
            sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: 'white', '& .MuiChip-icon': { color: 'white' } }}
          />
        </Box>

        {/* Stream title */}
        <Box sx={{ position: 'absolute', bottom: 80, left: 16 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            {stream?.title}
          </Typography>
        </Box>

        {/* End stream FAB */}
        <Box sx={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <Fab
            color="error"
            onClick={handleEndStream}
            disabled={ending}
            size="medium"
          >
            {ending ? <CircularProgress size={20} color="inherit" /> : <StopRounded />}
          </Fab>
        </Box>
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
          Live Chat
        </Typography>
        <Divider />

        <Box flex={1} overflow="auto" p={1.5} sx={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
          {chatMessages.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" mt={2}>
              Chat will appear here
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

        <Stack direction="row" spacing={1} p={1.5} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Say something…"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
          />
          <IconButton color="primary" onClick={handleSendChat} disabled={!chatInput.trim()}>
            <SendRounded />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
}
