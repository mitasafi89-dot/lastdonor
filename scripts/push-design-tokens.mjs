/**
 * push-design-tokens.mjs
 * Pushes the LastDonor design system (color variables, typography, spacing)
 * directly into a Figma file via the Variables REST API.
 *
 * Usage:
 *   node scripts/push-design-tokens.mjs <FIGMA_FILE_KEY>
 *
 * Requires FIGMA_ACCESS_TOKEN in .env.local or as environment variable.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Load token from .env.local
function loadToken() {
  const envPath = resolve(__dirname, "..", ".env.local");
  try {
    const envContent = readFileSync(envPath, "utf-8");
    const match = envContent.match(/^FIGMA_ACCESS_TOKEN=(.+)$/m);
    if (match) return match[1].trim();
  } catch {}
  if (process.env.FIGMA_ACCESS_TOKEN) return process.env.FIGMA_ACCESS_TOKEN;
  console.error("ERROR: FIGMA_ACCESS_TOKEN not found in .env.local or environment");
  process.exit(1);
}

const TOKEN = loadToken();
const FILE_KEY = process.argv[2];

if (!FILE_KEY) {
  console.error("Usage: node scripts/push-design-tokens.mjs <FIGMA_FILE_KEY>");
  console.error("  Get the file key from your Figma URL:");
  console.error("  https://www.figma.com/design/<FILE_KEY>/...");
  process.exit(1);
}

const API = "https://api.figma.com/v1";
const headers = {
  "X-Figma-Token": TOKEN,
  "Content-Type": "application/json",
};

// ---------------------------------------------------------------------------
// Design Tokens
// ---------------------------------------------------------------------------

const LIGHT_COLORS = {
  "background":          { r: 1, g: 1, b: 1, a: 1 },                    // #FFFFFF
  "foreground":          { r: 0.102, g: 0.102, b: 0.102, a: 1 },        // #1A1A1A
  "card":                { r: 1, g: 1, b: 1, a: 1 },                    // #FFFFFF
  "card-foreground":     { r: 0.102, g: 0.102, b: 0.102, a: 1 },        // #1A1A1A
  "primary":             { r: 0.059, g: 0.463, b: 0.431, a: 1 },        // #0F766E
  "primary-foreground":  { r: 1, g: 1, b: 1, a: 1 },                    // #FFFFFF
  "secondary":           { r: 0.961, g: 0.961, b: 0.961, a: 1 },        // #F5F5F5
  "secondary-foreground":{ r: 0.102, g: 0.102, b: 0.102, a: 1 },        // #1A1A1A
  "muted":               { r: 0.961, g: 0.961, b: 0.961, a: 1 },        // #F5F5F5
  "muted-foreground":    { r: 0.420, g: 0.447, b: 0.498, a: 1 },        // #6B7280
  "accent":              { r: 0.851, g: 0.467, b: 0.024, a: 1 },        // #D97706
  "accent-foreground":   { r: 1, g: 1, b: 1, a: 1 },                    // #FFFFFF
  "destructive":         { r: 0.545, g: 0.137, b: 0.196, a: 1 },        // #8B2332
  "border":              { r: 0.898, g: 0.906, b: 0.922, a: 1 },        // #E5E7EB
  "input":               { r: 0.898, g: 0.906, b: 0.922, a: 1 },        // #E5E7EB
  "ring":                { r: 0.059, g: 0.463, b: 0.431, a: 1 },        // #0F766E
};

const DARK_COLORS = {
  "background":          { r: 0.059, g: 0.102, b: 0.098, a: 1 },        // #0F1A19
  "foreground":          { r: 0.945, g: 0.961, b: 0.976, a: 1 },        // #F1F5F9
  "card":                { r: 0.102, g: 0.180, b: 0.169, a: 1 },        // #1A2E2B
  "card-foreground":     { r: 0.945, g: 0.961, b: 0.976, a: 1 },        // #F1F5F9
  "primary":             { r: 0.078, g: 0.722, b: 0.651, a: 1 },        // #14B8A6
  "primary-foreground":  { r: 0.059, g: 0.102, b: 0.098, a: 1 },        // #0F1A19
  "secondary":           { r: 0.075, g: 0.137, b: 0.133, a: 1 },        // #132322
  "secondary-foreground":{ r: 0.945, g: 0.961, b: 0.976, a: 1 },        // #F1F5F9
  "muted":               { r: 0.102, g: 0.180, b: 0.169, a: 1 },        // #1A2E2B
  "muted-foreground":    { r: 0.580, g: 0.639, b: 0.722, a: 1 },        // #94A3B8
  "accent":              { r: 0.984, g: 0.749, b: 0.141, a: 1 },        // #FBBF24
  "accent-foreground":   { r: 0.102, g: 0.102, b: 0.102, a: 1 },        // #1A1A1A
  "destructive":         { r: 0.937, g: 0.267, b: 0.267, a: 1 },        // #EF4444
  "border":              { r: 0.176, g: 0.290, b: 0.278, a: 1 },        // #2D4A47
  "input":               { r: 0.176, g: 0.290, b: 0.278, a: 1 },        // #2D4A47
  "ring":                { r: 0.078, g: 0.722, b: 0.651, a: 1 },        // #14B8A6
};

const BRAND_COLORS = {
  "brand-teal":   { r: 0.059, g: 0.463, b: 0.431, a: 1 },  // #0F766E
  "brand-amber":  { r: 0.851, g: 0.467, b: 0.024, a: 1 },  // #D97706
  "brand-red":    { r: 0.545, g: 0.137, b: 0.196, a: 1 },  // #8B2332
  "brand-green":  { r: 0.176, g: 0.416, b: 0.310, a: 1 },  // #2D6A4F
};

const SPACING = {
  "spacing/0":  0,
  "spacing/1":  1,
  "spacing/2":  2,
  "spacing/4":  4,
  "spacing/6":  6,
  "spacing/8":  8,
  "spacing/10": 10,
  "spacing/12": 12,
  "spacing/16": 16,
  "spacing/20": 20,
  "spacing/24": 24,
  "spacing/32": 32,
  "spacing/40": 40,
  "spacing/48": 48,
  "spacing/64": 64,
  "spacing/80": 80,
};

const RADII = {
  "radius/sm":  6,    // 0.375rem
  "radius/md":  8,    // 0.5rem
  "radius/lg":  10,   // 0.625rem (base)
  "radius/xl":  14,   // 0.875rem
  "radius/2xl": 18,   // 1.125rem
  "radius/3xl": 22,   // 1.375rem
  "radius/4xl": 26,   // 1.625rem
  "radius/full":9999, // fully rounded (pills)
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function figmaGet(path) {
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function figmaPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n  LastDonor Design Token Push`);
  console.log(`  File: ${FILE_KEY}\n`);

  // 1. Get existing variables to avoid duplicates
  console.log("  [1/4] Reading existing variables...");
  let existingVars;
  try {
    existingVars = await figmaGet(`/files/${FILE_KEY}/variables/local`);
  } catch (e) {
    console.error("  Failed to read file. Check the file key and token permissions.");
    console.error(" ", e.message);
    process.exit(1);
  }

  const existingCollections = existingVars.meta?.variableCollections || {};
  const existingVariables = existingVars.meta?.variables || {};
  
  console.log(`  Found ${Object.keys(existingCollections).length} existing collection(s), ${Object.keys(existingVariables).length} variable(s)`);

  // Check if we already have our collections
  const collectionNames = Object.values(existingCollections).map(c => c.name);
  if (collectionNames.includes("LastDonor/Colors") && collectionNames.includes("LastDonor/Spacing")) {
    console.log("\n  Design tokens already exist in this file!");
    console.log("  To update, delete the existing collections in Figma first, then re-run.");
    process.exit(0);
  }

  // 2. Create variable collections and variables
  console.log("  [2/4] Creating color variables (Light + Dark modes)...");
  
  const variableActions = [];
  const tempIds = {};
  let tempIdCounter = 0;

  function tempId(prefix) {
    const id = `${prefix}_${tempIdCounter++}`;
    return id;
  }

  // --- Colors Collection ---
  const colorsCollId = tempId("coll");
  variableActions.push({
    action: "CREATE",
    id: colorsCollId,
    name: "LastDonor/Colors",
    initialModeId: tempId("mode_light"),
  });

  // We need to add a dark mode
  const darkModeId = tempId("mode_dark");

  // Create brand color variables (no modes, same in both)
  for (const [name, rgba] of Object.entries(BRAND_COLORS)) {
    const varId = tempId("var");
    variableActions.push({
      action: "CREATE",
      id: varId,
      name: `brand/${name}`,
      variableCollectionId: colorsCollId,
      resolvedType: "COLOR",
      valuesByMode: {
        [variableActions[0].initialModeId]: rgba,
        [darkModeId]: rgba,  // brand colors stay the same
      },
    });
  }

  // Create semantic color variables (light + dark)
  for (const [name, lightRgba] of Object.entries(LIGHT_COLORS)) {
    const darkRgba = DARK_COLORS[name] || lightRgba;
    const varId = tempId("var");
    variableActions.push({
      action: "CREATE",
      id: varId,
      name: `semantic/${name}`,
      variableCollectionId: colorsCollId,
      resolvedType: "COLOR",
      valuesByMode: {
        [variableActions[0].initialModeId]: lightRgba,
        [darkModeId]: darkRgba,
      },
    });
  }

  // --- Spacing Collection ---
  console.log("  [3/4] Creating spacing & radius variables...");
  const spacingCollId = tempId("coll");
  const spacingModeId = tempId("mode_default");
  variableActions.push({
    action: "CREATE",
    id: spacingCollId,
    name: "LastDonor/Spacing",
    initialModeId: spacingModeId,
  });

  for (const [name, value] of Object.entries(SPACING)) {
    variableActions.push({
      action: "CREATE",
      id: tempId("var"),
      name,
      variableCollectionId: spacingCollId,
      resolvedType: "FLOAT",
      valuesByMode: { [spacingModeId]: value },
    });
  }

  for (const [name, value] of Object.entries(RADII)) {
    variableActions.push({
      action: "CREATE",
      id: tempId("var"),
      name,
      variableCollectionId: spacingCollId,
      resolvedType: "FLOAT",
      valuesByMode: { [spacingModeId]: value },
    });
  }

  // 3. Add dark mode to Colors collection
  variableActions.splice(1, 0, {
    action: "CREATE_MODE",
    id: darkModeId,
    name: "Dark",
    variableCollectionId: colorsCollId,
  });

  // Rename light mode
  variableActions.splice(1, 0, {
    action: "UPDATE_MODE",
    id: variableActions[0].initialModeId,
    name: "Light",
    variableCollectionId: colorsCollId,
  });

  // 4. Push to Figma
  console.log("  [4/4] Pushing to Figma...");
  console.log(`         ${variableActions.length} operations`);

  try {
    const result = await figmaPost(`/files/${FILE_KEY}/variables`, {
      variableCollections: variableActions.filter(a => 
        a.action === "CREATE" && a.initialModeId
      ).map(a => ({
        action: a.action,
        id: a.id,
        name: a.name,
        initialModeId: a.initialModeId,
      })),
      variableModes: variableActions.filter(a => 
        a.action === "CREATE_MODE" || a.action === "UPDATE_MODE"
      ).map(a => ({
        action: a.action,
        id: a.id,
        name: a.name,
        variableCollectionId: a.variableCollectionId,
      })),
      variables: variableActions.filter(a => 
        a.action === "CREATE" && a.resolvedType
      ).map(a => ({
        action: a.action,
        id: a.id,
        name: a.name,
        variableCollectionId: a.variableCollectionId,
        resolvedType: a.resolvedType,
        valuesByMode: a.valuesByMode,
      })),
    });

    console.log("\n  SUCCESS! Design tokens pushed to Figma.");
    console.log(`  Collections created: 2 (Colors, Spacing)`);
    
    const colorVarCount = Object.keys(LIGHT_COLORS).length + Object.keys(BRAND_COLORS).length;
    const spacingVarCount = Object.keys(SPACING).length + Object.keys(RADII).length;
    console.log(`  Color variables: ${colorVarCount} (Light + Dark modes)`);
    console.log(`  Spacing variables: ${Object.keys(SPACING).length}`);
    console.log(`  Radius variables: ${Object.keys(RADII).length}`);
    console.log(`\n  Open your file: https://www.figma.com/design/${FILE_KEY}\n`);
    
    if (result.status === 200 || result.meta) {
      console.log("  Figma response: OK");
    }
  } catch (e) {
    console.error("\n  FAILED to push variables:", e.message);
    process.exit(1);
  }
}

main().catch(e => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
