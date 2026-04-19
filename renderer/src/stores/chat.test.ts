import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// ── Mock window.openclaw ──
const mockLoadHistory = vi.fn().mockResolvedValue({ messages: [] });
const mockSendMessage = vi.fn().mockResolvedValue(undefined);
const mockAbort = vi.fn().mockResolvedValue(undefined);
const mockIsConnected = vi.fn().mockResolvedValue(false);

Object.defineProperty(globalThis, "window", {
  value: {
    ...globalThis.window,
    openclaw: {
      chat: {
        loadHistory: mockLoadHistory,
        sendMessage: mockSendMessage,
        abort: mockAbort,
        isConnected: mockIsConnected,
        onEvent: vi.fn(),
        onToolEvent: vi.fn(),
        onExecCommand: vi.fn(),
      },
      config: { needsSetup: vi.fn().mockResolvedValue(false) },
      gateway: {
        getPort: vi.fn().mockResolvedValue(18789),
        getStatus: vi.fn().mockResolvedValue("running"),
        onStatus: vi.fn(),
        onLog: vi.fn(),
        onWsConnected: vi.fn(),
        onWsDisconnected: vi.fn(),
        restart: vi.fn(),
      },
      settings: { get: vi.fn().mockResolvedValue({}) },
      sandbox: { onPermissionRequest: vi.fn() },
      skills: { pendingIntegrityResult: vi.fn().mockResolvedValue(null) },
      cron: { list: vi.fn().mockResolvedValue({ jobs: [] }) },
    },
  },
  writable: true,
});

// Mock localStorage for sessions store dependency
const storage: Record<string, string> = {};
if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
    },
    writable: true,
  });
}

import { useChatStore } from "./chat";
// ChatEventPayload is declared globally in env.d.ts

