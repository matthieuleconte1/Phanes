const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  project: null,
  currentPageId: null,
  selectedId: null,
  viewport: "desktop",
  zoom: 0.78,
  history: [],
  future: [],
  dragging: null,
  brief: "",
  chatHistory: [],
  selectedModel: "",
  leftTab: "layers",
  chatOpen: false,
  canvasScrollLeft: 0,
  canvasScrollTop: 0,
  onboardingStep: 0,
  onboardingDraft: null,
  onboardingCompleted: []
};

const typeNames = {
  navbar: "Navigation", hero: "En-tête", features: "Fonctionnalités", cta: "Appel à l’action", footer: "Pied de page", content: "Section",
  logo: "Logo", nav: "Liens", badge: "Badge", heading: "Titre", text: "Texte", button: "Bouton", card: "Carte", image: "Image", divider: "Séparateur"
};

const SYSTEM_FONT = "Inter, system-ui, sans-serif";
const GOOGLE_FONTS = [
  { label: "Inter", family: "Inter", stack: SYSTEM_FONT, weights: [400, 500, 600, 700, 800], group: "Sans serif" },
  { label: "Roboto", family: "Roboto", stack: "Roboto, Arial, sans-serif", weights: [400, 500, 700, 900], group: "Sans serif" },
  { label: "Open Sans", family: "Open Sans", stack: "'Open Sans', Arial, sans-serif", weights: [400, 500, 600, 700, 800], group: "Sans serif" },
  { label: "Lato", family: "Lato", stack: "Lato, Arial, sans-serif", weights: [400, 700, 900], group: "Sans serif" },
  { label: "Montserrat", family: "Montserrat", stack: "Montserrat, Arial, sans-serif", weights: [400, 500, 600, 700, 800], group: "Sans serif" },
  { label: "Poppins", family: "Poppins", stack: "Poppins, Arial, sans-serif", weights: [400, 500, 600, 700, 800], group: "Sans serif" },
  { label: "Nunito", family: "Nunito", stack: "Nunito, Arial, sans-serif", weights: [400, 500, 600, 700, 800], group: "Sans serif" },
  { label: "Raleway", family: "Raleway", stack: "Raleway, Arial, sans-serif", weights: [400, 500, 600, 700, 800], group: "Sans serif" },
  { label: "DM Sans", family: "DM Sans", stack: "'DM Sans', Arial, sans-serif", weights: [400, 500, 600, 700], group: "Sans serif" },
  { label: "Manrope", family: "Manrope", stack: "Manrope, Arial, sans-serif", weights: [400, 500, 600, 700, 800], group: "Sans serif" },
  { label: "Space Grotesk", family: "Space Grotesk", stack: "'Space Grotesk', Arial, sans-serif", weights: [400, 500, 600, 700], group: "Sans serif" },
  { label: "Work Sans", family: "Work Sans", stack: "'Work Sans', Arial, sans-serif", weights: [400, 500, 600, 700, 800], group: "Sans serif" },
  { label: "Outfit", family: "Outfit", stack: "Outfit, Arial, sans-serif", weights: [400, 500, 600, 700, 800], group: "Sans serif" },
  { label: "Plus Jakarta Sans", family: "Plus Jakarta Sans", stack: "'Plus Jakarta Sans', Arial, sans-serif", weights: [400, 500, 600, 700, 800], group: "Sans serif" },
  { label: "Playfair Display", family: "Playfair Display", stack: "'Playfair Display', Georgia, serif", weights: [400, 500, 600, 700, 800], group: "Serif" },
  { label: "Merriweather", family: "Merriweather", stack: "Merriweather, Georgia, serif", weights: [400, 700, 900], group: "Serif" },
  { label: "Libre Baskerville", family: "Libre Baskerville", stack: "'Libre Baskerville', Georgia, serif", weights: [400, 700], group: "Serif" },
  { label: "Bebas Neue", family: "Bebas Neue", stack: "'Bebas Neue', Impact, sans-serif", weights: [400], group: "Display" },
  { label: "Oswald", family: "Oswald", stack: "Oswald, Impact, sans-serif", weights: [400, 500, 600, 700], group: "Display" },
  { label: "Pacifico", family: "Pacifico", stack: "Pacifico, cursive", weights: [400], group: "Display" }
];
const SYSTEM_FONT_OPTION = { label: "Police système", family: null, stack: "system-ui, -apple-system, sans-serif", weights: [], group: "Système" };
const FONT_OPTIONS = [SYSTEM_FONT_OPTION, ...GOOGLE_FONTS];
const FONT_BY_STACK = new Map(FONT_OPTIONS.map((font) => [font.stack, font]));
const THEME_PRESETS = {
  neutral: { label: "Neutral", background: "#f4f4f2", surface: "#ffffff", soft: "#e9e9e6", text: "#17181c", muted: "#6f7178", accent: "#2f3137", buttonText: "#ffffff", radius: 4 },
  charcoal: { label: "Charcoal", background: "#181a1f", surface: "#282b32", soft: "#323640", text: "#f4f5f7", muted: "#adb2bd", accent: "#8aa4ff", buttonText: "#11141a", radius: 8 },
  celestial: { label: "Celestial Blue", background: "#edf7ff", surface: "#ffffff", soft: "#dcefff", text: "#10243e", muted: "#60758f", accent: "#4997d0", buttonText: "#ffffff", radius: 10 }
};
const UI_THEMES = [
  { id: "light", label: "Clair", icon: "☀" },
  { id: "charcoal", label: "Charcoal", icon: "◐" },
  { id: "celestial", label: "Celestial Blue", icon: "◆" }
];

const canvas = $("#canvas");
const canvasFrame = $("#canvasFrame");
const welcomeDialog = $("#welcomeDialog");
const previewDialog = $("#previewDialog");
const inspectorForm = $("#inspectorForm");

function clone(value) { return structuredClone(value); }
function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function px(value) { return value === undefined || value === null || value === "" ? "" : `${number(value)}px`; }
function cssLength(value) {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  const clean = String(value ?? "").trim();
  return /^-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw)$/.test(clean) ? clean : "";
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function makeId(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 9)}`; }
function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function safeColor(value, fallback = "#000000") { return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback; }
function safeFontStack(value) { return FONT_BY_STACK.has(value) ? value : SYSTEM_FONT; }
function applyUiTheme(themeId, persist = true) {
  const theme = UI_THEMES.find((item) => item.id === themeId) || UI_THEMES[0];
  document.documentElement.dataset.uiTheme = theme.id;
  const button = $("#appThemeButton");
  if (button) {
    button.title = `Thème de l’interface : ${theme.label}`;
    button.setAttribute("aria-label", `Thème de l’interface : ${theme.label}. Cliquer pour changer.`);
    $("#appThemeIcon").textContent = theme.icon;
  }
  if (persist) localStorage.setItem("atelier-ai-ui-theme", theme.id);
}
function cycleUiTheme() {
  const current = document.documentElement.dataset.uiTheme || "light";
  const index = UI_THEMES.findIndex((item) => item.id === current);
  applyUiTheme(UI_THEMES[(index + 1) % UI_THEMES.length].id);
}
function themePresetName(theme = {}) {
  if (THEME_PRESETS[theme.preset]) return theme.preset;
  const background = String(theme.background || "").toLowerCase();
  if (background === THEME_PRESETS.charcoal.background) return "charcoal";
  if (background === THEME_PRESETS.celestial.background) return "celestial";
  return "neutral";
}
function googleFontUrl(fontStack) {
  const font = FONT_BY_STACK.get(safeFontStack(fontStack));
  if (!font?.family) return "";
  const family = encodeURIComponent(font.family).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${font.weights.join(";")}&display=swap`;
}
function currentPage() {
  if (!state.project?.pages?.length) return null;
  return state.project.pages.find((page) => page.id === state.currentPageId) || state.project.pages[0];
}
function pageFrom(project) {
  return project?.pages?.find((page) => page.id === state.currentPageId) || project?.pages?.[0] || null;
}

function migrateProject(project) {
  if (!project || typeof project !== "object") return null;
  if (!Array.isArray(project.pages)) project.pages = project.page ? [project.page] : [];
  delete project.page;
  project.version = 2;
  project.theme ||= {};
  project.theme.font = safeFontStack(project.theme.font);
  project.theme.preset = themePresetName(project.theme);
  const preset = THEME_PRESETS[project.theme.preset];
  project.theme.soft ||= preset.soft;
  project.theme.buttonText ||= preset.buttonText;
  project.pages.forEach((page, index) => {
    page.id ||= makeId("page");
    page.name ||= `Page ${index + 1}`;
    page.slug ||= index === 0 ? "index" : slugify(page.name);
    page.sections ||= [];
  });
  return project;
}

function slugify(value) {
  return String(value || "page").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
}

function populateFontSelect() {
  const select = $("#fontSelect");
  select.replaceChildren();
  const groups = new Map();
  FONT_OPTIONS.forEach((font) => {
    if (!groups.has(font.group)) {
      const group = document.createElement("optgroup");
      group.label = font.group;
      groups.set(font.group, group);
      select.append(group);
    }
    const option = document.createElement("option");
    option.value = font.stack;
    option.textContent = font.label;
    groups.get(font.group).append(option);
  });
}

