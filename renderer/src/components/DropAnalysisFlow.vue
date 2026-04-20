<template>
  <div class="drop-flow chat-group assistant">
    <!-- Avatar -->
    <div class="chat-agent-avatar">
      <img :src="agentAvatarImg" class="chat-agent-avatar-img" />
    </div>

    <div class="chat-group-messages">
      <!-- File card -->
      <div class="drop-card">
        <span class="drop-card__icon">{{ primaryTarget.isDirectory ? '📁' : fileIcon(primaryTarget.name) }}</span>
        <div class="drop-card__meta">
          <div class="drop-card__name">{{ primaryTarget.name }}</div>
          <div class="drop-card__path">{{ primaryTarget.path }}</div>
        </div>
      </div>

      <!-- Thinking panel -->
      <div
        class="thinking-panel"
        :class="[phase === 'result' ? 'thinking-panel--done' : 'thinking-panel--streaming', { open: thinkingOpen }]"
      >
        <div
          class="thinking-panel__header"
          :class="{ 'thinking-panel__header--muted': phase !== 'result' }"
          @click="phase === 'result' && (thinkingOpen = !thinkingOpen)"
        >
          <svg class="thinking-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span class="thinking-label">{{ phase === 'result' ? '分析完成' : '思考中…' }}</span>
        </div>
        <transition name="thinking-slide">
          <div v-if="thinkingOpen" class="thinking-body" :class="{ 'thinking-body--streaming': phase !== 'result' }">
            <div class="thinking-timeline">
              <div
                v-for="(step, i) in visibleSteps"
                :key="i"
                class="thinking-step"
                :class="{ 'thinking-step--active': i === visibleSteps.length - 1 && phase === 'thinking' }"
              >
                <span class="thinking-step__dot"></span>
                <span class="thinking-step__text">{{ step }}</span>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- Result bubble + options -->
      <transition name="result-fade">
        <div v-if="phase === 'result'">
          <div class="chat-bubble assistant">
            <div class="chat-text" v-html="resultText"></div>
          </div>
          <div class="drop-options">
            <button
              v-for="opt in options"
              :key="opt.label"
              class="drop-option"
              type="button"
              @click="pick(opt)"
            >
              <span class="drop-option__icon">{{ opt.icon }}</span>
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDropAnalysisStore, type DropTarget } from '@/stores/dropAnalysis'
import agentAvatarImg from '@/assets/normal.png'

const emit = defineEmits<{
  pick: [text: string]
}>()

const store = useDropAnalysisStore()

const primaryTarget = computed<DropTarget>(() =>
  store.targets[0] ?? { path: '', name: '未知文件', isDirectory: false }
)

const isDir = computed(() => primaryTarget.value.isDirectory)

const FOLDER_STEPS = [
  '正在读取文件夹结构…',
  '识别文件类型和数量…',
  '分析文档内容和使用场景…',
  '生成操作建议…',
]

const FILE_STEPS = [
  '正在读取文件内容…',
  '识别格式和基本信息…',
  '分析文档结构和关键信息…',
  '生成操作建议…',
]

const FOLDER_RESULT = '这是一个<strong>项目工作区</strong>，里面可能有报告、数据和素材文件。你想让我做什么？'
const FILE_RESULT = '这是一份<strong>文档文件</strong>，我可以帮你分析、整理或转化它的内容。你想让我做什么？'

const FOLDER_OPTIONS = [
  { icon: '📋', label: '整理并归类', prompt: '帮我整理和归类这个文件夹里的所有文件' },
  { icon: '📝', label: '提取关键信息', prompt: '提取这个文件夹里文档的关键信息' },
  { icon: '📊', label: '生成内容摘要', prompt: '为这个文件夹里的内容生成一份摘要' },
  { icon: '🔍', label: '搜索特定内容', prompt: '在这个文件夹里帮我搜索' },
  { icon: '✍️', label: '帮我写个报告', prompt: '基于这个文件夹的内容帮我写一份报告' },
]

