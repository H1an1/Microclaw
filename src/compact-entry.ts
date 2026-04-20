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
  runGifUrl?: string;
  paperfallGifUrl?: string;
}

export const COMPACT_ENTRY_WIDTH = 272;
export const COMPACT_ENTRY_HEIGHT = 180;
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
  const runGifUrl = options.runGifUrl ?? '';
  const paperfallGifUrl = options.paperfallGifUrl ?? '';
  const hasGif = !!(runGifUrl && paperfallGifUrl);

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
        position: relative;
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
        height: 52px;
        background: rgba(28, 28, 28, 0.72);
        justify-content: flex-start;
        padding: 0 10px;
        gap: 10px;
      }

      body.drag-active button {
        border-color: ${accentColor}66;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18), 0 0 0 1px ${accentColor}40;
      }

      /* GIF runner — hidden at rest, revealed after pill expands */
      .gif-runner {
        position: absolute;
        bottom: 42px;
        left: calc(50% - 50px);
        width: 100px;
        height: 100px;
        pointer-events: none;
        opacity: 0;
        animation: gif-walk 2s linear infinite;
        animation-play-state: paused;
        transition: opacity 0.15s ease;
      }

      .gif-runner--visible {
        opacity: 1;
        animation-play-state: running;
      }

      /* Walk left→right facing right, right→left mirrored; instant flip at edges */
      @keyframes gif-walk {
        0%     { transform: translateX(-70px) scaleX(1); }
        49.9%  { transform: translateX(70px)  scaleX(1); }
        50%    { transform: translateX(70px)  scaleX(-1); }
        99.9%  { transform: translateX(-70px) scaleX(-1); }
        100%   { transform: translateX(-70px) scaleX(1); }
      }

      .gif {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        transition: opacity 0.5s ease;
      }

      .gif-run  { opacity: 1; }
      .gif-paper { opacity: 0; }

      ${hasGif ? `
      /* Orbs pulse only when actively processing */
      .orb:nth-child(1) { animation: orb-pulse 1.6s ease-in-out 0s infinite; }
      .orb:nth-child(2) { animation: orb-pulse 1.6s ease-in-out 0.3s infinite; }
      @keyframes orb-pulse {
        0%, 100% { opacity: 0.45; transform: scale(0.85); }
        50%       { opacity: 1;    transform: scale(1.2); }
      }
      ` : ''}

      /* Orbs */
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
        background: rgba(240, 160, 32, 0.75);
      }

      body.drag-active .orb,
      button:hover .orb {
        animation: none;
        transform: scale(1.15);
        background: #F0A020;
        opacity: 1;
      }

      .copy {
        min-width: 0;
        flex: 1;
        display: none;
        flex-direction: column;
        gap: 2px;
        text-align: left;
        opacity: 0;
        overflow: hidden;
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
        overflow: hidden;
      }

      .hint {
        display: none;
        overflow: hidden;
        flex-shrink: 0;
      }

      .hint-inner {
        display: inline-block;
        color: rgba(255, 255, 255, 0.52);
        font-size: 12px;
        line-height: 1.3;
        white-space: nowrap;
        padding-right: 32px;
      }

      body.drag-active .hint {
        display: block;
      }
      ${hasGif ? 'button:hover .hint { display: block; }' : ''}

      @keyframes hint-marquee {
        0%, 18%   { transform: translateX(0); }
        82%, 100% { transform: translateX(var(--hint-scroll, 0px)); }
      }

      ${hasGif ? `
      body.gif-visible button:hover .orbs { display: none; }
      body.gif-visible button:hover .title { display: none; }
      body.gif-visible button:hover { padding-left: 12px; padding-right: 12px; gap: 0; }
      body.gif-visible button:hover .copy {
        gap: 0;
        background: rgba(0, 0, 0, 0.82);
        border-radius: 999px;
        padding: 5px 10px;
        flex: 1;
      }
      ` : ''}

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
        <span class="hint"><span class="hint-inner">${hint}</span></span>
      </span>
    </button>
    ${hasGif ? `
    <div class="gif-runner">
      <img class="gif gif-run" src="${runGifUrl}" alt="" />
      <img class="gif gif-paper" src="${paperfallGifUrl}" alt="" />
    </div>` : ''}
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
      const hintEl = button?.querySelector(".hint-inner");
      const hintOuter = button?.querySelector(".hint");
      const dragTitleForFolder = "把文件夹交给我";
      const dragHintForFolder = "可整理内容、总结重点、生成任务清单";
      const dragTitleForFile = "把内容交给我";
      const dragHintForFile = "可提取重点、汇总信息、生成待办";
      let lastIndex = -1;
      let dragDepth = 0;
      const gifRunner = document.querySelector(".gif-runner");
      let gifShowTimer = null;

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
        // Show gif after pill expansion finishes (~260ms transition)
        gifShowTimer = setTimeout(() => {
          if (!gifRunner) return;
          gifRunner.classList.add("gif-runner--visible");
          document.body.classList.add("gif-visible");
          // Set up marquee if hint text overflows
          if (hintEl && hintOuter) {
            hintEl.style.animation = 'none';
            requestAnimationFrame(() => {
              const overflow = hintEl.scrollWidth - hintOuter.clientWidth;
              if (overflow > 4) {
                hintEl.style.setProperty('--hint-scroll', '-' + overflow + 'px');
                hintEl.style.animation = 'hint-marquee 9s ease-in-out infinite';
              }
            });
          }
        }, 270);
      });

      button?.addEventListener("mouseleave", () => {
        clearTimeout(gifShowTimer);
        gifRunner?.classList.remove("gif-runner--visible");
        document.body.classList.remove("gif-visible");
        if (hintEl) hintEl.style.animation = 'none';
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

      // GIF cycling: run ↔ paperfall
      const gifRun = document.querySelector(".gif-run");
      const gifPaper = document.querySelector(".gif-paper");
      if (gifRun && gifPaper) {
        setInterval(() => {
          gifRun.style.opacity = "0";
          gifPaper.style.opacity = "1";
          setTimeout(() => {
            gifPaper.style.opacity = "0";
            gifRun.style.opacity = "1";
          }, 2000);
        }, 8000);
      }
    </script>
  </body>
</html>`;
}

export function buildCompactEntryDataUrl(options: CompactEntryAppearanceOptions = {}): string {
  return `data:text/html;charset=UTF-8,${encodeURIComponent(buildCompactEntryHtml(options))}`;
}