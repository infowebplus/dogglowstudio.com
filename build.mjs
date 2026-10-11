#!/usr/bin/env node
/**
 * Build Dog Glow Studio from config.json
 *
 *   src/   → source (edit here)
 *   dist/  → production output (deploy this)
 *
 * Usage:
 *   npm run build
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minify as minifyHtml } from "html-minifier-terser";
import CleanCSS from "clean-css";
import { minify as minifyJs } from "terser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const src = path.join(root, "src");
const dist = path.join(root, "dist");

const configPath = path.join(root, "config.json");
const htmlPath = path.join(src, "index.html");
const siteConfigPath = path.join(src, "assets", "js", "site-config.js");
const mainJsPath = path.join(src, "assets", "js", "main.js");
const cssPath = path.join(src, "assets", "css", "style.css");
const codeGsPath = path.join(root, "booking", "Code.gs");

const USED_IMAGES = [
  "assets/img/logo.svg",
  "assets/img/logo-name.svg",
  "assets/img/og-dog-glow-studio.jpg",
  "assets/img/peluqueria-canina-manilva-hero.jpg",
  "assets/img/peluqueria-canina-manilva-hero.webp",
  "assets/img/estudio-peluqueria-canina-manilva.jpg",
  "assets/img/estudio-peluqueria-canina-manilva.webp",
  "assets/img/studio/peluqueria-canina-servicio.jpg",
  "assets/img/studio/peluqueria-canina-servicio.webp",
  "assets/img/studio/spa-aromaterapia-perro.jpg",
  "assets/img/studio/spa-aromaterapia-perro.webp",
  "assets/img/studio/ozonoterapia-cuidado-piel.jpg",
  "assets/img/studio/ozonoterapia-cuidado-piel.webp",
  "assets/img/studio/tratamientos-pomerania.jpg",
  "assets/img/studio/tratamientos-pomerania.webp",
  "assets/img/studio/bano-profesional-perro.jpg",
  "assets/img/studio/bano-profesional-perro.webp"
];

const STATIC_ROOT_FILES = ["robots.txt", "sitemap.xml", "llms.txt", "_redirects"];
const DEFAULT_SITE_ORIGIN = "https://dogglowstudio.infowebplus.com";

function die(msg) {
  console.error("build failed:", msg);
  process.exit(1);
}

/** Canonical site origin from config.json (no trailing slash). */
function siteOrigin(cfg) {
  const raw =
    (cfg && cfg.site && cfg.site.canonicalUrl) || DEFAULT_SITE_ORIGIN;
  return String(raw).trim().replace(/\/+$/, "");
}