function syncFontControl() {
  const select = $("#fontSelect");
  const fontStack = state.project ? safeFontStack(state.project.theme.font) : SYSTEM_FONT;
  select.disabled = !state.project;
  select.value = fontStack;
  $(".font-sample").style.fontFamily = fontStack;
  if (!state.project) $("#fontStatus").textContent = "Créez un projet pour choisir une police.";
}

function loadProjectFont(fontStack) {
  const safeStack = safeFontStack(fontStack);
  const font = FONT_BY_STACK.get(safeStack);
  const url = googleFontUrl(safeStack);
  let link = $("#googleFontStylesheet");
  $(".font-sample").style.fontFamily = safeStack;
  if (!url) {
    link?.remove();
    $("#fontStatus").textContent = "Police système, aucune connexion externe.";
    return;
  }
  if (link?.href === url) return;
  link?.remove();
  link = document.createElement("link");
  link.id = "googleFontStylesheet";
  link.rel = "stylesheet";
  link.href = url;
  link.addEventListener("load", () => { $("#fontStatus").textContent = `${font.label} chargée depuis Google Fonts.`; });
  link.addEventListener("error", () => { $("#fontStatus").textContent = `${font.label} indisponible, police de secours utilisée.`; });
  $("#fontStatus").textContent = `Chargement de ${font.label}...`;
  document.head.append(link);
}

function showToast(title, message = "", tone = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  const strong = document.createElement("strong");
  strong.textContent = title;
  toast.append(strong);
  if (message) toast.append(document.createTextNode(message));
  $("#toastRegion").append(toast);
  setTimeout(() => toast.remove(), 4200);
}

let loadingProgressTimer = null;
let loadingProgressValue = 0;

function setLoadingProgress(value, step) {
  loadingProgressValue = clamp(Math.round(value), 0, 100);
  $("#loadingProgressFill").style.width = `${loadingProgressValue}%`;
  $("#loadingPercent").textContent = `${loadingProgressValue} %`;
  if (step) $("#loadingStep").textContent = step;
  $(".loading-progress-track").setAttribute("aria-valuenow", String(loadingProgressValue));
}

function setLoading(visible, title = "L’IA dessine votre site", text = "Structure, couleurs et contenu sont en cours de création...") {
  $("#loadingOverlay").classList.toggle("hidden", !visible);
  $("#loadingTitle").textContent = title;
  $("#loadingText").textContent = text;
  $("#loadingProgress").classList.toggle("hidden", !visible);
  clearInterval(loadingProgressTimer);
  loadingProgressTimer = null;
  $("#generationStages").classList.add("hidden");
  $$('[data-generation-stage]').forEach((item) => {
    item.classList.remove("active", "done");
    $("small", item).textContent = "En attente";
  });
  if (!visible) return;
  setLoadingProgress(6, "Préparation de la demande");
  loadingProgressTimer = setInterval(() => {
    if (loadingProgressValue >= 76) return;
    const increment = loadingProgressValue < 35 ? 4 : loadingProgressValue < 60 ? 2 : 1;
    const next = Math.min(76, loadingProgressValue + increment);
    const step = next < 25 ? "Analyse de votre demande" : next < 55 ? "Génération par l’IA" : "Création de la structure";
    setLoadingProgress(next, step);
  }, 650);
}

function updateGenerationStage(part, status) {
  const item = $(`[data-generation-stage="${part}"]`);
  if (!item) return;
  item.classList.toggle("active", status === "active");
  item.classList.toggle("done", status === "done");
  $("small", item).textContent = status === "done" ? "Terminé" : status === "active" ? "Génération..." : "En attente";
}

const onboardingInputs = ["#headerBriefInput", "#mainBriefInput", "#footerBriefInput"];
const onboardingParts = ["header", "main", "footer"];
const onboardingActions = [
  ["Générer le header", "Puis prévisualiser et continuer"],
  ["Générer le contenu", "Le header restera inchangé"],
  ["Générer le footer", "Puis ouvrir le site dans l’éditeur"]
];

function setOnboardingStep(step, focus = true) {
  state.onboardingStep = clamp(step, 0, onboardingInputs.length - 1);
  $$('[data-onboarding-panel]').forEach((panel, index) => {
    const active = index === state.onboardingStep;
    panel.classList.toggle("hidden", !active);
    const input = $("textarea", panel);
    input.disabled = !active;
  });
  $$('[data-onboarding-go]').forEach((button, index) => {
    button.classList.toggle("active", index === state.onboardingStep);
    button.classList.toggle("done", state.onboardingCompleted.includes(onboardingParts[index]));
    button.disabled = index > 0 && !state.onboardingCompleted.includes(onboardingParts[index - 1]);
  });
  $("#onboardingCounter").textContent = `${state.onboardingStep + 1} / ${onboardingInputs.length}`;
  $("#onboardingActionTitle").textContent = onboardingActions[state.onboardingStep][0];
  $("#onboardingActionHint").textContent = onboardingActions[state.onboardingStep][1];
  $("#onboardingBack").classList.toggle("hidden", state.onboardingStep === 0);
  if (focus) setTimeout(() => $(onboardingInputs[state.onboardingStep]).focus(), 40);
}

function onboardingControls(part) {
  return {
    layout: $(`[name="${part}Layout"]:checked`)?.value || "auto",
    density: $("#layoutDensity").value,
    creative: $("#creativeLayout").checked
  };
}

function miniPreviewElement(item) {
  const element = document.createElement("div");
  element.className = `mini-element mini-element-${item.type}`;
  element.textContent = item.type === "image" || item.type === "divider" ? "" : item.content;
  if (item.type === "button") element.style.background = item.styles?.background || "#2f3137";
  if (item.styles?.color) element.style.color = item.styles.color;
  if (["card", "image"].includes(item.type) && item.styles?.background) element.style.background = item.styles.background;
  return element;
}

function renderOnboardingPreview() {
  const preview = $("#onboardingLivePreview");
  preview.replaceChildren();
  const previewTheme = state.onboardingDraft?.theme || THEME_PRESETS.neutral;
  preview.style.background = previewTheme.background;
  preview.style.color = previewTheme.text;
  preview.style.setProperty("--mini-surface", previewTheme.surface);
  preview.style.setProperty("--mini-soft", previewTheme.soft);
  preview.style.setProperty("--mini-accent", previewTheme.accent);
  const page = state.onboardingDraft?.pages?.[0];
  if (!page || !state.onboardingCompleted.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "preview-placeholder";
    placeholder.innerHTML = "<span>✦</span><strong>Votre wireframe apparaîtra ici</strong><small>Chaque prompt construit une partie sans remplacer les précédentes.</small>";
    preview.append(placeholder);
    return;
  }
  const visibleSections = page.sections.filter((section) => {
    if (["navbar", "hero"].includes(section.type)) return state.onboardingCompleted.includes("header");
    if (section.type === "footer") return state.onboardingCompleted.includes("footer");
    return state.onboardingCompleted.includes("main");
  });
  visibleSections.forEach((section) => {
    const node = document.createElement("section");
    const layout = section.styles?.layout || "column";
    node.className = `mini-section layout-${layout}`;
    node.style.background = section.styles?.background || "#ffffff";
    node.style.color = section.styles?.color || previewTheme.text;
    node.style.setProperty("--mini-columns", Math.min(number(section.styles?.columns, 2), 3));
    const label = document.createElement("span");
    label.className = "mini-section-type";
    label.textContent = typeNames[section.type] || section.type;
    node.append(label, ...section.children.slice(0, 8).map(miniPreviewElement));
    preview.append(node);
  });
  preview.scrollTop = preview.scrollHeight;
}

function setOnboardingBusy(busy, part) {
  $("#generateSiteButton").disabled = busy;
  $("#onboardingBack").disabled = busy;
  $("#onboardingActionTitle").textContent = busy ? `L’IA compose le ${part}...` : onboardingActions[state.onboardingStep][0];
  $("#onboardingActionHint").textContent = busy ? "Le résultat va apparaître à gauche" : onboardingActions[state.onboardingStep][1];
  if (busy) $("#onboardingPreviewStatus").textContent = `Génération du ${part} en cours...`;
}

async function generateOnboardingPart(part, description) {
  setOnboardingBusy(true, part);
  try {
    const controls = onboardingControls(part);
    const descriptions = Object.fromEntries(onboardingParts.map((name, index) => [name, $(onboardingInputs[index]).value.trim()]));
    const brief = onboardingParts.map((name) => `${name}: ${descriptions[name] || "à définir"}`).join("\n");
    const response = await fetch("/api/generate-part", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ part, description, brief, controls, project: state.onboardingDraft, model: state.selectedModel || undefined })
    });
    if (!response.ok) throw new Error(`La génération du ${part} a échoué`);
    const payload = await response.json();
    state.onboardingDraft = migrateProject(payload.project);
    if (!state.onboardingCompleted.includes(part)) state.onboardingCompleted.push(part);
    renderOnboardingPreview();
    $("#onboardingPreviewStatus").textContent = `${typeNames[part] || part} généré · ${controls.layout} · ${controls.density}`;
    if (payload.warning) showToast(`${part} généré localement`, payload.warning, "warning");
    return true;
  } catch (error) {
    showToast("Génération impossible", error.message, "warning");
    $("#onboardingPreviewStatus").textContent = `Impossible de générer le ${part}`;
    return false;
  } finally {
    setOnboardingBusy(false, part);
  }
}

