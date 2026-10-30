import { useEffect, useRef } from "react"
import * as THREE from "three"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { createAdminBoundaryPositions, createEarthMaps, pointOnGlobe } from "@/lib/earthMaps"
import { latLonFromPoint } from "@/lib/regions"

function glowTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 64
  const g = c.getContext("2d")
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, "rgba(255,246,220,1)")
  grad.addColorStop(0.25, "rgba(242,214,137,.85)")
  grad.addColorStop(0.6, "rgba(201,139,224,.35)")
  grad.addColorStop(1, "rgba(201,139,224,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

export default function EarthGlobe({
  targetLocation,
  pins = [],
  onPinClick,
  onRegionClick,
}) {
  const canvasRef = useRef(null)
  const three = useRef(null)
  const pinClick = useRef(onPinClick)
  pinClick.current = onPinClick
  const regionClick = useRef(onRegionClick)
  regionClick.current = onRegionClick
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
    const pinGroup = new THREE.Group()
    earth.add(pinGroup)
    const glow = glowTexture()
    three.current = { earth, camera, renderer, pinGroup, glow }

    const boundaryGeometry = new LineSegmentsGeometry()
    boundaryGeometry.setPositions(createAdminBoundaryPositions())
    const boundaryMaterial = new LineMaterial({
      color: 0x6b4a14,
      linewidth: 0.9,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const boundaryLines = new LineSegments2(boundaryGeometry, boundaryMaterial)
    boundaryLines.renderOrder = 4
    earth.add(boundaryLines)

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
      boundaryMaterial.resolution.set(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    let frame = 0
    let last = performance.now()
    const render = () => {
      const now = performance.now()
      const steps = Math.min((now - last) / (1000 / 60), 60)
      last = now
      const ease = (k) => 1 - Math.pow(1 - k, steps)
      earth.rotation.x += (rotation.current.x - earth.rotation.x) * ease(0.13)
      earth.rotation.y += (rotation.current.y - earth.rotation.y) * ease(0.13)
      camera.position.z += (cameraDistance.current - camera.position.z) * ease(0.12)
      const boundaryOpacity = THREE.MathUtils.clamp(
        (2.45 - camera.position.z) / 0.45,
        0,
        1,
      )
      boundaryMaterial.opacity = boundaryOpacity * 0.9
      boundaryLines.visible = boundaryOpacity > 0.01
      const pulse = 1 + Math.sin(now / 380) * 0.18
      const zoom = camera.position.z / 3.25
      pinGroup.children.forEach((pin) => {
        pin.children[0]?.scale.setScalar(zoom)
        pin.children[1]?.scale.setScalar(0.085 * zoom * pulse)
      })
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
      boundaryMaterial.dispose()
      rim.geometry.dispose()
      rim.material.dispose()
      glow.dispose()
      three.current = null
      renderer.dispose()
    }
  }, [])

  useEffect(() => {
    const t = three.current
    if (!t) return
    t.pinGroup.clear()
    const dot = new THREE.SphereGeometry(0.009, 12, 12)
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, toneMapped: false })
    const glowMat = new THREE.SpriteMaterial({ map: t.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)).forEach((p) => {
      const pin = new THREE.Group()
      pin.position.set(...pointOnGlobe([p.lon, p.lat]))
      const core = new THREE.Mesh(dot, dotMat)
      core.userData.track = p
      const halo = new THREE.Sprite(glowMat)
      halo.scale.setScalar(0.11)
      halo.userData.track = p
      pin.add(core, halo)
      t.pinGroup.add(pin)
    })
    return () => { dot.dispose(); dotMat.dispose(); glowMat.dispose() }
  }, [pins])

  function pickPin(event) {
    const t = three.current
    if (!t) return null
    const rect = event.currentTarget.getBoundingClientRect()
    const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(pointer, t.camera)
    const hits = ray.intersectObjects([t.earth, ...t.pinGroup.children.flatMap((g) => g.children)], false)
    const first = hits[0]
    if (!first) return null
    if (first.object.userData.track) return { track: first.object.userData.track }
    const local = t.earth.worldToLocal(first.point.clone())
    return { point: latLonFromPoint([local.x, local.y, local.z]) }
  }

  function startDrag(event) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
      rotationX: rotation.current.x,
      rotationY: rotation.current.y,
    }
  }

  function rotateGlobe(event) {
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

  function stopDrag(event) {
    const moved = Math.abs(event.clientX - drag.current.x) + Math.abs(event.clientY - drag.current.y)
    if (drag.current.active && moved < 6 && event.type === "pointerup") {
      const hit = pickPin(event)
      if (hit?.track) pinClick.current?.(hit.track)
      else if (hit?.point) regionClick.current?.(hit.point)
    }
    drag.current.active = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function zoomWithWheel(event) {
    event.preventDefault()
    cameraDistance.current = Math.min(
      4.1,
      Math.max(1.3, cameraDistance.current + event.deltaY * 0.0025),
    )
  }

  return (
    <div className="globe-stage" data-testid="earth-globe">
      <div className="globe-zoom-controls" aria-label="Globe zoom controls">
        <button
          type="button"
          aria-label="Zoom in"
          data-testid="globe-zoom-in"
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
          data-testid="globe-fit"
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
          data-testid="globe-zoom-out"
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
