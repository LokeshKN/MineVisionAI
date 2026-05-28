import axios from 'axios'

// In production (Vercel) VITE_API_URL = https://minevisionai.onrender.com
// In dev it's empty string so Vite's proxy handles it
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || ''
})

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('mvai_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('mvai_token')
      localStorage.removeItem('mvai_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
