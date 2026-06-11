import { createServer } from "node:http";
import { access, readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("./public", import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://127.0.0.1:1234";
const VIBE_COMMAND = process.env.VIBE_COMMAND || "vibe";
const VIBE_MODEL = "vibe:mistral-medium-3.5";
const ANTIGRAVITY_COMMAND = process.env.ANTIGRAVITY_COMMAND || "agy";
const ANTIGRAVITY_PREFIX = "antigravity:";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

function element(type, content, styles = {}, extra = {}) {
  return { id: uid(type), type, content, styles, ...extra };
}

function section(type, children, styles = {}) {
  return { id: uid("section"), type, children, styles };
}

function page(name, slug, sections) {
  return { id: uid("page"), name, slug, sections };
}

export function createFallbackProject(brief = "") {
  const lower = brief.toLowerCase();
  const isFood = /restaurant|café|cafe|boulanger|cuisine/.test(lower);
  const isPortfolio = /portfolio|photographe|designer|artiste/.test(lower);
  const isTech = /application|saas|startup|logiciel|tech/.test(lower);
  const title = isFood ? "Découvrir notre cuisine" : isPortfolio ? "Projets sélectionnés" : isTech ? "Une solution pour mieux avancer" : "Présentation du projet";
  const brand = isFood ? "Nom du restaurant" : isPortfolio ? "Nom du studio" : isTech ? "Nom du produit" : "Nom du projet";
  const accent = "#2f3137";
  const bg = "#f4f4f2";

  return {
    version: 2,
    name: brand,
    theme: {
      background: bg,
      surface: "#ffffff",
      text: "#17181c",
      muted: "#6f7178",
      accent,
      font: "Inter, system-ui, sans-serif",
      radius: 4
    },
    pages: [page("Accueil", "index", [
        section("navbar", [
          element("logo", brand, { fontSize: 20, fontWeight: 700 }),
          element("nav", "Accueil|Services|À propos", { fontSize: 14 }),
          element("button", "Contact", { background: "#2f3137", color: "#ffffff", borderRadius: 4, paddingY: 10, paddingX: 16 }, { href: "#contact", effect: "none" })
        ], { paddingY: 18, paddingX: 40, layout: "row", align: "center", justify: "between", background: "#ffffff" }),
        section("hero", [
          element("badge", "INTRODUCTION", { color: "#6f7178", fontSize: 11, fontWeight: 700, letterSpacing: 1 }),
          element("heading", title, { fontSize: 48, fontWeight: 700, maxWidth: 720, lineHeight: 1.1, textAlign: "left" }),
          element("text", "Expliquez ici en quelques mots ce que vous proposez et à qui ce projet s'adresse.", { fontSize: 17, maxWidth: 620, color: "#6f7178", lineHeight: 1.55, textAlign: "left" }),
          element("button", "Action principale", { background: accent, color: "#ffffff", borderRadius: 4, paddingY: 12, paddingX: 18, fontWeight: 600 }, { href: "#services", effect: "none" })
        ], { paddingY: 72, paddingX: 40, layout: "column", align: "start", gap: 18, background: bg }),
        section("features", [
          element("heading", "Informations principales", { fontSize: 32, fontWeight: 700, textAlign: "left", maxWidth: 620 }),
          element("card", "Bloc 1\nUne information utile à détailler.", { background: "#ffffff", borderRadius: 4, paddingY: 22, paddingX: 22 }),
          element("card", "Bloc 2\nUne seconde information utile.", { background: "#ffffff", borderRadius: 4, paddingY: 22, paddingX: 22 }),
          element("card", "Bloc 3\nUn dernier point pour compléter la structure.", { background: "#ffffff", borderRadius: 4, paddingY: 22, paddingX: 22 })
        ], { paddingY: 64, paddingX: 40, layout: "grid", columns: 3, gap: 12, background: "#e9e9e6" }),
        section("cta", [
          element("heading", "Prochaine étape", { fontSize: 32, fontWeight: 700, maxWidth: 620 }),
          element("text", "Indiquez clairement ce que le visiteur doit faire ensuite.", { fontSize: 16, color: "#6f7178" }),
          element("button", "Nous contacter", { background: accent, color: "#ffffff", borderRadius: 4, paddingY: 12, paddingX: 18, fontWeight: 600 }, { href: "mailto:bonjour@example.com", effect: "none" })
        ], { paddingY: 56, paddingX: 40, layout: "column", align: "start", gap: 14, background: "#ffffff" }),
        section("footer", [
          element("logo", brand, { fontSize: 20, fontWeight: 800 }),
          element("text", "© 2026 — Tous droits réservés", { fontSize: 13, color: "#777c87" })
        ], { paddingY: 24, paddingX: 40, layout: "row", align: "center", justify: "between", background: "#f4f4f2" })
      ])]
  };
}

function cssLengthToPixels(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value || "").trim().match(/^(-?\d+(?:\.\d+)?)(px|rem|em)?$/i);
  if (!match) return value;
  const amount = Number(match[1]);
  return ["rem", "em"].includes(match[2]?.toLowerCase()) ? Math.round(amount * 16 * 100) / 100 : amount;
}

function normalizeStyles(rawStyles = {}) {
  const styleAliases = {
    "font-size": "fontSize", font_size: "fontSize", "font-weight": "fontWeight", font_weight: "fontWeight",
    "line-height": "lineHeight", line_height: "lineHeight", "letter-spacing": "letterSpacing", letter_spacing: "letterSpacing",
    "text-align": "textAlign", text_align: "textAlign", "border-radius": "borderRadius", border_radius: "borderRadius",
    "max-width": "maxWidth", max_width: "maxWidth", "min-height": "minHeight", min_height: "minHeight",
    "grid-column": "gridColumn", grid_column: "gridColumn", padding_y: "paddingY", padding_x: "paddingX",
    backgroundColor: "background", "background-color": "background", justifyContent: "justify", alignItems: "align",
    gridTemplateColumns: "gridTemplateColumns", "grid-template-columns": "gridTemplateColumns"
  };
  const styles = Object.fromEntries(Object.entries(rawStyles).map(([key, item]) => [styleAliases[key] || key, item]));
  if (styles.display === "grid") styles.layout = "grid";
  else if (styles.flexDirection === "row") styles.layout = "row";
  else if (styles.flexDirection === "column") styles.layout = "column";
  else if (styles.display === "flex") styles.layout ||= "flex";
  if (typeof styles.gridTemplateColumns === "string") {
    const tracks = styles.gridTemplateColumns.trim().split(/\s+/).filter(Boolean).map((track) => /^\d+(?:\.\d+)?$/.test(track) ? `${track}px` : track);
    styles.gridTemplateColumns = tracks.join(" ");
    if (tracks.length > 1 && !/repeat\(/i.test(styles.gridTemplateColumns)) styles.columns = tracks.length;
    const repeat = styles.gridTemplateColumns.match(/repeat\(\s*(\d+)/i);
    if (repeat) styles.columns = Number(repeat[1]);
  }
  const alignMap = { "flex-start": "start", start: "start", center: "center", "flex-end": "end", end: "end", stretch: "stretch" };
  const justifyMap = { "flex-start": "start", start: "start", center: "center", "flex-end": "end", end: "end", "space-between": "between", between: "between" };
  if (styles.align) styles.align = alignMap[styles.align] || styles.align;
  if (styles.justify) styles.justify = justifyMap[styles.justify] || styles.justify;
  if (typeof styles.padding === "string") {
    const values = styles.padding.trim().split(/\s+/).map(cssLengthToPixels);
    if (values.every((item) => typeof item === "number")) {
      styles.paddingY = values[0];
      styles.paddingX = values.length > 1 ? values[1] : values[0];
    }
  }
  if (styles.height !== undefined && styles.minHeight === undefined) styles.minHeight = styles.height;
  ["fontSize", "borderRadius", "maxWidth", "minHeight", "gap", "paddingY", "paddingX", "letterSpacing"].forEach((key) => {
    if (styles[key] !== undefined) styles[key] = cssLengthToPixels(styles[key]);
  });
  if (typeof styles.lineHeight === "number" && styles.lineHeight > 4) styles.lineHeight = `${styles.lineHeight}px`;
  if (typeof styles.lineHeight === "string" && /^\d+(?:\.\d+)?(?:px|rem|em)$/.test(styles.lineHeight.trim())) styles.lineHeight = styles.lineHeight.trim();
  delete styles.display;
  delete styles.flexDirection;
  delete styles.padding;
  delete styles.height;
  delete styles.backgroundColor;
  delete styles.justifyContent;
  delete styles.alignItems;
  return styles;
}

function ensureElement(value) {
  const allowed = new Set(["logo", "nav", "badge", "heading", "text", "button", "card", "image", "divider"]);
  const aliases = {
    title: "heading", headline: "heading", h1: "heading", h2: "heading",
    paragraph: "text", copy: "text", description: "text", body: "text",
    link: "button", cta: "button", action: "button",
    visual: "image", photo: "image", illustration: "image", media: "image",
    feature: "card", testimonial: "card", stat: "card", item: "card",
    menu: "nav", navigation: "nav", brand: "logo", label: "badge"
  };
  const rawType = typeof value?.type === "string" ? value.type.toLowerCase() : "";
  const type = allowed.has(rawType) ? rawType : aliases[rawType] || "text";
  const rawContent = value?.content ?? value?.text ?? value?.label ?? value?.title;
  const content = typeof rawContent === "string"
    ? rawContent.trim()
    : Array.isArray(rawContent)
      ? rawContent.filter((item) => typeof item === "string").join("|")
      : "";
  const styles = normalizeStyles(value?.styles && typeof value.styles === "object" ? value.styles : {});
  return {
    id: typeof value?.id === "string" ? value.id : uid("element"),
    type,
    content: content || (type === "image" ? "Visuel" : type === "divider" ? "" : "Nouvel élément"),
    styles,
    ...(typeof value?.href === "string" ? { href: value.href } : type === "button" ? { href: "#" } : {}),
    ...(typeof value?.effect === "string" ? { effect: value.effect } : {})
  };
}

export function normalizeProject(input, brief = "") {
  const fallback = createFallbackProject(brief);
  if (!input || typeof input !== "object") return fallback;
  const sourcePages = Array.isArray(input.pages) && input.pages.length
    ? input.pages
    : input.page
      ? [input.page]
      : fallback.pages;
  const pages = sourcePages.slice(0, 20).map((sourcePage, pageIndex) => {
    const fallbackPage = fallback.pages[0];
    const sections = Array.isArray(sourcePage?.sections)
      ? sourcePage.sections.slice(0, 12).map((item) => ({
        id: typeof item?.id === "string" ? item.id : uid("section"),
        type: typeof item?.type === "string" ? item.type : "content",
        styles: normalizeStyles(item?.styles && typeof item.styles === "object" ? item.styles : {}),
        children: Array.isArray(item?.children) ? item.children.slice(0, 20).map(ensureElement) : []
      })).filter((item) => item.children.length)
      : fallbackPage.sections;
    const name = typeof sourcePage?.name === "string" ? sourcePage.name.slice(0, 60) : `Page ${pageIndex + 1}`;
    const rawSlug = typeof sourcePage?.slug === "string" ? sourcePage.slug : name;
    const slug = pageIndex === 0 ? "index" : rawSlug.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `page-${pageIndex + 1}`;
    return {
      id: typeof sourcePage?.id === "string" ? sourcePage.id : uid("page"),
      name,
      slug,
      sections: sections.length ? sections : fallbackPage.sections
    };
  });

  return {
    version: 2,
    name: typeof input.name === "string" ? input.name.slice(0, 80) : fallback.name,
    theme: { ...fallback.theme, ...(input.theme && typeof input.theme === "object" ? input.theme : {}) },
    pages: pages.length ? pages : fallback.pages
  };
}

const HEADER_SECTION_TYPES = new Set(["navbar", "hero"]);

function sectionBelongsToPart(section, part) {
  if (part === "header") return HEADER_SECTION_TYPES.has(section.type);
  if (part === "footer") return section.type === "footer";
  return !HEADER_SECTION_TYPES.has(section.type) && section.type !== "footer";
}

const densityScale = { airy: 1.3, balanced: 1, compact: 0.72 };

function applyFallbackDensity(sections, density = "balanced") {
  const scale = densityScale[density] || 1;
  sections.forEach((item) => {
    item.styles.paddingY = Math.round(Number(item.styles.paddingY || 40) * scale);
    item.styles.paddingX = Math.round(Number(item.styles.paddingX || 40) * (density === "compact" ? .82 : 1));
    item.styles.gap = Math.round(Number(item.styles.gap || 14) * scale);
  });
}

function customizeFallbackPart(sections, part, controls = {}, project) {
  const layout = controls.layout || "auto";
  if (part === "header") {
    const hero = sections.find((item) => item.type === "hero");
    if (!hero) return sections;
    if (["split", "editorial"].includes(layout)) {
      hero.styles.layout = "grid";
      hero.styles.columns = 2;
      hero.styles.align = "center";
      hero.children.push(element("image", "Visuel principal", { minHeight: 320, borderRadius: layout === "editorial" ? 0 : 4 }));
    }
    if (layout === "centered") {
      hero.styles.layout = "column";
      hero.styles.align = "center";
      hero.children.forEach((item) => { item.styles.textAlign = "center"; });
    }
    if (layout === "editorial") {
      const heading = hero.children.find((item) => item.type === "heading");
      if (heading) { heading.styles.fontSize = 68; heading.styles.lineHeight = .95; }
      hero.styles.background = "#ffffff";
    }
    if (layout === "minimal") {
      hero.styles.paddingY = 44;
      hero.children = hero.children.filter((item) => !["badge", "image"].includes(item.type)).slice(0, 3);
    }
  }
  if (part === "main") {
    if (layout === "alternating") {
      const accent = project.theme.accent;
      sections = [
        section("content", [
          element("heading", "Une approche pensée pour vos besoins", { fontSize: 38, fontWeight: 700, maxWidth: 460 }),
          element("text", "Présentez ici votre première idée forte avec un contenu précis et une preuve concrète.", { fontSize: 16, color: project.theme.muted, lineHeight: 1.6, maxWidth: 500 }),
          element("image", "Premier visuel", { minHeight: 280, borderRadius: 4 })
        ], { paddingY: 68, paddingX: 40, layout: "grid", columns: 2, align: "center", gap: 30, background: project.theme.surface }),
        section("content", [
          element("image", "Second visuel", { minHeight: 280, borderRadius: 4 }),
          element("heading", "Une seconde lecture du projet", { fontSize: 36, fontWeight: 700, maxWidth: 460 }),
          element("text", "Alternez le rythme pour éviter une succession de cartes identiques.", { fontSize: 16, color: project.theme.muted, lineHeight: 1.6, maxWidth: 500 }),
          element("button", "Découvrir la suite", { background: accent, color: "#ffffff", borderRadius: 4, paddingY: 12, paddingX: 18 }, { href: "#contact", effect: "none" })
        ], { paddingY: 68, paddingX: 40, layout: "grid", columns: 2, align: "center", gap: 30, background: project.theme.background })
      ];
    } else {
      const feature = sections.find((item) => item.type === "features");
      const cta = sections.find((item) => item.type === "cta");
      if (layout === "bento" && feature) {
        feature.styles.layout = "grid";
        feature.styles.columns = controls.creative ? 2 : 3;
        feature.children.push(element("image", "Aperçu du projet", { minHeight: 190, borderRadius: 4 }));
      }
      if (layout === "editorial" && feature) {
        feature.styles.layout = "grid";
        feature.styles.columns = 2;
        feature.styles.background = "#ffffff";
        const heading = feature.children.find((item) => item.type === "heading");
        if (heading) heading.styles.fontSize = 46;
        feature.children.splice(2, 0, element("image", "Image éditoriale", { minHeight: 260, borderRadius: 0 }));
        if (cta) { cta.styles.layout = "row"; cta.styles.justify = "between"; cta.styles.align = "center"; }
      }
      if (layout === "stacked") sections.forEach((item) => { item.styles.layout = "column"; item.styles.align = "start"; });
    }
  }
  if (part === "footer") {
    const footer = sections[0];
    if (!footer) return sections;
    if (layout === "columns") {
      footer.styles.layout = "grid";
      footer.styles.columns = 3;
      footer.children.splice(1, 0,
        element("nav", "Projet|Services|Contact", { fontSize: 13 }),
        element("text", "bonjour@example.com\n+33 1 23 45 67 89", { fontSize: 13, color: project.theme.muted })
      );
    }
    if (layout === "centered") {
      footer.styles.layout = "column";
      footer.styles.align = "center";
      footer.children.forEach((item) => { item.styles.textAlign = "center"; });
    }
    if (layout === "cta") {
      footer.styles.layout = "column";
      footer.styles.align = "center";
      footer.styles.gap = 16;
      footer.styles.background = project.theme.text;
      footer.children = [
        element("heading", "Parlons de votre projet", { fontSize: 34, fontWeight: 700, color: "#ffffff", textAlign: "center" }),
        element("text", "Une question ou une idée ? Écrivez-nous pour commencer.", { fontSize: 15, color: "#d5d6da", textAlign: "center" }),
        element("button", "Nous contacter", { background: "#ffffff", color: project.theme.text, borderRadius: 4, paddingY: 12, paddingX: 18 }, { href: "mailto:bonjour@example.com", effect: "none" })
      ];
    }
    if (layout === "minimal") footer.children = [footer.children[0], footer.children.at(-1)];
  }
  applyFallbackDensity(sections, controls.density);
  return sections;
}

export function createFallbackPart(description = "", part = "main", brief = "", controls = {}) {
  const project = createFallbackProject(`${brief} ${description}`.trim());
  const sections = project.pages[0].sections.filter((item) => sectionBelongsToPart(item, part));
  return {
    name: project.name,
    theme: project.theme,
    sections: customizeFallbackPart(sections, part, controls, project)
  };
}

function rawSectionChildren(section) {
  for (const key of ["children", "elements", "items", "blocks", "content"]) {
    if (Array.isArray(section?.[key])) return section[key];
  }
  return [];
}

function normalizeSectionType(type, part) {
  const raw = String(type || "").toLowerCase();
  if (part === "header") {
    if (/nav|menu/.test(raw)) return "navbar";
    return "hero";
  }
  if (part === "footer") return "footer";
  if (/feature|service|benefit|card|bento|stat/.test(raw)) return "features";
  if (/cta|contact|action|conversion/.test(raw)) return "cta";
  return "content";
}

function sectionHas(section, type) {
  return section.children.some((item) => item.type === type && (type === "image" || item.content.trim()));
}

function mergeMissingElements(section, fallbackSection, requiredTypes) {
  requiredTypes.forEach((type) => {
    if (sectionHas(section, type)) return;
    const replacement = fallbackSection?.children.find((item) => item.type === type);
    if (replacement) section.children.push(structuredClone(replacement));
  });
}

function normalizeNavigationContent(nav) {
  if (!nav || nav.content.includes("|")) return;
  const matches = nav.content.match(/Accueil|Portfolio|Projets?|Services?|À propos|A propos|Tarifs?|Contact|Blog|Équipe|Equipe/gi) || [];
  const unique = [...new Set(matches.map((item) => item.replace(/^a propos$/i, "À propos")))];
  nav.content = unique.length >= 2 ? unique.join("|") : "Accueil|Projets|À propos|Contact";
}

function repairGeneratedSections(sections, part, fallback, controls = {}) {
  const repaired = sections.map((item) => ({
    id: typeof item?.id === "string" ? item.id : uid("section"),
    type: normalizeSectionType(item?.type, part),
    styles: normalizeStyles(item?.styles && typeof item.styles === "object" ? item.styles : {}),
    children: rawSectionChildren(item).slice(0, 20).map(ensureElement)
  })).filter((item) => item.children.length);
  repaired.forEach((item) => {
    if (item.styles.layout === "flex") item.styles.layout = ["navbar", "footer"].includes(item.type) ? "row" : "column";
  });

  if (part === "header") {
    let navbar = repaired.find((item) => item.type === "navbar");
    let hero = repaired.find((item) => item.type === "hero");
    const fallbackNav = fallback.sections.find((item) => item.type === "navbar");
    const fallbackHero = fallback.sections.find((item) => item.type === "hero");
    if (!navbar && hero) {
      const navigationChildren = hero.children.filter((item) => ["logo", "nav"].includes(item.type));
      if (navigationChildren.length) {
        hero.children = hero.children.filter((item) => !["logo", "nav"].includes(item.type));
        navbar = {
          id: uid("section"),
          type: "navbar",
          styles: { paddingY: 18, paddingX: 40, layout: "row", align: "center", justify: "between", background: "#ffffff" },
          children: navigationChildren
        };
      }
    }
    navbar ||= structuredClone(fallbackNav);
    hero ||= structuredClone(fallbackHero);
    mergeMissingElements(navbar, fallbackNav, ["logo", "nav"]);
    normalizeNavigationContent(navbar.children.find((item) => item.type === "nav"));
    mergeMissingElements(hero, fallbackHero, ["heading", "text", "button"]);
    if (["split", "editorial"].includes(controls.layout)) mergeMissingElements(hero, fallbackHero, ["image"]);
    if (["split", "editorial"].includes(controls.layout) && !sectionHas(hero, "image")) {
      hero.children.push(element("image", "Visuel principal", { minHeight: 300, borderRadius: controls.layout === "editorial" ? 0 : 4 }));
    }
    return [navbar, hero];
  }

  if (part === "main") {
    if (!repaired.length) return structuredClone(fallback.sections);
    repaired.forEach((item, index) => {
      const fallbackSection = fallback.sections[index] || fallback.sections.find((section) => section.type === item.type) || fallback.sections[0];
      mergeMissingElements(item, fallbackSection, ["heading", "text"]);
    });
    const allElements = repaired.flatMap((item) => item.children);
    if (allElements.length < 5) {
      const target = repaired[0];
      const additions = fallback.sections.flatMap((item) => item.children).filter((item) => !["heading", "text"].includes(item.type));
      additions.slice(0, 5 - allElements.length).forEach((item) => target.children.push(structuredClone(item)));
    }
    if (["bento", "editorial", "alternating"].includes(controls.layout) && !repaired.some((item) => sectionHas(item, "image"))) {
      repaired[0].children.push(element("image", "Visuel du projet", { minHeight: 240, borderRadius: controls.layout === "editorial" ? 0 : 4 }));
    }
    return repaired;
  }

  let footer = repaired[0] || structuredClone(fallback.sections[0]);
  const fallbackFooter = fallback.sections[0];
  if (controls.layout === "cta") mergeMissingElements(footer, fallbackFooter, ["heading", "text", "button"]);
  else mergeMissingElements(footer, fallbackFooter, ["logo", "text"]);
  if (controls.layout === "columns") mergeMissingElements(footer, fallbackFooter, ["nav"]);
  return [footer];
}

export function generatedPartIssues(candidate, part, controls = {}) {
  const sections = Array.isArray(candidate?.sections) ? candidate.sections : [];
  const children = sections.flatMap(rawSectionChildren).map(ensureElement);
  const types = new Set(children.map((item) => item.type));
  const issues = [];
  if (!sections.length) issues.push("aucune section");
  if (part === "header") {
    for (const type of ["logo", "nav", "heading", "text", "button"]) if (!types.has(type)) issues.push(`élément ${type} manquant`);
    if (["split", "editorial"].includes(controls.layout) && !types.has("image")) issues.push("image principale manquante");
  }
  if (part === "main") {
    if (children.length < 5) issues.push("moins de 5 éléments visibles");
    for (const type of ["heading", "text"]) if (!types.has(type)) issues.push(`élément ${type} manquant`);
    if (["bento", "alternating", "editorial"].includes(controls.layout) && !types.has("image")) issues.push("image de contenu manquante");
  }
  if (part === "footer") {
    const required = controls.layout === "cta" ? ["heading", "text", "button"] : ["logo", "text"];
    for (const type of required) if (!types.has(type)) issues.push(`élément ${type} manquant`);
    if (controls.layout === "columns" && !types.has("nav")) issues.push("navigation de footer manquante");
  }
  if (children.some((item) => item.type !== "divider" && !item.content.trim())) issues.push("contenu texte vide");
  return [...new Set(issues)];
}

export function normalizeGeneratedPart(candidate, part, brief = "", controls = {}) {
  if (!["header", "main", "footer"].includes(part)) throw new Error("Partie de site inconnue");
  const fallback = createFallbackPart("", part, brief, controls);
  const sourceSections = Array.isArray(candidate?.sections) ? candidate.sections : [];
  const repairedSections = repairGeneratedSections(sourceSections, part, fallback, controls);
  const normalized = normalizeProject({
    name: candidate?.name,
    theme: candidate?.theme,
    pages: [{ name: "Accueil", slug: "index", sections: repairedSections }]
  }, brief);
  const sections = normalized.pages[0].sections.filter((item) => sectionBelongsToPart(item, part));
  return {
    name: typeof candidate?.name === "string" ? candidate.name.slice(0, 80) : fallback.name,
    theme: { ...fallback.theme, ...(candidate?.theme && typeof candidate.theme === "object" ? candidate.theme : {}) },
    sections: sections.length ? sections : fallback.sections
  };
}

export function applyGeneratedPart(project, candidate, part, brief = "", controls = {}) {
  const hasExistingProject = Boolean(project);
  const generated = normalizeGeneratedPart(candidate, part, brief, controls);
  if (!hasExistingProject) {
    return normalizeProject({
      name: generated.name,
      theme: generated.theme,
      pages: [{ id: uid("page"), name: "Accueil", slug: "index", sections: generated.sections }]
    }, brief);
  }
  const base = normalizeProject(project, brief);
  const page = base.pages[0];
  const header = page.sections.filter((item) => sectionBelongsToPart(item, "header"));
  const main = page.sections.filter((item) => sectionBelongsToPart(item, "main"));
  const footer = page.sections.filter((item) => sectionBelongsToPart(item, "footer"));
  if (part === "header") page.sections = [...generated.sections, ...main, ...footer];
  if (part === "main") page.sections = [...header, ...generated.sections, ...footer];
  if (part === "footer") page.sections = [...header, ...main, ...generated.sections];
  if (part === "header") {
    base.name = generated.name || base.name;
    base.theme = { ...base.theme, ...generated.theme };
  }
  return normalizeProject(base, brief);
}

const projectSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    theme: {
      type: "object",
      additionalProperties: true,
      properties: {
        background: { type: "string" }, surface: { type: "string" }, text: { type: "string" },
        muted: { type: "string" }, accent: { type: "string" }, font: { type: "string" }, radius: { type: "number" }
      },
      required: ["background", "surface", "text", "muted", "accent", "font", "radius"]
    },
    pages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" }, name: { type: "string" }, slug: { type: "string" },
          sections: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" }, type: { type: "string" }, styles: { type: "object", additionalProperties: true },
                children: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" }, type: { type: "string" }, content: { type: "string" },
                      href: { type: "string" }, effect: { type: "string" }, styles: { type: "object", additionalProperties: true }
                    },
                    required: ["id", "type", "content", "styles"]
                  }
                }
              },
              required: ["id", "type", "styles", "children"]
            }
          }
        },
        required: ["id", "name", "slug", "sections"]
      }
    }
  },
  required: ["name", "theme", "pages"]
};

const assistantProjectSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    project: projectSchema
  },
  required: ["answer", "project"]
};

const elementSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 }, type: { type: "string" }, content: { type: "string" },
    href: { type: "string" }, effect: { type: "string" }, styles: { type: "object", additionalProperties: true }
  },
  required: ["id", "type", "content", "styles"]
};

const sectionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" }, type: { type: "string" }, styles: { type: "object", additionalProperties: true },
    children: { type: "array", minItems: 1, items: elementSchema }
  },
  required: ["id", "type", "styles", "children"]
};

const generatedPartSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    theme: projectSchema.properties.theme,
    sections: { type: "array", minItems: 1, items: sectionSchema }
  },
  required: ["name", "theme", "sections"]
};

async function lmStudioStatus() {
  for (const path of ["/api/v1/models", "/v1/models"]) {
    try {
      const response = await fetch(`${LM_STUDIO_URL}${path}`, { signal: AbortSignal.timeout(1500) });
      if (!response.ok) continue;
      const payload = await response.json();
      const models = (payload.models || payload.data || []).filter((model) => model.type !== "embedding");
      if (!models.length) continue;
      return { connected: true, models: models.map((model) => ({ id: model.key || model.id, name: model.display_name || model.id || model.key })) };
    } catch {
      // Try the other LM Studio-compatible endpoint.
    }
  }
  return { connected: false, models: [] };
}

