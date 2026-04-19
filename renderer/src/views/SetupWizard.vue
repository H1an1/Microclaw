<template>
  <div class="setup-view">
    <canvas ref="confettiCanvas" class="confetti-canvas"></canvas>
    <div class="setup-drag-region"></div>

    <!-- ── Step 1: Welcome ── -->
    <div v-if="step === 'welcome'" class="welcome-wrap">
      <button class="close-btn" @click="closeWindow" title="关闭">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <!-- Mascot -->
      <div class="mascot-wrap">
        <img :src="currentMascot" class="mascot-img" alt="mascot" />
      </div>

      <!-- Title: welcome text before install, cycles through 顺手/可信/懂你 during install -->
      <transition name="label-fade" mode="out-in">
        <h1 class="welcome-title" :key="installing ? currentPhrase : '__welcome__'">{{ installing ? currentPhrase : '欢迎来到 MicroClaw' }}</h1>
      </transition>

      <!-- Bottom area: fixed min-height to prevent mascot from jumping -->
      <div class="welcome-bottom">
        <p v-if="!installing" class="welcome-notice">
          点击"快速安装"，即表示你同意 MicroClaw<br>
          <a href="#" @click.prevent>服务协议</a>和<a href="#" @click.prevent>隐私声明</a>
        </p>
        <transition name="label-fade" mode="out-in">
          <p v-if="installing" class="welcome-notice welcome-notice--desc" :key="installStep.desc">{{ installStep.desc }}</p>
        </transition>

        <div v-if="installing" class="install-progress-wrap">
          <div class="install-progress-bar" :style="{ width: progress + '%' }"></div>
        </div>

        <template v-else>
          <button class="btn-primary" @click="handleQuickInstall">快速安装</button>
          <button class="btn-ghost" @click="step = 'setup'">自定义安装</button>
        </template>
      </div>
    </div>

    <!-- ── Step 2: Setup form ── -->
    <div v-else class="setup-wrap">
      <div class="setup-card">
        <button class="back-btn" @click="step = 'welcome'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <div class="setup-icon">⚡</div>
        <h2 class="setup-title">{{ t('setup.aiTitle') }}</h2>
        <p class="setup-desc">{{ t('setup.aiDesc') }}</p>

        <div class="setup-form">
          <div class="form-item">
            <label>{{ t('setup.apiFormat') }}</label>
            <select v-model="form.apiFormat" class="form-select">
              <option v-for="o in apiFormatOptions" :key="o.value" :value="o.value">{{ t(o.labelKey) }}</option>
            </select>
          </div>
          <div class="form-item">
            <label>Base URL</label>
            <input v-model="form.baseUrl" class="form-input" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="form-item">
            <label>API Key</label>
            <input v-model="form.apiKey" class="form-input" :type="showKey ? 'text' : 'password'" placeholder="sk-..." />
          </div>
          <div class="form-item">
            <label>{{ t('setup.modelName') }}</label>
            <input v-model="form.modelName" class="form-input" placeholder="gpt-4o" />
          </div>
          <div class="form-item">
            <label>{{ t('setup.reasoningEffort') }}</label>
            <select v-model="form.reasoningEffort" class="form-select">
              <option v-for="o in reasoningEffortOptions" :key="o.value" :value="o.value">{{ t(o.labelKey) }}</option>
            </select>
          </div>
          <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        </div>

        <button class="btn-primary" :class="{ loading: saving }" @click="saveAndFinish" :disabled="saving">
          {{ saving ? '保存中…' : t('setup.finishAndEnter') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from "vue";
import imgFold from "@/assets/welcom_fold.png";
import imgExpand from "@/assets/welcom_expand.png";
import imgStock from "@/assets/stock.png";
import imgArchaeologist from "@/assets/Archaeologist.png";
import imgAstronomer from "@/assets/Astronomer.png";
import imgCoder from "@/assets/Coder.png";
import imgDiviner from "@/assets/Diviner.png";
import imgGeologist from "@/assets/Geologist.png";
import imgLawyer from "@/assets/Lawyer.png";
import imgPainter from "@/assets/Painter.png";
import imgScientist from "@/assets/Scientist.png";
import imgSinger from "@/assets/Singer.png";

const identityImages = [
  imgArchaeologist, imgAstronomer, imgCoder, imgDiviner, imgGeologist,
  imgLawyer, imgPainter, imgScientist, imgSinger,
];

const installing = ref(false);
const progress = ref(0);
const currentMascot = ref(imgFold);
let welcomeToggleTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleExpandToggle() {
  welcomeToggleTimer = setTimeout(() => {
    currentMascot.value = imgExpand;
    launchConfetti();
    welcomeToggleTimer = null;
  }, 400);
}

const installSteps = [
  { title: '', desc: '' },
  { title: '顺手', desc: '不用再学 prompt' },
  { title: '可信', desc: '能拦、能改、能撤回' },
  { title: '懂你', desc: '符合你的工作模式' },
];
const installStepIdx = ref(0);
const installStep = computed(() => installSteps[installStepIdx.value]);

const installPhrases = ['顺手', '可信', '懂你'];
const installPhraseIdx = ref(-1);
const currentPhrase = computed(() => installPhraseIdx.value >= 0 ? installPhrases[installPhraseIdx.value] : '');
import { useRouter } from "vue-router";
import { t } from "@/i18n";

const confettiCanvas = ref<HTMLCanvasElement | null>(null);
let rafId: number | null = null;

function launchConfetti() {
  const canvasEl = confettiCanvas.value;
  if (!canvasEl) return;
  const ctx = canvasEl.getContext("2d");
  if (!ctx) return;
  canvasEl.width = canvasEl.offsetWidth;
  canvasEl.height = canvasEl.offsetHeight;

  const colors = ["#e8533a", "#f5a623", "#4cd964", "#5ac8fa", "#af52de", "#ff2d55", "#ffcc00", "#34aadc"];
  const cx = (canvasEl?.width || 0) / 2 + 70;
  const cy = (canvasEl?.height || 0) / 2 - 125;

  interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    w: number; h: number;
    color: string;
    angle: number; spin: number;
    alpha: number; decay: number;
    driftFreq: number; driftAmp: number; driftT: number;
  }

  const particles: Particle[] = Array.from({ length: 120 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      w: 6 + Math.random() * 6,
      h: 3 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.15,
      alpha: 1,
      decay: 0.005 + Math.random() * 0.004,
      driftFreq: 0.02 + Math.random() * 0.02,
      driftAmp: 0.3 + Math.random() * 0.5,
      driftT: Math.random() * Math.PI * 2,
    };
  });

  function draw() {
    ctx?.clearRect(0, 0, canvasEl?.width || 0, canvasEl?.height || 0);
    let alive = false;
    for (const p of particles) {
      if (p.alpha <= 0) continue;
      alive = true;
      p.vy += 0.035;
      p.vy *= 0.99;
      p.vx *= 0.995;
      p.driftT += p.driftFreq;
      p.x += p.vx + Math.sin(p.driftT) * p.driftAmp;
      p.y += p.vy;
      p.angle += p.spin;
      p.alpha -= p.decay;
      ctx?.save();
      if(ctx) ctx.globalAlpha = Math.max(0, p.alpha);
      ctx?.translate(p.x, p.y);
      ctx?.rotate(p.angle);
      if(ctx) ctx.fillStyle = p.color;
      ctx?.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx?.restore();
    }
    if (alive) rafId = requestAnimationFrame(draw);
    else ctx?.clearRect(0, 0, canvasEl?.width || 0, canvasEl?.height || 0);
  }

  rafId = requestAnimationFrame(draw);
}

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  if (welcomeToggleTimer !== null) clearTimeout(welcomeToggleTimer);
});

