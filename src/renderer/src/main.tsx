import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { APP_THEME_VARIABLES } from '@shared/config'
import App from './App'
import { getWindowMode } from './lib/windowMode'

const rootElement = document.documentElement
const windowMode = getWindowMode()

rootElement.classList.add('dark')
rootElement.style.colorScheme = 'dark'
rootElement.dataset.windowMode = windowMode
document.body.dataset.windowMode = windowMode

Object.entries(APP_THEME_VARIABLES).forEach(([name, value]) => {
  rootElement.style.setProperty(name, value)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