function noThinkingOptions(maxTokens) {
  return {
    max_tokens: maxTokens,
    chat_template_kwargs: { enable_thinking: false }
  };
}

function withoutThinking(message) {
  return `${message}\n\n/no_think`;
}

export function assistantContent(payload) {
  const choice = payload?.choices?.[0];
  const content = choice?.message?.content?.trim();
  if (content) return content;
  const reasoning = choice?.message?.reasoning_content?.trim();
  const reason = choice?.finish_reason;
  if (reasoning && reason === "length") {
    throw new Error("Le modèle a utilisé toute la réponse pour réfléchir sans répondre. Le mode réflexion doit être désactivé dans LM Studio.");
  }
  if (reasoning) throw new Error("Le modèle a renvoyé uniquement son raisonnement, sans réponse finale.");
  throw new Error("Le modèle a renvoyé une réponse vide.");
}

export function nativeAssistantContent(payload) {
  const messages = Array.isArray(payload?.output)
    ? payload.output.filter((item) => item?.type === "message" && typeof item.content === "string")
    : [];
  const content = messages.map((item) => item.content.trim()).filter(Boolean).join("\n\n");
  if (content) return content;
  const reasoningTokens = Number(payload?.stats?.reasoning_output_tokens || 0);
  if (reasoningTokens > 0) throw new Error("LM Studio a produit uniquement du raisonnement sans réponse finale.");
  throw new Error("LM Studio a renvoyé une réponse vide.");
}

