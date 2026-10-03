const configuredApiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, '');
export const API_PREFIX = '/api/v1';
export const API_V1_BASE_URL = `${API_BASE_URL}${API_PREFIX}`;
// Razorpay's key ID is public and may be used by the browser checkout in a later step.
export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL || API_BASE_URL;
export const SOCKET_URL = configuredSocketUrl.replace(/\/+$/, '');
