import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, TextField,
  CircularProgress, Alert, Divider, InputAdornment, IconButton,
  FormControlLabel, Switch,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    display_name: '',
    is_creator: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.username || !form.password) {
      setError('Email, username, and password are required.');
      return;
    }
    if (form.username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await register(form);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred. Please try again.');
    }
    setLoading(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(0,184,255,0.08) 0%, transparent 60%), #0a0a0a',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 480 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
            FanSpace
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create your account
          </Typography>
        </Box>

        <Card
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Box component="form" onSubmit={handleSubmit}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <TextField
                label="Display Name"
                name="display_name"
                value={form.display_name}
                onChange={handleChange}
                placeholder="Your Name"
                autoComplete="name"
                fullWidth
                variant="outlined"
                margin="normal"
              />

              <TextField
                label="Username"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="yourhandle"
                autoComplete="username"
                required
                fullWidth
                variant="outlined"
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography color="text.secondary">@</Typography>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
                fullWidth
                variant="outlined"
                margin="normal"
              />

              <TextField
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
                required
                fullWidth
                variant="outlined"
                margin="normal"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((s) => !s)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      name="is_creator"
                      checked={form.is_creator}
                      onChange={handleChange}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        I&apos;m a creator
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Enable this to post content and accept subscriptions
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              {form.is_creator && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  As a creator you can publish posts, set a subscription price, go live, and book calls with your fans.
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ mt: 3, mb: 2 }}
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </Button>

              <Divider sx={{ my: 2 }}>
                <Typography variant="caption" color="text.secondary">or</Typography>
              </Divider>

              <Typography variant="body2" align="center" color="text.secondary">
                Already have an account?{' '}
                <Typography
                  component={Link}
                  to="/login"
                  variant="body2"
                  color="primary"
                  sx={{ fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  Sign in
                </Typography>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
