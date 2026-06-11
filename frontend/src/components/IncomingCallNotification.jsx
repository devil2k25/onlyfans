import { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, Mic } from 'lucide-react';

export default function IncomingCallNotification({ session, caller, callType, onAccept, onReject }) {
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onReject && onReject();
    }, 30000);
    return () => clearTimeout(timerRef.current);
  }, [onReject]);

  const displayName = caller?.display_name || caller?.username || 'Unknown';
  const avatarLetter = displayName[0]?.toUpperCase() || '?';

  return (
    <div
      className="fixed bottom-6 right-6 z-[300] w-80 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden"
      style={{ animation: 'slideInRight 0.3s ease-out' }}
    >
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-1 bg-[#00b8ff]/10 border-b border-[#2a2a2a] px-4 py-2">
        {callType === 'video' ? (
          <Video size={14} className="text-[#00b8ff]" />
        ) : (
          <Mic size={14} className="text-[#00b8ff]" />
        )}
        <span className="text-[#00b8ff] text-xs font-semibold uppercase tracking-wide ml-1">
          Incoming {callType === 'video' ? 'Video' : 'Audio'} Call
        </span>
      </div>

      {/* Caller info */}
      <div className="flex items-center gap-3 px-4 py-4">
        {caller?.avatar_url ? (
          <img
            src={caller.avatar_url}
            alt={displayName}
            className="w-12 h-12 rounded-full object-cover border-2 border-[#00b8ff]"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#00b8ff] flex items-center justify-center text-white text-xl font-bold shrink-0">
            {avatarLetter}
          </div>
        )}
        <div className="overflow-hidden">
          <p className="text-white font-semibold truncate">{displayName}</p>
          <p className="text-gray-400 text-xs">@{caller?.username}</p>
        </div>
        {/* Pulse animation */}
        <div className="ml-auto shrink-0">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 px-4 pb-4">
        <button
          onClick={onReject}
          className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/40 text-red-400 font-semibold rounded-xl py-2.5 transition-colors text-sm"
        >
          <PhoneOff size={16} />
          Reject
        </button>
        <button
          onClick={onAccept}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-400 font-semibold rounded-xl py-2.5 transition-colors text-sm"
        >
          <Phone size={16} />
          Accept
        </button>
      </div>
    </div>
  );
}
