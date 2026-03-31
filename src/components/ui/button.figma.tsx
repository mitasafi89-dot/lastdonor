import figma from "@figma/code-connect"
import { Button } from "@/components/ui/button"

/**
 * Replace the Figma URL below with the actual URL of your Button component in Figma.
 * To get the URL: right-click the component in Figma > "Copy link to selection"
 */
figma.connect(Button, "https://figma.com/design/REPLACE_WITH_YOUR_FILE_ID/LastDonor?node-id=REPLACE", {
  props: {
    variant: figma.enum("Variant", {
      Default: "default",
      Outline: "outline",
      Secondary: "secondary",
      Ghost: "ghost",
      Destructive: "destructive",
      Link: "link",
    }),
    size: figma.enum("Size", {
      Default: "default",
      XS: "xs",
      SM: "sm",
      LG: "lg",
      Icon: "icon",
    }),
    label: figma.string("Label"),
    disabled: figma.boolean("Disabled"),
  },
  example: ({ variant, size, label, disabled }) => (
    <Button variant={variant} size={size} disabled={disabled}>
      {label}
    </Button>
  ),
})
