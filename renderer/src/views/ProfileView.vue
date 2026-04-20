<template>
  <section class="profile-view">
    <div v-if="agent" class="profile-shell">
      <div class="profile-toolbar">
        <button class="profile-toolbar__button" type="button" @click="goBackToChat">
          ← 返回对话
        </button>
        <button class="profile-toolbar__link" type="button" @click="openUsageSettings">
          查看完整用量
        </button>
      </div>

      <div class="profile-hero">
        <div class="profile-agent-card">
          <div class="profile-agent-card__avatar" :class="agent.avatar ? '' : `profile-agent-card__avatar--${agent.gradient}`">
            <img v-if="agent.avatar" :src="agent.avatar" :alt="agent.name" class="profile-agent-card__image" />
            <span v-else class="profile-agent-card__initial">{{ agent.initial ?? agent.name[0]?.toUpperCase() }}</span>
          </div>

          <div class="profile-agent-card__copy">
            <span class="profile-agent-card__eyebrow">Agent Profile</span>
            <h1 class="profile-agent-card__title">{{ agent.name }}</h1>
            <p class="profile-agent-card__desc">{{ agent.description }}</p>
            <div class="profile-agent-card__badges">
              <span class="profile-badge">工作区用量</span>
              <span class="profile-badge">{{ t('settings.tokenUsage30d') }}</span>
            </div>
          </div>
        </div>

        <div class="profile-spend-card">
          <span class="profile-spend-card__label">{{ t('settings.totalSpend') }}</span>
          <strong class="profile-spend-card__value">
            {{ totalSpendDisplay }}
          </strong>
          <p class="profile-spend-card__note">
            当前展示的是工作区总用量，还没有按 Agent 单独拆分。
          </p>
        </div>
      </div>

      <div v-if="usageLoading" class="profile-panel profile-panel--state">
        <span>正在加载用量数据…</span>
      </div>

      <div v-else-if="usageError" class="profile-panel profile-panel--state">
        <span>{{ usageError }}</span>
        <button class="profile-panel__retry" type="button" @click="loadUsage">{{ t('settings.retry') }}</button>
      </div>

      <template v-else-if="usageData">
        <div class="profile-stats-grid">
          <article v-for="item in summaryCards" :key="item.label" class="profile-stat-card" :class="`profile-stat-card--${item.tone}`">
            <span class="profile-stat-card__label">{{ item.label }}</span>
            <strong class="profile-stat-card__value">{{ item.value }}</strong>
            <span v-if="item.meta" class="profile-stat-card__meta">{{ item.meta }}</span>
          </article>
        </div>

        <div v-if="usageData.maxBudget" class="profile-panel">
          <div class="profile-panel__head">
            <span class="profile-panel__title">{{ t('settings.budget') }}</span>
            <span class="profile-panel__value">${{ usageData.totalSpend.toFixed(2) }} / ${{ usageData.maxBudget.toFixed(2) }}</span>
          </div>
          <div class="profile-budget-bar">
            <div class="profile-budget-bar__fill" :style="{ width: budgetProgress + '%' }"></div>
          </div>
        </div>

        <div class="profile-panel">
          <div class="profile-panel__head">
            <span class="profile-panel__title">{{ t('settings.modelBreakdown') }}</span>
            <span class="profile-panel__caption">{{ usageModelList.length }} models</span>
          </div>

          <div v-if="usageModelList.length" class="profile-model-list">
            <article v-for="model in usageModelList" :key="model.name" class="profile-model-card">
              <div class="profile-model-card__top">
                <strong class="profile-model-card__name">{{ model.name }}</strong>
                <span class="profile-model-card__spend">${{ model.spend.toFixed(4) }}</span>
              </div>
              <div class="profile-model-card__meta">
                <span>{{ formatInteger(model.requests) }} {{ t('settings.callsSuffix') }}</span>
                <span>{{ formatInteger(model.promptTokens) }} {{ t('settings.inputSuffix') }}</span>
                <span>{{ formatInteger(model.completionTokens) }} {{ t('settings.outputSuffix') }}</span>
              </div>
            </article>
          </div>
          <div v-else class="profile-panel__empty">暂无模型明细</div>
        </div>

        <p class="profile-footnote">{{ t('settings.usageFooter') }}</p>
      </template>

      <div v-else class="profile-panel profile-panel--state">
        <span>暂无用量数据</span>
      </div>
    </div>

    <div v-else class="profile-empty">
      <span>没有找到这个 Agent。</span>
      <button class="profile-toolbar__button" type="button" @click="router.push('/chat')">返回对话</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMockAgentStore } from '@/stores/mockAgents'