async function completeLoading(step = "Site prêt") {
  clearInterval(loadingProgressTimer);
  loadingProgressTimer = null;
  setLoadingProgress(100, step);
  await new Promise((resolve) => setTimeout(resolve, 420));
  setLoading(false);
}

function saveWorkspace() {
  localStorage.setItem("atelier-ai-workspace", JSON.stringify({
    version: 1,
    currentPageId: state.currentPageId,
    selectedId: state.selectedId,
    viewport: state.viewport,
    zoom: state.zoom,
    leftTab: state.leftTab,
    chatOpen: state.chatOpen,
    canvasScrollLeft: state.canvasScrollLeft,
    canvasScrollTop: state.canvasScrollTop
  }));
}

function readStoredJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function saveProject() {
  if (!state.project) return;
  localStorage.setItem("atelier-ai-project", JSON.stringify(state.project));
  localStorage.setItem("atelier-ai-brief", state.brief);
  localStorage.setItem("atelier-ai-current-page", state.currentPageId || "");
  localStorage.setItem("atelier-ai-chat", JSON.stringify(state.chatHistory.slice(-40)));
  localStorage.setItem("atelier-ai-model", state.selectedModel || "");
  saveWorkspace();
  $("#saveStatus").textContent = "Enregistré localement";
}

function resetProject() {
  if (state.project && !window.confirm("Tout effacer et revenir à l’écran de départ ? Cette action supprimera le projet et la conversation enregistrés sur cet appareil.")) return;
  ["atelier-ai-project", "atelier-ai-brief", "atelier-ai-current-page", "atelier-ai-chat", "atelier-ai-workspace"].forEach((key) => localStorage.removeItem(key));
  state.project = null;
  state.currentPageId = null;
  state.selectedId = null;
  state.history = [];
  state.future = [];
  state.dragging = null;
  state.brief = "";
  state.chatHistory = [];
  state.viewport = "desktop";
  state.zoom = 0.78;
  state.leftTab = "layers";
  state.chatOpen = false;
  state.canvasScrollLeft = 0;
  state.canvasScrollTop = 0;
  state.onboardingStep = 0;
  state.onboardingDraft = null;
  state.onboardingCompleted = [];
  canvas.replaceChildren();
  $("#layersTree").replaceChildren();
  $("#pagesList").replaceChildren();
  $("#projectName").value = "Nouveau projet";
  onboardingInputs.forEach((selector) => { $(selector).value = ""; });
  $("#elementPrompt").value = "";
  $("#selectionPrompt").classList.add("hidden");
  toggleChat(false);
  renderAll();
  renderChat();
  renderOnboardingPreview();
  $("#onboardingPreviewStatus").textContent = "Décrivez le header pour commencer";
  setOnboardingStep(0, false);
  welcomeDialog.showModal();
  setTimeout(() => $(onboardingInputs[0]).focus(), 80);
}

function commit(mutator, options = {}) {
  if (!state.project) return;
  if (options.history !== false) {
    state.history.push(clone(state.project));
    if (state.history.length > 50) state.history.shift();
    state.future = [];
  }
  mutator(state.project);
  saveProject();
  renderAll();
}

function findNode(id) {
  const page = currentPage();
  if (!page || !id) return null;
  for (let sectionIndex = 0; sectionIndex < page.sections.length; sectionIndex += 1) {
    const section = page.sections[sectionIndex];
    if (section.id === id) return { node: section, kind: "section", section, sectionIndex, index: sectionIndex };
    const index = section.children.findIndex((item) => item.id === id);
    if (index >= 0) return { node: section.children[index], kind: "element", section, sectionIndex, index };
  }
  return null;
}

function styleObject(styles = {}, kind = "element", compact = false) {
  const result = {};
  const keys = ["background", "color", "fontWeight", "letterSpacing", "lineHeight", "opacity"];
  keys.forEach((key) => { if (styles[key] !== undefined && styles[key] !== "") result[key] = styles[key]; });
  if (styles.fontSize !== undefined) result.fontSize = compact && number(styles.fontSize) > 34 ? px(Math.max(28, number(styles.fontSize) * 0.62)) : cssLength(styles.fontSize);
  if (styles.borderRadius !== undefined) result.borderRadius = cssLength(styles.borderRadius);
  if (styles.maxWidth !== undefined) result.maxWidth = cssLength(styles.maxWidth);
  if (styles.minHeight !== undefined) result.minHeight = cssLength(styles.minHeight);
  if (styles.width !== undefined) result.width = cssLength(styles.width);
  if (styles.paddingY !== undefined) { result.paddingTop = px(compact ? Math.min(number(styles.paddingY), 58) : styles.paddingY); result.paddingBottom = result.paddingTop; }
  if (styles.paddingX !== undefined) { result.paddingLeft = px(compact ? Math.min(number(styles.paddingX), 24) : styles.paddingX); result.paddingRight = result.paddingLeft; }
  if (styles.textAlign) result.textAlign = styles.textAlign;
  if (styles.gap !== undefined) result.gap = px(styles.gap);
  if (styles.gridColumn) result.gridColumn = styles.gridColumn;
  if (kind === "section") {
    result.display = styles.layout === "grid" ? "grid" : "flex";
    result.flexDirection = styles.layout === "row" && !compact ? "row" : "column";
    if (styles.layout === "grid") {
      const customTemplate = typeof styles.gridTemplateColumns === "string" && /^[\d.a-z%\s(),-]+$/i.test(styles.gridTemplateColumns) ? styles.gridTemplateColumns : "";
      result.gridTemplateColumns = compact ? "1fr" : customTemplate || `repeat(${number(styles.columns, 3)}, minmax(0, 1fr))`;
    }
    const alignMap = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" };
    const justifyMap = { start: "flex-start", center: "center", end: "flex-end", between: "space-between" };
    result.alignItems = alignMap[styles.align] || (styles.layout === "grid" ? "stretch" : "flex-start");
    result.justifyContent = justifyMap[styles.justify] || "flex-start";
  }
  return result;
}

function applyStyles(element, styles) {
  Object.assign(element.style, styles);
}

function createElementNode(item, compact) {
  const wrapper = document.createElement("div");
  wrapper.className = `canvas-element canvas-${item.type}${item.effect && item.effect !== "none" ? ` effect-${item.effect}` : ""}`;
  wrapper.dataset.id = item.id;
  wrapper.dataset.kind = "element";
  wrapper.draggable = true;
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "button");
  wrapper.setAttribute("aria-label", `${typeNames[item.type] || item.type}: ${item.content.slice(0, 50)}`);
  applyStyles(wrapper, styleObject(item.styles, "element", compact));

  const tag = document.createElement("span");
  tag.className = "selection-tag";
  tag.textContent = typeNames[item.type] || item.type;
  wrapper.append(tag);

  let content;
  if (item.type === "nav") {
    content = document.createElement("div");
    content.className = "site-nav-links";
    item.content.split("|").forEach((label) => { const span = document.createElement("span"); span.textContent = label.trim(); content.append(span); });
  } else if (item.type === "button") {
    content = document.createElement("a");
    content.className = "site-button";
    content.href = item.href || "#";
    content.textContent = item.content;
    content.addEventListener("click", (event) => event.preventDefault());
  } else if (item.type === "image") {
    content = document.createElement("div");
    content.className = "site-image";
    content.textContent = item.content || "Aperçu de l’image";
  } else if (item.type === "divider") {
    content = document.createElement("div");
    content.className = "site-divider";
  } else {
    const tags = { heading: "h2", text: "p", logo: "strong", badge: "span", card: "div" };
    content = document.createElement(tags[item.type] || "div");
    if (item.type === "card") content.className = "site-card";
    content.textContent = item.content;
  }
  if (item.type !== "image" && item.type !== "divider") {
    content.style.margin = "0";
    content.style.color = "inherit";
    content.style.font = "inherit";
    content.style.fontWeight = "inherit";
    content.style.lineHeight = "inherit";
    content.style.letterSpacing = "inherit";
    content.style.textAlign = "inherit";
  }
  wrapper.append(content);

  wrapper.addEventListener("click", (event) => { event.stopPropagation(); selectNode(item.id); });
  wrapper.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectNode(item.id); }
  });
  addDragEvents(wrapper);
  return wrapper;
}

