import { Box, Button, Heading, HStack, Stack, Text, Code, Input } from "@chakra-ui/react"
import { useBimStore } from "@/store/bimStore"

export default function BudgetPanel() {
  const items = useBimStore((s) => s.budgetItems)
  const remove = useBimStore((s) => s.removeBudgetItem)
  const update = useBimStore((s) => s.updateBudgetItem)
  const clear = useBimStore((s) => s.clearBudget)

  const totalQty = items.reduce((acc, it) => acc + (it.qtyValue ?? 0), 0)
  const totalCost = items.reduce((acc, it) => acc + ((it.qtyValue ?? 0) * (it.unitPrice ?? 0)), 0)

  return (
    <Stack p={3} borderWidth="1px" rounded="md" h="100%">
      <HStack justify="space-between" mb={1}>
        <Heading size="sm">Presupuesto</Heading>
        <Button size="xs" variant="ghost" onClick={clear}>Vaciar</Button>
      </HStack>
      {items.length === 0 ? (
        <Text color="gray.400">Sin ítems aún</Text>
      ) : (
        <Box fontSize="sm">
          {items.map((it) => (
            <Box key={it.id} borderWidth="1px" rounded="md" p={2} mb={2}>
              <HStack justify="space-between" align="start">
                <Box>
                  <Text fontWeight="semibold">{it.name}</Text>
                  <Text color="gray.500">{it.type ?? "Elemento"} · ID <Code>{it.expressId}</Code></Text>
                  <HStack mt={2}>
                    <Input
                      placeholder="Cantidad"
                      value={it.qtyValue ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const v = parseFloat(e.target.value)
                        update(it.id, { qtyValue: Number.isFinite(v) ? v : undefined })
                      }}
                      w="32%"
                    />
                    <Input
                      placeholder="Unidad"
                      value={it.unit ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(it.id, { unit: e.target.value })}
                      w="28%"
                    />
                    <Input
                      placeholder="Precio unitario"
                      value={it.unitPrice ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const v = parseFloat(e.target.value)
                        update(it.id, { unitPrice: Number.isFinite(v) ? v : undefined })
                      }}
                      w="40%"
                    />
                  </HStack>
                  <Text mt={1} color="gray.600">Subtotal: <b>{((it.qtyValue ?? 0) * (it.unitPrice ?? 0)).toFixed(2)}</b></Text>
                </Box>
                <Button size="xs" variant="outline" onClick={() => remove(it.id)}>Quitar</Button>
              </HStack>
            </Box>
          ))}
          <Box borderTopWidth="1px" pt={2}>
            <Text>Total cantidades (suma simple): <b>{totalQty}</b></Text>
            <Text>Total costo: <b>{totalCost.toFixed(2)}</b></Text>
          </Box>
        </Box>
      )}
    </Stack>
  )
}
