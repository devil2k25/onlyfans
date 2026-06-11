import React, { useState, useRef, useEffect } from 'react';
import { Camera, Check, X, Save, User, CreditCard, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { updateProfile, updateAvatar, updateCover } from '../api/users.js';

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-24 md:bottom-6 right-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-lg z-50 ${
        type === 'success'
          ? 'bg-green-900/90 border border-green-700 text-green-300'
          : 'bg-red-900/90 border border-red-700 text-red-300'
      }`}
    >
      {type === 'success' ? <Check size={16} /> : <X size={16} />}
      {message}
    </div>
  );
}

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [toast, setToast] = useState(null);

  // Profile section
  const [profileForm, setProfileForm] = useState({
    display_name: user?.display_name || '',
    bio: user?.bio || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const avatarRef = useRef();
  const coverRef = useRef();

  // Creator section
  const [creatorForm, setCreatorForm] = useState({
    is_creator: user?.is_creator || false,
    subscription_price: user?.subscription_price ?? '',
  });
  const [savingCreator, setSavingCreator] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      // Upload avatar if changed
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        const res = await updateAvatar(fd);
        if (res.data.success) {
          updateUser({ avatar_url: res.data.data.avatar_url });
          setAvatarFile(null);
        }
      }
      // Upload cover if changed
      if (coverFile) {
        const fd = new FormData();
        fd.append('cover', coverFile);
        const res = await updateCover(fd);
        if (res.data.success) {
          updateUser({ cover_url: res.data.data.cover_url });
          setCoverFile(null);
        }
      }
      // Update profile text fields
      const res = await updateProfile({
        display_name: profileForm.display_name,
        bio: profileForm.bio,
      });
      if (res.data.success) {
        updateUser(res.data.data);
        showToast('Profile updated successfully!', 'success');
      } else {
        showToast(res.data.error || 'Failed to update profile', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update profile', 'error');
    }
    setSavingProfile(false);
  };

  const handleSaveCreator = async (e) => {
    e.preventDefault();
    setSavingCreator(true);
    try {
      const res = await updateProfile({
        is_creator: creatorForm.is_creator,
        subscription_price: creatorForm.is_creator ? Number(creatorForm.subscription_price) || 0 : 0,
      });
      if (res.data.success) {
        updateUser(res.data.data);
        showToast('Creator settings saved!', 'success');
      } else {
        showToast(res.data.error || 'Failed to save settings', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save settings', 'error');
    }
    setSavingCreator(false);
  };

  const currentAvatar = avatarPreview || user?.avatar_url;
  const currentCover = coverPreview || user?.cover_url;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-white text-xl font-bold mb-6">Settings</h1>

      {/* Profile Section */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden mb-6">
        <div className="flex items-center gap-3 p-4 border-b border-[#2a2a2a]">
          <User size={18} className="text-[#00b8ff]" />
          <h2 className="text-white font-semibold">Profile</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="p-4 space-y-5">
          {/* Cover Image */}
          <div>
            <label className="block text-gray-400 text-sm font-medium mb-2">Cover Image</label>
            <div
              className="relative w-full h-32 rounded-xl overflow-hidden cursor-pointer group border border-[#2a2a2a] hover:border-[#00b8ff] transition-colors"
              onClick={() => coverRef.current?.click()}
            >
              {currentCover ? (
                <img src={currentCover} alt="cover" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ background: 'linear-gradient(135deg, #00b8ff22 0%, #0044ff22 100%)', backgroundColor: '#111' }}
                />
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2 text-white text-sm font-medium">
                  <Camera size={18} />
                  Change Cover
                </div>
              </div>
            </div>
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="hidden"
            />
            {coverFile && (
              <p className="text-[#00b8ff] text-xs mt-1">{coverFile.name} selected</p>
            )}
          </div>

          {/* Avatar */}
          <div>
            <label className="block text-gray-400 text-sm font-medium mb-2">Profile Photo</label>
            <div className="flex items-center gap-4">
              <div
                className="relative w-16 h-16 rounded-full overflow-hidden cursor-pointer group border-2 border-[#2a2a2a] hover:border-[#00b8ff] transition-colors flex-shrink-0"
                onClick={() => avatarRef.current?.click()}
              >
                {currentAvatar ? (
                  <img src={currentAvatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#00b8ff] flex items-center justify-center text-white text-xl font-bold">
                    {((user?.display_name || user?.username || 'U')[0]).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={16} className="text-white" />
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => avatarRef.current?.click()}
                  className="text-[#00b8ff] hover:text-white text-sm font-medium transition-colors"
                >
                  Upload new photo
                </button>
                <p className="text-gray-500 text-xs mt-0.5">JPG, PNG or GIF. Max 5MB.</p>
              </div>
            </div>
            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            {avatarFile && (
              <p className="text-[#00b8ff] text-xs mt-1">{avatarFile.name} selected</p>
            )}
          </div>

          <div>
            <label className="block text-gray-400 text-sm font-medium mb-1.5">Display Name</label>
            <input
              type="text"
              value={profileForm.display_name}
              onChange={(e) => setProfileForm((p) => ({ ...p, display_name: e.target.value }))}
              placeholder="Your display name"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-gray-600 rounded-lg px-4 py-2.5 text-sm focus:border-[#00b8ff] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm font-medium mb-1.5">Bio</label>
            <textarea
              value={profileForm.bio}
              onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
              placeholder="Tell your fans about yourself..."
              rows={3}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-gray-600 rounded-lg px-4 py-2.5 text-sm focus:border-[#00b8ff] focus:outline-none transition-colors resize-none"
            />
            <p className="text-gray-600 text-xs mt-1 text-right">{profileForm.bio.length}/300</p>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="flex items-center gap-2 bg-[#00b8ff] hover:bg-[#0099d4] text-white font-semibold rounded-lg px-5 py-2.5 transition-colors text-sm disabled:opacity-60"
          >
            {savingProfile ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Creator Settings */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden mb-6">
        <div className="flex items-center gap-3 p-4 border-b border-[#2a2a2a]">
          <CreditCard size={18} className="text-[#00b8ff]" />
          <h2 className="text-white font-semibold">Creator Settings</h2>
        </div>

        <form onSubmit={handleSaveCreator} className="p-4 space-y-5">
          {/* Is Creator Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Creator Mode</p>
              <p className="text-gray-500 text-xs mt-0.5">Enable to post content and accept subscribers</p>
            </div>
            <button
              type="button"
              onClick={() => setCreatorForm((p) => ({ ...p, is_creator: !p.is_creator }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                creatorForm.is_creator ? 'bg-[#00b8ff]' : 'bg-[#3a3a3a]'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  creatorForm.is_creator ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Subscription Price */}
          {creatorForm.is_creator && (
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-1.5">
                Monthly Subscription Price (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  max="999"
                  step="0.01"
                  value={creatorForm.subscription_price}
                  onChange={(e) => setCreatorForm((p) => ({ ...p, subscription_price: e.target.value }))}
                  placeholder="0.00"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-gray-600 rounded-lg pl-7 pr-4 py-2.5 text-sm focus:border-[#00b8ff] focus:outline-none transition-colors"
                />
              </div>
              <p className="text-gray-500 text-xs mt-1">Set to 0 for a free subscription</p>
            </div>
          )}

          <button
            type="submit"
            disabled={savingCreator}
            className="flex items-center gap-2 bg-[#00b8ff] hover:bg-[#0099d4] text-white font-semibold rounded-lg px-5 py-2.5 transition-colors text-sm disabled:opacity-60"
          >
            {savingCreator ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {savingCreator ? 'Saving...' : 'Save Creator Settings'}
          </button>
        </form>
      </div>

      {/* Account Section */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-[#2a2a2a]">
          <Shield size={18} className="text-[#00b8ff]" />
          <h2 className="text-white font-semibold">Account</h2>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-gray-400 text-sm font-medium mb-1.5">Username</label>
            <input
              type="text"
              value={`@${user?.username || ''}`}
              readOnly
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-gray-500 rounded-lg px-4 py-2.5 text-sm cursor-not-allowed"
            />
            <p className="text-gray-600 text-xs mt-1">Username cannot be changed</p>
          </div>

          <div>
            <label className="block text-gray-400 text-sm font-medium mb-1.5">Email Address</label>
            <input
              type="email"
              value={user?.email || ''}
              readOnly
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-gray-500 rounded-lg px-4 py-2.5 text-sm cursor-not-allowed"
            />
            <p className="text-gray-600 text-xs mt-1">Email cannot be changed</p>
          </div>

          <div className="pt-2 border-t border-[#2a2a2a]">
            <p className="text-gray-500 text-xs">
              Account created: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
