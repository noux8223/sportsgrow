import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api'

export interface AsyncData<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

interface AsyncResult<T> {
  key: string
  version: number
  data: T | null
  error: string | null
}

export function useAsyncData<T>(loader: () => Promise<T>, key: string): AsyncData<T> {
  const loaderRef = useRef(loader)
  useEffect(() => {
    loaderRef.current = loader
  })

  const [version, setVersion] = useState(0)
  const [result, setResult] = useState<AsyncResult<T>>({
    key: '',
    version: -1,
    data: null,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    loaderRef
      .current()
      .then((data) => {
        if (!cancelled) setResult({ key, version, data, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResult({
          key,
          version,
          data: null,
          error:
            error instanceof ApiError
              ? error.message
              : '정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [key, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])

  const current = result.key === key && result.version === version
  return {
    data: current ? result.data : null,
    error: current ? result.error : null,
    loading: !current,
    reload,
  }
}
