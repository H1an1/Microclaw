// ---------------------------------------------------------------------------
// Shared constants for the MicroClaw Desktop main process.
// Centralises magic numbers and flags that were previously scattered across
// main.ts, gateway-manager.ts, and gateway-client.ts.
// ---------------------------------------------------------------------------

/** Default gateway port when none is configured in openclaw.json. */
export const DEFAULT_PORT = 18789;

/** Windows process-creation flag: suppress the console window. */
export const CREATE_NO_WINDOW = 0x08000000;

/** Sub-directory under the state dir used for Node 22+ V8 bytecode caching. */
export const COMPILE_CACHE_SUBDIR = "compile-cache";

// ── Timeouts & intervals ────────────────────────────────────────────────

/** How often the health monitor pings the gateway (ms). */
export const HEALTH_CHECK_INTERVAL_MS = 10_000;

/** HTTP timeout for a single health-check request (ms). */
export const HEALTH_CHECK_HTTP_TIMEOUT_MS = 2_000;

/** Max time to wait for the gateway to become ready after spawn (ms). */
export const GATEWAY_READY_TIMEOUT_MS = 60_000;

/** Max time to wait for the gateway port to become free (ms). */
export const PORT_WAIT_TIMEOUT_MS = 30_000;

/** Delay before the post-spawn restart that activates plugin channels (ms). */
export const POST_SPAWN_RESTART_DELAY_MS = 5_000;

/** Timeout for sandbox permission requests — file, shell, and app approval (ms).
 *  Shared by sandbox-preload.js (via env var) and main.ts (remote approval).
 *  0 = no timeout (wait indefinitely for user decision). */
export const SANDBOX_PERMISSION_TIMEOUT_MS = 0;

/** Timeout for the WeChat login flow (ms). */
export const WEIXIN_LOGIN_TIMEOUT_MS = 180_000;

/** Number of days of usage data to query from the gateway. */
export const USAGE_QUERY_DAYS = 30;

// ── WebSocket reconnect back-off ────────────────────────────────────────

/** Initial delay before the first reconnect attempt (ms). */
export const WS_RECONNECT_INITIAL_MS = 800;

/** Maximum delay between reconnect attempts (ms). */
export const WS_RECONNECT_MAX_MS = 15_000;

/** Multiplier applied to the back-off delay on each retry. */
export const WS_RECONNECT_MULTIPLIER = 1.7;

/** Per-request timeout for gateway WS RPC calls (ms). */
export const WS_REQUEST_TIMEOUT_MS = 30_000;

// ── Gateway status ──────────────────────────────────────────────────────

export type GatewayStatus =
  | "stopped"
  | "starting"
  | "running"
  | "restarting"
  | "failed"
  | "stopping"
  | "timeout";
