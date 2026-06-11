import { useState, useEffect, useCallback } from 'react';
import { Video, Mic, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBookings, confirmBooking, cancelBooking } from '../api/calls';
import { useCallManager } from '../components/CallManager';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  confirmed: { label: 'Confirmed', color: 'text-green-400 bg-green-400/10 border-green-400/30' },
  cancelled: { label: 'Cancelled', color: 'text-red-400 bg-red-400/10 border-red-400/30' },
  completed: { label: 'Completed', color: 'text-gray-400 bg-gray-400/10 border-gray-400/30' },
};

function canJoin(booking) {
  if (booking.status !== 'confirmed') return false;
  const scheduled = new Date(booking.scheduled_at);
  const now = new Date();
  const diff = scheduled - now;
  return diff <= 5 * 60 * 1000 && diff > -60 * 60 * 1000;
}

function BookingCard({ booking, isCreator, onConfirm, onCancel, onJoin }) {
  const other = isCreator ? booking.subscriber : booking.creator;
  const displayName = other?.display_name || other?.username || 'Unknown';
  const scheduled = new Date(booking.scheduled_at);
  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const joinable = canJoin(booking);

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {other?.avatar_url ? (
            <img src={other.avatar_url} alt={displayName} className="w-11 h-11 rounded-full object-cover border-2 border-[#2a2a2a]" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[#00b8ff] flex items-center justify-center text-white font-bold text-lg shrink-0">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-white font-semibold text-sm">{displayName}</p>
            <p className="text-gray-500 text-xs">@{other?.username}</p>
          </div>
        </div>

        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </div>

      {/* Details */}
      <div className="flex flex-wrap gap-3 text-sm text-gray-400">
        <span className="flex items-center gap-1.5">
          <Calendar size={14} />
          {scheduled.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={14} />
          {scheduled.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="flex items-center gap-1.5">
          {booking.call_type === 'video' ? <Video size={14} /> : <Mic size={14} />}
          {booking.call_type === 'video' ? 'Video' : 'Audio'} · {booking.duration_minutes} min
        </span>
        {booking.total_price_cents != null && (
          <span className="text-[#00b8ff] font-semibold">
            ${(booking.total_price_cents / 100).toFixed(2)}
          </span>
        )}
      </div>

      {booking.notes && (
        <p className="text-gray-500 text-xs italic">"{booking.notes}"</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-1">
        {isCreator && booking.status === 'pending' && (
          <>
            <button
              onClick={() => onConfirm(booking.id)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-400 text-sm font-semibold rounded-xl py-2 transition-colors"
            >
              <CheckCircle size={14} /> Confirm
            </button>
            <button
              onClick={() => onCancel(booking.id)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/40 text-red-400 text-sm font-semibold rounded-xl py-2 transition-colors"
            >
              <XCircle size={14} /> Decline
            </button>
          </>
        )}

        {!isCreator && booking.status === 'pending' && (
          <button
            onClick={() => onCancel(booking.id)}
            className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/40 text-red-400 text-sm font-semibold rounded-xl px-4 py-2 transition-colors"
          >
            <XCircle size={14} /> Cancel
          </button>
        )}

        {booking.status === 'confirmed' && (
          <button
            onClick={() => onJoin(booking)}
            disabled={!joinable}
            title={!joinable ? 'Available 5 minutes before the call' : ''}
            className="flex items-center justify-center gap-1.5 bg-[#00b8ff]/20 hover:bg-[#00b8ff]/30 border border-[#00b8ff]/40 text-[#00b8ff] text-sm font-semibold rounded-xl px-5 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Phone size={14} /> Join Call
          </button>
        )}
      </div>
    </div>
  );
}

export default function MyBookings() {
  const { user } = useAuth();
  const { initiateCall } = useCallManager() || {};
  const [tab, setTab] = useState('mine');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBookings();
      if (res.data.success) setBookings(res.data.data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleConfirm = async (id) => {
    try {
      await confirmBooking(id);
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'confirmed' } : b));
    } catch {}
  };

  const handleCancel = async (id) => {
    try {
      await cancelBooking(id);
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'cancelled' } : b));
    } catch {}
  };

  const handleJoin = (booking) => {
    const other = user?.id === booking.creator_id ? booking.subscriber : booking.creator;
    initiateCall?.(other, booking.call_type);
  };

  const myBookings = bookings.filter((b) => b.subscriber_id === user?.id || b.creator_id !== user?.id);
  const incomingBookings = bookings.filter((b) => b.creator_id === user?.id);

  const displayed = tab === 'mine' ? myBookings : incomingBookings;

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-white text-2xl font-bold mb-6">Bookings</h1>

        {/* Tabs */}
        <div className="flex border-b border-[#2a2a2a] mb-6">
          <button
            onClick={() => setTab('mine')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'mine'
                ? 'border-[#00b8ff] text-[#00b8ff]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            My Bookings
          </button>
          {user?.is_creator && (
            <button
              onClick={() => setTab('incoming')}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === 'incoming'
                  ? 'border-[#00b8ff] text-[#00b8ff]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Incoming Bookings
              {incomingBookings.filter((b) => b.status === 'pending').length > 0 && (
                <span className="ml-2 bg-[#00b8ff] text-white text-xs font-bold rounded-full px-1.5 py-0.5">
                  {incomingBookings.filter((b) => b.status === 'pending').length}
                </span>
              )}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#00b8ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <AlertCircle size={40} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-semibold">No bookings found</p>
            <p className="text-gray-600 text-sm mt-1">
              {tab === 'mine' ? 'Browse creators to book a call.' : 'No one has booked a call with you yet.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {displayed.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                isCreator={tab === 'incoming'}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                onJoin={handleJoin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