async function lmStudioError(response) {
  try {
    const payload = await response.json();
    return payload?.error?.message || payload?.message || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

function parseJsonContent(content) {
  const cleaned = String(content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  console.log("[parseJsonContent] Contenu nettoyé:", cleaned.slice(0, 200) + (cleaned.length > 200 ? "..." : ""));
  console.log("[parseJsonContent] start:", start, "end:", end);
  if (start < 0 || end < start) throw new Error("Le modèle n’a pas renvoyé de JSON.");
  const jsonStr = cleaned.slice(start, end + 1);
  console.log("[parseJsonContent] JSON extrait:", jsonStr.slice(0, 200) + (jsonStr.length > 200 ? "..." : ""));
  return JSON.parse(jsonStr);
}

function runCommand(command, args, { timeoutMs = 120000, maxOutputBytes = 2_000_000, cwd = "/tmp", env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    let stdoutSize = 0;
    let stderrSize = 0;
    let settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1500).unref();
      if (!settled) {
        settled = true;
        reject(new Error("Mistral Vibe a dépassé le délai autorisé."));
      }
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdoutSize += chunk.length;
      if (stdoutSize <= maxOutputBytes) stdout.push(chunk);
      else child.kill("SIGTERM");
    });
    child.stderr.on("data", (chunk) => {
      stderrSize += chunk.length;
      if (stderrSize <= 200_000) stderr.push(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(error); }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      const output = Buffer.concat(stdout).toString("utf8").trim();
      const errorOutput = Buffer.concat(stderr).toString("utf8").trim();
      if (stdoutSize > maxOutputBytes) return reject(new Error("La réponse du fournisseur IA est trop volumineuse."));
      if (code !== 0) return reject(new Error(errorOutput || output || `Le fournisseur IA a quitté avec le code ${code}.`));
      if (!output) return reject(new Error("Le fournisseur IA a renvoyé une réponse vide."));
      resolve(output);
    });
  });
}

let vibeStatusCache = { expiresAt: 0, value: { available: false, model: VIBE_MODEL } };
let antigravityStatusCache = { expiresAt: 0, value: { available: false, models: [] } };

async function resolveCommand(configured, knownPaths) {
  if (configured.includes("/")) {
    await access(configured);
    return configured;
  }
  for (const path of knownPaths) {
    try { await access(path); return path; } catch { /* Continue. */ }
  }
  return configured;
}

async function mistralVibeStatus() {
  if (Date.now() < vibeStatusCache.expiresAt) return vibeStatusCache.value;
  try {
    const executable = await resolveCommand(VIBE_COMMAND, ["/opt/homebrew/bin/vibe", "/usr/local/bin/vibe"]);
    const version = await runCommand(executable, ["--version"], { timeoutMs: 10000, maxOutputBytes: 20_000 });
    vibeStatusCache = { expiresAt: Date.now() + 30000, value: { available: true, model: VIBE_MODEL, name: "Mistral Vibe Online", version, command: executable } };
  } catch (error) {
    vibeStatusCache = { expiresAt: Date.now() + 10000, value: { available: false, model: VIBE_MODEL, name: "Mistral Vibe Online", error: error.message } };
  }
  return vibeStatusCache.value;
}

async function antigravityStatus() {
  if (Date.now() < antigravityStatusCache.expiresAt) return antigravityStatusCache.value;
  try {
    const executable = await resolveCommand(ANTIGRAVITY_COMMAND, [
      join(process.env.HOME || "", ".local/bin/agy"),
      "/opt/homebrew/bin/agy",
      "/usr/local/bin/agy"
    ]);
    const [version, modelOutput] = await Promise.all([
      runCommand(executable, ["--version"], { timeoutMs: 10000, maxOutputBytes: 20_000 }),
      runCommand(executable, ["models"], { timeoutMs: 20000, maxOutputBytes: 100_000 })
    ]);
    const models = modelOutput.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).map((name) => ({ id: `${ANTIGRAVITY_PREFIX}${name}`, name }));
    if (!models.length) throw new Error("aucun modèle disponible");
    antigravityStatusCache = { expiresAt: Date.now() + 30000, value: { available: true, name: "Antigravity CLI", version, command: executable, models } };
  } catch (error) {
    antigravityStatusCache = { expiresAt: Date.now() + 10000, value: { available: false, name: "Antigravity CLI", models: [], error: error.message } };
  }
  return antigravityStatusCache.value;
}

