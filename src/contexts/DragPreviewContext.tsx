import { createContext, useContext } from 'react'

export interface DragPreviewState {
  draggingId: string | null
  overPoolId: string | null
  overIndex: number
}

export const DragPreviewContext = createContext<DragPreviewState>({
  draggingId: null,
  overPoolId: null,
  overIndex: -1,
})

export const useDragPreview = () => useContext(DragPreviewContext)
