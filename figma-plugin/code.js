// LastDonor Design Token Importer — Figma Plugin
// Run this once inside Figma to create all design variables and color styles.

// =============================================================================
// DESIGN TOKENS
// =============================================================================

const BRAND_COLORS = {
  "brand/teal":   { r: 0.059, g: 0.463, b: 0.431 },  // #0F766E
  "brand/amber":  { r: 0.851, g: 0.467, b: 0.024 },  // #D97706
  "brand/red":    { r: 0.545, g: 0.137, b: 0.196 },  // #8B2332
  "brand/green":  { r: 0.176, g: 0.416, b: 0.310 },  // #2D6A4F
};

const LIGHT_COLORS = {
  "semantic/background":          { r: 1,     g: 1,     b: 1     },  // #FFFFFF
  "semantic/foreground":          { r: 0.102, g: 0.102, b: 0.102 },  // #1A1A1A
  "semantic/card":                { r: 1,     g: 1,     b: 1     },  // #FFFFFF
  "semantic/card-foreground":     { r: 0.102, g: 0.102, b: 0.102 },  // #1A1A1A
  "semantic/primary":             { r: 0.059, g: 0.463, b: 0.431 },  // #0F766E
  "semantic/primary-foreground":  { r: 1,     g: 1,     b: 1     },  // #FFFFFF
  "semantic/secondary":           { r: 0.961, g: 0.961, b: 0.961 },  // #F5F5F5
  "semantic/secondary-foreground":{ r: 0.102, g: 0.102, b: 0.102 },  // #1A1A1A
  "semantic/muted":               { r: 0.961, g: 0.961, b: 0.961 },  // #F5F5F5
  "semantic/muted-foreground":    { r: 0.420, g: 0.447, b: 0.498 },  // #6B7280
  "semantic/accent":              { r: 0.851, g: 0.467, b: 0.024 },  // #D97706
  "semantic/accent-foreground":   { r: 1,     g: 1,     b: 1     },  // #FFFFFF
  "semantic/destructive":         { r: 0.545, g: 0.137, b: 0.196 },  // #8B2332
  "semantic/border":              { r: 0.898, g: 0.906, b: 0.922 },  // #E5E7EB
  "semantic/input":               { r: 0.898, g: 0.906, b: 0.922 },  // #E5E7EB
  "semantic/ring":                { r: 0.059, g: 0.463, b: 0.431 },  // #0F766E
};

const DARK_COLORS = {
  "semantic/background":          { r: 0.059, g: 0.102, b: 0.098 },  // #0F1A19
  "semantic/foreground":          { r: 0.945, g: 0.961, b: 0.976 },  // #F1F5F9
  "semantic/card":                { r: 0.102, g: 0.180, b: 0.169 },  // #1A2E2B
  "semantic/card-foreground":     { r: 0.945, g: 0.961, b: 0.976 },  // #F1F5F9
  "semantic/primary":             { r: 0.078, g: 0.722, b: 0.651 },  // #14B8A6
  "semantic/primary-foreground":  { r: 0.059, g: 0.102, b: 0.098 },  // #0F1A19
  "semantic/secondary":           { r: 0.075, g: 0.137, b: 0.133 },  // #132322
  "semantic/secondary-foreground":{ r: 0.945, g: 0.961, b: 0.976 },  // #F1F5F9
  "semantic/muted":               { r: 0.102, g: 0.180, b: 0.169 },  // #1A2E2B
  "semantic/muted-foreground":    { r: 0.580, g: 0.639, b: 0.722 },  // #94A3B8
  "semantic/accent":              { r: 0.984, g: 0.749, b: 0.141 },  // #FBBF24
  "semantic/accent-foreground":   { r: 0.102, g: 0.102, b: 0.102 },  // #1A1A1A
  "semantic/destructive":         { r: 0.937, g: 0.267, b: 0.267 },  // #EF4444
  "semantic/border":              { r: 0.176, g: 0.290, b: 0.278 },  // #2D4A47
  "semantic/input":               { r: 0.176, g: 0.290, b: 0.278 },  // #2D4A47
  "semantic/ring":                { r: 0.078, g: 0.722, b: 0.651 },  // #14B8A6
};