async function runMistralVibe(prompt, { maxTokens = 1200, maxPrice = 0.08, timeoutMs = 180000 } = {}) {
  const status = await mistralVibeStatus();
  console.log("[MistralVibe] Statut:", status);
  if (!status.available) throw new Error(`Mistral Vibe indisponible: ${status.error || "CLI absent"}`);
  console.log("[MistralVibe] Exécution commande:", status.command);
  return runCommand(status.command, [
    "-p", prompt,
    "--output", "text",
    "--max-turns", "1",
    "--max-price", String(maxPrice),
    "--max-tokens", String(maxTokens),
    "--trust",
    "--workdir", "/tmp"
  ], { timeoutMs, maxOutputBytes: 3_000_000, env: { ...process.env, VIBE_ACTIVE_MODEL: "mistral-medium-3.5" } });
}

function isVibeModel(model) {
  return model === VIBE_MODEL || String(model || "").startsWith("vibe:");
}

function isAntigravityModel(model) {
  return String(model || "").startsWith(ANTIGRAVITY_PREFIX);
}

async function runAntigravity(prompt, { model, timeoutMs = 300000 } = {}) {
  const status = await antigravityStatus();
  if (!status.available) throw new Error(`Antigravity CLI indisponible: ${status.error || "CLI absent"}`);
  const modelName = String(model || "").replace(ANTIGRAVITY_PREFIX, "") || status.models[0]?.name;
  console.log("[Antigravity] Exécution commande:", status.command, "modèle:", modelName);
  return runCommand(status.command, [
    "--print", prompt,
    "--sandbox",
    "--print-timeout", `${Math.max(30, Math.ceil(timeoutMs / 1000))}s`,
    "--model", modelName
  ], { timeoutMs: timeoutMs + 15000, maxOutputBytes: 3_000_000, cwd: "/tmp" });
}

function agentProvider(model) {
  if (isVibeModel(model)) return { source: "mistral-vibe", run: runMistralVibe };
  if (isAntigravityModel(model)) return { source: "antigravity", run: (prompt, options) => runAntigravity(prompt, { ...options, model }) };
  return null;
}

async function generateWithAgentCli({ brief, instruction }, runPrompt) {
  const prompt = `Tu es un concepteur produit autonome. Interprète librement la demande et crée un wireframe de site multipage en JSON: ${brief || "site web"}.
Instruction complémentaire: ${instruction || "aucune"}.

Tu décides de l'architecture utile: nombre de pages, ordre des sections, hiérarchie, messages et appels à l'action. Ne reproduis pas automatiquement un modèle navbar/hero/cartes/CTA si le besoin appelle une autre structure. Privilégie les choix pertinents pour le public et l'objectif implicites du brief.

Retourne UNIQUEMENT un objet JSON valide, sans markdown ni explication, avec exactement cette structure générale:
{"name":"Nom","theme":{"background":"#hex","surface":"#hex","text":"#hex","muted":"#hex","accent":"#hex","font":"Inter, system-ui, sans-serif","radius":20},"pages":[{"id":"page-id","name":"Accueil","slug":"index","sections":[{"id":"section-id","type":"navbar|hero|features|content|cta|footer","styles":{"layout":"row|column|grid","paddingY":20,"paddingX":40,"gap":16,"background":"#hex","align":"center","justify":"between","columns":3},"children":[{"id":"element-id","type":"logo|nav|badge|heading|text|button|card|image|divider","content":"Texte français","styles":{"fontSize":18,"fontWeight":700,"color":"#hex","background":"#hex","borderRadius":12,"paddingY":12,"paddingX":20,"textAlign":"center"},"href":"#facultatif","effect":"lift|scale|glow|none"}]}]}]}.

Le résultat doit rester un wireframe basse fidélité: palette neutre gris/blanc, contraste lisible, aucun dégradé, aucun effet décoratif, effect "none", rayons de 0 à 6 px, typographie simple et espacements fonctionnels. Le contenu français doit être concret, sans lorem ipsum. Utilise des identifiants uniques, le slug index pour la première page, du flex/grid responsive, et uniquement les pages et sections réellement utiles (maximum 6 pages).`;
  const output = await runPrompt(prompt, { maxTokens: 7500, maxPrice: 0.25, timeoutMs: 300000 });
  return normalizeProject(parseJsonContent(output), brief);
}

const partLabels = { header: "l'en-tête", main: "le contenu principal", footer: "le pied de page" };
const partRules = {
  header: "Crée uniquement des sections navbar et hero. Elles doivent définir la marque, la navigation, la première impression et l'action principale.",
  main: "Crée uniquement des sections features, content et cta. N'ajoute ni navbar, ni hero, ni footer. Organise les informations et appels à l'action réellement utiles.",
  footer: "Crée uniquement une section footer avec les coordonnées, liens secondaires, réseaux ou mentions demandés."
};

const layoutDirections = {
  header: {
    split: "Composition split-screen: texte et appel à l'action d'un côté, grand visuel de l'autre. Utilise grid ou row, pas un hero centré classique.",
    centered: "Composition centrée et théâtrale avec beaucoup d'espace, hiérarchie verticale et message principal dominant.",
    editorial: "Composition éditoriale asymétrique: grande typographie, décalages visuels, grille non conventionnelle et image forte.",
    minimal: "Composition minimale: très peu d'éléments, navigation discrète, message court et aucun bloc superflu."
  },
  main: {
    bento: "Composition bento avec tailles et contenus variés. Évite trois cartes identiques; mélange texte, chiffres, preuve, image et action dans une grille rythmée.",
    alternating: "Composition alternée en plusieurs bandes texte/image. Change l'ordre visuel entre les sections et évite toute grille de trois cartes.",
    editorial: "Composition magazine: grille éditoriale, grande citation ou titre, image dominante, contenus de largeurs différentes et rythme asymétrique.",
    stacked: "Composition narrative verticale: sections pleine largeur, progression claire, respirations et appels à l'action intégrés au récit."
  },
  footer: {
    columns: "Footer riche en trois ou quatre colonnes avec marque, navigation, coordonnées et informations secondaires.",
    centered: "Footer centré comme une signature, avec peu de liens et une hiérarchie verticale.",
    cta: "Footer dominé par un grand appel à l'action, puis seulement les informations légales essentielles.",
    minimal: "Footer minimal sur une ligne: marque, copyright et un ou deux liens maximum."
  }
};

function partGenerationPrompt({ part, description, brief, project, controls = {} }) {
  const context = project ? JSON.stringify({
    name: project.name,
    theme: project.theme,
    existingSections: project.pages?.[0]?.sections?.map((item) => item.type) || []
  }) : "Aucun projet généré pour le moment.";
  const layout = layoutDirections[part]?.[controls.layout] || "Choisis une composition adaptée, mais évite les gabarits génériques.";
  const density = controls.density === "airy" ? "très aérée avec de grands espaces" : controls.density === "compact" ? "compacte avec beaucoup d'information visible" : "équilibrée";
  const freedom = controls.creative
    ? "Tu as l'autorisation explicite d'utiliser une composition audacieuse, asymétrique et inattendue. Ne reproduis pas automatiquement navbar + hero centré + trois cartes + CTA."
    : "Respecte une composition claire et prévisible sans ajouter de fantaisie non demandée.";
  return `Génère uniquement ${partLabels[part]} d'un wireframe de site web en français.

DESCRIPTION DE L'UTILISATEUR POUR CETTE PARTIE:
${description}

VISION COMPLÈTE DU SITE:
${brief}

CONTEXTE DÉJÀ GÉNÉRÉ:
${context}

COMPOSITION IMPOSÉE:
${layout}
Densité: ${density}.
${freedom}

${partRules[part]}
CONTRAT D'ÉLÉMENTS OBLIGATOIRE:
- Chaque section doit avoir un tableau children non vide. Ne renvoie jamais de HTML, de JSX, de CSS brut ou un champ elements à la place de children.
- Chaque enfant est un objet indépendant avec id, type, content et styles. content doit être une chaîne visible et concrète, sauf divider.
- Utilise uniquement ces noms de styles structurés: layout, columns, gridTemplateColumns, paddingY, paddingX, gap, background, align, justify, fontSize, fontWeight, color, lineHeight, maxWidth, minHeight, width, borderRadius, textAlign, gridColumn.
- Pour fontSize, paddingY, paddingX, gap, maxWidth, minHeight et borderRadius, utilise des NOMBRES en pixels sans "px", "rem" ou "vh". Exemple: fontSize: 64, paddingY: 80.
- Pour une navigation, sépare toujours les libellés par le caractère |. Exemple: "Accueil|Portfolio|À propos|Contact".
- Header: navbar avec logo + nav, puis hero avec heading + text + button; ajoute image pour split ou éditorial.
- Main: au moins 5 enfants visibles au total et au moins heading + text; ajoute image pour bento, alterné ou magazine.
- Footer: au moins logo + text, ou heading + text + button pour un grand CTA.

Retourne un objet JSON avec exactement les clés name, theme et sections. Chaque section contient id, type, styles et children. Chaque enfant contient id, type, content et styles, avec href et effect seulement si utiles. Types d'éléments autorisés: logo, nav, badge, heading, text, button, card, image, divider. Varie le nombre, l'ordre, le layout, les colonnes, les alignements, les espacements et les proportions selon la composition demandée. Utilise des identifiants uniques, un contenu concret sans lorem ipsum, un layout responsive flex/grid et une direction wireframe basse fidélité gris/blanc sans dégradé, avec des rayons de 0 à 6 px et effect "none".`;
}

