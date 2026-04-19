import { defineStore } from "pinia";
import { ref } from "vue";

export const useGatewayStore = defineStore("gateway", () => {
  const status = ref("stopped");
  const port = ref(0);
  const logs = ref<string[]>([]);
  /** Once true the loading gate in App.vue stays hidden. Reset on explicit gateway restart. */
  const ready = ref(true);
  /** WeChat plugin login status — shared across Sidebar & PluginsView. */
  const weixinLoggedIn = ref(false);

  function addLog(msg: string) {
    logs.value.push(msg);
    // Trim with hysteresis to avoid re-slicing on every line
    if (logs.value.length > 600) {
      logs.value = logs.value.slice(-500);
    }
  }

  /** Called when the first WS connection succeeds (hides loading screen). */
  function markReady() {
    if (ready.value) return;
    ready.value = true;
  }

  /** Reset the loading gate so the GatewayLoading overlay reappears. */
  function resetReady() {
    ready.value = false;
  }

  /** Re-check WeChat login status from main process. */
  async function refreshWeixinStatus() {
    try {
      const s = await window.openclaw.plugin.weixin.getStatus();
      weixinLoggedIn.value = s.loggedIn;
    } catch {
      weixinLoggedIn.value = false;
    }
  }

  return { status, port, logs, addLog, ready, markReady, resetReady, weixinLoggedIn, refreshWeixinStatus };
});
