import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyGeneratedPart,
  assistantProjectSchema,
  createFallbackPart,
  createFallbackProject,
  elementSchema,
  ensureElement,
  generatedPartIssues,
  generatedPartSchema,
  nodeForAi,
  normalizeGeneratedPart,
  normalizeProject,
  projectForAi,
  projectSchema,
  restoreEditedNodeAsset,
  restoreLocalImageAssets
} from "./src/server/project.mjs";
import { agentProvider, antigravityStatus, mistralVibeStatus } from "./src/server/providers.mjs";

export {
  applyGeneratedPart,
  createFallbackPart,
  createFallbackProject,
  generatedPartIssues,
  normalizeGeneratedPart,
  normalizeProject
};

const ROOT = fileURLToPath(new URL("./public", import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://127.0.0.1:1234";
const CUSTOM_COMPONENT_INSTRUCTIONS = `Les types logo, nav, badge, heading, text, button, image et divider sont des primitives simples éditables visuellement.
Pour tout composant plus riche, utilise par défaut type custom avec content, html, css et js: cartes composées, grilles de services, bento, témoignages, chiffres clés, tarifs, formulaires, FAQ, onglets, accordéons, galeries, timelines, dashboards, animations et décors. N'aplatis pas ces composants en une suite de card/text standards.
Le champ html contient uniquement le balisage du composant, sans document complet, balise style ou balise script. Le CSS est libre, local au bloc et doit inclure son responsive avec @media. Le JavaScript peut être vide si le bloc est statique; sinon il reçoit root (ShadowRoot du bloc) et host (conteneur) et cible le composant avec root.querySelector. N'utilise aucun import, accès au parent, document global ou stockage sensible. Ajoute des états focus visibles, respecte prefers-reduced-motion et utilise du HTML accessible.`;
const CREATIVE_DESIGN_INSTRUCTIONS = `Produis une interface visuellement aboutie, pas un wireframe basse fidélité. Déduis une direction artistique cohérente du brief: palette expressive, typographie hiérarchisée, contrastes, espaces, formes, bordures, ombres, dégradés, textures CSS, micro-interactions et asymétrie lorsqu'ils servent le projet. Évite les suites génériques de trois cartes identiques et donne à chaque région une composition identifiable. Le résultat doit rester responsive, lisible et accessible.`;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
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

async function generateWithAgentCli({ brief, instruction }, runPrompt) {
  const prompt = `Tu es un directeur artistique et développeur front-end autonome. Interprète librement la demande et crée un site multipage abouti en JSON: ${brief || "site web"}.
Instruction complémentaire: ${instruction || "aucune"}.

Tu décides de l'architecture utile: nombre de pages, ordre des sections, hiérarchie, messages et appels à l'action. Ne reproduis pas automatiquement un modèle navbar/hero/cartes/CTA si le besoin appelle une autre structure. Privilégie les choix pertinents pour le public et l'objectif implicites du brief.

Retourne UNIQUEMENT un objet JSON valide, sans markdown ni explication, avec exactement cette structure générale:
{"name":"Nom","theme":{"background":"#hex","surface":"#hex","text":"#hex","muted":"#hex","accent":"#hex","font":"Inter, system-ui, sans-serif","radius":20},"pages":[{"id":"page-id","name":"Accueil","slug":"index","sections":[{"id":"section-id","type":"navbar|hero|features|content|cta|footer","styles":{"layout":"row|column|grid|free","paddingY":20,"paddingX":40,"gap":16,"background":"#hex","align":"center","justify":"between","columns":3,"freeHeight":700},"children":[{"id":"element-id","type":"logo|nav|badge|heading|text|button|card|image|divider|custom","content":"Description française","styles":{"fontSize":18,"fontWeight":700,"color":"#hex","background":"#hex","borderRadius":12,"paddingY":12,"paddingX":20,"textAlign":"center","x":10,"y":80,"width":400,"zIndex":1},"href":"#facultatif","effect":"lift|scale|glow|none","src":"URL facultative pour image","alt":"description accessible","html":"requis pour custom","css":"requis pour custom","js":"requis pour custom"}]}]}]}.

${CREATIVE_DESIGN_INSTRUCTIONS}
${CUSTOM_COMPONENT_INSTRUCTIONS}
Le contenu français doit être concret, sans lorem ipsum. Utilise des identifiants uniques, le slug index pour la première page et uniquement les pages et sections réellement utiles (maximum 6 pages).`;
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
    ? "Utilise une composition audacieuse, asymétrique et inattendue. Ne reproduis pas automatiquement navbar + hero centré + trois cartes + CTA."
    : "Garde une composition claire, mais donne-lui une vraie identité visuelle adaptée au brief.";
  return `Génère uniquement ${partLabels[part]} d'un site web abouti en français.

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
- Chaque section doit avoir un tableau children non vide. Le HTML et le CSS libres sont placés uniquement dans un enfant type custom, jamais directement à la racine d'une section.
- Chaque enfant est un objet indépendant avec id, type, content et styles. content doit être une chaîne visible et concrète, sauf divider.
- Les primitives simples restent structurées. Les compositions avancées sont des enfants type custom avec html, css et js, même lorsqu'elles sont statiques.
- Pour une image distante connue, utilise src avec une URL HTTP ou HTTPS et alt avec une description accessible. N'invente pas d'URL si aucune source précise n'est disponible.
- Utilise uniquement ces noms de styles structurés: layout, columns, gridTemplateColumns, paddingY, paddingX, gap, background, align, justify, fontSize, fontWeight, color, lineHeight, maxWidth, minHeight, width, borderRadius, textAlign, gridColumn, x, y, zIndex, freeHeight. Pour une section libre, utilise layout free, freeHeight sur la section, puis x en pourcentage et y en pixels sur chaque enfant.
- Pour fontSize, paddingY, paddingX, gap, maxWidth, minHeight et borderRadius, utilise des NOMBRES en pixels sans "px", "rem" ou "vh". Exemple: fontSize: 64, paddingY: 80.
- Pour une navigation, sépare toujours les libellés par le caractère |. Exemple: "Accueil|Portfolio|À propos|Contact".
- Header: garde la navbar en primitives logo + nav. Le hero peut utiliser les primitives simples ou un custom complet pour une composition avancée.
- Main: crée au moins un bloc custom riche. Utilise les primitives seulement pour les titres, textes, boutons et images isolés.
- Footer: un footer minimal peut rester en primitives; un footer riche en colonnes ou avec interaction doit être custom.

${CUSTOM_COMPONENT_INSTRUCTIONS}
${CREATIVE_DESIGN_INSTRUCTIONS}
Retourne un objet JSON avec exactement les clés name, theme et sections. Chaque section contient id, type, styles et children. Chaque enfant contient id, type, content et styles, avec href et effect seulement si utiles, ou html, css et js pour custom. Types d'éléments autorisés: logo, nav, badge, heading, text, button, card, image, divider, custom. Utilise des identifiants uniques et un contenu concret sans lorem ipsum.`;
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
  const safeNode = nodeForAi(node);
  const prompt = `Tu modifies UNIQUEMENT le composant JSON fourni selon la demande.
Tu ne connais pas le reste du site. Conserve EXACTEMENT son id et son type. Ne supprime aucun champ utile.
Styles autorisés: ${[...allowedStyleKeys].join(", ")}.
${node.type === "custom" || node.children?.some((child) => child.type === "custom") ? CUSTOM_COMPONENT_INSTRUCTIONS : ""}
Retourne UNIQUEMENT le JSON complet du composant modifié, sans markdown ni explication.

DEMANDE:
${instruction}

COMPOSANT (${kind}):
${JSON.stringify(safeNode)}`;
  const output = await runPrompt(prompt, { maxTokens: kind === "section" ? 3500 : 1400, maxPrice: kind === "section" ? 0.12 : 0.06, timeoutMs: 180000 });
  return lockEditedNode(restoreEditedNodeAsset(parseJsonContent(output), node), node, kind);
}

async function chatWithAgentCli({ message, history = [], project, currentPageId }, runPrompt) {
  const transcript = history.slice(-8)
    .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .map((item) => `${item.role === "user" ? "Utilisateur" : "Assistant"}: ${item.content.slice(0, 1600)}`)
    .join("\n");
  const normalized = normalizeProject(project);
  const prompt = `Tu es l'assistant d'édition et développeur front-end d'un constructeur de sites. Réponds en français et applique directement au projet les modifications demandées par l'utilisateur.
${CUSTOM_COMPONENT_INSTRUCTIONS}
${CREATIVE_DESIGN_INSTRUCTIONS}

Retourne UNIQUEMENT un objet JSON valide sous la forme {"answer":"réponse courte","project":{...projet complet...}}.
Le champ project doit TOUJOURS contenir la copie complète du projet fourni: name, theme, toutes les pages, toutes les sections et tous les enfants. Ne renvoie jamais un patch ou seulement les champs modifiés.
Si le message est une question, un conseil ou une salutation sans demande de modification, conserve le projet strictement identique. Si c'est une demande d'édition, modifie uniquement ce qui est nécessaire. Conserve les id des pages, sections et éléments existants; crée des id uniques seulement pour les nouveaux objets. Ne supprime rien sans demande explicite. Pour un nouveau composant avancé, crée un custom plutôt qu'un assemblage rigide de cartes. Le projet doit rester responsive et respecter sa direction artistique actuelle. N'utilise aucun outil et ne lis aucun fichier.

${transcript ? `CONVERSATION RÉCENTE:\n${transcript}\n\n` : ""}MESSAGE:
${message}

PAGE ACTUELLE: ${currentPageId || normalized.pages[0]?.id}

PROJET COMPLET:
${JSON.stringify(projectForAi(normalized))}`;
  const candidate = parseJsonContent(await runPrompt(prompt, { maxTokens: 9000, maxPrice: 0.28, timeoutMs: 300000 }));
  return normalizeAssistantProject(restoreLocalImageAssets(candidate, normalized), normalized, message);
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
  const current = project ? `\nPROJET ACTUEL:\n${JSON.stringify(projectForAi(project))}` : "";
  const selection = selectedId ? `\nÉLÉMENT SÉLECTIONNÉ: ${selectedId}.` : "";
  const userPrompt = `Crée le projet structuré d'un site web multipage. Brief: ${brief || "site moderne"}. Instruction: ${instruction || "génère le site complet"}.${selection}${current}`;
  if (needsNativeReasoningControl(modelId)) {
    const candidate = await nativeJsonCompletion({
      model: modelId,
      systemPrompt: `Tu es un directeur artistique et développeur front-end autonome. Interprète librement le brief et choisis l'architecture, les pages, la hiérarchie et les contenus les plus pertinents. Retourne les clés name, theme et pages. Chaque page contient id, name, slug et sections. Chaque section contient id, type, styles et children. Chaque enfant contient id, type, content et styles, avec href et effect seulement si utiles. Types autorisés: logo, nav, badge, heading, text, button, card, image, divider, custom. Utilise du français précis et aucun lorem ipsum. ${CREATIVE_DESIGN_INSTRUCTIONS} ${CUSTOM_COMPONENT_INSTRUCTIONS}`,
      input: userPrompt,
      maxOutputTokens: 7000,
      temperature: 0.45
    });
    return normalizeProject(restoreLocalImageAssets(candidate, project || candidate), brief);
  }
  const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: `Tu es un directeur artistique et développeur front-end autonome. Interprète librement le brief et choisis les pages, sections, contenus et parcours les plus pertinents sans suivre un gabarit fixe. Retourne uniquement un projet JSON multipage valide. Types autorisés: logo, nav, badge, heading, text, button, card, image, divider, custom. Le contenu doit être en français, précis et sans lorem ipsum. ${CREATIVE_DESIGN_INSTRUCTIONS} ${CUSTOM_COMPONENT_INSTRUCTIONS}` },
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
  const candidate = JSON.parse(assistantContent(payload));
  return normalizeProject(restoreLocalImageAssets(candidate, project || candidate), brief);
}

const allowedStyleKeys = new Set([
  "background", "color", "fontWeight", "letterSpacing", "lineHeight", "opacity", "fontSize",
  "borderRadius", "maxWidth", "width", "paddingY", "paddingX", "textAlign", "gap", "layout",
  "columns", "align", "justify", "minHeight", "gridColumn", "gridTemplateColumns", "x", "y", "zIndex", "freeHeight"
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
  const safeNode = nodeForAi(node);
  if (needsNativeReasoningControl(modelId)) {
    const candidate = await nativeJsonCompletion({
      model: modelId,
      systemPrompt: `Tu modifies uniquement le composant JSON fourni. Tu ne connais pas le reste du site. Conserve exactement id et type. Styles autorisés: ${[...allowedStyleKeys].join(", ")}. ${node.type === "custom" || node.children?.some((child) => child.type === "custom") ? CUSTOM_COMPONENT_INSTRUCTIONS : ""}`,
      input: `DEMANDE:\n${instruction}\n\nCOMPOSANT À MODIFIER:\n${JSON.stringify(safeNode)}`,
      maxOutputTokens: kind === "section" ? 3000 : 1200
    });
    return lockEditedNode(restoreEditedNodeAsset(candidate, node), node, kind);
  }
  const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: `Tu modifies uniquement le composant JSON fourni. Tu ne connais pas le reste du site et tu ne dois rien inventer hors de ce composant. Conserve exactement son id et son type. Retourne uniquement le JSON complet du composant modifié. Styles autorisés: ${[...allowedStyleKeys].join(", ")}. ${node.type === "custom" || node.children?.some((child) => child.type === "custom") ? CUSTOM_COMPONENT_INSTRUCTIONS : ""}` },
        { role: "user", content: withoutThinking(`DEMANDE:\n${instruction}\n\nCOMPOSANT À MODIFIER:\n${JSON.stringify(safeNode)}`) }
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
  return lockEditedNode(restoreEditedNodeAsset(candidate, node), node, kind);
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
  const explicitAddition = /\b(ajout|ajoute|ajouter|cree|creer|nouveau|nouvelle|insere|inserer|genere|generer|construis|construire|fabrique|fabriquer|realise|realiser|programme|programmer|code|coder)\b/.test(instruction);
  const makeSomething = /\b(fait|fais|faire)\b[\s\S]{0,80}\b(page|section|bloc|bouton|element|composant|widget|calculateur|formulaire|animation|jeu|menu|footer|header|contenu)\b/.test(instruction);
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
  const systemPrompt = `Tu es l'assistant d'édition et développeur front-end d'un constructeur de sites. Retourne un objet JSON avec answer et project. Le champ project doit toujours être la copie COMPLETE du projet fourni avec name, theme, toutes les pages, toutes les sections et tous les enfants. Ne renvoie jamais un patch, un extrait ou seulement les champs modifiés. Applique directement les demandes de modification. Pour une question, un conseil ou une salutation sans demande d'édition, conserve le projet strictement identique. Modifie uniquement ce qui est nécessaire, conserve tous les id existants et crée des id uniques uniquement pour les nouveaux objets. Ne supprime rien sans demande explicite. Pour tout nouveau composant avancé, préfère un custom HTML/CSS/JS aux blocs rigides. Le projet doit rester responsive et respecter sa direction artistique actuelle. ${CREATIVE_DESIGN_INSTRUCTIONS} ${CUSTOM_COMPONENT_INSTRUCTIONS}`;
  const input = `${message}\n\nPAGE ACTUELLE: ${currentPageId || normalized.pages[0]?.id}\n\nPROJET COMPLET:\n${JSON.stringify(projectForAi(normalized))}`;
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
    return normalizeAssistantProject(restoreLocalImageAssets(JSON.parse(assistantContent(await response.json())), normalized), normalized, message);
  }
  const candidate = await nativeJsonCompletion({
    model: modelId,
    systemPrompt,
    input,
    maxOutputTokens: 9000,
    temperature: 0.25
  });
  return normalizeAssistantProject(restoreLocalImageAssets(candidate, normalized), normalized, message);
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
    if (length > 8_000_000) throw new Error("Corps de requête trop volumineux");
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
    console.log(`Phanès disponible sur http://127.0.0.1:${port}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer(PORT);
}
