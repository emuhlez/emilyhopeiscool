import type { MentionItem } from '../shared/MentionDropdown'

/** Static tool list for @ mention suggestions */
export const MENTION_TOOLS: MentionItem[] = [
  { id: 'tool-addObject', label: 'addObject', kind: 'tool', category: 'tool' },
  { id: 'tool-removeObject', label: 'removeObject', kind: 'tool', category: 'tool' },
  { id: 'tool-transformObject', label: 'transformObject', kind: 'tool', category: 'tool' },
  { id: 'tool-setMaterial', label: 'setMaterial', kind: 'tool', category: 'tool' },
  { id: 'tool-createTerrain', label: 'createTerrain', kind: 'tool', category: 'tool' },
  { id: 'tool-createPlan', label: 'createPlan', kind: 'tool', category: 'tool' },
  { id: 'tool-createScript', label: 'createScript', kind: 'tool', category: 'tool' },
]

