import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    display_name: '',
    is_creator: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.username || !form.password) {
      setError('Email, username, and password are required.');
      return;
    }
    if (form.username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await register(form);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#00b8ff] mb-2">FanSpace</h1>
          <p className="text-gray-400">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-gray-400 text-sm font-medium mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                name="display_name"
                value={form.display_name}
                onChange={handleChange}
                placeholder="Your Name"
                autoComplete="name"
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-gray-600 rounded-lg px-4 py-3 text-sm focus:border-[#00b8ff] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-medium mb-1.5">
                Username <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="yourhandle"
                  autoComplete="username"
                  required
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-gray-600 rounded-lg pl-8 pr-4 py-3 text-sm focus:border-[#00b8ff] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-medium mb-1.5">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-gray-600 rounded-lg px-4 py-3 text-sm focus:border-[#00b8ff] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-medium mb-1.5">
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  required
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-gray-600 rounded-lg px-4 py-3 pr-12 text-sm focus:border-[#00b8ff] focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Creator Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  name="is_creator"
                  checked={form.is_creator}
                  onChange={handleChange}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    form.is_creator
                      ? 'bg-[#00b8ff] border-[#00b8ff]'
                      : 'border-[#3a3a3a] bg-[#0a0a0a] group-hover:border-[#00b8ff]'
                  }`}
                >
                  {form.is_creator && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <div>
                <span className="text-white text-sm font-medium">I'm a creator</span>
                <p className="text-gray-500 text-xs mt-0.5">
                  Enable this to post content and accept subscriptions
                </p>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00b8ff] hover:bg-[#0099d4] text-white font-semibold rounded-lg px-4 py-3 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus size={18} />
                  Create Account
                </>
              )}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-[#00b8ff] hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
