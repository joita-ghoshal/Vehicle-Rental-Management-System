import { useEffect, useState } from 'react'
import { api } from './api'

// Loads data from the API. Pass null as the path to skip loading.
export function useApi(path) {
  const [state, setState] = useState({ data: null, loading: path !== null, error: '' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (path === null) return undefined
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: '' }))
    api(path)
      .then((data) => !cancelled && setState({ data, loading: false, error: '' }))
      .catch((err) => !cancelled && setState({ data: null, loading: false, error: err.message }))
    return () => {
      cancelled = true
    }
  }, [path, tick])

  return { ...state, reload: () => setTick((t) => t + 1) }
}
