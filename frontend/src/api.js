import axios from 'axios'

// If deployed to Azure with a separate frontend/backend, the API url must be passed via env variables
// NOTE: `process.env.REACT_APP_API_URL` is replaced at BUILD time by React. It will not work if you type it in the browser console.
let apiUrl = '';
try {
    apiUrl = process.env.REACT_APP_API_URL || '';
} catch (error) {
    console.warn("API URL variable was missing during build.");
}

const api = axios.create({
    baseURL: apiUrl
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

api.interceptors.response.use(
    (r) => r,
    (err) => {
        // Only clear token and reload if it's an authentication error AND we're NOT on the login page
        // This prevents the page from reloading instantly when a user types the wrong password, 
        // allowing the "Invalid password" toast to actually show up.
        const isAuthPage = window.location.pathname === '/' || window.location.pathname === '/auth';

        if ((err.response?.status === 401 || err.response?.status === 422) && !isAuthPage) {
            localStorage.removeItem('token')
            localStorage.removeItem('user_id')
            localStorage.removeItem('username')
            window.location.reload()
        }
        return Promise.reject(err)
    }
)

export default api
