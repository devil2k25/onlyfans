import api from './axios.js';

export const getFeed = (page = 1) =>
  api.get('/posts/feed', { params: { page } });

export const getCreatorPosts = (userId, page = 1) =>
  api.get(`/posts/creator/${userId}`, { params: { page } });

export const createPost = (formData) =>
  api.post('/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const deletePost = (id) => api.delete(`/posts/${id}`);

export const likePost = (id) => api.post(`/posts/${id}/like`);

export const unlikePost = (id) => api.delete(`/posts/${id}/like`);

export const getComments = (id) => api.get(`/posts/${id}/comments`);

export const addComment = (id, content) =>
  api.post(`/posts/${id}/comments`, { content });

export const deleteComment = (postId, commentId) =>
  api.delete(`/posts/${postId}/comments/${commentId}`);
