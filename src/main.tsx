import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// The lock-screen splash inlined in `index.html` is the "instant paint" layer
// for slow first-loads. React then mounts ASAP and renders its own <LockScreen />
// overlay (visually identical to the splash) which owns the click-to-unlock
// interaction and the fade-out transition into the Desktop.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
