import { Box, Container, Grid, GridItem, Heading } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"

import PropertiesPanel from "@/components/BIM/PropertiesPanel"
import BudgetPanel from "@/components/BIM/BudgetPanel"
import Viewer3D from "@/components/BIM/Viewer3D"

export const Route = createFileRoute("/_layout/bim")({
  component: BimPage,
})

function BimPage() {
  return (
    <Container maxW="7xl" py={6}>
      <Heading size="lg" mb={4}>
        BIM Viewer & Properties
      </Heading>
      <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr 1fr" }} gap={4}>
        <GridItem>
          <Viewer3D />
        </GridItem>
        <GridItem>
          <PropertiesPanel />
        </GridItem>
        <GridItem>
          <BudgetPanel />
        </GridItem>
      </Grid>
      <Box mt={4} color="gray.400" fontSize="sm">
        Demo: Selecting an element in the viewer updates the global Zustand store
        (`selectedElementId`), which the PropertiesPanel reads and renders.
      </Box>
    </Container>
  )
}
