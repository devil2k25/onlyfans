import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { subscribe, unsubscribe } from '../api/subscriptions.js';

export default function SubscribeButton({ creator, isSubscribed: initialSubscribed, onSubscribeChange }) {
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
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 bg-[#2a2a2a] hover:bg-red-900/30 hover:text-red-400 text-gray-300 font-semibold rounded-lg px-4 py-2 transition-colors text-sm disabled:opacity-50"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <CheckCircle size={16} className="text-[#00b8ff]" />
        )}
        <span>{loading ? 'Processing...' : 'Subscribed ✓'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 bg-[#00b8ff] hover:bg-[#0099d4] text-white font-semibold rounded-lg px-4 py-2 transition-colors text-sm disabled:opacity-50"
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : null}
      <span>
        {loading
          ? 'Processing...'
          : price === 0
          ? 'Follow Free'
          : `Subscribe · $${price.toFixed(2)}/mo`}
      </span>
    </button>
  );
}
