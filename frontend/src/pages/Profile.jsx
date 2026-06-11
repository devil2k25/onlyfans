import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Settings, Grid, List, Lock, Phone, Video } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getProfile } from '../api/users.js';
import { getCreatorPosts, deletePost } from '../api/posts.js';
import { checkSubscription } from '../api/subscriptions.js';
import PostCard from '../components/PostCard.jsx';
import SubscribeButton from '../components/SubscribeButton.jsx';
import { useCallManager } from '../components/CallManager.jsx';

export default function Profile() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');

  const isOwnProfile = currentUser?.username === username;
  const { initiateCall } = useCallManager() || {};

  useEffect(() => {
    loadProfile();
  }, [username]);

  useEffect(() => {
    if (profile) {
      loadPosts(1);
    }
  }, [profile]);

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getProfile(username);
      if (res.data.success) {
        setProfile(res.data.data);
        // Check subscription status if logged in and not own profile
        if (currentUser && currentUser.username !== username) {
          try {
            const subRes = await checkSubscription(res.data.data.id);
            setIsSubscribed(subRes.data.success && subRes.data.data?.is_subscribed);
          } catch {}
        }
      } else {
        setError('User not found');
      }
    } catch {
      setError('User not found');
    }
    setLoading(false);
  };

  const loadPosts = async (pageNum = 1, append = false) => {
    setPostsLoading(true);
    try {
      const res = await getCreatorPosts(profile.id, pageNum);
      if (res.data.success) {
        const newPosts = res.data.data || [];
        setPosts((prev) => append ? [...prev, ...newPosts] : newPosts);
        setHasMore(newPosts.length >= 10);
        setPage(pageNum);
      }
    } catch {}
    setPostsLoading(false);
  };

  const handleDeletePost = async (postId) => {
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {}
  };

  const handleUnlikeOrDelete = (postId, isDelete) => {
    if (isDelete) handleDeletePost(postId);
  };

  const mediaPosts = posts.filter((p) => p.media && p.media.length > 0);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-[#1a1a1a]" />
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-end gap-4 -mt-12 mb-4">
            <div className="w-24 h-24 rounded-full bg-[#2a2a2a] border-4 border-[#0a0a0a]" />
          </div>
          <div className="h-5 bg-[#2a2a2a] rounded w-40 mb-2" />
          <div className="h-3 bg-[#2a2a2a] rounded w-24 mb-4" />
          <div className="h-3 bg-[#2a2a2a] rounded w-full mb-1" />
          <div className="h-3 bg-[#2a2a2a] rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <h2 className="text-white text-xl font-semibold mb-2">User not found</h2>
        <p className="text-gray-400 text-sm mb-6">The profile @{username} doesn't exist.</p>
        <Link to="/explore" className="text-[#00b8ff] hover:underline text-sm">
          Explore creators →
        </Link>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen">
      {/* Cover Image */}
      <div className="relative h-48 md:h-64">
        {profile.cover_url ? (
          <img
            src={profile.cover_url}
            alt="cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: 'linear-gradient(135deg, #00b8ff33 0%, #0044ff22 50%, #001133 100%)',
              backgroundColor: '#0f0f1a',
            }}
          />
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* Avatar + Actions row */}
        <div className="flex items-end justify-between -mt-14 mb-4">
          <div className="relative">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="w-24 h-24 rounded-full object-cover border-4 border-[#0a0a0a]"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#00b8ff] flex items-center justify-center text-white text-3xl font-bold border-4 border-[#0a0a0a]">
                {((profile.display_name || profile.username || 'U')[0]).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {isOwnProfile ? (
              <Link
                to="/settings"
                className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:border-[#3a3a3a] font-semibold rounded-lg px-4 py-2 transition-colors text-sm"
              >
                <Settings size={16} />
                Edit Profile
              </Link>
            ) : (
              currentUser && profile.is_creator && (
                <>
                  <SubscribeButton
                    creator={profile}
                    isSubscribed={isSubscribed}
                    onSubscribeChange={setIsSubscribed}
                  />
                  <button
                    onClick={() => initiateCall?.(profile, 'audio')}
                    title="Audio Call"
                    className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#00b8ff] hover:text-[#00b8ff] text-white font-semibold rounded-lg px-3 py-2 transition-colors text-sm"
                  >
                    <Phone size={15} />
                    Call
                  </button>
                  <button
                    onClick={() => initiateCall?.(profile, 'video')}
                    title="Video Call"
                    className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#00b8ff] hover:text-[#00b8ff] text-white font-semibold rounded-lg px-3 py-2 transition-colors text-sm"
                  >
                    <Video size={15} />
                    Video
                  </button>
                </>
              )
            )}
          </div>
        </div>

        {/* Profile Info */}
        <div className="mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-white text-xl font-bold">{profile.display_name || profile.username}</h1>
            {profile.is_creator && (
              <span className="bg-[#00b8ff]/20 text-[#00b8ff] text-xs font-semibold px-2 py-0.5 rounded-full">
                Creator
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">@{profile.username}</p>

          {profile.bio && (
            <p className="text-gray-300 text-sm mt-3 leading-relaxed">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-white font-bold text-lg">{profile.post_count || posts.length || 0}</p>
              <p className="text-gray-500 text-xs">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">{profile.subscriber_count || 0}</p>
              <p className="text-gray-500 text-xs">Subscribers</p>
            </div>
            {profile.is_creator && profile.subscription_price != null && (
              <div className="text-center">
                <p className="text-[#00b8ff] font-bold text-lg">
                  {Number(profile.subscription_price) === 0 ? 'Free' : `$${Number(profile.subscription_price).toFixed(2)}`}
                </p>
                <p className="text-gray-500 text-xs">per month</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        {profile.is_creator && (
          <div className="flex border-b border-[#2a2a2a] mb-6">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'posts'
                  ? 'border-[#00b8ff] text-[#00b8ff]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <List size={16} />
              Posts
            </button>
            <button
              onClick={() => setActiveTab('media')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'media'
                  ? 'border-[#00b8ff] text-[#00b8ff]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Grid size={16} />
              Media
            </button>
          </div>
        )}

        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <div>
            {postsLoading && posts.length === 0 ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-[#00b8ff] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-base font-semibold mb-2">No posts yet</p>
                {isOwnProfile && profile.is_creator && (
                  <Link
                    to="/create"
                    className="inline-block mt-2 bg-[#00b8ff] hover:bg-[#0099d4] text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors"
                  >
                    Create your first post
                  </Link>
                )}
              </div>
            ) : (
              <>
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={{ ...post, creator: profile }}
                    currentUser={currentUser}
                    isSubscribed={isOwnProfile || isSubscribed}
                    onUnlike={handleUnlikeOrDelete}
                  />
                ))}
                {hasMore && (
                  <div className="flex justify-center py-4 mb-6">
                    <button
                      onClick={() => loadPosts(page + 1, true)}
                      disabled={postsLoading}
                      className="bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:border-[#00b8ff] hover:text-[#00b8ff] font-semibold rounded-lg px-6 py-2.5 transition-colors text-sm disabled:opacity-50"
                    >
                      Load More
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Media Tab */}
        {activeTab === 'media' && (
          <div className="mb-8">
            {mediaPosts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-base font-semibold">No media yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {mediaPosts.map((post) => {
                  const media = post.media[0];
                  const locked = !post.is_free && !isSubscribed && !isOwnProfile;
                  return (
                    <div
                      key={post.id}
                      className="relative aspect-square bg-[#1a1a1a] overflow-hidden cursor-pointer group"
                      onClick={() => !locked && setActiveTab('posts')}
                    >
                      {locked ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#111]">
                          <Lock size={20} className="text-gray-500" />
                        </div>
                      ) : media?.type === 'video' ? (
                        <div className="absolute inset-0 bg-[#111] flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                          {media.url && (
                            <video src={media.url} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                          )}
                        </div>
                      ) : (
                        <img
                          src={media.url}
                          alt="media"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