/** Rewrite absolute SEO URLs so OG/WhatsApp preview hits a reachable host. */
function applySiteOrigin(text, origin) {
  return String(text)
    .replace(/https:\/\/www\.dogglowstudio\.com/g, origin)
    .replace(/https:\/\/dogglowstudio\.infowebplus\.com/g, origin);
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

function stripTags(html) {
  return decodeEntities(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function metaContent(html, nameOrProp) {
  const reName = new RegExp(
    `<meta[^>]*(?:name|property)=["']${nameOrProp}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${nameOrProp}["'][^>]*>`,
    "i"
  );
  const m = html.match(reName);
  return m ? decodeEntities(m[1] || m[2] || "") : "";
}

function titleText(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]) : "";
}

function extractMain(html) {
  const m = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  return m ? m[1] : html;
}

/**
 * Convert index.html body content into an AI-friendly Markdown document.
 * Generated at build time — do not edit dist/index.md by hand.
 */
function buildIndexMarkdown(html, cfg) {
  const site = (cfg && cfg.site) || {};
  const services = (cfg && cfg.services) || {};
  const cal = (cfg && cfg.calendar) || {};
  const origin = siteOrigin(cfg);
  const main = extractMain(html);
  const lines = [];

  const title = titleText(html) || "Dog Glow Studio";
  const description =
    metaContent(html, "description") ||
    "Peluquería canina en San Luis de Sabinillas, Manilva.";

  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`> ${description}`);
  lines.push("");
  lines.push(
    `_Documento Markdown generado automáticamente desde \`index.html\` para agentes de IA. Fuente canónica: ${origin}/_`
  );
  lines.push("");

  lines.push("## Negocio");
  lines.push("");
  lines.push("- **Nombre:** Dog Glow Studio");
  lines.push("- **Tipo:** Peluquería canina / grooming salon");
  lines.push(
    `- **Ubicación:** ${site.address?.addressLocality || "San Luis de Sabinillas"}, Manilva, ${site.address?.addressRegion || "Málaga"}, Spain`
  );
  if (site.telephoneDisplay || site.whatsappDisplay) {
    lines.push(
      `- **Teléfono / WhatsApp:** ${site.telephoneDisplay || site.whatsappDisplay}`
    );
  }
  if (site.telephone) {
    lines.push(`- **tel:** ${site.telephone}`);
  }
  if (site.whatsappNumber) {
    lines.push(`- **WhatsApp:** https://wa.me/${site.whatsappNumber}`);
  }
  if (site.mapsUrl) {
    lines.push(`- **Mapa:** ${site.mapsUrl}`);
  }
  const hours = cal.workingHours || {};
  if (hours.start && hours.end) {
    lines.push(
      `- **Horario:** lunes–sábado, ${hours.start}–${hours.end}, bajo cita`
    );
  }
  lines.push(`- **Web:** ${origin}/`);
  lines.push(`- **llms.txt:** ${origin}/llms.txt`);
  lines.push("");

  // Prefer content outside the booking form UI chrome
  const mainForAi = main
    .replace(/<form\b[\s\S]*?<\/form>/gi, " ")
    .replace(/<ol\b[^>]*class="[^"]*stepper[^"]*"[\s\S]*?<\/ol>/gi, " ");

  const blockRe =
    /<(h[1-6]|p|li|summary)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  const seen = new Set();

  while ((match = blockRe.exec(mainForAi)) !== null) {
    const tag = match[1].toLowerCase();
    const text = stripTags(match[2]);
    if (!text || text.length < 2) continue;

    // Skip section labels / UI chrome (headings like Contacto / Reservar cita are kept)
    if (
      /^(WhatsApp|Atrás|Siguiente|Confirmar por WhatsApp|Lo que hacemos|Tu próxima cita|Ven a visitarnos|Resolvemos dudas|Elige un servicio|Escribir por WhatsApp)$/i.test(
        text
      )
    ) {
      continue;
    }

    const key = tag + ":" + text;
    if (seen.has(key)) continue;
    seen.add(key);

    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      lines.push("");
      lines.push(`${"#".repeat(Math.min(level + 1, 6))} ${text}`);
      lines.push("");
    } else if (tag === "summary") {
      lines.push("");
      lines.push(`### ${text}`);
      lines.push("");
    } else if (tag === "li") {
      // Skip feature bullets that are only icon labels already covered, keep real content
      if (/^(Cariño|Calidad|Seguridad|Grooming profesional|Cuidado con amor|Productos de alta calidad|Resultados increíbles)/i.test(text)) {
        lines.push(`- ${text}`);
      } else if (text.length > 40) {
        lines.push(`- ${text}`);
      }
    } else {
      lines.push(text);
      lines.push("");
    }
  }

  // Structured services from config (authoritative prices)
  lines.push("");
  lines.push("## Servicios y precios (config)");
  lines.push("");
  for (const [id, s] of Object.entries(services)) {
    lines.push(
      `- **${s.label || id}** — desde €${s.price} · ~${s.duration} min (\`${id}\`)`
    );
  }
  lines.push("");
  lines.push(
    "El precio final puede variar según el tamaño del perro, el tipo de pelo y el estado del manto."
  );
  lines.push("");

  lines.push("## Enlaces útiles");
  lines.push("");
  lines.push(`- [Inicio](${origin}/#inicio)`);
  lines.push(`- [Servicios](${origin}/#servicios)`);
  lines.push(`- [Reservar cita](${origin}/#reserva)`);
  lines.push(`- [Sobre nosotros](${origin}/#estudio)`);
  lines.push(`- [FAQ](${origin}/#faq)`);
  lines.push(`- [Contacto](${origin}/#contacto)`);
  lines.push("");

  // Normalize excessive blank lines
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    die(`cannot read ${file}: ${err.message}`);
  }
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(dest);
  fs.copyFileSync(src, dest);
}

function durationsMap(services) {
  const out = {};
  for (const [id, s] of Object.entries(services || {})) {
    out[id] = Number(s.duration) || 60;
  }
  return out;
}

function labelsMap(services) {
  const out = {};
  for (const [id, s] of Object.entries(services || {})) {
    out[id] = s.label || id;
  }
  return out;
}

