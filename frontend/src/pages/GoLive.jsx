import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Users, Clock, Send, Eye, DollarSign, X } from 'lucide-react';
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
  const peerConnectionsRef = useRef(new Map()); // viewerSocketId -> RTCPeerConnection
  const timerRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Timer
  useEffect(() => {
    if (phase === 'live') {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Socket listeners for streaming
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

      // Get local video/audio
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerConnectionsRef.current.forEach((pc) => pc.close());
      clearInterval(timerRef.current);
    };
  }, []);

  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] py-8 px-4">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
              <Radio size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">Go Live</h1>
              <p className="text-gray-400 text-sm">Start a live stream for your fans</p>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col gap-5">
            {/* Title */}
            <div>
              <label className="text-gray-400 text-sm font-medium block mb-1.5">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's this stream about?"
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#00b8ff] transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-gray-400 text-sm font-medium block mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell your audience what to expect..."
                rows={3}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-[#00b8ff] transition-colors"
              />
            </div>

            {/* Paid toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-[#00b8ff]" />
                <span className="text-white text-sm font-medium">Paid Stream</span>
              </div>
              <button
                onClick={() => setIsPaid((p) => !p)}
                className={`w-12 h-6 rounded-full transition-colors relative ${isPaid ? 'bg-[#00b8ff]' : 'bg-[#2a2a2a]'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isPaid ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            {isPaid && (
              <div>
                <label className="text-gray-400 text-sm font-medium block mb-1.5">Price ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 4.99"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#00b8ff] transition-colors"
                />
              </div>
            )}

            {/* Schedule */}
            <div>
              <label className="text-gray-400 text-sm font-medium block mb-2">When</label>
              <div className="flex gap-2 mb-3">
                {[{ value: 'now', label: 'Start Now' }, { value: 'scheduled', label: 'Schedule' }].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setScheduleType(value)}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                      scheduleType === value
                        ? 'border-[#00b8ff] bg-[#00b8ff]/10 text-[#00b8ff]'
                        : 'border-[#2a2a2a] text-gray-400 hover:border-[#3a3a3a] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {scheduleType === 'scheduled' && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00b8ff] transition-colors"
                />
              )}
            </div>

            {setupError && <p className="text-red-400 text-sm">{setupError}</p>}

            <button
              onClick={handleStartStream}
              disabled={starting}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl py-4 flex items-center justify-center gap-2 transition-colors"
            >
              <Radio size={20} />
              {starting ? 'Starting…' : scheduleType === 'now' ? 'Go Live Now' : 'Schedule Stream'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Live phase
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col md:flex-row">
      {/* Video area */}
      <div className="relative flex-1 min-h-[50vh] md:min-h-screen bg-black">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Overlay top */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
            </span>
            <span className="bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Clock size={12} /> {formatDuration(duration)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Eye size={12} /> {viewerCount}
            </span>
          </div>
        </div>

        {/* Stream title */}
        <div className="absolute bottom-4 left-4">
          <p className="text-white font-bold text-lg drop-shadow">{stream?.title}</p>
        </div>

        {/* End stream button */}
        <button
          onClick={handleEndStream}
          disabled={ending}
          className="absolute bottom-4 right-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl px-4 py-2.5 flex items-center gap-2 transition-colors"
        >
          <X size={16} /> End Stream
        </button>
      </div>

      {/* Chat panel */}
      <div className="w-full md:w-80 bg-[#1a1a1a] border-l border-[#2a2a2a] flex flex-col">
        <div className="p-4 border-b border-[#2a2a2a]">
          <p className="text-white font-semibold flex items-center gap-2">
            <Users size={16} className="text-[#00b8ff]" /> Live Chat
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
          {chatMessages.length === 0 && (
            <p className="text-gray-600 text-sm text-center mt-4">Chat will appear here</p>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i} className="text-sm">
              <span className={`font-semibold mr-1 ${msg.isSelf ? 'text-[#00b8ff]' : 'text-white'}`}>
                {msg.sender?.display_name || msg.sender?.username}:
              </span>
              <span className="text-gray-300">{msg.message}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="p-3 border-t border-[#2a2a2a] flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            placeholder="Say something…"
            className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#00b8ff] transition-colors"
          />
          <button
            onClick={handleSendChat}
            disabled={!chatInput.trim()}
            className="bg-[#00b8ff] hover:bg-[#0099d4] disabled:opacity-40 text-white rounded-xl px-3 py-2 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
