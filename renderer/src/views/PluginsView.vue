<template>
  <div class="plugins-view">
    <div class="view-header">
      <button class="back-btn" @click="router.back()" :title="t('plugins.back')">←</button>
      <div>
        <h2>{{ t('plugins.title') }}</h2>
        <p class="view-desc">{{ t('plugins.desc') }}</p>
      </div>
    </div>

    <!-- WeChat Plugin Card -->
    <div class="plugin-card">
      <div class="plugin-header">
        <div class="plugin-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M8.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM5.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="#07C160"/>
            <path d="M9 2C4.58 2 1 5.13 1 9c0 2.38 1.19 4.47 3 5.74V19l3.28-2.05c.57.14 1.13.05 1.72.05 4.42 0 8-3.13 8-7s-3.58-7-8-7Z" stroke="#07C160" stroke-width="1.5" fill="none"/>
            <path d="M23 14.5c0-3.04-3.13-5.5-7-5.5-.46 0-.91.04-1.35.12C17.6 10.05 20 12 20 14.5c0 .85-.26 1.65-.7 2.37L22 19v-2.74c.63-.8 1-1.74 1-2.76Z" stroke="#07C160" stroke-width="1.5" fill="none"/>
          </svg>
        </div>
        <div class="plugin-info">
          <div class="plugin-name">{{ t('plugins.weixinName') }}</div>
          <div class="plugin-desc">{{ t('plugins.weixinDesc') }}</div>
        </div>
        <div class="plugin-toggle">
          <el-switch
            v-model="weixinEnabled"
            :loading="toggling"
            @change="handleToggleEnabled"
          />
        </div>
      </div>

      <!-- Plugin body — only visible when enabled -->
      <div v-if="weixinEnabled" class="plugin-body">
        <div class="plugin-section">
          <div class="plugin-section-title">{{ t('plugins.channelLogin') }}</div>
          <div class="plugin-section-desc">
            {{ t('plugins.channelLoginDesc') }}
          </div>

          <!-- Login states -->
          <div v-if="!loginActive && !loginSuccess" class="login-actions">
            <el-button type="primary" @click="startLogin" :loading="loginStarting">
              {{ t('plugins.loginWeixin') }}
            </el-button>
          </div>

          <!-- QR code display area (fast path) -->
          <div v-if="loginActive && !useFallbackLogin" class="login-qr-area">
            <div class="qr-header">
              <span class="qr-status-text">{{ qrStatusText }}</span>
              <el-button size="small" text @click="cancelLogin">{{ t('plugins.cancel') }}</el-button>
            </div>
            <div class="qr-body">
              <canvas ref="qrCanvasRef" class="qr-canvas"></canvas>
              <div v-if="qrScanned" class="qr-scanned-overlay">
                <span class="qr-scanned-icon">👀</span>
                <span>{{ t('plugins.scannedWaiting') }}</span>
              </div>
            </div>
            <div v-if="qrError" class="qr-error">{{ qrError }}</div>
          </div>

          <!-- Terminal output area (CLI fallback) -->
          <div v-if="loginActive && useFallbackLogin" class="login-terminal-area">
            <div class="terminal-header">
              <span class="terminal-title">{{ t('plugins.waitingScan') }}</span>
              <el-button size="small" text @click="cancelLogin">{{ t('plugins.cancel') }}</el-button>
            </div>
            <pre class="terminal-output" ref="terminalRef">{{ loginOutput }}</pre>
          </div>

          <!-- Login success + disconnect -->
          <div v-if="loginSuccess" class="login-success">
            <span class="success-icon">✓</span>
            <span>{{ t('plugins.loginSuccess') }}</span>
            <el-button size="small" type="primary" text @click="goToWeixinChat" style="margin-left: auto">
              {{ t('plugins.viewWeixinMessages') }}
            </el-button>
            <el-button size="small" type="danger" text @click="disconnectWeixin" :loading="disconnecting">
              {{ t('plugins.disconnect') }}
            </el-button>
          </div>
        </div>

        <div class="plugin-section">
          <div class="plugin-section-title">{{ t('plugins.gatewayRestart') }}</div>
          <div class="plugin-section-desc">
            {{ t('plugins.gatewayRestartDesc') }}
          </div>
          <el-button @click="restartGateway" :loading="restarting">
            {{ t('plugins.restartGateway') }}
          </el-button>
          <span v-if="restartDone" class="restart-done">{{ t('plugins.gatewayRestarted') }}</span>
          <el-button v-if="restartDone" size="small" type="primary" text @click="goToWeixinChat" style="margin-left: 8px">
            {{ t('plugins.viewWeixinMessages') }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { useChatStore } from "@/stores/chat";
import { useGatewayStore } from "@/stores/gateway";
import { t } from "@/i18n";
import QRCode from "qrcode";

const router = useRouter();
const chatStore = useChatStore();
const gatewayStore = useGatewayStore();

const weixinEnabled = ref(false);
const weixinInstalled = ref(true);
const toggling = ref(false);
const loginActive = ref(false);
const loginStarting = ref(false);
const loginSuccess = ref(false);
const restarting = ref(false);
const restartDone = ref(false);
const disconnecting = ref(false);
const qrCanvasRef = ref<HTMLCanvasElement | null>(null);
const qrScanned = ref(false);
const qrError = ref("");
const qrStatusText = ref("");
// Fallback CLI-based login state
const useFallbackLogin = ref(false);
const loginOutput = ref("");
const terminalRef = ref<HTMLPreElement | null>(null);

let loginAborted = false;
let unsubLoginOutput: (() => void) | null = null;
let unsubLoginDone: (() => void) | null = null;

onMounted(async () => {
  try {
    const status = await window.openclaw.plugin.weixin.getStatus();
    weixinEnabled.value = status.enabled;
    weixinInstalled.value = status.installed;
    loginSuccess.value = status.loggedIn;
    gatewayStore.weixinLoggedIn = status.loggedIn;
    if (status.loginInProgress && !status.loggedIn) {
      loginActive.value = true;
      useFallbackLogin.value = true;
      loginOutput.value = t('plugins.loginInProgress');
    }
  } catch {}

  // Subscribe to fallback CLI login events
  unsubLoginOutput = window.openclaw.plugin.weixin.onLoginOutput((text) => {
    loginOutput.value += text;
    nextTick(() => {
      if (terminalRef.value) {
        terminalRef.value.scrollTop = terminalRef.value.scrollHeight;
      }
    });
  });

  unsubLoginDone = window.openclaw.plugin.weixin.onLoginDone(async (result) => {
    if (!useFallbackLogin.value) return;
    loginActive.value = false;
    useFallbackLogin.value = false;
    if (result.code === 0) {
      try {
        const status = await window.openclaw.plugin.weixin.getStatus();
        loginSuccess.value = status.loggedIn;
        gatewayStore.weixinLoggedIn = status.loggedIn;
      } catch {
        loginSuccess.value = true;
        gatewayStore.weixinLoggedIn = true;
      }
      ElMessage.success(t('plugins.loginSuccess'));
    } else {
      try {
        const status = await window.openclaw.plugin.weixin.getStatus();
        loginSuccess.value = status.loggedIn;
        gatewayStore.weixinLoggedIn = status.loggedIn;
      } catch {}
      if (!loginSuccess.value) {
        ElMessage.warning(t('plugins.loginEnded'));
      }
    }
  });
});

onUnmounted(() => {
  unsubLoginOutput?.();
  unsubLoginDone?.();
});

async function renderQrCode(dataUrl: string) {
  // Wait for canvas to be mounted
  await new Promise(r => setTimeout(r, 0));
  const canvas = qrCanvasRef.value;
  if (!canvas) return;
  try {
    await QRCode.toCanvas(canvas, dataUrl, {
      width: 240,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch (err) {
    console.error("[QR] Failed to render QR code:", err);
    qrError.value = t('plugins.qrRenderFailed');
  }
}

async function fetchAndRenderQr(force = false): Promise<boolean> {
  try {
    const result = await window.openclaw.plugin.weixin.loginQrStart({ force, accountId: "default" });
    if (!result.ok) {
      qrError.value = result.error || result.message;
      return false;
    }
    if (result.qrDataUrl) {
      qrError.value = "";
      qrScanned.value = false;
      qrStatusText.value = t('plugins.waitingScan');
      await renderQrCode(result.qrDataUrl);
      return true;
    }
    qrError.value = result.message;
    return false;
  } catch (err: any) {
    qrError.value = err.message || String(err);
    return false;
  }
}

async function startLogin() {
  loginStarting.value = true;
  loginSuccess.value = false;
  loginActive.value = true;
  qrError.value = "";
  qrScanned.value = false;
  loginAborted = false;
  useFallbackLogin.value = false;
  loginOutput.value = "";
  qrStatusText.value = t('plugins.waitingScan');

  // Try the fast gateway RPC path first
  try {
    const ok = await fetchAndRenderQr();
    if (ok) {
      loginStarting.value = false;
      await pollForLogin();
      return;
    }
  } catch {
    // Fast path failed — fall through to CLI
  }

  // Fallback: use the old CLI-based login (spawns subprocess)
  console.log("[weixin-login] Fast path unavailable, falling back to CLI login");
  useFallbackLogin.value = true;
  loginStarting.value = false;

  try {
    const result = await window.openclaw.plugin.weixin.login();
    if (!result.ok && result.error) {
      ElMessage.error(t('plugins.loginFailed', { error: result.error }));
      loginActive.value = false;
      useFallbackLogin.value = false;
    }
  } catch (err: any) {
    loginActive.value = false;
    useFallbackLogin.value = false;
    ElMessage.error(t('plugins.loginFailed', { error: err.message || err }));
  }
}

async function pollForLogin() {
  while (loginActive.value && !loginAborted) {
    try {
      const result = await window.openclaw.plugin.weixin.loginQrWait({
        accountId: "default",
        timeoutMs: 35_000, // match server long-poll timeout
      });

      console.log("[weixin-qr-poll] result:", JSON.stringify(result));

      if (loginAborted) return;

      if (result.connected) {
        // Login success
        loginActive.value = false;
        loginSuccess.value = true;
        gatewayStore.weixinLoggedIn = true;
        ElMessage.success(t('plugins.loginSuccess'));

        // Restart gateway to activate the channel
        mainWindow_restartGatewayAfterLogin();
        return;
      }

      // Check message for status hints
      if (result.message.includes("已扫码") || result.message.includes("scanned")) {
        qrScanned.value = true;
        qrStatusText.value = t('plugins.scannedWaiting');
      } else if (result.message.includes("过期") || result.message.includes("expired")) {
        // QR expired — refresh immediately
        qrScanned.value = false;
        qrStatusText.value = t('plugins.qrExpiredRefreshing');
        await fetchAndRenderQr(true);
      } else if (result.message.includes("没有进行中") || result.message.includes("no active")) {
        // Session lost, restart
        qrError.value = result.message;
        loginActive.value = false;
        return;
      }
      // Otherwise keep polling (status: "wait")
    } catch (err: any) {
      if (loginAborted) return;
      // Transient error, keep polling
      console.warn("[weixin-qr-poll] error:", err.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function mainWindow_restartGatewayAfterLogin() {
  try {
    await window.openclaw.gateway.restart();
  } catch (err: any) {
    console.error("[weixin-login] restart failed:", err.message);
  }
}

async function cancelLogin() {
  loginAborted = true;
  if (useFallbackLogin.value) {
    await window.openclaw.plugin.weixin.cancelLogin();
    useFallbackLogin.value = false;
  }
  loginActive.value = false;
  qrError.value = "";
  qrScanned.value = false;
  loginOutput.value = "";
}

async function disconnectWeixin() {
  try {
    await ElMessageBox.confirm(
      t('plugins.disconnectConfirm'),
      t('plugins.disconnect'),
      { confirmButtonText: t('plugins.confirm'), cancelButtonText: t('plugins.cancel'), type: 'warning' }
    );
  } catch {
    return; // User cancelled
  }

  disconnecting.value = true;
  try {
    const result = await window.openclaw.plugin.weixin.disconnect();
    if (result.ok) {
      loginSuccess.value = false;
      gatewayStore.weixinLoggedIn = false;
      ElMessage.success(t('plugins.disconnected'));
    } else {
      ElMessage.error(t('plugins.operationFailed', { error: result.error || "Unknown error" }));
    }
  } catch (err: any) {
    ElMessage.error(t('plugins.operationFailed', { error: err.message || err }));
  } finally {
    disconnecting.value = false;
  }
}

async function handleToggleEnabled(val: boolean) {
  toggling.value = true;
  try {
    await window.openclaw.plugin.weixin.setEnabled(val);
    weixinEnabled.value = val;
    if (val) {
      ElMessage.success(t('plugins.weixinEnabled'));
    } else {
      ElMessage.info(t('plugins.weixinDisabled'));
      loginSuccess.value = false;
    }
  } catch (err: any) {
    ElMessage.error(t('plugins.operationFailed', { error: err.message || err }));
    weixinEnabled.value = !val; // revert
  } finally {
    toggling.value = false;
  }
}

async function restartGateway() {
  restarting.value = true;
  restartDone.value = false;
  try {
    await window.openclaw.gateway.restart();
    restartDone.value = true;
    ElMessage.success(t('plugins.restartSuccess'));
    try {
      const status = await window.openclaw.plugin.weixin.getStatus();
      weixinEnabled.value = status.enabled;
      weixinInstalled.value = status.installed;
      loginSuccess.value = status.loggedIn;
      gatewayStore.weixinLoggedIn = status.loggedIn;
    } catch {}
  } catch (err: any) {
    ElMessage.error(t('plugins.restartFailed', { error: err.message || err }));
  } finally {
    restarting.value = false;
  }
}

function goToWeixinChat() {
  chatStore.switchSession("main");
  router.push("/chat");
}
</script>

<style scoped>
.plugins-view {
  height: 100%;
  overflow-y: auto;
  padding: 24px 32px;
  max-width: 720px;
}

.view-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}

.view-header h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.view-desc {
  color: var(--text-secondary);
  font-size: 13px;
  margin-top: 2px;
}

.back-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  flex-shrink: 0;
}

.back-btn:hover {
  background: var(--bg-tertiary);
}

/* Plugin card */
.plugin-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.plugin-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
}

.plugin-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(7, 193, 96, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.plugin-info {
  flex: 1;
  min-width: 0;
}

.plugin-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.plugin-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.plugin-toggle {
  flex-shrink: 0;
}

/* Plugin body */
.plugin-body {
  border-top: 1px solid var(--border);
  padding: 0 24px 24px;
}

.plugin-section {
  padding-top: 20px;
}

.plugin-section + .plugin-section {
  border-top: 1px solid var(--border-light);
  margin-top: 20px;
}

.plugin-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.plugin-section-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 14px;
}

/* Login QR code */
.login-qr-area {
  background: var(--bg-tertiary, #1a1a2e);
  border-radius: 8px;
  overflow: hidden;
  margin-top: 8px;
}

.qr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.qr-status-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.qr-body {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
}

.qr-canvas {
  border-radius: 4px;
}

.qr-scanned-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 14px;
  gap: 8px;
}

.qr-scanned-icon {
  font-size: 32px;
}

.qr-error {
  padding: 8px 12px;
  color: #ff6b6b;
  font-size: 12px;
}

/* Login terminal (CLI fallback) */
.login-terminal-area {
  background: #1a1a2e;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 8px;
}

.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.terminal-title {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.terminal-output {
  padding: 8px 12px;
  margin: 0;
  font-family: "Cascadia Code", "Consolas", "Courier New", monospace;
  font-size: 9px;
  line-height: 1.2;
  color: #e0e0e0;
  white-space: pre;
  overflow: auto;
  max-height: 480px;
  min-height: 120px;
}

/* Login success */
.login-success {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(52, 199, 89, 0.08);
  border-radius: 8px;
  color: #1a8a3e;
  font-size: 14px;
  font-weight: 500;
}

.success-icon {
  font-size: 18px;
  font-weight: bold;
}

/* Restart */
.restart-done {
  color: #1a8a3e;
  font-size: 13px;
  margin-left: 12px;
}

/* Not installed */
.plugin-badge.not-installed {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-muted);
  flex-shrink: 0;
}

.not-installed-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px;
  background: rgba(255, 149, 0, 0.06);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.notice-icon {
  color: #ff9500;
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}
</style>
