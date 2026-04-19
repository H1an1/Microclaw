<template>
  <div class="chat-view">
    <!-- Chat thread -->
    <div class="chat-thread" ref="threadRef" @scroll="handleScroll" @click="handleThreadClick">
      <!-- Loading (only shown on initial load, not background refresh) -->
      <div v-if="!isDemoMode && chatStore.loading && chatStore.messages.length === 0" class="chat-empty">
        <div class="chat-empty__hint">{{ t('chat.loading') }}</div>
      </div>

      <!-- Welcome state: empty session, no prior history → fan cards + greeting -->
      <ChatWelcome v-else-if="showWelcomeState" mode="hero" @select="handleWelcomeSelect" />

      <!-- Mock demo conversation (shown after user sends in demo mode) -->
      <div v-else-if="isDemoMode && hasDemoMessages" class="mock-chat">
        <!-- User message -->
        <div class="chat-group user" :data-task-id="lastDemoTaskId">
          <div class="chat-group-messages">
            <div class="chat-bubble user">
              <div class="chat-text chat-text--user">我老家的闺蜜这周末来找我玩，给我推荐几个CIty Walk的路线。</div>
            </div>
          </div>
        </div>

        <!-- Assistant response -->
        <div class="chat-group assistant">
          <div class="chat-agent-avatar"><img :src="agentAvatarImg" class="chat-agent-avatar-img" /></div>
          <div class="chat-group-messages">

            <!-- Emoji reaction while planning -->
            <transition name="emoji-fade">
              <div v-if="showEmojiReaction" class="emoji-reaction">
                <img :src="emojiList[emojiIndex]" class="emoji-video" />
              </div>
            </transition>

            <!-- 思考过程 -->
            <div v-if="!thinkingDone || thinkingSteps.length > 0" class="thinking-panel" :class="{ 'thinking-panel--done': thinkingDone, 'thinking-panel--streaming': !thinkingDone, open: thinkingOpen }">
              <div class="thinking-panel__header" :class="{ 'thinking-panel__header--muted': !thinkingDone }" @click="thinkingDone && (thinkingOpen = !thinkingOpen)">
                <svg class="thinking-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                <span class="thinking-label">思考过程</span>
                <span class="thinking-duration">3s</span>
              </div>
              <transition name="thinking-slide">
                <div v-if="thinkingOpen" class="thinking-body" :class="{ 'thinking-body--streaming': !thinkingDone }">
                  <div class="thinking-timeline">
                    <div v-for="(step, i) in thinkingSteps" :key="i" class="thinking-step">
                      <span class="thinking-step__dot"></span>
                      <span class="thinking-step__text">{{ step }}</span>
                    </div>
                    <div v-if="thinkingCurrent" class="thinking-step thinking-step--active">
                      <span class="thinking-step__dot"></span>
                      <span class="thinking-step__text">{{ thinkingCurrent }}</span>
                    </div>
                  </div>
                </div>
              </transition>
            </div>

            <!-- 正式方案 -->
            <div v-if="thinkingDone" class="chat-bubble assistant">
              <div class="chat-text" v-html="renderMarkdown(mockItinerary)"></div>
            </div>

            <!-- 授权发送到手机 -->
            <div v-if="thinkingDone" class="phone-auth-card">
              <div class="phone-auth-card__text">要不要把行程发到你的手机上？不仅随时都能打开查看，连上手机后，你也可以随时在手机端继续控制 MicroClaw。🤔</div>
              <div class="phone-auth-card__actions">
                <button class="phone-auth-btn phone-auth-btn--deny">不用了</button>
                <button class="phone-auth-btn phone-auth-btn--confirm">好的，发送</button>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- All message groups (Electron only) -->
      <template v-if="!isDemoMode" v-for="(group, gi) in groupedMessages" :key="group.key">
        <div class="chat-group" :class="group.normalizedRole">
          <div v-if="group.normalizedRole === 'assistant'" class="chat-agent-avatar">A</div>
          <div class="chat-group-messages">
            <!-- Completed tool calls panel (from completedToolCallsMap) -->
            <div v-if="group.normalizedRole === 'assistant' && getCompletedToolCalls(gi)" class="exec-panel exec-panel--history" style="margin-bottom: 8px">
              <div class="exec-panel__header" @click="toggleHistoryPanel('completed-' + gi)">
                <span class="exec-panel__toggle">
                  <svg :class="{ rotated: isHistoryPanelOpen('completed-' + gi) }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
                <span class="exec-panel__title">{{ t('chat.executionSteps') }}</span>
                <span class="exec-panel__count">{{ getCompletedToolCalls(gi)!.length }}</span>
              </div>
              <transition name="exec-slide">
                <div v-if="isHistoryPanelOpen('completed-' + gi)" class="exec-panel__body">
                  <div v-for="tool in getCompletedToolCalls(gi)!" :key="tool.id" class="exec-step done" :class="{ 'exec-step--error': tool.isError }">
                    <span class="exec-step__icon">
                      <svg v-if="!tool.isError" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    </span>
                    <span class="exec-step__name">{{ tool.name }}</span>
                    <span v-if="tool.input" class="exec-step__meta">{{ tool.input }}</span>
                    <span v-if="tool.actualCommand && tool.actualCommand !== tool.input" class="exec-step__actual">⮡ {{ tool.actualCommand }}</span>
                    <span v-if="tool.result" class="exec-step__result" :class="{ 'exec-step__result--error': tool.isError }">{{ tool.result }}</span>
                  </div>
                </div>
              </transition>
            </div>

            <div
              v-for="(msg, idx) in group.messages"
              :key="group.key + '-' + idx"
              class="chat-bubble"
              :class="[
                group.normalizedRole,
                { 'has-copy': group.normalizedRole === 'assistant' },
                { 'editable': group.normalizedRole === 'user' && !isEditingMessage(group, idx) },
              ]"
              @dblclick.prevent="group.normalizedRole === 'user' && !isEditingMessage(group, idx) && startEditMessage(group, idx)"
            >
              <button
                v-if="group.normalizedRole === 'assistant'"
                class="chat-copy-btn"
                @click="copyMessage(getMessageText(msg))"
                :title="copyTooltip"
              >
                {{ justCopied ? '✓' : '' }}<svg v-if="!justCopied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <!-- Tool use from server history (if server ever returns them) -->
              <div v-if="isToolUse(msg)" class="exec-panel exec-panel--history">
                <div class="exec-panel__header" @click="toggleHistoryPanel(group.key + '-' + idx)">
                  <span class="exec-panel__toggle">
                    <svg :class="{ rotated: isHistoryPanelOpen(group.key + '-' + idx) }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </span>
                  <span class="exec-panel__title">{{ t('chat.executionSteps') }}</span>
                  <span class="exec-panel__count">{{ getToolItems(msg).length }}</span>
                </div>
                <transition name="exec-slide">
                  <div v-if="isHistoryPanelOpen(group.key + '-' + idx)" class="exec-panel__body">
                    <div v-for="(tool, ti) in getToolItems(msg)" :key="ti" class="exec-step done">
                      <span class="exec-step__icon">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      </span>
                      <span class="exec-step__name">{{ tool.label }}</span>
                      <span v-if="tool.detail" class="exec-step__meta">{{ tool.detail }}</span>
                    </div>
                  </div>
                </transition>
              </div>
              <div
                v-else-if="group.normalizedRole === 'assistant'"
                class="chat-text"
                v-html="renderMarkdown(getMessageText(msg))"
              ></div>
              <!-- User message: editable on double-click -->
              <template v-else>
                <div
                  v-if="isEditingMessage(group, idx)"
                  class="chat-edit-wrapper"
                >
                  <textarea
                    ref="editInputRef"
                    class="chat-edit-input"
                    v-model="editText"
                    @keydown="handleEditKeydown"
                    rows="1"
                  ></textarea>
                  <div class="chat-edit-actions">
                    <button class="chat-edit-btn confirm" @click="confirmEdit" :title="t('chat.editConfirm')">
                      {{ t('chat.editConfirm') }}
                    </button>
                    <button class="chat-edit-btn cancel" @click="cancelEdit" :title="t('chat.editCancel')">
                      {{ t('chat.editCancel') }}
                    </button>
                  </div>
                </div>
                <div
                  v-else
                  class="chat-text chat-text--user"
                >
                  {{ getMessageText(msg) }}
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>

      <!-- Streaming group: exec panel + streaming text -->
      <div v-if="!isDemoMode && chatStore.streaming" class="chat-group assistant">
        <div class="chat-group-messages">
          <div v-if="chatStore.streamToolCalls.length > 0" class="exec-panel">
            <div class="exec-panel__header" @click="execPanelOpen = !execPanelOpen">
              <span class="exec-panel__toggle">
                <svg :class="{ rotated: execPanelOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </span>
              <span class="exec-panel__title">{{ t('chat.executionSteps') }}</span>
              <span class="exec-panel__count">{{ chatStore.streamToolCalls.length }}</span>
              <span v-if="hasRunningTools" class="exec-panel__spinner"></span>
            </div>
            <transition name="exec-slide">
              <div v-if="execPanelOpen" class="exec-panel__body">
                <div
                  v-for="tool in chatStore.streamToolCalls"
                  :key="tool.id"
                  class="exec-step"
                  :class="{ done: tool.done, 'exec-step--error': tool.isError }"
                >
                  <span class="exec-step__icon">
                    <svg v-if="tool.done && !tool.isError" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    <svg v-else-if="tool.isError" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    <svg v-else-if="tool.waitingPermission" class="exec-step__lock" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span v-else class="exec-step__dot"></span>
                  </span>
                  <span class="exec-step__name">{{ tool.name }}</span>
                  <span v-if="tool.input" class="exec-step__meta">{{ tool.input }}</span>
                  <span v-if="tool.actualCommand && tool.actualCommand !== tool.input" class="exec-step__actual">⮡ {{ tool.actualCommand }}</span>
                  <span v-if="tool.result" class="exec-step__result" :class="{ 'exec-step__result--error': tool.isError }">{{ tool.result }}</span>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <!-- Streaming text/dots (only during active streaming) -->
      <div v-if="!isDemoMode && chatStore.streaming" class="chat-group assistant">
        <div class="chat-agent-avatar">A</div>
        <div class="chat-group-messages">
          <div class="chat-bubble assistant streaming" v-if="chatStore.streamText">
            <div class="chat-text" v-html="renderMarkdown(chatStore.streamText)"></div>
          </div>
          <div v-else class="chat-bubble assistant chat-reading-indicator">
            <span class="chat-reading-dots">
              <span></span><span></span><span></span>
            </span>
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-if="!isDemoMode && chatStore.lastError" class="chat-error">{{ chatStore.lastError }}</div>
    </div>

    <!-- New messages indicator -->
    <button v-if="showNewMessages" class="chat-new-messages" @click="scrollToBottom">
      {{ t('chat.newMessages') }}
    </button>

    <!-- Compose area -->
    <div class="chat-compose">
      <!-- Suggestion chips: shown when returning user hasn't started current session -->
      <ChatWelcome v-if="showSuggestionChips" mode="chips" @select="applySuggestionPrompt" />

      <!-- Context chips: shown when demo conversation has content -->
      <div v-if="hasDemoMessages && returnedFromTab && thinkingDone" class="compose-context-chips">
        <button v-if="contextChipsScrolled" class="context-chips-arrow" @click="scrollContextChips(-1)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="context-chips-scroll" ref="contextChipsScrollRef" @scroll="onContextChipsScroll">
          <button class="compose-context-chip" v-for="chip in demoContextChips" :key="chip.label" @click="applyContextChip(chip.prompt)">
            {{ chip.label }}
          </button>
        </div>
        <button class="context-chips-arrow" @click="scrollContextChips(1)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="compose-wrapper">
        <textarea
          ref="inputRef"
          v-model="inputText"
          class="compose-input"
          :placeholder="composePlaceholder"
          @keydown="handleKeydown"
          @input="autoResize"
          rows="1"
          :disabled="!isDemoMode && !chatStore.wsConnected"
        ></textarea>
        <div class="compose-bottom">
          <button class="compose-plus" :title="t('chat.addAttachment')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button
            v-if="isStreaming"
            class="compose-stop"
            @click="handleAbort"
            :title="t('chat.stopGeneration')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          </button>
          <button
            v-else
            class="compose-send"
            :class="{ active: inputText.trim() && (isDemoMode || chatStore.wsConnected) }"
            @click="handleSend"
            :disabled="!inputText.trim()"
            :title="t('chat.send')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="chat-compose__hint">{{ t('chat.disclaimer') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onActivated, onDeactivated } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useChatStore } from "@/stores/chat";
