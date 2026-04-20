<template>
  <!-- Setup wizard — shown fullscreen (no sidebar/nav) -->
  <router-view v-if="showSetup" />

  <!-- Gateway loading screen — blocks UI until WS is connected -->
  <GatewayLoading
    v-else-if="!gatewayReady"
    :status="gateway.status"
    :connected="chatStore.wsConnected"
    @retry="handleRetry"
  />

  <!-- Main app (shown after first successful WS connection) -->
  <div v-else :class="['app-layout', { 'app-minimizing': isMinimizing }]">
    <PrimaryNav />
    <Sidebar />
    <main class="main-content">
      <!-- Titlebar: page title + window controls -->
      <div class="main-titlebar">
        <span class="main-titlebar__title">{{ currentPageTitle }}</span>
        <div class="main-titlebar__controls">
          <button class="win-btn win-btn--min" @click="winMinimize" title="最小化">
            <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
          </button>
          <button class="win-btn win-btn--max" @click="winMaximize" :title="isMaximized ? '向下还原' : '最大化'">
            <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/></svg>
            <svg v-else width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/>
              <rect x="0" y="2" width="8" height="8" fill="var(--bg-secondary)" stroke="currentColor" stroke-width="1"/>
            </svg>
          </button>
          <button class="win-btn win-btn--close" @click="winClose" title="关闭">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="main-content__body" :class="{ 'main-content__body--panel-open': !!activeProfileAgentId }">
        <div class="main-content__view">
          <router-view v-slot="{ Component }">
            <keep-alive include="ChatView">
              <component :is="Component" />
            </keep-alive>
          </router-view>
        </div>

        <transition name="profile-panel-slide">
          <AgentProfilePanel v-if="activeProfileAgentId" :agent-id="activeProfileAgentId" class="main-content__panel" />
        </transition>
      </div>
    </main>
  </div>

  <!-- Integrity Alert Dialog (shown immediately on launch or mid-session) -->
  <el-dialog
    v-model="integrityDialogVisible"
    :title="t('integrity.title')"
    width="560"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
  >
    <div v-if="integrityResult && !integrityResult.signatureValid" style="color:#ff3b30; margin-bottom:16px; font-weight:bold">
      {{ t('integrity.signatureFailed') }}
    </div>

    <div v-if="integrityResult?.signatureValid" style="margin-bottom:12px; color:#666">
      {{ t('integrity.changedSinceLastLaunch') }}
    </div>

    <div v-if="modifiedChanges.length" style="margin-bottom:12px">
      <div style="font-weight:bold; color:#ff9500; margin-bottom:4px">{{ t('integrity.modified') }} ({{ modifiedChanges.length }})</div>
      <div v-for="c in modifiedChanges" :key="c.skill + c.file" style="font-size:13px; color:#555; padding-left:12px">
        · {{ c.source }}/{{ c.skill }}/{{ c.file }}
      </div>
    </div>

    <div v-if="addedChanges.length" style="margin-bottom:12px">
      <div style="font-weight:bold; color:#ff3b30; margin-bottom:4px">{{ t('integrity.added') }} ({{ addedChanges.length }})</div>
      <div v-for="c in addedChanges" :key="c.skill + c.file" style="font-size:13px; color:#555; padding-left:12px">
        · {{ c.source }}/{{ c.skill }}/{{ c.file }}
      </div>
    </div>

    <div v-if="removedChanges.length" style="margin-bottom:12px">
      <div style="font-weight:bold; color:#ff9500; margin-bottom:4px">{{ t('integrity.removed') }} ({{ removedChanges.length }})</div>
      <div v-for="c in removedChanges" :key="c.skill + c.file" style="font-size:13px; color:#555; padding-left:12px">
        · {{ c.source }}/{{ c.skill }}/{{ c.file }}
      </div>
    </div>

    <template #footer>
      <el-button @click="exitApp">{{ t('integrity.exit') }}</el-button>
      <el-button type="primary" :loading="integrityLoading" @click="trustIntegrityChanges">
        {{ t('integrity.trustAndContinue') }}
      </el-button>
    </template>
  </el-dialog>

  <!-- In-app permission dialog (replaces native OS dialog) -->
  <PermissionDialog
    :request="currentPermission"
    @respond="handlePermissionResponse"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import Sidebar from "@/components/Sidebar.vue";
