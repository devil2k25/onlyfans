import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
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
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
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
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="text-white font-semibold">Comments</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#00b8ff] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No comments yet. Be the first!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                {comment.user?.avatar_url ? (
                  <img
                    src={comment.user.avatar_url}
                    alt={comment.user.display_name}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#00b8ff] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {((comment.user?.display_name || comment.user?.username || 'U')[0]).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-white text-sm font-semibold">
                      {comment.user?.display_name || comment.user?.username}
                    </span>
                    <span className="text-gray-500 text-xs">{timeAgo(comment.created_at)}</span>
                  </div>
                  <p className="text-gray-300 text-sm mt-0.5 break-words">{comment.content}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {currentUser && (
          <form
            onSubmit={handleSubmit}
            className="p-4 border-t border-[#2a2a2a] flex items-center gap-3"
          >
            {currentUser.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.display_name}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#00b8ff] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {((currentUser.display_name || currentUser.username || 'U')[0]).toUpperCase()}
              </div>
            )}
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-[#2a2a2a] text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm border border-[#3a3a3a] focus:border-[#00b8ff] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!text.trim() || submitting}
              className="text-[#00b8ff] hover:text-white disabled:text-gray-600 transition-colors p-1"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