import { useAgentStore } from "@/stores/agents";
import { useSessionStore } from "@/stores/sessions";
import { useMockAgentStore } from "@/stores/mockAgents";
import { useMvpTasks } from "@/composables/useMvpTasks";
import ChatWelcome from "@/components/ChatWelcome.vue";
import agentAvatarImg from "@/assets/normal.png";
import gifSearch from "@/assets/openclaw_search_preview_transparent.gif";
import gifBook from "@/assets/book.gif";
import gifBino from "@/assets/binoculars.gif";
import gifMap from "@/assets/map.gif";
import { renderMarkdown } from "@/utils/markdown";
import { t, locale } from "@/i18n";

const route = useRoute();
const _router = useRouter();
const chatStore = useChatStore();
const agentStore = useAgentStore();
const sessionStore = useSessionStore();
const mockAgentStore = useMockAgentStore();
const { addTask: addMvpTask, clearTasksForAgent, scrollRequestId, selectedTaskId, tasks: mvpTaskList } = useMvpTasks();
const CHAT_WELCOME_SEEN_KEY = "openclaw-chat-welcome-seen";

function readWelcomeSeen(): boolean {
  try {
    return localStorage.getItem(CHAT_WELCOME_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function persistWelcomeSeen(): void {
  try {
    localStorage.setItem(CHAT_WELCOME_SEEN_KEY, "1");
  } catch {
    // ignore storage failures
  }
}

const isDemoMode = computed(() => !chatStore.wsConnected)
const isStreaming = computed(() => isDemoMode.value ? !thinkingDone.value : chatStore.streaming)

// Track whether user has sent a message in current demo "session"
const hasDemoMessages = ref(false)
const lastDemoTaskId = ref<string | null>(null)
const returnedFromTab = ref(false)

onDeactivated(() => { if (hasDemoMessages.value) returnedFromTab.value = true })
onActivated(() => { nextTick(scrollToBottom) })
onMounted(() => { returnedFromTab.value = false })

// Track whether user has started a conversation in this view instance
// Once true, chips never reappear until user navigates away and comes back
const sessionStartedInView = ref(false)
const hasSeenWelcome = ref(readWelcomeSeen())
const shouldShowFirstVisitWelcome = ref(false)
const hasSavedHistory = computed(() =>
  sessionStore.sessions.some((session) => session.preview.trim().length > 0)
)

// Welcome state: show fan cards only before user has sent anything in this session
const showWelcomeState = computed(() => {
  if (isDemoMode.value) return !hasDemoMessages.value
  if (sessionStartedInView.value) return false
  if (!shouldShowFirstVisitWelcome.value) return false
  return chatStore.messages.length === 0 && !chatStore.streaming && !chatStore.sending
})

// Chips: only when re-opening a chat that already has history,
// and before the user starts a new message in this view instance
const showSuggestionChips = computed(() => {
  if (isDemoMode.value) return false
  if (sessionStartedInView.value) return false
  if (shouldShowFirstVisitWelcome.value) return false
  if (!hasSeenWelcome.value && !hasSavedHistory.value) return false
  return !chatStore.streaming && !chatStore.sending
})

const thinkingOpen = ref(false)
const thinkingDone = ref(true)
const showEmojiReaction = ref(false)
const emojiIndex = ref(0)
const emojiList = [gifSearch, gifBook, gifBino, gifMap]
let emojiTimer: ReturnType<typeof setInterval> | null = null
const thinkingSteps = ref<string[]>([])
const thinkingCurrent = ref('')
let demoAborted = false

const THINKING_STEPS = [
  '分析用户需求：闺蜜来访北京，希望推荐 City Walk 路线，偏休闲、适合两人慢慢逛。',
  '考虑因素：① 本周末北京天气多云转晴，气温适中，适合户外；② 避开午后暴晒，安排室内活动；③ 优先选地铁直达、步行友好的地点；④ 兼顾文化体验与生活气息。',
  '选点逻辑：颐和园（自然 + 历史，上午凉爽最宜）→ 国家博物馆（午后室内，避晒 + 有深度）→ 三里屯精品咖啡（周日慢节奏开场）→ 朝阳公园（傍晚散步，放松收尾）。',
  '交通串联：各点均地铁可达，无需打车，步行体验好。预算友好，整体节奏不赶。',
]

function stopDemoAnimation() {
  demoAborted = true
  if (emojiTimer) { clearInterval(emojiTimer); emojiTimer = null; }
  showEmojiReaction.value = false
  thinkingSteps.value = [...THINKING_STEPS]
  thinkingCurrent.value = ''
  thinkingDone.value = true
  thinkingOpen.value = false
}


const mockItinerary = `我根据你当前所在的城市（北京）和本周末的天气，帮你规划了一份轻松又好玩的周末行程～

📅 周六 · 城市轻探索

上午｜顺和园散步（9:00–11:30）
☁️ 天气凉爽，适合户外走走
🗺️ 推荐路线：东宫门 → 仁寿殿 → 昆明湖环湖
🚇 交通：地铁 4 号线北宫门站步行约 8 分钟
🧥 建议：湖边风大，记得带件薄外套

中午｜附近午餐（12:00–13:00）
🍛 推荐：南门附近的小馆子（京味家常菜）
💰 预算：人均 60–80 元

下午｜国家博物馆（14:00–16:30）
🏠 室内活动，避免午后暴晒
⏰ 建议提前预约入馆
🏛️ 推荐展区：古代中国、复兴之路

---

周日 · 放松与充电

上午｜咖啡馆阅读（10:00–12:00）
📍 推荐地点：三里屯附近精品咖啡店
🍵 适合放松一下，慢慢开启一天

下午｜逛公园 + 简单运动（14:00–16:00）
☘️ 推荐：朝阳公园
🚴 可选择散步、骑行或湖边休息
☀️ 天气晴朗，适合户外活动`

const inputText = ref("");
const inputRef = ref<HTMLTextAreaElement>();
const editInputRef = ref<HTMLTextAreaElement[]>();
const threadRef = ref<HTMLDivElement>();
const showNewMessages = ref(false);
const justCopied = ref(false);
const execPanelOpen = ref(true);
const openHistoryPanels = ref(new Set<string>());
let isUserScrolledUp = false;

// Reset demo state when agent changes (user switches to a different agent)
watch(scrollRequestId, (taskId) => {
  if (!taskId) return;
  nextTick(() => {
    const el = document.querySelector(`[data-task-id="${taskId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    scrollRequestId.value = null;
  });
});

watch(() => mockAgentStore.selectedAgentId, () => {
  lastDemoTaskId.value = null;
  hasDemoMessages.value = false
  sessionStartedInView.value = false
  thinkingSteps.value = []
  thinkingCurrent.value = ''
  thinkingDone.value = true
  thinkingOpen.value = false
  demoAborted = true
})

// When a task tab is clicked from the sidebar, restore the demo conversation view
watch(selectedTaskId, (taskId) => {
  if (!isDemoMode.value) return
  if (taskId && mvpTaskList.value.some(t => t.id === taskId)) {
    hasDemoMessages.value = true
    sessionStartedInView.value = true
    demoAborted = false
    nextTick(scrollToBottom)
  }
})

// Scroll to bottom when returning to a conversation with existing messages
onMounted(() => {
  if (!hasSeenWelcome.value && !hasSavedHistory.value) {
    shouldShowFirstVisitWelcome.value = true
    hasSeenWelcome.value = true
    persistWelcomeSeen()
  }
  if (chatStore.messages.length) {
    nextTick(scrollToBottom);
  }
});

// ── Edit-message state ──
const editingGroupKey = ref<string | null>(null);
const editingMsgIdx = ref<number>(-1);
const editText = ref("");

const hasRunningTools = computed(() =>
  chatStore.streamToolCalls.some((t) => !t.done)
);

/** Get completed tool calls for a specific assistant group index */
function getCompletedToolCalls(groupIndex: number): { id: string; name: string; input?: string; actualCommand?: string; result?: string; isError?: boolean }[] | null {
  const groups = groupedMessages.value;
  let assistantIdx = 0;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].normalizedRole === 'assistant') {
      if (i === groupIndex) {
        return chatStore.completedToolCallsMap[assistantIdx] || null;
      }
      assistantIdx++;
    }
  }
  return null;
}

function toggleHistoryPanel(key: string) {
  const next = new Set(openHistoryPanels.value);
  if (next.has(key)) next.delete(key); else next.add(key);
  openHistoryPanels.value = next;
}

function isHistoryPanelOpen(key: string): boolean {
  return openHistoryPanels.value.has(key);
}

// Auto-send when navigated here with a pending prompt.
watch(
  () => chatStore.pendingPrompt,
  (prompt) => {
    if (prompt) {
      inputText.value = prompt;
      chatStore.pendingPrompt = null;
      nextTick(() => {
        autoResize();
        handleSend();
      });
    }
  },
  { immediate: true }
);

const currentAgent = computed(() => {
  const agentId = (route.params.agentId as string) || agentStore.currentAgentId;
  return agentStore.agents.find((a) => a.id === agentId);
});

const sessionTitle = computed(() => {
  if (isDemoMode.value) {
    const selected = mockAgentStore.agents.find(a => a.id === mockAgentStore.selectedAgentId)
    return selected?.name || 'MicroClaw'
  }
  const s = sessionStore.sessions.find((s) => s.key === chatStore.sessionKey);
  return s?.title || currentAgent.value?.name || 'MicroClaw';
});


const composePlaceholder = computed(() => {
  if (isDemoMode.value) return t('chat.inputPlaceholder')
  return chatStore.wsConnected ? t('chat.inputPlaceholder') : t('chat.waitingGateway')
});

const copyTooltip = computed(() => (justCopied.value ? t('chat.copied') : t('chat.copy')));

// ── Extract text from a message (string content or content-block array) ──
function getMessageText(msg: unknown): string {
  const text = chatStore.extractText(msg) || "";
  return collapseInlineJson(text);
}

/** Wrap top-level inline JSON objects/arrays in a collapsible <details> block. */
function collapseInlineJson(text: string): string {
  const result: string[] = [];
  let i = 0;
  while (i < text.length) {
    // Skip content already inside code fences
    if (text.startsWith("```", i)) {
      const end = text.indexOf("```", i + 3);
      const fenceEnd = end === -1 ? text.length : end + 3;
      result.push(text.slice(i, fenceEnd));
      i = fenceEnd;
      continue;
    }
    const ch = text[i];
    if (ch === "{" || ch === "[") {
      let depth = 1;
      let inStr = false;
      let escaped = false;
      let j = i + 1;
      while (j < text.length && depth > 0) {
        const c = text[j];
        if (escaped) { escaped = false; j++; continue; }
        if (c === "\\") { escaped = true; j++; continue; }
        if (c === '"') { inStr = !inStr; j++; continue; }
        if (!inStr) {
          if (c === "{" || c === "[") depth++;
          else if (c === "}" || c === "]") depth--;
        }
        j++;
      }
      if (depth === 0) {
        const candidate = text.slice(i, j);
        try {
          const parsed = JSON.parse(candidate);
          if (typeof parsed === "object" && parsed !== null) {
            const pretty = JSON.stringify(parsed, null, 2);
            result.push(
              `\n<details class="json-collapse"><summary>📋 JSON</summary>\n\n\`\`\`json\n${pretty}\n\`\`\`\n</details>\n`
            );
            i = j;
            continue;
          }
        } catch { /* not valid JSON — fall through */ }
      }
    }
    result.push(text[i]);
    i++;
  }
  return result.join("").replace(/\n{3,}/g, "\n\n");
}

// ── Check if message is a tool use block ──
function isToolUse(msg: unknown): boolean {
  const m = msg as Record<string, unknown>;
  if (Array.isArray(m.content)) {
    return m.content.some((block: any) => block.type === "tool_use");
  }
  return false;
}

// ── Extract tool items for checklist display ──
function getToolItems(msg: unknown): { label: string; detail?: string; done: boolean }[] {
  const m = msg as Record<string, unknown>;
  if (!Array.isArray(m.content)) return [];
  return m.content
    .filter((block: any) => block.type === "tool_use")
    .map((block: any) => {
      const name = block.name || "tool";
      const input = block.input as Record<string, unknown> | undefined;
      let label = name;
      let detail: string | undefined;
      if (input) {
        // Synthetic tool_use messages store the formatted detail in _label
        if (typeof input._label === "string") {
          detail = input._label;
        } else if (name === "exec" && typeof input.command === "string") {
          detail = input.command;
        } else if ((name === "read" || name === "edit" || name === "write") && typeof input.path === "string") {
          label = `${name}("${input.path}")`;
        } else {
          const firstVal = Object.values(input).find((v) => typeof v === "string");
          if (typeof firstVal === "string") label = `${name}("${firstVal}")`;
        }
      }
      return { label, detail, done: true };
    });
}

// ── Normalize role for display ──
function normalizeRole(role: string): string {
  const lower = role.toLowerCase();
  if (lower === "user") return "user";
  if (lower === "assistant") return "assistant";
  return "assistant"; // system / tool results shown as assistant
}

// ── Group consecutive messages by role ──
interface MessageGroup {
  key: string;
  normalizedRole: string;
  messages: unknown[];
  timestamp: number;
}

const groupedMessages = computed<MessageGroup[]>(() => {
  const msgs = chatStore.messages;
  if (!msgs || msgs.length === 0) return [];

  const groups: MessageGroup[] = [];
  let current: MessageGroup | null = null;

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i] as Record<string, unknown>;
    const role = normalizeRole(typeof msg.role === "string" ? msg.role : "assistant");
    const ts = typeof msg.timestamp === "number" ? msg.timestamp : Date.now();

    if (!current || current.normalizedRole !== role) {
      current = {
        key: `group-${i}`,
        normalizedRole: role,
        messages: [msg],
        timestamp: ts,
      };
      groups.push(current);
    } else {
      current.messages.push(msg);
    }
  }
  return groups;
});

// ── Auto-scroll ──
watch(
  () => [chatStore.messages.length, chatStore.streamText],
  () => {
    if (!isUserScrolledUp) {
      nextTick(scrollToBottom);
    } else {
      showNewMessages.value = true;
    }
  }
);

function handleScroll() {
  const el = threadRef.value;
  if (!el) return;
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  isUserScrolledUp = !atBottom;
  if (atBottom) showNewMessages.value = false;
}

function scrollToBottom() {
  const el = threadRef.value;
  if (el) el.scrollTop = el.scrollHeight;
  showNewMessages.value = false;
  isUserScrolledUp = false;
}

function autoResize() {
  nextTick(() => {
    const el = inputRef.value;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    }
  });
}

function _formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(locale.value, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    handleSend();
  }
}

async function copyMessage(content: string) {
  try {
    await navigator.clipboard.writeText(content);
    justCopied.value = true;
    setTimeout(() => (justCopied.value = false), 1500);
  } catch {
    // Clipboard not available
  }
}

function handleWelcomeSelect(prompt: string) {
  if (isDemoMode.value) {
    inputText.value = prompt
    nextTick(() => { autoResize(); inputRef.value?.focus() })
  } else {
    inputText.value = prompt
    nextTick(() => {
      autoResize()
      handleSend()
    })
  }
}

const demoContextChips = [
  { label: "文档整理", prompt: "把今天下载的合同按客户名整理好，再给我一版摘要" },
  { label: "海报设计", prompt: "设计一个普拉提健康工作室海报，宁静、舒缓、禅意风格，采用流畅自然的有机设计。标题是五一促销。" },
  { label: "网页设计", prompt: "帮我设计一个简洁的个人作品集网页，深色背景，突出我的摄影作品，现代简约风格，包含首页、作品集和联系页。" },
  { label: "图片生成", prompt: "生成一张赛博朋克风格的城市夜景图，霓虹灯倒映在雨后街道，氛围感强烈，高清写实风格，尺寸 512×512。" },
  { label: "每日邮件总结", prompt: "整理我今天收到的所有邮件，按紧急程度分类，列出需要我回复的邮件，并给出简短的回复建议。" },
  { label: "运营文案", prompt: "帮我写一篇小红书种草文案，产品是天然玫瑰精华面霜，目标人群是 20-30 岁注重护肤的女性。风格活泼亲切，带 emoji，包含使用感受、成分亮点和一句吸引点赞的结尾。" },
  { label: "体重追踪表格", prompt: "帮我创建一个体重追踪 Excel 表格，包含日期、晨间体重、体脂率、BMI、备注五列，预填最近 30 天的日期，并在表格末尾自动计算平均值和最大/最小值，加上折线图展示体重趋势。" },
  { label: "错题册", prompt: "把下载文件夹里的错题照片整理一下，看看薄弱点在哪里，并且出一些同类型的题" },
  { label: "会议纪要", prompt: "帮我把这段会议录音整理成结构化纪要，包含会议主题、参与人、核心讨论点、决策结论，以及每位负责人的待办事项和截止日期。" },
  { label: "数据分析", prompt: "分析桌面上的销售数据表格，找出近三个月的销售趋势、表现最好和最差的产品，生成可视化图表，并给出 2-3 条提升建议。" },
]

const contextChipsScrollRef = ref<HTMLDivElement>();
const contextChipsScrolled = ref(false);

function scrollContextChips(dir: 1 | -1) {
  contextChipsScrollRef.value?.scrollBy({ left: dir * 160, behavior: "smooth" });
}

function onContextChipsScroll() {
  contextChipsScrolled.value = (contextChipsScrollRef.value?.scrollLeft ?? 0) > 0;
}

function applyContextChip(prompt: string) {
  inputText.value = prompt
  nextTick(() => {
    autoResize()
    inputRef.value?.focus()
  })
}

function applySuggestionPrompt(prompt: string) {
  inputText.value = prompt
  nextTick(() => {
    autoResize()
    inputRef.value?.focus()
  })
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text) return;
  sessionStartedInView.value = true;
  if (isDemoMode.value) {
    const agentId = mockAgentStore.selectedAgentId;
    const taskId = addMvpTask(agentId, text);
    lastDemoTaskId.value = taskId;
    inputText.value = "";
    autoResize();
    hasDemoMessages.value = true;
    demoAborted = false;
    thinkingSteps.value = [];
    thinkingCurrent.value = '';
    thinkingDone.value = false;
    thinkingOpen.value = false;
    emojiIndex.value = 0;
    showEmojiReaction.value = true;
    emojiTimer = setInterval(() => {
      emojiIndex.value = (emojiIndex.value + 1) % emojiList.length;
    }, 1600);
    setTimeout(() => {
      if (emojiTimer) { clearInterval(emojiTimer); emojiTimer = null; }
      if (demoAborted) { showEmojiReaction.value = false; return; }
      showEmojiReaction.value = false;
      thinkingOpen.value = true;
      nextTick(() => {
        function typeStep(stepIdx: number) {
        if (demoAborted) return;
        if (stepIdx >= THINKING_STEPS.length) {
          setTimeout(() => {
            if (demoAborted) return;
            thinkingDone.value = true;
            setTimeout(() => { if (!demoAborted) thinkingOpen.value = false }, 380);
          }, 500);
          return;
        }
        const full = THINKING_STEPS[stepIdx];
        let i = 0;
        thinkingCurrent.value = '';
        const timer = setInterval(() => {
          if (demoAborted) { clearInterval(timer); return; }
          if (i < full.length) {
            thinkingCurrent.value = full.slice(0, ++i);
          } else {
            clearInterval(timer);
            thinkingSteps.value = [...thinkingSteps.value, full];
            thinkingCurrent.value = '';
            setTimeout(() => typeStep(stepIdx + 1), 280);
          }
        }, 14);
      }
      typeStep(0);
    });
  }, 6000);
    return;
  }
  if (!chatStore.wsConnected) return;
  inputText.value = "";
  autoResize();
  if (mockAgentStore.selectedAgentId) addMvpTask(mockAgentStore.selectedAgentId, text);
  await chatStore.sendMessage(text);
}

