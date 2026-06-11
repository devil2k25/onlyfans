import api from './axios';

export const createStream = (data) => api.post('/streams', data);

export const getStreams = (page = 1) => api.get(`/streams?page=${page}`);

export const getStream = (id) => api.get(`/streams/${id}`);

export const getCreatorStreams = (userId) =>
  api.get(`/streams/creator/${userId}`);

export const endStream = (id) => api.put(`/streams/${id}/end`);

export const deleteStream = (id) => api.delete(`/streams/${id}`);

export const getStreamChat = (id) => api.get(`/streams/${id}/chat`);
