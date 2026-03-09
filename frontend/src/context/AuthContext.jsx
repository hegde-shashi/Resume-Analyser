import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem('token'))
    const [userId, setUserId] = useState(() => localStorage.getItem('user_id'))

    const login = (tok, uid) => {
        localStorage.setItem('token', tok)
        localStorage.setItem('user_id', uid)
        setToken(tok)
        setUserId(uid)
    }

    const logout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user_id')
        setToken(null)
        setUserId(null)
    }

    return (
        <AuthContext.Provider value={{ token, userId, login, logout, isAuth: !!token }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() { return useContext(AuthContext) }