describe("useChatStore — stale stream recovery", () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockLoadHistory.mockResolvedValue({ messages: [] });
  });

  it("initialises lastStreamEventAt as null", () => {
    const store = useChatStore();
    expect(store.lastStreamEventAt).toBeNull();
  });

  it("checkStaleStream is a no-op when not streaming", () => {
    const store = useChatStore();
    store.checkStaleStream();
    expect(store.streaming).toBe(false);
  });

  it("checkStaleStream does not reset streaming within the timeout window", () => {
    const store = useChatStore();
    // Simulate an active stream
    store.streaming = true;
    store.streamStartedAt = Date.now();
    (store as any).lastStreamEventAt = Date.now();

    store.checkStaleStream();
    expect(store.streaming).toBe(true);
  });

  it("checkStaleStream resets streaming after the timeout elapses", () => {
    const store = useChatStore();
    store.streaming = true;
    store.streamStartedAt = Date.now() - 100_000; // 100 seconds ago
    (store as any).lastStreamEventAt = Date.now() - 100_000;

    store.checkStaleStream(); // default 90s threshold
    expect(store.streaming).toBe(false);
    expect(store.chatRunId).toBeNull();
    expect(store.streamStartedAt).toBeNull();
    expect(store.lastStreamEventAt).toBeNull();
    expect(mockLoadHistory).toHaveBeenCalled();
  });

  it("checkStaleStream respects a custom (shorter) timeout", () => {
    const store = useChatStore();
    store.streaming = true;
    store.streamStartedAt = Date.now() - 35_000; // 35 seconds ago
    (store as any).lastStreamEventAt = Date.now() - 35_000;

    // Default 90s — should NOT reset
    store.checkStaleStream();
    expect(store.streaming).toBe(true);

    // Custom 30s — SHOULD reset
    store.checkStaleStream(30_000);
    expect(store.streaming).toBe(false);
  });

  it("checkStaleStream falls back to streamStartedAt when no events were received", () => {
    const store = useChatStore();
    store.streaming = true;
    store.streamStartedAt = Date.now() - 100_000;
    // lastStreamEventAt is null — no events ever arrived

    store.checkStaleStream();
    expect(store.streaming).toBe(false);
  });

  it("checkStaleStream extends timeout when a tool call is in progress", () => {
    const store = useChatStore();
    store.streaming = true;
    store.streamStartedAt = Date.now() - 200_000; // 200 seconds ago
    (store as any).lastStreamEventAt = Date.now() - 200_000;
    // A tool call is still running (e.g. a long build command)
    store.streamToolCalls = [
      { id: "tc1", name: "exec", done: false },
    ];

    // Default 90s would trigger, but active tool bumps to 10 min
    store.checkStaleStream();
    expect(store.streaming).toBe(true);
  });

  it("checkStaleStream resets even with active tool after extended timeout", () => {
    const store = useChatStore();
    store.streaming = true;
    store.streamStartedAt = Date.now() - 700_000; // 700 seconds ago
    (store as any).lastStreamEventAt = Date.now() - 700_000;
    store.streamToolCalls = [
      { id: "tc1", name: "exec", done: false },
    ];

    // 700s > 600s (10 min active-tool threshold) → should reset
    store.checkStaleStream();
    expect(store.streaming).toBe(false);
  });

  it("checkStaleStream uses normal timeout when all tool calls are done", () => {
    const store = useChatStore();
    store.streaming = true;
    store.streamStartedAt = Date.now() - 100_000;
    (store as any).lastStreamEventAt = Date.now() - 100_000;
    // Tool call is completed — no active tools
    store.streamToolCalls = [
      { id: "tc1", name: "exec", done: true },
    ];

    // 100s > 90s default → should reset (no active tool protection)
    store.checkStaleStream();
    expect(store.streaming).toBe(false);
  });

  it("handleChatEvent updates lastStreamEventAt on delta", () => {
    const store = useChatStore();
    store.streaming = true;
    store.sessionKey = "main";
    store.resolvedSessionKey = "agent:main:main";

    const before = Date.now();
    store.handleChatEvent({
      runId: "r1",
      sessionKey: "agent:main:main",
      state: "delta",
      message: { role: "assistant", content: "Hello" },
    } as ChatEventPayload);

    expect(store.lastStreamEventAt).toBeGreaterThanOrEqual(before);
    expect(store.lastStreamEventAt).toBeLessThanOrEqual(Date.now());
  });

  it("handleChatEvent clears lastStreamEventAt on final", () => {
    const store = useChatStore();
    store.streaming = true;
    store.sessionKey = "main";
    store.resolvedSessionKey = "agent:main:main";
    (store as any).lastStreamEventAt = Date.now();

    store.handleChatEvent({
      runId: "r1",
      sessionKey: "agent:main:main",
      state: "final",
      message: { role: "assistant", content: "Done" },
    } as ChatEventPayload);

    expect(store.streaming).toBe(false);
    expect(store.lastStreamEventAt).toBeNull();
  });

  it("handleChatEvent clears lastStreamEventAt on aborted", () => {
    const store = useChatStore();
    store.streaming = true;
    store.sessionKey = "main";
    store.resolvedSessionKey = "agent:main:main";
    (store as any).lastStreamEventAt = Date.now();

    store.handleChatEvent({
      runId: "r1",
      sessionKey: "agent:main:main",
      state: "aborted",
    } as ChatEventPayload);

    expect(store.streaming).toBe(false);
    expect(store.lastStreamEventAt).toBeNull();
  });

  it("handleChatEvent clears lastStreamEventAt on error", () => {
    const store = useChatStore();
    store.streaming = true;
    store.sessionKey = "main";
    store.resolvedSessionKey = "agent:main:main";
    (store as any).lastStreamEventAt = Date.now();

    store.handleChatEvent({
      runId: "r1",
      sessionKey: "agent:main:main",
      state: "error",
      errorMessage: "boom",
    } as ChatEventPayload);

    expect(store.streaming).toBe(false);
    expect(store.lastStreamEventAt).toBeNull();
  });

  it("handleToolEvent updates lastStreamEventAt", () => {
    const store = useChatStore();
    store.streaming = true;
    store.sessionKey = "main";
    store.resolvedSessionKey = "agent:main:main";

    const before = Date.now();
    store.handleToolEvent({
      runId: "r1",
      sessionKey: "agent:main:main",
      stream: "tool",
      data: { phase: "start", name: "exec", toolCallId: "tc1" },
    });

    expect(store.lastStreamEventAt).toBeGreaterThanOrEqual(before);
  });

  it("checkStaleStream clears streamToolCalls", () => {
    const store = useChatStore();
    store.streaming = true;
    store.streamStartedAt = Date.now() - 100_000;
    (store as any).lastStreamEventAt = Date.now() - 100_000;
    // All tool calls are done — no active-tool protection
    store.streamToolCalls = [
      { id: "tc1", name: "exec", done: true },
    ];

    store.checkStaleStream();
    expect(store.streaming).toBe(false);
    expect(store.streamToolCalls).toEqual([]);
  });
});

