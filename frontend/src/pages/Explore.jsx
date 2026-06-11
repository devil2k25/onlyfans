import React, { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { listCreators, searchUsers } from '../api/users.js';
import { subscribe, unsubscribe, checkSubscription } from '../api/subscriptions.js';
import CreatorCard from '../components/CreatorCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function SkeletonCard() {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden animate-pulse">
      <div className="h-28 bg-[#2a2a2a]" />
      <div className="pt-7 px-4 pb-4">
        <div className="h-3 bg-[#2a2a2a] rounded w-24 mb-2" />
        <div className="h-2 bg-[#2a2a2a] rounded w-16 mb-3" />
        <div className="h-2 bg-[#2a2a2a] rounded w-full mb-1" />
        <div className="h-2 bg-[#2a2a2a] rounded w-3/4 mb-4" />
        <div className="flex justify-between items-center">
          <div className="h-3 bg-[#2a2a2a] rounded w-16" />
          <div className="h-8 bg-[#2a2a2a] rounded w-24" />
        </div>
      </div>
    </div>
  );
}

export default function Explore() {
  const { user } = useAuth();
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchCreators(1);
  }, []);

  const fetchCreators = async (pageNum) => {
    if (pageNum === 1) setLoading(true);
    try {
      const res = await listCreators(pageNum);
      if (res.data.success) {
        const data = res.data.data || [];
        setCreators((prev) => pageNum === 1 ? data : [...prev, ...data]);
        setHasMore(data.length >= 12);
        setPage(pageNum);
      }
    } catch {}
    setLoading(false);
  };

  const handleSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await searchUsers(q);
      if (res.data.success) {
        setSearchResults(res.data.data || []);
      }
    } catch {}
    setSearchLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleSubscribe = async (creator) => {
    if (!user) return;
    try {
      const isCurrentlySub = subscriptions[creator.id];
      if (isCurrentlySub) {
        await unsubscribe(creator.id);
        setSubscriptions((prev) => ({ ...prev, [creator.id]: false }));
      } else {
        await subscribe(creator.id);
        setSubscriptions((prev) => ({ ...prev, [creator.id]: true }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const displayList = searchResults !== null ? searchResults : creators;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-white text-xl font-bold mb-4">Explore Creators</h1>

        {/* Search Bar */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search creators..."
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-gray-500 rounded-xl pl-10 pr-10 py-3 text-sm focus:border-[#00b8ff] focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {loading || searchLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg font-semibold mb-2">
            {searchQuery ? 'No results found' : 'No creators yet'}
          </p>
          <p className="text-gray-600 text-sm">
            {searchQuery ? `Try a different search term` : 'Be the first to create an account!'}
          </p>
        </div>
      ) : (
        <>
          {searchResults !== null && (
            <p className="text-gray-500 text-sm mb-4">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayList.map((creator) => (
              <CreatorCard
                key={creator.id}
                creator={creator}
                isSubscribed={subscriptions[creator.id]}
                onSubscribe={user && user.id !== creator.id ? handleSubscribe : undefined}
              />
            ))}
          </div>

          {searchResults === null && hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => fetchCreators(page + 1)}
                className="bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:border-[#00b8ff] hover:text-[#00b8ff] font-semibold rounded-lg px-6 py-2.5 transition-colors text-sm"
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