function buildSiteConfigJs(cfg) {
  const site = cfg.site || {};
  const api = cfg.bookingApi || {};
  const cal = cfg.calendar || {};
  const services = cfg.services || {};

  const payload = {
    whatsappNumber: site.whatsappNumber || "",
    whatsappMessage: site.whatsappMessage || "",
    instagramUrl: site.instagramUrl || "",
    mapsUrl: site.mapsUrl || "",
    bookingApiUrl: api.url || "",
    bookingApiKey: api.key || cal.apiKey || "",
    bookingFallback: {
      workingDays: cal.workingDays || [1, 2, 3, 4, 5, 6],
      workingHours: cal.workingHours || { start: "09:00", end: "19:00" },
      slotStepMinutes: cal.slotStepMinutes || 30,
      bufferMinutes: cal.bufferMinutes || 0,
      services: durationsMap(services),
      createEvents: !!cal.createEvents
    },
    serviceLabels: labelsMap(services)
  };

  return [
    "/* Generated by build.mjs — do not edit by hand. Edit config.json instead. */",
    "window.SITE_CONFIG = " + JSON.stringify(payload, null, 2) + ";",
    ""
  ].join("\n");
}

function buildAppsScriptConfig(cfg) {
  const cal = cfg.calendar || {};
  const api = cfg.bookingApi || {};
  const services = durationsMap(cfg.services || {});
  const apiKey = cal.apiKey || api.key || "";

  const obj = {
    calendarId: cal.calendarId || "primary",
    timezone: cal.timezone || "Europe/Madrid",
    workingDays: cal.workingDays || [1, 2, 3, 4, 5, 6],
    workingHours: cal.workingHours || { start: "09:00", end: "19:00" },
    slotStepMinutes: cal.slotStepMinutes || 30,
    bufferMinutes: cal.bufferMinutes || 0,
    services,
    CREATE_EVENTS: !!cal.createEvents,
    apiKey
  };

  const body = JSON.stringify(obj, null, 2).replace(
    /"([A-Za-z_][A-Za-z0-9_]*)":/g,
    "$1:"
  );

  return [
    "/* @@CONFIG_START@@ — generated from config.json by build.mjs */",
    "var CONFIG = " + body + ";",
    "/* @@CONFIG_END@@ */"
  ].join("\n");
}

function patchCodeGs(cfg) {
  if (!fs.existsSync(codeGsPath)) die("missing booking/Code.gs");
  let src = fs.readFileSync(codeGsPath, "utf8");
  const block = buildAppsScriptConfig(cfg);
  const re = /\/\* @@CONFIG_START@@[\s\S]*?\/\* @@CONFIG_END@@ \*\//;

  if (re.test(src)) {
    src = src.replace(re, block);
  } else {
    const legacy = /var CONFIG = \{[\s\S]*?\n\};/;
    if (!legacy.test(src)) die("could not find CONFIG in Code.gs");
    src = src.replace(legacy, block + "\n");
  }

  fs.writeFileSync(codeGsPath, src, "utf8");
}

function patchHtml(cfg) {
  let html = fs.readFileSync(htmlPath, "utf8");
  const services = cfg.services || {};
  const display = (cfg.site && cfg.site.whatsappDisplay) || "";

  for (const [id, s] of Object.entries(services)) {
    const price = Number(s.price);
    const duration = Number(s.duration);
    const re = new RegExp(
      `(<input[^>]*name="servicio"[^>]*value="${id}"[^>]*)(data-price="\\d+"\\s+data-duration="\\d+")([^>]*>)`,
      "i"
    );
    const reAlt = new RegExp(
      `(<input[^>]*value="${id}"[^>]*name="servicio"[^>]*)(data-price="\\d+"\\s+data-duration="\\d+")([^>]*>)`,
      "i"
    );

    const replaceAttrs = `$1data-price="${price}" data-duration="${duration}"$3`;
    if (re.test(html)) html = html.replace(re, replaceAttrs);
    else if (reAlt.test(html)) html = html.replace(reAlt, replaceAttrs);

    const smallRe = new RegExp(
      `(value="${id}"[\\s\\S]*?<strong>[\\s\\S]*?<\\/strong>\\s*<small>)[^<]*(<\\/small>)`,
      "i"
    );
    if (smallRe.test(html)) {
      html = html.replace(smallRe, `$1Desde €${price} · ~${duration} min$2`);
    }
  }

  if (display) {
    html = html.replace(
      /(<a href="(?:#|https:\/\/wa\.me\/[^"]*)" class="js-whatsapp"[^>]*>)(\+34[\d\s]+)(<\/a>)/,
      `$1${display}$3`
    );
  }

  if (!html.includes("assets/js/site-config.js")) {
    html = html.replace(
      /<script src="\/?assets\/js\/main\.js"><\/script>/,
      '<script src="/assets/js/site-config.js"></script>\n<script src="/assets/js/main.js"></script>'
    );
  }

  fs.writeFileSync(htmlPath, html, "utf8");
  return html;
}

