import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Compass, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import PostCard from '../components/PostCard.jsx';
import { getFeed } from '../api/posts.js';
import { deletePost } from '../api/posts.js';
import { checkSubscription } from '../api/subscriptions.js';

export default function Home() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [subscriptions, setSubscriptions] = useState({});

  const fetchFeed = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await getFeed(pageNum);
      if (res.data.success) {
        const newPosts = res.data.data || [];
        setPosts((prev) => append ? [...prev, ...newPosts] : newPosts);
        setHasMore(newPosts.length >= 10);
        // Track subscription status by creator
        const subs = {};
        newPosts.forEach((p) => {
          if (p.creator_id) subs[p.creator_id] = p.is_subscribed ?? false;
        });
        setSubscriptions((prev) => ({ ...prev, ...subs }));
      }
    } catch {}
    if (pageNum === 1) setLoading(false);
    else setLoadingMore(false);
  }, []);

  useEffect(() => {
    fetchFeed(1, false);
    setPage(1);
  }, [fetchFeed]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchFeed(next, true);
  };

  const handleDelete = async (postId) => {
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {}
  };

  // The onUnlike callback doubles as delete handler if second arg is true
  const handleUnlikeOrDelete = (postId, isDelete) => {
    if (isDelete) handleDelete(postId);
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4 animate-pulse">
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-[#2a2a2a]" />
              <div className="flex-1">
                <div className="h-3 bg-[#2a2a2a] rounded w-32 mb-2" />
                <div className="h-2 bg-[#2a2a2a] rounded w-20" />
              </div>
            </div>
            <div className="h-64 bg-[#2a2a2a]" />
            <div className="p-4">
              <div className="h-3 bg-[#2a2a2a] rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mb-4">
          <Compass size={28} className="text-[#00b8ff]" />
        </div>
        <h2 className="text-white text-xl font-semibold mb-2">Your feed is empty</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-xs">
          Subscribe to creators to see their posts here.
        </p>
        <Link
          to="/explore"
          className="bg-[#00b8ff] hover:bg-[#0099d4] text-white font-semibold rounded-lg px-6 py-2.5 transition-colors"
        >
          Explore Creators →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-xl font-bold">Feed</h1>
        <button
          onClick={() => fetchFeed(1, false)}
          className="text-gray-400 hover:text-[#00b8ff] transition-colors p-1"
          title="Refresh feed"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={user}
          isSubscribed={subscriptions[post.creator_id] !== false}
          onUnlike={handleUnlikeOrDelete}
        />
      ))}

      {hasMore && (
        <div className="flex justify-center py-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:border-[#00b8ff] hover:text-[#00b8ff] font-semibold rounded-lg px-6 py-2.5 transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
          >
            {loadingMore ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
