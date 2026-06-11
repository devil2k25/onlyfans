import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, TextField, Stack,
  ImageList, ImageListItem, FormControlLabel, Switch, Alert,
  CircularProgress, IconButton,
} from '@mui/material';
import { CloudUploadRounded, CloseRounded, LockRounded, LockOpenRounded, VideoFileRounded, ImageRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext.jsx';
import { createPost } from '../api/posts.js';

function FilePreview({ file, url, onRemove, index }) {
  const isVideo = file.type.startsWith('video/');
  return (
    <ImageListItem
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
        position: 'relative',
        '&:hover .remove-btn': { opacity: 1 },
      }}
    >
      {isVideo ? (
        <Box
          component="video"
          src={url}
          sx={{ width: '100%', height: 160, objectFit: 'cover' }}
          muted
        />
      ) : (
        <Box
          component="img"
          src={url}
          alt={`preview ${index}`}
          sx={{ width: '100%', height: 160, objectFit: 'cover' }}
        />
      )}
      <Box
        className="remove-btn"
        sx={{
          position: 'absolute',
          inset: 0,
          bgcolor: 'rgba(0,0,0,0.4)',
          opacity: 0,
          transition: 'opacity 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconButton
          size="small"
          onClick={() => onRemove(index)}
          sx={{ bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' } }}
        >
          <CloseRounded fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ position: 'absolute', bottom: 6, right: 6 }}>
        <Paper sx={{ px: 1, py: 0.25, display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(0,0,0,0.6)' }}>
          {isVideo ? <VideoFileRounded sx={{ fontSize: 12, color: 'white' }} /> : <ImageRounded sx={{ fontSize: 12, color: 'white' }} />}
          <Typography variant="caption" sx={{ color: 'white', fontSize: '0.65rem' }}>
            {isVideo ? 'Video' : 'Image'}
          </Typography>
        </Paper>
      </Box>
    </ImageListItem>
  );
}

export default function CreatePost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [caption, setCaption] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef();

  const addFiles = useCallback((newFiles) => {
    const validFiles = Array.from(newFiles).filter((f) => {
      const isImage = f.type.startsWith('image/');
      const isVideo = f.type.startsWith('video/');
      return isImage || isVideo;
    });
    if (validFiles.length === 0) return;

    setFiles((prev) => [...prev, ...validFiles]);
    validFiles.forEach((f) => {
      const url = URL.createObjectURL(f);
      setPreviews((prev) => [...prev, url]);
    });
  }, []);

  const handleFileChange = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const removeFile = (index) => {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!caption.trim() && files.length === 0) {
      setError('Please add a caption or media to your post.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('caption', caption.trim());
      fd.append('is_free', String(isFree));
      files.forEach((f) => fd.append('media', f));

      const res = await createPost(fd);
      if (res.data.success) {
        previews.forEach((url) => URL.revokeObjectURL(url));
        navigate(`/${user.username}`);
      } else {
        setError(res.data.error || 'Failed to create post.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create post. Please try again.');
    }
    setSubmitting(false);
  };

  if (!user?.is_creator) {
    return (
      <Box maxWidth={600} mx="auto" px={3} py={10} display="flex" flexDirection="column" alignItems="center" textAlign="center">
        <LockRounded sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>Creator Access Only</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Enable creator mode in settings to post content.
        </Typography>
        <Button variant="contained" color="primary" onClick={() => navigate('/settings')}>
          Go to Settings
        </Button>
      </Box>
    );
  }

  return (
    <Box maxWidth={600} mx="auto" px={3} py={3}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        Create Post
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Upload area */}
        <Paper
          variant="outlined"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: '2px dashed',
            borderColor: dragging ? 'primary.main' : 'divider',
            borderRadius: 3,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: dragging ? (t) => `rgba(0,184,255,0.04)` : 'transparent',
            transition: 'border-color 0.2s, background-color 0.2s',
            '&:hover': { borderColor: 'primary.main' },
            mb: 2,
          }}
        >
          <CloudUploadRounded
            sx={{ fontSize: 48, color: dragging ? 'primary.main' : 'text.secondary', mb: 1 }}
          />
          <Typography variant="body1" fontWeight={500}>
            {dragging ? 'Drop files here' : 'Drag & drop or click to upload'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Images &amp; videos, max 100MB
          </Typography>
        </Paper>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Previews */}
        {previews.length > 0 && (
          <Box mb={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Selected Files ({files.length})
              </Typography>
              <Button
                size="small"
                color="error"
                onClick={() => {
                  previews.forEach((url) => URL.revokeObjectURL(url));
                  setFiles([]);
                  setPreviews([]);
                }}
              >
                Remove all
              </Button>
            </Stack>
            <ImageList cols={2} gap={8}>
              {previews.map((url, i) => (
                <FilePreview key={i} file={files[i]} url={url} index={i} onRemove={removeFile} />
              ))}
            </ImageList>
          </Box>
        )}

        {/* Caption */}
        <TextField
          label="Caption"
          multiline
          rows={4}
          fullWidth
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write something for your fans..."
          sx={{ mb: 2 }}
        />

        {/* Free/Paid toggle */}
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {isFree ? 'Free post' : 'Subscribers only'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isFree ? 'Everyone can see this post' : 'Only subscribers can view this post'}
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={!isFree}
                  onChange={(e) => setIsFree(!e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {isFree ? <LockOpenRounded fontSize="small" /> : <LockRounded fontSize="small" />}
                  <Typography variant="body2">{isFree ? 'Free' : 'Paid'}</Typography>
                </Stack>
              }
              sx={{ mr: 0 }}
            />
          </Stack>
        </Paper>

        {/* Submit */}
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" onClick={() => navigate(-1)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            flex={1}
            disabled={submitting || (!caption.trim() && files.length === 0)}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ flex: 1 }}
          >
            {submitting ? 'Publishing…' : 'Publish'}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
