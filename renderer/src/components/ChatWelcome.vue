<template>
  <div v-if="mode === 'hero'" class="welcome-state">
    <h1 class="welcome-heading">{{ t('home.heading1') }}<br>{{ t('home.heading2') }}</h1>
    <p class="welcome-subheading">{{ t('home.subheading') }}</p>
    <div class="fan-container">
      <div
        v-for="card in heroCards"
        :key="card.id"
        class="fan-card"
        :class="`fan-card--${card.id}`"
        :style="card.style"
        @click="emit('select', t(card.promptKey))"
      >
        <div class="fan-card-img-area">
          <img :src="card.image" class="fan-card-img" alt="" />
        </div>
        <div class="fan-card-body">
          <div class="fan-card-name">{{ t(card.titleKey) }}</div>
          <div class="fan-card-desc">{{ t(card.descKey) }}</div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="compose-suggestions">
    <button v-if="suggestionsScrolled" class="suggestions-arrow" @click="scrollSuggestions(-1)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
    <div class="suggestions-scroll" ref="suggestionsScrollRef" @scroll="onSuggestionsScroll">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion.label"
        class="suggestion-chip"
        @click="emit('select', suggestion.prompt)"
      >{{ suggestion.label }}</button>
    </div>
    <button class="suggestions-arrow" @click="scrollSuggestions(1)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { t } from "@/i18n";
import dailyNewsImg from "@/assets/daily news.png";
import emailImg from "@/assets/email.png";
import travelImg from "@/assets/travel.png";

defineProps<{
  mode: "hero" | "chips";
}>();

const emit = defineEmits<{
  select: [prompt: string];
}>();

const heroCards = [
  {
    id: "news",
    image: dailyNewsImg,
    titleKey: "home.card.news.title",
    descKey: "home.card.news.desc",
    promptKey: "home.card.news.title",
    style: "--rot: 12deg; --dx: 55px; z-index: 3",
  },
  {
    id: "email",
    image: emailImg,
    titleKey: "home.card.email.title",
    descKey: "home.card.email.desc",
    promptKey: "home.card.email.title",
    style: "--rot: 0deg; z-index: 2",
  },
  {
    id: "travel",
    image: travelImg,
    titleKey: "home.card.travel.title",
    descKey: "home.card.travel.desc",
    promptKey: "home.card.travel.prompt",
    style: "--rot: -12deg; --dx: -55px; z-index: 1",
  },
];

const suggestions = [
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
];

const suggestionsScrollRef = ref<HTMLDivElement>();
const suggestionsScrolled = ref(false);

function scrollSuggestions(dir: 1 | -1) {
  const el = suggestionsScrollRef.value;
  if (!el) return;
  el.scrollBy({ left: dir * 160, behavior: "smooth" });
}

function onSuggestionsScroll() {
  const el = suggestionsScrollRef.value;
  if (!el) return;
  suggestionsScrolled.value = el.scrollLeft > 0;
}
</script>

<style scoped>
.welcome-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 48px 0;
  overflow: hidden;
  flex: 1;
}

.welcome-heading {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 8px;
  letter-spacing: -0.02em;
  line-height: 1.4;
}

.welcome-subheading {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 48px;
}

.fan-container {
  position: relative;
  width: 100%;
  max-width: 700px;
  height: 380px;
  flex-shrink: 0;
}

.fan-card {
  position: absolute;
  left: 50%;
  bottom: 40px;
  width: 260px;
  height: 340px;
  margin-left: -130px;
  transform-origin: center bottom;
  transform: translateX(var(--dx, 0px)) rotate(var(--rot));
  transition: transform 0.28s cubic-bezier(0.34, 1.5, 0.64, 1), box-shadow 0.28s ease;
  cursor: pointer;
  border-radius: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.11), 0 1px 4px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.fan-card:hover {
  transform: translateX(var(--dx, 0px)) rotate(var(--rot)) translateY(-38px);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.14), 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 100 !important;
}

.fan-card--news { background: #edeae2; --card-bg: #edeae2; }
.fan-card--email { background: #f0e8da; --card-bg: #f0e8da; }
.fan-card--travel { background: #eceae8; --card-bg: #eceae8; }

.fan-card::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 48%;
  height: 110px;
  background: linear-gradient(to bottom, var(--card-bg) 20%, transparent 100%);
  z-index: 1;
  pointer-events: none;
}

.fan-card-body {
  position: absolute;
  top: 22px;
  left: 20px;
  max-width: 60%;
  z-index: 2;
}

.fan-card-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  margin-bottom: 6px;
  line-height: 1.3;
}

.fan-card-desc {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.55;
}

.fan-card-img-area {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 68%;
}

.fan-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: bottom center;
  display: block;
}

.compose-suggestions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.suggestions-scroll {
  display: flex;
  gap: 8px;
  overflow: hidden;
  flex: 1;
  scroll-behavior: smooth;
}

.suggestions-arrow {
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

.suggestions-arrow:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.suggestion-chip {
  padding: 6px 14px;
  border-radius: 20px;
  border: 0.5px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.suggestion-chip:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
</style>
