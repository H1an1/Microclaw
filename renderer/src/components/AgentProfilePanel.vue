<template>
  <section v-if="agent" class="agent-profile-panel">
    <!-- Header -->
    <div class="panel-header">
      <div class="panel-header__left">
        <div class="panel-avatar" :class="agent.avatar ? '' : `panel-avatar--${agent.gradient}`">
          <img v-if="agent.avatar" :src="agent.avatar" :alt="agent.name" class="panel-avatar__img" />
          <span v-else class="panel-avatar__initial">{{ agent.initial ?? agent.name[0]?.toUpperCase() }}</span>
        </div>
        <div class="panel-header__meta">
          <div class="panel-header__name">{{ agent.name }}</div>
          <div class="panel-header__desc">{{ agent.description }}</div>
        </div>
      </div>
      <button class="panel-close" type="button" @click="closePanel" aria-label="关闭">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>

    <div class="panel-scroll">
      <!-- Agent's Space -->
      <div class="agent-scene" :class="{ 'agent-scene--crashed': isCrashed }">
        <div class="agent-scene__floor"></div>
        <img :src="crashGif" class="agent-scene__gif" alt="" />
        <div class="agent-scene__state-badge" :class="{ 'agent-scene__state-badge--crashed': isCrashed }">
          <span class="agent-scene__dot"></span>
          {{ isCrashed ? 'Token 已耗尽' : (usageLoading ? '加载中…' : '正常运行') }}
        </div>
      </div>

      <!-- Crashed State Banner -->
      <div v-if="isCrashed" class="state-banner state-banner--crashed">
        <span class="state-banner__icon">💸</span>
        <div class="state-banner__body">
          <div class="state-banner__title">预算已用完，Agent 暂停服务</div>
          <div v-if="displayData.budgetResetAt" class="state-banner__sub">
            重置于 {{ formatResetDate(displayData.budgetResetAt) }}
          </div>
          <div v-else class="state-banner__sub">请联系管理员增加配额</div>
        </div>
      </div>

      <!-- Token Usage — always visible, dashes when no data -->
      <div class="stat-section">
        <div class="stat-section__head">
          <span class="stat-section__title">Token 用量</span>
          <span class="stat-section__note">{{ t('settings.tokenUsage30d') }}</span>
        </div>
        <div class="token-grid">
          <div class="token-cell token-cell--total" :class="{ 'token-cell--depleted': isCrashed }">
            <span class="token-cell__label">总计</span>
            <strong class="token-cell__value">{{ formatInteger(displayData.totalTokens) }}</strong>
          </div>
          <div class="token-cell">
            <span class="token-cell__label">输入</span>
            <strong class="token-cell__value">{{ formatInteger(displayData.totalPromptTokens) }}</strong>
          </div>
          <div class="token-cell">
            <span class="token-cell__label">输出</span>
            <strong class="token-cell__value">{{ formatInteger(displayData.totalCompletionTokens) }}</strong>
          </div>
          <div class="token-cell">
            <span class="token-cell__label">缓存读取</span>
            <strong class="token-cell__value">{{ displayData.cacheReadTokens ? formatInteger(displayData.cacheReadTokens) : '—' }}</strong>
          </div>
          <div class="token-cell" :class="{ 'token-cell--depleted': displayData.remainingTokensToday === 0 }">
            <span class="token-cell__label">今日余量</span>
            <strong class="token-cell__value">{{ displayData.remainingTokensToday === 0 ? '已耗尽' : formatInteger(displayData.remainingTokensToday) }}</strong>
          </div>
        </div>
        <div class="meta-pills">
          <span class="meta-pill">{{ formatInteger(displayData.totalRequests) }} 请求</span>
          <span v-if="typeof displayData.sessionCount === 'number'" class="meta-pill">{{ formatInteger(displayData.sessionCount) }} 会话</span>
          <span v-if="typeof displayData.toolCalls === 'number'" class="meta-pill">{{ formatInteger(displayData.toolCalls) }} 工具调用</span>
        </div>
      </div>

      <!-- Budget -->
      <div v-if="displayData.maxBudget" class="stat-section">
        <div class="stat-section__head">
          <span class="stat-section__title">预算</span>
          <span class="stat-section__note">${{ displayData.totalSpend.toFixed(2) }} / ${{ displayData.maxBudget.toFixed(2) }}</span>
        </div>
        <div class="budget-bar">
          <div
            class="budget-bar__fill"
            :class="{ 'budget-bar__fill--full': budgetProgress >= 100 }"
            :style="{ width: budgetProgress + '%' }"
          ></div>
        </div>
      </div>

      <!-- Skills -->
      <div class="stat-section">
        <div class="stat-section__head">
          <span class="stat-section__title">Skills</span>
          <button class="skills-add-btn" type="button">+</button>
        </div>
        <div class="skills-tags">
          <span v-for="skill in visibleSkills" :key="skill.name" class="skill-tag">
            <span v-if="skill.icon" class="skill-tag__icon">{{ skill.icon }}</span>
            {{ skill.name }}
          </span>
        </div>
        <button v-if="FAKE_SKILLS.length > SKILLS_PREVIEW_COUNT" class="skills-more-btn" type="button" @click="skillsExpanded = !skillsExpanded">
          {{ skillsExpanded ? '收起' : '查看更多' }}
        </button>
      </div>

      <!-- Model Breakdown -->
      <div v-if="usageModelList.length" class="stat-section">
        <div class="stat-section__head">
          <span class="stat-section__title">模型</span>
          <span class="stat-section__note">{{ usageModelList.length }} 个</span>
        </div>
        <div class="model-list">
          <article v-for="model in usageModelList" :key="model.name" class="model-card">
            <div class="model-card__row">
              <strong class="model-card__name">{{ model.name }}</strong>
              <span class="model-card__spend">${{ model.spend.toFixed(4) }}</span>
            </div>
            <div class="model-card__meta">
              <span>{{ formatInteger(model.requests) }} req</span>
              <span>{{ formatInteger(model.promptTokens) }} in</span>
              <span>{{ formatInteger(model.completionTokens) }} out</span>
            </div>
          </article>
        </div>
      </div>

      <!-- Loading / Error -->
      <div v-if="usageLoading" class="panel-state">正在加载用量数据…</div>
      <div v-else-if="usageError" class="panel-state panel-state--error">
        <span>{{ usageError }}</span>
        <button class="panel-retry" type="button" @click="loadUsage">重试</button>
      </div>

      <p v-if="usageData" class="panel-footnote">{{ t('settings.usageFooter') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMockAgentStore } from '@/stores/mockAgents'
import { t } from '@/i18n'
import { isGatewayDisconnectedMessage, normalizeIpcErrorMessage } from '@/utils/ipc-errors'
import crashGif from '@/assets/crash.gif'

interface UsageStats {
  totalSpend: number;
  maxBudget: number | null;
  modelSpend: Record<string, number>;
  keyName: string;
  budgetDuration: string | null;
  budgetResetAt: string | null;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalRequests: number;
  modelBreakdown: Record<string, { requests: number; promptTokens: number; completionTokens: number; spend: number }>;
  dailySpend: Record<string, number>;
  hasDetailedLogs: boolean;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  sessionCount?: number;
  toolCalls?: number;
}

const props = defineProps<{
  agentId: string;
}>()

const route = useRoute()
const router = useRouter()
const mockAgentStore = useMockAgentStore()

const usageData = ref<UsageStats | null>(null)
const usageLoading = ref(false)
const usageError = ref('')
let unsubWsConnected: (() => void) | null = null

const agent = computed(() => {
  const directMatch = mockAgentStore.agents.find((item) => item.id === props.agentId)
  if (directMatch) return directMatch
  return mockAgentStore.agents.find((item) => item.id === mockAgentStore.selectedAgentId) ?? mockAgentStore.agents[0] ?? null
})

watchEffect(() => {
  const resolvedAgent = agent.value
  if (!resolvedAgent) return
  if (mockAgentStore.selectedAgentId !== resolvedAgent.id) {
    mockAgentStore.selectAgent(resolvedAgent.id)
  }
})

const usageModelList = computed(() => {
  if (!usageData.value) return []
  if (usageData.value.hasDetailedLogs && Object.keys(usageData.value.modelBreakdown).length) {
    return Object.entries(usageData.value.modelBreakdown).map(([name, detail]) => ({
      name,
      requests: detail.requests,
      promptTokens: detail.promptTokens,
      completionTokens: detail.completionTokens,
      spend: detail.spend,
    }))
  }
  return Object.entries(usageData.value.modelSpend).map(([name, spend]) => ({
    name, requests: 0, promptTokens: 0, completionTokens: 0, spend,
  }))
})

const FAKE_SKILLS = [
  { name: 'persona-switch' },
  { name: 'video-script-gen' },
  { name: 'canvas-design' },
  { name: 'cloud-upload' },
  { name: 'content-factory' },
  { name: 'docx' },
  { name: 'email-skill' },
  { name: '文件整理' },
  { name: 'frontend-design' },
  { name: 'github' },
  { name: 'ima-skill', icon: '🔧' },
  { name: 'imap-smtp-email', icon: '📧' },
  { name: 'kc-gui' },
  { name: 'kdocs' },
  { name: 'mcporter' },
]

const FAKE_DATA = {
  totalTokens: 1284300,
  totalPromptTokens: 942100,
  totalCompletionTokens: 342200,
  cacheReadTokens: 186400,
  remainingTokensToday: 0,
  totalRequests: 1247,
  sessionCount: 38,
  toolCalls: 312,
  totalSpend: 10.00,
  maxBudget: 10.00,
  budgetResetAt: '2025-02-01T00:00:00Z',
}

const displayData = computed(() => usageData.value ?? FAKE_DATA)

const budgetProgress = computed(() => {
  const d = displayData.value
  if (!d.maxBudget) return 0
  return Math.min(100, (d.totalSpend / d.maxBudget) * 100)
})

const isCrashed = computed(() => budgetProgress.value >= 100)

const skillsExpanded = ref(false)
const SKILLS_PREVIEW_COUNT = 9
const visibleSkills = computed(() =>
  skillsExpanded.value ? FAKE_SKILLS : FAKE_SKILLS.slice(0, SKILLS_PREVIEW_COUNT)
)

function formatInteger(value: number | undefined): string {
  return Number(value ?? 0).toLocaleString()
}

function formatResetDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function closePanel() {
  const nextQuery = { ...route.query }
  delete nextQuery.panel
  delete nextQuery.profileAgentId
  router.replace({ path: route.path, query: nextQuery })
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closePanel()
}

async function loadUsage() {
  usageLoading.value = true
  usageError.value = ''
  try {
    const connected = await window.openclaw.chat.isConnected()
    if (!connected) {
      usageData.value = null
      usageError.value = t('settings.usageGatewayDisconnected')
      return
    }
    usageData.value = await window.openclaw.usage.getStats() as UsageStats
  } catch (err: unknown) {
    const message = normalizeIpcErrorMessage(err, t('settings.usageLoadFailed'))
    usageError.value = isGatewayDisconnectedMessage(message)
      ? t('settings.usageGatewayDisconnected')
      : message
    usageData.value = null
  } finally {
    usageLoading.value = false
  }
}

watch(() => props.agentId, () => { void loadUsage() })

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  unsubWsConnected = window.openclaw.gateway.onWsConnected(() => {
    if (!usageLoading.value) void loadUsage()
  })
  void loadUsage()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  unsubWsConnected?.()
})
</script>