async function handleAbort() {
  if (isDemoMode.value) {
    stopDemoAnimation()
  } else {
    await chatStore.abort()
  }
}

// ── Edit user message ──
function isEditingMessage(group: MessageGroup, msgIdx: number): boolean {
  return editingGroupKey.value === group.key && editingMsgIdx.value === msgIdx;
}

function startEditMessage(group: MessageGroup, msgIdx: number) {
  if (chatStore.streaming || chatStore.sending) return;
  // Clear text selection caused by double-click
  window.getSelection()?.removeAllRanges();
  const msg = group.messages[msgIdx];
  editingGroupKey.value = group.key;
  editingMsgIdx.value = msgIdx;
  editText.value = getMessageText(msg);
  nextTick(() => {
    const els = editInputRef.value;
    if (els && els.length > 0) {
      const el = els[0];
      el.focus();
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  });
}

function cancelEdit() {
  editingGroupKey.value = null;
  editingMsgIdx.value = -1;
  editText.value = "";
}

async function confirmEdit() {
  const text = editText.value.trim();
  if (!text || !chatStore.wsConnected) return;
  cancelEdit();
  await chatStore.sendMessage(text);
}

function handleEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    cancelEdit();
  } else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    confirmEdit();
  }
}

// Intercept clicks on <a> tags in rendered markdown to open in default browser
function handleThreadClick(e: MouseEvent) {
  const target = (e.target as HTMLElement)?.closest?.('a');
  if (!target) return;
  const href = target.getAttribute('href');
  if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
    e.preventDefault();
    e.stopPropagation();
    window.openclaw.shell.openExternal(href);
  }
}
</script>

