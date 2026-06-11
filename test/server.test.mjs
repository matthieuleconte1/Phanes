import test from "node:test";
import assert from "node:assert/strict";
import { applyGeneratedPart, assistantContent, createFallbackPart, createFallbackProject, generatedPartIssues, nativeAssistantContent, normalizeAssistantProject, normalizeGeneratedPart, normalizeProject } from "../server.mjs";
import { readFile } from "node:fs/promises";

test("fallback creates a complete editable project", () => {
  const project = createFallbackProject("un restaurant chaleureux");
  assert.equal(project.version, 2);
  assert.ok(project.pages[0].sections.length >= 4);
  assert.ok(project.pages[0].sections.every((section) => section.id && section.children.length));
  assert.match(project.name, /restaurant/);
  assert.equal(project.theme.radius, 4);
  assert.ok(project.pages[0].sections.flatMap((section) => section.children).every((item) => item.effect !== "lift" && item.effect !== "glow"));
});

test("editor exposes a persistent global interface theme button", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="appThemeButton"/);
  assert.match(html, /atelier-ai-ui-theme/);
  assert.match(app, /const UI_THEMES/);
  assert.match(app, /Charcoal/);
  assert.match(app, /Celestial Blue/);
  assert.match(app, /function cycleUiTheme/);
});

test("editor exposes Antigravity CLI as an AI provider", async () => {
  const [serverSource, appSource] = await Promise.all([
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8")
  ]);
  assert.match(serverSource, /ANTIGRAVITY_COMMAND/);
  assert.match(serverSource, /async function runAntigravity/);
  assert.match(serverSource, /--print-timeout/);
  assert.match(serverSource, /--sandbox/);
  assert.match(appSource, /Antigravity CLI/);
  assert.match(appSource, /payload\.source === "antigravity"/);
});

test("normalization migrates legacy single-page projects", () => {
  const project = normalizeProject({
    name: "Test",
    theme: {},
    page: { name: "Accueil", sections: [{ type: "hero", styles: {}, children: [{ type: "unknown", content: "Bonjour", styles: {} }] }] }
  });
  assert.equal(project.name, "Test");
  assert.equal(project.version, 2);
  assert.equal(project.pages.length, 1);
  assert.equal(project.pages[0].slug, "index");
  assert.equal(project.pages[0].sections[0].children[0].type, "text");
  assert.ok(project.pages[0].sections[0].id);
  assert.ok(project.pages[0].sections[0].children[0].id);
});

test("normalization keeps multiple pages and generates unique page records", () => {
  const project = normalizeProject({ name: "Site", pages: [
    { name: "Accueil", sections: [] },
    { name: "À propos", sections: [] }
  ] });
  assert.equal(project.pages.length, 2);
  assert.equal(project.pages[0].slug, "index");
  assert.equal(project.pages[1].slug, "a-propos");
  assert.notEqual(project.pages[0].id, project.pages[1].id);
});

test("staged generation replaces only the requested site region", () => {
  const original = createFallbackProject("un portfolio");
  const originalHeaderIds = original.pages[0].sections.filter((item) => ["navbar", "hero"].includes(item.type)).map((item) => item.id);
  const originalFooterIds = original.pages[0].sections.filter((item) => item.type === "footer").map((item) => item.id);
  const generatedMain = createFallbackPart("des projets et des témoignages", "main", "un portfolio");
  const result = applyGeneratedPart(original, generatedMain, "main", "un portfolio");

  assert.deepEqual(result.pages[0].sections.filter((item) => ["navbar", "hero"].includes(item.type)).map((item) => item.id), originalHeaderIds);
  assert.deepEqual(result.pages[0].sections.filter((item) => item.type === "footer").map((item) => item.id), originalFooterIds);
  assert.ok(result.pages[0].sections.some((item) => ["features", "content", "cta"].includes(item.type)));
  assert.equal(result.pages[0].sections[0].type, "navbar");
  assert.equal(result.pages[0].sections.at(-1).type, "footer");
});

test("fallback generation honors different onboarding layout controls", () => {
  const splitHeader = createFallbackPart("un accueil visuel", "header", "portfolio", { layout: "split", density: "airy", creative: true });
  const minimalHeader = createFallbackPart("un accueil simple", "header", "portfolio", { layout: "minimal", density: "compact" });
  const alternatingMain = createFallbackPart("présenter deux projets", "main", "portfolio", { layout: "alternating", density: "balanced" });
  const ctaFooter = createFallbackPart("inviter au contact", "footer", "portfolio", { layout: "cta", density: "airy" });

  assert.equal(splitHeader.sections.find((item) => item.type === "hero").styles.layout, "grid");
  assert.ok(splitHeader.sections.find((item) => item.type === "hero").children.some((item) => item.type === "image"));
  assert.ok(minimalHeader.sections.find((item) => item.type === "hero").children.length < splitHeader.sections.find((item) => item.type === "hero").children.length);
  assert.equal(alternatingMain.sections.length, 2);
  assert.ok(alternatingMain.sections.every((item) => item.styles.layout === "grid"));
  assert.equal(ctaFooter.sections[0].children[0].type, "heading");
  assert.equal(ctaFooter.sections[0].styles.layout, "column");
});

