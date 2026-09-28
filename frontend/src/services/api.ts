import axios from 'axios';

const getBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return '';
    }
    if (host.includes('rescueship-frontend')) {
      return 'https://rescueship.onrender.com';
    }
    if (host === 'rescueship.onrender.com') {
      return '';
    }
  }
  return '';
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiry and transparently retry cold-start errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response && error.response.status === 401) {
      // Clear storage and redirect to login if session expires
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Auto-retry cold starts (502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout, network drop)
    const status = error.response ? error.response.status : null;
    const isColdStart = status === 502 || status === 503 || status === 504 || error.code === 'ECONNABORTED' || (!status && !error.response);

    if (isColdStart && originalRequest && (originalRequest._retryCount || 0) < 3) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      const backoffMs = originalRequest._retryCount * 2500; // 2.5s, 5s, 7.5s
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default api;
