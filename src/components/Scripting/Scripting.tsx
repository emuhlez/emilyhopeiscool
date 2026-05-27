import { useRef } from 'react'
import { Code2, Play } from 'lucide-react'
import { DockablePanel } from '../shared/DockablePanel'
import { IconButton } from '../shared/IconButton'
import { ViewportAIInput } from '../Viewport/ViewportAIInput'
import { runScript } from '../../scripting/scriptRunner'
import styles from './Scripting.module.css'

const defaultCode = `// Scene scripting — click Run to execute
addObject({ name: "Sphere", primitive: "sphere", position: [0, 3, 0], color: "#ff0000" })
addObject({ name: "Box", primitive: "box", position: [3, 1, 0], color: "#00ff00" })
addObject({ name: "Cylinder", primitive: "cylinder", position: [-3, 1.5, 0], color: "#3388ff" })

log("Objects created!")
`

export function Scripting() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleRun = () => {
    const code = textareaRef.current?.value
    if (code) {
      runScript(code)
    }
  }

  return (
    <DockablePanel
      widgetId="scripting"
      title="Scripting"
      icon={<Code2 size={16} />}
      hideCloseButton
      contentFills
      actions={
        <div className={styles.actions}>
          <IconButton
            icon={<Play size={14} />}
            size="sm"
            tooltip="Run Script"
            onClick={handleRun}
          />
        </div>
      }
    >
      <div className={styles.container}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          defaultValue={defaultCode}
          spellCheck={false}
        />
        <ViewportAIInput />
      </div>
    </DockablePanel>
  )
}
