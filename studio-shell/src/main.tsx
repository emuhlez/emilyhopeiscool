import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { loadFonts } from './utils/loadFonts'
import './styles/global.css'
import { usePlanStore } from './store/planStore'

// Inject @font-face rules with base-aware URLs before first paint
loadFonts()

// Dev helper: simulate question mode from the browser console
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__simulateQuestionMode = () => {
    usePlanStore.getState().setPlan(`sim-${Date.now()}`, {
      todos: [],
      questions: [
        {
          text: 'How big should the obby be?',
          placeholder: 'e.g. 5 stages, 10 stages, endless...',
          category: 'Scope',
          options: [
            { label: 'Quick (3-5 stages)', description: 'A short obby that can be completed in a few minutes' },
            { label: 'Medium (6-10 stages)', description: 'A mid-length course with varied challenges' },
            { label: 'Large (11-20 stages)', description: 'A long obby with multiple sections and checkpoints' },
          ],
        },
        {
          text: 'What types of obstacles should be included?',
          placeholder: 'e.g. jumping, lava, moving platforms...',
          category: 'Gameplay',
          options: [
            { label: 'Platforming', description: 'Jumps, gaps, and moving platforms' },
            { label: 'Hazards', description: 'Lava, spikes, and kill bricks' },
            { label: 'Parkour', description: 'Wall jumps, tight ledges, and speed sections' },
            { label: 'Mixed', description: 'A combination of all obstacle types' },
          ],
        },
        {
          text: 'What theme or setting?',
          placeholder: 'e.g. sky, volcano, forest, space...',
          category: 'World',
          options: [
            { label: 'Sky & Clouds', description: 'Floating platforms in the sky' },
            { label: 'Lava & Volcano', description: 'Fiery volcanic landscape with lava pits' },
            { label: 'Forest & Nature', description: 'Outdoor natural environment with trees and rocks' },
          ],
        },
        {
          text: 'What visual style do you prefer?',
          placeholder: 'e.g. realistic, cartoon, neon...',
          category: 'Style',
          options: [
            { label: 'Colorful & Cartoon', description: 'Bright colors and playful shapes' },
            { label: 'Neon & Glow', description: 'Dark background with glowing neon elements' },
            { label: 'Realistic', description: 'Natural materials and realistic lighting' },
          ],
        },
      ],
    })
    console.log('[Dev] Question mode simulation triggered — check the UI')
  }
  console.log('[Dev] Run window.__simulateQuestionMode() to trigger question mode')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)