function renderCanvas() {
  canvas.replaceChildren();
  if (!state.project) return;
  const compact = state.viewport === "mobile";
  canvas.style.fontFamily = state.project.theme.font || "Inter, system-ui, sans-serif";
  canvas.style.color = state.project.theme.text || "#17181c";
  canvas.style.background = state.project.theme.background || "#ffffff";
  canvas.style.setProperty("--site-surface", state.project.theme.surface || "#ffffff");
  canvas.style.setProperty("--site-soft", state.project.theme.soft || "#e9e9e6");
  canvas.style.setProperty("--site-accent", state.project.theme.accent || "#2f3137");

  currentPage()?.sections.forEach((section) => {
    const sectionNode = document.createElement("section");
    sectionNode.className = "canvas-section";
    sectionNode.dataset.id = section.id;
    sectionNode.dataset.kind = "section";
    sectionNode.draggable = true;
    sectionNode.tabIndex = 0;
    sectionNode.setAttribute("aria-label", `Section ${typeNames[section.type] || section.type}`);
    applyStyles(sectionNode, styleObject(section.styles, "section", compact));

    const tag = document.createElement("span");
    tag.className = "selection-tag";
    tag.textContent = typeNames[section.type] || "Section";
    sectionNode.append(tag);

    section.children.forEach((item, index) => {
      const child = createElementNode(item, compact);
      if (section.styles.layout === "grid" && item.type === "heading") child.style.gridColumn = compact ? "auto" : `1 / span ${number(section.styles.columns, 3)}`;
      if (section.type === "navbar" && compact && item.type === "nav") child.style.display = "none";
      child.dataset.index = String(index);
      sectionNode.append(child);
    });
    sectionNode.addEventListener("click", () => selectNode(section.id));
    sectionNode.addEventListener("keydown", (event) => { if ((event.key === "Enter" || event.key === " ") && event.target === sectionNode) { event.preventDefault(); selectNode(section.id); } });
    addDragEvents(sectionNode);
    canvas.append(sectionNode);
  });
  refreshSelectionClasses();
}

function addDragEvents(node) {
  node.addEventListener("dragstart", (event) => {
    event.stopPropagation();
    const found = findNode(node.dataset.id);
    if (!found) return;
    state.dragging = { id: node.dataset.id, kind: found.kind, sectionId: found.section.id };
    node.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", node.dataset.id);
  });
  node.addEventListener("dragover", (event) => {
    if (!state.dragging || state.dragging.id === node.dataset.id || state.dragging.kind !== node.dataset.kind) return;
    if (state.dragging.kind === "element" && state.dragging.sectionId !== findNode(node.dataset.id)?.section.id) return;
    event.preventDefault();
    event.stopPropagation();
    node.classList.add("drop-target");
  });
  node.addEventListener("dragleave", () => node.classList.remove("drop-target"));
  node.addEventListener("drop", (event) => {
    event.preventDefault(); event.stopPropagation(); node.classList.remove("drop-target");
    reorderNodes(state.dragging?.id, node.dataset.id);
  });
  node.addEventListener("dragend", () => {
    node.classList.remove("dragging");
    $$(".drop-target").forEach((item) => item.classList.remove("drop-target"));
    state.dragging = null;
  });
}

function reorderNodes(sourceId, targetId) {
  const source = findNode(sourceId);
  const target = findNode(targetId);
  if (!source || !target || source.kind !== target.kind) return;
  commit((project) => {
    if (source.kind === "section") {
      const list = pageFrom(project).sections;
      const [moved] = list.splice(source.index, 1);
      const adjusted = source.index < target.index ? target.index - 1 : target.index;
      list.splice(adjusted, 0, moved);
    } else if (source.section.id === target.section.id) {
      const section = pageFrom(project).sections[source.sectionIndex];
      const [moved] = section.children.splice(source.index, 1);
      const adjusted = source.index < target.index ? target.index - 1 : target.index;
      section.children.splice(adjusted, 0, moved);
    }
  });
}

function renderLayers() {
  const tree = $("#layersTree");
  tree.replaceChildren();
  if (!state.project) return;
  currentPage()?.sections.forEach((section) => {
    tree.append(layerButton(section, 0, "▦"));
    section.children.forEach((item) => tree.append(layerButton(item, 1, { heading: "T", text: "¶", button: "▭", card: "▤", image: "▧", logo: "◆", nav: "↔", badge: "◇", divider: "―" }[item.type] || "•")));
  });
}

function renderPages() {
  const list = $("#pagesList");
  list.replaceChildren();
  if (!state.project) return;
  state.project.pages.forEach((page, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `page-pill${page.id === state.currentPageId ? " active" : ""}`;
    row.innerHTML = `<span class="page-icon">${index === 0 ? "⌂" : "◇"}</span><span class="page-name"></span>${page.id === state.currentPageId ? '<span class="page-dot"></span>' : ""}`;
    $(".page-name", row).textContent = page.name;
    if (state.project.pages.length > 1) {
      const remove = document.createElement("span");
      remove.className = "page-delete";
      remove.textContent = "×";
      remove.title = `Supprimer ${page.name}`;
      remove.addEventListener("click", (event) => { event.stopPropagation(); deletePage(page.id); });
      row.append(remove);
    }
    row.addEventListener("click", () => switchPage(page.id));
    row.addEventListener("dblclick", () => renamePage(page.id));
    list.append(row);
  });
}

function switchPage(pageId) {
  if (!state.project.pages.some((page) => page.id === pageId)) return;
  state.currentPageId = pageId;
  state.selectedId = null;
  $("#selectionPrompt").classList.add("hidden");
  saveProject();
  renderAll();
}

function renamePage(pageId) {
  const page = state.project.pages.find((item) => item.id === pageId);
  if (!page) return;
  const name = window.prompt("Nouveau nom de la page", page.name)?.trim();
  if (!name) return;
  commit((project) => {
    const target = project.pages.find((item) => item.id === pageId);
    target.name = name;
    if (target.slug !== "index") target.slug = uniqueSlug(project, slugify(name), pageId);
    updateNavigationLabels(project);
  });
}

function uniqueSlug(project, base, exceptId = null) {
  let slug = base || "page";
  let suffix = 2;
  while (project.pages.some((page) => page.id !== exceptId && page.slug === slug)) slug = `${base}-${suffix++}`;
  return slug;
}

function deletePage(pageId) {
  if (state.project.pages.length <= 1) return;
  const page = state.project.pages.find((item) => item.id === pageId);
  if (!page || !window.confirm(`Supprimer la page « ${page.name} » ?`)) return;
  commit((project) => {
    const index = project.pages.findIndex((item) => item.id === pageId);
    project.pages.splice(index, 1);
    if (state.currentPageId === pageId) state.currentPageId = project.pages[Math.max(0, index - 1)].id;
    state.selectedId = null;
    updateNavigationLabels(project);
  });
}

function layerButton(node, depth, icon) {
  const button = document.createElement("button");
  button.className = `layer-row${state.selectedId === node.id ? " selected" : ""}`;
  button.style.setProperty("--depth", depth);
  button.dataset.id = node.id;
  button.innerHTML = `<span class="chevron">${depth ? "" : "⌄"}</span><span class="layer-icon">${icon}</span><span class="layer-name"></span>`;
  $(".layer-name", button).textContent = depth ? (node.content?.split("\n")[0] || typeNames[node.type]) : typeNames[node.type] || node.type;
  button.addEventListener("click", () => selectNode(node.id));
  return button;
}

function refreshSelectionClasses() {
  $$('[data-id]', canvas).forEach((node) => node.classList.toggle("selected", node.dataset.id === state.selectedId));
}

function selectNode(id) {
  state.selectedId = id;
  refreshSelectionClasses();
  renderLayers();
  renderInspector();
  const found = findNode(id);
  if (found) {
    $("#selectionPrompt").classList.remove("hidden");
    $("#selectionPromptLabel").textContent = typeNames[found.node.type] || found.node.type;
    if (window.innerWidth <= 820) $("#rightPanel").classList.add("open");
  }
  saveWorkspace();
}

function clearSelection() {
  state.selectedId = null;
  refreshSelectionClasses();
  renderLayers();
  renderInspector();
  $("#selectionPrompt").classList.add("hidden");
  saveWorkspace();
}

function renderInspector() {
  const found = findNode(state.selectedId);
  $("#emptyInspector").classList.toggle("hidden", Boolean(found));
  inspectorForm.classList.toggle("hidden", !found);
  if (!found) { $("#selectedLabel").textContent = "Aucune sélection"; return; }
  const { node, kind } = found;
  const styles = node.styles || {};
  $("#selectedLabel").textContent = typeNames[node.type] || node.type;
  $("#contentControls").classList.toggle("hidden", kind === "section");
  $("#contentInput").value = node.content || "";
  $("#hrefInput").value = node.href || "";
  $("#hrefField").classList.toggle("hidden", node.type !== "button");
  $("#widthInput").value = styles.width || styles.maxWidth || "";
  $("#fontSizeInput").value = styles.fontSize || "";
  $("#radiusInput").value = styles.borderRadius || "";
  $("#gapInput").value = styles.gap || "";
  const textColor = safeColor(styles.color, safeColor(state.project.theme.text, "#17181c"));
  const background = safeColor(styles.background, kind === "section" ? safeColor(state.project.theme.background, "#ffffff") : "#ffffff");
  $("#textColorInput").value = textColor; $("#textColorHex").value = textColor;
  $("#backgroundInput").value = background; $("#backgroundHex").value = background;
  $("#effectInput").value = node.effect || "none";
  $$("[data-align]").forEach((button) => button.classList.toggle("active", button.dataset.align === (styles.textAlign || "left")));
}

