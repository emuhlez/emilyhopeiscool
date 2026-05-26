import { useState } from 'react'
import { Desktop } from './features/desktop/Desktop'
import { LockScreen } from './features/lock-screen/LockScreen'

function App() {
  // Lock state is intentionally component-local — it's a one-shot gate that
  // resets per page load. If we ever add a "Lock Screen" menu item or Cmd+L
  // shortcut, this moves to `app-store.ts` (see `system-architect` skill
  // notes). For now, useState keeps it scoped to where it's actually used.
  const [locked, setLocked] = useState(true)

  return (
    <>
      <Desktop />
      <LockScreen locked={locked} onUnlock={() => setLocked(false)} />
    </>
  )
}

export default App
