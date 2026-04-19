<script setup lang="ts">
import { computed, ref } from "vue";
import { t } from "@/i18n";

/** Feature flag: show caller stack trace in permission dialog for debugging. */
const SHOW_CALLER_STACK = false;

interface PermissionRequest {
  requestId: string;
  type: "file" | "shell" | "shell-async" | "app-approval";
  targetPath?: string;
  dirPath?: string;
  command?: string;
  callerStack?: string;
  app?: string;
  accessNeeded?: string;
}

const props = defineProps<{
  request: PermissionRequest | null;
}>();

const emit = defineEmits<{
  respond: [decision: string];
}>();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const descriptionHtml = computed(() => {
  if (!props.request) return "";
  if (props.request.type === "app-approval") {
    const appName = `<strong>${escapeHtml(props.request.app || "")}</strong>`;
    return t("perm.appDesc", { app: appName });
  }
  const dir = `<strong>${escapeHtml(props.request.dirPath || "")}</strong>`;
  const access = props.request.accessNeeded;
  if (props.request.type === "file") {
    if (access === "ro") return t("perm.fileDescRO", { dir });
    return t("perm.fileDesc", { dir });
  }
  if (access === "ro") return t("perm.shellDescRO", { dir });
  return t("perm.shellDesc", { dir });
});

const commandHtml = computed(() => {
  if (!props.request?.command) return "";
  const raw = props.request.command;
  const truncated = raw.length > 300 ? raw.slice(0, 297) + "\u2026" : raw;
  return escapeHtml(truncated);
});

const isAppApproval = computed(() => props.request?.type === "app-approval");
/** The grant decision to send when user clicks "Allow". */
const grantDecision = computed(() =>
  props.request?.accessNeeded === "ro" ? "grant-ro" : "grant-rw"
);

function respond(decision: string) {
  emit("respond", decision);
}
</script>

<template>
  <Transition name="perm-slide">
    <div v-if="request" class="perm-overlay">
      <div class="perm-card">
        <div class="perm-header">
          <span class="perm-title">{{ t('perm.title') }}</span>
          <button class="perm-close" @click="respond('deny')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="perm-body" v-html="descriptionHtml"></div>
        <div v-if="commandHtml" class="perm-command">
          <div class="perm-command-label">{{ t('perm.commandLabel') }}</div>
          <code class="perm-command-code" v-html="commandHtml"></code>
        </div>
        <div v-if="SHOW_CALLER_STACK && request?.callerStack" class="perm-command">
          <div class="perm-command-label">Caller</div>
          <code class="perm-command-code perm-stack">{{ request.callerStack }}</code>
        </div>
        <div class="perm-actions">
          <button class="perm-btn perm-btn-outline" @click="respond('deny')">
            {{ t('perm.deny') }}
          </button>
          <template v-if="isAppApproval">
            <button class="perm-btn perm-btn-filled" @click="respond('allow-once')">
              {{ t('perm.allowOnce') }}
            </button>
            <button class="perm-btn perm-btn-filled" @click="respond('allow-always')">
              {{ t('perm.allowAlways') }}
            </button>
          </template>
          <template v-else>
            <button class="perm-btn perm-btn-filled" @click="respond(grantDecision)">
              {{ t('perm.allow') }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.perm-overlay {
  position: fixed;
  bottom: 0;
  left: var(--sidebar-width, 240px);
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 200;
  pointer-events: none;
  padding: 12px 28px 18px;
  background: var(--bg-primary);
}

.perm-card {
  pointer-events: auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--card-radius, 16px);
  box-shadow: var(--card-shadow);
  padding: 16px 20px;
  max-width: 680px;
  width: 100%;
}

.perm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.perm-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.perm-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}

.perm-close:hover {
  background: var(--accent-subtle);
  color: var(--text-primary);
}

.perm-body {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
}

.perm-body :deep(strong) {
  color: var(--text-primary);
  font-weight: 600;
}

.perm-command {
  margin-bottom: 16px;
}

.perm-command-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
  font-weight: 500;
}

.perm-command-code {
  display: block;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--bg-tertiary, rgba(0, 0, 0, 0.06));
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  word-break: break-all;
  white-space: pre-wrap;
  max-height: 80px;
  overflow-y: auto;
}

.perm-stack {
  font-size: 10px;
  opacity: 0.6;
  max-height: 60px;
}

.perm-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.perm-btn {
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  white-space: nowrap;
}

.perm-btn:active {
  transform: scale(0.97);
}

.perm-btn-outline {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.perm-btn-outline:hover {
  background: var(--bg-tertiary);
}

.perm-btn-filled {
  background: var(--msg-user-bg);
  border: 1px solid transparent;
  color: var(--msg-user-text, #fff);
}

.perm-btn-filled:hover {
  opacity: 0.85;
}

/* Slide-up transition */
.perm-slide-enter-active,
.perm-slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.perm-slide-enter-from,
.perm-slide-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>
