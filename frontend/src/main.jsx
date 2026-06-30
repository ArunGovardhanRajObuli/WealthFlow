import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 0, // Enforce real-time consistency for financial data
    },
  },
})

// Global Fetch Interceptor to attach the Electron native IPC token
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  
  config = config || {};
  config.headers = config.headers || {};
  
  // Inject native token if available (bypassed if not running in Electron)
  if (window.electronAPI && typeof window.electronAPI.getInternalToken === 'function') {
    const token = await window.electronAPI.getInternalToken();
    if (token) {
      if (config.headers instanceof Headers) {
        config.headers.append('x-internal-token', token);
      } else {
        config.headers['x-internal-token'] = token;
      }
    }
  }
  
  // Inject session token
  const sessionToken = sessionStorage.getItem('session_token');
  if (sessionToken) {
    if (config.headers instanceof Headers) {
      config.headers.append('Authorization', `Bearer ${sessionToken}`);
    } else {
      config.headers['Authorization'] = `Bearer ${sessionToken}`;
    }
  }
  
  return originalFetch(resource, config);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
