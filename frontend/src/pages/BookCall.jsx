import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Avatar, Button, Card, CardContent, Stack,
  Chip, TextField, CircularProgress, Alert, Paper, Grid,
  ToggleButtonGroup, ToggleButton, Stepper, Step, StepLabel,
  Divider,
} from '@mui/material';
import { VideoCallRounded, MicRounded, CheckCircleOutlineRounded, ChevronLeftRounded } from '@mui/icons-material';
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

const STEPS = ['Choose Time', 'Details', 'Confirm'];

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
  const [activeStep, setActiveStep] = useState(0);

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
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <Typography color="text.secondary">Creator not found.</Typography>
      </Box>
    );
  }

  if (confirmed) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh" px={2}>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 4, maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <CheckCircleOutlineRounded sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" fontWeight="bold" gutterBottom>Booking Confirmed!</Typography>
          <Typography variant="body1" color="text.secondary" mb={1}>
            Your {callType} call with{' '}
            <Typography component="span" fontWeight={600} color="text.primary">
              {profile.display_name || profile.username}
            </Typography>{' '}
            has been requested.
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {selectedDate?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}{' '}
            at {selectedSlot?.start_time} &middot; {duration} min &middot; ${price}
          </Typography>
          <Button variant="contained" fullWidth onClick={() => navigate('/bookings')}>
            View My Bookings
          </Button>
        </Card>
      </Box>
    );
  }

  return (
    <Box maxWidth={700} mx="auto" px={3} py={3}>
      <Button
        startIcon={<ChevronLeftRounded />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2, color: 'text.secondary' }}
      >
        Back
      </Button>

      <Typography variant="h5" fontWeight="bold" mb={1}>
        Book a Call
      </Typography>

      {/* Creator info */}
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              src={profile.avatar_url || undefined}
              alt={profile.display_name}
              sx={{ width: 56, height: 56, bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 'bold', fontSize: '1.5rem' }}
            >
              {!profile.avatar_url && (profile.display_name || profile.username || 'U')[0].toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="body1" fontWeight={600}>
                {profile.display_name || profile.username}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                @{profile.username}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step 1: Choose Time */}
      {activeStep === 0 && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Select Date</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={() => setWeekOffset((w) => w - 1)} disabled={weekOffset <= 0}>
                  &lsaquo;
                </Button>
                <Button size="small" variant="outlined" onClick={() => setWeekOffset((w) => w + 1)}>
                  &rsaquo;
                </Button>
              </Stack>
            </Stack>

            <Grid container spacing={1}>
              {DAYS.map((d) => (
                <Grid item xs key={d}>
                  <Typography variant="caption" color="text.secondary" align="center" display="block" pb={1}>
                    {d}
                  </Typography>
                </Grid>
              ))}
              {weekDates.map((date) => {
                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                const slots = slotsForDate(date);
                const hasSlots = slots.length > 0;
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                return (
                  <Grid item xs key={date.toISOString()}>
                    <Button
                      fullWidth
                      size="small"
                      variant={isSelected ? 'contained' : 'text'}
                      color={isSelected ? 'primary' : 'inherit'}
                      disabled={isPast || !hasSlots}
                      onClick={() => {
                        if (!isPast && hasSlots) {
                          setSelectedDate(date);
                          setSelectedSlot(null);
                        }
                      }}
                      sx={{
                        minWidth: 0,
                        p: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        aspectRatio: '1',
                        borderRadius: 2,
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: !hasSlots || isPast ? 'text.disabled' : isSelected ? undefined : 'text.primary',
                        bgcolor: !isSelected && hasSlots && !isPast ? 'background.paper' : undefined,
                        border: !isSelected && hasSlots && !isPast ? '1px solid' : 'none',
                        borderColor: 'divider',
                      }}
                    >
                      {date.getDate()}
                      {hasSlots && !isPast && !isSelected && (
                        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.25 }} />
                      )}
                    </Button>
                  </Grid>
                );
              })}
            </Grid>

            {selectedDate && (
              <Box mt={2} pt={2} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary" mb={1.5}>
                  Available slots for {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {slotsForDate(selectedDate).map((slot, i) => (
                    <Chip
                      key={i}
                      label={slot.start_time}
                      onClick={() => setSelectedSlot(slot)}
                      variant={selectedSlot === slot ? 'filled' : 'outlined'}
                      color={selectedSlot === slot ? 'primary' : 'default'}
                      clickable
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Details */}
      {activeStep === 1 && (
        <Box>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" mb={2}>Call Type</Typography>
              <ToggleButtonGroup
                value={callType}
                exclusive
                onChange={(_, v) => v && setCallType(v)}
                fullWidth
              >
                <ToggleButton value="video" sx={{ gap: 1 }}>
                  <VideoCallRounded fontSize="small" /> Video Call
                </ToggleButton>
                <ToggleButton value="audio" sx={{ gap: 1 }}>
                  <MicRounded fontSize="small" /> Audio Call
                </ToggleButton>
              </ToggleButtonGroup>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" mb={2}>Duration</Typography>
              <ToggleButtonGroup
                value={duration}
                exclusive
                onChange={(_, v) => v && setDuration(v)}
                fullWidth
              >
                {DURATIONS.map(({ value, label }) => (
                  <ToggleButton key={value} value={value}>
                    {label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <CardContent sx={{ p: 3 }}>
              <TextField
                label="Notes (optional)"
                multiline
                rows={2}
                fullWidth
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What would you like to discuss?"
              />
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {duration} min {callType} call
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  ${price}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Step 3: Confirm */}
      {activeStep === 2 && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>Booking Summary</Typography>
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Creator</Typography>
                <Typography variant="body2" fontWeight={600}>{profile.display_name || profile.username}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Date</Typography>
                <Typography variant="body2">{selectedDate?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Time</Typography>
                <Typography variant="body2">{selectedSlot?.start_time}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Type</Typography>
                <Typography variant="body2">{callType === 'video' ? 'Video' : 'Audio'} Call</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Duration</Typography>
                <Typography variant="body2">{duration} minutes</Typography>
              </Stack>
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body1" fontWeight={700}>Total</Typography>
                <Typography variant="h6" fontWeight={700} color="primary">${price}</Typography>
              </Stack>
            </Stack>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </CardContent>
        </Card>
      )}

      {/* Navigation buttons */}
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Button
          variant="outlined"
          onClick={() => setActiveStep((s) => s - 1)}
          disabled={activeStep === 0}
        >
          Back
        </Button>
        {activeStep < STEPS.length - 1 ? (
          <Button
            variant="contained"
            onClick={() => {
              if (activeStep === 0 && (!selectedDate || !selectedSlot)) {
                setError('Please select a date and time slot.');
                return;
              }
              setError('');
              setActiveStep((s) => s + 1);
            }}
            disabled={activeStep === 0 && (!selectedDate || !selectedSlot)}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={handleBook}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {submitting ? 'Booking…' : 'Book & Pay'}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
