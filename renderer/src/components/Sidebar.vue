<template>
  <aside class="sidebar">
    <!-- Drag region (keeps title-bar drag on the sidebar column) -->
    <div class="sidebar-drag-region"></div>

    <!-- ══════════════════════════════════════
         MVP PANEL
    ══════════════════════════════════════ -->
    <template v-if="isMvpMode">
      <div class="mvp-panel">
        <div v-if="defaultAgent" class="mvp-agent-row">
          <div
            class="agent-header mvp-agent-header"
            :class="{ selected: isMvpAgentSelected }"
            @click="handleMvpAgentSelect"
          >
            <button class="agent-avatar-button" type="button" @click.stop="openAgentProfile(defaultAgent.id)">
              <div class="agent-avatar" :class="defaultAgent.avatar ? '' : `agent-avatar--${defaultAgent.gradient}`">
                <img v-if="defaultAgent.avatar" :src="defaultAgent.avatar" class="agent-avatar-img" />
                <span v-else class="agent-avatar-initial">{{ defaultAgent.initial ?? defaultAgent.name[0]?.toUpperCase() }}</span>
              </div>
            </button>
            <div class="agent-info">
              <span class="agent-name">{{ defaultAgent.name }}</span>
              <span class="agent-desc">{{ defaultAgent.description }}</span>
            </div>
            <svg
              v-if="mvpTasks.length > 0"
              class="agent-chevron"
              :class="{ expanded: mvpTasksExpanded }"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
              @click.stop="mvpTasksExpanded = !mvpTasksExpanded"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          <!-- Task anchors -->
          <div class="agent-sessions" :class="{ expanded: mvpTasksExpanded && mvpTasks.length > 0 }">
            <div
              v-for="task in mvpTasks"
              :key="task.id"
              class="agent-session-item"
              :class="{ selected: selectedTaskId === task.id }"
              @click="selectTask(task.id); router.push('/chat')"
            >
              <span class="agent-session-title">{{ task.title }}</span>
            </div>
          </div>
        </div>

        <div class="mvp-nav-list">
          <button
            v-for="item in mvpNavItems"
            :key="item.key"
            class="mvp-nav-item"
            :class="{ selected: item.selected }"
            @click="item.action()"
          >
            <span class="mvp-nav-item__icon">
              <svg v-if="item.icon === 'phone'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2"/>
                <line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
              <svg v-else-if="item.icon === 'spark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </span>
            <span class="mvp-nav-item__label">{{ item.label }}</span>
          </button>
        </div>

        <div class="mvp-panel__spacer"></div>
        <div class="mvp-panel__switcher">
          <LayoutModeSwitcher sidebar />
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════
         CHAT PANEL — 对话
    ══════════════════════════════════════ -->
    <template v-else-if="activeTab === 'chat'">
      <!-- Search box -->
      <div class="sidebar-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input class="sidebar-search-input" type="text" placeholder="搜索" />
      </div>

      <!-- New Agent button -->
      <button class="new-agent-btn" @click="addAgent">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        新建 Agent
      </button>

      <!-- Agent list -->
      <div class="agent-list">
        <div v-for="agent in agents" :key="agent.id" class="agent-row">
          <!-- Agent header (always visible) -->
          <div class="agent-header" :class="{ selected: isAgentHeaderSelected(agent.id) }" @click="selectAgent(agent.id)">
            <button class="agent-avatar-button" type="button" @click.stop="openAgentProfile(agent.id)">
              <div class="agent-avatar" :class="agent.avatar ? '' : `agent-avatar--${agent.gradient}`">
                <img v-if="agent.avatar" :src="agent.avatar" class="agent-avatar-img" />
                <span v-else class="agent-avatar-initial">{{ agent.initial ?? agent.name[0]?.toUpperCase() }}</span>
              </div>
            </button>
            <div class="agent-info">
              <span class="agent-name">{{ agent.name }}</span>
              <span class="agent-desc">{{ agent.description }}</span>
            </div>
            <svg
              v-if="allItemsForAgent(agent.id).length > 0"
              class="agent-chevron"
              :class="{ expanded: expandedAgents.has(agent.id) }"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
              @click.stop="toggleAgent(agent.id)"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          <!-- Sessions/tasks under this agent — expands on chevron click -->
          <div v-if="allItemsForAgent(agent.id).length > 0" class="agent-sessions" :class="{ expanded: expandedAgents.has(agent.id) }">
            <div
              v-for="item in allItemsForAgent(agent.id)"
              :key="item.id"
              class="agent-session-item"
              :class="{ selected: item.isDynamic && selectedTaskId === item.id }"
              @click="item.isDynamic ? (selectTask(item.id), router.push('/chat')) : selectSession(item.id)"
            >
              <span class="agent-session-title">{{ item.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════
         TASKS PANEL — 任务
    ══════════════════════════════════════ -->
    <template v-else-if="activeTab === 'tasks'">
      <!-- Header -->
      <div class="tasks-header">
        <span class="tasks-header-title">{{ t('sidebar.myTasks') }}</span>
        <button class="tasks-header-add" @click="createNewTask" :title="t('sidebar.newTask')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <!-- Create task button -->
      <button class="create-task-btn" @click="createNewTask">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ t('sidebar.createTask') }}
      </button>

      <!-- Scrollable task list -->
      <div class="tasks-scroll">
        <!-- Running tasks -->
        <div class="task-group">
          <div class="task-group-header" @click="runningExpanded = !runningExpanded">
            <div class="task-group-left">
              <svg class="task-group-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <span>{{ t('sidebar.runningTasks') }}</span>
              <span v-if="fakeRunningTasks.length" class="task-group-badge task-group-badge--running">{{ fakeRunningTasks.length }}</span>
            </div>
            <svg class="task-group-chevron" :class="{ expanded: runningExpanded }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          <div v-show="runningExpanded" class="task-group-body">
            <div
              v-for="s in fakeRunningTasks"
              :key="s.key"
              class="task-item"
              @click="selectSession(s.key)"
            >
              <span class="task-item-title">{{ s.title }}</span>
            </div>
          </div>
        </div>

        <!-- Completed tasks -->
        <div class="task-group">
          <div class="task-group-header" @click="completedExpanded = !completedExpanded">
            <div class="task-group-left">
              <svg class="task-group-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>{{ t('sidebar.completedTasks') }}</span>
            </div>
            <svg class="task-group-chevron" :class="{ expanded: completedExpanded }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          <div v-show="completedExpanded" class="task-group-body">
            <div
              v-for="s in fakeCompletedTasks"
              :key="s.key"
              class="task-item"
              @click="selectSession(s.key)"
            >
              <span class="task-item-title">{{ s.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════
         PHONE PANEL — 手机
    ══════════════════════════════════════ -->
    <template v-else-if="activeTab === 'phone'">
      <div class="panel-placeholder">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2"/>
          <line x1="12" y1="18" x2="12.01" y2="18"/>
        </svg>
        <span>手机连接</span>
        <span class="panel-placeholder-sub">即将推出</span>
      </div>
    </template>

    <!-- ══════════════════════════════════════
         EXPLORE PANEL — 探索
    ══════════════════════════════════════ -->
    <template v-else-if="activeTab === 'explore'">
      <div class="tasks-header">
        <span class="tasks-header-title">{{ t('sidebar.explore') }}</span>
      </div>
      <div class="explore-panel">
        <div class="explore-item" :class="{ selected: route.path === '/explore' }" @click="router.push('/explore')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4V5z"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
          <span>{{ t('sidebar.exploreTasks') }}</span>
        </div>
        <div class="explore-item" :class="{ selected: route.path === '/plugins' }" @click="router.push('/plugins')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span>{{ t('sidebar.skills') }}</span>
        </div>
      </div>
    </template>

  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import LayoutModeSwitcher from '@/components/LayoutModeSwitcher.vue'
import { useLayoutMode } from '@/composables/useLayoutMode'
import { useGatewayStore } from '@/stores/gateway'
import { useChatStore } from '@/stores/chat'
import { useSessionStore } from '@/stores/sessions'
import { useNavState } from '@/composables/useNavState'
import { useMockAgentStore } from '@/stores/mockAgents'
import { useMvpTasks } from '@/composables/useMvpTasks'
import { t } from '@/i18n'

const router = useRouter()
const route = useRoute()
const gateway = useGatewayStore()
const chatStore = useChatStore()
const sessionStore = useSessionStore()
const { isMvpMode } = useLayoutMode()
const { tasks, selectedTaskId, tasksForAgent, requestScrollTo, selectTask } = useMvpTasks()
const mvpTasksExpanded = ref(true)
const mvpTasks = computed(() => defaultAgent.value ? tasksForAgent(defaultAgent.value.id) : [])
const { activeTab } = useNavState()

// ── Task panel expand state ──
const runningExpanded = ref(true)
const completedExpanded = ref(true)

// ── Agent session expand state ──
const expandedAgents = ref(new Set<string>())
function toggleAgent(id: string) {
  if (expandedAgents.value.has(id)) {
    expandedAgents.value.delete(id)
  } else {
    expandedAgents.value.add(id)
  }
}

// ── Agent state (shared store) ──
const mockAgentStore = useMockAgentStore()
const agents = computed(() => mockAgentStore.agents)
const selectedAgentId = computed(() => mockAgentStore.selectedAgentId)
const defaultAgent = computed(() => agents.value.find(a => a.id === 'default') ?? agents.value[0] ?? null)

const mvpNavItems = computed(() => [
  {
    key: 'phone',
    label: '手机',
    selected: route.path.startsWith('/phone'),
    action: () => router.push('/phone'),
    icon: 'phone',
  },
  {
    key: 'explore',
    label: t('sidebar.exploreTasks'),
    selected: route.path.startsWith('/explore'),
    action: () => router.push('/explore'),
    icon: 'spark',
  },
  {
    key: 'plugins',
    label: t('sidebar.skills'),
    selected: route.path.startsWith('/plugins'),
    action: () => router.push('/plugins'),
    icon: 'link',
  },
])

const isMvpAgentSelected = computed(() => {
  const hasSelectedMvpTab = mvpNavItems.value.some((item) => item.selected)
  const hasSelectedTask = !!selectedTaskId.value && mvpTasks.value.some(t => t.id === selectedTaskId.value)
  return !hasSelectedMvpTab && !hasSelectedTask && (route.path.startsWith('/chat') || route.path.startsWith('/profile'))
})

function isAgentHeaderSelected(agentId: string): boolean {
  if (selectedAgentId.value !== agentId) return false
  return !tasksForAgent(agentId).some(t => t.id === selectedTaskId.value)
}

function selectAgent(id: string) {
  mockAgentStore.selectAgent(id)
  selectTask(null)
  router.push('/chat')
}

function openAgentProfile(agentId: string) {
  mockAgentStore.selectAgent(agentId)
  selectTask(null)
  router.push({
    path: `/chat/${agentId}`,
    query: { panel: 'profile', profileAgentId: agentId },
  })
}

function handleMvpAgentSelect() {
  if (defaultAgent.value) {
    mockAgentStore.selectAgent(defaultAgent.value.id)
  }
  selectTask(null)
  router.push('/chat')
}

onMounted(() => {
  gateway.refreshWeixinStatus()
})

// ── Session grouping ──
const ACTIVE_THRESHOLD = 5 * 60 * 1000

const activeSessions = computed(() => {
  const now = Date.now()
  return sessionStore.sortedSessions.filter(
    (s) => (chatStore.streaming && chatStore.sessionKey === s.key) ||
            (now - s.updatedAt < ACTIVE_THRESHOLD)
  )
})

const stoppedSessions = computed(() => {
  const activeKeys = new Set(activeSessions.value.map((s) => s.key))
  return sessionStore.sortedSessions.filter((s) => !activeKeys.has(s.key))
})

// ── Fake task data for tasks panel ──
const fakeRunningTasks = [
  { key: 'fake-run-0', title: '今日沪深 300 涨跌分析' },
  { key: 'fake-run-1', title: '修复用户登录超时 Bug' },
  { key: 'fake-run-2', title: '爆款标题批量生成' },
]

const fakeCompletedTasks = [
  { key: 'fake-done-0', title: '茅台近 30 日 K 线复盘' },
  { key: 'fake-done-1', title: '仓位调整建议' },
  { key: 'fake-done-2', title: '发布夏日穿搭笔记' },
  { key: 'fake-done-3', title: '重构支付模块' },
  { key: 'fake-done-4', title: '规划本周健康饮食' },
]

function sessionsForAgent(agentId: string) {
  const agent = agents.value.find(a => a.id === agentId)
  return (agent?.fakeTasks ?? []).map((title, i) => ({ key: `${agentId}-fake-${i}`, title }))
}

function allItemsForAgent(agentId: string) {
  const statics = sessionsForAgent(agentId).map(s => ({ id: s.key, title: s.title, isDynamic: false }))
  const dynamic = tasksForAgent(agentId).map(t => ({ id: t.id, title: t.title, isDynamic: true }))
  return [...statics, ...dynamic]
}

// Auto-expand agent row when dynamic tasks added
watch(tasks, (newTasks) => {
  if (!isMvpMode.value) {
    newTasks.forEach(t => expandedAgents.value.add(t.agentId))
  }
}, { deep: true })

// Auto-select first agent when switching to chat tab
watch(activeTab, (tab) => {
  if (tab === 'chat' && agents.value.length > 0 && !mockAgentStore.selectedAgentId) {
    mockAgentStore.selectAgent(agents.value[0].id)
  }
}, { immediate: true })

watch(
  () => [isMvpMode.value, route.path] as const,
  ([mvpMode, path]) => {
    if (mvpMode && path.startsWith('/tasks')) {
      router.replace('/chat')
    }
  },
  { immediate: true }
)

function addAgent() {
  router.push('/new-agent')
}

// ── Actions ──
function selectSession(key: string) {
  chatStore.switchSession(key)
  router.push('/chat')
}

function createNewTask() {
  chatStore.newSession()
  router.push('/chat')
}

function deleteSession(key: string) {
  chatStore.deleteSession(key)
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  height: 100vh;
  background: #fdfaf8;
  border-right: 0.5px solid var(--border-row);
  display: flex;
  flex-direction: column;
  user-select: none;
  overflow: hidden;
}

/* ── Drag region ── */
.sidebar-drag-region {
  height: 8px;
  -webkit-app-region: drag;
  flex-shrink: 0;
}

/* ════════════════════════════════════════
   SEARCH BOX
════════════════════════════════════════ */
.sidebar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 14px 12px;
  padding: 8px 12px;
  background: var(--bg-input);
  border-radius: 20px;
  color: var(--text-muted);
  -webkit-app-region: no-drag;
  flex-shrink: 0;
}

.sidebar-search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  font-family: inherit;
  color: var(--text-primary);
  outline: none;
}

