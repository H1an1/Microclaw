<template>
  <nav class="primary-nav" :class="{ 'primary-nav--hidden': isMvpMode }">
    <!-- Drag region -->
    <div class="pnav-drag"></div>

<!-- Nav items -->
    <div v-if="!isMvpMode" class="pnav-items">
      <div
        v-for="item in items"
        :key="item.id"
        class="pnav-item"
        :class="{ active: activeTab === item.id }"
        @click="handleClick(item.id)"
        :title="item.label"
      >
        <div class="pnav-item-icon">
          <component :is="activeTab === item.id ? item.iconFilled : item.icon" />
        </div>
        <span class="pnav-item-label">{{ item.label }}</span>
      </div>
    </div>

    <!-- Spacer pushes avatar to bottom -->
    <div v-if="!isMvpMode" class="pnav-spacer"></div>

    <!-- User avatar -->
    <div v-if="!isMvpMode" class="pnav-user">
      <LayoutModeSwitcher />
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, h, watch, type FunctionalComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LayoutModeSwitcher from '@/components/LayoutModeSwitcher.vue'
import { useLayoutMode } from '@/composables/useLayoutMode'
import { useNavState, type NavTab } from '@/composables/useNavState'

const { activeTab, setTab } = useNavState()
const { isMvpMode } = useLayoutMode()
const router = useRouter()
const route = useRoute()

const routeToTab = computed<NavTab>(() => {
  if (route.path.startsWith('/tasks')) return 'tasks'
  if (route.path.startsWith('/phone')) return 'phone'
  if (route.path.startsWith('/explore') || route.path.startsWith('/plugins')) return 'explore'
  return 'chat'
})

watch(routeToTab, (tab) => {
  setTab(tab)
}, { immediate: true })

function handleClick(tab: NavTab) {
  const routeMap: Record<NavTab, string> = {
    chat: '/chat',
    tasks: '/tasks',
    phone: '/phone',
    explore: '/explore',
  }
  router.push(routeMap[tab])
}

// ── Regular (stroke) icons ──
const IconChat: FunctionalComponent = () =>
  h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' })
  ])

const IconTasks: FunctionalComponent = () =>
  h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M9 11l3 3L22 4' }),
    h('path', { d: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' })
  ])

const IconPhone: FunctionalComponent = () =>
  h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('rect', { x: '5', y: '2', width: '14', height: '20', rx: '2' }),
    h('line', { x1: '12', y1: '18', x2: '12.01', y2: '18' })
  ])

const IconExplore: FunctionalComponent = () =>
  h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('polygon', { points: '16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76' })
  ])

// ── Filled icons (active state) ──
const IconChatFilled: FunctionalComponent = () =>
  h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'currentColor' }, [
    h('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' })
  ])

const IconTasksFilled: FunctionalComponent = () =>
  h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'currentColor' }, [
    h('path', { d: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z' }),
    h('path', { d: 'M9 11l3 3 5-5.5', fill: 'none', stroke: 'var(--bg-tertiary)', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  ])

const IconPhoneFilled: FunctionalComponent = () =>
  h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'currentColor' }, [
    h('rect', { x: '5', y: '2', width: '14', height: '20', rx: '2' }),
    h('circle', { cx: '12', cy: '18', r: '1', fill: 'var(--bg-tertiary)' })
  ])

const IconExploreFilled: FunctionalComponent = () =>
  h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'currentColor' }, [
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('polygon', { points: '16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76', fill: 'var(--bg-tertiary)' })
  ])

const items = [
  { id: 'chat' as const,    label: '对话', icon: IconChat,    iconFilled: IconChatFilled },
  { id: 'tasks' as const,   label: '任务', icon: IconTasks,   iconFilled: IconTasksFilled },
  { id: 'phone' as const,   label: '手机', icon: IconPhone,   iconFilled: IconPhoneFilled },
  { id: 'explore' as const, label: '探索', icon: IconExplore, iconFilled: IconExploreFilled },
]
</script>

<style scoped>
.primary-nav {
  width: 72px;
  min-width: 72px;
  height: 100vh;
  background: var(--alias-color-background-200, #efeae7);
  border-right: 0.5px solid var(--border-row);
  display: flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
  overflow: hidden;
  flex-shrink: 0;
}

.primary-nav--hidden {
  width: 0;
  min-width: 0;
  border-right: none;
  background: transparent;
}

.pnav-drag {
  height: 8px;
  width: 100%;
  -webkit-app-region: drag;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}


.pnav-items {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
  padding: 4px 6px 0;
}

.pnav-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 9px 4px;
  border-radius: 10px;
  cursor: pointer;
  color: var(--text-muted);
  transition: background 0.15s, color 0.15s;
  -webkit-app-region: no-drag;
}

.pnav-item:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-secondary);
}

html.dark .pnav-item:hover {
  background: rgba(255, 255, 255, 0.07);
}

.pnav-item.active {
  background: transparent;
  color: var(--text-primary);
}

.pnav-item-icon {
  display: grid;
  place-items: center;
  line-height: 0;
}

.pnav-item-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.pnav-spacer {
  flex: 1;
}

.pnav-user {
  padding: 12px 0 21px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}
</style>
