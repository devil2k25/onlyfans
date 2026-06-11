import React from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';

export default function CreatorCard({ creator, onSubscribe, isSubscribed }) {
  const price = Number(creator.subscription_price || 0);

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#3a3a3a] transition-colors flex flex-col">
      {/* Cover */}
      <div className="relative h-28">
        {creator.cover_url ? (
          <img
            src={creator.cover_url}
            alt="cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, #00b8ff22 0%, #0044ff22 100%)`,
              backgroundColor: '#111',
            }}
          />
        )}
        {/* Avatar overlapping */}
        <div className="absolute -bottom-5 left-4">
          {creator.avatar_url ? (
            <img
              src={creator.avatar_url}
              alt={creator.display_name}
              className="w-12 h-12 rounded-full object-cover border-2 border-[#1a1a1a]"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#00b8ff] flex items-center justify-center text-white font-bold text-lg border-2 border-[#1a1a1a]">
              {((creator.display_name || creator.username || 'U')[0]).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="pt-7 px-4 pb-4 flex flex-col flex-1">
        <Link to={`/${creator.username}`} className="hover:opacity-80 transition-opacity">
          <h3 className="text-white font-semibold text-sm truncate">
            {creator.display_name || creator.username}
          </h3>
          <p className="text-gray-500 text-xs truncate">@{creator.username}</p>
        </Link>

        {creator.bio && (
          <p className="text-gray-400 text-xs mt-2 line-clamp-2 leading-relaxed">{creator.bio}</p>
        )}

        <div className="flex items-center gap-1 mt-3 text-gray-500 text-xs">
          <Users size={12} />
          <span>{creator.subscriber_count || 0} subscribers</span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[#00b8ff] text-sm font-semibold">
            {price === 0 ? 'Free' : `$${price.toFixed(2)}/mo`}
          </span>
          {onSubscribe && (
            <button
              onClick={() => onSubscribe(creator)}
              className={`text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors ${
                isSubscribed
                  ? 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'
                  : 'bg-[#00b8ff] hover:bg-[#0099d4] text-white'
              }`}
            >
              {isSubscribed ? 'Subscribed ✓' : price === 0 ? 'Follow Free' : `Subscribe`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