test("Mistral-style aliases and incomplete elements are repaired", () => {
  const repaired = normalizeGeneratedPart({
    name: "Studio",
    theme: {},
    sections: [{
      type: "navigation",
      styles: { display: "flex", justifyContent: "space-between", padding: "2rem 4rem" },
      elements: [
        { type: "brand", text: "Studio", styles: { "font-size": "1.8rem" } },
        { type: "menu", text: "Accueil Portfolio À propos Contact", styles: {} }
      ]
    }, {
      type: "header",
      styles: { layout: "grid", gridTemplateColumns: "500 1fr", minHeight: "70vh", padding: "0 4rem" },
      elements: [
        { type: "title", text: "Créer autrement", styles: { "font-size": "4rem", lineHeight: 110 } },
        { type: "paragraph", text: "Une présentation concrète du studio.", styles: {} },
        { type: "cta", label: "Voir les projets", href: "#projets", styles: {} },
        { type: "visual", content: "Portrait du studio", styles: { "min-height": "500px" } }
      ]
    }]
  }, "header", "portfolio", { layout: "split", density: "balanced", creative: true });

  assert.deepEqual(repaired.sections.map((item) => item.type), ["navbar", "hero"]);
  assert.ok(repaired.sections[0].children.some((item) => item.type === "logo"));
  assert.ok(repaired.sections[0].children.some((item) => item.type === "nav"));
  assert.equal(repaired.sections[0].styles.layout, "row");
  assert.equal(repaired.sections[0].children.find((item) => item.type === "nav").content, "Accueil|Portfolio|À propos|Contact");
  assert.equal(repaired.sections[0].styles.paddingX, 64);
  assert.equal(repaired.sections[1].styles.layout, "grid");
  assert.equal(repaired.sections[1].styles.gridTemplateColumns, "500px 1fr");
  assert.ok(repaired.sections[1].children.some((item) => item.type === "heading" && item.content === "Créer autrement"));
  assert.ok(repaired.sections[1].children.some((item) => item.type === "image"));
  assert.equal(repaired.sections[1].children.find((item) => item.type === "heading").styles.fontSize, 64);
  assert.equal(repaired.sections[1].children.find((item) => item.type === "heading").styles.lineHeight, "110px");
  assert.equal(repaired.sections[1].children.find((item) => item.type === "image").styles.minHeight, 500);
});

test("incomplete Mistral regions are detected before local repair", () => {
  const issues = generatedPartIssues({
    sections: [{ type: "header", children: [
      { type: "logo", content: "Studio", styles: {} },
      { type: "nav", content: "Accueil|Contact", styles: {} }
    ] }]
  }, "header", { layout: "editorial" });

  assert.ok(issues.includes("élément heading manquant"));
  assert.ok(issues.includes("élément text manquant"));
  assert.ok(issues.includes("élément button manquant"));
  assert.ok(issues.includes("image principale manquante"));
});

test("assistant content reads a normal LM Studio response", () => {
  assert.equal(assistantContent({ choices: [{ message: { content: " Bonjour ! " }, finish_reason: "stop" }] }), "Bonjour !");
});

test("assistant content identifies Qwen reasoning-only truncation", () => {
  assert.throws(
    () => assistantContent({ choices: [{ message: { content: "", reasoning_content: "Long raisonnement" }, finish_reason: "length" }] }),
    /toute la réponse pour réfléchir/
  );
});

test("native LM Studio chat extracts the final message", () => {
  assert.equal(nativeAssistantContent({
    output: [{ type: "reasoning", content: "hidden" }, { type: "message", content: "Bonjour !" }],
    stats: { reasoning_output_tokens: 0 }
  }), "Bonjour !");
});

test("assistant project edits report whether the site changed", () => {
  const original = createFallbackProject("un studio créatif");
  const unchanged = normalizeAssistantProject({ answer: "Aucun changement", project: original }, original);
  assert.equal(unchanged.changed, false);

  const edited = structuredClone(original);
  edited.pages[0].sections[1].children[1].content = "Nouveau contenu";
  const result = normalizeAssistantProject({ answer: "Contenu modifié", project: edited }, original);
  assert.equal(result.changed, true);
  assert.equal(result.project.pages[0].sections[1].children[1].content, "Nouveau contenu");
});

test("assistant project edits reject incomplete AI output", () => {
  assert.throws(() => normalizeAssistantProject({ answer: "Terminé" }, createFallbackProject()), /projet valide/);
});

test("assistant project edits accept a direct complete project response", () => {
  const original = createFallbackProject("un studio créatif");
  const edited = structuredClone(original);
  edited.pages[0].sections[1].children[1].content = "Titre direct";
  const result = normalizeAssistantProject(edited, original, "Change le titre");
  assert.equal(result.changed, true);
  assert.equal(result.project.pages[0].sections[1].children[1].content, "Titre direct");
});

test("assistant accepts a new page for the exact French request 'fait la page'", () => {
  const original = createFallbackProject("un studio créatif");
  const edited = structuredClone(original);
  edited.pages.push({
    id: "page-mentions-legales",
    name: "Mentions légales",
    slug: "mentions-legales",
    sections: [{
      id: "section-mentions-legales",
      type: "content",
      styles: { layout: "column", paddingY: 60, paddingX: 40 },
      children: [{ id: "heading-mentions-legales", type: "heading", content: "Mentions légales", styles: { fontSize: 42 } }]
    }]
  });
  const result = normalizeAssistantProject(
    { answer: "Page de mentions légales ajoutée.", project: edited },
    original,
    "fait : la page de mentions légales"
  );
  assert.equal(result.changed, true);
  assert.equal(result.project.pages.length, 2);
  assert.equal(result.project.pages[1].slug, "mentions-legales");
});

test("assistant project edits reject an unsolicited site replacement", () => {
  const original = createFallbackProject("un studio créatif");
  const replacement = createFallbackProject("un restaurant");
  assert.throws(
    () => normalizeAssistantProject({ answer: "Terminé", project: replacement }, original, "Change uniquement le titre"),
    /remplacer une trop grande partie|ajouté des composants/
  );
});
