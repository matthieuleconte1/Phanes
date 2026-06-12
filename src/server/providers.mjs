import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";

const VIBE_COMMAND = process.env.VIBE_COMMAND || "vibe";
const VIBE_MODEL = "vibe:mistral-medium-3.5";
const ANTIGRAVITY_COMMAND = process.env.ANTIGRAVITY_COMMAND || "agy";
const ANTIGRAVITY_PREFIX = "antigravity:";

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

export { agentProvider, antigravityStatus, mistralVibeStatus };
