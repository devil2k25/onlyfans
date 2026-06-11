import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Button, Card, CardContent, TextField, Stack,
  Avatar, FormControlLabel, Switch, Snackbar, Alert, InputAdornment,
  Divider, CircularProgress,
} from '@mui/material';
import { PersonRounded, StarRounded, ShieldRounded, CameraAltRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext.jsx';
import { updateProfile, updateAvatar, updateCover } from '../api/users.js';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [toast, setToast] = useState(null);

  // Profile section
  const [profileForm, setProfileForm] = useState({
    display_name: user?.display_name || '',
    bio: user?.bio || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const avatarRef = useRef();
  const coverRef = useRef();

  // Creator section
  const [creatorForm, setCreatorForm] = useState({
    is_creator: user?.is_creator || false,
    subscription_price: user?.subscription_price ?? '',
  });
  const [savingCreator, setSavingCreator] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        const res = await updateAvatar(fd);
        if (res.data.success) {
          updateUser({ avatar_url: res.data.data.avatar_url });
          setAvatarFile(null);
        }
      }
      if (coverFile) {
        const fd = new FormData();
        fd.append('cover', coverFile);
        const res = await updateCover(fd);
        if (res.data.success) {
          updateUser({ cover_url: res.data.data.cover_url });
          setCoverFile(null);
        }
      }
      const res = await updateProfile({
        display_name: profileForm.display_name,
        bio: profileForm.bio,
      });
      if (res.data.success) {
        updateUser(res.data.data);
        showToast('Profile updated successfully!', 'success');
      } else {
        showToast(res.data.error || 'Failed to update profile', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update profile', 'error');
    }
    setSavingProfile(false);
  };

  const handleSaveCreator = async (e) => {
    e.preventDefault();
    setSavingCreator(true);
    try {
      const res = await updateProfile({
        is_creator: creatorForm.is_creator,
        subscription_price: creatorForm.is_creator ? Number(creatorForm.subscription_price) || 0 : 0,
      });
      if (res.data.success) {
        updateUser(res.data.data);
        showToast('Creator settings saved!', 'success');
      } else {
        showToast(res.data.error || 'Failed to save settings', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save settings', 'error');
    }
    setSavingCreator(false);
  };

  const currentAvatar = avatarPreview || user?.avatar_url;
  const currentCover = coverPreview || user?.cover_url;

  return (
    <Box maxWidth={680} mx="auto" px={3} py={3}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        Settings
      </Typography>

      {/* Profile Card */}
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
            <PersonRounded color="primary" fontSize="small" />
            <Typography variant="h6" fontWeight={600}>Profile</Typography>
          </Stack>

          <Box component="form" onSubmit={handleSaveProfile}>
            {/* Cover image */}
            <Box
              onClick={() => coverRef.current?.click()}
              sx={{
                position: 'relative',
                width: '100%',
                height: 120,
                borderRadius: 2,
                overflow: 'hidden',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: 'divider',
                mb: 2,
                backgroundImage: currentCover ? `url(${currentCover})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                bgcolor: currentCover ? undefined : 'background.default',
                background: !currentCover
                  ? 'linear-gradient(135deg, rgba(0,184,255,0.1) 0%, rgba(0,68,255,0.1) 100%)'
                  : undefined,
                '&:hover .cover-overlay': { opacity: 1 },
              }}
            >
              <Box
                className="cover-overlay"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  bgcolor: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} color="white">
                  <CameraAltRounded fontSize="small" />
                  <Typography variant="body2" fontWeight={600}>Change Cover</Typography>
                </Stack>
              </Box>
            </Box>
            <input ref={coverRef} type="file" accept="image/*" onChange={handleCoverChange} style={{ display: 'none' }} />

            {/* Avatar */}
            <Stack direction="row" alignItems="center" spacing={2} mb={2.5}>
              <Box sx={{ position: 'relative', cursor: 'pointer' }} onClick={() => avatarRef.current?.click()}>
                <Avatar
                  src={currentAvatar || undefined}
                  alt={user?.display_name || user?.username}
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    fontSize: '1.75rem',
                    fontWeight: 'bold',
                    border: '2px solid',
                    borderColor: 'divider',
                  }}
                >
                  {!currentAvatar && ((user?.display_name || user?.username || 'U')[0]).toUpperCase()}
                </Avatar>
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    bgcolor: 'rgba(0,0,0,0.5)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    '&:hover': { opacity: 1 },
                  }}
                >
                  <CameraAltRounded sx={{ color: 'white', fontSize: 18 }} />
                </Box>
              </Box>
              <Stack spacing={0.5}>
                <Button variant="outlined" size="small" onClick={() => avatarRef.current?.click()}>
                  Change Avatar
                </Button>
                <Button variant="outlined" size="small" onClick={() => coverRef.current?.click()}>
                  Change Cover
                </Button>
                {avatarFile && (
                  <Typography variant="caption" color="primary">{avatarFile.name}</Typography>
                )}
              </Stack>
            </Stack>
            <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />

            <TextField
              label="Display Name"
              fullWidth
              value={profileForm.display_name}
              onChange={(e) => setProfileForm((p) => ({ ...p, display_name: e.target.value }))}
              placeholder="Your display name"
              sx={{ mb: 2 }}
            />

            <TextField
              label="Bio"
              fullWidth
              multiline
              rows={3}
              value={profileForm.bio}
              onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
              placeholder="Tell your fans about yourself..."
              sx={{ mb: 2.5 }}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={savingProfile}
              startIcon={savingProfile ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {savingProfile ? 'Saving…' : 'Save Profile'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Creator Settings Card */}
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
            <StarRounded color="primary" fontSize="small" />
            <Typography variant="h6" fontWeight={600}>Creator Settings</Typography>
          </Stack>

          <Box component="form" onSubmit={handleSaveCreator}>
            <FormControlLabel
              control={
                <Switch
                  checked={creatorForm.is_creator}
                  onChange={(e) => setCreatorForm((p) => ({ ...p, is_creator: e.target.checked }))}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Creator Mode</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Enable to post content and accept subscribers
                  </Typography>
                </Box>
              }
              sx={{ mb: 2, alignItems: 'flex-start', ml: 0 }}
            />

            {creatorForm.is_creator && (
              <TextField
                type="number"
                label="Monthly subscription price ($)"
                fullWidth
                inputProps={{ min: 0, max: 999, step: 0.01 }}
                value={creatorForm.subscription_price}
                onChange={(e) => setCreatorForm((p) => ({ ...p, subscription_price: e.target.value }))}
                placeholder="0.00"
                helperText="Set to 0 for a free subscription"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                sx={{ mb: 2.5 }}
              />
            )}

            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={savingCreator}
              startIcon={savingCreator ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {savingCreator ? 'Saving…' : 'Save Creator Settings'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Account Card */}
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
            <ShieldRounded color="primary" fontSize="small" />
            <Typography variant="h6" fontWeight={600}>Account</Typography>
          </Stack>

          <TextField
            label="Username"
            fullWidth
            value={`@${user?.username || ''}`}
            disabled
            helperText="Username cannot be changed"
            sx={{ mb: 2 }}
          />

          <TextField
            label="Email Address"
            type="email"
            fullWidth
            value={user?.email || ''}
            disabled
            helperText="Email cannot be changed"
            sx={{ mb: 2 }}
          />

          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary">
            Account created:{' '}
            {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
          </Typography>
        </CardContent>
      </Card>

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast(null)}
          severity={toast?.type || 'success'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
