import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Avatar, Stack, Divider, List, ListItemButton,
  ListItemAvatar, ListItemText, Badge, Paper, TextField, IconButton,
  CircularProgress,
} from '@mui/material';
import { SendRounded, PhoneRounded, VideocamRounded, ChatBubbleOutlineRounded, ArrowBackRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext.jsx';
import { getConversations, getMessages, sendMessage } from '../api/messages.js';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function UserAvatar({ user, size = 40 }) {
  if (user?.avatar_url) {
    return (
      <Avatar src={user.avatar_url} alt={user.display_name || user.username} sx={{ width: size, height: size }} />
    );
  }
  return (
    <Avatar sx={{ width: size, height: size, bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 'bold', fontSize: size * 0.4 }}>
      {((user?.display_name || user?.username || 'U')[0]).toUpperCase()}
    </Avatar>
  );
}

export default function Messages() {
  const { user: currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await getConversations();
      if (res.data.success) {
        setConversations(res.data.data || []);
      }
    } catch {}
    setLoadingConvos(false);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchMessages = useCallback(async (userId) => {
    setLoadingMessages(true);
    try {
      const res = await getMessages(userId);
      if (res.data.success) {
        setMessages(res.data.data || []);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch {}
    setLoadingMessages(false);
  }, []);

  const selectConversation = (convo) => {
    setSelectedConvo(convo);
    setShowThread(true);
    fetchMessages(convo.other_user?.id || convo.id);
    setConversations((prev) =>
      prev.map((c) =>
        (c.other_user?.id || c.id) === (convo.other_user?.id || convo.id)
          ? { ...c, unread_count: 0 }
          : c
      )
    );
  };

  useEffect(() => {
    if (!selectedConvo) return;
    const userId = selectedConvo.other_user?.id || selectedConvo.id;
    pollRef.current = setInterval(() => {
      getMessages(userId)
        .then((res) => {
          if (res.data.success) {
            setMessages(res.data.data || []);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [selectedConvo]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending || !selectedConvo) return;
    const userId = selectedConvo.other_user?.id || selectedConvo.id;
    setSending(true);
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      content: text.trim(),
      sender_id: currentUser.id,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setText('');
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const res = await sendMessage(userId, text.trim());
      if (res.data.success) {
        setMessages((prev) => prev.map((m) => m.id === optimisticMsg.id ? res.data.data : m));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    }
    setSending(false);
  };

  const otherUser = selectedConvo?.other_user || selectedConvo;

  return (
    <Box display="flex" height="calc(100vh - 64px)" overflow="hidden">
      {/* Conversations panel */}
      <Box
        sx={{
          width: 320,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: { xs: showThread ? 'none' : 'flex', md: 'flex' },
          flexDirection: 'column',
        }}
      >
        <Typography variant="h6" fontWeight="bold" p={2}>
          Messages
        </Typography>
        <Divider />

        <Box flex={1} overflow="auto">
          {loadingConvos ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={24} color="primary" />
            </Box>
          ) : conversations.length === 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={8} px={2} textAlign="center">
              <ChatBubbleOutlineRounded sx={{ fontSize: 40, color: 'text.secondary', mb: 1.5 }} />
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                No conversations yet
              </Typography>
              <Typography variant="caption" color="text.secondary" mt={0.5}>
                Visit a creator&apos;s profile to send a message
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {conversations.map((convo) => {
                const other = convo.other_user || convo;
                const isSelected =
                  selectedConvo && (selectedConvo.other_user?.id || selectedConvo.id) === (other?.id);
                return (
                  <ListItemButton
                    key={convo.id || other?.id}
                    selected={isSelected}
                    onClick={() => selectConversation(convo)}
                    sx={{ px: 2, py: 1.5 }}
                  >
                    <ListItemAvatar>
                      <UserAvatar user={other} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={other?.display_name || other?.username}
                      secondary={convo.last_message || 'Start a conversation'}
                      secondaryTypographyProps={{ noWrap: true }}
                      primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                    />
                    <Stack alignItems="flex-end" spacing={0.5} ml={1}>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {timeAgo(convo.last_message_at || convo.updated_at)}
                      </Typography>
                      {convo.unread_count > 0 && (
                        <Badge
                          badgeContent={convo.unread_count > 9 ? '9+' : convo.unread_count}
                          color="primary"
                          sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none', fontSize: '0.7rem' } }}
                        />
                      )}
                    </Stack>
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </Box>
      </Box>

      {/* Message thread */}
      <Box
        sx={{
          flex: 1,
          display: { xs: !showThread ? 'none' : 'flex', md: 'flex' },
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {!selectedConvo ? (
          <Box flex={1} display="flex" flexDirection="column" alignItems="center" justifyContent="center" textAlign="center" px={4}>
            <ChatBubbleOutlineRounded sx={{ fontSize: 56, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Select a conversation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose a conversation from the left panel
            </Typography>
          </Box>
        ) : (
          <>
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <IconButton
                size="small"
                onClick={() => setShowThread(false)}
                sx={{ display: { md: 'none' }, mr: 0.5 }}
              >
                <ArrowBackRounded />
              </IconButton>
              <UserAvatar user={otherUser} />
              <Box flex={1} minWidth={0}>
                <Typography variant="body1" fontWeight={600} noWrap>
                  {otherUser?.display_name || otherUser?.username}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  @{otherUser?.username}
                </Typography>
              </Box>
              <IconButton size="small" title="Audio Call">
                <PhoneRounded fontSize="small" />
              </IconButton>
              <IconButton size="small" title="Video Call">
                <VideocamRounded fontSize="small" />
              </IconButton>
            </Box>

            {/* Messages */}
            <Box flex={1} overflow="auto" p={2} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {loadingMessages ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress size={24} color="primary" />
                </Box>
              ) : messages.length === 0 ? (
                <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                  <Typography variant="body2" color="text.secondary">
                    No messages yet. Say hi!
                  </Typography>
                </Box>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === currentUser?.id;
                  return (
                    <Box
                      key={msg.id}
                      display="flex"
                      alignItems="flex-end"
                      gap={1}
                      flexDirection={isMine ? 'row-reverse' : 'row'}
                    >
                      {!isMine && <UserAvatar user={otherUser} size={28} />}
                      <Box sx={{ maxWidth: '70%' }}>
                        <Paper
                          elevation={0}
                          sx={{
                            px: 2,
                            py: 1,
                            bgcolor: isMine ? 'primary.main' : '#2a2a2a',
                            color: isMine ? 'primary.contrastText' : 'text.primary',
                            borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          }}
                        >
                          <Typography variant="body2" sx={{ wordBreak: 'break-word', lineHeight: 1.5 }}>
                            {msg.content}
                          </Typography>
                        </Paper>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.5, textAlign: isMine ? 'right' : 'left' }}
                        >
                          {timeAgo(msg.created_at)}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })
              )}
              <div ref={bottomRef} />
            </Box>

            {/* Input */}
            <Paper
              elevation={0}
              component="form"
              onSubmit={handleSend}
              sx={{
                p: 1,
                borderTop: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'flex-end',
                gap: 1,
                borderRadius: 0,
              }}
            >
              <TextField
                fullWidth
                multiline
                maxRows={4}
                placeholder="Message..."
                variant="standard"
                value={text}
                onChange={(e) => setText(e.target.value)}
                InputProps={{ disableUnderline: true, sx: { px: 1.5, py: 1 } }}
              />
              <IconButton
                type="submit"
                color="primary"
                disabled={!text.trim() || sending}
                sx={{ mb: 0.5 }}
              >
                {sending ? <CircularProgress size={20} color="inherit" /> : <SendRounded />}
              </IconButton>
            </Paper>
          </>
        )}
      </Box>
    </Box>
  );
}