const router = useRouter();
const step = ref<'welcome' | 'setup'>('welcome')

function closeWindow() {
  window.dispatchEvent(new Event("setup:dismiss"))
}

async function handleQuickInstall() {
  if (welcomeToggleTimer !== null) { clearTimeout(welcomeToggleTimer); welcomeToggleTimer = null; }
  installing.value = true;
  progress.value = 0;
  installPhraseIdx.value = 0;
  installStepIdx.value = 1;

  const DURATION = 6400;
  const IMAGE_INTERVAL = Math.floor(DURATION / identityImages.length);
  const start = Date.now();

  currentMascot.value = imgStock;
  let imgIdx = 0;
  let imgCount = 0;
  const imgTimer = setInterval(() => {
    if (imgCount >= identityImages.length) return;
    currentMascot.value = identityImages[imgIdx];
    imgIdx = (imgIdx + 1) % identityImages.length;
    imgCount++;
  }, IMAGE_INTERVAL);

  const tick = () => {
    const elapsed = Date.now() - start;
    progress.value = Math.min((elapsed / DURATION) * 100, 100);

    // Each phrase gets exactly 1/3 of the duration, shown once
    const newPhraseIdx = Math.min(Math.floor((elapsed / DURATION) * 3), 2);
    if (newPhraseIdx !== installPhraseIdx.value) {
      installPhraseIdx.value = newPhraseIdx;
      installStepIdx.value = newPhraseIdx + 1;
    }

    if (elapsed < DURATION) {
      requestAnimationFrame(tick);
    } else {
      clearInterval(imgTimer);
      installPhraseIdx.value = -1;
      installStepIdx.value = 0;
      setTimeout(async () => {
        try { await (window as any).openclaw.setup.openMain() } catch {}
        window.dispatchEvent(new Event("setup:dismiss"));
      }, 300);
    }
  };
  requestAnimationFrame(tick);
}
const saving = ref(false);
const errorMsg = ref("");
const showKey = ref(false);

