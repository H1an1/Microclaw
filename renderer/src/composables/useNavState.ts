import { ref } from 'vue'

export type NavTab = 'chat' | 'tasks' | 'phone' | 'explore'

const activeTab = ref<NavTab>('chat')

export function useNavState() {
  function setTab(tab: NavTab) {
    activeTab.value = tab
  }
  return { activeTab, setTab }
}
