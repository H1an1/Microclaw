<template>
  <div class="gateway-loading">
    <div class="gateway-drag-region"></div>
    <div class="loading-center">
      <!-- Brand logo -->
      <div class="loading-logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"
          stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>
      <div class="loading-brand">MicroClaw</div>

      <!-- Progress bar (0–100%) -->
      <div class="loading-track">
        <div
          class="loading-bar"
          :class="{ error: isFailed }"
          :style="{ width: displayProgress + '%' }"
        ></div>
      </div>

      <!-- Status text with percentage -->
      <div class="loading-status" :class="{ error: isFailed }">
        {{ statusText }}
        <span v-if="!isFailed" class="loading-pct">{{ displayProgress }}%</span>
      </div>

      <!-- Retry button (timeout / failed) -->
      <button v-if="isFailed" class="loading-retry" @click="$emit('retry')">{{ t('gateway.retry') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { t } from "@/i18n";

const props = defineProps<{ status: string; connected: boolean }>();
defineEmits<{ retry: [] }>();

const isFailed = computed(() => props.status === "timeout" || props.status === "failed");

// Target percentage based on actual state
const targetProgress = computed(() => {
  if (props.connected) return 100;
  if (isFailed.value) return displayProgress.value; // freeze
  switch (props.status) {
    case "stopped":   return 5;
    case "starting":  return 70;
    case "running":   return 90; // WS connecting — park at 90%
    default:          return 5;
  }
});

// Smoothly animated display value
const displayProgress = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  const target = targetProgress.value;
  const current = displayProgress.value;
  if (current >= target) return;

  // Speed: fast for connected (100), slow when approaching target
  if (target === 100) {
    displayProgress.value = Math.min(current + 4, 100);
  } else {
    // Decelerate as we approach target — never exceed it
    const remaining = target - current;
    const step = Math.max(0.3, remaining * 0.06);
    displayProgress.value = Math.min(Math.round((current + step) * 10) / 10, target);
  }
}

onMounted(() => {
  timer = setInterval(tick, 80);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

// When connected flips to true, ensure we reach 100 quickly
watch(() => props.connected, (val) => {
  if (val && displayProgress.value < 90) {
    displayProgress.value = 90;
  }
});

const statusText = computed(() => {
  if (props.connected) return t('gateway.ready');
  switch (props.status) {
    case "stopped":
    case "starting":
      return t('gateway.starting');
    case "running":
      return t('gateway.connecting');
    case "timeout":
      return t('gateway.timeout');
    case "failed":
      return t('gateway.failed');
    default:
      return t('gateway.preparing');
  }
});
</script>

<style scoped>
.gateway-loading {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  z-index: 9999;
}

.gateway-drag-region {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  -webkit-app-region: drag;
}

.loading-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.loading-logo {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #2563eb, #4f8ef7);
  display: grid;
  place-items: center;
  box-shadow: 0 4px 20px rgba(37, 99, 235, 0.3);
}

.loading-brand {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.04em;
  margin-bottom: 8px;
}

/* ── Percentage progress bar ── */
.loading-track {
  width: 240px;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.loading-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.15s ease-out;
  will-change: width;
}

.loading-bar.error {
  background: var(--danger);
}

/* ── Status text ── */
.loading-status {
  font-size: 13px;
  color: var(--text-muted);
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-pct {
  font-variant-numeric: tabular-nums;
  min-width: 32px;
  text-align: right;
}

.loading-status.error {
  color: var(--danger);
}

/* ── Retry button ── */
.loading-retry {
  margin-top: 4px;
  padding: 8px 28px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}

.loading-retry:hover {
  background: var(--accent-hover);
}
</style>