function renderAll() {
  if (state.project) {
    if (!state.project.pages.some((page) => page.id === state.currentPageId)) state.currentPageId = state.project.pages[0]?.id || null;
    state.project.theme.font = safeFontStack(state.project.theme.font);
    loadProjectFont(state.project.theme.font);
    $("#projectName").value = state.project.name;
    document.documentElement.style.setProperty("--accent", state.project.theme.accent || "#ff6847");
  } else loadProjectFont(SYSTEM_FONT_OPTION.stack);
  syncFontControl();
  canvasFrame.className = `canvas-frame viewport-${state.viewport}`;
  canvasFrame.style.transform = `scale(${state.zoom})`;
  canvasFrame.style.marginBottom = `${-(1 - state.zoom) * 600}px`;
  $("#zoomValue").textContent = `${Math.round(state.zoom * 100)}%`;
  $$("[data-viewport]").forEach((button) => button.classList.toggle("active", button.dataset.viewport === state.viewport));
  $("#undoButton").disabled = state.history.length === 0;
  $("#redoButton").disabled = state.future.length === 0;
  renderCanvas();
  renderPages();
  renderLayers();
  renderInspector();
  const selected = findNode(state.selectedId);
  $("#selectionPrompt").classList.toggle("hidden", !selected);
  if (selected) $("#selectionPromptLabel").textContent = typeNames[selected.node.type] || selected.node.type;
}

async function generateProject({ brief = state.brief, instruction = "" } = {}) {
  setLoading(true, "L’IA dessine votre site", "Structure, couleurs et contenu sont en cours de création...");
  let completed = false;
  try {
    setLoadingProgress(12, "Envoi de la demande");
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief, instruction, model: state.selectedModel || undefined })
    });
    if (!response.ok) throw new Error("La génération a échoué");
    setLoadingProgress(82, "Réponse de l’IA reçue");
    const payload = await response.json();
    setLoadingProgress(92, "Construction de l’interface");
    if (state.project) state.history.push(clone(state.project));
    state.project = migrateProject(payload.project);
    state.currentPageId = state.project.pages[0]?.id || null;
    state.future = [];
    state.brief = brief;
    state.selectedId = null;
    saveProject();
    renderAll();
    if (payload.source === "mistral-vibe") showToast("Croquis généré avec Mistral Vibe", "Le modèle en ligne a créé la composition.");
    else if (payload.source === "antigravity") showToast("Croquis généré avec Antigravity", "Le modèle sélectionné dans Antigravity CLI a créé la composition.");
    else if (payload.source === "lm-studio") showToast("Croquis généré avec LM Studio", "Le modèle local a créé la composition.");
    else showToast("Croquis généré en local (fallback)", payload.warning || "Mistral Vibe ou LM Studio n’était pas disponible.", "warning");
    await completeLoading("Site prêt");
    completed = true;
  } catch (error) {
    showToast("Génération impossible", error.message, "warning");
  } finally {
    if (!completed) setLoading(false);
  }
}

async function generateStagedProject(descriptions) {
  const stages = [
    { part: "header", label: "Header", progress: 10, complete: 32 },
    { part: "main", label: "Main", progress: 38, complete: 72 },
    { part: "footer", label: "Footer", progress: 78, complete: 96 }
  ];
  const brief = `Header: ${descriptions.header}\nMain: ${descriptions.main}\nFooter: ${descriptions.footer}`;
  const sources = new Set();
  const warnings = [];
  let draft = null;
  let completed = false;

  setLoading(true, "L’IA construit votre site en 3 étapes", "Chaque partie est générée séparément à partir de votre description.");
  clearInterval(loadingProgressTimer);
  loadingProgressTimer = null;
  $("#generationStages").classList.remove("hidden");

  try {
    for (const stage of stages) {
      updateGenerationStage(stage.part, "active");
      setLoadingProgress(stage.progress, `Étape ${stages.indexOf(stage) + 1}/3 · Génération du ${stage.label}`);
      const response = await fetch("/api/generate-part", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          part: stage.part,
          description: descriptions[stage.part],
          brief,
          controls: onboardingControls(stage.part),
          project: draft,
          model: state.selectedModel || undefined
        })
      });
      if (!response.ok) throw new Error(`La génération du ${stage.label} a échoué`);
      const payload = await response.json();
      draft = migrateProject(payload.project);
      state.project = draft;
      state.currentPageId = draft.pages[0]?.id || null;
      state.selectedId = null;
      renderAll();
      sources.add(payload.source);
      if (payload.warning) warnings.push(payload.warning);
      updateGenerationStage(stage.part, "done");
      setLoadingProgress(stage.complete, `${stage.label} terminé`);
    }

    state.future = [];
    state.brief = brief;
    saveProject();
    renderAll();
    const source = sources.size === 1 ? [...sources][0] : "mixte";
    if (source === "mistral-vibe") showToast("Site généré avec Mistral Vibe", "Header, main et footer ont été créés séparément.");
    else if (source === "antigravity") showToast("Site généré avec Antigravity", "Header, main et footer ont été créés séparément.");
    else if (source === "lm-studio") showToast("Site généré avec LM Studio", "Header, main et footer ont été créés séparément.");
    else showToast("Site généré en 3 étapes", warnings[0] || "Le générateur local de secours a été utilisé pour au moins une partie.", warnings.length ? "warning" : "success");
    await completeLoading("Site complet");
    completed = true;
  } catch (error) {
    if (draft) {
      state.project = draft;
      state.currentPageId = draft.pages[0]?.id || null;
      state.brief = brief;
      saveProject();
      renderAll();
    }
    showToast("Génération interrompue", error.message, "warning");
  } finally {
    if (!completed) setLoading(false);
  }
}

async function editSelectedWithAi(instruction) {
  const found = findNode(state.selectedId);
  if (!found || !instruction) return;
  const selectedId = found.node.id;
  const beforeProject = clone(state.project);
  setLoading(true, `L’IA modifie uniquement ce ${typeNames[found.node.type]?.toLowerCase() || "composant"}`, "Seul le JSON de l’élément sélectionné est envoyé. Le reste du site est inaccessible à l’IA.");
  let completed = false;
  try {
    setLoadingProgress(12, "Envoi du composant");
    const response = await fetch("/api/edit-element", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ node: clone(found.node), kind: found.kind, instruction, model: state.selectedModel || undefined })
    });
    if (!response.ok) throw new Error("La modification ciblée a échoué");
    setLoadingProgress(82, "Modification reçue");
    const payload = await response.json();
    setLoadingProgress(92, "Application des changements");
    const latest = findNode(selectedId);
    if (!latest) throw new Error("L’élément n’existe plus");
    state.history.push(beforeProject);
    state.future = [];
    if (latest.kind === "section") pageFrom(state.project).sections[latest.index] = payload.node;
    else pageFrom(state.project).sections[latest.sectionIndex].children[latest.index] = payload.node;
    state.selectedId = selectedId;
    saveProject();
    renderAll();
    const message = payload.source === "mistral-vibe"
      ? "Mistral Vibe n’a reçu que le composant sélectionné."
      : payload.source === "antigravity"
        ? "Antigravity CLI n’a reçu que le composant sélectionné."
      : payload.source === "lm-studio"
        ? "LM Studio n’a reçu que le composant sélectionné."
        : "Modification appliquée par le moteur local ciblé.";
    showToast("Élément modifié", message, payload.source === "local-fallback" ? "warning" : "success");
    await completeLoading("Modification terminée");
    completed = true;
  } catch (error) {
    showToast("Modification impossible", error.message, "warning");
  } finally {
    if (!completed) setLoading(false);
  }
}

function updateSelected(property, value, root = "styles") {
  const found = findNode(state.selectedId);
  if (!found) return;
  commit(() => {
    const latest = findNode(state.selectedId)?.node;
    if (!latest) return;
    if (root === "styles") { latest.styles ||= {}; if (value === "") delete latest.styles[property]; else latest.styles[property] = value; }
    else latest[property] = value;
  });
}

function moveSelected(direction) {
  const found = findNode(state.selectedId);
  if (!found) return;
  commit((project) => {
    const page = pageFrom(project);
    const list = found.kind === "section" ? page.sections : page.sections[found.sectionIndex].children;
    const next = clamp(found.index + direction, 0, list.length - 1);
    if (next === found.index) return;
    [list[found.index], list[next]] = [list[next], list[found.index]];
  });
}

function duplicateSelected() {
  const found = findNode(state.selectedId);
  if (!found) return;
  commit((project) => {
    const copy = clone(found.node);
    copy.id = makeId(found.kind);
    if (found.kind === "section") copy.children = copy.children.map((item) => ({ ...item, id: makeId(item.type) }));
    const page = pageFrom(project);
    const list = found.kind === "section" ? page.sections : page.sections[found.sectionIndex].children;
    list.splice(found.index + 1, 0, copy);
    state.selectedId = copy.id;
  });
}

function deleteSelected() {
  const found = findNode(state.selectedId);
  if (!found) return;
  commit((project) => {
    const page = pageFrom(project);
    const list = found.kind === "section" ? page.sections : page.sections[found.sectionIndex].children;
    list.splice(found.index, 1);
    state.selectedId = null;
  });
  $("#selectionPrompt").classList.add("hidden");
}

