import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import ImageList from '@mui/material/ImageList';
import ImageListItem from '@mui/material/ImageListItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LockIcon from '@mui/icons-material/Lock';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { likePost, unlikePost } from '../api/posts.js';
import CommentModal from './CommentModal.jsx';

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function PostCard({ post, onLike, onUnlike, isSubscribed, currentUser }) {
  const [liked, setLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState('');

  const isOwner = currentUser && currentUser.id === post.creator_id;
  const isLocked = !post.is_free && !isSubscribed && !isOwner;
  const media = post.media || [];

  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      if (liked) {
        await unlikePost(post.id);
        setLiked(false);
        setLikesCount((c) => c - 1);
        if (onUnlike) onUnlike(post.id);
      } else {
        await likePost(post.id);
        setLiked(true);
        setLikesCount((c) => c + 1);
        if (onLike) onLike(post.id);
      }
    } catch {}
    setLikeLoading(false);
  };

  const handleMenuOpen = (e) => setMenuAnchor(e.currentTarget);
  const handleMenuClose = () => setMenuAnchor(null);
  const handleDelete = () => {
    handleMenuClose();
    if (onUnlike) onUnlike(post.id, true);
  };

  const creatorName = post.creator?.display_name || post.creator?.username || '';
  const creatorUsername = post.creator?.username || post.username || '';

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 2,
        mb: 2,
        border: '1px solid #2a2a2a',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <CardHeader
        avatar={
          <Avatar
            component={Link}
            to={`/${creatorUsername}`}
            src={post.creator?.avatar_url || undefined}
            sx={{
              bgcolor: 'primary.main',
              color: '#000',
              fontWeight: 700,
              width: 40,
              height: 40,
              textDecoration: 'none',
            }}
          >
            {!post.creator?.avatar_url && creatorName[0]?.toUpperCase()}
          </Avatar>
        }
        title={
          <Typography
            component={Link}
            to={`/${creatorUsername}`}
            variant="body2"
            sx={{ fontWeight: 700, color: 'text.primary', textDecoration: 'none', '&:hover': { opacity: 0.8 } }}
          >
            {creatorName}
          </Typography>
        }
        subheader={
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            @{creatorUsername} · {timeAgo(post.created_at)}
          </Typography>
        }
        action={
          isOwner ? (
            <>
              <IconButton size="small" onClick={handleMenuOpen} sx={{ color: 'text.secondary' }}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleMenuClose}
                PaperProps={{ sx: { bgcolor: '#1a1a1a', border: '1px solid #2a2a2a' } }}
              >
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main', gap: 1 }}>
                  <DeleteOutlineIcon fontSize="small" />
                  Delete post
                </MenuItem>
              </Menu>
            </>
          ) : null
        }
        sx={{ pb: 1 }}
      />

      {/* Caption (unlocked) */}
      {post.caption && !isLocked && (
        <CardContent sx={{ pt: 0, pb: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.6 }}>
            {post.caption}
          </Typography>
        </CardContent>
      )}

      {/* Media */}
      {media.length > 0 && (
        <Box sx={{ position: 'relative' }}>
          {isLocked ? (
            <Box sx={{ position: 'relative' }}>
              {/* Blurred preview */}
              <Box
                sx={{
                  width: '100%',
                  minHeight: 300,
                  bgcolor: '#0a0a0a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {media[0]?.type !== 'video' && media[0]?.url ? (
                  <Box
                    sx={{
                      width: '100%',
                      height: 300,
                      backgroundImage: `url(${media[0].url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      filter: 'blur(20px)',
                      opacity: 0.3,
                      transform: 'scale(1.1)',
                    }}
                  />
                ) : (
                  <Box sx={{ width: '100%', height: 256, bgcolor: '#111' }} />
                )}
              </Box>
              {/* Overlay */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(4px)',
                  gap: 1.5,
                }}
              >
                <LockIcon sx={{ color: 'primary.main', fontSize: 40 }} />
                <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 600 }}>
                  Paid Content
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Subscribe to unlock this post
                </Typography>
                <Button
                  component={Link}
                  to={`/${creatorUsername}`}
                  variant="contained"
                  color="primary"
                  size="small"
                  sx={{ mt: 1 }}
                >
                  Subscribe Now
                </Button>
              </Box>
            </Box>
          ) : media.length === 1 ? (
            media[0]?.type === 'video' ? (
              <Box sx={{ bgcolor: '#000', width: '100%' }}>
                <video
                  src={media[0].url}
                  controls
                  style={{ width: '100%', maxHeight: 500, display: 'block' }}
                />
              </Box>
            ) : (
              <CardMedia
                component="img"
                image={media[0].url}
                alt="post media"
                sx={{ maxHeight: 500, objectFit: 'cover', width: '100%' }}
              />
            )
          ) : (
            <ImageList cols={2} gap={2} sx={{ m: 0 }}>
              {media.slice(0, 4).map((m, i) => (
                <ImageListItem key={i} sx={{ position: 'relative', overflow: 'hidden' }}>
                  {m.type === 'video' ? (
                    <video
                      src={m.url}
                      controls
                      style={{ width: '100%', height: 192, objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <img
                      src={m.url}
                      alt={`media ${i}`}
                      style={{ width: '100%', height: 192, objectFit: 'cover', display: 'block' }}
                    />
                  )}
                  {i === 3 && media.length > 4 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
                        +{media.length - 4}
                      </Typography>
                    </Box>
                  )}
                </ImageListItem>
              ))}
            </ImageList>
          )}
        </Box>
      )}

      {/* Caption for locked post */}
      {isLocked && post.caption && (
        <CardContent sx={{ pt: 1, pb: 1 }}>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontStyle: 'italic',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {post.caption}
          </Typography>
        </CardContent>
      )}

      {/* Actions */}
      <CardActions sx={{ px: 2, py: 1, borderTop: '1px solid #2a2a2a' }}>
        <IconButton
          size="small"
          onClick={handleLike}
          disabled={likeLoading || !currentUser}
          sx={{ color: liked ? '#f44336' : 'text.secondary', gap: 0.5 }}
        >
          {liked ? <FavoriteRoundedIcon fontSize="small" /> : <FavoriteBorderRoundedIcon fontSize="small" />}
        </IconButton>
        <Typography variant="body2" sx={{ color: 'text.secondary', mr: 1 }}>
          {likesCount}
        </Typography>

        <IconButton
          size="small"
          onClick={() => setShowComments(true)}
          sx={{ color: 'text.secondary', gap: 0.5 }}
        >
          <ChatBubbleOutlineRoundedIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {post.comments_count || 0}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        {!isOwner && currentUser && (
          <Tooltip title="Tip creator">
            <IconButton size="small" onClick={() => setTipOpen(true)} sx={{ color: 'text.secondary' }}>
              <AttachMoneyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>

      {/* Comment Modal */}
      {showComments && (
        <CommentModal
          postId={post.id}
          currentUser={currentUser}
          onClose={() => setShowComments(false)}
        />
      )}

      {/* Tip Dialog */}
      <Dialog
        open={tipOpen}
        onClose={() => setTipOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1a1a1a', backgroundImage: 'none', border: '1px solid #2a2a2a' } }}
      >
        <DialogTitle>Tip Creator</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Amount ($)"
            type="number"
            value={tipAmount}
            onChange={(e) => setTipAmount(e.target.value)}
            inputProps={{ min: 1 }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTipOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" color="primary" onClick={() => setTipOpen(false)}>
            Send Tip
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
