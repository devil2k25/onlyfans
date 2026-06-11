import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import CallManager from './components/CallManager.jsx';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Explore from './pages/Explore.jsx';
import Messages from './pages/Messages.jsx';
import Settings from './pages/Settings.jsx';
import CreatePost from './pages/CreatePost.jsx';
import Profile from './pages/Profile.jsx';
import BookCall from './pages/BookCall.jsx';
import MyBookings from './pages/MyBookings.jsx';
import GoLive from './pages/GoLive.jsx';
import WatchStream from './pages/WatchStream.jsx';
import Streams from './pages/Streams.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppLayout() {
  const location = useLocation();
  const noNavRoutes = ['/login', '/register'];
  const showNav = !noNavRoutes.includes(location.pathname);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {showNav && <Navbar />}
      <Box
        component="main"
        sx={
          showNav
            ? { flexGrow: 1, ml: { md: '240px' }, pb: { xs: '70px', md: 0 } }
            : { flexGrow: 1 }
        }
      >
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route path="/explore" element={<Explore />} />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <Messages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create"
            element={
              <ProtectedRoute>
                <CreatePost />
              </ProtectedRoute>
            }
          />
          <Route path="/streams" element={<Streams />} />
          <Route path="/stream/:id" element={<WatchStream />} />
          <Route
            path="/go-live"
            element={
              <ProtectedRoute>
                <GoLive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute>
                <MyBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/book/:creatorId"
            element={
              <ProtectedRoute>
                <BookCall />
              </ProtectedRoute>
            }
          />
          {/* Profile route last to avoid catching other paths */}
          <Route path="/:username" element={<Profile />} />
        </Routes>
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <CallManager>
          <AppLayout />
        </CallManager>
      </SocketProvider>
    </AuthProvider>
  );
}
