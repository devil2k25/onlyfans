import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, getMe } from '../api/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe()
        .then((res) => {
          if (res.data.success) {
            setUser(res.data.data);
          } else {
            localStorage.removeItem('token');
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await apiLogin(email, password);
    if (res.data.success) {
      const { token, user: userData } = res.data.data;
      localStorage.setItem('token', token);
      setUser(userData);
      return { success: true };
    }
    return { success: false, error: res.data.error };
  };

  const register = async (data) => {
    const res = await apiRegister(data);
    if (res.data.success) {
      const { token, user: userData } = res.data.data;
      localStorage.setItem('token', token);
      setUser(userData);
      return { success: true };
    }
    return { success: false, error: res.data.error };
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (data) => {
    setUser((prev) => ({ ...prev, ...data }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
