import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

if (/Mac|iPhone|iPad/.test(navigator.platform) || navigator.userAgent.includes('Mac OS')) {
  document.documentElement.classList.add('platform-darwin')
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
