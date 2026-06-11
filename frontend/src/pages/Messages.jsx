import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, MessageCircle } from 'lucide-react';
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

function Avatar({ user, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.display_name || user.username}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-[#00b8ff] flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {((user?.display_name || user?.username || 'U')[0]).toUpperCase()}
    </div>
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
    // Update unread in conversation list
    setConversations((prev) =>
      prev.map((c) =>
        (c.other_user?.id || c.id) === (convo.other_user?.id || convo.id)
          ? { ...c, unread_count: 0 }
          : c
      )
    );
  };

  // Poll for new messages when a conversation is open
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
    <div className="flex h-screen md:h-[calc(100vh-0px)] bg-[#0a0a0a]">
      {/* Conversations Panel */}
      <div className={`${showThread ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 bg-[#1a1a1a] border-r border-[#2a2a2a] flex-shrink-0`}>
        <div className="p-4 border-b border-[#2a2a2a]">
          <h2 className="text-white font-bold text-lg">Messages</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConvos ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#00b8ff] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <MessageCircle size={36} className="text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm font-medium">No conversations yet</p>
              <p className="text-gray-600 text-xs mt-1">
                Visit a creator's profile to send a message
              </p>
            </div>
          ) : (
            conversations.map((convo) => {
              const other = convo.other_user || convo;
              const isSelected =
                selectedConvo && (selectedConvo.other_user?.id || selectedConvo.id) === (other?.id);
              return (
                <button
                  key={convo.id || other?.id}
                  onClick={() => selectConversation(convo)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a2a2a] transition-colors text-left ${
                    isSelected ? 'bg-[#2a2a2a]' : ''
                  }`}
                >
                  <Avatar user={other} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-semibold truncate">
                        {other?.display_name || other?.username}
                      </span>
                      <span className="text-gray-500 text-xs flex-shrink-0 ml-1">
                        {timeAgo(convo.last_message_at || convo.updated_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-gray-400 text-xs truncate">
                        {convo.last_message || 'Start a conversation'}
                      </p>
                      {convo.unread_count > 0 && (
                        <span className="bg-[#00b8ff] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ml-1">
                          {convo.unread_count > 9 ? '9+' : convo.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Message Thread */}
      <div className={`${!showThread ? 'hidden md:flex' : 'flex'} flex-col flex-1 min-w-0`}>
        {!selectedConvo ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <MessageCircle size={48} className="text-gray-700 mb-4" />
            <p className="text-gray-400 text-lg font-semibold mb-2">Select a conversation</p>
            <p className="text-gray-600 text-sm">Choose a conversation from the left panel</p>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="flex items-center gap-3 p-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
              <button
                onClick={() => setShowThread(false)}
                className="md:hidden text-gray-400 hover:text-white mr-1"
              >
                <ArrowLeft size={20} />
              </button>
              <Avatar user={otherUser} />
              <div>
                <p className="text-white font-semibold text-sm">
                  {otherUser?.display_name || otherUser?.username}
                </p>
                <p className="text-gray-500 text-xs">@{otherUser?.username}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#00b8ff] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-gray-500 text-sm">No messages yet. Say hi!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === currentUser?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {!isMine && <Avatar user={otherUser} size="sm" />}
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                          isMine
                            ? 'bg-[#00b8ff] text-white rounded-br-sm'
                            : 'bg-[#2a2a2a] text-white rounded-bl-sm'
                        }`}
                      >
                        <p className="break-words leading-relaxed">{msg.content}</p>
                        <p className={`text-xs mt-1 ${isMine ? 'text-white/60' : 'text-gray-500'}`}>
                          {timeAgo(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSend}
              className="flex items-center gap-3 p-4 border-t border-[#2a2a2a] bg-[#1a1a1a]"
            >
              <Avatar user={currentUser} size="sm" />
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write a message..."
                className="flex-1 bg-[#2a2a2a] border border-[#3a3a3a] text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:border-[#00b8ff] focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                className="bg-[#00b8ff] hover:bg-[#0099d4] disabled:bg-[#2a2a2a] disabled:text-gray-600 text-white rounded-xl p-2.5 transition-colors flex-shrink-0"
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
