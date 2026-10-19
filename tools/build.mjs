#!/usr/bin/env node
// Production build: bundles js/main.js + css/*.css into single-file HTML pages.
//   node tools/build.mjs [--entry <path>] [--outdir <dir>] [--root <dir>]
// Writes
//   dist/acai-fever.html  standalone page (works from file://, no modules, no fetches)
//   dist/artifact.html    same content without doctype/html/head/body wrapper (Claude artifact)

import { build, transform, formatMessages } from 'esbuild';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ENTRY = 'js/main.js';
const USAGE = 'Usage: node tools/build.mjs [--entry <path>] [--outdir <dir>] [--root <dir>]';
const VIEWPORT_FIT_META = '<meta name="claude:viewport-fit-sides" content="cover">';

export class BuildError extends Error {}

const isExternal = (url) => /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url) || url.startsWith('data:');
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? null;

// Inline <script>/<style> content must never contain a closing tag or an HTML comment opener.
// \x3C is "<" in JS strings, template literals and regex literals alike.
export function escapeInlineScript(js) {
  return js.replace(/<(?=!--|\/script)/gi, '\\x3C');
}

export function escapeInlineStyle(css) {
  return css.replace(/<\/style/gi, '<\\/style');
}

// Parses the parts of index.html the build needs.
export function parseIndex(html) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const stylesheets = links.filter((tag) => /\brel\s*=\s*["']?stylesheet/i.test(tag));
  const localCss = stylesheets.filter((tag) => !isExternal(attr(tag, 'href') || ''));
  const fontLinks = links.filter((tag) => /fonts\.(googleapis|gstatic)\.com/i.test(attr(tag, 'href') || ''));
  // the installed web app's manifest and icons (files next to index.html): not for a single file
  const appLinks = links.filter((tag) => /\brel\s*=\s*["']?(?:manifest|icon|apple-touch-icon)\b/i.test(tag) && !isExternal(attr(tag, 'href') || ''));
  const moduleScript = html.match(/<script\b[^>]*\btype\s*=\s*["']module["'][^>]*>\s*<\/script>/i)?.[0] ?? null;
  const title = html.match(/<title>[\s\S]*?<\/title>/i)?.[0] ?? '<title>Açaí Fever</title>';
  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? null;
  return {
    localCss: localCss.map((tag) => ({ tag, href: attr(tag, 'href') })),
    fontLinks,
    appLinks,
    moduleScript,
    title,
    body,
  };
}

async function bundleJs(entryFile) {
  try {
    const result = await build({
      entryPoints: [entryFile],
      bundle: true,
      format: 'iife',
      minify: true,
      target: 'es2020',
      sourcemap: false,
      legalComments: 'none',
      banner: { js: '"use strict";' }, // module code always ran in strict mode
      write: false,
      logLevel: 'silent',
    });
    if (result.warnings.length) {
      const text = await formatMessages(result.warnings, { kind: 'warning', color: false });
      console.warn(text.join('\n'));
    }
    return result.outputFiles[0].text;
  } catch (err) {
    if (err.errors?.length) {
      const text = await formatMessages(err.errors, { kind: 'error', color: false });
      throw new BuildError(`esbuild could not bundle ${entryFile}:\n${text.join('\n')}`);
    }
    throw err;
  }
}

async function minifyCss(root, cssLinks) {
  const parts = [];
  for (const { href } of cssLinks) {
    parts.push(`/* ${href} */\n${await readFile(path.join(root, href), 'utf8')}`);
  }
  const joined = parts.join('\n');
  if (/@import\b/i.test(joined)) console.warn('build: warning – @import inside local CSS is not inlined.');
  if (/url\((?![\s"']*(?:data:|https?:|#))/i.test(joined)) {
    console.warn('build: warning – local CSS references a relative url(); it will not resolve from file://.');
  }
  const { code } = await transform(joined, { loader: 'css', minify: true, legalComments: 'none' });
  return code.trim();
}

function replaceOnce(html, search, replacement) {
  const i = html.indexOf(search);
  if (i < 0) throw new BuildError(`build: could not find ${search} in index.html`);
  return html.slice(0, i) + replacement + html.slice(i + search.length);
}

function removeTag(html, tag) {
  return html.replace(new RegExp(`[ \\t]*${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ \\t]*\\r?\\n?`), '');
}

// favicon: an optional data: URL for the tab icon (the app links to files are left out of a single file)
export function standalonePage(html, parsed, css, js, favicon = null) {
  let out = html;
  const [firstApp, ...moreApp] = parsed.appLinks || [];
  if (firstApp) out = favicon ? replaceOnce(out, firstApp, `<link rel="icon" href="${favicon}">`) : removeTag(out, firstApp);
  for (const link of moreApp) out = removeTag(out, link);
  const [first, ...rest] = parsed.localCss;
  if (first) out = replaceOnce(out, first.tag, `<style>${escapeInlineStyle(css)}</style>`);
  for (const link of rest) out = removeTag(out, link.tag);
  // Classic script at the end of <body>: DOM is parsed, same timing as a module script.
  return replaceOnce(out, parsed.moduleScript, `<script>${escapeInlineScript(js)}</script>`);
}

export function artifactPage(parsed, css, js) {
  const bodyMarkup = removeTag(parsed.body, parsed.moduleScript)
    .split('\n')
    .filter((line) => line.trim())
    .join('\n');
  return [
    parsed.title,
    VIEWPORT_FIT_META,
    ...parsed.fontLinks,
    `<style>${escapeInlineStyle(css)}</style>`,
    bodyMarkup,
    `<script>${escapeInlineScript(js)}</script>`,
    '',
  ].join('\n');
}

function leftoverLocalRefs(page) {
  const refs = [...page.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  // markup built in the bundled JS (src="${url}") is filled in at runtime, it is no file
  return refs.filter((u) => !isExternal(u) && !u.startsWith('#') && !u.startsWith('mailto:') && !u.includes('${'));
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

export async function buildGame({ root = REPO_ROOT, entry = DEFAULT_ENTRY, outDir = 'dist' } = {}) {
  const absRoot = path.resolve(root);
  const indexFile = path.join(absRoot, 'index.html');
  if (!existsSync(indexFile)) throw new BuildError(`build: missing input ${indexFile}`);
  const html = await readFile(indexFile, 'utf8');
  const parsed = parseIndex(html);

  if (!parsed.moduleScript) throw new BuildError('build: index.html has no <script type="module"> to replace.');
  if (parsed.body === null) throw new BuildError('build: index.html has no <body>.');
  if (!parsed.localCss.length) throw new BuildError('build: index.html links no local stylesheets.');
  const entryFile = path.resolve(absRoot, entry);
  const inputs = [...parsed.localCss.map(({ href }) => path.join(absRoot, href)), entryFile];
  const missing = inputs.filter((file) => !existsSync(file));
  if (missing.length) {
    const shown = missing.map((file) => (file.startsWith(absRoot + path.sep) ? path.relative(absRoot, file) : file));
    throw new BuildError(`build: missing input file(s): ${shown.join(', ')}\n(root ${absRoot}; another entry: --entry <path>)`);
  }

  const [js, css] = await Promise.all([bundleJs(entryFile), minifyCss(absRoot, parsed.localCss)]);
  const faviconFile = path.join(absRoot, 'icons', 'favicon-32.png');
  const favicon = existsSync(faviconFile) ? `data:image/png;base64,${(await readFile(faviconFile)).toString('base64')}` : null;
  const pages = {
    'acai-fever.html': standalonePage(html, parsed, css, js, favicon),
    'artifact.html': artifactPage(parsed, css, js),
  };

  const absOut = path.resolve(absRoot, outDir);
  await mkdir(absOut, { recursive: true });
  const files = [];
  for (const [name, content] of Object.entries(pages)) {
    const leftovers = leftoverLocalRefs(content);
    if (leftovers.length) console.warn(`build: warning – ${name} still references local files: ${leftovers.join(', ')}`);
    const file = path.join(absOut, name);
    await writeFile(file, content);
    const buf = Buffer.from(content);
    files.push({ file, bytes: buf.length, gzip: gzipSync(buf).length });
  }
  return { files, jsBytes: Buffer.byteLength(js), cssBytes: Buffer.byteLength(css) };
}

function parseCli(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const [flag, inline] = a.split(/=(.*)/s);
    const key = { '--entry': 'entry', '--outdir': 'outDir', '--root': 'root' }[flag];
    if (!key) throw new BuildError(`build: unknown argument ${a}\n${USAGE}`);
    const value = inline ?? argv[++i];
    if (!value) throw new BuildError(`build: ${flag} needs a value\n${USAGE}`);
    opts[key] = path.resolve(value);
  }
  return opts;
}

async function main() {
  const started = Date.now();
  try {
    const { files, jsBytes, cssBytes } = await buildGame(parseCli(process.argv.slice(2)));
    console.log(`bundle: js ${kb(jsBytes)}, css ${kb(cssBytes)}`);
    for (const f of files) {
      const rel = path.relative(process.cwd(), f.file);
      const shown = rel && !rel.startsWith('..') ? rel : f.file;
      console.log(`wrote ${shown.padEnd(24)} ${kb(f.bytes).padStart(10)}  (gzip ${kb(f.gzip)})`);
    }
    console.log(`done in ${Date.now() - started} ms`);
  } catch (err) {
    console.error(err instanceof BuildError ? err.message : err);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