type ApiFormat = "openai-chat" | "openai-responses" | "anthropic";
type ReasoningEffort = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "adaptive";

const apiFormatOptions: Array<{ value: ApiFormat; labelKey: string }> = [
  { value: "openai-chat", labelKey: "setup.apiFormatOpenAIChat" },
  { value: "openai-responses", labelKey: "setup.apiFormatOpenAIResponses" },
  { value: "anthropic", labelKey: "setup.apiFormatAnthropic" },
];

const reasoningEffortOptions: Array<{ value: ReasoningEffort; labelKey: string }> = [
  { value: "off", labelKey: "setup.reasoningOff" },
  { value: "minimal", labelKey: "setup.reasoningMinimal" },
  { value: "low", labelKey: "setup.reasoningLow" },
  { value: "medium", labelKey: "setup.reasoningMedium" },
  { value: "high", labelKey: "setup.reasoningHigh" },
  { value: "xhigh", labelKey: "setup.reasoningXHigh" },
  { value: "adaptive", labelKey: "setup.reasoningAdaptive" },
];

function normalizeApiFormat(value: unknown): ApiFormat {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "anthropic" || normalized === "anthropic-messages") return "anthropic";
  if (normalized === "openai-responses" || normalized === "responses" || normalized === "response") return "openai-responses";
  return "openai-chat";
}

function normalizeReasoningEffort(value: unknown, fallback: ReasoningEffort = "off"): ReasoningEffort {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["off","minimal","low","medium","high","xhigh","adaptive"].includes(normalized)) return normalized as ReasoningEffort;
  return fallback;
}

function resolveApiValue(apiFormat: ApiFormat): string {
  if (apiFormat === "anthropic") return "anthropic-messages";
  if (apiFormat === "openai-responses") return "openai-responses";
  return "openai-completions";
}

function resolveProviderId(apiFormat: ApiFormat): string {
  return apiFormat === "anthropic" ? "anthropic" : "custom";
}

function ensureReasoningPreset(): void {
  if (form.apiFormat === "openai-responses" && form.reasoningEffort === "off") {
    form.reasoningEffort = "low";
  }
}

const form = reactive({
  apiFormat: "openai-chat" as ApiFormat,
  apiKey: "",
  baseUrl: "",
  modelName: "",
  reasoningEffort: "off" as ReasoningEffort,
});

watch(() => form.apiFormat, () => ensureReasoningPreset());