<style scoped>
/* Panel shell */
.agent-profile-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at top left, rgba(74, 144, 217, 0.08), transparent 40%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(247, 244, 241, 0.99));
}

html.dark .agent-profile-panel {
  background:
    radial-gradient(circle at top left, rgba(74, 144, 217, 0.12), transparent 40%),
    linear-gradient(180deg, rgba(16, 20, 28, 0.99), rgba(12, 15, 20, 0.99));
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(18, 24, 32, 0.07);
  flex-shrink: 0;
}

html.dark .panel-header {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.panel-header__left {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.panel-header__meta {
  min-width: 0;
}

.panel-header__name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel-header__desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Small avatar in header */
.panel-avatar {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  overflow: hidden;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  position: relative;
}

.panel-avatar::before {
  content: '';
  position: absolute;
  inset: 0;
}

.panel-avatar--aurora::before { background: radial-gradient(ellipse 90% 70% at 25% 30%, #9a7fff 0%, transparent 55%), radial-gradient(ellipse 70% 90% at 75% 70%, #e050e0 0%, transparent 55%), #a060f0; }
.panel-avatar--ember::before  { background: radial-gradient(ellipse 85% 65% at 20% 25%, #ff4040 0%, transparent 55%), radial-gradient(ellipse 65% 85% at 75% 65%, #ff8010 0%, transparent 55%), #ff6020; }
.panel-avatar--sage::before   { background: radial-gradient(ellipse 80% 70% at 30% 25%, #20c060 0%, transparent 55%), radial-gradient(ellipse 70% 80% at 70% 70%, #60e070 0%, transparent 55%), #40b850; }
.panel-avatar--dusk::before   { background: radial-gradient(ellipse 85% 65% at 25% 30%, #9940ff 0%, transparent 55%), radial-gradient(ellipse 65% 85% at 72% 68%, #ff40a0 0%, transparent 55%), #cc40c0; }
.panel-avatar--ocean::before  { background: radial-gradient(ellipse 80% 70% at 25% 28%, #0090ff 0%, transparent 55%), radial-gradient(ellipse 70% 85% at 72% 65%, #10d8b0 0%, transparent 55%), #10a0e0; }
.panel-avatar--gold::before   { background: radial-gradient(ellipse 100% 90% at 30% 30%, #ffe000 0%, #ffcc00 45%, transparent 72%), radial-gradient(ellipse 55% 65% at 80% 70%, #ff6090 0%, transparent 45%), #e0a000; }
.panel-avatar--rose::before   { background: radial-gradient(ellipse 85% 65% at 22% 28%, #ff2020 0%, transparent 55%), radial-gradient(ellipse 65% 85% at 72% 65%, #ff3800 0%, transparent 55%), #ff3010; }

.panel-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: relative;
  z-index: 1;
}

.panel-avatar__initial {
  font-size: 15px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  position: relative;
  z-index: 1;
}

.panel-close {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(18, 24, 32, 0.06);
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  flex-shrink: 0;
  transition: background 0.15s;
}

.panel-close:hover {
  background: rgba(18, 24, 32, 0.1);
}

html.dark .panel-close {
  background: rgba(255, 255, 255, 0.08);
}

html.dark .panel-close:hover {
  background: rgba(255, 255, 255, 0.13);
}

/* Scroll area */
.panel-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px 24px;
}

/* ─── Agent's Space ─── */
.agent-scene {
  position: relative;
  height: 210px;
  border-radius: 20px;
  margin-bottom: 12px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: var(--bg-tertiary);
}

.agent-scene--crashed {}

.agent-scene__floor {
  display: none;
}

.agent-scene__gif {
  height: 175px;
  object-fit: contain;
}

.agent-scene__state-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px 8px;
  border-radius: 999px;
  background: rgba(60, 200, 100, 0.18);
  border: 1px solid rgba(60, 200, 100, 0.25);
  backdrop-filter: blur(8px);
  color: rgba(100, 230, 140, 0.95);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.agent-scene__state-badge--crashed {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.3);
  color: rgba(255, 130, 120, 0.95);
}

.agent-scene__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
  animation: dot-pulse 2s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

/* State banner */
.state-banner {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 13px 14px;
  border-radius: 16px;
  margin-bottom: 14px;
}

.state-banner--crashed {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.18);
}

.state-banner__icon {
  font-size: 18px;
  line-height: 1.2;
  flex-shrink: 0;
}

.state-banner__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.state-banner__sub {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-secondary);
}

/* Loading / Error */
.panel-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 14px;
  border-radius: 14px;
  font-size: 13px;
  color: var(--text-secondary);
  background: rgba(18, 24, 32, 0.04);
  margin-bottom: 12px;
}

html.dark .panel-state {
  background: rgba(255, 255, 255, 0.04);
}

.panel-retry {
  padding: 6px 20px;
  border-radius: 999px;
  background: var(--text-primary);
  color: var(--bg-secondary);
  border: none;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}

/* Section layout */
.stat-section {
  margin-bottom: 16px;
}

.stat-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 9px;
}

.stat-section__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-section__note {
  font-size: 11px;
  color: var(--text-muted);
}

/* Token grid */
.token-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 7px;
  margin-bottom: 9px;
}

.token-cell {
  padding: 13px 14px;
  border-radius: 14px;
  background: rgba(18, 24, 32, 0.04);
  border: 1px solid rgba(18, 24, 32, 0.06);
}

html.dark .token-cell {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.06);
}

.token-cell--total {
  grid-column: span 2;
  background: linear-gradient(135deg, rgba(74, 144, 217, 0.1), rgba(18, 24, 32, 0.04));
}

html.dark .token-cell--total {
  background: linear-gradient(135deg, rgba(74, 144, 217, 0.16), rgba(255, 255, 255, 0.03));
}

.token-cell--depleted {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(18, 24, 32, 0.04));
}

html.dark .token-cell--depleted {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(255, 255, 255, 0.03));
}

.token-cell__label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 7px;
}

.token-cell__value {
  font-size: 21px;
  line-height: 1;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

/* Meta pills */
.meta-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.meta-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(18, 24, 32, 0.06);
  font-size: 12px;
  color: var(--text-secondary);
}

html.dark .meta-pill {
  background: rgba(255, 255, 255, 0.07);
}

/* Budget */
.budget-bar {
  height: 8px;
  border-radius: 999px;
  background: rgba(18, 24, 32, 0.08);
  overflow: hidden;
}

html.dark .budget-bar {
  background: rgba(255, 255, 255, 0.08);
}

.budget-bar__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4a90d9, #ffb142);
  transition: width 0.5s ease;
}

.budget-bar__fill--full {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

/* Skills */
.skills-add-btn {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: none;
  background: rgba(18, 24, 32, 0.07);
  color: var(--text-secondary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
}

html.dark .skills-add-btn {
  background: rgba(255, 255, 255, 0.09);
}

.skills-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.skill-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 13px;
  border-radius: 999px;
  background: rgba(18, 24, 32, 0.05);
  border: 1px solid rgba(18, 24, 32, 0.08);
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
}

html.dark .skill-tag {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

.skill-tag__icon {
  font-size: 14px;
  line-height: 1;
}

.skills-more-btn {
  width: 100%;
  padding: 9px;
  border-radius: 12px;
  border: 1px solid rgba(18, 24, 32, 0.08);
  background: transparent;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}

html.dark .skills-more-btn {
  border-color: rgba(255, 255, 255, 0.08);
}

/* Model list */
.model-list {
  display: grid;
  gap: 7px;
}

.model-card {
  padding: 12px 13px;
  border-radius: 14px;
  background: rgba(18, 24, 32, 0.04);
  border: 1px solid rgba(18, 24, 32, 0.06);
}

html.dark .model-card {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.06);
}

.model-card__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.model-card__name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
}

.model-card__spend {
  font-size: 13px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.model-card__meta {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

/* Footnote */
.panel-footnote {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  padding: 0 2px;
}

@media (max-width: 960px) {
  .panel-scroll {
    padding: 12px 12px 20px;
  }
}
</style>