const FILE_OPTIONS = [
  { icon: '📝', label: '提取重点', prompt: '提取这份文档的重点内容' },
  { icon: '🌐', label: '翻译内容', prompt: '把这份文档翻译成中文' },
  { icon: '💬', label: '问它问题', prompt: '我想问这份文档一些问题：' },
  { icon: '✏️', label: '改写润色', prompt: '帮我改写和润色这份文档' },
  { icon: '🗂️', label: '生成大纲', prompt: '为这份文档生成一份大纲' },
]

const steps = computed(() => isDir.value ? FOLDER_STEPS : FILE_STEPS)
const resultText = computed(() => isDir.value ? FOLDER_RESULT : FILE_RESULT)
const options = computed(() => isDir.value ? FOLDER_OPTIONS : FILE_OPTIONS)

const phase = ref<'thinking' | 'result'>('thinking')
const visibleSteps = ref<string[]>([])
const thinkingOpen = ref(false)

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    pdf: '📄', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊',
    pptx: '📋', ppt: '📋', png: '🖼️', jpg: '🖼️', jpeg: '🖼️',
    mp4: '🎬', mp3: '🎵', zip: '🗜️', csv: '📊', txt: '📃',
  }
  return map[ext] ?? '📄'
}

function pick(opt: { label: string; prompt: string }) {
  emit('pick', opt.prompt)
  store.dismiss()
}

onMounted(() => {
  thinkingOpen.value = true
  const delays = [400, 1200, 2400, 3600]
  steps.value.forEach((step, i) => {
    setTimeout(() => {
      visibleSteps.value.push(step)
      if (i === steps.value.length - 1) {
        setTimeout(() => {
          phase.value = 'result'
          setTimeout(() => { thinkingOpen.value = false }, 380)
        }, 700)
      }
    }, delays[i])
  })
})
</script>

<style scoped>
.drop-flow {
  padding: 20px 20px 4px;
}

/* Mirror ChatView scoped layout styles */
.chat-group {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.chat-group-messages {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: min(720px, 85%);
}

.chat-bubble {
  position: relative;
  display: inline-block;
  max-width: 100%;
  word-wrap: break-word;
}

.chat-text {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
}

/* Mirror ChatView scoped avatar styles */
.chat-agent-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  margin-top: 2px;
}

.chat-agent-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

/* File card */
.drop-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  margin-bottom: 10px;
}

.drop-card__icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
}

.drop-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.drop-card__path {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 340px;
}

/* Option chips */
.drop-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.drop-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  font: inherit;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.12s;
}

.drop-option:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-strong, rgba(18, 24, 32, 0.18));
  transform: translateY(-1px);
}

.drop-option__icon {
  font-size: 14px;
  line-height: 1;
}

.result-fade-enter-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.result-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

/* Mirror thinking-slide transition from ChatView */
.thinking-slide-enter-active,
.thinking-slide-leave-active {
  transition: max-height 0.22s ease, opacity 0.22s ease;
  overflow: hidden;
}

.thinking-slide-enter-from,
.thinking-slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.thinking-slide-enter-to,
.thinking-slide-leave-from {
  max-height: 400px;
  opacity: 1;
}

/* Mirror thinking panel styles from ChatView */
.thinking-panel {
  border-radius: 10px;
  margin-bottom: 10px;
  overflow: hidden;
}

.thinking-panel--streaming {
  border: 1px solid transparent;
}

.thinking-panel--done {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
}

.thinking-panel__header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s;
}

.thinking-panel__header--muted,
.thinking-panel__header--muted .thinking-chevron,
.thinking-panel__header--muted .thinking-label {
  color: var(--text-muted);
  cursor: default;
}

.thinking-panel__header:not(.thinking-panel__header--muted):hover {
  background: var(--bg-tertiary);
}

.thinking-chevron {
  color: var(--text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.thinking-panel.open .thinking-chevron {
  transform: rotate(90deg);
}

.thinking-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.thinking-body {
  padding: 10px 16px 14px;
  border-top: 1px solid var(--border);
}

.thinking-body--streaming {
  padding: 4px 16px 10px;
  border-top: none;
}

.thinking-timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.thinking-step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.65;
}

.thinking-step__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}

.thinking-step--active .thinking-step__dot {
  background: #e8533a;
  animation: exec-dot-pulse 1.2s ease-in-out infinite;
}

.thinking-step__text {
  flex: 1;
}

@keyframes exec-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}
</style>
