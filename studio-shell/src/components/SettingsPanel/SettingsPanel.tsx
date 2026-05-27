import { X } from 'lucide-react'
import { useDockingStore } from '../../store/dockingStore'
import styles from './SettingsPanel.module.css'

export function SettingsPanel() {
  const open = useDockingStore((s) => s.settingsPanelOpen)
  const setOpen = useDockingStore((s) => s.setSettingsPanelOpen)

  const taskDrawerMode = useDockingStore((s) => s.taskDrawerMode)
  const setTaskDrawerMode = useDockingStore((s) => s.setTaskDrawerMode)
  const taskDrawerMenuSide = useDockingStore((s) => s.taskDrawerMenuSide)
  const setTaskDrawerMenuSide = useDockingStore((s) => s.setTaskDrawerMenuSide)

  const chatbotUIMode = useDockingStore((s) => s.chatbotUIMode)
  const setChatbotUIMode = useDockingStore((s) => s.setChatbotUIMode)


  const nebulaMode = useDockingStore((s) => s.nebulaMode)
  const setNebulaMode = useDockingStore((s) => s.setNebulaMode)

  const assistantPanelMode = useDockingStore((s) => s.assistantPanelMode)
  const setAssistantPanelMode = useDockingStore((s) => s.setAssistantPanelMode)

  if (!open) return null

  return (
    <>
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setOpen(false)}
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>
        <div className={styles.body}>
          {/* Assistant */}
          <div className={styles.sectionHeader}>Assistant</div>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="chatbot-ui"
              checked={chatbotUIMode === 'tabs'}
              onChange={() => setChatbotUIMode('tabs')}
            />
            Tabs
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="chatbot-ui"
              checked={chatbotUIMode === 'queue'}
              onChange={() => setChatbotUIMode('queue')}
            />
            Queue
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="chatbot-ui"
              checked={chatbotUIMode === 'sidenav'}
              onChange={() => setChatbotUIMode('sidenav')}
            />
            Sidenav
          </label>

          {/* Task drawer */}
          <div className={styles.sectionHeader}>Task drawer</div>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="task-drawer-mode"
              checked={taskDrawerMode === 'menu'}
              onChange={() => setTaskDrawerMode('menu')}
            />
            Menu
          </label>
          {taskDrawerMode === 'menu' && (
            <div className={styles.subOptions}>
              <label className={styles.radioRow}>
                <input
                  type="radio"
                  name="task-drawer-menu-side"
                  checked={taskDrawerMenuSide === 'left'}
                  onChange={() => setTaskDrawerMenuSide('left')}
                />
                Left
              </label>
              <label className={styles.radioRow}>
                <input
                  type="radio"
                  name="task-drawer-menu-side"
                  checked={taskDrawerMenuSide === 'center'}
                  onChange={() => setTaskDrawerMenuSide('center')}
                />
                Center
              </label>
              <label className={styles.radioRow}>
                <input
                  type="radio"
                  name="task-drawer-menu-side"
                  checked={taskDrawerMenuSide === 'right'}
                  onChange={() => setTaskDrawerMenuSide('right')}
                />
                Right
              </label>
            </div>
          )}

          {/* Nebula */}
          <div className={styles.sectionHeader}>Nebula</div>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="nebula-mode"
              checked={nebulaMode === 'on'}
              onChange={() => setNebulaMode('on')}
            />
            On
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="nebula-mode"
              checked={nebulaMode === 'off'}
              onChange={() => setNebulaMode('off')}
            />
            Off
          </label>

          {/* Assistant panel */}
          <div className={styles.sectionHeader}>Assistant panel</div>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="assistant-panel-mode"
              checked={assistantPanelMode === 'menu'}
              onChange={() => setAssistantPanelMode('menu')}
            />
            Menu
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="assistant-panel-mode"
              checked={assistantPanelMode === 'right'}
              onChange={() => setAssistantPanelMode('right')}
            />
            Right
          </label>
        </div>
      </div>
    </>
  )
}
