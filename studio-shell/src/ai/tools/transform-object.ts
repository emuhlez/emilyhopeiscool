import { useEditorStore } from '../../store/editorStore'
import type { Transform } from '../../types'

export interface TransformObjectArgs {
  id: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
}

export function executeTransformObject(args: TransformObjectArgs): { updated: boolean; id: string } {
  const store = useEditorStore.getState()
  const obj = store.gameObjects[args.id]

  if (!obj) {
    store.log(`AI: Object not found (id: ${args.id})`, 'warning', 'AI Agent')
    return { updated: false, id: args.id }
  }

  const transform: Transform = { ...obj.transform }

  if (args.position) {
    transform.position = { x: args.position[0], y: args.position[1], z: args.position[2] }
  }
  if (args.rotation) {
    transform.rotation = { x: args.rotation[0], y: args.rotation[1], z: args.rotation[2] }
  }
  if (args.scale) {
    transform.scale = { x: args.scale[0], y: args.scale[1], z: args.scale[2] }
  }

  // Single batched update + select
  store.updateAndSelectObject(args.id, { transform })

  const changes: string[] = []
  if (args.position) changes.push('position')
  if (args.rotation) changes.push('rotation')
  if (args.scale) changes.push('scale')
  store.log(`AI: Transformed "${obj.name}" (${changes.join(', ')})`, 'info', 'AI Agent')

  // Brief orange working highlight (Gap 3)
  useEditorStore.getState().addAIWorkingObject(args.id)
  setTimeout(() => useEditorStore.getState().removeAIWorkingObject(args.id), 2000)

  return { updated: true, id: args.id }
}