import PrimaryNav from "@/components/PrimaryNav.vue";
import GatewayLoading from "@/components/GatewayLoading.vue";
import PermissionDialog from "@/components/PermissionDialog.vue";
import AgentProfilePanel from "@/components/AgentProfilePanel.vue";
import { useGatewayStore } from "@/stores/gateway";
import { useChatStore } from "@/stores/chat";
import { useSessionStore } from "@/stores/sessions";
import { useTaskStore } from "@/stores/tasks";
import { useMockAgentStore } from "@/stores/mockAgents";
import { useDropAnalysisStore } from "@/stores/dropAnalysis";
import { t, setLocale } from "@/i18n";

const gateway = useGatewayStore();
const chatStore = useChatStore();
const sessionStore = useSessionStore();
const taskStore = useTaskStore();
const mockAgentStore = useMockAgentStore();
const dropAnalysisStore = useDropAnalysisStore();
const router = useRouter();
const route = useRoute();

// ── Titlebar ──
const currentAgentName = computed(() => {
  const id = mockAgentStore.selectedAgentId;
  return mockAgentStore.agents.find(a => a.id === id)?.name ?? 'MicroClaw';
});

const activeProfileAgentId = computed(() => {
  const panel = Array.isArray(route.query.panel) ? route.query.panel[0] : route.query.panel;
  const agentId = Array.isArray(route.query.profileAgentId) ? route.query.profileAgentId[0] : route.query.profileAgentId;
  if (panel !== 'profile' || typeof agentId !== 'string' || !agentId) return '';
  return agentId;
});

const currentPageTitle = computed(() => {
  switch (route.name) {
    case 'tasks':
      return '任务';
    case 'phone':
      return '手机';
    case 'explore':
      return '探索';
    case 'settings':
      return '设置';
    case 'plugins':
      return '插件';
    case 'new-agent':
      return '新建 Agent';
    default:
      return currentAgentName.value;
  }
});

const isMaximized = ref(false);
const isMinimizing = ref(false);
function winMinimize() {
  if (isMinimizing.value) return;
  isMinimizing.value = true;
  (window as any).openclaw?.window?.minimize();
  setTimeout(() => { isMinimizing.value = false; }, 400);
}
function winMaximize() {
  (window as any).openclaw?.window?.maximize();
  isMaximized.value = !isMaximized.value;
}
async function winClose() {
  showSetup.value = true;
  isMaximized.value = false;
  router.replace("/setup");
  await (window as any).openclaw?.setup?.shrinkWindow?.();
}

// ── Setup wizard gate ──
const showSetup = ref(false);

function dismissSetup() {
  showSetup.value = false;
  router.replace("/chat");
  (window as any).openclaw?.setup?.openMain?.();
}
window.addEventListener("setup:dismiss", dismissSetup);

// ── Gateway loading gate ──
// Once the first WS connection succeeds and the progress bar finishes,
// the loading screen hides.  It reappears on explicit gateway restart
// (e.g. from the Plugins page) via gateway.resetReady().
// In browser (non-Electron) dev preview, skip gateway check entirely.
const isElectron = typeof window !== "undefined" && !!window.openclaw;
const gatewayReady = computed(() => !isElectron || gateway.ready);

// Delay hiding the loading screen so the progress bar can animate to 100%
function markConnected() {
  if (gateway.ready) return;
  setTimeout(() => { gateway.markReady(); }, 600);
}

function handleRetry() {
  window.openclaw.gateway.restart();
}

// ── Integrity check state ──
const integrityDialogVisible = ref(false);
const integrityResult = ref<IntegrityResult | null>(null);
const integrityLoading = ref(false);

