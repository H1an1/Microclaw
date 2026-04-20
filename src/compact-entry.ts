export interface BoundsLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompactEntryAppearanceOptions {
  appName?: string;
  hint?: string;
  accentColor?: string;
  themeMode?: string;
  prefersDarkColors?: boolean;
}

export const COMPACT_ENTRY_WIDTH = 240;
export const COMPACT_ENTRY_HEIGHT = 60;
export const COMPACT_ENTRY_BOTTOM_MARGIN = 52;
export const COMPACT_ENTRY_RESTORE_URL = "openclaw://compact-entry/restore";

const DEFAULT_APP_NAME = "MicroClaw";
const DEFAULT_HINT = "Click to reopen";
const DEFAULT_ACCENT_COLOR = "#4a90d9";

export function resolveCompactEntryDarkMode(
  themeMode: string | undefined,
  prefersDarkColors: boolean,
): boolean {
  if (themeMode === "dark") return true;
  if (themeMode === "system") return prefersDarkColors;
  return false;
}

export function getCompactEntryBounds(
  workArea: BoundsLike,
  width = COMPACT_ENTRY_WIDTH,
  height = COMPACT_ENTRY_HEIGHT,
  bottomMargin = COMPACT_ENTRY_BOTTOM_MARGIN,
): BoundsLike {
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + workArea.height - height - bottomMargin,
    width,
    height,
  };
}

function normalizeAccentColor(accentColor: string | undefined): string {
  if (accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor)) {
    return accentColor;
  }
  return DEFAULT_ACCENT_COLOR;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildCompactEntryHtml(options: CompactEntryAppearanceOptions = {}): string {
  const appName = escapeHtml(options.appName || DEFAULT_APP_NAME);
  const hint = escapeHtml(options.hint || DEFAULT_HINT);
  const accentColor = normalizeAccentColor(options.accentColor);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName}</title>
    <style>
      * { box-sizing: border-box; }

      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        background: transparent;
        overflow: hidden;
        font-family: "SF Pro Text", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding-bottom: 8px;
      }

      button {
        position: relative;
        width: 36px;
        height: 28px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        background: rgba(22, 22, 22, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 0 13px;
        cursor: pointer;
        outline: none;
        overflow: hidden;
        white-space: nowrap;
        opacity: 0;
        animation: reveal 220ms cubic-bezier(0.2, 0.9, 0.25, 1) forwards;
        transition: width 260ms cubic-bezier(0.2, 0.9, 0.25, 1),
                    height 260ms cubic-bezier(0.2, 0.9, 0.25, 1),
                    background 140ms ease,
                    box-shadow 140ms ease;
      }

      button:hover {
        width: 220px;
        height: 48px;
        background: rgba(28, 28, 28, 0.97);
        justify-content: flex-start;
        padding: 0 16px;
      }

      button:focus-visible {
        border-color: ${accentColor};
        box-shadow: 0 6px 28px rgba(0, 0, 0, 0.45), 0 0 0 3px ${accentColor}44;
      }

      .orb {
        flex-shrink: 0;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: ${accentColor};
        transition: transform 260ms ease;
      }

      button:hover .orb {
        transform: scale(1.1);
      }

      .copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        text-align: left;
        opacity: 0;
        transition: opacity 180ms ease 100ms;
      }

      button:hover .copy {
        opacity: 1;
      }

      .title {
        color: rgba(255, 255, 255, 0.92);
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.01em;
        white-space: nowrap;
      }

      .hint {
        color: rgba(255, 255, 255, 0.46);
        font-size: 11px;
        line-height: 1.2;
        white-space: nowrap;
      }

      @keyframes reveal {
        from { opacity: 0; transform: translateY(8px) scale(0.9); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
    </style>
  </head>
  <body>
    <button type="button" title="${hint}" aria-label="${hint}">
      <span class="orb"></span>
      <span class="copy">
        <span class="title">${appName}</span>
      </span>
    </button>
    <script>
      const button = document.querySelector("button");
      button?.addEventListener("click", () => {
        window.location.href = "${COMPACT_ENTRY_RESTORE_URL}";
      });
      window.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          window.location.href = "${COMPACT_ENTRY_RESTORE_URL}";
        }
      });
    </script>
  </body>
</html>`;
}

export function buildCompactEntryDataUrl(options: CompactEntryAppearanceOptions = {}): string {
  return `data:text/html;charset=UTF-8,${encodeURIComponent(buildCompactEntryHtml(options))}`;
}