import { PointerEvent, useEffect, useRef, WheelEvent } from "react"
import * as THREE from "three"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { createAdminBoundaryPositions, createEarthMaps } from "./earthMaps"

export type GlobeLocation = {
  cameraDistance: number
  latitude: number
  longitude: number
  key: number
}

export default function EarthGlobe({
  targetLocation,
}: {
  targetLocation: GlobeLocation | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotation = useRef({ x: -0.12, y: -0.32 })
  const cameraDistance = useRef(3.25)
  const drag = useRef({
    active: false,
    x: 0,
    y: 0,
    rotationX: 0,
    rotationY: 0,
  })

  useEffect(() => {
    if (!targetLocation) return

    // SphereGeometry's UV seam puts 90°W at the camera-facing center.
    const longitude = -THREE.MathUtils.degToRad(targetLocation.longitude + 90)
    const nearestTurn =
      Math.round((rotation.current.y - longitude) / (Math.PI * 2)) * Math.PI * 2

    rotation.current = {
      x: THREE.MathUtils.clamp(
        THREE.MathUtils.degToRad(targetLocation.latitude),
        -1.35,
        1.35,
      ),
      y: longitude + nearestTurn,
    }
    cameraDistance.current = targetLocation.cameraDistance
  }, [targetLocation])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.z = 3.25
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12

    const maps = createEarthMaps()
    const texture = new THREE.CanvasTexture(maps.color)
    const bumpTexture = new THREE.CanvasTexture(maps.height)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
    bumpTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()
    const geometry = new THREE.SphereGeometry(1, 192, 192)
    const material = new THREE.MeshPhysicalMaterial({
      map: texture,
      bumpMap: bumpTexture,
      bumpScale: 0.035,
      roughness: 0.46,
      metalness: 0.12,
      clearcoat: 0.62,
      clearcoatRoughness: 0.22,
      sheen: 0.18,
      sheenColor: new THREE.Color(0x8d60a7),
    })
    const earth = new THREE.Mesh(geometry, material)
    earth.rotation.set(rotation.current.x, rotation.current.y, 0)
    scene.add(earth)

    const boundaryGeometry = new LineSegmentsGeometry()
    boundaryGeometry.setPositions(createAdminBoundaryPositions())
    const boundaryOutlineMaterial = new LineMaterial({
      color: 0x321c05,
      linewidth: 4.6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const boundaryMaterial = new LineMaterial({
      color: 0xc4932c,
      linewidth: 2.2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const boundaryOutline = new LineSegments2(
      boundaryGeometry,
      boundaryOutlineMaterial,
    )
    const boundaryLines = new LineSegments2(boundaryGeometry, boundaryMaterial)
    boundaryOutline.renderOrder = 3
    boundaryLines.renderOrder = 4
    earth.add(boundaryOutline, boundaryLines)

    const rim = new THREE.Mesh(
      new THREE.SphereGeometry(1.016, 128, 128),
      new THREE.MeshBasicMaterial({
        color: 0xe2b65b,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.82,
      }),
    )
    earth.add(rim)

    scene.add(new THREE.HemisphereLight(0xead8ff, 0x09030f, 1.25))
    const keyLight = new THREE.DirectionalLight(0xffe5a2, 3.15)
    keyLight.position.set(-3.5, 4.5, 5.5)
    scene.add(keyLight)
    const purpleLight = new THREE.DirectionalLight(0x8752a8, 1.55)
    purpleLight.position.set(4, -1, 2)
    scene.add(purpleLight)
    const edgeLight = new THREE.PointLight(0xe2b65b, 1.4, 8)
    edgeLight.position.set(0, -3, -2)
    scene.add(edgeLight)

    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      renderer.setSize(width, height, false)
      boundaryOutlineMaterial.resolution.set(width, height)
      boundaryMaterial.resolution.set(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    let frame = 0
    const render = () => {
      earth.rotation.x += (rotation.current.x - earth.rotation.x) * 0.13
      earth.rotation.y += (rotation.current.y - earth.rotation.y) * 0.13
      camera.position.z += (cameraDistance.current - camera.position.z) * 0.12
      const boundaryOpacity = THREE.MathUtils.clamp(
        (3.24 - camera.position.z) / 0.22,
        0,
        1,
      )
      boundaryOutlineMaterial.opacity = boundaryOpacity
      boundaryMaterial.opacity = boundaryOpacity
      renderer.render(scene, camera)
      frame = window.requestAnimationFrame(render)
    }
    render()

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      geometry.dispose()
      material.dispose()
      texture.dispose()
      bumpTexture.dispose()
      boundaryGeometry.dispose()
      boundaryOutlineMaterial.dispose()
      boundaryMaterial.dispose()
      rim.geometry.dispose()
      ;(rim.material as THREE.Material).dispose()
      renderer.dispose()
    }
  }, [])

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
      rotationX: rotation.current.x,
      rotationY: rotation.current.y,
    }
  }

  function rotateGlobe(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return
    rotation.current = {
      x: Math.max(
        -1.35,
        Math.min(
          1.35,
          drag.current.rotationX + (event.clientY - drag.current.y) * 0.006,
        ),
      ),
      y: drag.current.rotationY + (event.clientX - drag.current.x) * 0.007,
    }
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    drag.current.active = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function zoomWithWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    cameraDistance.current = Math.min(
      4.1,
      Math.max(1.3, cameraDistance.current + event.deltaY * 0.0025),
    )
  }

  return (
    <div className="globe-stage">
      <div className="globe-zoom-controls" aria-label="Globe zoom controls">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => {
            cameraDistance.current = Math.max(
              1.3,
              cameraDistance.current - 0.35,
            )
          }}
        >
          +
        </button>
        <button
          className="fit-globe"
          type="button"
          aria-label="Fit entire globe"
          onClick={() => {
            cameraDistance.current = 3.25
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="6.5" />
            <path d="M8.5 4H4v4.5M15.5 4H20v4.5M8.5 20H4v-4.5M15.5 20H20v-4.5" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => {
            cameraDistance.current = Math.min(
              4.1,
              cameraDistance.current + 0.35,
            )
          }}
        >
          −
        </button>
      </div>
      <div className="globe-orbit orbit-one" />
      <div className="globe-orbit orbit-two" />
      <div
        className="earth-control"
        role="img"
        aria-label="Interactive 3D Earth. Click and drag to rotate."
        onPointerDown={startDrag}
        onPointerMove={rotateGlobe}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onWheel={zoomWithWheel}
      >
        <canvas ref={canvasRef} className="earth-canvas" />
      </div>
      <div className="globe-caption">
        <span className="drag-icon">↔</span>
        <div>
          <strong>Explore the world</strong>
          <span>Click and drag to rotate</span>
        </div>
      </div>
    </div>
  )
}
