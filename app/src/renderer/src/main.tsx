import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/global.css'
import App from './App'
import { BrandingProvider } from './hooks/useBranding'

const root = document.getElementById('root')!
createRoot(root).render(
  <BrandingProvider>
    <App />
  </BrandingProvider>
)