function addElement(type) {
  if (!state.project) return;
  const defaults = {
    heading: { content: "Votre nouveau titre", styles: { fontSize: 36, fontWeight: 750 } },
    text: { content: "Ajoutez ici votre texte. Cliquez pour le personnaliser.", styles: { fontSize: 16, color: "#626773", lineHeight: 1.6 } },
    button: { content: "En savoir plus", styles: { background: state.project.theme.accent, color: "#ffffff", borderRadius: 12, paddingY: 13, paddingX: 20 }, href: "#", effect: "lift" },
    card: { content: "Nouvelle carte\nUn contenu clair pour présenter une idée ou un service.", styles: { background: "#ffffff", borderRadius: 18, paddingY: 25, paddingX: 25 } },
    image: { content: "Votre image", styles: { borderRadius: 18 } },
    divider: { content: "", styles: {} }
  };
  const selected = findNode(state.selectedId);
  const sectionIndex = selected?.sectionIndex ?? Math.max(0, currentPage().sections.length - 2);
  commit((project) => {
    const item = { id: makeId(type), type, ...clone(defaults[type]) };
    pageFrom(project).sections[sectionIndex].children.push(item);
    state.selectedId = item.id;
  });
}

function addSection() {
  if (!state.project) return;
  commit((project) => {
    const section = { id: makeId("section"), type: "content", styles: { paddingY: 70, paddingX: 52, layout: "column", align: "center", gap: 18, background: "#ffffff" }, children: [
      { id: makeId("heading"), type: "heading", content: "Une nouvelle section", styles: { fontSize: 38, fontWeight: 750, textAlign: "center" } },
      { id: makeId("text"), type: "text", content: "Présentez ici une information importante pour vos visiteurs.", styles: { fontSize: 16, color: "#626773", textAlign: "center", maxWidth: 600 } }
    ] };
    pageFrom(project).sections.push(section);
    state.selectedId = section.id;
  });
}

function createPage(name, description = "") {
  const theme = state.project.theme;
  const slug = uniqueSlug(state.project, slugify(name));
  const newPage = {
    id: makeId("page"),
    name,
    slug,
    sections: [
      {
        id: makeId("section"), type: "navbar",
        styles: { paddingY: 22, paddingX: 52, layout: "row", align: "center", justify: "between", background: theme.surface },
        children: [
          { id: makeId("logo"), type: "logo", content: state.project.name, styles: { fontSize: 22, fontWeight: 800 } },
          { id: makeId("nav"), type: "nav", content: state.project.pages.map((page) => page.name).concat(name).join("|"), styles: { fontSize: 14 } },
          { id: makeId("button"), type: "button", content: "Nous contacter", href: "#contact", effect: "lift", styles: { background: theme.text, color: "#ffffff", borderRadius: 999, paddingY: 12, paddingX: 20 } }
        ]
      },
      {
        id: makeId("section"), type: "hero",
        styles: { paddingY: 100, paddingX: 40, layout: "column", align: "center", gap: 22, background: theme.background },
        children: [
          { id: makeId("badge"), type: "badge", content: name.toUpperCase(), styles: { color: theme.accent, fontSize: 12, fontWeight: 800, letterSpacing: 2 } },
          { id: makeId("heading"), type: "heading", content: name, styles: { fontSize: 58, fontWeight: 800, maxWidth: 760, lineHeight: 1.05, textAlign: "center" } },
          { id: makeId("text"), type: "text", content: description || `Présentez ici les informations essentielles de la page ${name}.`, styles: { fontSize: 18, maxWidth: 650, color: theme.muted, lineHeight: 1.65, textAlign: "center" } }
        ]
      },
      {
        id: makeId("section"), type: "content",
        styles: { paddingY: 80, paddingX: 52, layout: "column", align: "center", gap: 18, background: theme.surface },
        children: [
          { id: makeId("heading"), type: "heading", content: "Les informations importantes", styles: { fontSize: 38, fontWeight: 750, textAlign: "center" } },
          { id: makeId("text"), type: "text", content: "Ajoutez vos contenus, vos preuves et un appel à l’action adapté à cette page.", styles: { fontSize: 16, maxWidth: 620, color: theme.muted, lineHeight: 1.65, textAlign: "center" } }
        ]
      },
      {
        id: makeId("section"), type: "footer",
        styles: { paddingY: 30, paddingX: 52, layout: "row", align: "center", justify: "between", background: theme.surface },
        children: [
          { id: makeId("logo"), type: "logo", content: state.project.name, styles: { fontSize: 20, fontWeight: 800 } },
          { id: makeId("text"), type: "text", content: "© 2026 — Tous droits réservés", styles: { fontSize: 13, color: theme.muted } }
        ]
      }
    ]
  };
  commit((project) => {
    project.pages.push(newPage);
    state.currentPageId = newPage.id;
    state.selectedId = null;
    updateNavigationLabels(project);
  });
}

function updateNavigationLabels(project) {
  const labels = project.pages.map((page) => page.name).join("|");
  project.pages.forEach((page) => page.sections.forEach((section) => section.children.forEach((item) => {
    if (item.type === "nav") item.content = labels;
  })));
}

function cssFromStyles(styles = {}, section = false) {
  const map = [];
  const simple = { background: "background", color: "color", fontWeight: "font-weight", letterSpacing: "letter-spacing", lineHeight: "line-height", textAlign: "text-align", opacity: "opacity" };
  Object.entries(simple).forEach(([key, css]) => { if (styles[key] !== undefined && styles[key] !== "") map.push(`${css}:${styles[key]}`); });
  [["fontSize","font-size"],["borderRadius","border-radius"],["maxWidth","max-width"],["minHeight","min-height"],["width","width"],["gap","gap"]].forEach(([key, css]) => { const value = cssLength(styles[key]); if (value) map.push(`${css}:${value}`); });
  if (styles.gridColumn) map.push(`grid-column:${styles.gridColumn}`);
  if (styles.paddingY !== undefined) map.push(`padding-top:${number(styles.paddingY)}px`, `padding-bottom:${number(styles.paddingY)}px`);
  if (styles.paddingX !== undefined) map.push(`padding-left:${number(styles.paddingX)}px`, `padding-right:${number(styles.paddingX)}px`);
  if (section) {
    map.push(`display:${styles.layout === "grid" ? "grid" : "flex"}`);
    if (styles.layout === "grid") {
      const customTemplate = typeof styles.gridTemplateColumns === "string" && /^[\d.a-z%\s(),-]+$/i.test(styles.gridTemplateColumns) ? styles.gridTemplateColumns : "";
      map.push(`grid-template-columns:${customTemplate || `repeat(${number(styles.columns, 3)},minmax(0,1fr))`}`);
    }
    else map.push(`flex-direction:${styles.layout === "row" ? "row" : "column"}`);
    map.push(`align-items:${({start:"flex-start",center:"center",end:"flex-end",stretch:"stretch"})[styles.align] || "flex-start"}`);
    map.push(`justify-content:${({start:"flex-start",center:"center",end:"flex-end",between:"space-between"})[styles.justify] || "flex-start"}`);
  }
  return map.join(";");
}

function elementHtml(item) {
  const style = cssFromStyles(item.styles);
  const effect = item.effect && item.effect !== "none" ? ` effect-${item.effect}` : "";
  if (item.type === "nav") return `<nav class="nav-links" style="${style}">${item.content.split("|").map((label, index) => {
    const cleanLabel = label.trim();
    const linkedPage = state.project.pages.find((page) => page.name.toLowerCase() === cleanLabel.toLowerCase()) || state.project.pages[index];
    return `<a href="#/${escapeHtml(linkedPage?.slug || "index")}">${escapeHtml(cleanLabel)}</a>`;
  }).join("")}</nav>`;
  if (item.type === "button") return `<a class="site-button${effect}" href="${escapeHtml(item.href || "#")}" style="${style}">${escapeHtml(item.content)}</a>`;
  if (item.type === "image") return `<div class="site-image" style="${style}"><span>${escapeHtml(item.content || "Image")}</span></div>`;
  if (item.type === "divider") return `<hr style="${style}" />`;
  const tag = { heading: "h2", text: "p", logo: "strong", badge: "span", card: "article" }[item.type] || "div";
  const content = item.type === "card" ? escapeHtml(item.content).replace(/\n/g, "<br>") : escapeHtml(item.content);
  return `<${tag} class="element-${item.type}${effect}" style="${style}">${content}</${tag}>`;
}

