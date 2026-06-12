import { utf8ToBase64 } from "./custom-runtime.js";
import { safeImageSource } from "./media.js";

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function cssLength(value) {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  const clean = String(value ?? "").trim();
  return /^-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw)$/.test(clean) ? clean : "";
}

function cssFromStyles(styles = {}, section = false) {
  const map = [];
  const simple = { background: "background", color: "color", fontWeight: "font-weight", letterSpacing: "letter-spacing", lineHeight: "line-height", textAlign: "text-align", opacity: "opacity" };
  Object.entries(simple).forEach(([key, css]) => { if (styles[key] !== undefined && styles[key] !== "") map.push(`${css}:${styles[key]}`); });
  [["fontSize","font-size"],["borderRadius","border-radius"],["maxWidth","max-width"],["minHeight","min-height"],["width","width"],["gap","gap"]].forEach(([key, css]) => { const value = cssLength(styles[key]); if (value) map.push(`${css}:${value}`); });
  if (styles.gridColumn) map.push(`grid-column:${styles.gridColumn}`);
  if (styles.zIndex !== undefined) map.push(`z-index:${Math.round(number(styles.zIndex, 1))}`);
  if (styles.paddingY !== undefined) map.push(`padding-top:${number(styles.paddingY)}px`, `padding-bottom:${number(styles.paddingY)}px`);
  if (styles.paddingX !== undefined) map.push(`padding-left:${number(styles.paddingX)}px`, `padding-right:${number(styles.paddingX)}px`);
  if (section) {
    if (styles.layout === "free") map.push("position:relative", "display:block", `min-height:${number(styles.freeHeight || styles.minHeight, 600)}px`, "overflow:hidden");
    else map.push(`display:${styles.layout === "grid" ? "grid" : "flex"}`);
    if (styles.layout === "grid") {
      const customTemplate = typeof styles.gridTemplateColumns === "string" && /^[\d.a-z%\s(),-]+$/i.test(styles.gridTemplateColumns) ? styles.gridTemplateColumns : "";
      map.push(`grid-template-columns:${customTemplate || `repeat(${number(styles.columns, 3)},minmax(0,1fr))`}`);
    } else if (styles.layout !== "free") map.push(`flex-direction:${styles.layout === "row" ? "row" : "column"}`);
    if (styles.layout !== "free") {
      map.push(`align-items:${({start:"flex-start",center:"center",end:"flex-end",stretch:"stretch"})[styles.align] || "flex-start"}`);
      map.push(`justify-content:${({start:"flex-start",center:"center",end:"flex-end",between:"space-between"})[styles.justify] || "flex-start"}`);
    }
  }
  return map.join(";");
}

function elementHtml(item, project, freeLayout = false) {
  const freeStyle = freeLayout ? `;position:absolute;left:${clamp(number(item.styles?.x), 0, 100)}%;top:${Math.max(0, number(item.styles?.y))}px` : "";
  const style = `${cssFromStyles(item.styles)}${freeStyle}`;
  const effect = item.effect && item.effect !== "none" ? ` effect-${item.effect}` : "";
  if (item.type === "custom") return `<div class="custom-runtime${effect}" style="${style}" data-html="${utf8ToBase64(item.html || "")}" data-css="${utf8ToBase64(item.css || "")}" data-js="${utf8ToBase64(item.js || "")}" aria-label="${escapeHtml(item.content || "Bloc personnalisé")}"></div>`;
  if (item.type === "nav") return `<nav class="nav-links" style="${style}">${item.content.split("|").map((label, index) => {
    const cleanLabel = label.trim();
    const linkedPage = project.pages.find((page) => page.name.toLowerCase() === cleanLabel.toLowerCase()) || project.pages[index];
    return `<a href="#/${escapeHtml(linkedPage?.slug || "index")}">${escapeHtml(cleanLabel)}</a>`;
  }).join("")}</nav>`;
  if (item.type === "button") return `<a class="site-button${effect}" href="${escapeHtml(item.href || "#")}" style="${style}">${escapeHtml(item.content)}</a>`;
  if (item.type === "image") {
    const source = safeImageSource(item.src);
    return source
      ? `<div class="site-image" style="${style}"><img src="${escapeHtml(source)}" alt="${escapeHtml(item.alt || item.content || "Image")}" loading="lazy"></div>`
      : `<div class="site-image" style="${style}"><span>${escapeHtml(item.content || "Image")}</span></div>`;
  }
  if (item.type === "divider") return `<hr style="${style}" />`;
  const tag = { heading: "h2", text: "p", logo: "strong", badge: "span", card: "article" }[item.type] || "div";
  const content = item.type === "card" ? escapeHtml(item.content).replace(/\n/g, "<br>") : escapeHtml(item.content);
  return `<${tag} class="element-${item.type}${effect}" style="${style}">${content}</${tag}>`;
}

