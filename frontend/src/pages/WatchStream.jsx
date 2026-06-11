import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Send, Users, Lock, Clock } from 'lucide-react';
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

  // Fetch stream
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

  // Join and handle WebRTC for live stream
  useEffect(() => {
    if (!socket || !streamData || streamData.status !== 'live' || joined) return;

    setJoined(true);
    socket.emit('stream:viewer-join', { streamId: streamData.id });

    const handleOffer = async ({ offer }) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Add a transceiver to receive video/audio
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
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-[#00b8ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!streamData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-center">
          <p className="text-white text-lg font-semibold mb-2">Stream not found</p>
          <Link to="/streams" className="text-[#00b8ff] hover:underline text-sm">Browse streams</Link>
        </div>
      </div>
    );
  }

  // Payment wall for paid streams
  const isPaidAndNotSubscribed = streamData.is_paid && !streamData.is_subscribed && streamData.creator_id !== user?.id;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col md:flex-row">
      {/* Video area */}
      <div className="relative flex-1 min-h-[50vh] md:min-h-screen bg-black flex items-center justify-center">

        {streamData.status === 'scheduled' && (
          <div className="text-center p-8">
            <div className="w-16 h-16 rounded-full bg-[#00b8ff]/10 border border-[#00b8ff]/30 flex items-center justify-center mx-auto mb-4">
              <Clock size={28} className="text-[#00b8ff]" />
            </div>
            <p className="text-white text-xl font-bold mb-2">{streamData.title}</p>
            <p className="text-gray-400 text-sm mb-4">Stream starts in</p>
            <p className="text-[#00b8ff] text-4xl font-mono font-bold">{countdown || 'Soon'}</p>
            <p className="text-gray-500 text-sm mt-2">
              {new Date(streamData.scheduled_at).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}

        {streamData.status === 'live' && isPaidAndNotSubscribed && (
          <div className="text-center p-8">
            <Lock size={48} className="text-gray-500 mx-auto mb-4" />
            <p className="text-white text-xl font-bold mb-2">Paid Stream</p>
            <p className="text-gray-400 mb-4">Subscribe to {streamData.creator?.display_name || streamData.creator?.username} to watch this stream.</p>
            <Link
              to={`/${streamData.creator?.username}`}
              className="bg-[#00b8ff] hover:bg-[#0099d4] text-white font-semibold rounded-xl px-6 py-3 transition-colors inline-block"
            >
              View Profile
            </Link>
          </div>
        )}

        {streamData.status === 'live' && !isPaidAndNotSubscribed && (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Status badges */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              {!streamEnded ? (
                <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                </span>
              ) : (
                <span className="bg-[#2a2a2a] text-gray-300 text-xs font-bold px-2.5 py-1 rounded-full">ENDED</span>
              )}
            </div>
            {streamEnded && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-white text-2xl font-bold mb-2">Stream Ended</p>
                  <Link to="/streams" className="text-[#00b8ff] hover:underline text-sm">Browse other streams</Link>
                </div>
              </div>
            )}
          </>
        )}

        {streamData.status === 'ended' && (
          <div className="text-center p-8">
            <p className="text-white text-xl font-bold mb-2">Stream Ended</p>
            <Link to="/streams" className="text-[#00b8ff] hover:underline text-sm">Browse other streams</Link>
          </div>
        )}

        {/* Stream title overlay */}
        {streamData.status === 'live' && (
          <div className="absolute bottom-4 left-4">
            <p className="text-white font-bold drop-shadow">{streamData.title}</p>
            <p className="text-gray-300 text-xs drop-shadow">
              by {streamData.creator?.display_name || streamData.creator?.username}
            </p>
          </div>
        )}
      </div>

      {/* Chat panel */}
      <div className="w-full md:w-80 bg-[#1a1a1a] border-l border-[#2a2a2a] flex flex-col">
        <div className="p-4 border-b border-[#2a2a2a]">
          <p className="text-white font-semibold flex items-center gap-2">
            <Users size={16} className="text-[#00b8ff]" />
            {streamData.viewer_count != null ? `${streamData.viewer_count} watching` : 'Live Chat'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
          {chatMessages.length === 0 && (
            <p className="text-gray-600 text-sm text-center mt-4">No messages yet</p>
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

        {user ? (
          <div className="p-3 border-t border-[#2a2a2a] flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Say something…"
              disabled={streamEnded || isPaidAndNotSubscribed}
              className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#00b8ff] transition-colors disabled:opacity-40"
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim() || streamEnded || isPaidAndNotSubscribed}
              className="bg-[#00b8ff] hover:bg-[#0099d4] disabled:opacity-40 text-white rounded-xl px-3 py-2 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        ) : (
          <div className="p-3 border-t border-[#2a2a2a] text-center">
            <Link to="/login" className="text-[#00b8ff] hover:underline text-sm">Log in to chat</Link>
          </div>
        )}
      </div>
    </div>
  );
}
