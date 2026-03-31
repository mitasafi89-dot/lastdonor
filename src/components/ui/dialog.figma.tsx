import figma from "@figma/code-connect"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/**
 * Replace the Figma URL below with the actual URL of your Dialog component in Figma.
 * To get the URL: right-click the component in Figma > "Copy link to selection"
 */
figma.connect(Dialog, "https://figma.com/design/REPLACE_WITH_YOUR_FILE_ID/LastDonor?node-id=REPLACE", {
  props: {
    title: figma.string("Title"),
    description: figma.string("Description"),
  },
  example: ({ title, description }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
})