import { t } from '@/i18n'
import { isGatewayDisconnectedMessage, normalizeIpcErrorMessage } from '@/utils/ipc-errors'

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

const route = useRoute()
const router = useRouter()
const mockAgentStore = useMockAgentStore()

const usageData = ref<UsageStats | null>(null)
const usageLoading = ref(false)
const usageError = ref('')
let unsubWsConnected: (() => void) | null = null

const requestedAgentId = computed(() => typeof route.params.agentId === 'string' ? route.params.agentId : '')

const agent = computed(() => {
  const directMatch = mockAgentStore.agents.find((item) => item.id === requestedAgentId.value)
  if (directMatch) return directMatch
  return mockAgentStore.agents.find((item) => item.id === mockAgentStore.selectedAgentId) ?? mockAgentStore.agents[0] ?? null
})

watchEffect(() => {
  const resolvedAgent = agent.value
  if (!resolvedAgent) return

  if (mockAgentStore.selectedAgentId !== resolvedAgent.id) {
    mockAgentStore.selectAgent(resolvedAgent.id)
  }

  if (requestedAgentId.value !== resolvedAgent.id) {
    void router.replace(`/profile/${resolvedAgent.id}`)
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
    name,
    requests: 0,
    promptTokens: 0,
    completionTokens: 0,
    spend,
  }))
})

const summaryCards = computed(() => {
  if (!usageData.value) return []

  const cards = [
    { label: t('settings.totalTokens'), value: formatInteger(usageData.value.totalTokens), meta: t('settings.tokenUsage30d'), tone: 'primary' },
    { label: t('settings.inputTokens'), value: formatInteger(usageData.value.totalPromptTokens), meta: 'Prompt', tone: 'neutral' },
    { label: t('settings.outputTokens'), value: formatInteger(usageData.value.totalCompletionTokens), meta: 'Completion', tone: 'neutral' },
    { label: t('settings.messageCount'), value: formatInteger(usageData.value.totalRequests), meta: 'Requests', tone: 'neutral' },
  ]

  if (typeof usageData.value.sessionCount === 'number') {
    cards.push({ label: t('settings.sessionCount'), value: formatInteger(usageData.value.sessionCount), meta: 'Active history', tone: 'neutral' })
  }

  if (typeof usageData.value.toolCalls === 'number') {
    cards.push({ label: t('settings.toolCalls'), value: formatInteger(usageData.value.toolCalls), meta: 'Tooling', tone: 'neutral' })
  }

  return cards
})

const budgetProgress = computed(() => {
  if (!usageData.value?.maxBudget) return 0
  return Math.min(100, (usageData.value.totalSpend / usageData.value.maxBudget) * 100)
})

const totalSpendDisplay = computed(() => {
  if (usageData.value) return `$${usageData.value.totalSpend.toFixed(4)}`
  if (usageLoading.value) return '加载中…'
  return '—'
})

function formatInteger(value: number | undefined): string {
  return Number(value ?? 0).toLocaleString()
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
  } catch (err: any) {
    const message = normalizeIpcErrorMessage(err, t('settings.usageLoadFailed'))
    usageError.value = isGatewayDisconnectedMessage(message)
      ? t('settings.usageGatewayDisconnected')
      : message
    usageData.value = null
  } finally {
    usageLoading.value = false
  }
}

function goBackToChat() {
  if (agent.value) {
    mockAgentStore.selectAgent(agent.value.id)
  }
  router.push('/chat')
}

function openUsageSettings() {
  router.push('/settings/usage')
}

