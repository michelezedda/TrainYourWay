import { useEffect } from 'react'

const BASE = 'UPLYFT - Train. Evolve. Repeat.'

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | UPLYFT` : BASE
  }, [title])
}
