import figma from "@figma/code-connect"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

/**
 * Replace the Figma URL below with the actual URL of your Card component in Figma.
 * To get the URL: right-click the component in Figma > "Copy link to selection"
 */
figma.connect(Card, "https://figma.com/design/REPLACE_WITH_YOUR_FILE_ID/LastDonor?node-id=REPLACE", {
  props: {
    title: figma.string("Title"),
    description: figma.string("Description"),
    hasFooter: figma.boolean("Has Footer"),
  },
  example: ({ title, description }) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Card content */}
      </CardContent>
    </Card>
  ),
})
