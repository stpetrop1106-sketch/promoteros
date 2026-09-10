import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Markdown } from "@/components/ui/Markdown";

/**
 * P23 — the check-in page (`app/c/[token]/page.tsx`) was showing promoters raw markdown
 * (`## Στόχος`, `- Παρουσίαση του προϊόντος`) instead of the rendered brief. `Markdown`
 * fixes that and this file exercises every construct it claims to support.
 *
 * Rendered with `react-dom/server`'s `renderToStaticMarkup` rather than a DOM testing
 * library — the test harness runs in Vitest's plain "node" environment (see
 * tests/README.md), and `renderToStaticMarkup` needs no DOM. It also happens to be the most
 * direct way to prove the security property: if the component ever used
 * `dangerouslySetInnerHTML` with unescaped input, a `<script>` payload would appear in the
 * output as a literal `<script>` tag. It must not — React's own escaping of text children is
 * what has to hold here, and asserting on the actual HTML string is what proves it held,
 * rather than merely inspecting the React element tree the component built.
 */

function html(source: string | null | undefined) {
  return renderToStaticMarkup(createElement(Markdown, { source }));
}

describe("headings", () => {
  it("renders # as an h1", () => {
    const out = html("# Στόχος");
    expect(out).toMatch(/<h1[^>]*>Στόχος<\/h1>/);
  });

  it("renders ## as an h2", () => {
    const out = html("## Στόχος");
    expect(out).toMatch(/<h2[^>]*>Στόχος<\/h2>/);
  });

  it("renders ### as an h3", () => {
    const out = html("### Στόχος");
    expect(out).toMatch(/<h3[^>]*>Στόχος<\/h3>/);
  });

  it("does not treat a bare run of hashes with no space as a heading", () => {
    const out = html("###no space");
    expect(out).not.toContain("<h3");
    expect(out).toContain("###no space");
  });
});

describe("emphasis", () => {
  it("renders **bold**", () => {
    expect(html("**δυνατό**")).toMatch(/<strong[^>]*>δυνατό<\/strong>/);
  });

  it("renders __bold__", () => {
    expect(html("__δυνατό__")).toMatch(/<strong[^>]*>δυνατό<\/strong>/);
  });

  it("renders *italic*", () => {
    expect(html("*πλάγια*")).toMatch(/<em[^>]*>πλάγια<\/em>/);
  });

  it("renders _italic_", () => {
    expect(html("_πλάγια_")).toMatch(/<em[^>]*>πλάγια<\/em>/);
  });

  it("prefers bold over italic when both markers are present", () => {
    const out = html("**bold** and *italic*");
    expect(out).toMatch(/<strong[^>]*>bold<\/strong>/);
    expect(out).toMatch(/<em[^>]*>italic<\/em>/);
  });

  it("leaves an unmatched marker as plain, literal text — cosmetic, not a crash", () => {
    const out = html("τιμή * 2 χωρίς κλείσιμο");
    expect(out).toContain("τιμή * 2 χωρίς κλείσιμο");
    expect(out).not.toContain("<em>");
  });
});

describe("lists", () => {
  it("renders a run of - items as one ul", () => {
    const out = html("- Παρουσίαση του προϊόντος\n- Δειγματισμός\n- Ερωτήσεις");
    expect(out).toMatch(/<ul[^>]*>/);
    expect((out.match(/<li>/g) ?? []).length).toBe(3);
    expect(out).toContain("Παρουσίαση του προϊόντος");
  });

  it("renders a run of * items as one ul too", () => {
    const out = html("* πρώτο\n* δεύτερο");
    expect(out).toMatch(/<ul[^>]*>/);
    expect((out.match(/<li>/g) ?? []).length).toBe(2);
  });

  it("renders a run of 1. items as one ol", () => {
    const out = html("1. πρώτο\n2. δεύτερο\n3. τρίτο");
    expect(out).toMatch(/<ol[^>]*>/);
    expect((out.match(/<li>/g) ?? []).length).toBe(3);
  });

  it("supports inline formatting inside list items", () => {
    const out = html("- **σημαντικό** σημείο");
    expect(out).toMatch(/<li><strong[^>]*>σημαντικό<\/strong> σημείο<\/li>/);
  });
});

