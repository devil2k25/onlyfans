import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Image, Video, Lock, Unlock, Send, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { createPost } from '../api/posts.js';

function FilePreview({ file, url, onRemove, index }) {
  const isVideo = file.type.startsWith('video/');
  return (
    <div className="relative group rounded-lg overflow-hidden bg-[#0a0a0a] border border-[#2a2a2a]">
      {isVideo ? (
        <video
          src={url}
          className="w-full h-40 object-cover"
          controls={false}
          muted
        />
      ) : (
        <img src={url} alt={`preview ${index}`} className="w-full h-40 object-cover" />
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="absolute bottom-1 right-1">
        <span className="bg-black/60 text-white text-xs rounded px-1.5 py-0.5 flex items-center gap-1">
          {isVideo ? <Video size={10} /> : <Image size={10} />}
          {isVideo ? 'Video' : 'Image'}
        </span>
      </div>
    </div>
  );
}

export default function CreatePost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [caption, setCaption] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef();

  const addFiles = useCallback((newFiles) => {
    const validFiles = Array.from(newFiles).filter((f) => {
      const isImage = f.type.startsWith('image/');
      const isVideo = f.type.startsWith('video/');
      return isImage || isVideo;
    });
    if (validFiles.length === 0) return;

    setFiles((prev) => [...prev, ...validFiles]);
    validFiles.forEach((f) => {
      const url = URL.createObjectURL(f);
      setPreviews((prev) => [...prev, url]);
    });
  }, []);

  const handleFileChange = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const removeFile = (index) => {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!caption.trim() && files.length === 0) {
      setError('Please add a caption or media to your post.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('caption', caption.trim());
      fd.append('is_free', String(isFree));
      files.forEach((f) => fd.append('media', f));

      const res = await createPost(fd);
      if (res.data.success) {
        // Clean up preview URLs
        previews.forEach((url) => URL.revokeObjectURL(url));
        navigate(`/${user.username}`);
      } else {
        setError(res.data.error || 'Failed to create post.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create post. Please try again.');
    }
    setSubmitting(false);
  };

  if (!user?.is_creator) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <Lock size={36} className="text-gray-500 mb-4" />
        <h2 className="text-white text-xl font-semibold mb-2">Creator Access Only</h2>
        <p className="text-gray-400 text-sm mb-6">
          Enable creator mode in settings to post content.
        </p>
        <button
          onClick={() => navigate('/settings')}
          className="bg-[#00b8ff] hover:bg-[#0099d4] text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors"
        >
          Go to Settings
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-white text-xl font-bold">Create Post</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-400 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
            <X size={16} />
            {error}
          </div>
        )}

        {/* Media Upload Area */}
        <div>
          <label className="block text-gray-400 text-sm font-medium mb-2">Media</label>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragging
                ? 'border-[#00b8ff] bg-[#00b8ff]/5'
                : 'border-[#3a3a3a] hover:border-[#00b8ff]/60 bg-[#1a1a1a]'
            }`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${dragging ? 'bg-[#00b8ff]/20' : 'bg-[#2a2a2a]'}`}>
                <Upload size={22} className={dragging ? 'text-[#00b8ff]' : 'text-gray-400'} />
              </div>
              <div>
                <p className="text-white text-sm font-medium">
                  {dragging ? 'Drop files here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Images (JPG, PNG, GIF, WebP) or Videos (MP4, MOV, WebM)
                </p>
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* File Previews */}
        {previews.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-400 text-sm font-medium">
                Selected Files ({files.length})
              </label>
              <button
                type="button"
                onClick={() => {
                  previews.forEach((url) => URL.revokeObjectURL(url));
                  setFiles([]);
                  setPreviews([]);
                }}
                className="text-gray-500 hover:text-red-400 text-xs transition-colors"
              >
                Remove all
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {previews.map((url, i) => (
                <FilePreview
                  key={i}
                  file={files[i]}
                  url={url}
                  index={i}
                  onRemove={removeFile}
                />
              ))}
            </div>
          </div>
        )}

        {/* Caption */}
        <div>
          <label className="block text-gray-400 text-sm font-medium mb-1.5">
            Caption
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write something for your fans..."
            rows={4}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:border-[#00b8ff] focus:outline-none transition-colors resize-none"
          />
          <p className="text-gray-600 text-xs mt-1 text-right">{caption.length} chars</p>
        </div>

        {/* Free/Paid Toggle */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-white text-sm font-semibold mb-3">Visibility</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsFree(true)}
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors border ${
                isFree
                  ? 'bg-[#00b8ff]/10 border-[#00b8ff] text-[#00b8ff]'
                  : 'border-[#2a2a2a] text-gray-400 hover:border-[#3a3a3a]'
              }`}
            >
              <Unlock size={16} />
              <div className="text-left">
                <p className="font-semibold">Free</p>
                <p className="text-xs opacity-70 font-normal">Everyone can see</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setIsFree(false)}
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors border ${
                !isFree
                  ? 'bg-[#00b8ff]/10 border-[#00b8ff] text-[#00b8ff]'
                  : 'border-[#2a2a2a] text-gray-400 hover:border-[#3a3a3a]'
              }`}
            >
              <Lock size={16} />
              <div className="text-left">
                <p className="font-semibold">Paid</p>
                <p className="text-xs opacity-70 font-normal">Subscribers only</p>
              </div>
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || (!caption.trim() && files.length === 0)}
          className="w-full flex items-center justify-center gap-2 bg-[#00b8ff] hover:bg-[#0099d4] text-white font-semibold rounded-xl px-6 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Publishing...
            </>
          ) : (
            <>
              <Send size={18} />
              Publish Post
            </>
          )}
        </button>
      </form>
    </div>
  );
}
