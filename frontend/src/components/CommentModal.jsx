import React, { useState, useEffect, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { getComments, addComment } from '../api/posts.js';

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function CommentModal({ postId, currentUser, onClose }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await getComments(postId);
      if (res.data.success) {
        setComments(res.data.data || []);
      }
    } catch {}
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || submitting || !currentUser) return;
    setSubmitting(true);
    try {
      const res = await addComment(postId, text.trim());
      if (res.data.success) {
        setComments((prev) => [...prev, res.data.data]);
        setText('');
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch {}
    setSubmitting(false);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          bgcolor: '#1a1a1a',
          backgroundImage: 'none',
          border: '1px solid #2a2a2a',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #2a2a2a',
          py: 1.5,
          px: 2,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Comments
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          flexGrow: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} color="primary" />
          </Box>
        ) : comments.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No comments yet. Be the first!
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {comments.map((comment) => (
              <ListItem key={comment.id} alignItems="flex-start" sx={{ px: 2, py: 1.5 }}>
                <ListItemAvatar sx={{ minWidth: 44 }}>
                  <Avatar
                    src={comment.user?.avatar_url || undefined}
                    sx={{ width: 32, height: 32, bgcolor: 'primary.main', color: '#000', fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    {!comment.user?.avatar_url &&
                      (comment.user?.display_name || comment.user?.username || 'U')[0].toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        {comment.user?.display_name || comment.user?.username}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {timeAgo(comment.created_at)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Typography
                      variant="body2"
                      sx={{ color: 'text.secondary', mt: 0.25, wordBreak: 'break-word' }}
                    >
                      {comment.content}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
            <div ref={bottomRef} />
          </List>
        )}
      </DialogContent>

      {/* Sticky comment input */}
      {currentUser && (
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1,
            px: 2,
            py: 1.5,
            borderTop: '1px solid #2a2a2a',
          }}
        >
          <TextField
            multiline
            rows={2}
            fullWidth
            placeholder="Add a comment..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#2a2a2a',
              },
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <IconButton
            type="submit"
            disabled={!text.trim() || submitting}
            sx={{ color: text.trim() ? 'primary.main' : 'text.disabled', mb: 0.5 }}
          >
            {submitting ? (
              <CircularProgress size={20} color="primary" />
            ) : (
              <SendRoundedIcon />
            )}
          </IconButton>
        </Box>
      )}
    </Dialog>
  );
}
