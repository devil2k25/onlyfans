import { useEffect, useRef } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import PhoneIcon from '@mui/icons-material/Phone';
import PhoneDisabledIcon from '@mui/icons-material/PhoneDisabled';
import VideocamIcon from '@mui/icons-material/Videocam';
import MicIcon from '@mui/icons-material/Mic';

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
    <Snackbar
      open
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      sx={{ mb: { xs: 8, md: 0 } }}
    >
      <Paper
        elevation={8}
        sx={{
          width: 320,
          bgcolor: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        {/* Header strip */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            bgcolor: 'rgba(0,184,255,0.08)',
            borderBottom: '1px solid #2a2a2a',
          }}
        >
          {callType === 'video' ? (
            <VideocamIcon sx={{ color: 'primary.main', fontSize: 16 }} />
          ) : (
            <MicIcon sx={{ color: 'primary.main', fontSize: 16 }} />
          )}
          <Typography
            variant="caption"
            sx={{
              color: 'primary.main',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Incoming {callType === 'video' ? 'Video' : 'Audio'} Call
          </Typography>
        </Box>

        {/* Caller info + actions */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 2 }}>
          <Avatar
            src={caller?.avatar_url || undefined}
            sx={{
              width: 48,
              height: 48,
              bgcolor: 'primary.main',
              color: '#000',
              fontWeight: 700,
              fontSize: '1.2rem',
              border: '2px solid',
              borderColor: 'primary.main',
              flexShrink: 0,
            }}
          >
            {!caller?.avatar_url && avatarLetter}
          </Avatar>

          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {displayName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              @{caller?.username}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <IconButton
              onClick={onReject}
              size="small"
              title="Reject"
              sx={{
                bgcolor: 'rgba(211,47,47,0.15)',
                color: '#f44336',
                border: '1px solid rgba(244,67,54,0.3)',
                '&:hover': { bgcolor: 'rgba(211,47,47,0.3)' },
              }}
            >
              <PhoneDisabledIcon fontSize="small" />
            </IconButton>
            <IconButton
              onClick={onAccept}
              size="small"
              title="Accept"
              sx={{
                bgcolor: 'rgba(56,142,60,0.15)',
                color: '#4caf50',
                border: '1px solid rgba(76,175,80,0.3)',
                '&:hover': { bgcolor: 'rgba(56,142,60,0.3)' },
              }}
            >
              <PhoneIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </Paper>
    </Snackbar>
  );
}
