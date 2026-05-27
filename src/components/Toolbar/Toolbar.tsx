import {
  Play,
  Square,
  X,
  Settings,
  Loader2,
  Check,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Menu,
  Pause,
} from 'lucide-react'
import { ExpandDownIcon } from '../shared/ExpandIcons'
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useDockingStore } from '../../store/dockingStore'
import { useBackgroundTaskStore } from '../../store/backgroundTaskStore'
import { usePlanStore } from '../../store/planStore'
import { useConversationStore } from '../../store/conversationStore'
import { MenuDropdown, MenuItem } from '../shared/MenuDropdown'
import { isAIIntent } from '../../ai/detect-ai-intent'
import { stripLeadingBrackets, truncateTitle } from '../../ai/strip-brackets'
import type { Asset } from '../../types'
import { publicUrl } from '../../utils/assetUrl'
import styles from './Toolbar.module.css'
import aiAssistantIcon from '../../../icons/nebula.svg'
import keyCommandIcon from '../../../icons/key-command.svg'
import boilerplateIcon from '../../../icons/boiler plate.png'
import partBlockIcon from '../../../images/Part_Block.png'

export function Toolbar() {
  const [showTestDropdown, setShowTestDropdown] = useState(false)
  const [menuPressed, setMenuPressed] = useState(false)
  const [menuIconFailed, setMenuIconFailed] = useState(false)
  const [showMenuDropdown, setShowMenuDropdown] = useState(false)
  const [selectedTestMode, setSelectedTestMode] = useState('Test')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [aiResponseText, setAiResponseText] = useState<string | null>(null)
  const [aiSubmitted, setAiSubmitted] = useState(false)
  const [showTasksMenu, setShowTasksMenu] = useState(false)
  const [showHotkeyList, setShowHotkeyList] = useState(false)
  const [approvalSectionExpanded, setApprovalSectionExpanded] = useState(true)
  const omnisearchMode = useDockingStore((s) => s.omnisearchMode)
  const settingsPanelOpen = useDockingStore((s) => s.settingsPanelOpen)
  const toggleSettingsPanel = useDockingStore((s) => s.toggleSettingsPanel)
  const chatbotUIMode = useDockingStore((s) => s.chatbotUIMode)
  const viewportAIInputOpen = useDockingStore((s) => s.viewportAIInputOpen)
  const widgets = useDockingStore((s) => s.widgets)
  const aiAssistantBodyCollapsed = useDockingStore((s) => s.aiAssistantBodyCollapsed)
  const aiDismissTimer = useRef<ReturnType<typeof setTimeout>>()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const tasksMenuRef = useRef<HTMLDivElement>(null)
  const tasksMenuDropdownRef = useRef<HTMLDivElement>(null)
  const hotkeyRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const backgroundTasks = useBackgroundTaskStore((s) => s.tasks)
  const backgroundTaskCount = backgroundTasks.length
  const activePlan = usePlanStore((s) => s.activePlan)
  const hasPlanPendingApproval = activePlan?.status === 'pending' || activePlan?.status === 'clarifying'
  const activeConversationId = useConversationStore((s) => s.activeConversationId)
  const conversations = useConversationStore((s) => s.conversations)
  const activeConversation = activeConversationId ? conversations[activeConversationId] : null
  const inProgressCount = useMemo(
    () => backgroundTasks.filter((t) => t.status === 'running').length,
    [backgroundTasks]
  )
  /** When queue mode is enabled: show drawer icon persistently in toolbar */
  const drawerIconPersistent = chatbotUIMode === 'queue' || chatbotUIMode === 'sidenav'

  // Keep tasks menu dropdown within viewport
  const [tasksMenuPosition, setTasksMenuPosition] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    if (!showTasksMenu || !tasksMenuRef.current || !tasksMenuDropdownRef.current) {
      setTasksMenuPosition(null)
      return
    }
    const triggerRect = tasksMenuRef.current.getBoundingClientRect()
    const dropdownEl = tasksMenuDropdownRef.current
    const width = dropdownEl.offsetWidth || 240
    const margin = 8
    const top = triggerRect.bottom + 4
    let left = triggerRect.left
    if (left < margin) left = margin
    if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin
    setTasksMenuPosition({ left, top })
  }, [showTasksMenu, backgroundTasks.length])

  // Test dropdown menu items
  const testMenuItems: MenuItem[] = [
    { label: 'Test', onClick: () => setSelectedTestMode('Test') },
    { label: 'Test Here', onClick: () => setSelectedTestMode('Test Here') },
    { label: 'Run', onClick: () => setSelectedTestMode('Run') },
    { label: 'Server & Clients', onClick: () => setSelectedTestMode('Server & Clients') },
  ]
  const menuItems: MenuItem[] = [
    { 
      label: 'File',
      submenu: [
        { label: 'New', shortcut: '⌘ N', onClick: () => console.log('New') },
        { label: 'Open from File', onClick: () => console.log('Open from File') },
        { label: 'Open from Roblox', shortcut: '⌘ O', onClick: () => console.log('Open from Roblox') },
        { label: 'Recent', onClick: () => console.log('Recent') },
        { divider: true },
        { label: 'Close Place', shortcut: '⌘ F4', onClick: () => console.log('Close Place') },
        { divider: true },
        { label: 'Import 3D', shortcut: '⌘ M', onClick: () => console.log('Import 3D') },
        { label: 'Import Roblox Model', onClick: () => console.log('Import Roblox Model') },
        { label: 'Export as .obj', onClick: () => console.log('Export as .obj') },
        { divider: true },
        { label: 'Save to File', onClick: () => console.log('Save to File') },
        { label: 'Save to File As', shortcut: '⌘ S', onClick: () => console.log('Save to File As') },
        { label: 'Save to Roblox', onClick: () => console.log('Save to Roblox') },
        { label: 'Save to Roblox As', onClick: () => console.log('Save to Roblox As') },
        { divider: true },
        { label: 'Publish to Roblox', shortcut: '⌃ P', onClick: () => console.log('Publish to Roblox') },
        { label: 'Publish to Roblox As', onClick: () => console.log('Publish to Roblox As') },
        { divider: true },
        { label: 'Game Settings', onClick: () => console.log('Game Settings') },
        { label: 'Avatar Settings', onClick: () => console.log('Avatar Settings') },
        { label: 'Open Configs', onClick: () => console.log('Open Configs') },
        { divider: true },
        { label: 'Beta Features', onClick: () => console.log('Beta Features') },
        { label: 'Open Flag Editor', onClick: () => console.log('Open Flag Editor') },
        { label: 'Customize Shortcuts', onClick: () => console.log('Customize Shortcuts') },
        { divider: true },
        { label: 'Open Auto Saves', onClick: () => console.log('Open Auto Saves') },
      ]
    },
    { 
      label: 'Edit',
      submenu: [
        { label: 'Undo', shortcut: '⌘ Z', onClick: () => console.log('Undo') },
        { label: 'Redo', shortcut: '⇧ ⌘ Z', onClick: () => console.log('Redo') },
        { divider: true },
        { label: 'Cut', shortcut: '⌘ X', onClick: () => console.log('Cut') },
        { label: 'Copy', shortcut: '⌘ C', onClick: () => console.log('Copy') },
        { label: 'Copy As', onClick: () => console.log('Copy As') },
        { label: 'Paste', shortcut: '⌘ V', onClick: () => console.log('Paste') },
        { label: 'Paste Over Selection', shortcut: '⌥ ⌘ V', onClick: () => console.log('Paste Over Selection') },
        { label: 'Paste to Replace', shortcut: '⌥ ⌘ R', onClick: () => console.log('Paste to Replace') },
        { label: 'Duplicate', shortcut: '⌘ D', onClick: () => console.log('Duplicate') },
        { label: 'Delete', shortcut: '⌦', onClick: () => console.log('Delete') },
        { divider: true },
        { label: 'Find', shortcut: '⌘ F', onClick: () => console.log('Find') },
        { label: 'Find Next', shortcut: '⌥ ⌘ F', onClick: () => console.log('Find Next') },
        { label: 'Find Previous', shortcut: '⌥ ⌘ D', onClick: () => console.log('Find Previous') },
        { label: 'Find and Replace...', onClick: () => console.log('Find and Replace') },
        { divider: true },
        { label: 'Set Default Properties', onClick: () => console.log('Set Default Properties') },
        { label: 'Copy Properties', shortcut: '⌃ ⌘ C', onClick: () => console.log('Copy Properties') },
        { label: 'Paste Properties', shortcut: '⌃ ⌘ V', onClick: () => console.log('Paste Properties') },
        { divider: true },
        { label: 'Pick Color', shortcut: '⌃ C', onClick: () => console.log('Pick Color') },
        { divider: true },
        { label: 'Select All', shortcut: '⌘ A', onClick: () => console.log('Select All') },
        { label: 'Select Matching Layers', shortcut: '⌃ ⌘ A', onClick: () => console.log('Select Matching Layers') },
        { label: 'Select None', onClick: () => console.log('Select None') },
        { label: 'Select Inverse', shortcut: '⌥ ⌘ A', onClick: () => console.log('Select Inverse') },
        { label: 'Select All With', submenu: [] },
        { divider: true },
        { label: 'AutoFill', submenu: [] },
        { label: 'Start Dictation...', onClick: () => console.log('Start Dictation') },
        { label: 'Emoji & Symbols', onClick: () => console.log('Emoji & Symbols') },
      ]
    },
    { 
      label: 'Object', 
      submenu: [
        { label: 'Insert Object', onClick: () => console.log('Insert Object') },
      ]
    },
    { 
      label: 'View',
      submenu: [
        { label: 'Zoom In', shortcut: '⌘ =', onClick: () => console.log('Zoom In') },
        { label: 'Zoom Out', shortcut: '⌘ -', onClick: () => console.log('Zoom Out') },
        { divider: true },
        { label: 'Show View Selector', onClick: () => console.log('Show View Selector') },
        { label: 'Show Wind Direction', onClick: () => console.log('Show Wind Direction') },
        { label: 'Show Grid', submenu: [] },
        { label: 'Show Grid Material', onClick: () => console.log('Show Grid Material') },
        { label: 'Show Wireframe Rendering', onClick: () => console.log('Show Wireframe Rendering') },
        { label: 'Show UI', onClick: () => console.log('Show UI') },
        { divider: true },
        { label: 'Show Welds', shortcut: '⌃ W', onClick: () => console.log('Show Welds') },
        { label: 'Show Constraint Details', shortcut: '⌃ D', onClick: () => console.log('Show Constraint Details') },
        { divider: true },
        { label: 'Expand Script Folds', shortcut: '⌘ E', onClick: () => console.log('Expand Script Folds') },
        { label: 'Collapse Script Folds', shortcut: '⌥ ⌘ E', onClick: () => console.log('Collapse Script Folds') },
        { label: 'Toggle Comment', shortcut: '⌘ /', onClick: () => console.log('Toggle Comment') },
        { divider: true },
        { label: 'Screenshot', shortcut: '⇧', onClick: () => console.log('Screenshot') },
        { divider: true },
        { label: 'Mute', onClick: () => console.log('Mute') },
      ]
    },
    { 
      label: 'Plugins',
      submenu: [
        { label: 'Manage Plugins', onClick: () => console.log('Manage Plugins') },
        { label: 'Plugins Folder', onClick: () => console.log('Plugins Folder') },
        { divider: true },
        { label: 'Save as Local Plugin', onClick: () => console.log('Save as Local Plugin') },
        { label: 'Publish as Plugin', onClick: () => console.log('Publish as Plugin') },
        { divider: true },
        { label: 'Ro-Defender Plugin', submenu: [] },
        { label: 'Building Tools by F3X', submenu: [] },
        { label: 'AutoScale Lite', submenu: [] },
        { label: "EgoMoose's plugins", submenu: [] },
        { label: 'GeomTools', submenu: [] },
        { label: 'Rigging', submenu: [] },
        { label: 'Atmos', submenu: [] },
        { label: "AlreadyPro's Plugins", submenu: [] },
        { label: 'Factor Plugins', submenu: [] },
        { label: 'Moon Animator', submenu: [] },
        { label: 'Rojo 7.2.1', submenu: [] },
      ]
    },
    { 
      label: 'Window',
      submenu: [
        { label: 'Toolbox', onClick: () => console.log('Toolbox') },
        { label: 'Properties', onClick: () => console.log('Properties') },
        { label: 'Explorer', shortcut: '⌃ X', onClick: () => { dockWidget('explorer', 'left'); useDockingStore.getState().setLeftCollapsed(false) } },
        { label: 'Output', onClick: () => console.log('Output') },
        { label: 'Activity History', onClick: () => console.log('Activity History') },
        { label: 'Asset Manager', onClick: () => console.log('Asset Manager') },
        { label: 'Insert Object', onClick: () => console.log('Insert Object') },
        { divider: true },
        { label: '3D', submenu: [] },
        { label: 'Avatar', submenu: [] },
        { label: 'Collaboration', submenu: [] },
        { label: 'Debug', submenu: [] },
        { label: 'Localization', submenu: [] },
        { label: 'Performance Summary', submenu: [] },
        { label: 'Script', submenu: [] },
        { label: 'Reset Layout', onClick: () => console.log('Reset Layout') },
      ]
    },
    { 
      label: 'Help', 
      submenu: [
        { label: 'Documentation', onClick: () => console.log('Documentation') },
        { label: 'Community', onClick: () => console.log('Community') },
        { label: 'About', onClick: () => console.log('About') },
      ]
    },
  ]
  const {
    play,
    pause,
    stop,
    isPlaying,
    assets,
    aiGenerating,
  } = useEditorStore()

  const { dockWidget, undockWidget } = useDockingStore()
  const setAiAssistantBodyCollapsed = useDockingStore((s) => s.setAiAssistantBodyCollapsed)
  const aiPanelVisible = !!widgets['ai-assistant'] && !aiAssistantBodyCollapsed
  const dismissTask = useBackgroundTaskStore((s) => s.dismissTask)
  const promoteToConversation = useBackgroundTaskStore((s) => s.promoteToConversation)

  const toggleAIPanel = () => {
    if (aiPanelVisible) {
      undockWidget('ai-assistant')
    } else {
      dockWidget('ai-assistant', 'right-top')
      if (backgroundTaskCount > 0) {
        setAiAssistantBodyCollapsed(false)
      }
    }
  }

  // Background task runner now lives in App.tsx so the AI panel doesn't need
  // to be auto-docked for tasks to process.

  const aiMode = isAIIntent(searchQuery)
  const aiIsLoading = backgroundTasks.some((t) => t.status === 'running')
  const aiPendingToolCount = 0
  const enqueueTask = useBackgroundTaskStore((s) => s.enqueueTask)

  // Cleanup AI dismiss timer
  useEffect(() => {
    return () => clearTimeout(aiDismissTimer.current)
  }, [])

  // Handle AI search submit — route through keyword engine via background task store
  const handleAISubmit = useCallback(() => {
    if (!searchQuery.trim() || aiIsLoading) return
    enqueueTask(searchQuery)
    setAiSubmitted(true)
    setAiResponseText('Processing...')
    setShowSearchResults(true)

    // Auto-dismiss after brief delay since keyword engine is synchronous
    clearTimeout(aiDismissTimer.current)
    aiDismissTimer.current = setTimeout(() => {
      setAiResponseText(null)
      setAiSubmitted(false)
      setShowSearchResults(false)
      setSearchQuery('')
    }, 2000)
  }, [searchQuery, aiIsLoading, enqueueTask])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTestDropdown(false)
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenuDropdown(false)
        setMenuPressed(false)
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
      if (tasksMenuRef.current && !tasksMenuRef.current.contains(event.target as Node)) {
        setShowTasksMenu(false)
      }
      if (hotkeyRef.current && !hotkeyRef.current.contains(event.target as Node)) {
        setShowHotkeyList(false)
      }
    }

    if (showTestDropdown || showMenuDropdown || showSearchResults || showTasksMenu || showHotkeyList) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTestDropdown, showMenuDropdown, showSearchResults, showTasksMenu, showHotkeyList])

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setAiResponseText(null)
    setAiSubmitted(false)
    clearTimeout(aiDismissTimer.current)
    setShowSearchResults(value.length > 0)
  }

  // Handle search keydown (Enter for AI submit, Escape to close)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && aiMode) {
      e.preventDefault()
      handleAISubmit()
    }
    if (e.key === 'Escape') {
      setSearchQuery('')
      setShowSearchResults(false)
      setAiResponseText(null)
      setAiSubmitted(false)
      clearTimeout(aiDismissTimer.current)
      searchInputRef.current?.blur()
    }
  }

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('')
    setShowSearchResults(false)
    setAiResponseText(null)
    setAiSubmitted(false)
    clearTimeout(aiDismissTimer.current)
  }

  // Flatten all assets (including folders and nested children) for global search
  const flattenedAssets = useMemo(() => {
    const all: { type: string; name: string; path: string }[] = []

    const walk = (list: Asset[], parentPath = '') => {
      list.forEach((asset) => {
        const displayPath = asset.path || (parentPath ? `${parentPath}/${asset.name}` : asset.name)
        all.push({
          type:
            asset.type === 'folder'
              ? 'Folder'
              : asset.type.charAt(0).toUpperCase() + asset.type.slice(1),
          name: asset.name,
          path: displayPath,
        })

        if (asset.children?.length) {
          walk(asset.children, displayPath)
        }
      })
    }

    walk(assets)
    return all
  }, [assets])

  const searchResults =
    searchQuery.length > 0
      ? flattenedAssets.filter((item) => {
          const q = searchQuery.toLowerCase()
          return (
            item.name.toLowerCase().includes(q) ||
            item.type.toLowerCase().includes(q) ||
            item.path.toLowerCase().includes(q)
          )
        })
      : []

  return (
    <header className={styles.toolbar}>
      <div className={styles.trafficLights}>
        <button className={`${styles.trafficLight} ${styles.red}`} aria-label="Close" />
        <button className={`${styles.trafficLight} ${styles.yellow}`} aria-label="Minimize" />
        <button className={`${styles.trafficLight} ${styles.green}`} aria-label="Maximize" />
      </div>

      <div className={styles.leftSection}>
        <div 
          className={`${styles.actionIconContainer} ${menuPressed ? styles.pressed : ''}`}
          onClick={() => {
            setMenuPressed(!menuPressed)
            setShowMenuDropdown(!showMenuDropdown)
          }}
          ref={menuRef}
        >
          {menuIconFailed ? (
            <Menu size={24} className={styles.actionIcon} aria-hidden />
          ) : (
            <img
              src={publicUrl('roblox_dropdown.png')}
              alt="Menu"
              className={styles.actionIcon}
              onError={() => setMenuIconFailed(true)}
            />
          )}
          <MenuDropdown
            items={menuItems}
            isOpen={showMenuDropdown}
            onClose={() => {
              setShowMenuDropdown(false)
              setMenuPressed(false)
            }}
          />
        </div>
        
        <div className={styles.divider} />

        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <img src={boilerplateIcon} alt="Studio Shell" />
          </div>
          <span className={styles.logoText}>boilerplate</span>
        </div>

        <div className={styles.divider} />

        <div className={styles.testingModeControls} ref={dropdownRef}>
          <button 
            className={styles.testDropdownButton}
            onClick={() => setShowTestDropdown(!showTestDropdown)}
          >
            <span>{selectedTestMode}</span>
            <ExpandDownIcon />
          </button>
          <MenuDropdown
            items={testMenuItems}
            isOpen={showTestDropdown}
            onClose={() => setShowTestDropdown(false)}
          />
          <button
            className={isPlaying ? styles.testStopButton : styles.testPlayButton}
            onClick={isPlaying ? stop : play}
            title={isPlaying ? 'Stop — Exit game mode' : 'Play — Enter game mode'}
          >
            {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
          <button className={styles.testPauseButton} onClick={pause} title="Pause Test">
            <Pause size={16} fill="currentColor" aria-hidden />
          </button>
          <button
            className={styles.testStopButton}
            onClick={stop}
            title="Stop — Exit game mode"
            disabled={!isPlaying}
          >
            <Square size={16} fill="currentColor" />
          </button>
        </div>
      </div>

      <div className={styles.searchWrapper} ref={searchRef}>
        <div className={styles.searchContainer}>
          {searchQuery.trim() && !aiMode && (
            <span className={styles.aiIndicator}>AI</span>
          )}
          <input
            ref={searchInputRef}
            type="text"
            placeholder={omnisearchMode === 'primary-assistant' ? 'What do you want to build?' : 'Search or ask'}
            className={styles.searchInput}
            aria-label={omnisearchMode === 'primary-assistant' ? 'What do you want to build?' : 'Search or ask'}
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => searchQuery.length > 0 && setShowSearchResults(true)}
          />
          {searchQuery && (
            <button
              className={styles.clearButton}
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {showSearchResults && (
          <div className={styles.searchResultsMenu}>
            {omnisearchMode === 'primary-search' ? (
              <>
                {(aiMode || aiSubmitted) && (
                  <div className={styles.aiResponse}>
                    {aiIsLoading && (
                      <div className={styles.aiResponseStatus}>
                        <span className={styles.aiStatusDot} />
                        <span>
                          {aiPendingToolCount > 0
                            ? `Executing ${aiPendingToolCount} tool${aiPendingToolCount > 1 ? 's' : ''}...`
                            : 'Thinking...'}
                        </span>
                      </div>
                    )}
                    {aiResponseText && (
                      <div className={styles.aiResponseText}>{aiResponseText}</div>
                    )}
                    {!aiIsLoading && !aiResponseText && !aiSubmitted && (
                      <div className={styles.aiResponseHint}>Press Enter to ask AI</div>
                    )}
                    <button
                      className={styles.continueLink}
                      onClick={() => {
                        dockWidget('ai-assistant', 'right-top')
                        setShowSearchResults(false)
                      }}
                    >
                      Continue in Assistant →
                    </button>
                  </div>
                )}
                {searchResults.length > 0 ? (
                  searchResults.map((result, index) => (
                    <button
                      key={index}
                      className={styles.searchResultItem}
                      onClick={() => {
                        console.log('Selected:', result)
                        setShowSearchResults(false)
                      }}
                    >
                      <div className={styles.resultType}>{result.type}</div>
                      <div className={styles.resultInfo}>
                        <div className={styles.resultName}>{result.name}</div>
                        <div className={styles.resultPath}>{result.path}</div>
                      </div>
                    </button>
                  ))
                ) : !(aiMode || aiSubmitted) ? (
                  <div className={styles.noResults}>
                    No results found for &quot;{searchQuery}&quot;
                  </div>
                ) : null}
              </>
            ) : aiMode || aiSubmitted ? (
              <div className={styles.aiResponse}>
                {aiIsLoading && (
                  <div className={styles.aiResponseStatus}>
                    <span className={styles.aiStatusDot} />
                    <span>
                      {aiPendingToolCount > 0
                        ? `Executing ${aiPendingToolCount > 1 ? 'tool' : 'tools'}...`
                        : 'Thinking...'}
                    </span>
                  </div>
                )}
                {aiResponseText && (
                  <div className={styles.aiResponseText}>{aiResponseText}</div>
                )}
                {!aiIsLoading && !aiResponseText && !aiSubmitted && (
                  <div className={styles.aiResponseHint}>Press Enter to ask AI</div>
                )}
                <button
                  className={styles.continueLink}
                  onClick={() => {
                    dockWidget('ai-assistant', 'right-top')
                    setShowSearchResults(false)
                  }}
                >
                  Continue in Assistant →
                </button>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((result, index) => (
                <button
                  key={index}
                  className={styles.searchResultItem}
                  onClick={() => {
                    console.log('Selected:', result)
                    setShowSearchResults(false)
                  }}
                >
                  <div className={styles.resultType}>{result.type}</div>
                  <div className={styles.resultInfo}>
                    <div className={styles.resultName}>{result.name}</div>
                    <div className={styles.resultPath}>{result.path}</div>
                  </div>
                </button>
              ))
            ) : (
              <div className={styles.noResults}>
                No results found for &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.group}>
          <div
            ref={tasksMenuRef}
            className={`${styles.toolbarIconPair} ${(aiPanelVisible || viewportAIInputOpen) ? styles.toolbarIconPairPressed : ''} ${drawerIconPersistent ? styles.drawerIconRevealed : ''}`}
          >
            <div
              className={`${styles.toolbarIconPairIcon} ${aiPanelVisible ? styles.activeToolbarIcon : ''} ${aiGenerating ? styles.nebulaPulsing : ''}`}
              onClick={toggleAIPanel}
              onKeyDown={(e) => e.key === 'Enter' && toggleAIPanel()}
              role="button"
              tabIndex={0}
              title="AI Assistant"
              aria-label="Toggle composer"
            >
              <img src={aiAssistantIcon} alt="AI Assistant" width={16} height={16} style={{ width: 16, height: 16, padding: 0 }} />
            </div>
            {showTasksMenu && (
              <div
                ref={tasksMenuDropdownRef}
                className={`${styles.aiSettingsDropdown} ${styles.tasksMenuDropdown}`}
                style={tasksMenuPosition ? { position: 'fixed', left: tasksMenuPosition.left, top: tasksMenuPosition.top, right: 'auto' } : undefined}
              >
                <div className={styles.tasksMenuHeader}>Running tasks</div>
                {hasPlanPendingApproval && (
                  <button
                    type="button"
                    className={styles.tasksMenuApprovalBanner}
                    onClick={() => setApprovalSectionExpanded((v) => !v)}
                    aria-expanded={approvalSectionExpanded}
                    aria-controls="tasks-menu-approval-content"
                  >
                    {approvalSectionExpanded ? (
                      <ChevronDown size={14} className={styles.tasksMenuApprovalBannerChevron} />
                    ) : (
                      <ChevronRight size={14} className={styles.tasksMenuApprovalBannerChevron} />
                    )}
                    Awaiting Approval
                  </button>
                )}
                {backgroundTasks.length === 0 ? (
                  (() => {
                    const activeCount = inProgressCount + (aiGenerating ? 1 : 0)
                    const showSpinnerInMenu = activeCount > 0
                    if (hasPlanPendingApproval && activeConversation && approvalSectionExpanded) {
                      return (
                        <div id="tasks-menu-approval-content" className={styles.tasksMenuOpenChatRow}>
                          <span className={styles.tasksMenuOpenChatTitle} title={activeConversation.summary || activeConversation.title}>
                            {truncateTitle(activeConversation.summary || activeConversation.title)}
                          </span>
                          <button
                            type="button"
                            className={styles.tasksMenuOpenChatAction}
                            onClick={() => {
                              dockWidget('ai-assistant', 'right-top')
                              setAiAssistantBodyCollapsed(false)
                              setShowTasksMenu(false)
                            }}
                          >
                            Respond
                          </button>
                        </div>
                      )
                    }
                    if (showSpinnerInMenu) {
                      return (
                        <div className={styles.tasksMenuEmpty} aria-busy="true">
                          <Loader2 size={14} className={styles.tasksMenuEmptySpinner} />
                          <span>Work in progress</span>
                        </div>
                      )
                    }
                    return <div className={styles.tasksMenuEmpty}>No background tasks</div>
                  })()
                ) : (
                  <ul className={styles.tasksMenuList} role="list">
                    {backgroundTasks.map((task) => (
                      <li key={task.id} className={styles.tasksMenuItem}>
                        <div className={styles.tasksMenuLabelWrap}>
                          <span className={styles.tasksMenuLabel} title={stripLeadingBrackets(task.command)}>
                            {truncateTitle(stripLeadingBrackets(task.summary ?? task.command))}
                          </span>
                          <span
                            className={`${styles.tasksMenuStatus} ${task.status === 'error' ? styles.tasksMenuStatusError : ''} ${task.status === 'done' ? styles.tasksMenuStatusDone : ''}`}
                            title={task.status === 'error' && task.error ? task.error : undefined}
                          >
                            {task.status === 'running' && <Loader2 size={12} className={styles.tasksMenuStatusIcon} />}
                            {task.status === 'pending' && <Clock size={12} className={styles.tasksMenuStatusIcon} />}
                            {task.status === 'done' && <Check size={12} className={styles.tasksMenuStatusIcon} />}
                            {task.status === 'error' && <AlertCircle size={12} className={styles.tasksMenuStatusIcon} />}
                            <span>{task.status}</span>
                          </span>
                          {task.status === 'error' && task.error && (
                            <span className={styles.tasksMenuError} title={task.error}>
                              {task.error}
                            </span>
                          )}
                        </div>
                        <div className={styles.tasksMenuActions}>
                          {(task.status === 'done' || task.status === 'error') && task.messageIds && task.messageIds.length > 0 && (
                            <button
                              type="button"
                              className={styles.tasksMenuActionBtn}
                              onClick={() => {
                                promoteToConversation(task.id)
                                setShowTasksMenu(false)
                                dockWidget('ai-assistant', 'right-top')
                              }}
                            >
                              Open in Assistant
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.tasksMenuActionBtn}
                            onClick={() => {
                              dismissTask(task.id)
                              if (backgroundTasks.length <= 1) setShowTasksMenu(false)
                            }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div
            ref={hotkeyRef}
            className={`${styles.aiSettingsWrap} ${showHotkeyList ? styles.pressed : ''}`}
          >
            <button
              type="button"
              onClick={() => setShowHotkeyList((v) => !v)}
              title="Keyboard Shortcuts"
              className={showHotkeyList ? styles.aiSettingsButtonPressed : undefined}
            >
              <img src={keyCommandIcon} alt="Keyboard Shortcuts" width={18} height={18} style={{ width: 18, height: 18, padding: 0 }} />
            </button>
            {showHotkeyList && (
              <div className={`${styles.aiSettingsDropdown} ${styles.hotkeyDropdown}`}>
                <div className={styles.hotkeyHeader}>Keyboard Shortcuts</div>
                <div className={styles.hotkeySection}>
                  <div className={styles.hotkeySectionLabel}>General</div>
                  <div className={styles.hotkeyRow}><span className={styles.hotkeyLabel}>Toggle composer</span><kbd className={styles.hotkeyKbd}>⌘ K</kbd></div>
                  <div className={styles.hotkeyRow}><span className={styles.hotkeyLabel}>Viewport AI Input</span><kbd className={styles.hotkeyKbd}>⌘ /</kbd></div>
                  <div className={styles.hotkeyRow}><span className={styles.hotkeyLabel}>New Conversation</span><kbd className={styles.hotkeyKbd}>⌘ N</kbd></div>
                  <div className={styles.hotkeyRow}><span className={styles.hotkeyLabel}>Close / Dismiss</span><kbd className={styles.hotkeyKbd}>Esc</kbd></div>
                </div>
                <div className={styles.hotkeySection}>
                  <div className={styles.hotkeySectionLabel}>Viewport Tools</div>
                  <div className={styles.hotkeyRow}><span className={styles.hotkeyLabel}>Select</span><kbd className={styles.hotkeyKbd}>S</kbd></div>
                  <div className={styles.hotkeyRow}><span className={styles.hotkeyLabel}>Move</span><kbd className={styles.hotkeyKbd}>W</kbd></div>
                  <div className={styles.hotkeyRow}><span className={styles.hotkeyLabel}>Rotate</span><kbd className={styles.hotkeyKbd}>E</kbd></div>
                  <div className={styles.hotkeyRow}><span className={styles.hotkeyLabel}>Scale</span><kbd className={styles.hotkeyKbd}>R</kbd></div>
                  <div className={styles.hotkeyRow}><span className={styles.hotkeyLabel}>Transform</span><kbd className={styles.hotkeyKbd}>T</kbd></div>
                  <div className={styles.hotkeyRow}><span className={styles.hotkeyLabel}>Pen Tool</span><kbd className={styles.hotkeyKbd}>P</kbd></div>
                </div>
              </div>
            )}
          </div>
          <div
              className={`${styles.aiSettingsWrap} ${settingsPanelOpen ? styles.pressed : ''}`}
            >
            <button
              type="button"
              onClick={toggleSettingsPanel}
              title="Settings"
              className={settingsPanelOpen ? styles.aiSettingsButtonPressed : undefined}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
        <button className={styles.testDropdownButton}>
          <img src={partBlockIcon} alt="Part Block" width={18} height={18} />
          <span>Build</span>
          <ExpandDownIcon />
        </button>
      </div>
    </header>
  )
}

