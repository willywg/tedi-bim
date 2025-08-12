import { Box, Flex, Spinner, Text } from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
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

    const onClick = (event: MouseEvent) => {
      const rect = (renderer.domElement as HTMLCanvasElement).getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(scene.children, true)
      if (!intersects.length) {
        clearSelection()
        return
      }
      const intersect = intersects[0]
      const faceIndex = intersect.faceIndex ?? null
      const object = intersect.object as THREE.Mesh
      const geometry = object.geometry as THREE.BufferGeometry
      const modelID = (object as any).modelID ?? currentModelIdRef.current
      if (faceIndex == null || !geometry || modelID == null) {
        clearSelection()
        return
      }
      const expressID = ifc.getExpressId(geometry, faceIndex)
      if (expressID != null) {
        currentModelIdRef.current = modelID
        const mat = highlightMatRef.current!
        ifc.createSubset({
          modelID,
          ids: [expressID],
          material: mat,
          scene,
          removePrevious: true,
        })
        setSelectedElementId(expressID)
        // Fetch props/QTO if missing in cache
        const hasProps = propsMap[String(expressID)] != null
        const hasQty = qtyMap[String(expressID)] != null
        if (!hasProps || !hasQty) {
          fetchPropsAndQuantities(expressID)
        }
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
