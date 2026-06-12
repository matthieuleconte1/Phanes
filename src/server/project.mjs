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
  ["fontSize", "borderRadius", "maxWidth", "minHeight", "gap", "paddingY", "paddingX", "letterSpacing", "x", "y", "freeHeight", "zIndex"].forEach((key) => {
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

export function ensureElement(value) {
  const allowed = new Set(["logo", "nav", "badge", "heading", "text", "button", "card", "image", "divider", "custom"]);
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
  const normalized = {
    id: typeof value?.id === "string" ? value.id : uid("element"),
    type,
    content: content || (type === "image" ? "Visuel" : type === "divider" ? "" : type === "custom" ? "Bloc personnalisé" : "Nouvel élément"),
    styles,
    ...(typeof value?.href === "string" ? { href: value.href } : type === "button" ? { href: "#" } : {}),
    ...(typeof value?.effect === "string" ? { effect: value.effect } : {})
  };
  if (type === "image") {
    if (typeof value?.src === "string" && value.src.length <= 4_000_000) normalized.src = value.src;
    normalized.alt = typeof value?.alt === "string" ? value.alt.slice(0, 300) : content || "Image";
  }
  if (type === "custom") {
    normalized.html = typeof value?.html === "string" ? value.html.slice(0, 60000) : '<article class="custom-card"><p class="eyebrow">COMPOSANT LIBRE</p><h3>Bloc HTML/CSS</h3><p>Demandez à l’IA de créer ici une composition sur mesure.</p></article>';
    normalized.css = typeof value?.css === "string" ? value.css.slice(0, 60000) : ".custom-card{padding:clamp(24px,5vw,56px);border-radius:24px;color:#fff;background:linear-gradient(135deg,#17181c,#5b4ff0)}.eyebrow{font-size:.75rem;letter-spacing:.14em;opacity:.72}.custom-card h3{margin:.35rem 0;font-size:clamp(2rem,5vw,4rem)}";
    normalized.js = typeof value?.js === "string" ? value.js.slice(0, 60000) : "";
  }
  return normalized;
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

export function projectForAi(project) {
  const copy = structuredClone(normalizeProject(project));
  for (const page of copy.pages) for (const section of page.sections) for (const child of section.children) {
    if (child.type === "image" && String(child.src || "").startsWith("data:image/")) child.src = `local-image:${child.id}`;
  }
  return copy;
}

export function restoreLocalImageAssets(candidate, original) {
  const result = structuredClone(candidate);
  const project = result?.project || result;
  if (!project?.pages) return result;
  const assets = new Map();
  for (const page of normalizeProject(original).pages) for (const section of page.sections) for (const child of section.children) {
    if (child.type === "image" && String(child.src || "").startsWith("data:image/")) assets.set(child.id, child.src);
  }
  for (const page of project.pages) for (const section of page.sections || []) for (const child of section.children || []) {
    const source = assets.get(child.id);
    if (source && (!child.src || child.src === `local-image:${child.id}`)) child.src = source;
  }
  return result;
}

export function restoreEditedNodeAsset(candidate, original) {
  const result = structuredClone(candidate);
  if (original?.type === "image" && String(original.src || "").startsWith("data:image/") && (!result?.src || result.src === `local-image:${original.id}`)) {
    result.src = original.src;
  }
  if (Array.isArray(result?.children) && Array.isArray(original?.children)) {
    result.children = result.children.map((child) => restoreEditedNodeAsset(child, original.children.find((item) => item.id === child.id)));
  }
  return result;
}

export function nodeForAi(node) {
  const copy = structuredClone(node);
  if (copy?.type === "image" && String(copy.src || "").startsWith("data:image/")) copy.src = `local-image:${copy.id}`;
  if (Array.isArray(copy?.children)) copy.children = copy.children.map(nodeForAi);
  return copy;
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
    const customHero = sectionHas(hero, "custom");
    if (!customHero) mergeMissingElements(hero, fallbackHero, ["heading", "text", "button"]);
    if (!customHero && ["split", "editorial"].includes(controls.layout)) mergeMissingElements(hero, fallbackHero, ["image"]);
    if (!customHero && ["split", "editorial"].includes(controls.layout) && !sectionHas(hero, "image")) {
      hero.children.push(element("image", "Visuel principal", { minHeight: 300, borderRadius: controls.layout === "editorial" ? 0 : 4 }));
    }
    return [navbar, hero];
  }

  if (part === "main") {
    if (!repaired.length) return structuredClone(fallback.sections);
    repaired.forEach((item, index) => {
      if (sectionHas(item, "custom")) return;
      const fallbackSection = fallback.sections[index] || fallback.sections.find((section) => section.type === item.type) || fallback.sections[0];
      mergeMissingElements(item, fallbackSection, ["heading", "text"]);
    });
    const allElements = repaired.flatMap((item) => item.children);
    if (!allElements.some((item) => item.type === "custom") && allElements.length < 5) {
      const target = repaired[0];
      const additions = fallback.sections.flatMap((item) => item.children).filter((item) => !["heading", "text"].includes(item.type));
      additions.slice(0, 5 - allElements.length).forEach((item) => target.children.push(structuredClone(item)));
    }
    if (!allElements.some((item) => item.type === "custom") && ["bento", "editorial", "alternating"].includes(controls.layout) && !repaired.some((item) => sectionHas(item, "image"))) {
      repaired[0].children.push(element("image", "Visuel du projet", { minHeight: 240, borderRadius: controls.layout === "editorial" ? 0 : 4 }));
    }
    return repaired;
  }

  let footer = repaired[0] || structuredClone(fallback.sections[0]);
  const fallbackFooter = fallback.sections[0];
  if (!sectionHas(footer, "custom")) {
    if (controls.layout === "cta") mergeMissingElements(footer, fallbackFooter, ["heading", "text", "button"]);
    else mergeMissingElements(footer, fallbackFooter, ["logo", "text"]);
    if (controls.layout === "columns") mergeMissingElements(footer, fallbackFooter, ["nav"]);
  }
  return [footer];
}

export function generatedPartIssues(candidate, part, controls = {}) {
  const sections = Array.isArray(candidate?.sections) ? candidate.sections : [];
  const children = sections.flatMap(rawSectionChildren).map(ensureElement);
  const types = new Set(children.map((item) => item.type));
  const issues = [];
  if (!sections.length) issues.push("aucune section");
  if (part === "header") {
    for (const type of ["logo", "nav"]) if (!types.has(type)) issues.push(`élément ${type} manquant`);
    if (!types.has("custom")) {
      for (const type of ["heading", "text", "button"]) if (!types.has(type)) issues.push(`élément ${type} manquant`);
      if (["split", "editorial"].includes(controls.layout) && !types.has("image")) issues.push("image principale manquante");
    }
  }
  if (part === "main") {
    if (!types.has("custom")) issues.push("aucun bloc HTML/CSS avancé");
    if (!types.has("custom") && children.length < 5) issues.push("moins de 5 éléments visibles");
  }
  if (part === "footer") {
    if (!types.has("custom")) {
      const required = controls.layout === "cta" ? ["heading", "text", "button"] : ["logo", "text"];
      for (const type of required) if (!types.has(type)) issues.push(`élément ${type} manquant`);
      if (controls.layout === "columns" && !types.has("nav")) issues.push("navigation de footer manquante");
    }
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

export const projectSchema = {
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
                      href: { type: "string" }, effect: { type: "string" }, src: { type: "string" }, alt: { type: "string" }, html: { type: "string" }, css: { type: "string" }, js: { type: "string" }, styles: { type: "object", additionalProperties: true }
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

export const assistantProjectSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    project: projectSchema
  },
  required: ["answer", "project"]
};

export const elementSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 }, type: { type: "string" }, content: { type: "string" },
    href: { type: "string" }, effect: { type: "string" }, src: { type: "string" }, alt: { type: "string" }, html: { type: "string" }, css: { type: "string" }, js: { type: "string" }, styles: { type: "object", additionalProperties: true }
  },
  required: ["id", "type", "content", "styles"]
};

export const sectionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" }, type: { type: "string" }, styles: { type: "object", additionalProperties: true },
    children: { type: "array", minItems: 1, items: elementSchema }
  },
  required: ["id", "type", "styles", "children"]
};

export const generatedPartSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    theme: projectSchema.properties.theme,
    sections: { type: "array", minItems: 1, items: sectionSchema }
  },
  required: ["name", "theme", "sections"]
};
