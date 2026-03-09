import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem('token'))
    const [userId, setUserId] = useState(() => localStorage.getItem('user_id'))
    const [username, setUsername] = useState(() => localStorage.getItem('username'))

    const login = (tok, uid, uname) => {
        localStorage.setItem('token', tok)
        localStorage.setItem('user_id', uid)
        if (uname) localStorage.setItem('username', uname)
        setToken(tok)
        setUserId(uid)
        if (uname) setUsername(uname)
    }

    const logout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user_id')
        localStorage.removeItem('username')
        setToken(null)
        setUserId(null)
        setUsername(null)
    }

    return (
        <AuthContext.Provider value={{ token, userId, username, login, logout, isAuth: !!token }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() { return useContext(AuthContext) }
