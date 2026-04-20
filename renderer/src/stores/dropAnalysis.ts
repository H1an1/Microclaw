import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface DropTarget {
  path: string
  name: string
  isDirectory: boolean
}

export const useDropAnalysisStore = defineStore('dropAnalysis', () => {
  const targets = ref<DropTarget[]>([])
  const active = ref(false)

  function receive(incoming: DropTarget[]) {
    targets.value = incoming
    active.value = true
  }

  function dismiss() {
    active.value = false
    targets.value = []
  }

  return { targets, active, receive, dismiss }
})
