import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { articles } from "../content/articles.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
);
const pages = [
  "index.html",
  "about.html",
  "work.html",
  "journal.html",
  "resume.html",
  "contact.html",
  ...articles.map((a) => `journal/${a.slug}.html`),
];
const titles = new Set();
for (const file of pages) {
  const html = await readFile(path.join(root, file), "utf8");
  const title = html.match(/<title>(.*?)<\/title>/)?.[1];
  assert(title && !titles.has(title), `${file}: missing or duplicate title`);
  titles.add(title);
  assert.equal(
    (html.match(/<h1\b/g) || []).length,
    1,
    `${file}: one h1 required`,
  );
  assert(
    html.includes('aria-current="page"'),
    `${file}: active navigation missing`,
  );
  assert(!/href="#"/.test(html), `${file}: empty link`);
  for (const match of html.matchAll(
    /(?:href|src|poster)="([^"?]+)(?:\?[^"]*)?"/g,
  )) {
    const value = match[1];
    if (!value.startsWith("/") && !value.startsWith("#")) continue;
    const [url, hash] = value.split("#");
    const target = !url
      ? file
      : url === "/"
        ? "index.html"
        : path.extname(url)
          ? url.slice(1)
          : `${url.slice(1)}.html`;
    await access(path.join(root, target));
    if (hash) {
      const targetHtml = await readFile(path.join(root, target), "utf8");
      assert(
        targetHtml.includes(`id="${hash}"`),
        `${file}: missing anchor ${value}`,
      );
    }
  }
}
for (const a of articles) {
  const words = a.sections
    .flatMap((s) => s.slice(1))
    .join(" ")
    .split(/\s+/).length;
  assert(words >= 600, `${a.slug}: expected at least 600 words, got ${words}`);
}
console.log(
  `Verified ${pages.length} portfolio pages: unique titles, headings, active navigation, local assets, links, anchors, and three 600+ word essays.`,
);