onMounted(() => {
  unsubWsConnected = window.openclaw.gateway.onWsConnected(() => {
    if (!usageLoading.value) {
      void loadUsage()
    }
  })

  void loadUsage()
})

onUnmounted(() => {
  unsubWsConnected?.()
})
</script>

<style scoped>
.profile-view {
  height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(circle at top left, rgba(74, 144, 217, 0.08), transparent 32%),
    radial-gradient(circle at top right, rgba(255, 177, 66, 0.10), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(250, 247, 244, 0.96));
}

html.dark .profile-view {
  background:
    radial-gradient(circle at top left, rgba(74, 144, 217, 0.18), transparent 32%),
    radial-gradient(circle at top right, rgba(255, 177, 66, 0.16), transparent 28%),
    linear-gradient(180deg, rgba(17, 19, 24, 0.96), rgba(12, 15, 20, 0.98));
}

.profile-shell {
  max-width: 1120px;
  margin: 0 auto;
  padding: 28px 32px 40px;
}

.profile-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.profile-toolbar__button,
.profile-toolbar__link,
.profile-panel__retry {
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
}

.profile-toolbar__button {
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.84);
  color: var(--text-primary);
  box-shadow: 0 8px 26px rgba(32, 41, 50, 0.08);
}

.profile-toolbar__link {
  padding: 10px 16px;
  background: transparent;
  color: var(--accent);
}

.profile-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 18px;
  margin-bottom: 18px;
}

.profile-agent-card,
.profile-spend-card,
.profile-panel,
.profile-stat-card {
  border: 1px solid rgba(18, 24, 32, 0.06);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 40px rgba(32, 41, 50, 0.08);
  backdrop-filter: blur(12px);
}

.profile-agent-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  border-radius: 28px;
}

.profile-agent-card__avatar {
  width: 92px;
  height: 92px;
  border-radius: 28px;
  overflow: hidden;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  position: relative;
  box-shadow: 0 14px 28px rgba(32, 41, 50, 0.12);
}

.profile-agent-card__avatar::before {
  content: '';
  position: absolute;
  inset: 0;
}

