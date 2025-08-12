import { Button, Flex, IconButton, Input } from "@chakra-ui/react"
import { useRef } from "react"
import { FiHome, FiZoomIn, FiZoomOut, FiUpload } from "react-icons/fi"

interface ToolbarProps {
  onLoadFile: (file: File) => void
  onZoomExtents?: () => void
  onClearSelection?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
}

export default function Toolbar({ onLoadFile, onZoomExtents, onClearSelection, onZoomIn, onZoomOut }: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement | null>(null)

  return (
    <Flex gap={2} wrap="wrap" align="center">
      <Input
        ref={fileRef}
        type="file"
        accept=".ifc,.IFC"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onLoadFile(f)
        }}
        w="auto"
      />
      <IconButton aria-label="Load IFC" title="Load IFC" size="sm" onClick={() => fileRef.current?.click()}>
        <FiUpload />
      </IconButton>
      <IconButton aria-label="Home / Fit" title="Home / Fit" size="sm" variant="outline" onClick={onZoomExtents}>
        <FiHome />
      </IconButton>
      <IconButton aria-label="Zoom In" title="Zoom In" size="sm" variant="outline" onClick={onZoomIn}>
        <FiZoomIn />
      </IconButton>
      <IconButton aria-label="Zoom Out" title="Zoom Out" size="sm" variant="outline" onClick={onZoomOut}>
        <FiZoomOut />
      </IconButton>
      <Button size="sm" variant="ghost" onClick={onClearSelection}>Clear</Button>
    </Flex>
  )
}
