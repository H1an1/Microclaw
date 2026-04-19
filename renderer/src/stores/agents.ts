import { defineStore } from "pinia";
import { ref } from "vue";
import { t } from "../i18n";

export interface Agent {
  id: string;
  name: string;
  description?: string;
}

export const useAgentStore = defineStore("agents", () => {
  const agents = ref<Agent[]>([
    { id: "main", name: t("store.defaultAgent"), description: t("store.defaultAgentDesc") },
  ]);
  const currentAgentId = ref("main");

  async function fetchAgents() {
    try {
      const result = await window.openclaw.agents.list();
      if (result.agents && result.agents.length > 0) {
        agents.value = result.agents as Agent[];
      }
    } catch {
      // Gateway may not support agents.list yet — keep defaults
    }
  }

  return { agents, currentAgentId, fetchAgents };
});