const CHART_COLORS_LIGHT = {
  "chart/chart-1": { r: 0.059, g: 0.463, b: 0.431 },  // #0F766E
  "chart/chart-2": { r: 0.851, g: 0.467, b: 0.024 },  // #D97706
  "chart/chart-3": { r: 0.176, g: 0.416, b: 0.310 },  // #2D6A4F
  "chart/chart-4": { r: 0.545, g: 0.137, b: 0.196 },  // #8B2332
  "chart/chart-5": { r: 0.420, g: 0.447, b: 0.498 },  // #6B7280
};

const CHART_COLORS_DARK = {
  "chart/chart-1": { r: 0.078, g: 0.722, b: 0.651 },  // #14B8A6
  "chart/chart-2": { r: 0.984, g: 0.749, b: 0.141 },  // #FBBF24
  "chart/chart-3": { r: 0.204, g: 0.827, b: 0.600 },  // #34D399
  "chart/chart-4": { r: 0.973, g: 0.443, b: 0.443 },  // #F87171
  "chart/chart-5": { r: 0.580, g: 0.639, b: 0.722 },  // #94A3B8
};

// =============================================================================
// SPACING & RADIUS
// =============================================================================

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
  "radius/sm":   6,
  "radius/md":   8,
  "radius/lg":   10,
  "radius/xl":   14,
  "radius/2xl":  18,
  "radius/3xl":  22,
  "radius/4xl":  26,
  "radius/full": 9999,
};

// =============================================================================
// TYPOGRAPHY REFERENCE FRAME (visual reference since Figma plugins can't
// directly install fonts, but can create text styles)
// =============================================================================

const TEXT_STYLES = [
  { name: "Display/H1",      family: "DM Serif Display", size: 60, lineHeight: 1.1, weight: 400 },
  { name: "Display/H2",      family: "DM Serif Display", size: 48, lineHeight: 1.15, weight: 400 },
  { name: "Display/H3",      family: "DM Serif Display", size: 36, lineHeight: 1.2, weight: 400 },
  { name: "Display/H4",      family: "DM Serif Display", size: 30, lineHeight: 1.25, weight: 400 },
  { name: "Body/Large",      family: "DM Sans",          size: 18, lineHeight: 1.6, weight: 400 },
  { name: "Body/Base",       family: "DM Sans",          size: 16, lineHeight: 1.6, weight: 400 },
  { name: "Body/Small",      family: "DM Sans",          size: 14, lineHeight: 1.5, weight: 400 },
  { name: "Body/XSmall",     family: "DM Sans",          size: 12, lineHeight: 1.5, weight: 400 },
  { name: "UI/Label",        family: "DM Sans",          size: 14, lineHeight: 1.4, weight: 500 },
  { name: "UI/Button",       family: "DM Sans",          size: 14, lineHeight: 1,   weight: 600 },
  { name: "UI/Caption",      family: "DM Sans",          size: 12, lineHeight: 1.4, weight: 500 },
  { name: "Mono/Stat-Large", family: "DM Mono",          size: 48, lineHeight: 1.1, weight: 400 },
  { name: "Mono/Stat",       family: "DM Mono",          size: 24, lineHeight: 1.2, weight: 400 },
  { name: "Mono/Currency",   family: "DM Mono",          size: 18, lineHeight: 1.3, weight: 400 },
  { name: "Mono/Small",      family: "DM Mono",          size: 14, lineHeight: 1.4, weight: 400 },
];

// =============================================================================
// MAIN PLUGIN LOGIC
// =============================================================================