// ── Permission dialog state (queue of pending requests) ──
interface PermissionRequestData {
  requestId: string;
  type: "file" | "shell" | "shell-async" | "app-approval";
  targetPath: string;
  dirPath: string;
  command?: string;
  accessNeeded?: string;
}
const permissionQueue = ref<PermissionRequestData[]>([]);
const currentPermission = computed(() => permissionQueue.value.length > 0 ? permissionQueue.value[0] : null);

function buildCompactEntryDraft(targets: CompactEntryDropTarget[]): string {
  const preferredTargets = targets.filter((target) => target.isDirectory);
  const effectiveTargets = preferredTargets.length > 0 ? preferredTargets : targets;

  if (effectiveTargets.length === 1) {
    const [target] = effectiveTargets;
    const kind = target.isDirectory ? "文件夹" : "文件";
    return `我刚拖进来了一个${kind}「${target.name}」。请先看看里面都有什么，并告诉我你可以怎么帮我处理它，比如整理内容、总结重点、提取信息或生成任务清单。\n\n路径：${target.path}`;
  }

  const label = preferredTargets.length === effectiveTargets.length ? "文件夹" : "项目";
  const lines = effectiveTargets.map((target) => `- ${target.name}（${target.path}）`).join("\n");
  return `我刚拖进来了这些${label}：\n${lines}\n\n请先概览它们分别是什么，并告诉我你可以怎么帮我整理、总结或提取重点。`;
}

async function handleCompactEntryDrop(targets: CompactEntryDropTarget[]) {
  if (!targets.length) return;

  dropAnalysisStore.receive(targets);
  const agentId = mockAgentStore.selectedAgentId;
  await router.push(agentId ? `/chat/${agentId}` : "/chat");
}

function handlePermissionResponse(decision: string) {
  const req = permissionQueue.value[0];
  if (!req) return;
  window.openclaw.sandbox.respondPermission(req.requestId, decision);
  chatStore.completeToolCall(req.requestId);
  permissionQueue.value.shift();
}

const modifiedChanges = computed(() =>
  integrityResult.value?.changes.filter(c => c.type === "modified") ?? []
);
const addedChanges = computed(() =>
  integrityResult.value?.changes.filter(c => c.type === "added") ?? []
);
const removedChanges = computed(() =>
  integrityResult.value?.changes.filter(c => c.type === "removed") ?? []
);

async function trustIntegrityChanges() {
  integrityLoading.value = true;
  try {
    await window.openclaw.skills.acceptIntegrityChanges();
    integrityDialogVisible.value = false;
    integrityResult.value = null;
    ElMessage.success(t('integrity.trusted'));
  } catch (err: any) {
    ElMessage.error(t('integrity.updateFailed', { error: err.message || err }));
  } finally {
    integrityLoading.value = false;
  }
}

function exitApp() {
  window.close();
}

function applyTheme(mode: string) {
  const html = document.documentElement;
  html.classList.remove("light", "dark");
  if (mode === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    html.classList.add(prefersDark ? "dark" : "light");
  } else {
    html.classList.add(mode);
  }
}

let unsubStatus: (() => void) | null = null;
let unsubLog: (() => void) | null = null;
let unsubWsConnected: (() => void) | null = null;
let unsubWsDisconnected: (() => void) | null = null;
let unsubChatEvent: (() => void) | null = null;
let unsubToolEvent: (() => void) | null = null;
let unsubIntegrityAlert: (() => void) | null = null;
let unsubPermission: (() => void) | null = null;
let unsubAclTimeout: (() => void) | null = null;
let unsubAclIneffective: (() => void) | null = null;
let unsubCompactEntryDrop: (() => void) | null = null;
let historyPollTimer: number | null = null;

