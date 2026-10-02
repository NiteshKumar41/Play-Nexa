const configuredApiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, '');
export const API_PREFIX = '/api/v1';
export const API_V1_BASE_URL = `${API_BASE_URL}${API_PREFIX}`;
const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL || API_BASE_URL;
export const SOCKET_URL = configuredSocketUrl.replace(/\/+$/, '');
