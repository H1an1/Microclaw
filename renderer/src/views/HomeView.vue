<template>
  <div class="home-redirect" aria-hidden="true"></div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

onMounted(() => {
  router.replace("/chat");
});
</script>

<style scoped>
.home-redirect {
  width: 100%;
  height: 100%;
}
</style>
