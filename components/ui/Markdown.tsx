import { createElement, type ReactNode } from "react";

// Built with `createElement` rather than JSX syntax, deliberately. The project's root
// tsconfig.json sets `"jsx": "preserve"` (required so Next.js's own SWC/Babel pipeline does
// the JSX transform at build time), but `vitest.config.ts` (owned by P15, out of this
// parcel's scope) has no esbuild override for that — so a `.tsx` file containing real JSX
// syntax fails to transform when a test imports it ("make sure to not set jsx to preserve").
// `createElement` is exactly what JSX compiles down to, so behaviour is identical; this just
// sidesteps a test-harness gap without touching a file this parcel does not own.

/**
 * Dependency-free renderer for coordinator-authored campaign briefs, shown to promoters on
 * `/c/[token]` — see `docs/acceptance-test-results.md`: promoters were seeing raw markdown
 * (`## Στόχος`, `- Παρουσίαση του προϊόντος`) because `body_md` was printed as plain text.
 *
 * SECURITY: the brief is written by a coordinator and displayed to a promoter with no review
 * step in between, so it is treated as untrusted input. This file never uses
 * `dangerouslySetInnerHTML`. Every node below is a real React element built from parsed
 * tokens — plain text content is passed as children, which React escapes on render, so an
 * HTML tag or a `<script>` payload in the source can only ever appear as visible text, never
 * as markup. Anything this parser does not recognise (nested emphasis, tables, images, code
 * fences, raw HTML, an unmatched `*`) falls through unchanged as plain text — cosmetic, never
 * a hole.
 *
 * Supports: headings (`#` through `###`), bold (`**bold**` or `__bold__`), italic (`*italic*`
 * or `_italic_`), unordered lists (`-` or `*`) and ordered lists (`1.`), `[text](url)` links
 * (http(s), mailto, or a site-relative path only — anything else is left as literal text
 * rather than becoming a `javascript:` href), paragraphs, and single line breaks within a
 * paragraph (one newline becomes a line break; a blank line starts a new paragraph).
 */

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] };

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const UNORDERED_RE = /^[-*]\s+(.*)$/;
const ORDERED_RE = /^\d+\.\s+(.*)$/;

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.trim() === "") {
      i++;
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1]!.length as 1 | 2 | 3;
      blocks.push({ type: "heading", level, text: (heading[2] ?? "").trim() });
      i++;
      continue;
    }

    if (UNORDERED_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = UNORDERED_RE.exec(lines[i] ?? "");
        if (!m) break;
        items.push((m[1] ?? "").trim());
        i++;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    if (ORDERED_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = ORDERED_RE.exec(lines[i] ?? "");
        if (!m) break;
        items.push((m[1] ?? "").trim());
        i++;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    // Paragraph: consecutive plain lines, ended by a blank line or the start of another block.
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? "";
      if (l.trim() === "") break;
      if (HEADING_RE.test(l) || UNORDERED_RE.test(l) || ORDERED_RE.test(l)) break;
      paraLines.push(l);
      i++;
    }
    blocks.push({ type: "paragraph", lines: paraLines });
  }

  return blocks;
}

/** Safe href schemes. Anything else (notably `javascript:`) is rendered as literal text
 *  instead of becoming a link — see the file-level security note. */
const SAFE_URL_RE = /^(https?:|mailto:|\/)/i;

// Order matters: the bold alternatives are listed before the single-marker italic
// alternatives so `**bold**` / `__bold__` are matched whole rather than as italic-of-nothing
// followed by a stray marker.
const INLINE_RE = /\*\*(.+?)\*\*|__(.+?)__|\[([^\]]*)\]\(([^)\s]+)\)|\*(.+?)\*|_(.+?)_/g;

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let index = 0;
  INLINE_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [whole, bold1, bold2, linkText, linkUrl, italic1, italic2] = match;
    const key = `${keyPrefix}-${index++}`;

    if (bold1 !== undefined || bold2 !== undefined) {
      nodes.push(createElement("strong", { key }, bold1 ?? bold2));
    } else if (linkText !== undefined && linkUrl !== undefined) {
      if (SAFE_URL_RE.test(linkUrl)) {
        nodes.push(
          createElement(
            "a",
            {
              key,
              href: linkUrl,
              target: "_blank",
              rel: "noopener noreferrer nofollow",
              className: "underline",
            },
            linkText,
          ),
        );
      } else {
        // Unsupported/unsafe scheme: keep the original text, unlinked.
        nodes.push(whole);
      }
    } else if (italic1 !== undefined || italic2 !== undefined) {
      nodes.push(createElement("em", { key }, italic1 ?? italic2));
    } else {
      nodes.push(whole);
    }

    lastIndex = match.index + whole.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export interface MarkdownProps {
  /** Raw markdown-lite source, e.g. a brief's `body_md`. Untrusted — see the file-level note. */
  source: string | null | undefined;
  className?: string;
}

function renderBlock(block: Block, blockIndex: number): ReactNode {
  const blockKey = `b-${blockIndex}`;

  if (block.type === "heading") {
    const content = parseInline(block.text, `${blockKey}-h`);
    const tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3";
    const sizeClass =
      block.level === 1
        ? "mt-4 text-base font-semibold first:mt-0"
        : block.level === 2
          ? "mt-4 text-sm font-semibold first:mt-0"
          : "mt-3 text-sm font-semibold first:mt-0";
    return createElement(tag, { key: blockKey, className: sizeClass }, content);
  }

  if (block.type === "list") {
    const items = block.items.map((item, itemIndex) =>
      createElement(
        "li",
        { key: `${blockKey}-li-${itemIndex}` },
        parseInline(item, `${blockKey}-li-${itemIndex}`),
      ),
    );
    const tag = block.ordered ? "ol" : "ul";
    const listClass = `mt-2 ${block.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5 text-sm`;
    return createElement(tag, { key: blockKey, className: listClass }, items);
  }

  // paragraph
  const nodes: ReactNode[] = [];
  block.lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) nodes.push(createElement("br", { key: `${blockKey}-br-${lineIndex}` }));
    nodes.push(...parseInline(line, `${blockKey}-p-${lineIndex}`));
  });
  return createElement("p", { key: blockKey, className: "mt-2 text-sm first:mt-0" }, nodes);
}

/** Renders `source` as a small set of markdown constructs. Never touches innerHTML. */
export function Markdown({ source, className }: MarkdownProps) {
  const blocks = parseBlocks(source ?? "");
  if (blocks.length === 0) return null;

  return createElement(
    "div",
    { className },
    blocks.map((block, blockIndex) => renderBlock(block, blockIndex)),
  );
}
