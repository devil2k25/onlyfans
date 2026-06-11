import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Explore from './pages/Explore.jsx';
import Messages from './pages/Messages.jsx';
import Settings from './pages/Settings.jsx';
import CreatePost from './pages/CreatePost.jsx';
import Profile from './pages/Profile.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-[#00b8ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-[#00b8ff] border-t-transparent rounded-full animate-spin" />
      </div>
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
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {showNav && <Navbar />}
      <main className={showNav ? 'flex-1 md:ml-64 pb-20 md:pb-0' : 'flex-1'}>
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
          <Route path="/:username" element={<Profile />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  );
}