describe("links", () => {
  it("renders an https link with the text as the label", () => {
    const out = html("Δες [το brief](https://example.com/brief)");
    expect(out).toMatch(/<a[^>]*href="https:\/\/example\.com\/brief"[^>]*>το brief<\/a>/);
  });

  it("renders an http link", () => {
    const out = html("[link](http://example.com)");
    expect(out).toContain('href="http://example.com"');
  });

  it("renders a mailto link", () => {
    const out = html("[email us](mailto:hello@example.com)");
    expect(out).toContain('href="mailto:hello@example.com"');
  });

  it("renders a site-relative link", () => {
    const out = html("[εδώ](/c/abc123)");
    expect(out).toContain('href="/c/abc123"');
  });

  it("does not turn a javascript: url into a link — renders the literal source instead", () => {
    const out = html("[κλικ εδώ](javascript:alert(1))");
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("href");
    expect(out).toContain("[κλικ εδώ](javascript:alert(1))");
  });

  it("marks external links non-following and non-opening the referrer", () => {
    const out = html("[link](https://example.com)");
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe("paragraphs and line breaks", () => {
  it("renders a single line as one paragraph", () => {
    const out = html("Καλησπέρα σας.");
    expect(out).toMatch(/<p[^>]*>Καλησπέρα σας\.<\/p>/);
  });

  it("joins consecutive lines inside a paragraph with <br/>, not a new <p>", () => {
    const out = html("Πρώτη γραμμή\nΔεύτερη γραμμή");
    expect((out.match(/<p[^>]*>/g) ?? []).length).toBe(1);
    expect(out).toContain("<br/>");
  });

  it("starts a new paragraph on a blank line", () => {
    const out = html("Πρώτη παράγραφος.\n\nΔεύτερη παράγραφος.");
    expect((out.match(/<p[^>]*>/g) ?? []).length).toBe(2);
  });

  it("returns nothing for empty or null source", () => {
    expect(html("")).toBe("");
    expect(html(null)).toBe("");
    expect(html(undefined)).toBe("");
  });
});

describe("security — untrusted input never becomes markup", () => {
  it("renders a <script> payload as visible escaped text, never as an actual tag", () => {
    const payload = "<script>alert('pwned')</script>";
    const out = html(payload);

    // The literal tag must never appear unescaped in the output HTML.
    expect(out).not.toMatch(/<script[\s>]/i);
    // But the text must still be there for the reader to see, HTML-escaped by React.
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("alert(");
  });

  it("renders an injected element (e.g. an img onerror payload) as text, not as an element", () => {
    const payload = '<img src=x onerror="alert(1)">';
    const out = html(payload);

    expect(out).not.toMatch(/<img[\s>]/i);
    expect(out).toContain("&lt;img");
    expect(out).not.toContain('onerror="alert(1)"');
  });

  it("does not let markdown syntax and raw HTML combine into an executable link", () => {
    // A coordinator brief containing both a real-looking bracket link and inline HTML.
    const payload = "[click me](https://example.com/\"><script>alert(1)</script>)";
    const out = html(payload);

    expect(out).not.toMatch(/<script[\s>]/i);
  });

  it("plain markdown content still renders normally alongside untrusted-input coverage", () => {
    const out = html("## Στόχος\n\n- Παρουσίαση του προϊόντος\n- Δειγματισμός στο ράφι");
    expect(out).toMatch(/<h2[^>]*>Στόχος<\/h2>/);
    expect(out).toMatch(/<ul[^>]*><li>Παρουσίαση του προϊόντος<\/li><li>Δειγματισμός στο ράφι<\/li><\/ul>/);
  });
});
