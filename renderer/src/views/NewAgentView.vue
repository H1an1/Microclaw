<template>
  <div class="new-agent-view">
    <div class="new-agent-content">
      <h1 class="new-agent-heading">新建 Agent</h1>
      <p class="new-agent-sub">选择一个 Agent 类型添加到工作台</p>

      <div class="fan-container" v-if="store.availablePresets.length > 0">
        <div
          v-for="(preset, index) in store.availablePresets"
          :key="preset.id"
          class="fan-card"
          :style="{
            '--rot': `${rotations[index]}deg`,
            'z-index': zIndices[index],
          }"
          @click="handleSelect(preset)"
        >
          <div class="fan-card-avatar">
            <div class="agent-avatar-large" :class="`agent-avatar--${preset.gradient}`">
              <span class="agent-avatar-initial">{{ preset.initial }}</span>
            </div>
          </div>
          <div class="fan-card-body">
            <div class="fan-card-name">{{ preset.name }}</div>
            <div class="fan-card-desc">{{ preset.description }}</div>
          </div>
        </div>
      </div>

      <div v-else class="all-added">所有 Agent 已添加完毕</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMockAgentStore, type MockAgent } from '@/stores/mockAgents'

const router = useRouter()
const store = useMockAgentStore()

// Dynamic rotation angles — evenly spread, symmetric around 0
const rotations = computed(() => {
  const n = store.availablePresets.length
  if (n === 0) return []
  if (n === 1) return [0]
  const spread = Math.min(26, (n - 1) * 9)
  const step = (spread * 2) / (n - 1)
  return Array.from({ length: n }, (_, i) => -spread + i * step)
})

// Center card has highest z-index
const zIndices = computed(() => {
  const n = store.availablePresets.length
  const mid = (n - 1) / 2
  return Array.from({ length: n }, (_, i) =>
    n - Math.round(Math.abs(i - mid))
  )
})

function handleSelect(preset: MockAgent) {
  store.addAgent(preset)
  router.push('/chat')
}
</script>

<style scoped>
.new-agent-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.new-agent-content {
  flex: 1;
  overflow: hidden;
  padding: 44px 48px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.new-agent-heading {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  margin-bottom: 6px;
}

.new-agent-sub {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 48px;
}

/* ── Fan container ── */
.fan-container {
  position: relative;
  width: 100%;
  max-width: 800px;
  height: 380px;
  flex-shrink: 0;
}

/* ── Individual fan card ── */
.fan-card {
  position: absolute;
  left: 50%;
  bottom: 40px;
  width: 168px;
  height: 258px;
  margin-left: -84px;
  transform-origin: center bottom;
  transform: rotate(var(--rot));
  transition: transform 0.28s cubic-bezier(0.34, 1.5, 0.64, 1),
              box-shadow 0.28s ease;
  cursor: pointer;

  background: #fdfcfb;
  border-radius: 20px;
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.10), 0 1px 4px rgba(0, 0, 0, 0.06);

  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px 20px;
  gap: 0;
}

.fan-card:hover {
  transform: rotate(var(--rot)) translateY(-38px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.14), 0 4px 10px rgba(0, 0, 0, 0.08);
  z-index: 100 !important;
}

/* ── Avatar ── */
.fan-card-avatar {
  flex-shrink: 0;
  margin-bottom: 18px;
}

.agent-avatar-large {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
}

.agent-avatar-large::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
}

.agent-avatar-large::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: white;
  filter: url(#grain);
  opacity: 0.5;
  mix-blend-mode: multiply;
}

.agent-avatar--rose::before   { background: radial-gradient(ellipse 80% 70% at 28% 30%, #ff5050 0%, transparent 58%), radial-gradient(ellipse 65% 80% at 72% 68%, #ff80a0 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 55% 85%, #ff3858 0%, transparent 50%), #e83848; }
.agent-avatar--gold::before   { background: radial-gradient(ellipse 100% 90% at 30% 30%, #ffe000 0%, #ffcc00 45%, transparent 72%), radial-gradient(ellipse 55% 65% at 80% 70%, #ff6090 0%, transparent 45%), radial-gradient(ellipse 55% 45% at 55% 88%, #ff3060 0%, transparent 45%), #e0a000; }
.agent-avatar--ocean::before  { background: radial-gradient(ellipse 85% 70% at 25% 28%, #0088ff 0%, transparent 55%), radial-gradient(ellipse 70% 85% at 72% 65%, #10d8b0 0%, transparent 55%), radial-gradient(ellipse 75% 55% at 55% 80%, #60f050 0%, transparent 60%), #1098d8; }
.agent-avatar--aurora::before { background: radial-gradient(ellipse 90% 70% at 25% 30%, #9060f8 0%, transparent 55%), radial-gradient(ellipse 70% 90% at 75% 70%, #d850d0 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 55% 20%, #f090a0 0%, transparent 60%), #9858e8; }
.agent-avatar--sage::before   { background: radial-gradient(ellipse 85% 70% at 28% 28%, #18c058 0%, transparent 55%), radial-gradient(ellipse 70% 85% at 70% 68%, #50d868 0%, transparent 55%), radial-gradient(ellipse 75% 55% at 55% 82%, #c0f020 0%, transparent 60%), #38b848; }

.agent-avatar-initial {
  position: relative;
  z-index: 1;
  font-size: 34px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: -0.02em;
  line-height: 1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

/* ── Card text ── */
.fan-card-body {
  text-align: center;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.fan-card-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  margin-bottom: 7px;
}

.fan-card-desc {
  font-size: 11.5px;
  color: var(--text-secondary);
  line-height: 1.55;
}

.all-added {
  margin-top: 80px;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
