import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import AppBar from '@mui/material/AppBar';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import RadioRoundedIcon from '@mui/icons-material/RadioRounded';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { useAuth } from '../context/AuthContext.jsx';
import { getConversations } from '../api/messages.js';

const DRAWER_WIDTH = 240;

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    if (user) {
      getConversations()
        .then((res) => {
          if (res.data.success) {
            const convos = res.data.data || [];
            const unread = convos.reduce((acc, c) => acc + (c.unread_count || 0), 0);
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

  const allNavItems = [
    { path: '/', icon: <HomeRoundedIcon />, label: 'Home' },
    { path: '/explore', icon: <ExploreRoundedIcon />, label: 'Explore' },
    { path: '/messages', icon: <ChatBubbleRoundedIcon />, label: 'Messages', badge: unreadCount },
    { path: '/streams', icon: <TvRoundedIcon />, label: 'Live' },
    ...(user?.is_creator
      ? [
          { path: '/go-live', icon: <RadioRoundedIcon />, label: 'Go Live' },
          { path: '/create', icon: <AddCircleRoundedIcon />, label: 'Create Post' },
        ]
      : []),
    { path: '/bookings', icon: <CalendarMonthRoundedIcon />, label: 'Bookings' },
    { path: '/settings', icon: <SettingsRoundedIcon />, label: 'Settings' },
  ];

  // First 4 items shown in bottom nav on mobile
  const mobileBottomItems = allNavItems.slice(0, 4);
  // The rest go into the "more" drawer
  const mobileMoreItems = allNavItems.slice(4);

  const getMobileNavValue = () => {
    const idx = mobileBottomItems.findIndex((item) => isActive(item.path));
    return idx >= 0 ? idx : false;
  };

  const desktopDrawer = (
    <Box
      sx={{
        width: DRAWER_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#111111',
      }}
    >
      {/* Logo / User Info */}
      <Box sx={{ p: 3, borderBottom: '1px solid #2a2a2a' }}>
        {user ? (
          <Box
            component="a"
            href={`/${user.username}`}
            onClick={(e) => { e.preventDefault(); navigate(`/${user.username}`); }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <Avatar
              src={user.avatar_url || undefined}
              sx={{ width: 48, height: 48, bgcolor: 'primary.main', border: '2px solid', borderColor: 'primary.main', color: '#000', fontWeight: 700 }}
            >
              {!user.avatar_url && (user.display_name || user.username || 'U')[0].toUpperCase()}
            </Avatar>
            <Box sx={{ overflow: 'hidden' }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {user.display_name || user.username}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
              >
                @{user.username}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700 }}>
            FanSpace
          </Typography>
        )}
      </Box>

      {/* Navigation List */}
      <List sx={{ flexGrow: 1, py: 1, overflowY: 'auto' }}>
        {allNavItems.map(({ path, icon, label, badge }) => {
          const active = isActive(path);
          return (
            <ListItemButton
              key={path}
              onClick={() => navigate(path)}
              sx={{
                mx: 1,
                borderRadius: 2,
                mb: 0.5,
                color: active ? 'primary.main' : 'text.secondary',
                bgcolor: active ? alpha('#00b8ff', 0.12) : 'transparent',
                '&:hover': {
                  bgcolor: active ? alpha('#00b8ff', 0.18) : alpha('#ffffff', 0.06),
                  color: active ? 'primary.main' : 'text.primary',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                {badge > 0 ? (
                  <Badge badgeContent={badge > 9 ? '9+' : badge} color="primary">
                    {icon}
                  </Badge>
                ) : (
                  icon
                )}
              </ListItemIcon>
              <ListItemText
                primary={label}
                primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: active ? 600 : 500 }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* Logout */}
      <Box sx={{ p: 1, borderTop: '1px solid #2a2a2a' }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            color: 'error.main',
            '&:hover': { bgcolor: alpha('#f44336', 0.1) },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
            <LogoutRoundedIcon />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 500 }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Desktop permanent drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        {desktopDrawer}
      </Drawer>

      {/* Mobile bottom AppBar */}
      <Paper
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          bgcolor: '#111111',
          borderTop: '1px solid #2a2a2a',
        }}
        elevation={0}
      >
        <BottomNavigation
          value={getMobileNavValue()}
          sx={{ bgcolor: 'transparent', height: 64 }}
        >
          {mobileBottomItems.map(({ path, icon, label, badge }, idx) => (
            <BottomNavigationAction
              key={path}
              label={label}
              icon={
                badge > 0 ? (
                  <Badge badgeContent={badge > 9 ? '9+' : badge} color="primary">
                    {icon}
                  </Badge>
                ) : (
                  icon
                )
              }
              onClick={() => navigate(path)}
              sx={{
                color: isActive(path) ? 'primary.main' : 'text.secondary',
                '&.Mui-selected': { color: 'primary.main' },
                minWidth: 0,
              }}
            />
          ))}
          <BottomNavigationAction
            label="More"
            icon={<MoreHorizIcon />}
            onClick={() => setMobileMoreOpen(true)}
            sx={{
              color: mobileMoreOpen ? 'primary.main' : 'text.secondary',
              minWidth: 0,
            }}
          />
        </BottomNavigation>
      </Paper>

      {/* Mobile "more" drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={mobileMoreOpen}
        onClose={() => setMobileMoreOpen(false)}
        onOpen={() => setMobileMoreOpen(true)}
        sx={{ display: { xs: 'block', md: 'none' } }}
        PaperProps={{
          sx: {
            bgcolor: '#111111',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderTop: '1px solid #2a2a2a',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ width: 40, height: 4, bgcolor: '#444', borderRadius: 2, mx: 'auto', mb: 2 }} />
          <List>
            {mobileMoreItems.map(({ path, icon, label, badge }) => {
              const active = isActive(path);
              return (
                <ListItemButton
                  key={path}
                  onClick={() => { navigate(path); setMobileMoreOpen(false); }}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    color: active ? 'primary.main' : 'text.secondary',
                    bgcolor: active ? alpha('#00b8ff', 0.12) : 'transparent',
                    '&:hover': { bgcolor: alpha('#ffffff', 0.06), color: 'text.primary' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                    {badge > 0 ? (
                      <Badge badgeContent={badge > 9 ? '9+' : badge} color="primary">
                        {icon}
                      </Badge>
                    ) : (
                      icon
                    )}
                  </ListItemIcon>
                  <ListItemText primary={label} primaryTypographyProps={{ fontWeight: 500 }} />
                </ListItemButton>
              );
            })}
            <Divider sx={{ my: 1 }} />
            <ListItemButton
              onClick={() => { handleLogout(); setMobileMoreOpen(false); }}
              sx={{
                borderRadius: 2,
                color: 'error.main',
                '&:hover': { bgcolor: alpha('#f44336', 0.1) },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                <LogoutRoundedIcon />
              </ListItemIcon>
              <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 500 }} />
            </ListItemButton>
          </List>
        </Box>
      </SwipeableDrawer>
    </>
  );
}