onMounted(async () => {
  // In browser dev preview (non-Electron), stop here
  if (!isElectron) {
    applyTheme("light");
    return;
  }

  // Apply persisted theme, accent color, and locale
  try {
    const s = await window.openclaw.settings.get();
    applyTheme(s.themeMode || "light");
    if (s.accentColor) {
      document.documentElement.style.setProperty("--accent", s.accentColor);
    }
    if (s.language) {
      setLocale(s.language as any);
    }
  } catch {}

  // Only enter setup flow when config is actually missing.
  // Otherwise, expand the Electron window to the normal app size.
  try {
    const needs = await window.openclaw.config.needsSetup();
    showSetup.value = !!needs;

    if (needs) {
      (window as any).openclaw?.setup?.shrinkWindow?.();
      router.replace("/setup");
      return;
    }

    await window.openclaw.setup.openMain();
    if (router.currentRoute.value.path === "/setup") {
      router.replace("/chat");
    }
  } catch {}

  // ── Integrity check (runs before anything else) ──
  try {
    const pending = await window.openclaw.skills.pendingIntegrityResult();
    if (pending && !pending.valid) {
      integrityResult.value = pending;
      integrityDialogVisible.value = true;
    }
  } catch {}

  // Listen for mid-session integrity alerts (file watcher)
  unsubIntegrityAlert = window.openclaw.skills.onIntegrityAlert((result) => {
    if (!result.valid) {
      integrityResult.value = result;
      integrityDialogVisible.value = true;
    }
  });

  // Listen for sandbox permission requests
  unsubPermission = window.openclaw.sandbox.onPermissionRequest((data: PermissionRequestData) => {
    permissionQueue.value.push(data);
    // Add a pending entry to the exec panel so user sees what's waiting for permission
    if (chatStore.streaming) {
      const path = data.targetPath || data.dirPath;
      const access = data.accessNeeded === 'ro' ? 'Read' : 'Write';
      const label = `${access} permission: ${path}`;
      chatStore.addPendingToolCall(data.requestId, label);
    }
  });

  // Listen for ACL verification timeout after user approved permission
  unsubAclTimeout = window.openclaw.sandbox.onAclTimeout?.((data: { dir: string; access: string }) => {
    ElMessage.warning({
      message: t('perm.aclTimeout', { dir: data.dir }),
      duration: 8000,
      showClose: true,
    });
  }) ?? null;

  // Listen for ACL-ineffective reports (ACL set but AppContainer still Access Denied)
  unsubAclIneffective = window.openclaw.sandbox.onAclIneffective?.((data: { dir: string; deniedPath: string; access: string; command?: string }) => {
    const detail = data.command ? `\n${t('perm.commandLabel')}: ${data.command.substring(0, 120)}` : '';
    ElMessage.error({
      message: t('perm.aclIneffective', { dir: data.dir, path: data.deniedPath }) + detail,
      duration: 12000,
      showClose: true,
    });
  }) ?? null;

  // Gateway process status
  unsubStatus = window.openclaw.gateway.onStatus((status) => {
    gateway.status = status;
    if (status === "running") {
      window.openclaw.gateway.getPort().then((p) => (gateway.port = p));
    }
  });
  unsubLog = window.openclaw.gateway.onLog((msg) => {
    gateway.addLog(msg);
  });

  // WebSocket connection status
  unsubWsConnected = window.openclaw.gateway.onWsConnected((mainSessionKey) => {
    const wasStreaming = chatStore.streaming;
    chatStore.wsConnected = true;
    markConnected();
    // Apply the canonical session key from gateway hello
    if (mainSessionKey) {
      chatStore.sessionKey = mainSessionKey;
      chatStore.resolvedSessionKey = mainSessionKey;
    }
    // Register in session store
    sessionStore.ensureSession(chatStore.sessionKey);
    chatStore.loadHistory();
    // If we were streaming when the WS dropped, the "final" event may have
    // been lost.  Probe the server to check whether the task actually
    // completed — this is authoritative and works regardless of active tools.
    if (wasStreaming) {
      setTimeout(() => chatStore.recoverAfterReconnect(), 5_000);
    }
    // Fetch scheduled tasks now that gateway is connected
    taskStore.fetchTasks();
    // Refresh WeChat login status (important after gateway restart)
    gateway.refreshWeixinStatus();
  });
  unsubWsDisconnected = window.openclaw.gateway.onWsDisconnected(() => {
    chatStore.wsConnected = false;
  });

  // Chat events (delta, final, aborted, error)
  unsubChatEvent = window.openclaw.chat.onEvent((payload) => {
    chatStore.handleChatEvent(payload);
  });

  // Agent tool events (start, result)
  unsubToolEvent = window.openclaw.chat.onToolEvent((payload) => {
    chatStore.handleToolEvent(payload);
  });

  // Actual shell command notifications from sandbox-preload
  if (window.openclaw.chat.onExecCommand) {
    window.openclaw.chat.onExecCommand((data) => {
      chatStore.updateLatestExecCommand(data.command);
    });
  }

  unsubCompactEntryDrop = window.openclaw.compactEntry.onDroppedTargets((targets) => {
    void handleCompactEntryDrop(targets);
  });

  // Get initial status
  window.openclaw.gateway.getStatus().then((s) => (gateway.status = s));
  window.openclaw.gateway.getPort().then((p) => (gateway.port = p));
  window.openclaw.chat.isConnected().then((c) => {
    if (c && !chatStore.wsConnected) {
      chatStore.wsConnected = c;
      markConnected();
      chatStore.loadHistory();
    }
  });

  // (Theme, accent, locale already applied above before setup check)

  // React to OS theme changes when in "system" mode
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    window.openclaw.settings.get().then((s) => {
      if (s.themeMode === "system") applyTheme("system");
    });
  });

  // Poll for new messages (catches WeChat-originated messages
  // that don't trigger a desktop chat event).
  // loadHistory() internally skips Vue reactivity update when messages
  // haven't changed, so the UI won't flicker on no-op polls.
  historyPollTimer = window.setInterval(() => {
    if (chatStore.wsConnected && !chatStore.streaming && !chatStore.sending) {
      chatStore.loadHistory();
    }
    chatStore.checkStaleStream();
  }, 5000);
});

