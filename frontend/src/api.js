import axios from 'axios'

const api = axios.create({ baseURL: '/' })

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

api.interceptors.response.use(
    (r) => r,
    (err) => {
        if (err.response?.status === 401 || err.response?.status === 422) {
            localStorage.removeItem('token')
            localStorage.removeItem('user_id')
            window.location.reload()
        }
        return Promise.reject(err)
    }
)

export default api
