import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { APP_THEME_VARIABLES } from '@shared/config'
import {
  MAIN_WINDOW_MODE,
  RENDERER_WINDOW_MODE_QUERY_KEY,
  WIDGET_WINDOW_MODE,
  type RendererWindowMode
} from '@shared/window'
import App from './App'
import WidgetApp from './WidgetApp'

const rootElement = document.documentElement
const searchParams = new URLSearchParams(window.location.search)
const requestedWindowMode = searchParams.get(RENDERER_WINDOW_MODE_QUERY_KEY)
const windowMode: RendererWindowMode =
  requestedWindowMode === WIDGET_WINDOW_MODE ? WIDGET_WINDOW_MODE : MAIN_WINDOW_MODE
const RootApp = windowMode === WIDGET_WINDOW_MODE ? WidgetApp : App

rootElement.classList.add('dark')
rootElement.style.colorScheme = 'dark'
rootElement.dataset.windowMode = windowMode
document.body.dataset.windowMode = windowMode

Object.entries(APP_THEME_VARIABLES).forEach(([name, value]) => {
  rootElement.style.setProperty(name, value)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>
)
