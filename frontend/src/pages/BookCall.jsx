import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, Video, Mic, ChevronLeft, CheckCircle } from 'lucide-react';
import { getProfile } from '../api/users';
import { getAvailability, createBooking } from '../api/calls';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
];

function getWeekDates(offset = 0) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function BookCall() {
  const { creatorId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [duration, setDuration] = useState(30);
  const [callType, setCallType] = useState('video');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, availRes] = await Promise.all([
          getProfile(creatorId),
          getAvailability(creatorId),
        ]);
        if (profileRes.data.success) setProfile(profileRes.data.data);
        if (availRes.data.success) setAvailability(availRes.data.data || []);
      } catch {}
      setLoading(false);
    };
    fetchData();
  }, [creatorId]);

  const weekDates = getWeekDates(weekOffset);

  const slotsForDate = (date) => {
    if (!date) return [];
    const dayName = DAYS[date.getDay()];
    return availability.filter((slot) => slot.day_of_week === dayName || slot.date === date.toISOString().slice(0, 10));
  };

  const ratePerMin = callType === 'video'
    ? (profile?.video_call_rate_cents || 0) / 100 / 60
    : (profile?.audio_call_rate_cents || 0) / 100 / 60;
  const price = (ratePerMin * duration).toFixed(2);

  const handleBook = async () => {
    if (!selectedDate || !selectedSlot) {
      setError('Please select a date and time slot.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const scheduledAt = new Date(selectedDate);
      const [hours, minutes] = (selectedSlot.start_time || '00:00').split(':');
      scheduledAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      await createBooking({
        creator_id: profile.id,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: duration,
        call_type: callType,
        notes,
      });
      setConfirmed(true);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to book call. Please try again.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-[#00b8ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <p className="text-gray-400">Creator not found.</p>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8 max-w-md w-full text-center">
          <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-white text-2xl font-bold mb-2">Booking Confirmed!</h2>
          <p className="text-gray-400 mb-2">
            Your {callType} call with{' '}
            <span className="text-white font-semibold">{profile.display_name || profile.username}</span>{' '}
            has been requested.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            {selectedDate?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}{' '}
            at {selectedSlot?.start_time} · {duration} min · ${price}
          </p>
          <button
            onClick={() => navigate('/bookings')}
            className="bg-[#00b8ff] hover:bg-[#0099d4] text-white font-semibold rounded-xl px-6 py-3 transition-colors w-full"
          >
            View My Bookings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 text-sm"
        >
          <ChevronLeft size={18} />
          Back
        </button>

        {/* Creator header */}
        <div className="flex items-center gap-4 mb-8">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.display_name} className="w-14 h-14 rounded-full object-cover border-2 border-[#00b8ff]" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#00b8ff] flex items-center justify-center text-white text-2xl font-bold">
              {(profile.display_name || profile.username || 'U')[0].toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-white text-xl font-bold">Book a Call</h1>
            <p className="text-gray-400 text-sm">with {profile.display_name || profile.username}</p>
          </div>
        </div>

        {/* Call Type */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 mb-4">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Mic size={18} className="text-[#00b8ff]" /> Call Type
          </h2>
          <div className="flex gap-3">
            {(['video', 'audio']).map((type) => (
              <button
                key={type}
                onClick={() => setCallType(type)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition-colors ${
                  callType === type
                    ? 'border-[#00b8ff] bg-[#00b8ff]/10 text-[#00b8ff]'
                    : 'border-[#2a2a2a] text-gray-400 hover:border-[#3a3a3a] hover:text-white'
                }`}
              >
                {type === 'video' ? <Video size={16} /> : <Mic size={16} />}
                {type.charAt(0).toUpperCase() + type.slice(1)} Call
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 mb-4">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Clock size={18} className="text-[#00b8ff]" /> Duration
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setDuration(value)}
                className={`py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  duration === value
                    ? 'border-[#00b8ff] bg-[#00b8ff]/10 text-[#00b8ff]'
                    : 'border-[#2a2a2a] text-gray-400 hover:border-[#3a3a3a] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Weekly Calendar */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Calendar size={18} className="text-[#00b8ff]" /> Select Date
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setWeekOffset((w) => w - 1)}
                disabled={weekOffset <= 0}
                className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors px-2"
              >
                &lsaquo;
              </button>
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="text-gray-400 hover:text-white transition-colors px-2"
              >
                &rsaquo;
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs text-gray-500 pb-2">{d}</div>
            ))}
            {weekDates.map((date) => {
              const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
              const slots = slotsForDate(date);
              const hasSlots = slots.length > 0;
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => {
                    if (!isPast && hasSlots) {
                      setSelectedDate(date);
                      setSelectedSlot(null);
                    }
                  }}
                  disabled={isPast || !hasSlots}
                  className={`aspect-square rounded-xl text-sm font-semibold transition-colors flex flex-col items-center justify-center gap-0.5 ${
                    isSelected
                      ? 'bg-[#00b8ff] text-white'
                      : hasSlots && !isPast
                      ? 'bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]'
                      : 'text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <span>{date.getDate()}</span>
                  {hasSlots && !isPast && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-[#00b8ff]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
              <p className="text-gray-400 text-sm mb-3">
                Available slots for {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {slotsForDate(selectedDate).map((slot, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2 rounded-xl border text-sm font-semibold transition-colors ${
                      selectedSlot === slot
                        ? 'border-[#00b8ff] bg-[#00b8ff]/10 text-[#00b8ff]'
                        : 'border-[#2a2a2a] text-gray-300 hover:border-[#3a3a3a] hover:text-white'
                    }`}
                  >
                    {slot.start_time}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 mb-4">
          <h2 className="text-white font-semibold mb-3">Notes (optional)</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What would you like to discuss?"
            rows={3}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-[#00b8ff] transition-colors"
          />
        </div>

        {/* Price summary + Book */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">
              {duration} min {callType} call
            </span>
            <span className="text-white font-bold text-xl">${price}</span>
          </div>

          {error && (
            <p className="text-red-400 text-sm mb-3">{error}</p>
          )}

          <button
            onClick={handleBook}
            disabled={submitting || !selectedDate || !selectedSlot}
            className="w-full bg-[#00b8ff] hover:bg-[#0099d4] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3.5 transition-colors"
          >
            {submitting ? 'Booking…' : 'Book Call'}
          </button>
        </div>
      </div>
    </div>
  );
}
