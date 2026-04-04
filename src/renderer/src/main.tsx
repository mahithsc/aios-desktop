import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { APP_THEME_VARIABLES } from '@shared/config'
import App from './App'

const rootElement = document.documentElement

rootElement.classList.add('dark')
rootElement.style.colorScheme = 'dark'
rootElement.dataset.windowMode = 'main'
document.body.dataset.windowMode = 'main'

Object.entries(APP_THEME_VARIABLES).forEach(([name, value]) => {
  rootElement.style.setProperty(name, value)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
