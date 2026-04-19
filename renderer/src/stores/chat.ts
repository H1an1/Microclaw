import { defineStore } from "pinia";
import { ref } from "vue";
import { useSessionStore } from "./sessions";
import { scanPii, redactPii, type ScanOptions } from "@/utils/pii-scanner";

/**
 * Chat store — mirrors the webchat gateway protocol.
 *
 * Key differences from the old HTTP/SSE approach:
 * - Server (gateway) keeps the full conversation history per sessionKey.
 * - We only send the message text, not the full history.
 * - Streaming arrives as `chat` events (delta / final / aborted / error).
 * - `loadHistory` fetches persisted messages from the server.
 */

export interface ChatMessage {
  role: string;
  content: unknown; // string or content-block array
  timestamp?: number;
  text?: string;
}

export const useChatStore = defineStore("chat", () => {
  // ── State ──
  const sessionKey = ref("main");
  /** The resolved session key returned by the gateway (may differ from what we send). */
  const resolvedSessionKey = ref<string | null>(null);
  const messages = ref<ChatMessage[]>([]);
  const loading = ref(false);
  const sending = ref(false);
  const streaming = ref(false);
  const streamText = ref("");
  const streamToolCalls = ref<{ id: string; name: string; input?: string; done: boolean; waitingPermission?: boolean; actualCommand?: string; result?: string; isError?: boolean }[]>([]);
  /**
   * Completed tool calls keyed by assistant response count.
   * Key = number of assistant messages at time of completion.
   * Survives loadHistory since it's independent of messages[].
   */
  const completedToolCallsMap = ref<Record<number, { id: string; name: string; input?: string; actualCommand?: string; result?: string; isError?: boolean }[]>>({});
  const streamStartedAt = ref<number | null>(null);
  const chatRunId = ref<string | null>(null);
  const lastError = ref<string | null>(null);
  const wsConnected = ref(false);
  /** Timestamp of the last streaming event (delta, tool, final). Used for stale-stream detection. */
  const lastStreamEventAt = ref<number | null>(null);

  /** Prompt text to pre-fill in the chat input after navigation. */
  const pendingPrompt = ref<string | null>(null);

  /** Per-agent last message preview text */
  const lastMessageMap = ref<Record<string, string>>({});

  // ── Per-session streaming state cache ──
  // When switching away from a session that is still streaming,
  // we save its streaming state here so it can be restored later.
  interface SessionStreamState {
    streaming: boolean;
    streamText: string;
    streamToolCalls: { id: string; name: string; input?: string; done: boolean; waitingPermission?: boolean; actualCommand?: string; result?: string; isError?: boolean }[];
    completedToolCallsMap: Record<number, { id: string; name: string; input?: string; actualCommand?: string; result?: string; isError?: boolean }[]>;
    streamStartedAt: number | null;
    chatRunId: string | null;
    lastStreamEventAt: number | null;
    resolvedSessionKey: string | null;
    messages: ChatMessage[];
    sending: boolean;
  }
  const sessionStateCache = new Map<string, SessionStreamState>();

  /** Save current session's volatile state into the cache. */
  function _saveCurrentState() {
    const key = sessionKey.value;
    if (!key) return;
    const hasCompletedTools = Object.keys(completedToolCallsMap.value).length > 0;
    if (streaming.value || sending.value || hasCompletedTools) {
      sessionStateCache.set(key, {
        streaming: streaming.value,
        streamText: streamText.value,
        streamToolCalls: [...streamToolCalls.value],
        completedToolCallsMap: { ...completedToolCallsMap.value },
        streamStartedAt: streamStartedAt.value,
        chatRunId: chatRunId.value,
        lastStreamEventAt: lastStreamEventAt.value,
        resolvedSessionKey: resolvedSessionKey.value,
        messages: [...messages.value],
        sending: sending.value,
      });
    } else {
      sessionStateCache.delete(key);
    }
  }

  /** Restore a session's volatile state from the cache (returns true if restored). */
  function _restoreState(key: string): boolean {
    const cached = sessionStateCache.get(key);
    if (!cached) return false;
    streaming.value = cached.streaming;
    streamText.value = cached.streamText;
    streamToolCalls.value = cached.streamToolCalls ? [...cached.streamToolCalls] : [];
    completedToolCallsMap.value = cached.completedToolCallsMap ? { ...cached.completedToolCallsMap } : {};
    streamStartedAt.value = cached.streamStartedAt;
    chatRunId.value = cached.chatRunId;
    lastStreamEventAt.value = cached.lastStreamEventAt;
    resolvedSessionKey.value = cached.resolvedSessionKey;
    messages.value = cached.messages;
    sending.value = cached.sending;
    return true;
  }

  // ── Load-history sequence counter (discard stale results) ──
  let _loadSeq = 0;

  // ── Helpers ──

  /** Check if a message is a gateway system message (restart confirmations, doctor prompts). */
  function isGatewaySystemMessage(msg: unknown): boolean {
    const text = extractText(msg);
    if (!text) return false;
    return /^System:/m.test(text) &&
      /(gateway[.\s]restart|openclaw doctor|Gateway restart)/i.test(text);
  }

  /**
   * Strip System: lines (gateway restart confirmations, doctor prompts) that
   * were injected into a user message by the gateway.  Returns the cleaned
   * text, or null if nothing remains after stripping.
   */
  function stripSystemLines(msg: unknown): unknown {
    const m = msg as Record<string, unknown>;
    const text = extractText(msg);
    if (!text) return msg;
    if (!/^System:/m.test(text) ||
        !/(gateway[.\s]restart|openclaw doctor|Gateway restart)/i.test(text)) {
      return msg;
    }
    const cleaned = text
      .split(/\r?\n/)
      .filter((line) => !(/^System:/.test(line) &&
        /(gateway[.\s]restart|openclaw doctor|Gateway restart)/i.test(line)))
      .join("\n")
      .trim();
    if (!cleaned) return null; // entire message was system lines
    // Return a shallow copy with updated content
    if (typeof m.content === "string") {
      return { ...m, content: cleaned };
    }
    return { ...m, content: [{ type: "text", text: cleaned }] };
  }

  /** Wrap a string in a JSON code fence if it looks like a JSON object/array. */
  function wrapJsonIfNeeded(text: string): string {
    const trimmed = text.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        return "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
      } catch { /* not valid JSON, return as-is */ }
    }
    return text;
  }

  function extractText(message: unknown): string | null {
    const m = message as Record<string, unknown>;
    if (typeof m.content === "string") return m.content;
    if (typeof m.text === "string") return m.text;
    if (Array.isArray(m.content)) {
      const parts: string[] = [];
      for (const block of m.content as Array<Record<string, unknown>>) {
        if (block.type === "text" && typeof block.text === "string") {
          parts.push(block.text);
        } else if (block.type === "tool_use") {
          const name = typeof block.name === "string" ? block.name : "tool";
          let inputStr = "";
          if (block.input && typeof block.input === "object") {
            try {
              inputStr = JSON.stringify(block.input, null, 2);
            } catch { /* ignore */ }
          }
          parts.push(`🔧 **${name}**${inputStr ? `\n\`\`\`json\n${inputStr}\n\`\`\`` : ""}`);
        } else if (block.type === "tool_result") {
          const content = block.content;
          if (typeof content === "string") {
            parts.push(wrapJsonIfNeeded(content));
          } else if (Array.isArray(content)) {
            for (const sub of content as Array<Record<string, unknown>>) {
              if (sub.type === "text" && typeof sub.text === "string") {
                parts.push(wrapJsonIfNeeded(sub.text));
              }
            }
          }
        }
      }
      return parts.length > 0 ? parts.join("\n\n") : null;
    }
    return null;
  }

  // ── Actions ──

  /** Fast shallow comparison: same length, same role, same text content. */
  function _messagesEqual(a: ChatMessage[], b: ChatMessage[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].role !== b[i].role) return false;
      const ta = extractText(a[i]);
      const tb = extractText(b[i]);
      if (ta !== tb) return false;
    }
    return true;
  }

  /** Switch to a different session. */
  async function switchSession(key: string) {
    // Save the current session's volatile state (including streaming)
    _syncToSessionStore();
    _saveCurrentState();

    sessionKey.value = key;
    const sessionStore = useSessionStore();
    sessionStore.ensureSession(key);

    // Try to restore cached state (streaming session we switched away from)
    if (_restoreState(key)) {
      return; // restored — don't overwrite with loadHistory
    }

    // Reset all volatile state for a clean session switch
    resolvedSessionKey.value = null;
    streaming.value = false;
    streamText.value = "";
    sending.value = false;
    chatRunId.value = null;
    streamStartedAt.value = null;
    lastStreamEventAt.value = null;
    lastError.value = null;
    messages.value = [];
    completedToolCallsMap.value = {};
    await loadHistory();
  }

  /** Fetch history from the gateway for the current session. */
  async function loadHistory() {
    const seq = ++_loadSeq;
    // Capture the session key at call time — if the user switches sessions
    // while we await, we must not write stale data into the new session.
    const callerSessionKey = sessionKey.value;
    const callerResolvedKey = resolvedSessionKey.value;
    // Only show loading spinner on initial load (no existing messages),
    // not during background refresh polls — avoids full-screen flicker.
    const isInitialLoad = messages.value.length === 0;
    if (isInitialLoad) loading.value = true;
    lastError.value = null;
    try {
      const key = callerResolvedKey || callerSessionKey;
      const res = await window.openclaw.chat.loadHistory(key);
      // Discard stale result — a newer loadHistory() was called, or
      // the user switched to a different session while we awaited.
      if (seq !== _loadSeq) return;
      if (sessionKey.value !== callerSessionKey) return;
      const raw = Array.isArray(res.messages) ? res.messages : [];
      const filtered = raw
        .map((m) => stripSystemLines(m))
        .filter((m): m is ChatMessage => m != null && !isGatewaySystemMessage(m));
      // Only replace messages if content actually changed — avoids
      // unnecessary Vue reactivity triggers and DOM re-renders.
      const changed = !_messagesEqual(messages.value, filtered);
      if (changed) {
        messages.value = filtered;
        // Update last message preview only when content changed
        _updateLastPreview();
      }
      // Only clear streaming state if we're not actively streaming
      // (a new stream may have started while loadHistory was in flight)
      if (!streaming.value) {
        streamText.value = "";
        chatRunId.value = null;
        streamStartedAt.value = null;
      }
      // Remove from cache since we now have authoritative data
      if (changed) sessionStateCache.delete(sessionKey.value);
    } catch (err) {
      if (seq !== _loadSeq) return;
      if (sessionKey.value !== callerSessionKey) return;
      lastError.value = String(err);
    } finally {
      if (seq === _loadSeq && sessionKey.value === callerSessionKey) loading.value = false;
    }
  }

  /** Send a message to the current session. */
  async function sendMessage(text: string) {
    const msg = text.trim();
    if (!msg) return;

    // Privacy protection: scan for PII based on privacy level
    let finalMsg = msg;
    const privacySettings = await window.openclaw.settings.get();
    const privacyLevel = privacySettings?.privacyLevel ?? "balanced";
    if (privacyLevel !== "basic") {
      const piiMatches = scanPii(msg);
      if (privacyLevel === "strict" && piiMatches.length > 0) {
        // Auto-redact in strict mode
        finalMsg = redactPii(msg);
      }
      // In balanced mode, piiMatches are available for UI warning (future)
    }

    // Optimistic: add user message locally
    messages.value = [
      ...messages.value,
      { role: "user", content: [{ type: "text", text: finalMsg }], timestamp: Date.now() },
    ];
    _updateLastPreview();

    sending.value = true;
    lastError.value = null;
    streamText.value = "";
    streamToolCalls.value = [];
    streamStartedAt.value = Date.now();
    lastStreamEventAt.value = Date.now();
    streaming.value = true;

    try {
      await window.openclaw.chat.sendMessage(resolvedSessionKey.value || sessionKey.value, finalMsg);
    } catch (err) {
      const error = String(err);
      lastError.value = error;
      streaming.value = false;
      sending.value = false;
      lastStreamEventAt.value = null;
      messages.value = [
        ...messages.value,
        { role: "assistant", content: [{ type: "text", text: "Error: " + error }], timestamp: Date.now() },
      ];
      return;
    }
    sending.value = false;
  }

  /** Handle an incoming chat event from the gateway. */
  function handleChatEvent(payload: ChatEventPayload) {
    // The gateway normalizes session keys (e.g. "default" → "agent:main:default").
    const incoming = payload.sessionKey;

    // Check if this event belongs to the current active session
    const isActive = incoming === sessionKey.value || incoming === resolvedSessionKey.value;

    // Check if this event belongs to a background (cached) session
    if (!isActive) {
      // Try to match against cached sessions' resolved keys
      for (const [cachedKey, cached] of sessionStateCache) {
        if (incoming === cachedKey || incoming === cached.resolvedSessionKey) {
          _handleBackgroundEvent(cachedKey, cached, payload);
          return;
        }
      }
      // First event for active session — learn the resolved key.
      // Only accept it if we are streaming AND the base session key
      // (before gateway normalisation) is a suffix of the incoming key,
      // preventing a late event from a *different* session from poisoning
      // the current session's resolvedSessionKey.
      if (streaming.value && incoming.includes(sessionKey.value)) {
        resolvedSessionKey.value = incoming;
      } else {
        return;
      }
    }

    // Update activity timestamp only for events matching the active session
    lastStreamEventAt.value = Date.now();

    if (payload.state === "delta") {
      const text = extractText(payload.message);
      if (typeof text === "string") {
        // Delta contains full accumulated text
        const current = streamText.value;
        if (!current || text.length >= current.length) {
          streamText.value = text;
        }
      }
    } else if (payload.state === "final") {
      // Save tool calls to the completed map, keyed by assistant group index.
      // Count existing assistant groups in messages to align with the grouping
      // logic in ChatView (which maps groupIndex → assistantIdx).
      if (streamToolCalls.value.length > 0) {
        let assistantGroupCount = 0;
        let prevRole = "";
        for (const m of messages.value) {
          const role = (typeof m.role === "string" ? m.role : "assistant").toLowerCase();
          const normalized = role === "user" ? "user" : "assistant";
          if (normalized === "assistant" && normalized !== prevRole) {
            assistantGroupCount++;
          }
          prevRole = normalized;
        }
        completedToolCallsMap.value = {
          ...completedToolCallsMap.value,
          [assistantGroupCount]: streamToolCalls.value.map((t) => ({
            id: t.id, name: t.name, input: t.input, actualCommand: t.actualCommand, result: t.result, isError: t.isError,
          })),
        };
        streamToolCalls.value = [];
      }
      const rawMsg = payload.message as ChatMessage | undefined;
      const msg = rawMsg ? stripSystemLines(rawMsg) as ChatMessage | null : null;
      if (msg && !isGatewaySystemMessage(msg)) {
        messages.value = [...messages.value, msg];
      } else if (!msg && streamText.value.trim()) {
        messages.value = [
          ...messages.value,
          { role: "assistant", content: [{ type: "text", text: streamText.value }], timestamp: Date.now() },
        ];
      }
      _updateLastPreview();
      streamText.value = "";
      streaming.value = false;
      chatRunId.value = null;
      streamStartedAt.value = null;
      lastStreamEventAt.value = null;
      // Reload history to get the authoritative server-side version (like webchat)
      loadHistory();
    } else if (payload.state === "aborted") {
      const msg = payload.message as ChatMessage | undefined;
      if (msg) {
        messages.value = [...messages.value, msg];
      } else if (streamText.value.trim()) {
        messages.value = [
          ...messages.value,
          { role: "assistant", content: [{ type: "text", text: streamText.value }], timestamp: Date.now() },
        ];
      }
      _updateLastPreview();
      streamText.value = "";
      streaming.value = false;
      chatRunId.value = null;
      streamStartedAt.value = null;
      lastStreamEventAt.value = null;
    } else if (payload.state === "error") {
      lastError.value = payload.errorMessage ?? "chat error";
      streamText.value = "";
      streaming.value = false;
      chatRunId.value = null;
      streamStartedAt.value = null;
      lastStreamEventAt.value = null;
    }
  }

  /** Handle an incoming agent tool event from the gateway. */
  function handleToolEvent(payload: {
    runId: string;
    sessionKey: string;
    stream: "tool";
    data: {
      phase: "start" | "result";
      name: string;
      toolCallId: string;
      meta?: string;
      isError?: boolean;
    };
  }) {
    // Match tool events to the active session.
    // The gateway normalizes keys (e.g. "session-xxx" → "agent:main:session-xxx"),
    // so tool events may arrive before resolvedSessionKey is learned from chat deltas.
    const incoming = payload.sessionKey;
    const isActive =
      incoming === sessionKey.value ||
      incoming === resolvedSessionKey.value ||
      (streaming.value && incoming.endsWith(sessionKey.value));
    if (!isActive) return;

    lastStreamEventAt.value = Date.now();

    // Learn the resolved key early from tool events (before first chat delta)
    if (streaming.value && !resolvedSessionKey.value && incoming !== sessionKey.value) {
      resolvedSessionKey.value = incoming;
    }

    const { phase, name, toolCallId, meta } = payload.data;
    const args = (payload.data as Record<string, unknown>).args as Record<string, unknown> | undefined;
    if (phase === "start") {
      // Build a descriptive display name combining tool name + primary argument
      let displayName = name;
      let argsLabel: string | undefined;
      if (args) {
        if (name === "exec" && typeof args.command === "string") {
          argsLabel = args.command;
        } else if ((name === "read" || name === "edit" || name === "write") && typeof args.path === "string") {
          displayName = `${name}("${args.path}")`;
        } else {
          // Generic: show first string-valued arg
          const firstVal = Object.values(args).find((v) => typeof v === "string");
          if (typeof firstVal === "string") displayName = `${name}("${firstVal}")`;
        }
      }
      // Add a new in-progress tool call
      streamToolCalls.value = [
        ...streamToolCalls.value,
        { id: toolCallId, name: displayName, done: false, input: argsLabel },
      ];
    } else if (phase === "result") {
      const isError = !!(payload.data as Record<string, unknown>).isError;
      // Mark the tool call as completed
      const idx = streamToolCalls.value.findIndex((t) => t.id === toolCallId);
      if (idx >= 0) {
        const updated = [...streamToolCalls.value];
        // Keep existing input (from args) if meta is shorter or redundant
        const existing = updated[idx];
        const newInput = meta && (!existing.input || meta.length > existing.input.length) ? meta : existing.input;
        updated[idx] = { ...existing, done: true, input: newInput, result: meta || undefined, isError };
        streamToolCalls.value = updated;
      } else {
        // Tool result arrived without a start (edge case) — add as completed
        let displayName = name;
        if (meta) displayName = `${name}  ${meta}`;
        streamToolCalls.value = [
          ...streamToolCalls.value,
          { id: toolCallId, name: displayName, done: true, input: undefined, result: meta || undefined, isError },
        ];
      }
    }
  }

  /** Add a pending tool call entry (e.g. from sandbox permission request). */
  function addPendingToolCall(id: string, name: string, waitingPermission?: boolean) {
    // Don't add duplicates
    if (streamToolCalls.value.some((t) => t.id === id)) return;
    streamToolCalls.value = [
      ...streamToolCalls.value,
      { id, name, done: false, waitingPermission: waitingPermission || false },
    ];
  }

  /** Mark a pending tool call as completed (e.g. after permission dialog response). */
  function completeToolCall(id: string) {
    const idx = streamToolCalls.value.findIndex((t) => t.id === id);
    if (idx >= 0) {
      const updated = [...streamToolCalls.value];
      updated[idx] = { ...updated[idx], done: true, waitingPermission: false };
      streamToolCalls.value = updated;
    }
  }

  /**
   * Attach the actual shell command (from sandbox-preload) to the most recent
   * in-progress "exec" tool call. The preload fires this IPC right before
   * executing, so there's always at most one pending exec at that moment.
   */
  function updateLatestExecCommand(command: string) {
    // Find the last in-progress exec tool call (not yet done)
    for (let i = streamToolCalls.value.length - 1; i >= 0; i--) {
      const t = streamToolCalls.value[i];
      if (t.name === "exec" && !t.done && !t.actualCommand) {
        const updated = [...streamToolCalls.value];
        updated[i] = { ...t, actualCommand: command };
        streamToolCalls.value = updated;
        return;
      }
    }
  }

  // ── Stale stream recovery ──
  // If the WebSocket briefly disconnects and reconnects, fire-and-forget
  // gateway events (especially "final") can be lost, leaving streaming=true
  // permanently.  This detector resets the UI after a period of inactivity.
  const STALE_STREAM_TIMEOUT_MS = 90_000;

  // When a tool call is in progress (tool:start received, waiting for
  // tool:result), the command may legitimately run for a long time with no
  // events (e.g. large file copy, build, database migration).  Use a much
  // longer timeout to avoid falsely resetting the UI.
  const STALE_STREAM_ACTIVE_TOOL_TIMEOUT_MS = 600_000; // 10 minutes

  /**
   * Check whether the current streaming session has gone stale (no events
   * for longer than `timeoutMs`).  If so, reset streaming state and reload
   * history from the gateway so the UI reflects the actual conversation.
   *
   * @param timeoutMs  Override the default inactivity threshold (e.g. use a
   *                   shorter value right after a WebSocket reconnect).
   */
  function checkStaleStream(timeoutMs: number = STALE_STREAM_TIMEOUT_MS) {
    if (!streaming.value) return;

    // If any tool call is still in progress, the agent is likely waiting for
    // a long-running command.  Extend the timeout to avoid false positives.
    const hasActiveTool = streamToolCalls.value.some((t) => !t.done);
    const effectiveTimeout = hasActiveTool
      ? Math.max(timeoutMs, STALE_STREAM_ACTIVE_TOOL_TIMEOUT_MS)
      : timeoutMs;

    const lastEvent = lastStreamEventAt.value ?? streamStartedAt.value;
    if (!lastEvent || Date.now() - lastEvent < effectiveTimeout) return;

    console.warn(
      `[chat] Stale stream detected: no events for ${Math.round((Date.now() - lastEvent) / 1000)}s — resetting`,
    );
    streaming.value = false;
    streamText.value = "";
    streamToolCalls.value = [];
    chatRunId.value = null;
    streamStartedAt.value = null;
    lastStreamEventAt.value = null;
    loadHistory();
  }

  /**
   * After a WebSocket reconnect while streaming, ask the server whether the
   * conversation has actually completed (the "final" event may have been lost
   * during the disconnect).  This is authoritative — it compares server-side
   * history with the local pre-stream message count instead of guessing via
   * timeouts, so it works correctly even when a tool call is still in flight.
   */
  async function recoverAfterReconnect() {
    if (!streaming.value) return;
    const key = resolvedSessionKey.value || sessionKey.value;
    try {
      const res = await window.openclaw.chat.loadHistory(key);
      const serverMsgs = Array.isArray(res.messages) ? res.messages : [];
      // If the server has more messages than we had locally before streaming
      // started, the task completed during the disconnect window.
      if (serverMsgs.length > messages.value.length) {
        console.warn(
          `[chat] Server has ${serverMsgs.length} messages vs local ${messages.value.length} after reconnect — resetting stream`,
        );
        streaming.value = false;
        streamText.value = "";
        streamToolCalls.value = [];
        chatRunId.value = null;
        streamStartedAt.value = null;
        lastStreamEventAt.value = null;
        loadHistory();
      }
    } catch {
      // Network still unstable — the regular stale-stream poll will catch it later
    }
  }

  /** Abort current generation. */
  async function abort() {
    try {
      const key = resolvedSessionKey.value || sessionKey.value;
      await window.openclaw.chat.abort(key);
    } catch {
      // ignore
    }
  }

  /** Start a new session (preserves the old one). */
  function newSession() {
    // Save the current session before switching
    // Save the current session before switching
    _syncToSessionStore();
    _saveCurrentState();

    const key = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionKey.value = key;
    resolvedSessionKey.value = null;
    messages.value = [];
    streamText.value = "";
    streamToolCalls.value = [];
    completedToolCallsMap.value = {};
    streaming.value = false;
    chatRunId.value = null;
    streamStartedAt.value = null;
    lastStreamEventAt.value = null;
    lastError.value = null;

    const sessionStore = useSessionStore();
    sessionStore.ensureSession(key);
  }

  /** Update last message preview for current session key. */
  function _updateLastPreview() {
    const key = sessionKey.value;
    const last = [...messages.value].reverse().find((m) => m.role === "assistant" || m.role === "user");
    if (last) {
      const text = extractText(last) || "";
      lastMessageMap.value[key] = text.replace(/\n/g, " ").slice(0, 80);
    }
    _syncToSessionStore();
  }

  /** Sync current session state to the sessions store. */
  function _syncToSessionStore() {
    const key = sessionKey.value;
    if (!key) return;
    const sessionStore = useSessionStore();
    sessionStore.ensureSession(key);
    // Auto-title from first user message
    const firstUser = messages.value.find((m) => m.role === "user");
    if (firstUser) {
      sessionStore.autoTitle(key, extractText(firstUser) || "");
    }
    // Update preview
    const last = [...messages.value].reverse().find((m) => m.role === "assistant" || m.role === "user");
    if (last) {
      sessionStore.updateSession(key, { preview: (extractText(last) || "").replace(/\n/g, " ").slice(0, 80) });
    }
  }

  /** Handle a chat event for a background (non-active) session stored in the cache. */
  function _handleBackgroundEvent(cachedKey: string, cached: SessionStreamState, payload: ChatEventPayload) {
    if (payload.state === "delta") {
      const text = extractText(payload.message);
      if (typeof text === "string") {
        if (!cached.streamText || text.length >= cached.streamText.length) {
          cached.streamText = text;
        }
      }
    } else if (payload.state === "final") {
      // Save tool calls to completedToolCallsMap keyed by assistant group index
      if (cached.streamToolCalls && cached.streamToolCalls.length > 0) {
        let assistantGroupCount = 0;
        let prevRole = "";
        for (const m of cached.messages) {
          const role = (typeof m.role === "string" ? m.role : "assistant").toLowerCase();
          const normalized = role === "user" ? "user" : "assistant";
          if (normalized === "assistant" && normalized !== prevRole) {
            assistantGroupCount++;
          }
          prevRole = normalized;
        }
        cached.completedToolCallsMap = {
          ...(cached.completedToolCallsMap || {}),
          [assistantGroupCount]: cached.streamToolCalls.map((t) => ({
            id: t.id, name: t.name, input: t.input,
          })),
        };
        cached.streamToolCalls = [];
      }
      const msg = payload.message as ChatMessage | undefined;
      if (msg) {
        cached.messages = [...cached.messages, msg];
      } else if (cached.streamText.trim()) {
        cached.messages = [
          ...cached.messages,
          { role: "assistant", content: [{ type: "text", text: cached.streamText }], timestamp: Date.now() },
        ];
      }
      cached.streaming = false;
      cached.streamText = "";
      cached.chatRunId = null;
      cached.streamStartedAt = null;
      cached.sending = false;
      // Keep in cache so switching back restores final messages
      sessionStateCache.set(cachedKey, cached);
    } else if (payload.state === "aborted") {
      const msg = payload.message as ChatMessage | undefined;
      if (msg) {
        cached.messages = [...cached.messages, msg];
      } else if (cached.streamText.trim()) {
        cached.messages = [
          ...cached.messages,
          { role: "assistant", content: [{ type: "text", text: cached.streamText }], timestamp: Date.now() },
        ];
      }
      cached.streaming = false;
      cached.streamText = "";
      cached.chatRunId = null;
      cached.streamStartedAt = null;
      cached.sending = false;
      sessionStateCache.set(cachedKey, cached);
    } else if (payload.state === "error") {
      cached.streaming = false;
      cached.streamText = "";
      cached.chatRunId = null;
      cached.streamStartedAt = null;
      cached.sending = false;
      sessionStateCache.set(cachedKey, cached);
    }
  }

  /** Delete a session — cleans up cache and switches away without re-adding. */
  function deleteSession(key: string) {
    // Clean up cached streaming state
    sessionStateCache.delete(key);
    delete lastMessageMap.value[key];

    const sessionStore = useSessionStore();
    sessionStore.removeSession(key);

    // If deleting the active session, switch away WITHOUT syncing old state
    if (sessionKey.value === key) {
      if (sessionStore.sortedSessions.length > 0) {
        // Jump to the most recent remaining session (skip _syncToSessionStore)
        const target = sessionStore.sortedSessions[0].key;
        sessionKey.value = target;
        resolvedSessionKey.value = null;
        sessionStore.ensureSession(target);
        if (!_restoreState(target)) {
          messages.value = [];
          streamText.value = "";
          streamToolCalls.value = [];
          streaming.value = false;
          chatRunId.value = null;
          streamStartedAt.value = null;
          lastStreamEventAt.value = null;
          lastError.value = null;
          loadHistory();
        }
      } else {
        // No sessions left — create a fresh one (skip _syncToSessionStore)
        const newKey = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        sessionKey.value = newKey;
        resolvedSessionKey.value = null;
        messages.value = [];
        streamText.value = "";
        streamToolCalls.value = [];
        streaming.value = false;
        chatRunId.value = null;
        streamStartedAt.value = null;
        lastStreamEventAt.value = null;
        lastError.value = null;
        sessionStore.ensureSession(newKey);
      }
    }
  }

  return {
    sessionKey,
    resolvedSessionKey,
    messages,
    loading,
    sending,
    streaming,
    streamText,
    streamToolCalls,
    completedToolCallsMap,
    streamStartedAt,
    chatRunId,
    lastError,
    wsConnected,
    lastMessageMap,
    lastStreamEventAt,
    pendingPrompt,
    extractText,
    switchSession,
    loadHistory,
    sendMessage,
    handleChatEvent,
    handleToolEvent,
    addPendingToolCall,
    completeToolCall,
    updateLatestExecCommand,
    checkStaleStream,
    recoverAfterReconnect,
    abort,
    newSession,
    deleteSession,
  };
});
