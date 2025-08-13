// Custom polyfill for BufferGeometry merge used by web-ifc-three
// Merges index and ALL attributes present on inputs (e.g., position, normal, uv, expressID, etc.)
// Adds groups when useGroups=true. Preserves attribute itemSize and typed array constructors.
import { BufferGeometry, BufferAttribute } from "three"

function ensureIndex(geom) {
  if (!geom.getIndex()) {
    const position = geom.getAttribute("position")
    const indices = new Uint32Array(position.count)
    for (let i = 0; i < indices.length; i++) indices[i] = i
    geom.setIndex(new BufferAttribute(indices, 1))
  }
  return geom
}

function concatTypedArrays(arrays) {
  const length = arrays.reduce((a, b) => a + b.length, 0)
  const result = new arrays[0].constructor(length)
  let offset = 0
  for (const a of arrays) {
    result.set(a, offset)
    offset += a.length
  }
  return result
}

export function mergeGeometries(geometries, useGroups = false) {
  if (!Array.isArray(geometries) || geometries.length === 0) return null

  // Clone to avoid mutating inputs
  const geoms = geometries.map((g) => g.clone())

  // Collect the union of attribute keys present across geometries
  const keys = new Set()
  geoms.forEach((g) => Object.keys(g.attributes).forEach((k) => keys.add(k)))
  const attrKeys = Array.from(keys)

  // Ensure index exists and track vertex offsets
  const indices = []
  const attrArraysMap = new Map() // key -> { arrays: [], itemSize, ArrayType }
  const groups = []
  let indexOffset = 0

  geoms.forEach((g, idx) => {
    ensureIndex(g)
    const idxAttr = g.getIndex()

    // Collect all attributes present on this geometry
    attrKeys.forEach((key) => {
      const attr = g.getAttribute(key)
      if (attr) {
        const existing = attrArraysMap.get(key)
        if (!existing) {
          attrArraysMap.set(key, {
            arrays: [attr.array],
            itemSize: attr.itemSize,
            ArrayType: attr.array.constructor,
          })
        } else {
          // Sanity-check compatible itemSize and array types
          if (existing.itemSize !== attr.itemSize) {
            throw new Error(`mergeGeometries: attribute '${key}' itemSize mismatch`)
          }
          if (existing.ArrayType !== attr.array.constructor) {
            // Different typed array constructors; upcast to Float32Array as a fallback
            // But try to keep original type if possible
            // We'll just push; concat will use the first constructor
          }
          existing.arrays.push(attr.array)
        }
      }
    })

    const idxArray = idxAttr.array
    const idxArrayShifted = new (idxArray.constructor)(idxArray.length)
    for (let i = 0; i < idxArray.length; i++) idxArrayShifted[i] = idxArray[i] + indexOffset
    indices.push(idxArrayShifted)

    if (useGroups) groups.push({ count: idxArray.length, materialIndex: idx })

    const pos = g.getAttribute("position")
    indexOffset += pos ? pos.count : 0
  })

  const merged = new BufferGeometry()
  merged.setIndex(new BufferAttribute(concatTypedArrays(indices), 1))

  // Rebuild all attributes
  attrArraysMap.forEach((info, key) => {
    if (info.arrays.length) {
      const concatenated = concatTypedArrays(info.arrays)
      merged.setAttribute(key, new BufferAttribute(concatenated, info.itemSize))
    }
  })

  if (useGroups && groups.length) {
    let start = 0
    for (let i = 0; i < geoms.length; i++) {
      const g = geoms[i]
      const count = g.getIndex().count
      merged.addGroup(start, count, i)
      start += count
    }
  }

  merged.computeBoundingSphere()
  merged.computeBoundingBox()
  return merged
}

// Also export the alias name for compatibility
export const mergeBufferGeometries = mergeGeometries
export default { mergeGeometries, mergeBufferGeometries }