async function generatePartWithAgentCli(body, runPrompt) {
  const prompt = `${partGenerationPrompt(body)}

Retourne UNIQUEMENT l'objet JSON valide, sans markdown ni explication.`;
  const maxTokens = body.part === "main" ? 5500 : body.part === "header" ? 3500 : 2200;
  const output = await runPrompt(prompt, { maxTokens, maxPrice: body.part === "main" ? 0.18 : 0.1, timeoutMs: 240000 });
  let candidate = parseJsonContent(output);
  const issues = generatedPartIssues(candidate, body.part, body.controls);
  if (issues.length) {
    const correctionPrompt = `${prompt}

Ta première réponse JSON ci-dessous est incomplète et ne peut pas être affichée correctement.
PROBLÈMES À CORRIGER: ${issues.join(", ")}.
PREMIÈRE RÉPONSE:
${JSON.stringify(candidate)}

Recrée maintenant l'objet JSON COMPLET de cette région. Conserve les bons contenus, ajoute tous les éléments manquants dans children et respecte exactement les noms de styles structurés demandés. Ne renvoie pas d'explication.`;
    const corrected = await runPrompt(correctionPrompt, { maxTokens, maxPrice: body.part === "main" ? 0.2 : 0.12, timeoutMs: 240000 });
    candidate = parseJsonContent(corrected);
  }
  return normalizeGeneratedPart(candidate, body.part, body.brief, body.controls);
}

async function generatePartWithLmStudio(body) {
  const status = await lmStudioStatus();
  if (!status.connected || !status.models.length) throw new Error("LM Studio indisponible");
  const modelId = body.model || status.models[0].id;
  const prompt = partGenerationPrompt(body);
  const maxTokens = body.part === "main" ? 5500 : body.part === "header" ? 3500 : 2200;
  let candidate;
  if (needsNativeReasoningControl(modelId)) {
    candidate = await nativeJsonCompletion({
      model: modelId,
      systemPrompt: `Tu es un concepteur web spécialisé dans la génération isolée de régions. ${partRules[body.part]} Ne modifie et ne retourne aucune autre partie du site.`,
      input: prompt,
      maxOutputTokens: maxTokens,
      temperature: body.controls?.creative ? 0.75 : 0.4
    });
  } else {
    const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: `Tu génères une seule région de site à la fois. ${partRules[body.part]} Retourne uniquement le JSON demandé.` },
          { role: "user", content: withoutThinking(prompt) }
        ],
        response_format: { type: "json_schema", json_schema: { name: `website_${body.part}`, strict: true, schema: generatedPartSchema } },
        temperature: body.controls?.creative ? 0.75 : 0.4,
        ...noThinkingOptions(maxTokens),
        stream: false
      }),
      signal: AbortSignal.timeout(150000)
    });
    if (!response.ok) throw new Error(`LM Studio: ${await lmStudioError(response)}`);
    candidate = JSON.parse(assistantContent(await response.json()));
  }
  return normalizeGeneratedPart(candidate, body.part, body.brief, body.controls);
}

async function editNodeWithAgentCli({ node, kind = "element", instruction }, runPrompt) {
  if (!node || !instruction) throw new Error("Élément ou instruction manquant");
  const prompt = `Tu modifies UNIQUEMENT le composant JSON fourni selon la demande.
Tu ne connais pas le reste du site. Conserve EXACTEMENT son id et son type. Ne supprime aucun champ utile.
Styles autorisés: ${[...allowedStyleKeys].join(", ")}.
Retourne UNIQUEMENT le JSON complet du composant modifié, sans markdown ni explication.

DEMANDE:
${instruction}

COMPOSANT (${kind}):
${JSON.stringify(node)}`;
  const output = await runPrompt(prompt, { maxTokens: kind === "section" ? 3500 : 1400, maxPrice: kind === "section" ? 0.12 : 0.06, timeoutMs: 180000 });
  return lockEditedNode(parseJsonContent(output), node, kind);
}

async function chatWithAgentCli({ message, history = [], project, currentPageId }, runPrompt) {
  const transcript = history.slice(-8)
    .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .map((item) => `${item.role === "user" ? "Utilisateur" : "Assistant"}: ${item.content.slice(0, 1600)}`)
    .join("\n");
  const normalized = normalizeProject(project);
  const prompt = `Tu es l'assistant d'édition d'un constructeur de sites. Réponds en français et applique directement au projet les modifications demandées par l'utilisateur.

Retourne UNIQUEMENT un objet JSON valide sous la forme {"answer":"réponse courte","project":{...projet complet...}}.
Le champ project doit TOUJOURS contenir la copie complète du projet fourni: name, theme, toutes les pages, toutes les sections et tous les enfants. Ne renvoie jamais un patch ou seulement les champs modifiés.
Si le message est une question, un conseil ou une salutation sans demande de modification, conserve le projet strictement identique. Si c'est une demande d'édition, modifie uniquement ce qui est nécessaire. Conserve les id des pages, sections et éléments existants; crée des id uniques seulement pour les nouveaux objets. Ne supprime rien sans demande explicite. Le projet doit rester responsive et respecter sa direction wireframe actuelle. N'utilise aucun outil et ne lis aucun fichier.

${transcript ? `CONVERSATION RÉCENTE:\n${transcript}\n\n` : ""}MESSAGE:
${message}

PAGE ACTUELLE: ${currentPageId || normalized.pages[0]?.id}

PROJET COMPLET:
${JSON.stringify(normalized)}`;
  const candidate = parseJsonContent(await runPrompt(prompt, { maxTokens: 9000, maxPrice: 0.28, timeoutMs: 300000 }));
  return normalizeAssistantProject(candidate, normalized, message);
}

function needsNativeReasoningControl(modelId) {
  return /qwen[\/-]?3\.5|reasoning/i.test(modelId || "");
}

