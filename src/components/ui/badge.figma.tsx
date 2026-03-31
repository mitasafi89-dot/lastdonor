import figma from "@figma/code-connect"
import { Badge } from "@/components/ui/badge"

/**
 * Replace the Figma URL below with the actual URL of your Badge component in Figma.
 * To get the URL: right-click the component in Figma > "Copy link to selection"
 */
figma.connect(Badge, "https://figma.com/design/REPLACE_WITH_YOUR_FILE_ID/LastDonor?node-id=REPLACE", {
  props: {
    variant: figma.enum("Variant", {
      Default: "default",
      Secondary: "secondary",
      Destructive: "destructive",
      Outline: "outline",
    }),
    label: figma.string("Label"),
  },
  example: ({ variant, label }) => (
    <Badge variant={variant}>{label}</Badge>
  ),
})
