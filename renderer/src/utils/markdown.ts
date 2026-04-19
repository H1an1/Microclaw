import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`;
      } catch {
        // Fall through
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

// Restrict linkify to only match explicit URLs (http:// or https://).
// Without this, markdown-it's linkify treats "word.word" patterns like
// "it.Looks" as domain names and renders them as clickable links.
md.linkify.set({ fuzzyLink: false, fuzzyEmail: false, fuzzyIP: false });

const ALLOWED_TAGS = [
  "a", "b", "blockquote", "br", "code", "del", "details", "em",
  "h1", "h2", "h3", "h4", "hr", "i", "li", "ol",
  "p", "pre", "strong", "summary", "table", "tbody", "td", "th",
  "thead", "tr", "ul", "img",
];
const ALLOWED_ATTR = ["class", "href", "rel", "target", "title", "start", "src", "alt"];

export function renderMarkdown(text: string): string {
  if (!text.trim()) return "";
  let raw: string;
  try {
    raw = md.render(text);
  } catch {
    // Malformed markdown — return safely escaped text
    raw = `<p>${md.utils.escapeHtml(text)}</p>`;
  }
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
