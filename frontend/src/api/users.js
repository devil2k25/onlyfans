import api from './axios.js';

export const getProfile = (username) => api.get(`/users/${username}`);

export const updateProfile = (data) => api.put('/users/me', data);

export const updateAvatar = (formData) =>
  api.post('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const updateCover = (formData) =>
  api.post('/users/me/cover', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const searchUsers = (q) => api.get('/users/search', { params: { q } });

export const listCreators = (page = 1) =>
  api.get('/users/creators', { params: { page } });

export const getStats = (userId) => api.get(`/users/${userId}/stats`);
