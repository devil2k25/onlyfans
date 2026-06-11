import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import SubscribeButton from './SubscribeButton.jsx';

export default function CreatorCard({ creator, onSubscribe, isSubscribed }) {
  const navigate = useNavigate();
  const price = Number(creator.subscription_price || 0);

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '1px solid #2a2a2a',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        '&:hover': { borderColor: '#3a3a3a' },
        transition: 'border-color 0.2s',
      }}
    >
      {/* Cover */}
      <Box
        sx={{
          height: 120,
          backgroundImage: creator.cover_url
            ? `url(${creator.cover_url})`
            : 'linear-gradient(135deg, rgba(0,184,255,0.13) 0%, rgba(0,68,255,0.13) 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          bgcolor: '#111',
        }}
      />

      <CardContent sx={{ pt: 0, flexGrow: 1 }}>
        {/* Avatar overlapping cover */}
        <Avatar
          src={creator.avatar_url || undefined}
          onClick={() => navigate(`/${creator.username}`)}
          sx={{
            width: 72,
            height: 72,
            border: '3px solid #1a1a1a',
            mt: -5,
            mb: 1,
            bgcolor: 'primary.main',
            color: '#000',
            fontWeight: 700,
            fontSize: '1.5rem',
            cursor: 'pointer',
          }}
        >
          {!creator.avatar_url && (creator.display_name || creator.username || 'U')[0].toUpperCase()}
        </Avatar>

        <Typography
          variant="h6"
          onClick={() => navigate(`/${creator.username}`)}
          sx={{
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            cursor: 'pointer',
            '&:hover': { opacity: 0.8 },
          }}
        >
          {creator.display_name || creator.username}
        </Typography>

        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block', mb: creator.bio ? 1 : 0 }}
        >
          @{creator.username}
        </Typography>

        {creator.bio && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mt: 1,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {creator.bio}
          </Typography>
        )}

        <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {creator.subscriber_count || 0} subscribers
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {price === 0 ? 'Free' : `$${price.toFixed(2)}/mo`}
          </Typography>
        </Stack>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <SubscribeButton
          creator={creator}
          isSubscribed={isSubscribed}
          onSubscribeChange={(subscribed) => onSubscribe && onSubscribe(creator, subscribed)}
          fullWidth
        />
      </CardActions>
    </Card>
  );
}
