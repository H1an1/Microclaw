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

export const COMPACT_ENTRY_WIDTH = 272;
export const COMPACT_ENTRY_HEIGHT = 112;
export const COMPACT_ENTRY_BOTTOM_MARGIN = 52;
export const COMPACT_ENTRY_RESTORE_URL = "openclaw://compact-entry/restore";

const DEFAULT_APP_NAME = "MicroClaw";
const DEFAULT_HINT = "Click to reopen";
const DEFAULT_ACCENT_COLOR = "#F0A020";

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
        padding: 40px 0 8px;
      }

      button {
        position: relative;
        width: 52px;
        height: 28px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        background: rgba(22, 22, 22, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 0;
        cursor: pointer;
        outline: none;
        overflow: hidden;
        white-space: nowrap;
        opacity: 0;
        animation: reveal 220ms cubic-bezier(0.2, 0.9, 0.25, 1) forwards;
        transition: width 260ms cubic-bezier(0.2, 0.9, 0.25, 1),
                    height 260ms cubic-bezier(0.2, 0.9, 0.25, 1),
                    background 140ms ease,
                    border-color 140ms ease,
                    box-shadow 140ms ease;
      }

      body.drag-active button,
      button:hover {
        width: 220px;
        height: 48px;
        background: rgba(28, 28, 28, 0.72);
        justify-content: flex-start;
        padding: 0 10px;
        gap: 10px;
      }

      body.drag-active button {
        border-color: ${accentColor}66;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18), 0 0 0 1px ${accentColor}40;
      }

      body.drag-active button .orbs,
      button:hover .orbs {
        flex: none;
        gap: 6px;
        background: #000;
        border-radius: 999px;
        padding: 7px 10px;
      }

      button:focus-visible {
        border-color: ${accentColor};
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.24), 0 0 0 1px ${accentColor}30;
      }

      .orbs {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        flex-shrink: 0;
      }

      .orb {
        flex-shrink: 0;
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: rgba(240, 160, 32, 0.55);
        transition: transform 260ms ease, background 140ms ease;
      }

      body.drag-active .orb,
      button:hover .orb {
        transform: scale(1.15);
        background: #F0A020;
      }

      .copy {
        min-width: 0;
        display: none;
        flex-direction: column;
        gap: 2px;
        text-align: left;
        opacity: 0;
        transition: opacity 180ms ease 80ms;
      }

      body.drag-active .copy,
      button:hover .copy {
        display: flex;
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
        display: none;
        color: rgba(255, 255, 255, 0.46);
        font-size: 11px;
        line-height: 1.2;
        white-space: nowrap;
      }

      body.drag-active .hint {
        display: block;
      }

      @keyframes reveal {
        from { opacity: 0; transform: translateY(8px) scale(0.9); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
    </style>
  </head>
  <body>
    <button type="button" title="${hint}" aria-label="${hint}">
      <span class="orbs">
        <span class="orb"></span>
        <span class="orb"></span>
      </span>
      <span class="copy">
        <span class="title">${appName}</span>
        <span class="hint">${hint}</span>
      </span>
    </button>
    <script>
      const hints = [
        "欢迎回来 (ﾉ≧∀≦)ﾉ🦞",
        "有什么想聊的？(◕‿◕✿)",
        "写点什么？✍️ (¬‿¬)",
        "帮你搜搜看 (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧",
        "今天也要加油 ᕦ(ò_óˇ)ᕤ",
        "来头脑风暴吧 (•̀ᴗ•́)و",
        "有个问题想问？(｀・ω・´)",
        "随时都在 ヾ(≧▽≦*)o",
        "一起想想看 (˘▽˘>ԅ( ˘⌣˘)",
        "让我来帮你 ლ(╹◡╹ლ)",
      ];

      const button = document.querySelector("button");
      const titleEl = button?.querySelector(".title");
      const hintEl = button?.querySelector(".hint");
      const dragTitleForFolder = "把文件夹交给我";
      const dragHintForFolder = "可整理内容、总结重点、生成任务清单";
      const dragTitleForFile = "把内容交给我";
      const dragHintForFile = "可提取重点、汇总信息、生成待办";
      let lastIndex = -1;
      let dragDepth = 0;

      function resetCopy() {
        if (titleEl) titleEl.textContent = "${appName}";
        if (hintEl) hintEl.textContent = "${hint}";
        if (button) {
          button.title = "${hint}";
          button.setAttribute("aria-label", "${hint}");
        }
      }

      function setDragActive(hasDirectory) {
        document.body.classList.add("drag-active");
        const nextTitle = hasDirectory ? dragTitleForFolder : dragTitleForFile;
        const nextHint = hasDirectory ? dragHintForFolder : dragHintForFile;
        if (titleEl) titleEl.textContent = nextTitle;
        if (hintEl) hintEl.textContent = nextHint;
        if (button) {
          button.title = nextHint;
          button.setAttribute("aria-label", nextHint);
        }
      }

      function clearDragActive() {
        dragDepth = 0;
        document.body.classList.remove("drag-active");
        resetCopy();
      }

      function getDropPayload(dataTransfer) {
        const items = Array.from(dataTransfer?.items || []);
        const files = Array.from(dataTransfer?.files || []);
        let hasFile = files.length > 0;
        let hasDirectory = false;

        const itemFiles = [];
        for (const item of items) {
          if (item.kind !== "file") continue;
          hasFile = true;
          const f = item.getAsFile();
          if (f) itemFiles.push(f);
          const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
          if (entry && entry.isDirectory) {
            hasDirectory = true;
          }
        }

        // dataTransfer.files can be empty for folders on macOS; use item.getAsFile() instead
        const sourceFiles = itemFiles.length > 0 ? itemFiles : files;
        const paths = sourceFiles
          .map((file) => typeof file.path === "string" ? file.path : "")
          .filter(Boolean);

        return { hasFile, hasDirectory, paths };
      }

      resetCopy();

      button?.addEventListener("mouseenter", () => {
        if (document.body.classList.contains("drag-active")) return;
        let idx;
        do { idx = Math.floor(Math.random() * hints.length); } while (idx === lastIndex);
        lastIndex = idx;
        if (titleEl) titleEl.textContent = hints[idx];
      });

      button?.addEventListener("mouseleave", () => {
        if (document.body.classList.contains("drag-active")) return;
        resetCopy();
      });

      button?.addEventListener("click", () => {
        window.location.href = "${COMPACT_ENTRY_RESTORE_URL}";
      });

      window.addEventListener("dragenter", (event) => {
        const payload = getDropPayload(event.dataTransfer);
        if (!payload.hasFile) return;
        event.preventDefault();
        dragDepth += 1;
        setDragActive(payload.hasDirectory);
      });

      window.addEventListener("dragover", (event) => {
        const payload = getDropPayload(event.dataTransfer);
        if (!payload.hasFile) return;
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "copy";
        }
        setDragActive(payload.hasDirectory);
      });

      window.addEventListener("dragleave", (event) => {
        if (!document.body.classList.contains("drag-active")) return;
        event.preventDefault();
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) {
          clearDragActive();
        }
      });

      window.addEventListener("drop", (event) => {
        const payload = getDropPayload(event.dataTransfer);
        if (!payload.hasFile) return;
        event.preventDefault();
        const uniquePaths = Array.from(new Set(payload.paths));
        clearDragActive();
        if (uniquePaths.length > 0) {
          window.location.href = "${COMPACT_ENTRY_RESTORE_URL}?paths=" + encodeURIComponent(JSON.stringify(uniquePaths));
        } else {
          window.location.href = "${COMPACT_ENTRY_RESTORE_URL}";
        }
      });

      window.addEventListener("dragend", clearDragActive);
      window.addEventListener("blur", clearDragActive);

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