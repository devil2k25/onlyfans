import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Compass,
  MessageCircle,
  PlusCircle,
  Settings,
  LogOut,
  User,
  Tv,
  Radio,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getConversations } from '../api/messages.js';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      getConversations()
        .then((res) => {
          if (res.data.success) {
            const convos = res.data.data || [];
            const unread = convos.reduce(
              (acc, c) => acc + (c.unread_count || 0),
              0
            );
            setUnreadCount(unread);
          }
        })
        .catch(() => {});
    }
  }, [user, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/explore', icon: Compass, label: 'Explore' },
    { path: '/messages', icon: MessageCircle, label: 'Messages', badge: unreadCount },
    { path: '/streams', icon: Tv, label: 'Live' },
    ...(user?.is_creator ? [
      { path: '/create', icon: PlusCircle, label: 'Create Post' },
      { path: '/go-live', icon: Radio, label: 'Go Live' },
    ] : []),
    { path: '/bookings', icon: Calendar, label: 'Bookings' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] flex-col z-50">
        {/* Logo */}
        <div className="p-6 border-b border-[#2a2a2a]">
          <h1 className="text-2xl font-bold text-[#00b8ff]">FanSpace</h1>
        </div>

        {/* User Info */}
        {user && (
          <Link
            to={`/${user.username}`}
            className="flex items-center gap-3 p-4 hover:bg-[#2a2a2a] transition-colors border-b border-[#2a2a2a]"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.display_name}
                className="w-10 h-10 rounded-full object-cover border-2 border-[#00b8ff]"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#00b8ff] flex items-center justify-center text-white font-bold">
                {(user.display_name || user.username || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-white font-semibold text-sm truncate">
                {user.display_name || user.username}
              </p>
              <p className="text-gray-400 text-xs truncate">@{user.username}</p>
            </div>
          </Link>
        )}

        {/* Nav Items */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, label, badge }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors relative ${
                isActive(path)
                  ? 'text-[#00b8ff] bg-[#00b8ff]/10 border-r-2 border-[#00b8ff]'
                  : 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
              {badge > 0 && (
                <span className="ml-auto bg-[#00b8ff] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-[#2a2a2a]">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-2 py-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-[#2a2a2a] z-50 flex items-center justify-around px-2 py-2">
        {navItems.slice(0, 5).map(({ path, icon: Icon, label, badge }) => (
          <Link
            key={path}
            to={path}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg relative ${
              isActive(path) ? 'text-[#00b8ff]' : 'text-gray-400'
            }`}
          >
            <div className="relative">
              <Icon size={22} />
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#00b8ff] text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </div>
            <span className="text-xs">{label}</span>
          </Link>
        ))}
        {user && (
          <Link
            to={`/${user.username}`}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
              location.pathname === `/${user.username}` ? 'text-[#00b8ff]' : 'text-gray-400'
            }`}
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.display_name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <User size={22} />
            )}
            <span className="text-xs">Profile</span>
          </Link>
        )}
      </nav>
    </>
  );
}