<style scoped>
.chat-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
  border-radius: 12px;
}

/* ── Header ── */
.chat-header {
  min-height: 44px;
  padding: 0 0 0 28px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-primary);
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.chat-header__left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.chat-header__right {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

/* ── Windows caption buttons ── */
.win-controls {
  display: flex;
  align-items: stretch;
  height: 44px;
  margin-left: 8px;
  -webkit-app-region: no-drag;
}

.win-btn {
  width: 46px;
  height: 100%;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  flex-shrink: 0;
}

.win-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.win-btn--close:hover {
  background: #c42b1c;
  color: #ffffff;
}

.stop-task-btn {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: #1e1f25;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
  letter-spacing: -0.01em;
}

.stop-task-btn:hover {
  background: #333;
}

.stop-task-icon {
  font-size: 10px;
}

/* ── Thread ── */
.chat-thread {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 28px 32px;
  min-height: 0;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
}

.chat-thread:has(.welcome-state) {
  padding: 0;
}

/* ── Empty state ── */
.chat-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding-bottom: 60px;
}

.chat-empty__logo {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  background: linear-gradient(135deg, #2563eb, #4f8ef7);
  display: grid;
  place-items: center;
  font-size: 30px;
  margin-bottom: 8px;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.2);
}

.chat-empty__title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.04em;
}