describe("useChatStore — recoverAfterReconnect", () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockLoadHistory.mockResolvedValue({ messages: [] });
  });

  it("is a no-op when not streaming", async () => {
    const store = useChatStore();
    store.streaming = false;
    const callsBefore = mockLoadHistory.mock.calls.length;
    await store.recoverAfterReconnect();
    expect(store.streaming).toBe(false);
    // recoverAfterReconnect should not have called loadHistory
    expect(mockLoadHistory.mock.calls.length).toBe(callsBefore);
  });

  it("resets streaming when server has more messages", async () => {
    const store = useChatStore();
    store.streaming = true;
    store.sessionKey = "main";
    store.resolvedSessionKey = "agent:main:main";
    store.messages = [
      { role: "user", content: "Hello" },
    ];
    // Server returned 2 messages (user + assistant final)
    mockLoadHistory.mockResolvedValue({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ],
    });

    await store.recoverAfterReconnect();
    expect(store.streaming).toBe(false);
    expect(store.streamToolCalls).toEqual([]);
    expect(store.lastStreamEventAt).toBeNull();
  });

  it("stays streaming when server has same message count (task still running)", async () => {
    const store = useChatStore();
    store.streaming = true;
    store.sessionKey = "main";
    store.resolvedSessionKey = "agent:main:main";
    store.messages = [
      { role: "user", content: "Hello" },
    ];
    // Server still has only the user message — task is still running
    mockLoadHistory.mockResolvedValue({
      messages: [
        { role: "user", content: "Hello" },
      ],
    });

    await store.recoverAfterReconnect();
    expect(store.streaming).toBe(true);
  });

  it("works correctly even with active tool calls", async () => {
    const store = useChatStore();
    store.streaming = true;
    store.sessionKey = "main";
    store.resolvedSessionKey = "agent:main:main";
    store.messages = [
      { role: "user", content: "Build the project" },
    ];
    // Active tool call (long-running)
    store.streamToolCalls = [
      { id: "tc1", name: "exec", done: false },
    ];
    // But server says it's done
    mockLoadHistory.mockResolvedValue({
      messages: [
        { role: "user", content: "Build the project" },
        { role: "assistant", content: "Build complete." },
      ],
    });

    await store.recoverAfterReconnect();
    // Should reset despite active tool call — server is authoritative
    expect(store.streaming).toBe(false);
    expect(store.streamToolCalls).toEqual([]);
  });

  it("tolerates loadHistory failure gracefully", async () => {
    const store = useChatStore();
    store.streaming = true;
    store.sessionKey = "main";
    mockLoadHistory.mockRejectedValue(new Error("network error"));

    // Should not throw — falls back to stale-stream poll
    await store.recoverAfterReconnect();
    expect(store.streaming).toBe(true); // unchanged
  });
});

describe("useChatStore — session key learning", () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockLoadHistory.mockResolvedValue({ messages: [] });
  });

  it("learns the resolved session key from first delta event", () => {
    const store = useChatStore();
    store.streaming = true;
    store.sessionKey = "main";

    store.handleChatEvent({
      runId: "r1",
      sessionKey: "agent:main:main",
      state: "delta",
      message: { role: "assistant", content: "Hi" },
    } as ChatEventPayload);

    expect(store.resolvedSessionKey).toBe("agent:main:main");
  });

  it("drops events from unrelated sessions", () => {
    const store = useChatStore();
    store.streaming = true;
    store.sessionKey = "session-abc";
    store.resolvedSessionKey = "agent:main:session-abc";

    // Event from a completely different session
    store.handleChatEvent({
      runId: "r2",
      sessionKey: "agent:main:session-xyz",
      state: "final",
      message: { role: "assistant", content: "Wrong session" },
    } as ChatEventPayload);

    // Should still be streaming (event was dropped)
    expect(store.streaming).toBe(true);
  });
});
