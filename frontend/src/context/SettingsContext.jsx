import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
    const [apiMode, setApiMode] = useState(() => sessionStorage.getItem('apiMode') || 'default')
    const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('apiKey') || '')
    const [model, setModel] = useState(() => sessionStorage.getItem('model') || '')
    const [models, setModels] = useState([])             // available models list
    const [loadingModels, setLoadingModels] = useState(false)
    const [showKeyModal, setShowKeyModal] = useState(false)

    useEffect(() => {
        sessionStorage.setItem('apiMode', apiMode)
    }, [apiMode])

    useEffect(() => {
        sessionStorage.setItem('apiKey', apiKey)
    }, [apiKey])

    useEffect(() => {
        sessionStorage.setItem('model', model)
    }, [model])

    const fetchModels = useCallback(async (mode, key) => {
        setLoadingModels(true)
        try {
            const body = { mode }
            if (mode === 'user' && key) body.api_key = key
            const { data } = await api.post('/check_models', body)
            const list = data.models || []
            setModels(list)
        } catch {
            setModels([])
        } finally {
            setLoadingModels(false)
        }
    }, [])

    // fetch models whenever API mode or key changes
    useEffect(() => { 
        fetchModels(apiMode, apiKey) 
    }, [fetchModels, apiMode, apiKey])

    // Ensure valid model is selected whenever the models list changes
    useEffect(() => {
        if (models.length > 0 && !models.includes(model)) {
            setModel(prev => {
                if (models.includes(prev)) return prev;
                return models.find(m => m.includes('1.5-flash')) || 
                       models[0];
            })
        }
    }, [models, model])

    // Build the LLM payload to attach to every API call
    const llmPayload = {
        model,
        mode: apiMode,
        ...(apiMode === 'user' && apiKey ? { api_key: apiKey } : {})
    }

    const switchToUser = () => setShowKeyModal(true)
    const switchToDefault = () => {
        setApiMode('default')
        setApiKey('')
        fetchModels('default', '')
    }

    const confirmUserKey = async (key) => {
        setLoadingModels(true)
        try {
            const { data } = await api.post('/check_models', { mode: 'user', api_key: key })
            const list = data.models || []
            setModels(list)
            setApiKey(key)
            setApiMode('user')
            setShowKeyModal(false)
            if (list.length > 0 && !list.includes(model)) {
                setModel(list.find(m => m.includes('1.5-flash')) || list[0])
            }
            return { success: true }
        } catch (err) {
            const msg = err.response?.data?.error || 'Invalid API Key'
            return { success: false, error: msg }
        } finally {
            setLoadingModels(false)
        }
    }

    return (
        <SettingsContext.Provider value={{
            apiMode, apiKey, model, models, loadingModels,
            setModel, switchToUser, switchToDefault, confirmUserKey,
            showKeyModal, setShowKeyModal,
            llmPayload,
            fetchModels,
        }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() { return useContext(SettingsContext) }