function buildExportHtml() {
  const project = state.project;
  const activePage = pageFrom(project);
  const fontStack = safeFontStack(project.theme.font);
  const fontUrl = googleFontUrl(fontStack);
  const fontLinks = fontUrl
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${escapeHtml(fontUrl)}">`
    : "";
  const pages = project.pages.map((page) => `<main class="site-page" data-page="${escapeHtml(page.slug)}" aria-label="Page ${escapeHtml(page.name)}">${page.sections.map((section) => `<section class="section-${escapeHtml(section.type)}" style="${cssFromStyles(section.styles, true)}">${section.children.map(elementHtml).join("\n")}</section>`).join("\n")}</main>`).join("\n");
  return `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(state.brief || project.name)}"><title>${escapeHtml(activePage.name)} — ${escapeHtml(project.name)}</title>
${fontLinks}
<style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:${project.theme.text};background:${project.theme.background};font-family:${fontStack}}.site-page{display:none}.site-page.active{display:block}section>*{margin-top:0;margin-bottom:0}.nav-links{display:flex;gap:24px}.nav-links a{color:inherit;text-decoration:none}.site-button{display:inline-block;text-decoration:none;transition:.2s}.effect-lift:hover{transform:translateY(-4px);box-shadow:0 12px 28px #17181c2b}.effect-scale:hover{transform:scale(1.06)}.effect-glow:hover{box-shadow:0 0 0 5px ${project.theme.accent}30,0 10px 30px ${project.theme.accent}45}.site-image{min-height:260px;display:grid;place-items:center;background:linear-gradient(135deg,${project.theme.soft || project.theme.surface},${project.theme.surface})}hr{width:100%;border:0;border-top:1px solid ${project.theme.muted}}.section-features>.element-heading{grid-column:1/-1}.element-card{white-space:normal;line-height:1.6}
@media(max-width:700px){section{padding-left:24px!important;padding-right:24px!important}.section-navbar .nav-links{display:none}section[style*="flex-direction:row"]{flex-direction:column!important}section[style*="grid-template-columns"]{grid-template-columns:1fr!important}h2{font-size:clamp(28px,10vw,42px)!important}}
</style></head><body>${pages}<script>
const pageNames=${JSON.stringify(Object.fromEntries(project.pages.map((page) => [page.slug, page.name])))};
function showPage(){const slug=location.hash.replace(/^#\//,"")||${JSON.stringify(activePage.slug)};const target=document.querySelector('[data-page="'+CSS.escape(slug)+'"]')||document.querySelector('.site-page');document.querySelectorAll('.site-page').forEach(page=>page.classList.toggle('active',page===target));document.title=(pageNames[target.dataset.page]||${JSON.stringify(project.name)})+' — '+${JSON.stringify(project.name)};scrollTo(0,0)}
addEventListener('hashchange',showPage);showPage();
</script></body></html>`;
}

function previewSite() {
  if (!state.project) return;
  $("#previewFrame").srcdoc = buildExportHtml();
  previewDialog.showModal();
}

function exportSite() {
  if (!state.project) return;
  const blob = new Blob([buildExportHtml()], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site"}.html`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast("Site créé", "Le fichier HTML autonome a été téléchargé.");
}

async function checkLmStudio() {
  try {
    const response = await fetch("/api/health");
    const { lmStudio, mistralVibe, antigravity } = await response.json();
    const select = $("#modelSelect");
    const previous = state.selectedModel || localStorage.getItem("atelier-ai-model") || "";
    select.replaceChildren();
    const automatic = document.createElement("option");
    automatic.value = "";
    automatic.textContent = "Automatique";
    select.append(automatic);
    if (mistralVibe?.available) {
      const option = document.createElement("option");
      option.value = mistralVibe.model;
      option.textContent = "Mistral Vibe Online";
      option.title = "Service cloud Mistral — peut consommer votre quota Vibe";
      select.append(option);
    }
    if (antigravity?.available && antigravity.models?.length) {
      const group = document.createElement("optgroup");
      group.label = "Antigravity CLI";
      antigravity.models.forEach((model) => {
        const option = document.createElement("option");
        option.value = model.id;
        option.textContent = model.name;
        option.title = `Antigravity CLI — ${model.name}`;
        group.append(option);
      });
      select.append(group);
    }
    lmStudio.models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.name || model.id;
      option.title = model.id;
      select.append(option);
    });
    const availableIds = new Set(lmStudio.models.map((model) => model.id));
    if (mistralVibe?.available) availableIds.add(mistralVibe.model);
    antigravity?.models?.forEach((model) => availableIds.add(model.id));
    state.selectedModel = availableIds.has(previous) ? previous : "";
    select.value = state.selectedModel;
    const hasProvider = Boolean(antigravity?.available || mistralVibe?.available || lmStudio.connected);
    select.disabled = !hasProvider;
    $("#aiStatusDot").className = `status-dot ${hasProvider ? "connected" : "offline"}`;
    $("#aiStatusTitle").textContent = antigravity?.available ? "Antigravity CLI disponible" : mistralVibe?.available ? "Mistral Vibe disponible" : lmStudio.connected ? "LM Studio connecté" : "Mode local de secours";
    const providers = [];
    if (antigravity?.available) providers.push(`${antigravity.models.length} modèle(s) Antigravity`);
    if (mistralVibe?.available) providers.push("Vibe en ligne");
    if (lmStudio.connected) providers.push(`${lmStudio.models.length} modèle(s) local(aux)`);
    $("#aiStatusText").textContent = providers.length ? providers.join(" + ") : "Démarrez LM Studio, Antigravity ou Vibe";
  } catch {
    $("#modelSelect").disabled = true;
    $("#aiStatusDot").className = "status-dot offline";
    $("#aiStatusTitle").textContent = "Serveur indisponible";
    $("#aiStatusText").textContent = "Relancez l’application locale";
  }
}

function renderChat() {
  const container = $("#chatMessages");
  container.replaceChildren();
  if (!state.chatHistory.length) {
    appendChatMessage("assistant", "Bonjour. Demandez-moi de modifier une page, un contenu ou le style du site. Je peux aussi simplement vous conseiller.", container);
  } else {
    state.chatHistory.forEach((message) => appendChatMessage(message.role, message.content, container));
  }
  container.scrollTop = container.scrollHeight;
}

function appendChatMessage(role, content, container = $("#chatMessages"), extraClass = "") {
  const message = document.createElement("div");
  message.className = `chat-message ${role}${extraClass ? ` ${extraClass}` : ""}`;
  if (role === "assistant") {
    const avatar = document.createElement("span");
    avatar.className = "message-avatar";
    avatar.textContent = "✦";
    message.append(avatar);
  }
  const bubble = document.createElement("div");
  bubble.textContent = content;
  message.append(bubble);
  container.append(message);
  container.scrollTop = container.scrollHeight;
  return message;
}

function toggleChat(open) {
  const drawer = $("#chatDrawer");
  const shouldOpen = open ?? !drawer.classList.contains("open");
  drawer.classList.toggle("open", shouldOpen);
  drawer.setAttribute("aria-hidden", String(!shouldOpen));
  state.chatOpen = shouldOpen;
  if (state.project) saveWorkspace();
  if (shouldOpen) setTimeout(() => $("#chatInput").focus(), 220);
}

async function sendChatMessage(message) {
  if (!message || !state.project) return;
  state.chatHistory.push({ role: "user", content: message });
  renderChat();
  const thinking = appendChatMessage("assistant", "J'analyse votre demande et le site...", $("#chatMessages"), "thinking");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, history: state.chatHistory.slice(0, -1), project: state.project, currentPageId: state.currentPageId, model: state.selectedModel || undefined })
    });
    if (!response.ok) throw new Error("Le conseiller IA ne répond pas");
    const payload = await response.json();
    if (payload.changed && payload.project) {
      const previousPageId = state.currentPageId;
      state.history.push(clone(state.project));
      if (state.history.length > 50) state.history.shift();
      state.future = [];
      state.project = payload.project;
      state.currentPageId = state.project.pages.some((page) => page.id === previousPageId) ? previousPageId : state.project.pages[0]?.id;
      state.selectedId = null;
      showToast("Site modifié par l'assistant", "Vous pouvez annuler la modification depuis la barre supérieure.");
    }
    state.chatHistory.push({ role: "assistant", content: payload.answer });
    saveProject();
    renderAll();
    renderChat();
  } catch (error) {
    thinking.remove();
    state.chatHistory.push({ role: "assistant", content: `Je n’ai pas pu répondre : ${error.message}` });
    renderChat();
  }
}

