import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders simple text as paragraph", () => {
    const result = renderMarkdown("Hello world");
    expect(result).toContain("<p>");
    expect(result).toContain("Hello world");
  });

  it("returns empty string for empty/whitespace input", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown("   ")).toBe("");
    expect(renderMarkdown("\n")).toBe("");
  });

  it("renders bold text", () => {
    const result = renderMarkdown("**bold**");
    expect(result).toContain("<strong>bold</strong>");
  });

  it("renders code blocks with syntax highlighting", () => {
    const result = renderMarkdown("```javascript\nconsole.log('hi');\n```");
    expect(result).toContain("<pre");
    expect(result).toContain("<code");
  });

  it("renders inline code", () => {
    const result = renderMarkdown("Use `npm install` to install");
    expect(result).toContain("<code>");
    expect(result).toContain("npm install");
  });

  it("renders links", () => {
    const result = renderMarkdown("[Google](https://google.com)");
    expect(result).toContain("<a");
    expect(result).toContain("https://google.com");
  });

  it("sanitizes script tags (XSS prevention)", () => {
    const result = renderMarkdown('<script>alert("xss")</script>');
    expect(result).not.toContain("<script");
  });

  it("sanitizes event handlers (XSS prevention)", () => {
    const result = renderMarkdown('<img onerror="alert(1)" src="x">');
    // With html:false, MarkdownIt escapes the tag — the onerror attribute
    // is not rendered as a live DOM attribute, so it's safe.
    expect(result).not.toContain('<img');
  });

  it("allows safe HTML tags after sanitization", () => {
    const result = renderMarkdown("# Heading\n\n- item 1\n- item 2");
    expect(result).toContain("<h1>");
    expect(result).toContain("<li>");
  });

  it("handles malformed markdown gracefully (error boundary)", () => {
    // Extremely long input that could cause issues
    const longInput = "x".repeat(100_000);
    expect(() => renderMarkdown(longInput)).not.toThrow();
    const result = renderMarkdown(longInput);
    expect(result).toBeTruthy();
  });
});
