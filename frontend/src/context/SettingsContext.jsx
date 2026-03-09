import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
    const [apiMode, setApiMode] = useState('default')     // 'default' | 'user'
    const [apiKey, setApiKey] = useState('')             // only used when mode='user'
    const [model, setModel] = useState('')             // selected model name
    const [models, setModels] = useState([])             // available models list
    const [loadingModels, setLoadingModels] = useState(false)
    const [showKeyModal, setShowKeyModal] = useState(false)

    const fetchModels = useCallback(async (mode, key) => {
        setLoadingModels(true)
        try {
            const body = { mode }
            if (mode === 'user' && key) body.api_key = key
            const { data } = await api.post('/check_models', body)
            const list = data.models || []
            setModels(list)
            // pick first model if current selection not in list
            if (list.length > 0 && !list.includes(model)) {
                setModel(list.find(m => m.includes('flash')) || list[0])
            }
        } catch {
            setModels([])
        } finally {
            setLoadingModels(false)
        }
    }, [model])

    // fetch models on mount with default key
    useEffect(() => { fetchModels('default', '') }, [])

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

    const confirmUserKey = (key) => {
        setApiKey(key)
        setApiMode('user')
        setShowKeyModal(false)
        fetchModels('user', key)
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