function bindEvents() {
  $("#appThemeButton").addEventListener("click", cycleUiTheme);
  $("#welcomeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentInput = $(onboardingInputs[state.onboardingStep]);
    if (!currentInput.value.trim()) {
      currentInput.focus();
      currentInput.setCustomValidity("Décrivez ce que vous imaginez pour continuer.");
      currentInput.reportValidity();
      currentInput.setCustomValidity("");
      return;
    }
    const part = onboardingParts[state.onboardingStep];
    const generated = await generateOnboardingPart(part, currentInput.value.trim());
    if (!generated) return;
    if (state.onboardingStep < onboardingInputs.length - 1) {
      setOnboardingStep(state.onboardingStep + 1);
      return;
    }
    const descriptions = Object.fromEntries(onboardingParts.map((name, index) => [name, $(onboardingInputs[index]).value.trim()]));
    state.project = state.onboardingDraft;
    state.currentPageId = state.project.pages[0]?.id || null;
    state.selectedId = null;
    state.history = [];
    state.future = [];
    state.brief = onboardingParts.map((name) => `${name}: ${descriptions[name]}`).join("\n");
    saveProject();
    renderAll();
    welcomeDialog.close();
    showToast("Site construit en direct", "Chaque région respecte la composition choisie et reste modifiable.");
  });
  $("#onboardingBack").addEventListener("click", () => setOnboardingStep(state.onboardingStep - 1));
  $$("[data-onboarding-go]").forEach((button) => button.addEventListener("click", () => setOnboardingStep(number(button.dataset.onboardingGo))));
  $("#skipWelcome").addEventListener("click", async () => {
    welcomeDialog.close();
    await generateStagedProject({
      header: "Un studio créatif avec un logo simple, une navigation courte et un hero qui présente clairement son savoir-faire.",
      main: "Une sélection de projets, trois services, une méthode de travail rassurante et un appel à demander un devis.",
      footer: "Un pied de page sobre avec l'e-mail, les réseaux sociaux et les mentions légales."
    });
  });
  $("#projectName").addEventListener("change", (event) => commit((project) => { project.name = event.target.value.trim() || "Sans titre"; }));
  $("#modelSelect").addEventListener("change", (event) => {
    state.selectedModel = event.target.value;
    localStorage.setItem("atelier-ai-model", state.selectedModel);
    const label = event.target.selectedOptions[0]?.textContent || "Automatique";
    showToast("Modèle IA sélectionné", label);
  });
  $("#fontSelect").addEventListener("change", (event) => {
    if (!state.project) return;
    const fontStack = safeFontStack(event.target.value);
    const font = FONT_BY_STACK.get(fontStack);
    commit((project) => { project.theme.font = fontStack; });
    showToast("Typographie mise à jour", `${font.label} est appliquée à tout le site.`);
  });
  $("#resetProjectButton").addEventListener("click", resetProject);
  $("#undoButton").addEventListener("click", () => { if (!state.history.length || !state.project) return; state.future.push(clone(state.project)); state.project = state.history.pop(); saveProject(); renderAll(); });
  $("#redoButton").addEventListener("click", () => { if (!state.future.length || !state.project) return; state.history.push(clone(state.project)); state.project = state.future.pop(); saveProject(); renderAll(); });
  $("#previewButton").addEventListener("click", previewSite);
  $("#closePreview").addEventListener("click", () => previewDialog.close());
  $("#exportButton").addEventListener("click", exportSite);
  $("#openExportFromPreview").addEventListener("click", exportSite);
  $("#clearSelection").addEventListener("click", clearSelection);
  $("#generateElementButton").addEventListener("click", async () => {
    const instruction = $("#elementPrompt").value.trim();
    if (!instruction || !state.selectedId) return;
    await editSelectedWithAi(instruction);
    $("#elementPrompt").value = "";
  });
  $("#elementPrompt").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); $("#generateElementButton").click(); } });
  $$("[data-viewport]").forEach((button) => button.addEventListener("click", () => { state.viewport = button.dataset.viewport; saveWorkspace(); renderAll(); }));
  $("#zoomOut").addEventListener("click", () => { state.zoom = clamp(state.zoom - .1, .3, 1.2); saveWorkspace(); renderAll(); });
  $("#zoomIn").addEventListener("click", () => { state.zoom = clamp(state.zoom + .1, .3, 1.2); saveWorkspace(); renderAll(); });
  $$("[data-left-tab]").forEach((button) => button.addEventListener("click", () => {
    state.leftTab = button.dataset.leftTab;
    $$("[data-left-tab]").forEach((item) => { item.classList.toggle("active", item === button); item.setAttribute("aria-selected", String(item === button)); });
    $("#layersPanel").classList.toggle("hidden", button.dataset.leftTab !== "layers");
    $("#insertPanel").classList.toggle("hidden", button.dataset.leftTab !== "insert");
    saveWorkspace();
  }));
  $$("[data-add-type]").forEach((button) => button.addEventListener("click", () => addElement(button.dataset.addType)));
  $("#addPageButton").addEventListener("click", () => {
    $("#pageNameInput").value = "";
    $("#pageDescriptionInput").value = "";
    $("#pageDialog").showModal();
    setTimeout(() => $("#pageNameInput").focus(), 50);
  });
  $("#pageForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#pageNameInput").value.trim();
    if (!name) return;
    createPage(name, $("#pageDescriptionInput").value.trim());
    $("#pageDialog").close();
  });
  $("#closePageDialog").addEventListener("click", () => $("#pageDialog").close());
  $("#cancelPageButton").addEventListener("click", () => $("#pageDialog").close());
  $("#addSectionButton").addEventListener("click", addSection);
  $$(".section-heading").forEach((button) => button.addEventListener("click", () => button.classList.toggle("expanded")));

  const bindings = [
    ["#contentInput", "content", "string", "root"], ["#hrefInput", "href", "string", "root"],
    ["#widthInput", "width", "number"], ["#fontSizeInput", "fontSize", "number"], ["#radiusInput", "borderRadius", "number"], ["#gapInput", "gap", "number"],
    ["#effectInput", "effect", "string", "root"]
  ];
  bindings.forEach(([selector, property, valueType, root]) => $(selector).addEventListener("change", (event) => updateSelected(property, valueType === "number" && event.target.value !== "" ? number(event.target.value) : event.target.value, root === "root" ? "root" : "styles")));
  [["#textColorInput", "#textColorHex", "color"], ["#backgroundInput", "#backgroundHex", "background"]].forEach(([pickerSelector, hexSelector, property]) => {
    $(pickerSelector).addEventListener("change", (event) => { $(hexSelector).value = event.target.value; updateSelected(property, event.target.value); });
    $(hexSelector).addEventListener("change", (event) => { const color = safeColor(event.target.value, $(pickerSelector).value); event.target.value = color; $(pickerSelector).value = color; updateSelected(property, color); });
  });
  $$("[data-align]").forEach((button) => button.addEventListener("click", () => updateSelected("textAlign", button.dataset.align)));
  $("#moveUpButton").addEventListener("click", () => moveSelected(-1));
  $("#moveDownButton").addEventListener("click", () => moveSelected(1));
  $("#duplicateButton").addEventListener("click", duplicateSelected);
  $("#deleteButton").addEventListener("click", deleteSelected);
  $("#layersToggle").addEventListener("click", () => $("#leftPanel").classList.toggle("open"));
  $("#closeInspector").addEventListener("click", () => $("#rightPanel").classList.remove("open"));
  $("#chatToggleButton").addEventListener("click", () => toggleChat());
  $("#closeChatButton").addEventListener("click", () => toggleChat(false));
  let scrollSaveTimer;
  $("#canvasScroller").addEventListener("scroll", (event) => {
    state.canvasScrollLeft = event.currentTarget.scrollLeft;
    state.canvasScrollTop = event.currentTarget.scrollTop;
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(saveWorkspace, 120);
  });
  window.addEventListener("pagehide", () => {
    clearTimeout(scrollSaveTimer);
    if (state.project) saveWorkspace();
  });
  $("#chatForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("#chatInput");
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    await sendChatMessage(message);
  });
  $$("#chatSuggestions button").forEach((button) => button.addEventListener("click", () => {
    $("#chatInput").value = button.textContent;
    $("#chatForm").requestSubmit();
  }));
  document.addEventListener("keydown", (event) => {
    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === "z" && !event.shiftKey) { event.preventDefault(); $("#undoButton").click(); }
    if (modifier && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))) { event.preventDefault(); $("#redoButton").click(); }
    if ((event.key === "Delete" || event.key === "Backspace") && state.selectedId && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) deleteSelected();
  });
}

function init() {
  applyUiTheme(localStorage.getItem("atelier-ai-ui-theme") || document.documentElement.dataset.uiTheme || "light", false);
  populateFontSelect();
  bindEvents();
  checkLmStudio();
  const savedProject = readStoredJson("atelier-ai-project", null);
  if (savedProject) {
    try {
      state.project = migrateProject(savedProject);
      state.brief = localStorage.getItem("atelier-ai-brief") || "";
      state.currentPageId = localStorage.getItem("atelier-ai-current-page") || state.project.pages[0]?.id || null;
      state.chatHistory = readStoredJson("atelier-ai-chat", []);
      state.selectedModel = localStorage.getItem("atelier-ai-model") || "";
      const workspace = readStoredJson("atelier-ai-workspace", {});
      state.currentPageId = workspace.currentPageId || state.currentPageId;
      state.selectedId = typeof workspace.selectedId === "string" ? workspace.selectedId : null;
      state.viewport = ["desktop", "tablet", "mobile"].includes(workspace.viewport) ? workspace.viewport : state.viewport;
      state.zoom = clamp(number(workspace.zoom, state.zoom), .3, 1.2);
      state.leftTab = ["layers", "insert"].includes(workspace.leftTab) ? workspace.leftTab : state.leftTab;
      state.chatOpen = workspace.chatOpen === true;
      state.canvasScrollLeft = Math.max(0, number(workspace.canvasScrollLeft));
      state.canvasScrollTop = Math.max(0, number(workspace.canvasScrollTop));
    } catch { localStorage.removeItem("atelier-ai-project"); }
  }
  renderAll();
  renderChat();
  renderOnboardingPreview();
  setOnboardingStep(0, false);
  const activeTab = $(`[data-left-tab="${state.leftTab}"]`);
  if (activeTab) activeTab.click();
  toggleChat(state.project && state.chatOpen);
  requestAnimationFrame(() => {
    $("#canvasScroller").scrollTo({ left: state.canvasScrollLeft, top: state.canvasScrollTop });
  });
  if (!state.project) {
    welcomeDialog.showModal();
    setTimeout(() => $(onboardingInputs[0]).focus(), 80);
  }
}

init();
