import api from './axios.js';

export const getMySubscriptions = () => api.get('/subscriptions/my');

export const getMySubscribers = () => api.get('/subscriptions/subscribers');

export const subscribe = (creatorId) =>
  api.post(`/subscriptions/${creatorId}`);

export const unsubscribe = (creatorId) =>
  api.delete(`/subscriptions/${creatorId}`);

export const checkSubscription = (creatorId) =>
  api.get(`/subscriptions/check/${creatorId}`);

export const freeSubscribe = (creatorId) =>
  api.post(`/subscriptions/${creatorId}`);