async function nativeJsonCompletion({ model, systemPrompt, input, maxOutputTokens, temperature = 0.1 }) {
  const response = await fetch(`${LM_STUDIO_URL}/api/v1/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      input,
      system_prompt: `${systemPrompt} Réponds uniquement avec un objet JSON valide, sans markdown ni explication.`,
      reasoning: "off",
      temperature,
      max_output_tokens: maxOutputTokens,
      store: false,
      stream: false
    }),
    signal: AbortSignal.timeout(maxOutputTokens > 4000 ? 240000 : 120000)
  });
  if (!response.ok) throw new Error(`LM Studio: ${await lmStudioError(response)}`);
  return parseJsonContent(nativeAssistantContent(await response.json()));
}

async function generateWithLmStudio({ brief, project, selectedId, instruction, model }) {
  const status = await lmStudioStatus();
  if (!status.connected || !status.models.length) throw new Error("LM Studio indisponible");
  const modelId = model || status.models[0].id;
  const current = project ? `\nPROJET ACTUEL:\n${JSON.stringify(project)}` : "";
  const selection = selectedId ? `\nÉLÉMENT SÉLECTIONNÉ: ${selectedId}.` : "";
  const userPrompt = `Crée le projet structuré d'un site web multipage. Brief: ${brief || "site moderne"}. Instruction: ${instruction || "génère le site complet"}.${selection}${current}`;
  if (needsNativeReasoningControl(modelId)) {
    const candidate = await nativeJsonCompletion({
      model: modelId,
      systemPrompt: "Tu es un concepteur produit autonome. Interprète librement le brief et choisis l'architecture, les pages, la hiérarchie et les contenus les plus pertinents. Crée un wireframe basse fidélité avec les clés name, theme et pages. Chaque page contient id, name, slug et sections. Chaque section contient id, type, styles et children. Chaque enfant contient id, type, content et styles, avec href et effect seulement si utiles. Types autorisés: logo, nav, badge, heading, text, button, card, image, divider. Style neutre gris/blanc, sans dégradé ni effet décoratif, effect none, rayons de 0 à 6 px, typographie simple. Utilise du français précis, du flex/grid responsive et aucun lorem ipsum.",
      input: userPrompt,
      maxOutputTokens: 7000,
      temperature: 0.45
    });
    return normalizeProject(candidate, brief);
  }
  const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: "Tu es un concepteur produit autonome. Interprète librement le brief et choisis les pages, sections, contenus et parcours les plus pertinents sans suivre un gabarit fixe. Retourne uniquement un projet JSON multipage valide sous forme de wireframe basse fidélité: palette gris/blanc, aucun dégradé ou effet décoratif, effect none, rayons de 0 à 6 px et typographie simple. Utilise des sections responsive en flex/grid. Types autorisés: logo, nav, badge, heading, text, button, card, image, divider. Le contenu doit être en français, précis et sans lorem ipsum." },
        { role: "user", content: withoutThinking(userPrompt) }
      ],
      response_format: { type: "json_schema", json_schema: { name: "website_project", strict: true, schema: projectSchema } },
      temperature: 0.65,
      ...noThinkingOptions(7000),
      stream: false
    }),
    signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) throw new Error(`LM Studio: ${response.status}`);
  const payload = await response.json();
  return normalizeProject(JSON.parse(assistantContent(payload)), brief);
}

const allowedStyleKeys = new Set([
  "background", "color", "fontWeight", "letterSpacing", "lineHeight", "opacity", "fontSize",
  "borderRadius", "maxWidth", "width", "paddingY", "paddingX", "textAlign", "gap", "layout",
  "columns", "align", "justify", "minHeight", "gridColumn", "gridTemplateColumns"
]);

function sanitizeStyles(styles, original = {}) {
  const result = { ...original };
  if (!styles || typeof styles !== "object") return result;
  for (const [key, value] of Object.entries(styles)) {
    if (!allowedStyleKeys.has(key)) continue;
    if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) result[key] = value;
  }
  return result;
}

function lockEditedNode(candidate, original, kind) {
  if (kind === "section") {
    const children = Array.isArray(candidate?.children)
      ? candidate.children.slice(0, 20).map((child, index) => {
          const originalChild = original.children[index];
          return originalChild ? lockEditedNode(child, originalChild, "element") : ensureElement(child);
        })
      : structuredClone(original.children);
    return {
      id: original.id,
      type: original.type,
      styles: sanitizeStyles(candidate?.styles, original.styles),
      children
    };
  }
  const sanitized = ensureElement({ ...original, ...candidate, id: original.id, type: original.type });
  sanitized.id = original.id;
  sanitized.type = original.type;
  sanitized.styles = sanitizeStyles(candidate?.styles, original.styles);
  return sanitized;
}

function fallbackEditNode(node, kind, instruction = "") {
  const copy = structuredClone(node);
  const lower = instruction.toLowerCase();
  copy.styles ||= {};
  if (/sombre|noir/.test(lower)) copy.styles.background = "#17181c";
  if (/clair|blanc/.test(lower)) copy.styles.background = "#ffffff";
  if (/rouge/.test(lower)) copy.styles.background = "#e5484d";
  if (/bleu/.test(lower)) copy.styles.background = "#4f68f5";
  if (/vert/.test(lower)) copy.styles.background = "#24a36a";
  if (/arrondi|radius|rond/.test(lower)) copy.styles.borderRadius = /très|beaucoup|pilule/.test(lower) ? 999 : 24;
  if (/grand|gros/.test(lower)) copy.styles.fontSize = Math.max(Number(copy.styles.fontSize || 18) + 10, 28);
  if (/espace|aér/.test(lower)) copy.styles.paddingY = 80;
  if (kind === "element") {
    if (/ombre|survol|hover/.test(lower)) copy.effect = "lift";
    const quoted = instruction.match(/[«\"]([^»\"]+)[»\"]/);
    if (quoted) copy.content = quoted[1];
  }
  return lockEditedNode(copy, node, kind);
}

async function editNodeWithLmStudio({ node, kind = "element", instruction, model }) {
  if (!node || !instruction) throw new Error("Élément ou instruction manquant");
  const status = await lmStudioStatus();
  if (!status.connected || !status.models.length) throw new Error("LM Studio indisponible");
  const modelId = model || status.models[0].id;
  const schema = kind === "section" ? sectionSchema : elementSchema;
  if (needsNativeReasoningControl(modelId)) {
    const candidate = await nativeJsonCompletion({
      model: modelId,
      systemPrompt: `Tu modifies uniquement le composant JSON fourni. Tu ne connais pas le reste du site. Conserve exactement id et type. Styles autorisés: ${[...allowedStyleKeys].join(", ")}.`,
      input: `DEMANDE:\n${instruction}\n\nCOMPOSANT À MODIFIER:\n${JSON.stringify(node)}`,
      maxOutputTokens: kind === "section" ? 3000 : 1200
    });
    return lockEditedNode(candidate, node, kind);
  }
  const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: `Tu modifies uniquement le composant JSON fourni. Tu ne connais pas le reste du site et tu ne dois rien inventer hors de ce composant. Conserve exactement son id et son type. Retourne uniquement le JSON complet du composant modifié. Styles autorisés: ${[...allowedStyleKeys].join(", ")}.` },
        { role: "user", content: withoutThinking(`DEMANDE:\n${instruction}\n\nCOMPOSANT À MODIFIER:\n${JSON.stringify(node)}`) }
      ],
      response_format: { type: "json_schema", json_schema: { name: kind === "section" ? "edited_section" : "edited_element", strict: true, schema } },
      temperature: 0.2,
      ...noThinkingOptions(kind === "section" ? 3000 : 1600),
      stream: false
    }),
    signal: AbortSignal.timeout(90000)
  });
  if (!response.ok) throw new Error(`LM Studio: ${response.status}`);
  const payload = await response.json();
  const candidate = JSON.parse(assistantContent(payload));
  return lockEditedNode(candidate, node, kind);
}

function projectSummary(project, currentPageId) {
  const normalized = normalizeProject(project);
  const currentPage = normalized.pages.find((item) => item.id === currentPageId) || normalized.pages[0];
  return {
    name: normalized.name,
    theme: normalized.theme,
    pages: normalized.pages.map((item) => ({ name: item.name, slug: item.slug, sections: item.sections.length })),
    currentPage: {
      name: currentPage.name,
      outline: currentPage.sections.map((item) => ({ type: item.type, elements: item.children.map((child) => ({ type: child.type, content: child.content.slice(0, 100) })) }))
    }
  };
}

function projectNodeTypes(project) {
  const types = new Map();
  for (const page of project.pages || []) {
    types.set(page.id, "page");
    for (const section of page.sections || []) {
      types.set(section.id, `section:${section.type}`);
      for (const child of section.children || []) types.set(child.id, `element:${child.type}`);
    }
  }
  return types;
}