onUnmounted(() => {
  unsubStatus?.();
  unsubLog?.();
  unsubWsConnected?.();
  unsubWsDisconnected?.();
  unsubChatEvent?.();
  unsubToolEvent?.();
  unsubIntegrityAlert?.();
  unsubPermission?.();
  unsubAclTimeout?.();
  unsubAclIneffective?.();
  unsubCompactEntryDrop?.();
  if (historyPollTimer) window.clearInterval(historyPollTimer);
});
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--bg-tertiary); /* warm stone — becomes the "shelf" behind the card */
}

.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

.main-content__body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  position: relative;
}

.main-content__view {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.main-content__panel {
  width: 420px;
  min-width: 360px;
  max-width: 38vw;
  flex-shrink: 0;
  border-left: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

.profile-panel-slide-enter-active,
.profile-panel-slide-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.profile-panel-slide-enter-from,
.profile-panel-slide-leave-to {
  transform: translateX(24px);
  opacity: 0;
}

.main-titlebar {
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 28px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
  -webkit-app-region: drag;
}

.main-titlebar__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  -webkit-app-region: no-drag;
  pointer-events: none;
}

.main-titlebar__controls {
  display: flex;
  align-items: stretch;
  height: 44px;
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
}

.win-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

@media (max-width: 1180px) {
  .main-content__panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(420px, 100%);
    max-width: 100%;
    box-shadow: -16px 0 40px rgba(18, 24, 32, 0.12);
    z-index: 4;
  }
}

.win-btn--close:hover {
  background: #c42b1c;
  color: #ffffff;
}

.app-layout {
  transform-origin: bottom center;
}

.app-minimizing {
  animation: shrink-to-mini 300ms cubic-bezier(0.4, 0, 1, 1) forwards;
  pointer-events: none;
}

@keyframes shrink-to-mini {
  0% {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: blur(0px);
  }
  60% {
    opacity: 0.6;
    transform: scale(0.45) translateY(24px);
    filter: blur(0px);
  }
  100% {
    opacity: 0;
    transform: scale(0.08) translateY(48px);
    filter: blur(4px);
  }
}</style>
