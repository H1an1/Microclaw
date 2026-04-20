<template>
  <div class="new-agent-view">

    <!-- Top bar -->
    <div class="topbar">
      <div class="topbar__heading">
        <h1 class="topbar__title">热门专家</h1>
      </div>
      <button class="customize-btn" @click="handleCustomize">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        自定义 Agent
      </button>
    </div>

    <!-- Agent grid -->
    <div class="agent-grid">
      <div
        v-for="preset in specialists"
        :key="preset.id"
        class="agent-card"
        :class="{ 'agent-card--added': isAdded(preset.id) }"
        @click="handleSelect(preset)"
      >
        <!-- Illustration -->
        <div class="agent-card__img-area">
          <img v-if="preset.cardImage" :src="preset.cardImage" class="agent-card__img" />
          <div v-else class="agent-card__initial">{{ preset.initial }}</div>
          <div v-if="isAdded(preset.id)" class="added-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>

        <!-- Card body -->
        <div class="agent-card__body">
          <div class="agent-card__name">{{ preset.name }}</div>
          <div class="agent-card__desc">{{ preset.description }}</div>
          <div class="agent-card__tags">
            <span v-for="tag in AGENT_TAGS[preset.id] ?? []" :key="tag" class="agent-tag">{{ tag }}</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="agent-card__footer">
          <span v-if="isAdded(preset.id)" class="footer-added">已添加</span>
          <button v-else class="footer-add">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            添加
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useMockAgentStore, ALL_PRESETS, type MockAgent } from '@/stores/mockAgents'

const router = useRouter()
const store = useMockAgentStore()

const specialists = ALL_PRESETS.slice(1)

const AGENT_TAGS: Record<string, string[]> = {
  xiaohongshu: ['内容策划', '数据分析', '爆款文案'],
  jinqianbao:  ['股票分析', '行情复盘', '持仓管理'],
  codeMonkey:  ['代码开发', '调试优化', '代码审查'],
  vangogh:     ['插画创作', '风格分析', '场景设计'],
  tianluo:     ['生活规划', '饮食建议', '出行安排'],
  singer:      ['歌词创作', '编曲灵感', '风格分析'],
}

function isAdded(id: string): boolean {
  return !!store.agents.find(a => a.id === id)
}

function handleSelect(preset: MockAgent) {
  if (isAdded(preset.id)) {
    store.selectAgent(preset.id)
    router.push(`/chat/${preset.id}`)
    return
  }
  store.addAgent(preset)
  router.push(`/chat/${preset.id}`)
}

function handleCustomize() {
  // placeholder — future custom agent creation flow
}
</script>

<style scoped>
.new-agent-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow-y: auto;
  padding: 28px 36px 40px;
}

/* ── Top bar ── */
.topbar {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 32px;
  flex-shrink: 0;
}

.back-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 2px;
  transition: background 0.12s, color 0.12s;
}

.back-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.topbar__heading {
  flex: 1;
}

.topbar__title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.025em;
  line-height: 1.2;
  margin: 0 0 5px;
}

.topbar__sub {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}

.customize-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.customize-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* ── Grid ── */
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 16px;
}

/* ── Card ── */
.agent-card {
  border-radius: 18px;
  border: 0.5px solid var(--border);
  background: var(--bg-tertiary);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: background 0.15s, box-shadow 0.2s, transform 0.2s;
}

.agent-card:hover {
  background: #ede8e4;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.07), 0 1px 4px rgba(0, 0, 0, 0.04);
  transform: translateY(-2px);
}

html.dark .agent-card:hover {
  background: var(--bg-secondary);
}

.agent-card--added {
  opacity: 0.65;
}

.agent-card--added:hover {
  opacity: 1;
}

/* ── Illustration ── */
.agent-card__img-area {
  position: relative;
  height: 200px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
}

.agent-card__img {
  width: 200px;
  height: 200px;
  object-fit: contain;
  object-position: bottom center;
  flex-shrink: 0;
}

.agent-card__initial {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: grid;
  place-items: center;
  font-size: 30px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 20px;
}

.added-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(52, 199, 89, 0.9);
  color: #fff;
  display: grid;
  place-items: center;
}

/* ── Body ── */
.agent-card__body {
  padding: 12px 16px 8px;
  margin-top: -20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  z-index: 1;
}

.agent-card__name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.agent-card__desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.agent-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}

.agent-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: var(--text-muted);
  background: rgba(18, 24, 32, 0.05);
  border: 1px solid var(--border);
}

html.dark .agent-tag {
  background: rgba(255, 255, 255, 0.06);
}

/* ── Footer ── */
.agent-card__footer {
  padding: 10px 16px 16px;
}

.footer-added {
  font-size: 12px;
  color: #34c759;
  font-weight: 500;
}

.footer-add {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.agent-card:hover .footer-add {
  background: #1a1a1a;
  border-color: transparent;
  color: #fff;
}
</style>
