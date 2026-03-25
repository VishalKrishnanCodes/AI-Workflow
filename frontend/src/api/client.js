// PATH: frontend/src/api/client.js
//
// A pre-configured axios instance.
// Every API file imports `api` from here — so the base URL
// only needs to be set in one place.

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

// Log errors globally during development
api.interceptors.response.use(
  res => res,
  err => {
    console.error('[API Error]', err?.response?.data || err.message)
    return Promise.reject(err)
  }
)

export default api