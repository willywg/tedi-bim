// Lightweight polyfill for BufferGeometry merge used by web-ifc-three
// Supports common attributes (position, normal, uv) and index; adds groups when useGroups=true
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

function mergeGeometries(geometries, useGroups = false) {
  if (!Array.isArray(geometries) || geometries.length === 0) return null

  // Clone to avoid mutating inputs
  const geoms = geometries.map((g) => g.clone())

  // Ensure all have same attribute set
  const keys = new Set()
  geoms.forEach((g) => Object.keys(g.attributes).forEach((k) => keys.add(k)))
  const attrKeys = Array.from(keys)

  // Ensure index exists and track vertex offsets
  const indices = []
  const positions = []
  const normals = []
  const uvs = []
  const groups = []
  let indexOffset = 0

  geoms.forEach((g, idx) => {
    ensureIndex(g)
    const pos = g.getAttribute("position")
    const nor = g.getAttribute("normal")
    const uv = g.getAttribute("uv")
    const idxAttr = g.getIndex()

    // Collect
    positions.push(pos.array)
    if (nor) normals.push(nor.array)
    if (uv) uvs.push(uv.array)

    const idxArray = idxAttr.array
    const idxArrayShifted = new (idxArray.constructor)(idxArray.length)
    for (let i = 0; i < idxArray.length; i++) idxArrayShifted[i] = idxArray[i] + indexOffset
    indices.push(idxArrayShifted)

    if (useGroups) groups.push({ start: indices.reduce((a, b) => a + b.length, 0), count: idxArray.length, materialIndex: idx })

    indexOffset += pos.count
  })

  const merged = new BufferGeometry()
  const indexTyped = indices[0] instanceof Uint32Array ? Uint32Array : indices[0] instanceof Uint16Array ? Uint16Array : Uint32Array
  merged.setIndex(new BufferAttribute(concatTypedArrays(indices), 1))

  const posItemSize = geoms[0].getAttribute("position").itemSize
  merged.setAttribute("position", new BufferAttribute(concatTypedArrays(positions), posItemSize))
  if (normals.length) {
    const nSize = geoms[0].getAttribute("normal").itemSize
    merged.setAttribute("normal", new BufferAttribute(concatTypedArrays(normals), nSize))
  }
  if (uvs.length) {
    const uSize = geoms[0].getAttribute("uv").itemSize
    merged.setAttribute("uv", new BufferAttribute(concatTypedArrays(uvs), uSize))
  }

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

// CommonJS-style exports to satisfy esbuild interop for named/default imports
const api = { mergeGeometries, mergeBufferGeometries: mergeGeometries }
// Named
exports.mergeGeometries = mergeGeometries
exports.mergeBufferGeometries = mergeGeometries
// Default
module.exports = api
