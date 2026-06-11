import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Trash2, Lock } from 'lucide-react';
import { likePost, unlikePost } from '../api/posts.js';
import CommentModal from './CommentModal.jsx';

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function PostCard({ post, onLike, onUnlike, isSubscribed, currentUser }) {
  const [liked, setLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const isOwner = currentUser && currentUser.id === post.creator_id;
  const isLocked = !post.is_free && !isSubscribed && !isOwner;
  const media = post.media || [];

  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      if (liked) {
        await unlikePost(post.id);
        setLiked(false);
        setLikesCount((c) => c - 1);
        if (onUnlike) onUnlike(post.id);
      } else {
        await likePost(post.id);
        setLiked(true);
        setLikesCount((c) => c + 1);
        if (onLike) onLike(post.id);
      }
    } catch {}
    setLikeLoading(false);
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Link to={`/${post.creator?.username || post.username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          {post.creator?.avatar_url ? (
            <img
              src={post.creator.avatar_url}
              alt={post.creator.display_name}
              className="w-10 h-10 rounded-full object-cover border-2 border-[#2a2a2a]"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#00b8ff] flex items-center justify-center text-white font-bold text-sm">
              {((post.creator?.display_name || post.creator?.username || 'U')[0]).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-white font-semibold text-sm">{post.creator?.display_name || post.creator?.username}</p>
            <p className="text-gray-400 text-xs">@{post.creator?.username} · {timeAgo(post.created_at)}</p>
          </div>
        </Link>
        {isOwner && (
          <button
            onClick={() => onUnlike && onUnlike(post.id, true)}
            className="text-gray-500 hover:text-red-400 transition-colors p-1"
            title="Delete post"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Caption */}
      {post.caption && !isLocked && (
        <div className="px-4 pb-3">
          <p className="text-white text-sm leading-relaxed">{post.caption}</p>
        </div>
      )}

      {/* Media */}
      {media.length > 0 && (
        <div className="relative">
          {isLocked ? (
            <div className="relative">
              <div
                className="w-full bg-[#0a0a0a] flex items-center justify-center"
                style={{ minHeight: '300px' }}
              >
                {media[0]?.type === 'video' ? (
                  <div className="w-full h-64 bg-[#111] flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                      <Lock size={28} className="text-gray-500" />
                    </div>
                  </div>
                ) : (
                  <div
                    className="w-full h-72 bg-cover bg-center blur-xl opacity-30"
                    style={{
                      backgroundImage: media[0]?.url ? `url(${media[0].url})` : 'none',
                      backgroundColor: '#111',
                    }}
                  />
                )}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
                <Lock size={36} className="text-[#00b8ff] mb-3" />
                <p className="text-white font-semibold text-base mb-1">Paid Content</p>
                <p className="text-gray-400 text-sm mb-4">Subscribe to unlock this post</p>
                <Link
                  to={`/${post.creator?.username}`}
                  className="bg-[#00b8ff] hover:bg-[#0099d4] text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors"
                >
                  Subscribe Now
                </Link>
              </div>
            </div>
          ) : media.length === 1 ? (
            media[0]?.type === 'video' ? (
              <video
                src={media[0].url}
                controls
                className="w-full max-h-[500px] object-contain bg-black"
              />
            ) : (
              <img
                src={media[0].url}
                alt="post media"
                className="w-full max-h-[500px] object-cover"
              />
            )
          ) : (
            <div className={`grid gap-0.5 ${media.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {media.slice(0, 4).map((m, i) => (
                <div key={i} className="relative">
                  {m.type === 'video' ? (
                    <video
                      src={m.url}
                      controls
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <img
                      src={m.url}
                      alt={`media ${i}`}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  {i === 3 && media.length > 4 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white text-xl font-bold">+{media.length - 4}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Caption for locked post */}
      {isLocked && post.caption && (
        <div className="px-4 py-3">
          <p className="text-gray-400 text-sm italic line-clamp-2">{post.caption}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-[#2a2a2a]">
        <button
          onClick={handleLike}
          disabled={likeLoading || !currentUser}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
          }`}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          <span>{likesCount}</span>
        </button>
        <button
          onClick={() => setShowComments(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-[#00b8ff] transition-colors"
        >
          <MessageCircle size={18} />
          <span>{post.comments_count || 0}</span>
        </button>
      </div>

      {showComments && (
        <CommentModal
          postId={post.id}
          currentUser={currentUser}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
}
