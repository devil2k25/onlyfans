import api from './axios.js';

export const register = (data) => api.post('/auth/register', data);

export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const getMe = () => api.get('/auth/me');
