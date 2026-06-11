import api from './axios.js';

export const getConversations = () => api.get('/messages/conversations');

export const getMessages = (userId) => api.get(`/messages/${userId}`);

export const sendMessage = (userId, content) =>
  api.post(`/messages/${userId}`, { content });

export const markRead = (userId) =>
  api.post(`/messages/${userId}/read`);
