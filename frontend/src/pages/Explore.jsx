import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, Grid, InputAdornment, Skeleton, Button,
  CircularProgress,
} from '@mui/material';
import { Search, SearchOff } from '@mui/icons-material';
import { listCreators, searchUsers } from '../api/users.js';
import { subscribe, unsubscribe } from '../api/subscriptions.js';
import CreatorCard from '../components/CreatorCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function SkeletonCard() {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <Skeleton variant="rectangular" height={200} />
      <Box sx={{ pt: '28px', px: 2, pb: 2 }}>
        <Skeleton variant="text" width={96} height={14} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={64} height={12} sx={{ mb: 1.5 }} />
        <Skeleton variant="text" width="100%" height={12} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width="75%" height={12} sx={{ mb: 2 }} />
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Skeleton variant="text" width={64} height={14} />
          <Skeleton variant="rounded" width={96} height={32} />
        </Box>
      </Box>
    </Box>
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
  const isLoading = loading || searchLoading;

  return (
    <Box px={3} py={3}>
      <Typography variant="h5" fontWeight="bold" mb={2}>
        Discover Creators
      </Typography>

      <TextField
        fullWidth
        placeholder="Search creators..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {searchLoading
                ? <CircularProgress size={18} color="inherit" />
                : <Search fontSize="small" />}
            </InputAdornment>
          ),
        }}
      />

      {isLoading ? (
        <Grid container spacing={3}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <SkeletonCard />
            </Grid>
          ))}
        </Grid>
      ) : displayList.length === 0 ? (
        <Box display="flex" flexDirection="column" alignItems="center" textAlign="center" py={10}>
          <SearchOff sx={{ fontSize: 56, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {searchQuery ? 'No results found' : 'No creators yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery ? 'Try a different search term' : 'Be the first to create an account!'}
          </Typography>
        </Box>
      ) : (
        <>
          {searchResults !== null && (
            <Typography variant="body2" color="text.secondary" mb={2}>
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
            </Typography>
          )}
          <Grid container spacing={3}>
            {displayList.map((creator) => (
              <Grid item xs={12} sm={6} md={4} key={creator.id}>
                <CreatorCard
                  creator={creator}
                  isSubscribed={subscriptions[creator.id]}
                  onSubscribe={user && user.id !== creator.id ? handleSubscribe : undefined}
                />
              </Grid>
            ))}
          </Grid>

          {searchResults === null && hasMore && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Button variant="outlined" onClick={() => fetchCreators(page + 1)}>
                Load More
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
