import figma from "@figma/code-connect"
import { Input } from "@/components/ui/input"

/**
 * Replace the Figma URL below with the actual URL of your Input component in Figma.
 * To get the URL: right-click the component in Figma > "Copy link to selection"
 */
figma.connect(Input, "https://figma.com/design/REPLACE_WITH_YOUR_FILE_ID/LastDonor?node-id=REPLACE", {
  props: {
    placeholder: figma.string("Placeholder"),
    type: figma.enum("Type", {
      Text: "text",
      Email: "email",
      Password: "password",
      Number: "number",
      Search: "search",
    }),
    disabled: figma.boolean("Disabled"),
  },
  example: ({ placeholder, type, disabled }) => (
    <Input type={type} placeholder={placeholder} disabled={disabled} />
  ),
})