async function main() {
  let created = { variables: 0, styles: 0, frames: 0 };

  // -------------------------------------------------------------------------
  // 1. CREATE COLOR VARIABLE COLLECTION (with Light + Dark modes)
  // -------------------------------------------------------------------------
  const colorCollection = figma.variables.createVariableCollection("LastDonor/Colors");
  const lightModeId = colorCollection.modes[0].modeId;
  colorCollection.renameMode(lightModeId, "Light");
  const darkModeId = colorCollection.addMode("Dark");

  // Brand colors (same in both modes)
  for (const [name, rgb] of Object.entries(BRAND_COLORS)) {
    const v = figma.variables.createVariable(name, colorCollection, "COLOR");
    v.setValueForMode(lightModeId, { ...rgb, a: 1 });
    v.setValueForMode(darkModeId, { ...rgb, a: 1 });
    created.variables++;
  }

  // Semantic colors (different per mode)
  for (const [name, lightRgb] of Object.entries(LIGHT_COLORS)) {
    const darkRgb = DARK_COLORS[name];
    const v = figma.variables.createVariable(name, colorCollection, "COLOR");
    v.setValueForMode(lightModeId, { ...lightRgb, a: 1 });
    v.setValueForMode(darkModeId, { ...(darkRgb || lightRgb), a: 1 });
    created.variables++;
  }

  // Chart colors
  for (const [name, lightRgb] of Object.entries(CHART_COLORS_LIGHT)) {
    const darkRgb = CHART_COLORS_DARK[name];
    const v = figma.variables.createVariable(name, colorCollection, "COLOR");
    v.setValueForMode(lightModeId, { ...lightRgb, a: 1 });
    v.setValueForMode(darkModeId, { ...(darkRgb || lightRgb), a: 1 });
    created.variables++;
  }

  // -------------------------------------------------------------------------
  // 2. CREATE SPACING/RADIUS VARIABLE COLLECTION
  // -------------------------------------------------------------------------
  const spacingCollection = figma.variables.createVariableCollection("LastDonor/Spacing");
  const defaultModeId = spacingCollection.modes[0].modeId;
  spacingCollection.renameMode(defaultModeId, "Default");

  for (const [name, value] of Object.entries(SPACING)) {
    const v = figma.variables.createVariable(name, spacingCollection, "FLOAT");
    v.setValueForMode(defaultModeId, value);
    created.variables++;
  }

  for (const [name, value] of Object.entries(RADII)) {
    const v = figma.variables.createVariable(name, spacingCollection, "FLOAT");
    v.setValueForMode(defaultModeId, value);
    created.variables++;
  }

  // -------------------------------------------------------------------------
  // 3. CREATE TEXT STYLES
  // -------------------------------------------------------------------------
  for (const style of TEXT_STYLES) {
    try {
      await figma.loadFontAsync({ family: style.family, style: style.weight >= 600 ? "SemiBold" : style.weight >= 500 ? "Medium" : "Regular" });
      const textStyle = figma.createTextStyle();
      textStyle.name = `LastDonor/${style.name}`;
      textStyle.fontSize = style.size;
      textStyle.lineHeight = { value: style.lineHeight * 100, unit: "PERCENT" };
      textStyle.fontName = {
        family: style.family,
        style: style.weight >= 600 ? "SemiBold" : style.weight >= 500 ? "Medium" : "Regular"
      };
      created.styles++;
    } catch (e) {
      console.log(`Could not create text style "${style.name}": ${e.message}. Install ${style.family} font.`);
    }
  }

  // -------------------------------------------------------------------------
  // 4. CREATE COLOR STYLE SWATCHES (Paint Styles for easy use)
  // -------------------------------------------------------------------------
  const allColors = {
    ...Object.fromEntries(Object.entries(BRAND_COLORS).map(([k, v]) => [`LastDonor/${k}`, v])),
    ...Object.fromEntries(Object.entries(LIGHT_COLORS).map(([k, v]) => [`LastDonor/${k}`, v])),
  };

  for (const [name, rgb] of Object.entries(allColors)) {
    const paintStyle = figma.createPaintStyle();
    paintStyle.name = name;
    paintStyle.paints = [{ type: "SOLID", color: rgb, opacity: 1 }];
    created.styles++;
  }

  // -------------------------------------------------------------------------
  // 5. CREATE VISUAL COLOR PALETTE FRAME
  // -------------------------------------------------------------------------
  const paletteFrame = figma.createFrame();
  paletteFrame.name = "LastDonor Color Palette";
  paletteFrame.layoutMode = "VERTICAL";
  paletteFrame.primaryAxisSizingMode = "AUTO";
  paletteFrame.counterAxisSizingMode = "AUTO";
  paletteFrame.paddingTop = 40;
  paletteFrame.paddingBottom = 40;
  paletteFrame.paddingLeft = 40;
  paletteFrame.paddingRight = 40;
  paletteFrame.itemSpacing = 32;
  paletteFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  paletteFrame.cornerRadius = 16;

  // Title
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  } catch {
    await figma.loadFontAsync({ family: "Arial", style: "Bold" });
  }

  const titleText = figma.createText();
  try {
    titleText.fontName = { family: "Inter", style: "Bold" };
  } catch {
    titleText.fontName = { family: "Arial", style: "Bold" };
  }
  titleText.characters = "LastDonor Design System - Color Palette";
  titleText.fontSize = 24;
  titleText.fills = [{ type: "SOLID", color: { r: 0.102, g: 0.102, b: 0.102 } }];
  paletteFrame.appendChild(titleText);

  // Brand colors row
  const brandRow = createColorRow("Brand Colors", BRAND_COLORS);
  paletteFrame.appendChild(brandRow);

  // Semantic colors - Light
  const lightRow = createColorRow("Light Mode", LIGHT_COLORS);
  paletteFrame.appendChild(lightRow);

  // Semantic colors - Dark
  const darkRow = createColorRow("Dark Mode", DARK_COLORS);
  paletteFrame.appendChild(darkRow);

  // Chart colors
  const chartRow = createColorRow("Chart Colors", CHART_COLORS_LIGHT);
  paletteFrame.appendChild(chartRow);

  created.frames++;

  // Position on canvas
  paletteFrame.x = 0;
  paletteFrame.y = 0;

  // -------------------------------------------------------------------------
  // 6. CREATE TYPOGRAPHY REFERENCE FRAME
  // -------------------------------------------------------------------------
  const typoFrame = figma.createFrame();
  typoFrame.name = "LastDonor Typography Scale";
  typoFrame.layoutMode = "VERTICAL";
  typoFrame.primaryAxisSizingMode = "AUTO";
  typoFrame.counterAxisSizingMode = "FIXED";
  typoFrame.resize(800, 100);
  typoFrame.paddingTop = 40;
  typoFrame.paddingBottom = 40;
  typoFrame.paddingLeft = 40;
  typoFrame.paddingRight = 40;
  typoFrame.itemSpacing = 24;
  typoFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  typoFrame.cornerRadius = 16;

  for (const style of TEXT_STYLES) {
    try {
      const fontStyle = style.weight >= 600 ? "SemiBold" : style.weight >= 500 ? "Medium" : "Regular";
      await figma.loadFontAsync({ family: style.family, style: fontStyle });

      const row = figma.createFrame();
      row.layoutMode = "HORIZONTAL";
      row.primaryAxisSizingMode = "AUTO";
      row.counterAxisSizingMode = "AUTO";
      row.itemSpacing = 16;
      row.fills = [];

      // Label
      let labelFont;
      try {
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        labelFont = { family: "Inter", style: "Regular" };
      } catch {
        await figma.loadFontAsync({ family: "Arial", style: "Regular" });
        labelFont = { family: "Arial", style: "Regular" };
      }

      const label = figma.createText();
      label.fontName = labelFont;
      label.characters = `${style.name} (${style.family} ${style.size}px)`;
      label.fontSize = 12;
      label.fills = [{ type: "SOLID", color: { r: 0.420, g: 0.447, b: 0.498 } }];
      label.resize(220, label.height);
      row.appendChild(label);

      // Sample text
      const sample = figma.createText();
      sample.fontName = { family: style.family, style: fontStyle };
      sample.characters = style.name.includes("Mono") ? "$42,750 raised" : "The quick brown fox";
      sample.fontSize = style.size;
      sample.lineHeight = { value: style.lineHeight * 100, unit: "PERCENT" };
      sample.fills = [{ type: "SOLID", color: { r: 0.102, g: 0.102, b: 0.102 } }];
      row.appendChild(sample);

      typoFrame.appendChild(row);
    } catch (e) {
      console.log(`Skipping ${style.name}: ${e.message}`);
    }
  }

  typoFrame.x = 0;
  typoFrame.y = paletteFrame.height + 80;
  created.frames++;

  // -------------------------------------------------------------------------
  // DONE
  // -------------------------------------------------------------------------
  figma.notify(
    `LastDonor tokens imported: ${created.variables} variables, ${created.styles} styles, ${created.frames} reference frames`,
    { timeout: 5000 }
  );

  console.log("=== LastDonor Design Token Import Complete ===");
  console.log(`Variables: ${created.variables}`);
  console.log(`Styles: ${created.styles}`);
  console.log(`Reference frames: ${created.frames}`);

  figma.closePlugin();
}