function normalizedInstruction(message) {
  return String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function assistantEditPermissions(message) {
  const instruction = normalizedInstruction(message);
  const explicitAddition = /\b(ajout|ajoute|ajouter|cree|creer|nouveau|nouvelle|insere|inserer|genere|generer|construis|construire|fabrique|fabriquer|realise|realiser)\b/.test(instruction);
  const makeSomething = /\b(fait|fais|faire)\b[\s\S]{0,80}\b(page|section|bloc|bouton|element|menu|footer|header|contenu)\b/.test(instruction);
  return {
    allowsAddition: explicitAddition || makeSomething,
    allowsRemoval: /\b(supprime|supprimer|retire|retirer|enleve|enlever|efface|effacer)\b/.test(instruction)
  };
}

export function normalizeAssistantProject(candidate, original, message = "") {
  const base = normalizeProject(original);
  const projectCandidate = candidate?.project || candidate;
  if (!projectCandidate || !Array.isArray(projectCandidate.pages) || !projectCandidate.pages.length) {
    throw new Error("L'assistant IA n'a pas renvoyé de projet valide");
  }
  const nextProject = normalizeProject(projectCandidate, base.name);
  const beforeTypes = projectNodeTypes(base);
  const afterTypes = projectNodeTypes(nextProject);
  const { allowsAddition, allowsRemoval } = assistantEditPermissions(message);
  const preserved = [...beforeTypes.keys()].filter((id) => afterTypes.has(id));
  if ((!allowsRemoval && preserved.length !== beforeTypes.size) || (allowsRemoval && preserved.length < Math.ceil(beforeTypes.size * 0.6))) {
    throw new Error("L'assistant IA a tenté de remplacer une trop grande partie du site");
  }
  if (!allowsAddition && [...afterTypes.keys()].some((id) => !beforeTypes.has(id))) {
    throw new Error("L'assistant IA a ajouté des composants non demandés");
  }
  for (const id of preserved) {
    if (beforeTypes.get(id) !== afterTypes.get(id)) throw new Error("L'assistant IA a modifié le type d'un composant existant");
  }
  return {
    answer: typeof candidate?.answer === "string" && candidate.answer.trim()
      ? candidate.answer.trim().slice(0, 1200)
      : "J'ai mis à jour le site selon votre demande.",
    project: nextProject,
    changed: JSON.stringify(nextProject) !== JSON.stringify(base)
  };
}

async function chatWithLmStudio({ message, history = [], project, currentPageId, model }) {
  const status = await lmStudioStatus();
  if (!status.connected || !status.models.length) throw new Error("LM Studio indisponible");
  const modelId = model || status.models[0].id;
  const normalized = normalizeProject(project);
  const systemPrompt = "Tu es l'assistant d'édition d'un constructeur de sites. Retourne un objet JSON avec answer et project. Le champ project doit toujours être la copie COMPLETE du projet fourni avec name, theme, toutes les pages, toutes les sections et tous les enfants. Ne renvoie jamais un patch, un extrait ou seulement les champs modifiés. Applique directement les demandes de modification. Pour une question, un conseil ou une salutation sans demande d'édition, conserve le projet strictement identique. Modifie uniquement ce qui est nécessaire, conserve tous les id existants et crée des id uniques uniquement pour les nouveaux objets. Ne supprime rien sans demande explicite. Le projet doit rester responsive et respecter sa direction wireframe actuelle.";
  const input = `${message}\n\nPAGE ACTUELLE: ${currentPageId || normalized.pages[0]?.id}\n\nPROJET COMPLET:\n${JSON.stringify(normalized)}`;
  if (!needsNativeReasoningControl(modelId)) {
    const messages = [
      { role: "system", content: `${systemPrompt} Réponds uniquement avec le JSON demandé, sans markdown.` },
      ...history.slice(-8).filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string").map((item) => ({ role: item.role, content: item.content.slice(0, 1800) })),
      { role: "user", content: input }
    ];
    const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages,
        response_format: { type: "json_schema", json_schema: { name: "assistant_project_edit", strict: true, schema: assistantProjectSchema } },
        temperature: 0.25,
        ...noThinkingOptions(9000),
        stream: false
      }),
      signal: AbortSignal.timeout(180000)
    });
    if (!response.ok) throw new Error(`LM Studio: ${await lmStudioError(response)}`);
    return normalizeAssistantProject(JSON.parse(assistantContent(await response.json())), normalized, message);
  }
  const candidate = await nativeJsonCompletion({
    model: modelId,
    systemPrompt,
    input,
    maxOutputTokens: 9000,
    temperature: 0.25
  });
  return normalizeAssistantProject(candidate, normalized, message);
}

function fallbackChat(message, project, currentPageId) {
  const summary = projectSummary(project, currentPageId);
  const lower = message.toLowerCase();
  if (/page|navigation|menu/.test(lower)) return `Votre projet contient ${summary.pages.length} page(s). Commencez par définir un objectif unique pour chaque page, puis gardez la navigation à 5 ou 6 entrées maximum.`;
  if (/couleur|design|style|identité/.test(lower)) return `Votre couleur principale actuelle est ${summary.theme.accent}. Utilisez-la pour les actions importantes et gardez une couleur neutre pour le texte afin de préserver le contraste.`;
  if (/contenu|texte|titre/.test(lower)) return "Structurez chaque page autour d’un message principal, d’une preuve concrète et d’un appel à l’action. Les titres doivent expliquer le bénéfice plutôt que seulement nommer la section.";
  return "Je peux vous aider à clarifier les pages nécessaires, les contenus, le parcours utilisateur, les couleurs et les fonctionnalités. Pour une réponse plus personnalisée, démarrez LM Studio sur le port 1234.";
}

function fallbackAssistantEdit(message, project, currentPageId, error) {
  const reason = error?.message || "Erreur inconnue";
  const providerUnavailable = /indisponible|cli absent|econn|fetch failed|délai|delai|timeout|quitté avec le code/i.test(reason);
  const failure = providerUnavailable
    ? "Aucune modification n'a été appliquée car le fournisseur IA est indisponible."
    : `La réponse de l'IA n'a pas été appliquée : ${reason}.`;
  return {
    answer: `${fallbackChat(message, project, currentPageId)} ${failure}`,
    project: normalizeProject(project),
    changed: false
  };
}

async function readBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 2_000_000) throw new Error("Corps de requête trop volumineux");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function json(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function serveStatic(request, response) {
  const url = new URL(request.url, "http://localhost");
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) return json(response, 403, { error: "Accès refusé" });
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Page introuvable");
  }
}

export const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/api/health") {
      const [lmStudio, mistralVibe, antigravity] = await Promise.all([lmStudioStatus(), mistralVibeStatus(), antigravityStatus()]);
      return json(response, 200, { ok: true, lmStudio, mistralVibe, antigravity });
    }
    if (request.method === "POST" && request.url === "/api/generate") {
      const body = await readBody(request);
      try {
        const provider = agentProvider(body.model);
        const project = provider ? await generateWithAgentCli(body, provider.run) : await generateWithLmStudio(body);
        return json(response, 200, { project, source: provider?.source || "lm-studio" });
      } catch (error) {
        // Attendre 2 secondes pour simuler un traitement et permettre à l'utilisateur de voir le loading
        await new Promise(resolve => setTimeout(resolve, 2000));
        const project = createFallbackProject(body.brief);
        return json(response, 200, { project, source: "local-fallback", warning: error.message });
      }
    }
    if (request.method === "POST" && request.url === "/api/generate-part") {
      const body = await readBody(request);
      if (!["header", "main", "footer"].includes(body.part)) return json(response, 400, { error: "Partie de site inconnue" });
      if (typeof body.description !== "string" || !body.description.trim()) return json(response, 400, { error: "Description manquante" });
      try {
        const provider = agentProvider(body.model);
        const generated = provider ? await generatePartWithAgentCli(body, provider.run) : await generatePartWithLmStudio(body);
        const project = applyGeneratedPart(body.project, generated, body.part, body.brief, body.controls);
        return json(response, 200, { project, part: body.part, source: provider?.source || "lm-studio" });
      } catch (error) {
        const generated = createFallbackPart(body.description, body.part, body.brief, body.controls);
        const project = applyGeneratedPart(body.project, generated, body.part, body.brief, body.controls);
        return json(response, 200, { project, part: body.part, source: "local-fallback", warning: error.message });
      }
    }
    if (request.method === "POST" && request.url === "/api/edit-element") {
      const body = await readBody(request);
      const kind = body.kind === "section" ? "section" : "element";
      try {
        const provider = agentProvider(body.model);
        const node = provider ? await editNodeWithAgentCli({ ...body, kind }, provider.run) : await editNodeWithLmStudio({ ...body, kind });
        return json(response, 200, { node, source: provider?.source || "lm-studio" });
      } catch (error) {
        const node = fallbackEditNode(body.node, kind, body.instruction);
        return json(response, 200, { node, source: "local-fallback", warning: error.message });
      }
    }
    if (request.method === "POST" && request.url === "/api/chat") {
      const body = await readBody(request);
      try {
        const provider = agentProvider(body.model);
        const result = provider ? await chatWithAgentCli(body, provider.run) : await chatWithLmStudio(body);
        return json(response, 200, { ...result, source: provider?.source || "lm-studio" });
      } catch (error) {
        console.error("[Assistant] Modification refusée:", error.message);
        return json(response, 200, { ...fallbackAssistantEdit(body.message || "", body.project, body.currentPageId, error), source: "local-fallback", warning: error.message });
      }
    }
    return serveStatic(request, response);
  } catch (error) {
    return json(response, 500, { error: error.message || "Erreur serveur" });
  }
});

function startServer(port, remainingAttempts = 10) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && remainingAttempts > 0) {
      console.warn(`Le port ${port} est occupé, essai du port ${port + 1}...`);
      startServer(port + 1, remainingAttempts - 1);
      return;
    }
    throw error;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Atelier AI disponible sur http://127.0.0.1:${port}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer(PORT);
}
