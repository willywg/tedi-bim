declare module "three/examples/jsm/controls/OrbitControls" {
  import { Camera, EventDispatcher, Vector3 } from "three"
  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement)
    enableDamping: boolean
    maxDistance: number
    target: Vector3
    update(): void
    reset(): void
    dispose(): void
  }
}

declare module "three/examples/jsm/controls/OrbitControls.js" {
  export * from "three/examples/jsm/controls/OrbitControls"
}
