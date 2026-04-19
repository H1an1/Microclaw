<template>
  <FeaturePlaceholder
    badge="Explore Workspace"
    title="探索页占位中"
    description="这里先作为探索页的占位页。后面可以接技能发现、模板推荐、示例任务和场景导航。"
    footer="目前先把导航和页面结构打通，等你开始设计探索体验时，可以直接把占位内容换成真实信息架构。"
    :cards="cards"
  />
</template>

<script setup lang="ts">
import FeaturePlaceholder from "@/components/FeaturePlaceholder.vue";

const cards = [
  {
    icon: "*",
    title: "技能发现",
    description: "预留推荐技能、常用能力入口和分类浏览区块。",
  },
  {
    icon: "~",
    title: "灵感模板",
    description: "预留任务模板、常见 prompt 和精选用例卡片。",
  },
  {
    icon: "->",
    title: "场景导航",
    description: "预留按工作、生活、创作等场景组织能力的首页结构。",
  },
];
</script>