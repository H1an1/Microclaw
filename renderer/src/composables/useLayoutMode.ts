import { computed, ref } from 'vue'

export type LayoutMode = 'multiple-agent' | 'mvp'

const STORAGE_KEY = 'openclaw-layout-mode'

function readInitialMode(): LayoutMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'multiple-agent' ? 'multiple-agent' : 'mvp'
  } catch {
    return 'mvp'
  }
}

const currentMode = ref<LayoutMode>(readInitialMode())

export function useLayoutMode() {
  function setMode(mode: LayoutMode) {
    currentMode.value = mode
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // ignore persistence failures
    }
  }

  return {
    layoutMode: computed(() => currentMode.value),
    isMvpMode: computed(() => currentMode.value === 'mvp'),
    setMode,
  }
}