onMounted(async () => {
  scheduleExpandToggle();
  // TODO: restore redirect after preview
  // try {
  //   const needs = await window.openclaw.config.needsSetup();
  //   if (!needs) { router.replace("/home"); return; }
  // } catch {}

  try {
    const env = await window.openclaw.config.readEnv();
    if (env) {
      const envApiFormat = env.OPENCLAW_MODEL_API_FORMAT || env.MODEL_API_FORMAT;
      const envReasoning = env.OPENCLAW_MODEL_REASONING_EFFORT || env.MODEL_REASONING_EFFORT || env.OPENCLAW_MODEL_THINKING || env.MODEL_THINKING;
      if (envApiFormat) form.apiFormat = normalizeApiFormat(envApiFormat);
      if (env.MODEL_BASE_URL) form.baseUrl = env.MODEL_BASE_URL;
      if (env.OPENCLAW_MODEL_API_KEY || env.MODEL_API_KEY) form.apiKey = env.OPENCLAW_MODEL_API_KEY || env.MODEL_API_KEY;
      if (env.MODEL_NAME) form.modelName = env.MODEL_NAME;
      if (envReasoning) form.reasoningEffort = normalizeReasoningEffort(envReasoning);
    }
  } catch {}

  try {
    const config = await window.openclaw.config.read();
    if (config?.models?.providers) {
      const providers = config.models.providers;
      const modelDefaults = config.agents?.defaults?.models ?? {};
      for (const key of Object.keys(providers)) {
        const p = providers[key];
        if (p.apiKey && !form.apiKey) form.apiKey = p.apiKey;
        if (p.baseUrl && !form.baseUrl) form.baseUrl = p.baseUrl;
        const modelId = p.models?.[0]?.id;
        const apiFormat = normalizeApiFormat(p.api);
        const modelRef = modelId ? `${key}/${modelId}` : undefined;
        const reasoningFallback = p.models?.[0]?.reasoning === true || apiFormat === "openai-responses" ? "low" : "off";
        form.apiFormat = apiFormat;
        if (modelId && !form.modelName) form.modelName = modelId;
        if (modelRef) {
          form.reasoningEffort = normalizeReasoningEffort(modelDefaults[modelRef]?.params?.thinking, reasoningFallback);
        }
        break;
      }
    }
  } catch {}
});

