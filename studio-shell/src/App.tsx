import { Component, useMemo, useEffect } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { useEditorStore } from './store/editorStore'
import { simulatePlanMode } from './ai/simulate-plan-mode'
import { useDockingStore } from './store/dockingStore'
import { useConversationStore } from './store/conversationStore'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Hierarchy } from './components/Hierarchy/Hierarchy'
import { Viewport } from './components/Viewport/Viewport'
import { Inspector } from './components/Inspector/Inspector'
import { Assets } from './components/Assets/Assets'
import { Console } from './components/Console/Console'
import { AIAssistant } from './components/AIAssistant/AIAssistant'
import { Comments } from './components/Comments/Comments'
import { Scripting } from './components/Scripting/Scripting'
import { ComponentGallery } from './components/ComponentGallery/ComponentGallery'
import { DockLayout } from './components/shared/DockLayout'
import { DockZoneRenderer } from './components/shared/DockZoneRenderer'
import { DockablePanel } from './components/shared/DockablePanel'
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel'
import { Monitor } from 'lucide-react'
import { publicUrl } from './utils/assetUrl'
import { useBackgroundTaskRunner } from './ai/use-background-task-runner'
import { useMeshyPoller } from './ai/use-meshy-poller'
import styles from './App.module.css'

function App() {
  // Run background task processing at the app level so it works
  // regardless of whether the AI assistant panel is docked.
  useBackgroundTaskRunner()
  useMeshyPoller()

  // Set base-aware asset URLs for CSS (e.g. Inspector checkboxes) so icons load on deployed paths
  useEffect(() => {
    document.documentElement.style.setProperty('--url-checkbox-off', `url(${publicUrl('icons/checkbox-off.svg')})`)
    document.documentElement.style.setProperty('--url-checkbox-on', `url(${publicUrl('icons/checkbox-on.svg')})`)
  }, [])

  // Global hotkeys - capture phase so we handle them before browser/other listeners
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()

      // Escape — close settings panel first, then AI input, then clear area circle
      if (key === 'escape') {
        const { settingsPanelOpen, setSettingsPanelOpen, viewportAIInputOpen, setViewportAIInputOpen } = useDockingStore.getState()
        if (settingsPanelOpen) {
          e.preventDefault()
          e.stopPropagation()
          setSettingsPanelOpen(false)
          return
        }
        if (viewportAIInputOpen) {
          e.preventDefault()
          e.stopPropagation()
          setViewportAIInputOpen(false)
          return
        }
        const editor = useEditorStore.getState()
        if (editor.areaSelectionCircle) {
          e.preventDefault()
          e.stopPropagation()
          editor.setAreaSelectionCircle(null)
        }
        return
      }

      // Cmd+N / Ctrl+N — new chat in the main composer
      if ((e.metaKey || e.ctrlKey) && key === 'n') {
        e.preventDefault()
        e.stopPropagation()
        const { createConversation } = useConversationStore.getState()
        createConversation()
        return
      }

      // Cmd+K / Ctrl+K — toggle main AI assistant panel
      if ((e.metaKey || e.ctrlKey) && key === 'k') {
        e.preventDefault()
        e.stopPropagation()
        const dock = useDockingStore.getState()
        const isVisible = !!dock.widgets['ai-assistant']
        if (isVisible) {
          dock.undockWidget('ai-assistant')
        } else {
          dock.dockWidget('ai-assistant', 'right-top')
          dock.setAiAssistantBodyCollapsed(false)
        }
        return
      }

      // Ctrl+Shift+P — simulate plan mode (questions flow)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 'p') {
        e.preventDefault()
        e.stopPropagation()
        const dock = useDockingStore.getState()
        if (!dock.widgets['ai-assistant']) {
          dock.dockWidget('ai-assistant', 'right-top')
        }
        dock.setAiAssistantBodyCollapsed(false)
        simulatePlanMode('questions')
        return
      }

      // Cmd+/ / Ctrl+/ — viewport AI input: after shift-drag always open mini composer there; otherwise toggle
      if ((e.metaKey || e.ctrlKey) && key === '/') {
        e.preventDefault()
        e.stopPropagation()
        const { viewportAIInputOpen, setViewportAIInputOpen } = useDockingStore.getState()
        const editor = useEditorStore.getState()
        const hasAreaSelection = !!editor.areaSelectionCircle
        if (hasAreaSelection) {
          const c = editor.areaSelectionCircle!
          editor.setAIInputAnchorPosition({ x: c.centerX, y: c.centerY + c.radius - 12 })
          useConversationStore.getState().createConversation()
          setViewportAIInputOpen(true)
        } else if (!viewportAIInputOpen) {
          if (editor.activeTool === 'pen' && editor.penToolLastDrawnPosition) {
            editor.setAIInputAnchorPosition(editor.penToolLastDrawnPosition)
          } else {
            // When objects are selected, the Viewport3D animation loop already
            // projects their bounding-box center to screen and keeps the anchor
            // up-to-date — don't reset it to null (bottom-center).
            if (editor.selectedObjectIds.length === 0) {
              editor.setAIInputAnchorPosition(null)
            }
            if (editor.selectedObjectIds.length > 0 && editor.activeTool !== 'select') {
              editor.setActiveTool('select')
            }
          }
          useConversationStore.getState().createConversation()
          setViewportAIInputOpen(true)
        } else {
          setViewportAIInputOpen(false)
        }
        return
      }

      const inInput =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      if (inInput) return

      // Viewport tools: S Select, W Move, E Rotate, R Scale, T Transform, P Pen (toggle)
      const toolKeys: Record<string, 'select' | 'move' | 'rotate' | 'scale' | 'transform' | 'pen'> = {
        s: 'select',
        w: 'move',
        e: 'rotate',
        r: 'scale',
        t: 'transform',
        p: 'pen',
      }
      if (toolKeys[key]) {
        const { activeTool, setActiveTool } = useEditorStore.getState()
        if (key === 'p') {
          setActiveTool(activeTool === 'pen' ? 'select' : 'pen')
        } else {
          setActiveTool(toolKeys[key]!)
        }
        e.preventDefault()
        e.stopPropagation()
        return
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  // Memoize widgetMap to prevent unnecessary remounts when docking layout changes
  const widgetMap = useMemo(() => ({
    inspector: <Inspector />,
    viewport: (
      <DockablePanel widgetId="viewport" title="Viewport" icon={<Monitor size={16} />} hideCloseButton contentFills>
        <Viewport />
      </DockablePanel>
    ),
    assets: <Assets />,
    console: <Console />,
    'ai-assistant': <AIAssistant />,
    comments: <Comments />,
    explorer: <Hierarchy />,
    componentGallery: <ComponentGallery />,
    scripting: <Scripting />,
  }), [])

  return (
    <div className={styles.editor}>
      <Toolbar />
      <DockLayout
        leftZone={<DockZoneRenderer zone="left" widgetMap={widgetMap} />}
        centerTopZone={<DockZoneRenderer zone="center-top" widgetMap={widgetMap} />}
        centerBottomZone={<DockZoneRenderer zone="center-bottom" widgetMap={widgetMap} />}
        rightTopPanels={{
          inspector: widgetMap.inspector,
          'ai-assistant': widgetMap['ai-assistant'],
        }}
        rightBottomZone={<DockZoneRenderer zone="right-bottom" widgetMap={widgetMap} />}
      />
      <SettingsPanel />
    </div>
  )
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: '#ff6b6b', background: '#1a1a1e', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2 style={{ margin: '0 0 12px' }}>Something crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, opacity: 0.7, marginTop: 8 }}>{this.state.error.stack}</pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function AppWithBoundary() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  )
}

export default AppWithBoundary




