import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ThemeProvider } from './components/theme-provider'
import { restoreSession } from './store/app'
import { captureBankCallback } from './services/bank'
import './index.css'

captureBankCallback()
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1, refetchOnWindowFocus: true } } })
createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider><QueryClientProvider client={queryClient}><App /></QueryClientProvider></ThemeProvider></StrictMode>)
void restoreSession()