.chat-empty__hint {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 400;
}

/* ── Chat Group ── */
.chat-group {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 20px;
}

.chat-group.user {
  justify-content: flex-end;
}

.chat-group-messages {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: min(720px, 85%);
}

.chat-group.user .chat-group-messages {
  align-items: flex-end;
}

/* ── Agent avatar ── */
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

/* ── Bubble ── */
.chat-bubble {
  position: relative;
  display: inline-block;
  max-width: 100%;
  word-wrap: break-word;
  transition: border-color 0.15s;
}

.chat-bubble.has-copy {
  padding-right: 32px;
}

/* User bubble: dark rounded pill */
.chat-bubble.user {
  background: var(--msg-user-bg);
  color: var(--msg-user-text);
  border-radius: 18px;
  padding: 12px 18px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.chat-bubble.user .chat-text--user {
  cursor: default;
}

.chat-bubble.user.editable {
  cursor: pointer;
}

.chat-bubble.user.editable:hover {
  filter: brightness(1.15);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.15);
}

/* ── Edit mode ── */
.chat-edit-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 200px;
}

.chat-edit-input {
  width: 100%;
  min-height: 36px;
  max-height: 200px;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1.5;
  font-family: inherit;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--accent);
  border-radius: 10px;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.chat-edit-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.chat-edit-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.chat-edit-btn {
  padding: 4px 14px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, color 0.15s;
}

