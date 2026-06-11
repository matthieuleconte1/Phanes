import test from "node:test";
import assert from "node:assert/strict";

process.env.LM_STUDIO_URL = "http://127.0.0.1:1";
const { server } = await import("../server.mjs");

test("HTTP server serves the editor and generates a project", async (context) => {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const pageResponse = await fetch(`${baseUrl}/`);
  assert.equal(pageResponse.status, 200);
  const page = await pageResponse.text();
  assert.match(page, /Atelier AI/);
  assert.match(page, /Décrivez votre en-tête/);
  assert.match(page, /Décrivez la partie principale/);
  assert.match(page, /Décrivez votre pied de page/);
  assert.match(page, /APERÇU EN DIRECT/);
  assert.match(page, /Composition du header/);
  assert.match(page, /Composition du contenu/);
  assert.match(page, /Autoriser une composition audacieuse/);
  assert.match(page, /id="fontSelect"/);
  assert.match(page, /fonts\.googleapis\.com/);

  const appResponse = await fetch(`${baseUrl}/app.js`);
  assert.equal(appResponse.status, 200);
  const app = await appResponse.text();
  assert.match(app, /Playfair Display/);
  assert.match(app, /googleFontUrl/);
  assert.match(app, /googleFontStylesheet/);

  const generationResponse = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief: "un portfolio moderne pour une photographe" })
  });
  assert.equal(generationResponse.status, 200);
  const generation = await generationResponse.json();
  assert.equal(generation.source, "local-fallback");
  assert.ok(generation.project.pages[0].sections.length >= 4);

  const stagedResponse = await fetch(`${baseUrl}/api/generate-part`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ part: "header", description: "Un logo, un menu court et un hero éditorial", brief: "Un portfolio de photographe", controls: { layout: "split", density: "airy", creative: true } })
  });
  assert.equal(stagedResponse.status, 200);
  const staged = await stagedResponse.json();
  assert.equal(staged.part, "header");
  assert.equal(staged.source, "local-fallback");
  assert.deepEqual(staged.project.pages[0].sections.slice(0, 2).map((item) => item.type), ["navbar", "hero"]);
  assert.equal(staged.project.pages[0].sections.length, 2, "the live draft should contain only the generated region");
  assert.equal(staged.project.pages[0].sections[1].styles.layout, "grid");
  assert.ok(staged.project.pages[0].sections[1].children.some((item) => item.type === "image"));

  const button = generation.project.pages[0].sections[0].children.find((item) => item.type === "button");
  const editResponse = await fetch(`${baseUrl}/api/edit-element`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ node: button, kind: "element", instruction: "rends le bouton très arrondi et bleu" })
  });
  assert.equal(editResponse.status, 200);
  const edit = await editResponse.json();
  assert.equal(edit.node.id, button.id);
  assert.equal(edit.node.type, "button");
  assert.equal(edit.node.styles.borderRadius, 999);
  assert.equal(edit.node.styles.background, "#4f68f5");
  assert.equal("pages" in edit, false, "the isolated endpoint must never return a project");

  const chatResponse = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "Quelles pages me conseilles-tu ?", project: generation.project, currentPageId: generation.project.pages[0].id })
  });
  assert.equal(chatResponse.status, 200);
  const chat = await chatResponse.json();
  assert.equal(typeof chat.answer, "string");
  assert.ok(chat.answer.length > 20);
  assert.ok(chat.project.pages.length > 0);
  assert.equal(chat.changed, false, "fallback chat must preserve the project when no AI provider is available");
});
