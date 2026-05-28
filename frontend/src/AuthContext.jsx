import { createContext, useContext, useState, useEffect } from 'react'
import api from './api/client'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mvai_user')) } catch { return null }
  })

  const login = async (email, password) => {
    const form = new URLSearchParams({ username: email, password })
    const { data } = await api.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    localStorage.setItem('mvai_token', data.access_token)
    localStorage.setItem('mvai_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('mvai_token')
    localStorage.removeItem('mvai_user')
    setUser(null)
  }

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