async function writeDist(htmlSrc, cfg) {
  rmrf(dist);
  fs.mkdirSync(dist, { recursive: true });

  // Images (from src/ → dist/)
  for (const rel of USED_IMAGES) {
    const from = path.join(src, rel);
    if (!fs.existsSync(from)) die("missing image: src/" + rel);
    copyFile(from, path.join(dist, rel));
  }

  const origin = siteOrigin(cfg);

  // Root SEO / AI files (rewrite absolute URLs to live origin)
  for (const name of STATIC_ROOT_FILES) {
    const from = path.join(src, name);
    if (!fs.existsSync(from)) die("missing: src/" + name);
    const body = applySiteOrigin(fs.readFileSync(from, "utf8"), origin);
    const dest = path.join(dist, name);
    ensureDir(dest);
    fs.writeFileSync(dest, body, "utf8");
  }

  // AI markdown mirror of index.html (llmstxt.org: page.md)
  const indexMd = applySiteOrigin(buildIndexMarkdown(htmlSrc, cfg), origin);
  fs.writeFileSync(path.join(dist, "index.md"), indexMd, "utf8");
  // Alias short name some tools look for
  copyFile(path.join(dist, "llms.txt"), path.join(dist, "llm.txt"));

  // CSS
  const cssRaw = fs.readFileSync(cssPath, "utf8");
  const cssOut = new CleanCSS({ level: 2 }).minify(cssRaw);
  if (cssOut.errors && cssOut.errors.length) {
    die("css minify: " + cssOut.errors.join("; "));
  }
  const distCss = path.join(dist, "assets", "css", "style.css");
  ensureDir(distCss);
  fs.writeFileSync(distCss, cssOut.styles, "utf8");

  // JS — bundle site-config + main, then minify
  const configJs = fs.readFileSync(siteConfigPath, "utf8");
  const mainJs = fs.readFileSync(mainJsPath, "utf8");
  const bundled = configJs + "\n" + mainJs;
  const jsOut = await minifyJs(bundled, {
    compress: true,
    mangle: true,
    format: { comments: false }
  });
  if (jsOut.error) die("js minify: " + jsOut.error);
  const distJs = path.join(dist, "assets", "js", "app.js");
  ensureDir(distJs);
  fs.writeFileSync(distJs, jsOut.code, "utf8");

  // HTML — point to bundled assets, rewrite site origin, then minify
  let html = applySiteOrigin(htmlSrc, origin)
    .replace(
      /<link rel="stylesheet" href="\/?assets\/css\/style\.css">/,
      '<link rel="stylesheet" href="/assets/css/style.css">'
    )
    .replace(
      /<script src="\/?assets\/js\/site-config\.js"><\/script>\s*<script src="\/?assets\/js\/main\.js"><\/script>/,
      '<script src="/assets/js/app.js" defer></script>'
    );

  html = await minifyHtml(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    minifyCSS: true,
    minifyJS: true,
    sortAttributes: true,
    sortClassName: true
  });

  fs.writeFileSync(path.join(dist, "index.html"), html, "utf8");

  const bytes = (p) => fs.statSync(p).size;
  console.log(
    "dist ready:",
    "html", bytes(path.join(dist, "index.html")),
    "md", bytes(path.join(dist, "index.md")),
    "css", bytes(distCss),
    "js", bytes(distJs),
    "images", USED_IMAGES.length
  );
}

async function main() {
  const cfg = readJson(configPath);

  fs.mkdirSync(path.dirname(siteConfigPath), { recursive: true });
  fs.writeFileSync(siteConfigPath, buildSiteConfigJs(cfg), "utf8");
  console.log("wrote", path.relative(root, siteConfigPath));

  patchCodeGs(cfg);
  console.log("updated", path.relative(root, codeGsPath), "(CONFIG)");

  const html = patchHtml(cfg);
  console.log("updated", path.relative(root, htmlPath));

  await writeDist(html, cfg);
  console.log("site origin:", siteOrigin(cfg));
  console.log("wrote dist/llms.txt + dist/index.md (AI)");
  console.log("build ok → dist/  (npm run serve)");
}

main().catch((err) => die(err.stack || String(err)));
