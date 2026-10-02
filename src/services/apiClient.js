import { API_BASE_URL, API_PREFIX } from '../config/api';
import { clearAuthToken, getAuthToken } from './tokenStorage';

export const AUTH_EXPIRED_EVENT = 'playnexa:auth-expired';

const HTTP_ERROR_MESSAGES = {
  400: 'The request could not be processed.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested item could not be found.',
  409: 'This request conflicts with the current state.',
  422: 'Please check the submitted information.',
  429: 'Too many requests. Please try again shortly.',
  500: 'The server encountered an error. Please try again later.',
};

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function buildUrl(path, useApiPrefix) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const prefix = useApiPrefix ? API_PREFIX : '';
  return `${API_BASE_URL}${prefix}${normalizedPath}`;
}

async function parseResponse(response) {
  if (response.status === 204) return null;

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeResponse(responseBody) {
  if (
    responseBody
    && typeof responseBody === 'object'
    && ('success' in responseBody || 'message' in responseBody || 'data' in responseBody)
  ) {
    return {
      success: responseBody.success ?? true,
      message: responseBody.message ?? '',
      data: responseBody.data ?? null,
    };
  }

  return {
    success: true,
    message: '',
    data: responseBody,
  };
}

function handleUnauthorized() {
  clearAuthToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers: customHeaders = {},
    signal,
    useApiPrefix = true,
    includeAuth = true,
  } = options;
  const headers = { Accept: 'application/json', ...customHeaders };
  const token = getAuthToken();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (includeAuth && token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(buildUrl(path, useApiPrefix), {
      method,
      headers,
      body: isFormData ? body : body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch {
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 0);
  }

  const responseBody = await parseResponse(response);
  if (!response.ok) {
    if (response.status === 401 && includeAuth && token) handleUnauthorized();

    const message = typeof responseBody?.message === 'string'
      ? responseBody.message
      : HTTP_ERROR_MESSAGES[response.status] || 'The request failed. Please try again.';
    throw new ApiError(message, response.status, responseBody?.data ?? null);
  }

  return normalizeResponse(responseBody);
}

async function getBlob(path) {
  const token = getAuthToken();
  const url = /^https?:\/\//i.test(path)
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const requestOrigin = new URL(url).origin;
  const apiOrigin = new URL(API_BASE_URL).origin;
  const headers = token && requestOrigin === apiOrigin
    ? { Authorization: `Bearer ${token}` }
    : {};

  let response;
  try {
    response = await fetch(url, { headers });
  } catch {
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 0);
  }

  if (!response.ok) {
    if (response.status === 401 && token) handleUnauthorized();
    const body = await parseResponse(response);
    const message = typeof body?.message === 'string'
      ? body.message
      : HTTP_ERROR_MESSAGES[response.status] || 'Unable to load the requested file.';
    throw new ApiError(message, response.status, body?.data ?? null);
  }

  return response.blob();
}

export const apiClient = {
  request,
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  getBlob,
  checkHealth: () => request('/health', { useApiPrefix: false, includeAuth: false }),
};
