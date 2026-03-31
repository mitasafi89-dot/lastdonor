# Figma Integration Setup

This project uses **Figma Code Connect** to bridge Figma designs with React components.

## Prerequisites

- [Figma for VS Code](https://marketplace.visualstudio.com/items?itemName=figma.figma-vscode-extension) extension (already installed)
- `@figma/code-connect` package (already in devDependencies)
- A Figma Personal Access Token

## Step 1: Authenticate with Figma

### In VS Code
1. Open the **Figma** panel in the sidebar (Figma icon)
2. Click **Sign in** and authenticate with your Figma account
3. You'll now see your Figma files and can inspect designs directly in VS Code

### For Code Connect CLI
1. Go to **Figma > Account Settings > Personal Access Tokens**
2. Create a token with **File content: Read-only** scope
3. Set it as an environment variable:
   ```bash
   # Add to your .env.local (never commit this)
   FIGMA_ACCESS_TOKEN=figd_your_token_here
   ```

## Step 2: Create Your Figma Design File

1. Create a new Figma file called **LastDonor Design System**
2. Import the design tokens from [`src/design-tokens.json`](../src/design-tokens.json):
   - **Brand Colors**: Teal #0F766E, Amber #D97706, Red #8B2332, Green #2D6A4F
   - **Fonts**: DM Serif Display (headings), DM Sans (body), DM Mono (code)
   - **Border Radius**: Base 0.625rem (10px)
3. Build components in Figma that match the existing UI components

## Step 3: Link Figma Components to Code

Template Code Connect files are in `src/components/ui/`:
- `button.figma.tsx`
- `card.figma.tsx`
- `input.figma.tsx`
- `badge.figma.tsx`
- `dialog.figma.tsx`

To link each one:
1. In Figma, right-click the component and select **Copy link to selection**
2. Open the `.figma.tsx` file and replace `REPLACE_WITH_YOUR_FILE_ID` and `node-id=REPLACE` with the actual URL
3. Adjust the `figma.enum()` and `figma.string()` prop names to match your Figma component property names

## Step 4: Publish Code Connect

```bash
# Validate your Code Connect files
npx figma connect parse

# Publish to Figma (requires FIGMA_ACCESS_TOKEN)
npx figma connect publish --token $env:FIGMA_ACCESS_TOKEN
```

After publishing, your Figma components will show the corresponding React code snippets in the Dev Mode inspect panel.

## Design Tokens Reference

The full design token set is in [`src/design-tokens.json`](../src/design-tokens.json) and the CSS source of truth is [`src/app/globals.css`](../src/app/globals.css).

### Brand Colors
| Name  | Light Mode | Dark Mode |
|-------|-----------|-----------|
| Primary (Teal) | `#0F766E` | `#14B8A6` |
| Accent (Amber) | `#D97706` | `#FBBF24` |
| Destructive | `#8B2332` | `#EF4444` |
| Background | `#FFFFFF` | `#0F1A19` |
| Foreground | `#1A1A1A` | `#F1F5F9` |
| Card | `#FFFFFF` | `#1A2E2B` |
| Muted | `#F5F5F5` | `#1A2E2B` |
| Border | `#E5E7EB` | `#2D4A47` |

### Typography
| Token | Font |
|-------|------|
| `--font-display` | DM Serif Display |
| `--font-sans` | DM Sans |
| `--font-mono` | DM Mono |

## File Structure

```
figma.config.json              # Code Connect configuration
src/
  design-tokens.json           # Exportable design tokens (colors, fonts, radii)
  components/ui/
    button.tsx                  # React component
    button.figma.tsx            # Code Connect mapping (template)
    card.tsx
    card.figma.tsx
    input.tsx
    input.figma.tsx
    badge.tsx
    badge.figma.tsx
    dialog.tsx
    dialog.figma.tsx
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `npx figma connect parse` | Validate all Code Connect files |
| `npx figma connect publish` | Publish Code Connect to Figma |
| `npx figma connect unpublish` | Remove published connections |
| `npx figma connect create <figma-url>` | Generate a new `.figma.tsx` file from a Figma component URL |