.chat-edit-btn.confirm {
  background: var(--accent, #2563eb);
  color: #fff;
}

.chat-edit-btn.confirm:hover {
  filter: brightness(1.1);
}

.chat-edit-btn.cancel {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.chat-edit-btn.cancel:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

/* AI bubble */
.chat-bubble.assistant {
  background: var(--bg-tertiary);
  border: 0.5px solid var(--border);
  border-radius: 18px;
  padding: 12px 18px;
}

/* ── Checklist (tool use) ── */
.chat-checklist {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--text-primary);
}

.checklist-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.checklist-icon.done {
  background: var(--success);
  color: #fff;
}

.checklist-icon:not(.done) {
  color: var(--text-muted);
}

.checklist-text {
  font-weight: 450;
}

/* ── Copy button ── */
.chat-copy-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-muted);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s;
}

.chat-bubble:hover .chat-copy-btn {
  opacity: 1;
  pointer-events: auto;
}

.chat-copy-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* ── Chat text / Markdown ── */
.chat-text {
  font-size: 14px;
  line-height: 1.65;
  word-wrap: break-word;
  overflow-wrap: break-word;
  color: var(--text-primary);
  font-weight: 400;
}

.chat-text--user {
  white-space: pre-wrap;
}

.chat-group.user .chat-text {
  color: var(--msg-user-text);
}

