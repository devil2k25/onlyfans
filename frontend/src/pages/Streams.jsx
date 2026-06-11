import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Typography, Grid, Card, CardMedia, CardContent, Stack,
  Avatar, Chip, Button, CircularProgress,
} from '@mui/material';
import { TvRounded, RadioRounded, CalendarMonthRounded, VisibilityRounded } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { getStreams } from '../api/streams';

const GRADIENT_COLORS = [
  'linear-gradient(135deg, #1a237e, #6a1b9a)',
  'linear-gradient(135deg, #b71c1c, #880e4f)',
  'linear-gradient(135deg, #1b5e20, #006064)',
  'linear-gradient(135deg, #e65100, #f9a825)',
  'linear-gradient(135deg, #283593, #0277bd)',
  'linear-gradient(135deg, #4a148c, #880e4f)',
];

function StreamCard({ stream }) {
  const gradientIndex = stream.id % GRADIENT_COLORS.length;
  const gradient = GRADIENT_COLORS[gradientIndex];
  const creatorName = stream.creator?.display_name || stream.creator?.username || 'Creator';
  const isLive = stream.status === 'live';

  return (
    <Card
      component={Link}
      to={`/stream/${stream.id}`}
      elevation={0}
      sx={{
        display: 'block',
        textDecoration: 'none',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.2s',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-2px)',
        },
      }}
    >
      {/* Thumbnail */}
      <Box sx={{ position: 'relative', height: 180, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {stream.thumbnail_url ? (
          <Box
            component="img"
            src={stream.thumbnail_url}
            alt={stream.title}
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Box sx={{ opacity: 0.3 }}>
            {isLive ? <RadioRounded sx={{ fontSize: 48, color: 'white' }} /> : <TvRounded sx={{ fontSize: 48, color: 'white' }} />}
          </Box>
        )}

        {/* Badges top-left */}
        <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 10, left: 10, zIndex: 1 }}>
          {isLive && (
            <Chip
              label="LIVE"
              color="error"
              size="small"
              sx={{ fontWeight: 700, height: 24 }}
            />
          )}
          {stream.status === 'scheduled' && (
            <Chip
              label="SOON"
              size="small"
              icon={<CalendarMonthRounded sx={{ fontSize: 12 }} />}
              sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 700, height: 24 }}
            />
          )}
        </Stack>

        {/* Viewer count top-right */}
        {isLive && stream.viewer_count != null && (
          <Chip
            label={String(stream.viewer_count)}
            size="small"
            icon={<VisibilityRounded sx={{ fontSize: 12 }} />}
            sx={{ position: 'absolute', top: 10, right: 10, bgcolor: 'rgba(0,0,0,0.6)', color: 'white', '& .MuiChip-icon': { color: 'white' }, height: 24, zIndex: 1 }}
          />
        )}

        {/* Price badge */}
        {stream.is_paid && (
          <Chip
            label={`$${(stream.price_cents / 100).toFixed(2)}`}
            size="small"
            sx={{ position: 'absolute', bottom: 10, right: 10, bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 700, height: 22, fontSize: '0.7rem', zIndex: 1 }}
          />
        )}
      </Box>

      <CardContent sx={{ p: 2 }}>
        <Typography
          variant="body2"
          fontWeight={600}
          noWrap
          mb={0.75}
          sx={{ '&:hover': { color: 'primary.main' } }}
        >
          {stream.title}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Avatar
            src={stream.creator?.avatar_url || undefined}
            alt={creatorName}
            sx={{ width: 22, height: 22, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: '0.65rem', fontWeight: 'bold', flexShrink: 0 }}
          >
            {!stream.creator?.avatar_url && creatorName[0]?.toUpperCase()}
          </Avatar>
          <Typography variant="caption" color="text.secondary" noWrap flex={1}>
            {creatorName}
          </Typography>
          {isLive && stream.viewer_count != null && (
            <Stack direction="row" alignItems="center" spacing={0.25}>
              <VisibilityRounded sx={{ fontSize: 12, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">{stream.viewer_count}</Typography>
            </Stack>
          )}
        </Stack>
        {stream.status === 'scheduled' && stream.scheduled_at && (
          <Stack direction="row" alignItems="center" spacing={0.5} mt={1}>
            <CalendarMonthRounded sx={{ fontSize: 12, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {new Date(stream.scheduled_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default function Streams() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchStreams = async (p = 1, append = false) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await getStreams(p);
      if (res.data.success) {
        const data = res.data.data || [];
        setStreams((prev) => append ? [...prev, ...data] : data);
        setHasMore(data.length >= 12);
        setPage(p);
      }
    } catch {}
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchStreams(1);
  }, []);

  const liveStreams = streams.filter((s) => s.status === 'live');
  const scheduledStreams = streams.filter((s) => s.status === 'scheduled');

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box px={3} py={3}>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        Live &amp; Upcoming
      </Typography>

      {/* Live Now section */}
      {liveStreams.length > 0 && (
        <Box mb={5}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main', animation: 'pulse 1.5s infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
            <Typography variant="h6" fontWeight={700}>Live Now</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            {liveStreams.map((stream) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={stream.id}>
                <StreamCard stream={stream} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Upcoming section */}
      {scheduledStreams.length > 0 && (
        <Box mb={5}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <CalendarMonthRounded color="primary" />
            <Typography variant="h6" fontWeight={700}>Upcoming Streams</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            {scheduledStreams.map((stream) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={stream.id}>
                <StreamCard stream={stream} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* All streams fallback */}
      {liveStreams.length === 0 && scheduledStreams.length === 0 && (
        streams.length > 0 ? (
          <Box mb={5}>
            <Typography variant="h6" fontWeight={700} mb={2}>All Streams</Typography>
            <Grid container spacing={2.5}>
              {streams.map((stream) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={stream.id}>
                  <StreamCard stream={stream} />
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" alignItems="center" textAlign="center" py={12}>
            <RadioRounded sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>No streams yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Follow creators to get notified when they go live
            </Typography>
          </Box>
        )
      )}

      {/* Load more */}
      {hasMore && streams.length > 0 && (
        <Box display="flex" justifyContent="center" mt={2}>
          <Button
            variant="outlined"
            onClick={() => fetchStreams(page + 1, true)}
            disabled={loadingMore}
            startIcon={loadingMore ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {loadingMore ? 'Loading…' : 'Load More'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
