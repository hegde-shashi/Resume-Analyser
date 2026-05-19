import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
    const { isAuth } = useAuth()
    const [jobs, setJobs] = useState([])
    const [resume, setResume] = useState(null)
    const [loading, setLoading] = useState(false)
    const [lastFetch, setLastFetch] = useState(null)

    const fetchAll = useCallback(async (force = false, silent = false) => {
        // Only fetch if authenticated
        if (!isAuth) return;

        // Don't fetch if we have data and it's fresh (less than 2 mins old), unless forced
        const now = Date.now();
        if (!force && lastFetch && (now - lastFetch < 120000) && jobs.length > 0) {
            return;
        }

        if (!silent) setLoading(true)
        try {
            const [jRes, rRes] = await Promise.all([
                api.get('/get_jobs'),
                api.get('/get_resume')
            ])
            setJobs(jRes.data)
            setResume(rRes.data)
            setLastFetch(now)
        } catch (err) {
            console.error("Failed to fetch data:", err)
        } finally {
            if (!silent) setLoading(false)
        }
    }, [isAuth, lastFetch, jobs.length])

    // Initial load when authenticated
    useEffect(() => {
        if (isAuth) {
            fetchAll()
        } else {
            // Clear data on logout
            setJobs([])
            setResume(null)
            setLastFetch(null)
        }
    }, [isAuth, fetchAll])

    // Refresh when window gains focus (user comes back from extension) or periodically
    useEffect(() => {
        if (!isAuth) return;
        
        const onFocus = () => fetchAll(true, true)
        window.addEventListener('focus', onFocus)
        
        // Listen for direct messages from the extension's content script
        const onMessage = (event) => {
            if (event.data?.type === 'MAARGA_JOB_SAVED') {
                fetchAll(true, true)
            }
        }
        window.addEventListener('message', onMessage)

        // Poll silently every 10 seconds to catch jobs added via the extension
        // while the browser window is side-by-side or not triggering focus events
        const pollInterval = setInterval(() => {
            fetchAll(true, true)
        }, 10000)

        return () => {
            window.removeEventListener('focus', onFocus)
            window.removeEventListener('message', onMessage)
            clearInterval(pollInterval)
        }
    }, [isAuth, fetchAll])

    const refresh = () => fetchAll(true)

    return (
        <DataContext.Provider value={{ 
            jobs, setJobs, 
            resume, setResume, 
            loading, refresh,
            isDataLoaded: !!lastFetch 
        }}>
            {children}
        </DataContext.Provider>
    )
}

export function useData() { return useContext(DataContext) }