.chat-text :deep(p) {
  margin: 0;
}

.chat-text :deep(p + p) {
  margin-top: 0.6em;
}

.chat-text :deep(ul),
.chat-text :deep(ol) {
  padding-left: 1.5em;
  margin: 4px 0 8px;
}

.chat-text :deep(li + li) {
  margin-top: 0.25em;
}

.chat-text :deep(a) {
  color: #2563eb;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.chat-text :deep(code) {
  font-family: "Cascadia Code", "Fira Code", Consolas, monospace;
  font-size: 0.9em;
}

.chat-text :deep(:not(pre) > code) {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  padding: 1px 5px;
  border-radius: 3px;
}

.chat-text :deep(pre) {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 12px;
  margin: 8px 0;
  overflow-x: auto;
}

.chat-text :deep(pre code) {
  padding: 0;
  background: transparent;
  border: none;
}

.chat-text :deep(details.json-collapse) {
  margin: 8px 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.chat-text :deep(details.json-collapse summary) {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  background: var(--bg-tertiary);
}

.chat-text :deep(details.json-collapse summary:hover) {
  color: var(--text-primary);
}

.chat-text :deep(details.json-collapse pre) {
  margin: 0;
  border: none;
  border-top: 1px solid var(--border);
  border-radius: 0;
}

.chat-text :deep(blockquote) {
  border-left: 3px solid var(--accent);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--text-secondary);
}

.chat-text :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}

.chat-text :deep(th),
.chat-text :deep(td) {
  border: 1px solid var(--border);
  padding: 5px 10px;
}

.chat-text :deep(th) {
  background: var(--bg-tertiary);
  font-weight: 600;
}

.chat-text :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 1em 0;
}

/* ── Reading indicator (typing dots) ── */
.chat-reading-indicator {}

.chat-reading-dots {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}

.chat-reading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: chat-dot-wave 1.4s ease-in-out infinite;
}

.chat-reading-dots span:nth-child(2) {
  animation-delay: 0.18s;
}

.chat-reading-dots span:nth-child(3) {
  animation-delay: 0.36s;
}

@keyframes chat-dot-wave {
  0%, 60%, 100% {
    opacity: 0.25;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-4px);
  }
}

/* ── Error ── */
.chat-error {
  margin: 8px 16px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 59, 48, 0.08);
  color: var(--danger);
  font-size: 13px;
  border: 1px solid rgba(255, 59, 48, 0.2);
}

/* ── New messages indicator ── */
.chat-new-messages {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  margin: 0 auto;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.15s;
}

.chat-new-messages:hover {
  border-color: var(--accent);
  background: var(--accent-subtle);
}

/* ── Compose ── */
.chat-compose {
  flex-shrink: 0;
  padding: 0 28px 18px;
  background: var(--bg-primary);
}

.compose-context-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.context-chips-scroll {
  display: flex;
  gap: 8px;
  overflow-x: hidden;
  scroll-behavior: smooth;
  flex: 1;
}