.sidebar-search-input::placeholder {
  color: var(--text-muted);
}

/* ════════════════════════════════════════
   MVP PANEL
════════════════════════════════════════ */
.mvp-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 8px 8px 0;
  --mvp-icon-column-left: 32px;
}

.mvp-agent-header {
  margin: 6px 4px 10px;
}

.mvp-nav-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mvp-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 8px);
  padding: 8px 12px 8px 28px;
  margin: 1px 4px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 450;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}

.mvp-nav-item:focus,
.mvp-nav-item:focus-visible {
  outline: none;
  box-shadow: none;
}

.mvp-nav-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.mvp-nav-item.selected {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-weight: 450;
}

.mvp-agent-header.selected {
  background: var(--bg-tertiary);
}

.mvp-nav-item__icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.mvp-nav-item__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mvp-panel__spacer {
  flex: 1;
}

.mvp-panel__switcher {
  display: block;
  padding: 12px 0 21px;
}

.mvp-panel__switcher :deep(.layout-switcher) {
  width: 100%;
  justify-content: flex-start;
}

.mvp-panel__switcher :deep(.layout-switcher__menu) {
  left: 0;
  transform: none;
}

/* ════════════════════════════════════════
   CHAT PANEL
════════════════════════════════════════ */
.new-agent-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 14px 10px;
  padding: 9px 14px;
  background: var(--text-primary);
  color: var(--bg-secondary);
  border: 1px solid transparent;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
  -webkit-app-region: no-drag;
  flex-shrink: 0;
  box-sizing: border-box;
}

