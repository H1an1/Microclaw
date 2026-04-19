<template>
  <div class="tasks-view">

    <!-- Card grid -->
    <div class="tasks-empty">
      <h1 class="tasks-heading">选一个任务开始吧</h1>
      <div class="card-grid">
        <div class="task-card" v-for="card in cards" :key="card.id" @click="handleCardClick(card.id)">
          <div class="task-card-icon-box">
            <component :is="card.icon" />
          </div>
          <div class="task-card-body">
            <div class="task-card-title">
              {{ t(card.titleKey) }}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
              </svg>
            </div>
            <div class="task-card-desc">{{ t(card.descKey) }}</div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { h, type FunctionalComponent } from "vue";
import { useRouter } from "vue-router";
import { useChatStore } from "@/stores/chat";
import { t } from "@/i18n";

const chatStore = useChatStore();
const router = useRouter();

// ── Card icons ──
const IconNews: FunctionalComponent = () =>
  h("svg", { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "var(--text-primary)", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" }, [
    h("path", { d: "M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2" }),
    h("line", { x1: "10", y1: "6", x2: "18", y2: "6" }),
    h("line", { x1: "10", y1: "10", x2: "18", y2: "10" }),
    h("line", { x1: "10", y1: "14", x2: "14", y2: "14" }),
  ]);

const IconEmail: FunctionalComponent = () =>
  h("svg", { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "var(--text-primary)", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" }, [
    h("rect", { x: "2", y: "4", width: "20", height: "16", rx: "2" }),
    h("path", { d: "M22 7l-10 7L2 7" }),
  ]);

const IconDesktop: FunctionalComponent = () =>
  h("svg", { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "var(--text-primary)", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" }, [
    h("rect", { x: "2", y: "3", width: "20", height: "14", rx: "2" }),
    h("line", { x1: "8", y1: "21", x2: "16", y2: "21" }),
    h("line", { x1: "12", y1: "17", x2: "12", y2: "21" }),
  ]);

const IconTravel: FunctionalComponent = () =>
  h("svg", { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "var(--text-primary)", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" }, [
    h("path", { d: "M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" }),
  ]);

const IconInvoice: FunctionalComponent = () =>
  h("svg", { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "var(--text-primary)", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" }, [
    h("path", { d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" }),
    h("polyline", { points: "14 2 14 8 20 8" }),
    h("line", { x1: "8", y1: "13", x2: "16", y2: "13" }),
    h("line", { x1: "8", y1: "17", x2: "13", y2: "17" }),
  ]);

const IconStudy: FunctionalComponent = () =>
  h("svg", { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "var(--text-primary)", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" }, [
    h("path", { d: "M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" }),
    h("path", { d: "M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" }),
  ]);

const cards = [
  { id: "news",    titleKey: "home.card.news.title",    descKey: "home.card.news.desc",    icon: IconNews },
  { id: "email",   titleKey: "home.card.email.title",   descKey: "home.card.email.desc",   icon: IconEmail },
  { id: "desktop", titleKey: "home.card.desktop.title", descKey: "home.card.desktop.desc", icon: IconDesktop },
  { id: "travel",  titleKey: "home.card.travel.title",  descKey: "home.card.travel.desc",  icon: IconTravel },
  { id: "invoice", titleKey: "home.card.invoice.title", descKey: "home.card.invoice.desc", icon: IconInvoice },
  { id: "study",   titleKey: "home.card.study.title",   descKey: "home.card.study.desc",   icon: IconStudy },
];

function handleCardClick(cardId: string) {
  let prompt: string;
  switch (cardId) {
    case "desktop": prompt = t("home.desktopPrompt"); break;
    default: prompt = t(`home.card.${cardId}.title`); break;
  }
  chatStore.newSession();
  chatStore.pendingPrompt = prompt;
  router.push("/chat");
}
</script>

<style scoped>
.tasks-view {
  height: 100%;
  overflow-y: auto;
  background: var(--bg-primary);
}

/* ── Empty / card state ── */
.tasks-empty {
  padding: 48px 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tasks-heading {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 32px;
  letter-spacing: -0.02em;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  width: 100%;
  max-width: 720px;
}

.task-card {
  background: var(--bg-tertiary);
  border-radius: 18px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  transition: background 0.15s;
  border: 0.5px solid var(--border);
  min-height: 200px;
}

.task-card:hover {
  background: #ede8e4;
}

.task-card-icon-box {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: transparent;
  border: 1px solid rgba(39, 35, 32, 0.12);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.task-card-body {
  margin-top: auto;
}

.task-card-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  line-height: 1.3;
}

.task-card-title svg {
  opacity: 0;
  transition: opacity 0.15s;
}

.task-card:hover .task-card-title svg {
  opacity: 1;
}

.task-card-desc {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* ── Table state ── */
.tasks-table-wrap {
  padding: 24px 32px;
}

.view-header {
  margin-bottom: 24px;
}

.view-header h2 {
  font-size: 20px;
  font-weight: 600;
}

.view-desc {
  color: var(--text-secondary);
  font-size: 13px;
  margin-top: 4px;
}

/* ── Status states ── */
.status-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--text-muted);
}

.empty-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-desc {
  font-size: 13px;
  margin-top: 8px;
  text-align: center;
  max-width: 300px;
}

.text-muted {
  color: var(--text-muted);
}
</style>
