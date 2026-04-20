import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      redirect: "/chat",
    },
    {
      path: "/home",
      redirect: "/chat",
    },
    {
      path: "/chat/:agentId?",
      name: "chat",
      component: () => import("@/views/ChatView.vue"),
    },
    {
      path: "/profile/:agentId",
      name: "profile",
      redirect: (to) => {
        const agentId = typeof to.params.agentId === 'string' ? to.params.agentId : ''
        return {
          path: `/chat/${agentId}`,
          query: { panel: 'profile', profileAgentId: agentId },
        }
      },
    },
    {
      path: "/settings/:section?",
      name: "settings",
      component: () => import("@/views/SettingsView.vue"),
    },
    {
      path: "/setup",
      name: "setup",
      component: () => import("@/views/SetupWizard.vue"),
    },
    {
      path: "/tasks",
      name: "tasks",
      component: () => import("@/views/TasksView.vue"),
    },
    {
      path: "/phone",
      name: "phone",
      component: () => import("@/views/PhoneView.vue"),
    },
    {
      path: "/explore",
      name: "explore",
      component: () => import("@/views/ExploreView.vue"),
    },
    {
      path: "/plugins",
      name: "plugins",
      component: () => import("@/views/PluginsView.vue"),
    },
    {
      path: "/new-agent",
      name: "new-agent",
      component: () => import("@/views/NewAgentView.vue"),
    },
  ],
});

export default router;
