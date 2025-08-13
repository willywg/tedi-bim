import { Box, Flex, Spinner, Text } from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
// Ensure BVH helpers are attached before IFCLoader uses them
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh"
;(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree
;(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree
;(THREE.Mesh.prototype as any).raycast = acceleratedRaycast
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { IFCLoader } from "web-ifc-three/IFCLoader"

import Toolbar from "@/components/BIM/Toolbar"
import { useBimStore } from "@/store/bimStore"

export default function Viewer3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const ifcLoaderRef = useRef<IFCLoader | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const modelGroupRef = useRef<THREE.Group | null>(null)
  const highlightMatRef = useRef<THREE.MeshLambertMaterial | null>(null)
  const currentModelIdRef = useRef<number | null>(null)

  const setSelectedElementId = useBimStore((s) => s.setSelectedElementId)
  const setPropsForId = useBimStore((s) => s.setPropertiesForId)
  const setQtyForId = useBimStore((s) => s.setQuantitiesForId)
  const propsMap = useBimStore((s) => s.propertiesById)
  const qtyMap = useBimStore((s) => s.quantitiesById)
  const [isLoading, setIsLoading] = useState(false)

  // Init three scene
  useEffect(() => {
    const container = containerRef.current!
    const canvas = canvasRef.current!
    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    // Light background like the mockup
    scene.background = new THREE.Color(0xf5f6fa)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
    camera.position.set(8, 8, 8)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controlsRef.current = controls

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 1.0)
    hemi.position.set(0, 200, 0)
    scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(10, 10, 10)
    scene.add(dir)

    // Ground
    const grid = new THREE.GridHelper(50, 50, 0xcccccc, 0xeeeeee)
    scene.add(grid)

    // Group for models
    const group = new THREE.Group()
    scene.add(group)
    modelGroupRef.current = group

    // Highlight material
    highlightMatRef.current = new THREE.MeshLambertMaterial({
      color: 0xffa500,
      transparent: true,
      opacity: 0.6,
      depthTest: true,
    })

    // IFC Loader
    const ifcLoader = new IFCLoader()
    // Use local wasm matching the installed web-ifc version
    // We copied web-ifc.wasm to /public/wasm/web-ifc.wasm
    ifcLoader.ifcManager.setWasmPath("/wasm/")
    // Enable BVH acceleration for more robust raycasting/selection
    try {
      ;(ifcLoader.ifcManager as any).setupThreeMeshBVH(THREE)
      // optional: reduce triangle threshold warnings (model-specific)
    } catch {}
    ifcLoaderRef.current = ifcLoader

    let raf = 0
    const renderLoop = () => {
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(renderLoop)
    }
    renderLoop()

    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      controls.dispose()
      renderer.dispose()
    }
  }, [])

  const zoomExtents = () => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!scene || !camera || !controls) return
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3()).length()
    const center = box.getCenter(new THREE.Vector3())
    controls.reset()
    camera.near = size / 100
    camera.far = size * 100
    camera.updateProjectionMatrix()
    controls.maxDistance = size * 10
    camera.position.copy(center)
    camera.position.x += size / 2.0
    camera.position.y += size / 5.0
    camera.position.z += size / 2.0
    camera.lookAt(center)
    controls.target.copy(center)
  }

  const applyZoom = (factor: number) => {
    const controls = controlsRef.current
    const cam = cameraRef.current as THREE.PerspectiveCamera | THREE.OrthographicCamera | null
    if (!controls || !cam) return

    const isPerspective = (cam as any).isPerspectiveCamera
    const isOrthographic = (cam as any).isOrthographicCamera

    if (isPerspective) {
      const dir = new THREE.Vector3()
      dir.subVectors(cam.position, controls.target)
      dir.multiplyScalar(factor)
      cam.position.copy(controls.target).add(dir)
      cam.updateProjectionMatrix()
    } else if (isOrthographic) {
      const o = cam as THREE.OrthographicCamera
      // zoom in => increase zoom, zoom out => decrease
      o.zoom = Math.max(0.1, Math.min(10, o.zoom / factor))
      o.updateProjectionMatrix()
    }
    controls.update()
  }

  const zoomIn = () => applyZoom(0.85) // move closer
  const zoomOut = () => applyZoom(1.0 / 0.85) // move away

  const clearSelection = () => {
    setSelectedElementId(null)
    const ifc = ifcLoaderRef.current?.ifcManager
    if (!ifc) return
    const modelID = currentModelIdRef.current
    if (modelID == null) return
    ifc.removeSubset(modelID, undefined)
  }

  // Helper: fetch properties and QTO for an element and store in Zustand
  const fetchPropsAndQuantities = async (expressId: number) => {
    const ifc = ifcLoaderRef.current?.ifcManager
    const modelId = currentModelIdRef.current
    if (!ifc || modelId == null) return
    try {
      const props = await ifc.getItemProperties(modelId, expressId, true)
      // Property Sets including resolved nested props if supported
      const psets = await ifc.getPropertySets(modelId, expressId, true)
      const quantities: Record<string, number> = {}
      // Parse IfcElementQuantity sets
      if (Array.isArray(psets)) {
        for (const ps of psets as any[]) {
          const qArr = ps?.Quantities || ps?.HasQuantities || []
          if (Array.isArray(qArr)) {
            for (const q of qArr) {
              const name = q?.Name?.value || q?.Name
              const val = q?.VolumeValue ?? q?.AreaValue ?? q?.LengthValue ?? q?.CountValue ?? q?.WeightValue
              if (name && typeof val === 'number') {
                quantities[name] = val
              }
            }
          }
        }
      }
      setPropsForId(expressId, { ...(props as any), propertySets: psets })
      setQtyForId(expressId, quantities)
    } catch (e) {
      // Swallow errors but keep UX responsive
      console.warn('Failed to fetch IFC props/QTO', e)
    }
  }

  // Pick and highlight
  useEffect(() => {
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    const ifc = ifcLoaderRef.current?.ifcManager
    if (!renderer || !scene || !camera || !ifc) return

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onClick = async (event: MouseEvent) => {
      const rect = (renderer.domElement as HTMLCanvasElement).getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      
      const modelID = currentModelIdRef.current
      if (modelID == null) {
        clearSelection()
        return
      }
      
      try {
        // Cast ray and get intersection
        raycaster.setFromCamera(mouse, camera)
        const modelGroup = modelGroupRef.current
        if (!modelGroup) {
          clearSelection()
          return
        }
        
        const intersects = raycaster.intersectObjects(modelGroup.children, true)
        console.debug('Raycast intersects count:', intersects.length)
        if (!intersects.length) {
          clearSelection()
          return
        }
        
        // Helper to resolve modelID from object hierarchy
        const resolveModelId = (obj: any): number | undefined => {
          let cur: any = obj
          while (cur) {
            if (typeof cur.modelID === 'number') return cur.modelID
            cur = cur.parent
          }
          return undefined
        }
        // Prefer hits that have 'expressID' attribute (more reliable)
        let validHit = intersects.find(hit => {
          const obj = hit.object as any
          const objModelId = resolveModelId(obj)
          const g: THREE.BufferGeometry | undefined = (obj && obj.geometry) as any
          const hasExpress = !!g?.getAttribute && !!g.getAttribute('expressID')
          return objModelId === modelID && hit.faceIndex != null && hasExpress
        })
        // Fallback: accept any IFC hit with a faceIndex
        if (!validHit) {
          validHit = intersects.find(hit => {
            const obj = hit.object as any
            const objModelId = resolveModelId(obj)
            return objModelId === modelID && hit.faceIndex != null
          })
          if (!validHit) {
            console.debug('No valid IFC hit found (even fallback)')
          } else {
            console.debug('Using fallback IFC hit without expressID attribute')
          }
        }
        
        if (!validHit) {
          clearSelection()
          return
        }
        
        // Compute expressID from the picked face using web-ifc
        let expressID: number | null = null
        const hitObj = validHit.object as THREE.Mesh
        const geom = hitObj.geometry as THREE.BufferGeometry
        const faceIndex = validHit.faceIndex as number
        if (geom && Number.isInteger(faceIndex)) {
          try {
            const pos = geom.getAttribute('position') as THREE.BufferAttribute | undefined
            const idx = geom.getIndex()
            const expressAttr = (geom as any).getAttribute?.('expressID')
            // Verbose diagnostics to track the geometry state at pick time
            console.debug('IFC pick diagnostics', {
              posExists: !!pos,
              idxExists: !!idx,
              idxCount: idx?.count,
              faceIndex,
              hasExpressIdAttr: !!expressAttr,
              drawRange: (geom as any).drawRange,
            })
            if (!pos) {
              console.warn('Geometry has no position attribute; cannot compute expressID')
            } else if (!idx) {
              console.warn('Geometry has no index after pick; cannot compute expressID')
            } else if (idx.count % 3 !== 0) {
              console.warn('Geometry index not divisible by 3; invalid triangle buffer')
            } else if (faceIndex < 0 || faceIndex * 3 + 2 >= idx.count) {
              console.warn('faceIndex out of range for geometry index', { faceIndex, indexCount: idx.count })
            } else {
              // web-ifc API: getExpressId(bufferGeometry, faceIndex)
              try {
                expressID = (ifc as any).getExpressId(geom, faceIndex)
              } catch (e) {
                console.warn('getExpressId failed', e)
                // Fallback: derive expressID from geometry attribute if present
                const exprAttr: any = (geom as any).getAttribute?.('expressID')
                if (exprAttr) {
                  try {
                    const iAttr = geom.getIndex()
                    const triStart = faceIndex * 3
                    const getIndexAt = (j: number) => {
                      if (!iAttr) return triStart + j
                      if (typeof (iAttr as any).getX === 'function') return (iAttr as any).getX(triStart + j)
                      if ((iAttr as any).array) return (iAttr as any).array[triStart + j]
                      return triStart + j
                    }
                    const v0 = getIndexAt(0)
                    const v1 = getIndexAt(1)
                    const v2 = getIndexAt(2)
                    const getIdAt = (vi: number) => {
                      if (typeof exprAttr.getX === 'function') return exprAttr.getX(vi)
                      if (exprAttr.array) return exprAttr.array[vi]
                      return undefined
                    }
                    const id0 = getIdAt(v0)
                    const id1 = getIdAt(v1)
                    const id2 = getIdAt(v2)
                    console.debug('Fallback expressID candidates', { v0, v1, v2, id0, id1, id2 })
                    const nums = [id0, id1, id2].filter((n) => typeof n === 'number' && !Number.isNaN(n)) as number[]
                    if (nums.length) {
                      // pick majority value; if tie, pick first
                      const counts = new Map<number, number>()
                      nums.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1))
                      let best = nums[0]
                      let bestC = 0
                      counts.forEach((c, n) => { if (c > bestC) { best = n; bestC = c } })
                      expressID = Math.round(best)
                    }
                  } catch (fallbackErr) {
                    console.warn('Fallback expressID derivation failed', fallbackErr)
                  }
                }
              }
            }
          } catch (e) {
            console.warn('getExpressId failed (outer)', e)
          }
        }

        if (expressID != null && typeof expressID === 'number') {
          const mat = highlightMatRef.current!
          ifc.createSubset({
            modelID,
            ids: [expressID],
            material: mat,
            scene,
            removePrevious: true,
          })
          console.debug('Created subset for expressID', expressID, 'modelID', modelID)
          setSelectedElementId(expressID)
          // Fetch props/QTO if missing in cache
          const hasProps = propsMap[String(expressID)] != null
          const hasQty = qtyMap[String(expressID)] != null
          if (!hasProps || !hasQty) {
            fetchPropsAndQuantities(expressID)
          }
        } else {
          console.warn("Could not determine expressID for selected object")
          clearSelection()
        }
      } catch (error) {
        console.warn("Failed to handle IFC selection:", error)
        clearSelection()
      }
    }

    renderer.domElement.addEventListener("click", onClick)
    return () => {
      renderer.domElement.removeEventListener("click", onClick)
    }
  }, [setSelectedElementId])

  const loadIFCFile = async (file: File) => {
    const loader = ifcLoaderRef.current
    const group = modelGroupRef.current
    const scene = sceneRef.current
    if (!loader || !group || !scene) return

    // Clear previous
    group.clear()
    currentModelIdRef.current = null
    clearSelection()

    const url = URL.createObjectURL(file)
    setIsLoading(true)
    try {
      // Type defs for IFCLoader may not include loadAsync; cast to any.
      const ifcModel = await (loader as any).loadAsync(url)
      group.add(ifcModel)
      currentModelIdRef.current = (ifcModel as any).modelID ?? null
      // Improve mesh quality flags
      ;(ifcModel as any).traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
          // Ensure geometry has an index; web-ifc selection requires indexed triangles
          const geom: THREE.BufferGeometry | undefined = child.geometry
          if (geom && !geom.getIndex()) {
            const posAttr = geom.getAttribute("position") as THREE.BufferAttribute | undefined
            if (posAttr) {
              const count = posAttr.count
              const indices = new Uint32Array(count)
              for (let i = 0; i < count; i++) indices[i] = i
              geom.setIndex(new THREE.BufferAttribute(indices, 1))
            }
          }
        }
      })
      zoomExtents()
    } finally {
      setIsLoading(false)
      URL.revokeObjectURL(url)
    }
  }

  return (
    <Flex direction="column" p={3} borderWidth="1px" rounded="md" h="100%">
      <Toolbar onLoadFile={loadIFCFile} onZoomExtents={zoomExtents} onClearSelection={clearSelection} onZoomIn={zoomIn} onZoomOut={zoomOut} />
      <Box mt={3} ref={containerRef} h="70vh" w="100%" position="relative" bg="#f5f6fa" borderRadius="md" overflow="hidden">
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
        {isLoading && (
          <Flex position="absolute" inset={0} align="center" justify="center" bg="rgba(255,255,255,0.7)" direction="column" gap={2}>
            <Spinner color="teal.500" size="lg" />
            <Text color="gray.700" fontSize="sm">Cargando IFC...</Text>
          </Flex>
        )}
      </Box>
    </Flex>
  )
}
