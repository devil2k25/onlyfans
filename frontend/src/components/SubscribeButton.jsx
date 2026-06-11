import React, { useState } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { subscribe, unsubscribe } from '../api/subscriptions.js';

export default function SubscribeButton({ creator, isSubscribed: initialSubscribed, onSubscribeChange, fullWidth }) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [loading, setLoading] = useState(false);

  const price = Number(creator?.subscription_price || 0);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (subscribed) {
        await unsubscribe(creator.id);
        setSubscribed(false);
        if (onSubscribeChange) onSubscribeChange(false);
      } else {
        await subscribe(creator.id);
        setSubscribed(true);
        if (onSubscribeChange) onSubscribeChange(true);
      }
    } catch (err) {
      console.error('Subscription error:', err);
    }
    setLoading(false);
  };

  if (subscribed) {
    return (
      <Button
        onClick={handleClick}
        disabled={loading}
        variant="outlined"
        fullWidth={fullWidth}
        sx={{
          color: '#4caf50',
          borderColor: '#4caf50',
          '&:hover': { borderColor: '#f44336', color: '#f44336', bgcolor: 'rgba(244,67,54,0.08)' },
        }}
        startIcon={
          loading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : null
        }
      >
        {loading ? 'Processing...' : 'Subscribed ✓'}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant="contained"
      color="primary"
      fullWidth={fullWidth}
      startIcon={
        loading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : null
      }
    >
      {loading
        ? 'Processing...'
        : price === 0
        ? 'Follow Free'
        : `Subscribe · $${price.toFixed(2)}/mo`}
    </Button>
  );
}
