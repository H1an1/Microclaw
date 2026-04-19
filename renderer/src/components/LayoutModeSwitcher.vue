<template>
  <div ref="rootRef" class="layout-switcher" :class="{ 'layout-switcher--sidebar': sidebar }">
    <Teleport to="body">
      <div
        v-if="menuOpen"
        ref="menuRef"
        class="layout-switcher__menu"
        :style="menuStyle"
        @click.stop
      >
        <button
          v-for="option in options"
          :key="option.value"
          class="layout-switcher__item"
          :class="{ selected: layoutMode === option.value }"
          @click="selectMode(option.value)"
        >
          <span class="layout-switcher__item-title">{{ option.label }}</span>
          <span class="layout-switcher__item-desc">{{ option.description }}</span>
        </button>
      </div>
    </Teleport>

    <button
      v-if="sidebar"
      ref="avatarRef"
      class="layout-switcher__sidebar-trigger"
      @click.stop="toggleMenu"
      aria-label="切换导航结构"
    >
      <span class="layout-switcher__sidebar-icon-slot">
        <span class="layout-switcher__sidebar-avatar">
          <span class="layout-switcher__avatar-initial">B</span>
        </span>
      </span>
      <span class="layout-switcher__sidebar-name">Bingnan Jiang</span>
    </button>

    <button
      v-else
      ref="avatarRef"
      class="layout-switcher__avatar"
      @click.stop="toggleMenu"
      aria-label="切换导航结构"
    >
      <span class="layout-switcher__avatar-badge">
        <span class="layout-switcher__avatar-initial">B</span>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useLayoutMode, type LayoutMode } from '@/composables/useLayoutMode'

const props = defineProps<{
  sidebar?: boolean;
}>()

const { layoutMode, setMode } = useLayoutMode()
const rootRef = ref<HTMLElement | null>(null)
const avatarRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuOpen = ref(false)
const menuStyle = ref<Record<string, string>>({})

const MENU_WIDTH = 192
const VIEWPORT_PADDING = 12
const MENU_OFFSET = 10

const options: Array<{ value: LayoutMode; label: string; description: string }> = [
  { value: 'multiple-agent', label: 'Multiple Agent', description: '当前多一级导航方案' },
  { value: 'mvp', label: 'MVP', description: '收敛为阿虾下的二级导航' },
]

function selectMode(mode: LayoutMode) {
  setMode(mode)
  menuOpen.value = false
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function updateMenuPosition() {
  const avatarEl = avatarRef.value
  if (!avatarEl) return

  const rect = avatarEl.getBoundingClientRect()
  const menuHeight = menuRef.value?.offsetHeight ?? 90
  const idealLeft = props.sidebar
    ? rect.left
    : rect.left + rect.width / 2 - MENU_WIDTH / 2
  const maxLeft = window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING
  const left = Math.min(Math.max(idealLeft, VIEWPORT_PADDING), maxLeft)
  const top = Math.max(rect.top - menuHeight - MENU_OFFSET, VIEWPORT_PADDING)

  menuStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${MENU_WIDTH}px`,
  }
}

function handleWindowClick(event: MouseEvent) {
  const target = event.target as Node | null
  if (!target) return

  const clickedTrigger = rootRef.value?.contains(target)
  const clickedMenu = menuRef.value?.contains(target)

  if (!clickedTrigger && !clickedMenu) {
    menuOpen.value = false
  }
}

function handleViewportChange() {
  if (menuOpen.value) {
    updateMenuPosition()
  }
}

watch(menuOpen, async (open) => {
  if (!open) return

  await nextTick()
  updateMenuPosition()
})

onMounted(() => {
  window.addEventListener('click', handleWindowClick)
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
})

onUnmounted(() => {
  window.removeEventListener('click', handleWindowClick)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
})
</script>

<style scoped>
.layout-switcher {
  position: relative;
  display: inline-flex;
  justify-content: center;
}

.layout-switcher--sidebar {
  display: flex;
  width: 100%;
  justify-content: flex-start;
}

.layout-switcher__menu {
  position: fixed;
  padding: 6px;
  border-radius: 16px;
  background: rgba(255, 252, 248, 0.98);
  border: 1px solid rgba(59, 45, 32, 0.08);
  box-shadow: 0 14px 40px rgba(42, 31, 18, 0.18);
  z-index: 300;
}

.layout-switcher__item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-radius: 12px;
  text-align: left;
  cursor: pointer;
  color: var(--text-secondary);
  font-family: inherit;
}

.layout-switcher__item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.layout-switcher__item.selected {
  background: var(--smtc-ctrl-list-background-selected-rest, #00000008);
  color: var(--text-primary);
}

.layout-switcher__item-title {
  font-size: 12px;
  font-weight: 600;
}

.layout-switcher__item-desc {
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-muted);
}

.layout-switcher__avatar {
  width: 30px;
  height: 30px;
  border: none;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.15s;
  background: transparent;
  padding: 0;
}

.layout-switcher__avatar-badge {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.layout-switcher__avatar-badge::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 28%, #80e8d8, #40c8f0, #60a0f8);
}

.layout-switcher__avatar-badge::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: white;
  filter: url(#grain);
  opacity: 0.5;
  mix-blend-mode: multiply;
}

.layout-switcher__avatar:hover {
  opacity: 0.85;
}

.layout-switcher__sidebar-trigger {
  border: none;
  background: transparent;
  padding: 8px 12px 8px 10px;
  width: calc(100% - 8px);
  margin: 1px 4px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  color: var(--text-secondary);
  appearance: none;
  -webkit-appearance: none;
  border-radius: 8px;
  justify-content: flex-start;
}

.layout-switcher__sidebar-trigger:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.layout-switcher__sidebar-trigger:focus,
.layout-switcher__sidebar-trigger:focus-visible {
  outline: none;
  box-shadow: none;
}

.layout-switcher__sidebar-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  overflow: hidden;
  flex-shrink: 0;
}

.layout-switcher__sidebar-icon-slot {
  width: 30px;
  height: 30px;
  position: relative;
  overflow: visible;
  flex-shrink: 0;
}

.layout-switcher__sidebar-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.layout-switcher__sidebar-avatar::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 28%, #80e8d8, #40c8f0, #60a0f8);
}

.layout-switcher__sidebar-avatar::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: white;
  filter: url(#grain);
  opacity: 0.5;
  mix-blend-mode: multiply;
}

.layout-switcher__avatar-initial {
  position: relative;
  z-index: 1;
  font-size: 13px;
  font-weight: 650;
  color: rgba(255, 255, 255, 0.88);
  letter-spacing: -0.01em;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.layout-switcher__sidebar-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}
</style>