.context-chips-arrow {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 0.5px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.context-chips-arrow:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.compose-context-chip {
  padding: 6px 14px;
  border-radius: 20px;
  border: 0.5px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 400;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.compose-context-chip:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.compose-wrapper {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 0.5px solid var(--border);
  border-radius: 20px;
  padding: 16px 16px 12px;
  transition: border-color 0.15s;
}

.compose-wrapper:focus-within {
  border-color: var(--text-muted);
}

.compose-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  color: var(--text-primary);
  font-family: inherit;
  padding: 4px 0 12px;
  resize: none;
  overflow: hidden;
  line-height: 1.6;
  min-height: 28px;
  max-height: 150px;
  overflow-y: auto;
}

.compose-input::placeholder {
  color: var(--text-muted);
}

.compose-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.compose-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.compose-plus {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.compose-plus:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.compose-send {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--border);
  color: var(--text-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, opacity 0.15s;
}

.compose-send.active {
  background: var(--text-primary);
  color: var(--bg-secondary);
}

.compose-send.active:hover {
  opacity: 0.85;
}

.compose-send:disabled {
  cursor: not-allowed;
}

.compose-stop {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--text-primary);
  color: var(--bg-primary);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.compose-stop:hover {
  opacity: 0.8;
}

.chat-compose__hint {
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 8px;
  font-weight: 400;
  letter-spacing: 0.01em;
}

/* ── Mock chat wrapper ── */
.mock-chat {
  display: flex;
  flex-direction: column;
}

/* ── Thinking panel ── */
.thinking-panel {
  border-radius: 10px;
  margin-bottom: 10px;
  overflow: hidden;
  /* No bg/border while streaming — text flows bare */
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
.thinking-panel__header--muted .thinking-label,
.thinking-panel__header--muted .thinking-duration {
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

.thinking-duration {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 1px 7px;
  border-radius: 10px;
}

.thinking-body {
  padding: 10px 16px 14px;
  border-top: 1px solid var(--border);
}

/* While streaming: no indent/border */
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

.thinking-slide-enter-active,
.thinking-slide-leave-active {
  transition: max-height 0.22s ease, opacity 0.22s ease;
  overflow: hidden;
}
.thinking-slide-enter-from,
.thinking-slide-leave-to { max-height: 0; opacity: 0; }
.thinking-slide-enter-to,
.thinking-slide-leave-from { max-height: 400px; opacity: 1; }

/* ── Phone auth card ── */
.phone-auth-card {
  margin-top: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px 18px;
  width: 100%;
  box-sizing: border-box;
}

.phone-auth-card__text {
  font-size: 13.5px;
  color: var(--text-primary);
  line-height: 1.65;
  margin-bottom: 14px;
}

.phone-auth-card__actions {
  display: flex;
  gap: 8px;
}

.phone-auth-btn {
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}

.phone-auth-btn:hover { opacity: 0.8; }

.phone-auth-btn--deny {
  background: #ffffff;
  color: var(--text-secondary);
  border: 0.5px solid var(--border);
}

.phone-auth-btn--confirm {
  background: var(--text-primary);
  color: var(--bg-primary);
}

/* ── Execution Steps Panel ── */
.exec-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-bottom: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.exec-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s;
}

.exec-panel__header:hover {
  background: var(--bg-tertiary);
}

.exec-panel__toggle svg {
  transition: transform 0.2s ease;
  color: var(--text-muted);
}

.exec-panel__toggle svg.rotated {
  transform: rotate(90deg);
}

.exec-panel__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.exec-panel__count {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 1px 7px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.exec-panel__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: exec-spin 0.8s linear infinite;
  margin-left: auto;
}

@keyframes exec-spin {
  to { transform: rotate(360deg); }
}

.exec-panel__body {
  padding: 2px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-top: 1px solid var(--border);
}

.exec-step {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  padding: 4px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.exec-step.done {
  color: var(--text-muted);
}

.exec-step__icon {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.exec-step.done .exec-step__icon {
  color: var(--success);
}

.exec-step__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  animation: exec-dot-pulse 1.2s ease-in-out infinite;
}

.exec-step__lock {
  color: #e6a817;
}

@keyframes exec-dot-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.1); }
}

.exec-step__name {
  font-family: "Cascadia Code", "Fira Code", Consolas, monospace;
  font-size: 12px;
  font-weight: 450;
}

.exec-step__meta {
  flex-basis: 100%;
  padding-left: 26px;
  font-size: 11px;
  color: var(--text-muted);
  word-break: break-word;
  line-height: 1.5;
}

.exec-step__actual {
  flex-basis: 100%;
  padding-left: 26px;
  font-size: 10px;
  color: var(--text-muted);
  opacity: 0.6;
  word-break: break-all;
  line-height: 1.4;
  font-family: "Cascadia Code", "Fira Code", Consolas, monospace;
}

.exec-step__result {
  flex-basis: 100%;
  padding-left: 26px;
  font-size: 10px;
  color: var(--text-muted);
  opacity: 0.5;
  word-break: break-word;
  line-height: 1.4;
  max-height: 80px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-family: "Cascadia Code", "Fira Code", Consolas, monospace;
}

.exec-step__result--error {
  color: #e74c3c;
  opacity: 0.85;
}

.exec-step--error .exec-step__icon svg {
  stroke: #e74c3c;
}

/* Slide transition */
.exec-slide-enter-active,
.exec-slide-leave-active {
  transition: max-height 0.2s ease, opacity 0.2s ease;
  overflow: hidden;
}

.exec-slide-enter-from,
.exec-slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.exec-slide-enter-to,
.exec-slide-leave-from {
  max-height: 400px;
  opacity: 1;
}

.emoji-reaction {
  display: flex;
  justify-content: flex-start;
  padding: 4px 0 8px 0;
}

.emoji-video {
  width: 192px;
  height: 192px;
  object-fit: contain;
  border-radius: 8px;
}

.emoji-fade-enter-active,
.emoji-fade-leave-active {
  transition: opacity 0.3s ease;
}

.emoji-fade-enter-from,
.emoji-fade-leave-to {
  opacity: 0;
}
</style>