function buildExportHtml({ project, activePage, brief, fontStack, fontUrl }) {
  const fontLinks = fontUrl
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${escapeHtml(fontUrl)}">`
    : "";
  const pages = project.pages.map((page) => `<main class="site-page" data-page="${escapeHtml(page.slug)}" aria-label="Page ${escapeHtml(page.name)}">${page.sections.map((section) => `<section class="section-${escapeHtml(section.type)}${section.styles.layout === "free" ? " section-free" : ""}" style="${cssFromStyles(section.styles, true)}">${section.children.map((item) => elementHtml(item, project, section.styles.layout === "free")).join("\n")}</section>`).join("\n")}</main>`).join("\n");
  return `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(brief || project.name)}"><title>${escapeHtml(activePage.name)} — ${escapeHtml(project.name)}</title>
${fontLinks}
<style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:${project.theme.text};background:${project.theme.background};font-family:${fontStack}}.site-page{display:none}.site-page.active{display:block}section>*{margin-top:0;margin-bottom:0}.nav-links{display:flex;gap:24px}.nav-links a{color:inherit;text-decoration:none}.site-button{display:inline-block;text-decoration:none;transition:.2s}.effect-lift:hover{transform:translateY(-4px);box-shadow:0 12px 28px #17181c2b}.effect-scale:hover{transform:scale(1.06)}.effect-glow:hover{box-shadow:0 0 0 5px ${project.theme.accent}30,0 10px 30px ${project.theme.accent}45}.site-image{min-height:260px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(135deg,${project.theme.soft || project.theme.surface},${project.theme.surface})}.site-image img{width:100%;height:100%;min-height:inherit;display:block;object-fit:cover}hr{width:100%;border:0;border-top:1px solid ${project.theme.muted}}.section-features>.element-heading{grid-column:1/-1}.element-card{white-space:normal;line-height:1.6}.custom-runtime{display:block;width:100%}
@media(max-width:700px){section{padding-left:24px!important;padding-right:24px!important}.section-navbar .nav-links{display:none}section[style*="flex-direction:row"]{flex-direction:column!important}section[style*="grid-template-columns"]{grid-template-columns:1fr!important}.section-free{display:flex!important;flex-direction:column!important;gap:20px!important;min-height:0!important;overflow:visible!important}.section-free>*{position:relative!important;left:auto!important;top:auto!important;max-width:100%!important}.section-free>.site-image,.section-free>.custom-runtime{width:100%!important}h2{font-size:clamp(28px,10vw,42px)!important}}
</style></head><body>${pages}<script>
const decodeCustom=value=>new TextDecoder().decode(Uint8Array.from(atob(value),character=>character.charCodeAt(0)));
document.querySelectorAll('.custom-runtime').forEach(host=>{const root=host.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=':host{display:block}*{box-sizing:border-box}'+decodeCustom(host.dataset.css||'');root.append(style);const content=document.createElement('div');content.innerHTML=decodeCustom(host.dataset.html||'');root.append(content);try{new Function('root','host',decodeCustom(host.dataset.js||''))(root,host)}catch(error){const message=document.createElement('pre');message.textContent='Erreur JavaScript: '+error.message;message.style.cssText='padding:12px;color:#b42318;background:#fff1f0;white-space:pre-wrap';root.append(message)}});
const pageNames=${JSON.stringify(Object.fromEntries(project.pages.map((page) => [page.slug, page.name])))};
function showPage(){const slug=location.hash.replace(/^#\//,"")||${JSON.stringify(activePage.slug)};const target=document.querySelector('[data-page="'+CSS.escape(slug)+'"]')||document.querySelector('.site-page');document.querySelectorAll('.site-page').forEach(page=>page.classList.toggle('active',page===target));document.title=(pageNames[target.dataset.page]||${JSON.stringify(project.name)})+' — '+${JSON.stringify(project.name)};scrollTo(0,0)}
addEventListener('hashchange',showPage);showPage();
</script></body></html>`;
}

export { buildExportHtml };
