<template>
  <FeaturePlaceholder
    badge="Phone Workspace"
    title="手机页占位中"
    description="这里先作为手机联动的占位页。后面可以接设备连接、扫码绑定、通知同步和移动端接力控制。"
    footer="目前先保证切 tab 有独立页面，不再停留在聊天页；等你开始做手机 UX 时，直接在这里继续展开。"
    :cards="cards"
  />
</template>

<script setup lang="ts">
import FeaturePlaceholder from "@/components/FeaturePlaceholder.vue";

const cards = [
  {
    icon: "QR",
    title: "设备绑定",
    description: "预留扫码或授权配对入口，后面可以接手机端登录和设备信任。",
  },
  {
    icon: "!",
    title: "提醒同步",
    description: "预留消息提醒、任务完成通知和跨端状态同步的展示区域。",
  },
  {
    icon: ">>",
    title: "继续控制",
    description: "预留把桌面上的任务接力到手机端继续查看或操作的入口。",
  },
];
</script>