// =============================================================================
// HELPER: Create a row of color swatches
// =============================================================================

function createColorRow(title, colors) {
  const container = figma.createFrame();
  container.name = title;
  container.layoutMode = "VERTICAL";
  container.primaryAxisSizingMode = "AUTO";
  container.counterAxisSizingMode = "AUTO";
  container.itemSpacing = 12;
  container.fills = [];

  // Section label
  const label = figma.createText();
  try {
    label.fontName = { family: "Inter", style: "SemiBold" };
  } catch {
    label.fontName = { family: "Arial", style: "Bold" };
  }
  label.characters = title;
  label.fontSize = 14;
  label.fills = [{ type: "SOLID", color: { r: 0.420, g: 0.447, b: 0.498 } }];
  container.appendChild(label);

  // Swatch row
  const row = figma.createFrame();
  row.name = `${title} swatches`;
  row.layoutMode = "HORIZONTAL";
  row.primaryAxisSizingMode = "AUTO";
  row.counterAxisSizingMode = "AUTO";
  row.itemSpacing = 12;
  row.fills = [];

  for (const [name, rgb] of Object.entries(colors)) {
    const swatch = figma.createFrame();
    swatch.name = name;
    swatch.layoutMode = "VERTICAL";
    swatch.primaryAxisSizingMode = "AUTO";
    swatch.counterAxisSizingMode = "AUTO";
    swatch.itemSpacing = 6;
    swatch.fills = [];

    // Color rectangle
    const rect = figma.createRectangle();
    rect.name = name;
    rect.resize(80, 80);
    rect.cornerRadius = 12;
    rect.fills = [{ type: "SOLID", color: rgb }];
    swatch.appendChild(rect);

    // Color name label
    const nameLabel = figma.createText();
    try {
      nameLabel.fontName = { family: "Inter", style: "Regular" };
    } catch {
      nameLabel.fontName = { family: "Arial", style: "Regular" };
    }
    const shortName = name.split("/").pop();
    nameLabel.characters = shortName;
    nameLabel.fontSize = 10;
    nameLabel.fills = [{ type: "SOLID", color: { r: 0.420, g: 0.447, b: 0.498 } }];
    swatch.appendChild(nameLabel);

    // Hex label
    const hexLabel = figma.createText();
    try {
      hexLabel.fontName = { family: "Inter", style: "Regular" };
    } catch {
      hexLabel.fontName = { family: "Arial", style: "Regular" };
    }
    const hex = `#${Math.round(rgb.r*255).toString(16).padStart(2,'0')}${Math.round(rgb.g*255).toString(16).padStart(2,'0')}${Math.round(rgb.b*255).toString(16).padStart(2,'0')}`.toUpperCase();
    hexLabel.characters = hex;
    hexLabel.fontSize = 9;
    hexLabel.fills = [{ type: "SOLID", color: { r: 0.580, g: 0.639, b: 0.722 } }];
    swatch.appendChild(hexLabel);

    row.appendChild(swatch);
  }

  container.appendChild(row);
  return container;
}

// Run
main();