html.dark .new-agent-btn {
  color: var(--bg-primary);
}

.new-agent-btn:hover {
  opacity: 0.82;
}

.agent-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 8px;
  min-height: 0;
}

.agent-row {
  border-radius: 10px;
  margin-bottom: 2px;
  transition: background 0.15s;
}

/* Header row */
.agent-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  cursor: pointer;
  border-radius: 10px;
  transition: background 0.15s;
}

.agent-row:hover .agent-header {
  background: var(--bg-tertiary);
}

.agent-header.selected {
  background: var(--bg-tertiary);
}

.agent-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.agent-avatar-button {
  padding: 0;
  border: none;
  background: transparent;
  display: grid;
  place-items: center;
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
}

.agent-avatar-button:focus,
.agent-avatar-button:focus-visible {
  outline: none;
  box-shadow: none;
}

.agent-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

/* Gradient layer */
.agent-avatar::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
}

/* Grain overlay — separate so opacity can be tuned independently */
.agent-avatar::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: white;
  filter: url(#grain);
  opacity: 0.5;
  mix-blend-mode: multiply;
  pointer-events: none;
}

.agent-avatar {
  cursor: pointer;
}

.agent-avatar--aurora::before { background: radial-gradient(ellipse 90% 70% at 25% 30%, #9a7fff 0%, transparent 55%), radial-gradient(ellipse 70% 90% at 75% 70%, #e050e0 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 55% 20%, #ffaa44 0%, transparent 60%), #a060f0; }
.agent-avatar--ember::before  { background: radial-gradient(ellipse 85% 65% at 20% 25%, #ff4040 0%, transparent 55%), radial-gradient(ellipse 65% 85% at 75% 65%, #ff8010 0%, transparent 55%), radial-gradient(ellipse 70% 55% at 55% 80%, #ffd030 0%, transparent 60%), #ff6020; }
.agent-avatar--sage::before   { background: radial-gradient(ellipse 80% 70% at 30% 25%, #20c060 0%, transparent 55%), radial-gradient(ellipse 70% 80% at 70% 70%, #60e070 0%, transparent 55%), radial-gradient(ellipse 75% 55% at 60% 15%, #ccf020 0%, transparent 60%), #40b850; }
.agent-avatar--dusk::before   { background: radial-gradient(ellipse 85% 65% at 25% 30%, #9940ff 0%, transparent 55%), radial-gradient(ellipse 65% 85% at 72% 68%, #ff40a0 0%, transparent 55%), radial-gradient(ellipse 70% 55% at 50% 80%, #ffb030 0%, transparent 60%), #cc40c0; }
.agent-avatar--ocean::before  { background: radial-gradient(ellipse 80% 70% at 25% 28%, #0090ff 0%, transparent 55%), radial-gradient(ellipse 70% 85% at 72% 65%, #10d8b0 0%, transparent 55%), radial-gradient(ellipse 75% 55% at 55% 80%, #70ff60 0%, transparent 60%), #10a0e0; }
.agent-avatar--gold::before   { background: radial-gradient(ellipse 100% 90% at 30% 30%, #ffe000 0%, #ffcc00 45%, transparent 72%), radial-gradient(ellipse 55% 65% at 80% 70%, #ff6090 0%, transparent 45%), radial-gradient(ellipse 55% 45% at 55% 88%, #ff3060 0%, transparent 45%), #e0a000; }
.agent-avatar--rose::before   { background: radial-gradient(ellipse 85% 65% at 22% 28%, #ff2020 0%, transparent 55%), radial-gradient(ellipse 65% 85% at 72% 65%, #ff3800 0%, transparent 55%), radial-gradient(ellipse 70% 55% at 50% 80%, #ff8010 0%, transparent 60%), #ff3010; }

.agent-avatar-initial {
  position: relative;
  z-index: 1;
  font-size: 15px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.88);
  letter-spacing: -0.01em;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.agent-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
}

.agent-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-desc {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-chevron {
  color: var(--text-muted);
  transition: transform 0.2s, opacity 0.15s;
  flex-shrink: 0;
  transform: rotate(0deg);
  opacity: 0;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
}

.agent-chevron:hover {
  color: var(--text-primary);
  background: rgba(0,0,0,0.06);
}

.agent-chevron.expanded {
  transform: rotate(180deg);
}

.agent-row:hover .agent-chevron {
  opacity: 1;
}

/* Sessions expand on click */
.agent-sessions {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.25s ease;
  padding: 0 4px;
}

.agent-sessions.expanded {
  max-height: 280px;
}

.agent-session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px 7px 52px;
  margin: 1px 0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  transition: background 0.12s, color 0.12s;
}

.agent-session-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.agent-session-item.selected {
  background: var(--smtc-ctrl-list-background-selected-rest, #00000008);
  color: var(--text-primary);
  font-weight: 600;
}


.agent-session-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}

.agent-session-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-session-delete {
  display: none;
  padding: 0 3px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;
  flex-shrink: 0;
}

.agent-session-item:hover .agent-session-delete {
  display: block;
}

.agent-session-delete:hover {
  color: var(--danger);
}

.agent-sessions-empty {
  padding: 8px 14px;
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
}

/* ════════════════════════════════════════
   TASKS PANEL
════════════════════════════════════════ */
.tasks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 18px 4px;
  margin-top: 4px;
  flex-shrink: 0;
}

.tasks-header-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.tasks-header-add {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  display: grid;
  place-items: center;
  transition: background 0.15s, color 0.15s;
}

.tasks-header-add:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.create-task-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 14px 10px;
  padding: 9px 14px;
  background: transparent;
  border: 1px solid var(--text-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 20px;
  box-sizing: border-box;
  transition: opacity 0.15s;
  font-family: inherit;
  flex-shrink: 0;
}

.create-task-btn:hover {
  opacity: 0.65;
}

.tasks-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  padding: 0 8px;
}

.task-group {
  margin-bottom: 2px;
}

.task-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.task-group-header:hover {
  background: var(--bg-tertiary);
}

.task-group-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-group-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.task-group-badge {
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  line-height: 1.5;
}

.task-group-badge--running {
  background: #e8533a;
}

.task-group-chevron {
  color: var(--text-muted);
  transition: transform 0.2s;
  transform: rotate(0deg);
  flex-shrink: 0;
}

.task-group-chevron.expanded {
  transform: rotate(180deg);
}

.task-group-body {
  padding: 2px 0 4px 0;
}

.task-item {
  display: flex;
  align-items: center;
  padding: 8px 12px 8px 28px;
  margin: 1px 4px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
  font-size: 13px;
  font-weight: 450;
  color: var(--text-secondary);
}

.task-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.task-item.selected {
  background: var(--accent-selected-bg);
  color: var(--text-primary);
  font-weight: 600;
  border: 1.5px solid var(--accent-selected);
}

.task-item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-item-delete {
  display: none;
  padding: 0 4px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 15px;
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;
  flex-shrink: 0;
}

.task-item:hover .task-item-delete {
  display: block;
}

.task-item-delete:hover {
  color: var(--danger);
}

.task-empty-hint {
  padding: 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

/* ════════════════════════════════════════
   PHONE PANEL
════════════════════════════════════════ */
.panel-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
  padding-bottom: 48px;
}

.panel-placeholder-sub {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.7;
}

/* ════════════════════════════════════════
   EXPLORE PANEL
════════════════════════════════════════ */
.explore-panel {
  flex: 1;
  padding: 0 8px;
  min-height: 0;
  overflow-y: auto;
}


.explore-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
  font-size: 13px;
  font-weight: 450;
  color: var(--text-secondary);
}

.explore-item:hover {
  background: var(--alias-color-background-250, #e2ddd9);
  color: var(--text-primary);
}

.explore-item.selected {
  background: var(--smtc-ctrl-list-background-selected-rest, #00000008);
  color: var(--text-primary);
  font-weight: 600;
}

</style>
