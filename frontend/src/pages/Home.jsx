import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Stack, CircularProgress, Skeleton,
} from '@mui/material';
import { RssFeedRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext.jsx';
import PostCard from '../components/PostCard.jsx';
import { getFeed, deletePost } from '../api/posts.js';
import { checkSubscription } from '../api/subscriptions.js';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const handleUnlikeOrDelete = (postId, isDelete) => {
    if (isDelete) handleDelete(postId);
  };

  if (loading) {
    return (
      <Box maxWidth={680} mx="auto" px={2} py={3}>
        {[1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              overflow: 'hidden',
              mb: 2,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5} p={2}>
              <Skeleton variant="circular" width={40} height={40} />
              <Box flex={1}>
                <Skeleton variant="text" width={120} height={14} />
                <Skeleton variant="text" width={80} height={12} />
              </Box>
            </Stack>
            <Skeleton variant="rectangular" height={260} />
            <Box p={2}>
              <Skeleton variant="text" width="75%" />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }

  if (posts.length === 0) {
    return (
      <Box
        maxWidth={680}
        mx="auto"
        px={2}
        py={8}
        display="flex"
        flexDirection="column"
        alignItems="center"
        textAlign="center"
      >
        <RssFeedRounded sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Your feed is empty
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 280 }}>
          Subscribe to creators to see their posts here.
        </Typography>
        <Button variant="contained" color="primary" onClick={() => navigate('/explore')}>
          Explore Creators
        </Button>
      </Box>
    );
  }

  return (
    <Box maxWidth={680} mx="auto" px={2} py={3}>
      <Typography variant="h5" fontWeight="bold" mb={2}>
        Home
      </Typography>

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
        <Box display="flex" justifyContent="center" py={2}>
          <Button
            variant="outlined"
            onClick={handleLoadMore}
            disabled={loadingMore}
            startIcon={loadingMore ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
