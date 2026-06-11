import api from './axios';

export const createCallSession = (receiverId, callType) =>
  api.post('/calls', { receiver_id: receiverId, call_type: callType });

export const getCallSessions = () => api.get('/calls');

export const getBookings = () => api.get('/calls/bookings');

export const createBooking = (data) => api.post('/calls/bookings', data);

export const confirmBooking = (id) => api.put(`/calls/bookings/${id}/confirm`);

export const cancelBooking = (id) => api.put(`/calls/bookings/${id}/cancel`);

export const getAvailability = (creatorId) =>
  api.get(`/calls/availability/${creatorId}`);

export const setAvailability = (slots) =>
  api.put('/calls/availability', { slots });