.profile-agent-card__avatar--aurora::before { background: radial-gradient(ellipse 90% 70% at 25% 30%, #9a7fff 0%, transparent 55%), radial-gradient(ellipse 70% 90% at 75% 70%, #e050e0 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 55% 20%, #ffaa44 0%, transparent 60%), #a060f0; }
.profile-agent-card__avatar--ember::before  { background: radial-gradient(ellipse 85% 65% at 20% 25%, #ff4040 0%, transparent 55%), radial-gradient(ellipse 65% 85% at 75% 65%, #ff8010 0%, transparent 55%), radial-gradient(ellipse 70% 55% at 55% 80%, #ffd030 0%, transparent 60%), #ff6020; }
.profile-agent-card__avatar--sage::before   { background: radial-gradient(ellipse 80% 70% at 30% 25%, #20c060 0%, transparent 55%), radial-gradient(ellipse 70% 80% at 70% 70%, #60e070 0%, transparent 55%), radial-gradient(ellipse 75% 55% at 60% 15%, #ccf020 0%, transparent 60%), #40b850; }
.profile-agent-card__avatar--dusk::before   { background: radial-gradient(ellipse 85% 65% at 25% 30%, #9940ff 0%, transparent 55%), radial-gradient(ellipse 65% 85% at 72% 68%, #ff40a0 0%, transparent 55%), radial-gradient(ellipse 70% 55% at 50% 80%, #ffb030 0%, transparent 60%), #cc40c0; }
.profile-agent-card__avatar--ocean::before  { background: radial-gradient(ellipse 80% 70% at 25% 28%, #0090ff 0%, transparent 55%), radial-gradient(ellipse 70% 85% at 72% 65%, #10d8b0 0%, transparent 55%), radial-gradient(ellipse 75% 55% at 55% 80%, #70ff60 0%, transparent 60%), #10a0e0; }
.profile-agent-card__avatar--gold::before   { background: radial-gradient(ellipse 100% 90% at 30% 30%, #ffe000 0%, #ffcc00 45%, transparent 72%), radial-gradient(ellipse 55% 65% at 80% 70%, #ff6090 0%, transparent 45%), radial-gradient(ellipse 55% 45% at 55% 88%, #ff3060 0%, transparent 45%), #e0a000; }
.profile-agent-card__avatar--rose::before   { background: radial-gradient(ellipse 85% 65% at 22% 28%, #ff2020 0%, transparent 55%), radial-gradient(ellipse 65% 85% at 72% 65%, #ff3800 0%, transparent 55%), radial-gradient(ellipse 70% 55% at 50% 80%, #ff8010 0%, transparent 60%), #ff3010; }

.profile-agent-card__image {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-agent-card__initial {
  position: relative;
  z-index: 1;
  color: rgba(255, 255, 255, 0.9);
  font-size: 34px;
  font-weight: 600;
}

.profile-agent-card__copy {
  min-width: 0;
}

.profile-agent-card__eyebrow {
  display: inline-block;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}

.profile-agent-card__title {
  margin: 0;
  font-size: 32px;
  line-height: 1.05;
  color: var(--text-primary);
}

.profile-agent-card__desc {
  margin: 10px 0 0;
  max-width: 520px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.profile-agent-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.profile-badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(74, 144, 217, 0.12);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}

.profile-spend-card {
  border-radius: 24px;
  padding: 22px 22px 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.profile-spend-card__label {
  font-size: 12px;
  color: var(--text-muted);
}

.profile-spend-card__value {
  display: block;
  margin-top: 10px;
  font-size: 32px;
  line-height: 1;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.profile-spend-card__note {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.profile-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.profile-stat-card {
  padding: 18px 18px 16px;
  border-radius: 20px;
}

.profile-stat-card--primary {
  background: linear-gradient(135deg, rgba(74, 144, 217, 0.16), rgba(255, 255, 255, 0.88));
}

.profile-stat-card__label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.profile-stat-card__value {
  display: block;
  margin-top: 12px;
  font-size: 28px;
  line-height: 1;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.profile-stat-card__meta {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.profile-panel {
  border-radius: 24px;
  padding: 20px 22px;
  margin-bottom: 18px;
}

.profile-panel--state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.profile-panel__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.profile-panel__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.profile-panel__caption,
.profile-panel__value,
.profile-panel__empty {
  font-size: 12px;
  color: var(--text-secondary);
}

.profile-panel__retry {
  padding: 8px 14px;
  background: var(--text-primary);
  color: var(--bg-secondary);
}

.profile-budget-bar {
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(18, 24, 32, 0.08);
}

.profile-budget-bar__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4a90d9, #ffb142);
}

.profile-model-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.profile-model-card {
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(18, 24, 32, 0.04);
}

.profile-model-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.profile-model-card__name,
.profile-model-card__spend {
  color: var(--text-primary);
}

.profile-model-card__name {
  font-size: 14px;
}

.profile-model-card__spend {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.profile-model-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-secondary);
}

.profile-footnote {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.profile-empty {
  height: 100%;
  display: grid;
  place-items: center;
  gap: 12px;
  color: var(--text-secondary);
}

html.dark .profile-agent-card,
html.dark .profile-spend-card,
html.dark .profile-panel,
html.dark .profile-stat-card {
  border-color: rgba(255, 255, 255, 0.06);
  background: rgba(18, 24, 32, 0.76);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.26);
}

html.dark .profile-toolbar__button {
  background: rgba(18, 24, 32, 0.76);
}

html.dark .profile-stat-card--primary {
  background: linear-gradient(135deg, rgba(74, 144, 217, 0.26), rgba(18, 24, 32, 0.86));
}

html.dark .profile-model-card {
  background: rgba(255, 255, 255, 0.05);
}

html.dark .profile-budget-bar {
  background: rgba(255, 255, 255, 0.08);
}

@media (max-width: 980px) {
  .profile-shell {
    padding: 22px 18px 28px;
  }

  .profile-hero {
    grid-template-columns: 1fr;
  }

  .profile-stats-grid,
  .profile-model-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .profile-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .profile-agent-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .profile-stats-grid,
  .profile-model-list {
    grid-template-columns: 1fr;
  }

  .profile-panel--state {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>