async function saveAndFinish() {
  errorMsg.value = "";
  if (!form.apiKey.trim()) { errorMsg.value = t('setup.enterApiKey'); return; }
  saving.value = true;
  try {
    const existing = (await window.openclaw.config.read()) || {};
    const apiMapping = resolveApiValue(form.apiFormat);
    const modelId = form.modelName.trim() || (form.apiFormat === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o");
    const providerId = resolveProviderId(form.apiFormat);
    const modelRef = `${providerId}/${modelId}`;
    const reasoningEffort = normalizeReasoningEffort(form.reasoningEffort);
    const reasoningEnabled = form.apiFormat === "openai-responses" || reasoningEffort !== "off";

    const providerEntry: Record<string, any> = {
      ...(form.baseUrl.trim() ? { baseUrl: form.baseUrl.trim() } : {}),
      apiKey: form.apiKey.trim(),
      api: apiMapping,
      models: [{ id: modelId, name: modelId, ...(reasoningEnabled ? { reasoning: true } : {}), ...(form.apiFormat !== "anthropic" ? { input: ["text", "image"] } : {}) }],
    };

    if (!existing.models) existing.models = { mode: "merge", providers: {} };
    if (!existing.models.providers) existing.models.providers = {};
    existing.models.providers[providerId] = providerEntry;

    if (!existing.agents) existing.agents = { defaults: {} };
    if (!existing.agents.defaults) existing.agents.defaults = {};
    if (!existing.agents.defaults.model) existing.agents.defaults.model = {};
    existing.agents.defaults.model.primary = `${providerId}/${modelId}`;

    if (form.apiFormat === "openai-responses" || reasoningEffort !== "off") {
      if (!existing.agents.defaults.models) existing.agents.defaults.models = {};
      const existingModelConfig = typeof existing.agents.defaults.models[modelRef] === "object" && existing.agents.defaults.models[modelRef] ? existing.agents.defaults.models[modelRef] : {};
      existing.agents.defaults.models[modelRef] = { ...existingModelConfig, params: { ...(existingModelConfig.params ?? {}), thinking: reasoningEffort } };
    }

    if (!existing.gateway) {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      existing.gateway = { port: 18789, bind: "loopback", mode: "local", auth: { mode: "token", token } };
    }

    await window.openclaw.config.write(existing);
    try {
      await (window as any).openclaw.setup.openMain();
    } catch {}
    window.location.reload();
  } catch (err: any) {
    errorMsg.value = t('setup.saveFailed', { error: err.message || String(err) });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.setup-view {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  overflow: hidden;
}

.confetti-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.setup-drag-region {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 36px;
  -webkit-app-region: drag;
}

/* ── Close button ── */
.close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: background 0.15s, color 0.15s;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* ── Welcome step ── */
.welcome-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 360px;
  padding: 0;
  margin-bottom: 20px;
}

.mascot-wrap {
  width: 293px;
  height: 293px;
  margin-bottom: 0;
  position: relative;
}

.mascot-img {
  width: 293px;
  height: 293px;
  object-fit: contain;
  position: absolute;
  top: 0; left: 0;
}

.mascot-fade-enter-active,
.mascot-fade-leave-active {
  transition: opacity 0.2s ease;
}
.mascot-fade-enter-from,
.mascot-fade-leave-to {
  opacity: 0;
}

.label-fade-enter-active,
.label-fade-leave-active {
  transition: opacity 0.2s ease;
}
.label-fade-enter-from,
.label-fade-leave-to {
  opacity: 0;
}

.install-progress-wrap {
  width: 200px;
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 12px;
}

.install-progress-bar {
  height: 100%;
  background: var(--text-primary);
  border-radius: 99px;
  transition: width 0.1s linear;
}

.welcome-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.03em;
  margin-top: -32px;
  margin-bottom: 6px;
  text-align: center;
  min-height: 30px;
  line-height: 1.25;
}

.welcome-sub {
  font-size: 15px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 4px;
  letter-spacing: 0.04em;
}

.welcome-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 140px;
}

.welcome-notice {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  margin-bottom: 10px;
  line-height: 1.7;
  max-width: 280px;
}

.welcome-notice--desc {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
}

.welcome-notice a {
  color: var(--text-secondary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ── Shared buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px 28px;
  border-radius: 20px;
  border: 1px solid transparent;
  background: var(--text-primary);
  color: var(--bg-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s;
  margin-bottom: 4px;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-ghost {
  width: 100%;
  height: 40px;
  border-radius: 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: color 0.15s;
}

.btn-ghost:hover {
  color: var(--text-primary);
}

/* ── Setup form step ── */
.setup-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 24px;
}

.setup-card {
  width: 420px;
  background: var(--bg-secondary);
  border: 0.5px solid var(--border);
  border-radius: 20px;
  padding: 32px 28px 28px;
  position: relative;
}

.back-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.15s;
}

.back-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.setup-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 14px;
  background: var(--text-primary);
  border-radius: 13px;
  display: grid;
  place-items: center;
  font-size: 24px;
}

.setup-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 4px;
  letter-spacing: -0.02em;
}

.setup-desc {
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
  margin-bottom: 24px;
}

/* ── Form fields ── */
.setup-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-input,
.form-select {
  height: 38px;
  padding: 0 12px;
  background: var(--bg-primary);
  border: 0.5px solid var(--border);
  border-radius: 10px;
  font-size: 14px;
  font-family: inherit;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s;
  appearance: none;
  -webkit-appearance: none;
}

.form-input:focus,
.form-select:focus {
  border-color: var(--text-muted);
}

.form-input::placeholder {
  color: var(--text-muted);
}

.error-msg {
  font-size: 12.5px;
  color: var(--danger);
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.06);
  border-radius: 8px;
}
</style>
