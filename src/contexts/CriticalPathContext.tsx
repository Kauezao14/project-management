import { createContext, useContext } from 'react'

export const CriticalPathContext = createContext<Set<string>>(new Set())
export const useCriticalPath = () => useContext(CriticalPathContext)
