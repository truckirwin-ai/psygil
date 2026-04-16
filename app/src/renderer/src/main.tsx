import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/global.css'
import App from './App'
import { BrandingProvider } from './hooks/useBranding'
import { initThemeOnLoad } from './app/theme'

// Apply the persisted theme before the first render to avoid a flash.
initThemeOnLoad()

const root = document.getElementById('root')!
createRoot(root).render(
  <BrandingProvider>
    <App />
  </BrandingProvider>
)
