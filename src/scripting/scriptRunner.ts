import { useEditorStore } from '../store/editorStore'
import { executeAddObject, type AddObjectArgs } from '../ai/tools/add-object'
import { executeRemoveObject, type RemoveObjectArgs } from '../ai/tools/remove-object'
import { executeTransformObject, type TransformObjectArgs } from '../ai/tools/transform-object'
import { executeSetMaterial, type SetMaterialArgs } from '../ai/tools/set-material'
import { executeCreateTerrain, type CreateTerrainArgs } from '../ai/tools/create-terrain'

function addObject(args: AddObjectArgs) {
  return executeAddObject(args)
}

function removeObject(args: RemoveObjectArgs) {
  return executeRemoveObject(args)
}

function transformObject(args: TransformObjectArgs) {
  return executeTransformObject(args)
}

function setMaterial(args: SetMaterialArgs) {
  return executeSetMaterial(args)
}

function createTerrain(args: CreateTerrainArgs) {
  return executeCreateTerrain(args)
}

function log(message: string) {
  useEditorStore.getState().log(String(message), 'log', 'Script')
}

function getScene() {
  const { gameObjects } = useEditorStore.getState()
  return Object.values(gameObjects).map((obj) => ({
    id: obj.id,
    name: obj.name,
    type: obj.type,
    transform: obj.transform,
    color: obj.color,
  }))
}

export function runScript(code: string): void {
  const store = useEditorStore.getState()
  store.log('Running script...', 'info', 'Script')

  try {
    const fn = new Function(
      'addObject',
      'removeObject',
      'transformObject',
      'setMaterial',
      'createTerrain',
      'log',
      'getScene',
      code,
    )
    fn(addObject, removeObject, transformObject, setMaterial, createTerrain, log, getScene)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    store.log(`Script error: ${message}`, 'error', 'Script')
  }
}
