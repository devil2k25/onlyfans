import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Avatar, Button, Stack, Tabs, Tab, Divider,
  CircularProgress, Chip, ImageList, ImageListItem, Skeleton,
} from '@mui/material';
import { PhoneRounded, VideocamRounded, LockOutlined, SettingsRounded, GridOnRounded, ListRounded } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
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
  const [activeTab, setActiveTab] = useState(0);
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
      <Box>
        <Skeleton variant="rectangular" height={280} />
        <Box maxWidth={680} mx="auto" px={3}>
          <Stack direction="row" alignItems="flex-end" justifyContent="space-between" sx={{ mt: '-48px', mb: 2 }}>
            <Skeleton variant="circular" width={120} height={120} />
          </Stack>
          <Skeleton variant="text" width={160} height={28} sx={{ mb: 1 }} />
          <Skeleton variant="text" width={100} height={18} sx={{ mb: 1.5 }} />
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="75%" />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh" px={2} textAlign="center">
        <Typography variant="h6" gutterBottom>User not found</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          The profile @{username} doesn&apos;t exist.
        </Typography>
        <Button component={Link} to="/explore" color="primary">
          Explore creators
        </Button>
      </Box>
    );
  }

  if (!profile) return null;

  return (
    <Box>
      {/* Cover */}
      <Box
        height={280}
        sx={{
          backgroundImage: profile.cover_url ? `url(${profile.cover_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          background: profile.cover_url
            ? undefined
            : 'linear-gradient(135deg, rgba(0,184,255,0.2) 0%, rgba(0,68,255,0.13) 50%, #001133 100%)',
          backgroundColor: profile.cover_url ? undefined : '#0f0f1a',
        }}
      />

      <Box maxWidth={680} mx="auto">
        {/* Avatar + actions */}
        <Box px={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mt: '-60px', mb: 2 }}>
            <Avatar
              src={profile.avatar_url || undefined}
              alt={profile.display_name || profile.username}
              sx={{
                width: 120,
                height: 120,
                fontSize: '2.5rem',
                fontWeight: 'bold',
                border: '3px solid',
                borderColor: 'background.paper',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            >
              {!profile.avatar_url && ((profile.display_name || profile.username || 'U')[0]).toUpperCase()}
            </Avatar>

            <Stack direction="row" spacing={1} alignItems="center" pb={1}>
              {isOwnProfile ? (
                <Button
                  variant="outlined"
                  size="small"
                  component={Link}
                  to="/settings"
                  startIcon={<SettingsRounded fontSize="small" />}
                >
                  Edit Profile
                </Button>
              ) : (
                currentUser && profile.is_creator && (
                  <>
                    <SubscribeButton
                      creator={profile}
                      isSubscribed={isSubscribed}
                      onSubscribeChange={setIsSubscribed}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => initiateCall?.(profile, 'audio')}
                      title="Audio Call"
                      sx={{ minWidth: 0, px: 1.5 }}
                    >
                      <PhoneRounded fontSize="small" />
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => initiateCall?.(profile, 'video')}
                      title="Video Call"
                      sx={{ minWidth: 0, px: 1.5 }}
                    >
                      <VideocamRounded fontSize="small" />
                    </Button>
                  </>
                )
              )}
            </Stack>
          </Stack>

          {/* Profile info */}
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
            <Typography variant="h5" fontWeight="bold">
              {profile.display_name || profile.username}
            </Typography>
            {profile.is_creator && (
              <Chip
                label="Creator"
                size="small"
                sx={{
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.15),
                  color: 'primary.main',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                }}
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            @{profile.username}
          </Typography>
          {profile.bio && (
            <Typography variant="body2" color="text.secondary" mt={1} sx={{ lineHeight: 1.6 }}>
              {profile.bio}
            </Typography>
          )}

          {/* Stats */}
          <Stack direction="row" spacing={3} mt={2}>
            <Box>
              <Typography variant="body1" fontWeight="bold">{profile.post_count || posts.length || 0}</Typography>
              <Typography variant="caption" color="text.secondary">Posts</Typography>
            </Box>
            <Box>
              <Typography variant="body1" fontWeight="bold">{profile.subscriber_count || 0}</Typography>
              <Typography variant="caption" color="text.secondary">Subscribers</Typography>
            </Box>
            {profile.is_creator && profile.subscription_price != null && (
              <Box>
                <Typography variant="body1" fontWeight="bold" color="primary">
                  {Number(profile.subscription_price) === 0 ? 'Free' : `$${Number(profile.subscription_price).toFixed(2)}`}
                </Typography>
                <Typography variant="caption" color="text.secondary">per month</Typography>
              </Box>
            )}
          </Stack>
        </Box>

        <Divider sx={{ mt: 2 }} />

        {/* Tabs */}
        {profile.is_creator && (
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{ px: 3 }}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab icon={<ListRounded fontSize="small" />} iconPosition="start" label="Posts" />
            <Tab icon={<GridOnRounded fontSize="small" />} iconPosition="start" label="Media" />
          </Tabs>
        )}

        <Divider />

        {/* Posts Tab */}
        {activeTab === 0 && (
          <Box px={0}>
            {postsLoading && posts.length === 0 ? (
              <Box display="flex" justifyContent="center" py={6}>
                <CircularProgress color="primary" />
              </Box>
            ) : posts.length === 0 ? (
              <Box textAlign="center" py={8}>
                <Typography variant="body1" color="text.secondary" fontWeight={600} mb={1}>
                  No posts yet
                </Typography>
                {isOwnProfile && profile.is_creator && (
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    component={Link}
                    to="/create"
                    sx={{ mt: 1 }}
                  >
                    Create your first post
                  </Button>
                )}
              </Box>
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
                  <Box display="flex" justifyContent="center" py={3}>
                    <Button
                      variant="outlined"
                      onClick={() => loadPosts(page + 1, true)}
                      disabled={postsLoading}
                      startIcon={postsLoading ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                      Load More
                    </Button>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}

        {/* Media Tab */}
        {activeTab === 1 && (
          <Box px={3} pb={4} mt={2}>
            {mediaPosts.length === 0 ? (
              <Box textAlign="center" py={8}>
                <Typography variant="body1" color="text.secondary" fontWeight={600}>
                  No media yet
                </Typography>
              </Box>
            ) : (
              <ImageList cols={3} gap={4}>
                {mediaPosts.map((post) => {
                  const media = post.media[0];
                  const locked = !post.is_free && !isSubscribed && !isOwnProfile;
                  return (
                    <ImageListItem
                      key={post.id}
                      sx={{
                        aspectRatio: '1',
                        borderRadius: 2,
                        overflow: 'hidden',
                        cursor: locked ? 'default' : 'pointer',
                        bgcolor: 'background.paper',
                        position: 'relative',
                      }}
                      onClick={() => !locked && setActiveTab(0)}
                    >
                      {locked ? (
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: '#111',
                          }}
                        >
                          <LockOutlined sx={{ color: 'text.secondary' }} />
                        </Box>
                      ) : media?.type === 'video' ? (
                        <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box component="svg" sx={{ width: 16, height: 16, fill: 'white', ml: 0.5 }} viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </Box>
                          </Box>
                          {media.url && (
                            <Box component="video" src={media.url} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                          )}
                        </Box>
                      ) : (
                        <Box
                          component="img"
                          src={media.url}
                          alt="media"
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'scale(1.05)' },
                          }}
                        />
                      )}
                    </ImageListItem>
                  );
                })}
              </ImageList>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
