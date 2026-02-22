import { createContext, useContext, useState, useEffect } from 'react'
import { signUp, signIn, signOut, onAuthChange } from '../services/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const register = async (email, password, displayName) => {
    const user = await signUp(email, password, displayName)
    return user
  }

  const login = async (email, password) => {
    const user = await signIn(email, password)
    return user
  }

  const logout = async () => {
    await signOut()
  }

  const value = { user, loading, register, login, logout }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
