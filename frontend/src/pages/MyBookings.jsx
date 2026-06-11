import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Card, CardContent, Stack, Avatar,
  Chip, Button, CircularProgress,
} from '@mui/material';
import { VideoCallRounded, MicRounded, CalendarTodayRounded, AccessTimeRounded, ReportProblemRounded, PhoneRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { getBookings, confirmBooking, cancelBooking } from '../api/calls';
import { useCallManager } from '../components/CallManager';

const STATUS_CHIP = {
  pending:   { label: 'Pending',   color: 'warning' },
  confirmed: { label: 'Confirmed', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'error' },
  completed: { label: 'Completed', color: 'default' },
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
  const statusConfig = STATUS_CHIP[booking.status] || STATUS_CHIP.pending;
  const joinable = canJoin(booking);

  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 2 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          {/* Left: avatar + info */}
          <Stack direction="row" spacing={2} alignItems="flex-start" flex={1} minWidth={0}>
            <Avatar
              src={other?.avatar_url || undefined}
              alt={displayName}
              sx={{ width: 44, height: 44, bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 'bold', flexShrink: 0 }}
            >
              {!other?.avatar_url && displayName[0]?.toUpperCase()}
            </Avatar>
            <Box minWidth={0}>
              <Typography variant="body2" fontWeight={600} noWrap>{displayName}</Typography>
              <Typography variant="caption" color="text.secondary">@{other?.username}</Typography>
              <Stack direction="row" flexWrap="wrap" spacing={1.5} mt={0.75}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <CalendarTodayRounded sx={{ fontSize: 13, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {scheduled.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <AccessTimeRounded sx={{ fontSize: 13, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {scheduled.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {booking.call_type === 'video'
                    ? <VideoCallRounded sx={{ fontSize: 13, color: 'text.secondary' }} />
                    : <MicRounded sx={{ fontSize: 13, color: 'text.secondary' }} />}
                  <Typography variant="caption" color="text.secondary">
                    {booking.call_type === 'video' ? 'Video' : 'Audio'} &middot; {booking.duration_minutes} min
                  </Typography>
                </Stack>
              </Stack>
              {booking.notes && (
                <Typography variant="caption" color="text.secondary" fontStyle="italic" sx={{ mt: 0.5, display: 'block' }}>
                  &ldquo;{booking.notes}&rdquo;
                </Typography>
              )}
            </Box>
          </Stack>

          {/* Right: status + price */}
          <Stack alignItems="flex-end" spacing={1} flexShrink={0}>
            <Chip
              label={statusConfig.label}
              color={statusConfig.color}
              size="small"
              variant="outlined"
            />
            {booking.total_price_cents != null && (
              <Typography variant="body2" fontWeight={700} color="primary">
                ${(booking.total_price_cents / 100).toFixed(2)}
              </Typography>
            )}
          </Stack>
        </Stack>

        {/* Actions */}
        {(isCreator && booking.status === 'pending') || (!isCreator && booking.status === 'pending') || booking.status === 'confirmed' ? (
          <Stack direction="row" spacing={1} mt={2}>
            {isCreator && booking.status === 'pending' && (
              <>
                <Button
                  variant="outlined"
                  color="success"
                  size="small"
                  onClick={() => onConfirm(booking.id)}
                >
                  Confirm
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => onCancel(booking.id)}
                >
                  Decline
                </Button>
              </>
            )}
            {!isCreator && booking.status === 'pending' && (
              <Button variant="outlined" color="error" size="small" onClick={() => onCancel(booking.id)}>
                Cancel
              </Button>
            )}
            {booking.status === 'confirmed' && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                disabled={!joinable}
                onClick={() => onJoin(booking)}
                startIcon={<PhoneRounded fontSize="small" />}
                title={!joinable ? 'Available 5 minutes before the call' : ''}
              >
                Join Call
              </Button>
            )}
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function MyBookings() {
  const { user } = useAuth();
  const { initiateCall } = useCallManager() || {};
  const [tab, setTab] = useState(0);
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
  const pendingIncoming = incomingBookings.filter((b) => b.status === 'pending').length;

  const isCreatorTab = user?.is_creator ? tab === 1 : false;
  const displayed = isCreatorTab ? incomingBookings : myBookings;

  return (
    <Box maxWidth={700} mx="auto" px={3} py={3}>
      <Typography variant="h5" fontWeight="bold" mb={2}>
        My Bookings
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        textColor="primary"
        indicatorColor="primary"
        sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Tab label="Upcoming" />
        {user?.is_creator && (
          <Tab
            label={
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <span>As Creator</span>
                {pendingIncoming > 0 && (
                  <Chip label={pendingIncoming} color="primary" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                )}
              </Stack>
            }
          />
        )}
        <Tab label="History" />
      </Tabs>

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress color="primary" />
        </Box>
      ) : displayed.length === 0 ? (
        <Box textAlign="center" py={8}>
          <ReportProblemRounded sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" color="text.secondary" fontWeight={600} gutterBottom>
            No bookings found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isCreatorTab ? 'No one has booked a call with you yet.' : 'Browse creators to book a call.'}
          </Typography>
        </Box>
      ) : (
        displayed.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            isCreator={isCreatorTab}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onJoin={handleJoin}
          />
        ))
      )}
    </Box>
  );
}
