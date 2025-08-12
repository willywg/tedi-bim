import { Box, Code, Heading, Stack, Text, Badge, Button } from "@chakra-ui/react"

import { useBimStore } from "@/store/bimStore"

export default function PropertiesPanel() {
  const selectedElementId = useBimStore((s) => s.selectedElementId)
  const propsMap = useBimStore((s) => s.propertiesById)
  const qtyMap = useBimStore((s) => s.quantitiesById)
  const addBudgetItem = useBimStore((s) => s.addBudgetItem)

  const props = selectedElementId ? (propsMap[String(selectedElementId)] as any) : undefined
  const qty = selectedElementId ? (qtyMap[String(selectedElementId)] as Record<string, number>) : undefined

  return (
    <Stack p={3} borderWidth="1px" rounded="md" h="100%">
      <Heading size="sm">Properties</Heading>
      {!selectedElementId ? (
        <Text color="gray.400">No element selected</Text>
      ) : (
        <>
          <Text>Selected: <Code>{selectedElementId}</Code></Text>
          <Box borderTopWidth="1px" my={2} />
          <Box>
            <Heading size="xs" mb={1}>Básicos</Heading>
            <Box fontSize="sm">
              <Text><Badge mr={2}>Name</Badge>{props?.Name?.value ?? props?.Name ?? '-'}</Text>
              <Text><Badge mr={2}>GlobalId</Badge>{props?.GlobalId?.value ?? props?.GlobalId ?? '-'}</Text>
              <Text><Badge mr={2}>Type</Badge>{props?.type ?? props?.__proto__?.constructor?.name ?? '-'}</Text>
            </Box>
          <Button mt={3} size="sm" colorScheme="teal" onClick={() => {
            if (!selectedElementId) return
            const name = props?.Name?.value ?? props?.Name ?? `Element ${selectedElementId}`
            const type = props?.type ?? props?.__proto__?.constructor?.name
            // pick a primary quantity if available
            const entries = qty ? Object.entries(qty) : []
            const primary = entries.find(([k]) => /Volume|Área|Area|Length|Count|Weight/i.test(k)) || entries[0]
            const item = {
              id: `${selectedElementId}-${Date.now()}`,
              expressId: selectedElementId,
              name,
              type,
              qtyName: primary?.[0],
              qtyValue: primary?.[1] as number | undefined,
            }
            addBudgetItem(item as any)
          }}>Agregar al presupuesto</Button>
          </Box>
          <Box mt={3}>
            <Heading size="xs" mb={1}>Quantities</Heading>
            {!qty || Object.keys(qty).length === 0 ? (
              <Text color="gray.400">Sin cantidades detectadas</Text>
            ) : (
              <Box fontSize="sm">
                {Object.entries(qty).map(([k, v]) => (
                  <Text key={k}><Badge mr={2}>{k}</Badge>{v}</Text>
                ))}
              </Box>
            )}
          </Box>
          <Box mt={3}>
            <Heading size="xs" mb={1}>Property Sets</Heading>
            <Code whiteSpace="pre" display="block" p={2}>
              {JSON.stringify(props?.propertySets ?? [], null, 2)}
            </Code>
          </Box>
        </>
      )}
    </Stack>
  )
}
