import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Float, Html, RoundedBox, Sphere, Text } from '@react-three/drei'
import { Suspense, useState, useRef, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// Level definitions
interface PipeSegment {
  start: [number, number, number]
  end: [number, number, number]
  color: string
}

interface Pin {
  id: number
  position: [number, number, number]
  blocksFlow: number[] // which pipe indices this pin blocks
  pulled: boolean
}

interface Level {
  id: number
  name: string
  pipes: PipeSegment[]
  pins: Pin[]
  targetOrder: number[] // correct order to pull pins
  description: string
}

const LEVELS: Level[] = [
  {
    id: 1,
    name: "First Flow",
    description: "Pull the pin to drain the water!",
    pipes: [
      { start: [0, 2, 0], end: [0, 0, 0], color: '#3498db' },
    ],
    pins: [
      { id: 1, position: [0, 1, 0.8], blocksFlow: [0], pulled: false }
    ],
    targetOrder: [1]
  },
  {
    id: 2,
    name: "Double Trouble",
    description: "Red first, then blue!",
    pipes: [
      { start: [-1.5, 2, 0], end: [-1.5, 0, 0], color: '#e74c3c' },
      { start: [1.5, 2, 0], end: [1.5, 0, 0], color: '#3498db' },
    ],
    pins: [
      { id: 1, position: [-1.5, 1, 0.8], blocksFlow: [0], pulled: false },
      { id: 2, position: [1.5, 1, 0.8], blocksFlow: [1], pulled: false }
    ],
    targetOrder: [1, 2]
  },
  {
    id: 3,
    name: "Color Mix",
    description: "Don't let colors mix! Drain green first.",
    pipes: [
      { start: [-1, 2.5, 0], end: [-1, 1, 0], color: '#2ecc71' },
      { start: [1, 2.5, 0], end: [1, 1, 0], color: '#f39c12' },
      { start: [0, 1, 0], end: [0, -1, 0], color: '#9b59b6' },
    ],
    pins: [
      { id: 1, position: [-1, 1.5, 0.8], blocksFlow: [0], pulled: false },
      { id: 2, position: [1, 1.5, 0.8], blocksFlow: [1], pulled: false },
      { id: 3, position: [0, 0, 0.8], blocksFlow: [2], pulled: false }
    ],
    targetOrder: [1, 3, 2]
  },
  {
    id: 4,
    name: "Triple Cascade",
    description: "Drain from bottom to top!",
    pipes: [
      { start: [0, 3, 0], end: [0, 2, 0], color: '#e74c3c' },
      { start: [0, 2, 0], end: [0, 1, 0], color: '#3498db' },
      { start: [0, 1, 0], end: [0, 0, 0], color: '#2ecc71' },
    ],
    pins: [
      { id: 1, position: [0, 2.5, 0.8], blocksFlow: [0], pulled: false },
      { id: 2, position: [0, 1.5, 0.8], blocksFlow: [1], pulled: false },
      { id: 3, position: [0, 0.5, 0.8], blocksFlow: [2], pulled: false }
    ],
    targetOrder: [3, 2, 1]
  },
  {
    id: 5,
    name: "The Maze",
    description: "Navigate the water through!",
    pipes: [
      { start: [-2, 2, 0], end: [0, 2, 0], color: '#1abc9c' },
      { start: [0, 2, 0], end: [0, 0, 0], color: '#1abc9c' },
      { start: [0, 0, 0], end: [2, 0, 0], color: '#1abc9c' },
      { start: [2, 0, 0], end: [2, -2, 0], color: '#1abc9c' },
    ],
    pins: [
      { id: 1, position: [-1, 2, 0.8], blocksFlow: [0], pulled: false },
      { id: 2, position: [0, 1, 0.8], blocksFlow: [1], pulled: false },
      { id: 3, position: [1, 0, 0.8], blocksFlow: [2], pulled: false },
      { id: 4, position: [2, -1, 0.8], blocksFlow: [3], pulled: false }
    ],
    targetOrder: [1, 2, 3, 4]
  }
]

// Water material with animated flow
function WaterTube({ start, end, color, flowing }: { start: [number, number, number], end: [number, number, number], color: string, flowing: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const waterRef = useRef<THREE.Mesh>(null!)
  const [fillLevel, setFillLevel] = useState(1)

  const direction = new THREE.Vector3(
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2]
  )
  const length = direction.length()
  const center = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2
  ] as [number, number, number]

  // Calculate rotation to align with direction
  const up = new THREE.Vector3(0, 1, 0)
  const axis = new THREE.Vector3().crossVectors(up, direction.normalize())
  const angle = Math.acos(up.dot(direction.normalize()))
  const quaternion = new THREE.Quaternion().setFromAxisAngle(axis.length() > 0.001 ? axis.normalize() : new THREE.Vector3(1, 0, 0), axis.length() > 0.001 ? angle : 0)

  useFrame((state, delta) => {
    if (flowing && fillLevel > 0) {
      setFillLevel(prev => Math.max(0, prev - delta * 0.5))
    }
    if (waterRef.current) {
      const time = state.clock.elapsedTime
      waterRef.current.scale.y = fillLevel
      waterRef.current.position.y = -length * (1 - fillLevel) / 2
    }
  })

  return (
    <group position={center} quaternion={quaternion}>
      {/* Outer glass tube */}
      <mesh ref={meshRef}>
        <cylinderGeometry args={[0.35, 0.35, length, 32, 1, true]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.2}
          roughness={0.1}
          metalness={0.1}
          transmission={0.9}
          thickness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Water inside */}
      {fillLevel > 0 && (
        <mesh ref={waterRef}>
          <cylinderGeometry args={[0.28, 0.28, length * fillLevel, 32]} />
          <meshPhysicalMaterial
            color={color}
            transparent
            opacity={0.85}
            roughness={0.2}
            metalness={0.3}
            transmission={0.3}
            thickness={1}
          />
        </mesh>
      )}

      {/* Glass caps */}
      <mesh position={[0, length / 2, 0]}>
        <sphereGeometry args={[0.35, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.15} roughness={0.1} transmission={0.95} />
      </mesh>
      <mesh position={[0, -length / 2, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[0.35, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.15} roughness={0.1} transmission={0.95} />
      </mesh>
    </group>
  )
}

// Interactive Pin component
function Pin({ position, pulled, onPull }: { position: [number, number, number], pulled: boolean, onPull: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [pullProgress, setPullProgress] = useState(0)
  const groupRef = useRef<THREE.Group>(null!)

  useFrame((state, delta) => {
    if (pulled && pullProgress < 1) {
      setPullProgress(prev => Math.min(1, prev + delta * 4))
    }
    if (groupRef.current) {
      // Animate pull out
      groupRef.current.position.z = position[2] + pullProgress * 1.5
      // Add wobble when hovered
      if (hovered && !pulled) {
        groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 10) * 0.05
      } else {
        groupRef.current.rotation.z *= 0.9
      }
    }
  })

  if (pullProgress >= 1) return null

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); if (!pulled) onPull(); }}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      {/* Pin head - golden sphere */}
      <Float speed={hovered ? 5 : 0} rotationIntensity={hovered ? 0.2 : 0} floatIntensity={hovered ? 0.1 : 0}>
        <Sphere args={[0.25, 32, 32]} position={[0, 0, 0.3]}>
          <meshStandardMaterial
            color={hovered ? '#ffd700' : '#daa520'}
            metalness={0.9}
            roughness={0.1}
            emissive={hovered ? '#ffd700' : '#000000'}
            emissiveIntensity={hovered ? 0.3 : 0}
          />
        </Sphere>
      </Float>

      {/* Pin shaft */}
      <mesh position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.8, 16]} />
        <meshStandardMaterial color="#b8860b" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  )
}

// Bubbles particle effect
function Bubbles({ active, position, color }: { active: boolean, position: [number, number, number], color: string }) {
  const bubblesRef = useRef<THREE.InstancedMesh>(null!)
  const count = 20
  const dummy = new THREE.Object3D()
  const speeds = useRef(Array.from({ length: count }, () => Math.random() * 0.5 + 0.5))
  const offsets = useRef(Array.from({ length: count }, () => Math.random() * Math.PI * 2))

  useFrame((state) => {
    if (!bubblesRef.current || !active) return

    for (let i = 0; i < count; i++) {
      const t = state.clock.elapsedTime * speeds.current[i] + offsets.current[i]
      dummy.position.set(
        position[0] + Math.sin(t * 2) * 0.3,
        position[1] + ((t * 0.5) % 2) - 1,
        position[2] + Math.cos(t * 3) * 0.3
      )
      dummy.scale.setScalar(Math.sin(t) * 0.05 + 0.08)
      dummy.updateMatrix()
      bubblesRef.current.setMatrixAt(i, dummy.matrix)
    }
    bubblesRef.current.instanceMatrix.needsUpdate = true
  })

  if (!active) return null

  return (
    <instancedMesh ref={bubblesRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshPhysicalMaterial color={color} transparent opacity={0.6} transmission={0.8} />
    </instancedMesh>
  )
}

// Main puzzle scene
function PuzzleScene({ level, onPinPull, pins, gameState }: {
  level: Level,
  onPinPull: (pinId: number) => void,
  pins: Pin[],
  gameState: 'playing' | 'won' | 'lost'
}) {
  return (
    <group>
      {/* Background panel */}
      <RoundedBox args={[8, 8, 0.3]} position={[0, 0, -1]} radius={0.2}>
        <meshStandardMaterial color="#1a1f3a" metalness={0.3} roughness={0.8} />
      </RoundedBox>

      {/* Decorative frame */}
      <mesh position={[0, 0, -0.8]}>
        <torusGeometry args={[4.5, 0.1, 16, 100]} />
        <meshStandardMaterial color="#2a3f6a" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Pipes */}
      {level.pipes.map((pipe, i) => {
        const pinsBlockingThis = pins.filter(p => p.blocksFlow.includes(i))
        const isFlowing = pinsBlockingThis.every(p => p.pulled)
        return (
          <WaterTube
            key={i}
            start={pipe.start}
            end={pipe.end}
            color={pipe.color}
            flowing={isFlowing}
          />
        )
      })}

      {/* Pins */}
      {pins.map((pin) => (
        <Pin
          key={pin.id}
          position={pin.position}
          pulled={pin.pulled}
          onPull={() => onPinPull(pin.id)}
        />
      ))}

      {/* Bubbles for flowing water */}
      {level.pipes.map((pipe, i) => {
        const pinsBlockingThis = pins.filter(p => p.blocksFlow.includes(i))
        const isFlowing = pinsBlockingThis.every(p => p.pulled)
        return (
          <Bubbles
            key={`bubbles-${i}`}
            active={isFlowing}
            position={pipe.end}
            color={pipe.color}
          />
        )
      })}

      {/* Win/Lose Text */}
      {gameState === 'won' && (
        <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
          <Text
            position={[0, 0, 2]}
            fontSize={1}
            color="#2ecc71"
            anchorX="center"
            anchorY="middle"
            font="https://fonts.gstatic.com/s/fredokaone/v14/k3kUo8kEI-tA1RRcTZGmTmHBA6aF8Bf_.woff"
          >
            LEVEL CLEAR!
          </Text>
        </Float>
      )}
      {gameState === 'lost' && (
        <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
          <Text
            position={[0, 0, 2]}
            fontSize={0.8}
            color="#e74c3c"
            anchorX="center"
            anchorY="middle"
            font="https://fonts.gstatic.com/s/fredokaone/v14/k3kUo8kEI-tA1RRcTZGmTmHBA6aF8Bf_.woff"
          >
            WRONG ORDER!
          </Text>
        </Float>
      )}
    </group>
  )
}

// Main game component
export default function App() {
  const [currentLevel, setCurrentLevel] = useState(0)
  const [pins, setPins] = useState<Pin[]>(LEVELS[0].pins.map(p => ({ ...p })))
  const [pullOrder, setPullOrder] = useState<number[]>([])
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing')
  const [showInstructions, setShowInstructions] = useState(true)

  const level = LEVELS[currentLevel]

  const resetLevel = useCallback(() => {
    setPins(LEVELS[currentLevel].pins.map(p => ({ ...p, pulled: false })))
    setPullOrder([])
    setGameState('playing')
  }, [currentLevel])

  const nextLevel = useCallback(() => {
    if (currentLevel < LEVELS.length - 1) {
      setCurrentLevel(prev => prev + 1)
    } else {
      setCurrentLevel(0) // Loop back
    }
  }, [currentLevel])

  useEffect(() => {
    resetLevel()
  }, [currentLevel, resetLevel])

  const handlePinPull = useCallback((pinId: number) => {
    if (gameState !== 'playing') return

    const newOrder = [...pullOrder, pinId]
    setPullOrder(newOrder)

    // Update pin state
    setPins(prev => prev.map(p =>
      p.id === pinId ? { ...p, pulled: true } : p
    ))

    // Check if this follows the correct order
    const expectedPin = level.targetOrder[newOrder.length - 1]
    if (pinId !== expectedPin) {
      setGameState('lost')
      setTimeout(resetLevel, 1500)
      return
    }

    // Check if level complete
    if (newOrder.length === level.targetOrder.length) {
      setGameState('won')
    }
  }, [pullOrder, level, gameState, resetLevel])

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0f1a 0%, #1a1f3a 50%, #0a1628 100%)' }}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 md:w-64 md:h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #3498db 0%, transparent 70%)', animation: 'float 8s ease-in-out infinite' }} />
        <div className="absolute bottom-20 right-10 w-48 h-48 md:w-80 md:h-80 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #e74c3c 0%, transparent 70%)', animation: 'float 10s ease-in-out infinite reverse' }} />
        <div className="absolute top-1/2 left-1/3 w-24 h-24 md:w-40 md:h-40 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #2ecc71 0%, transparent 70%)', animation: 'float 6s ease-in-out infinite 2s' }} />
      </div>

      {/* Header UI */}
      <div className="absolute top-0 left-0 right-0 z-10 p-3 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
          <div className="flex items-center gap-3 md:gap-4">
            <h1 className="text-xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: 'Fredoka One, cursive', color: '#f0e6d3', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              <span style={{ color: '#3498db' }}>WATER</span> <span style={{ color: '#f39c12' }}>OUT</span>
            </h1>
            <div className="px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-bold" style={{ background: 'linear-gradient(135deg, #f39c12, #e67e22)', color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
              Level {currentLevel + 1}
            </div>
          </div>

          <div className="flex gap-2 md:gap-3">
            <button
              onClick={resetLevel}
              className="px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #34495e, #2c3e50)',
                color: '#f0e6d3',
                fontFamily: 'Nunito, sans-serif',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
              }}
            >
              Restart
            </button>
            {gameState === 'won' && (
              <button
                onClick={nextLevel}
                className="px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all hover:scale-105 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
                  color: '#fff',
                  fontFamily: 'Nunito, sans-serif',
                  boxShadow: '0 4px 15px rgba(46,204,113,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                  animation: 'pulse 1s ease-in-out infinite'
                }}
              >
                Next Level
              </button>
            )}
          </div>
        </div>

        {/* Level description */}
        <div className="mt-2 md:mt-4 px-3 md:px-4 py-2 rounded-xl inline-block" style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}>
          <p className="text-xs md:text-sm" style={{ fontFamily: 'Nunito, sans-serif', color: '#a0aec0' }}>
            {level.description}
          </p>
        </div>
      </div>

      {/* Instructions overlay */}
      {showInstructions && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="max-w-md w-full p-6 md:p-8 rounded-3xl text-center" style={{ background: 'linear-gradient(135deg, #1a1f3a, #2a3f6a)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6" style={{ fontFamily: 'Fredoka One, cursive', color: '#f0e6d3' }}>
              How to Play
            </h2>
            <div className="space-y-3 md:space-y-4 text-left text-sm md:text-base" style={{ fontFamily: 'Nunito, sans-serif', color: '#a0aec0' }}>
              <p className="flex items-start gap-3">
                <span className="text-xl md:text-2xl">🔘</span>
                <span>Click the <strong style={{ color: '#daa520' }}>golden pins</strong> to pull them out</span>
              </p>
              <p className="flex items-start gap-3">
                <span className="text-xl md:text-2xl">💧</span>
                <span>Water will <strong style={{ color: '#3498db' }}>flow</strong> through unpinned tubes</span>
              </p>
              <p className="flex items-start gap-3">
                <span className="text-xl md:text-2xl">🎯</span>
                <span>Pull pins in the <strong style={{ color: '#2ecc71' }}>correct order</strong> to solve each puzzle</span>
              </p>
              <p className="flex items-start gap-3">
                <span className="text-xl md:text-2xl">🔄</span>
                <span>Drag to rotate the view, scroll to zoom</span>
              </p>
            </div>
            <button
              onClick={() => setShowInstructions(false)}
              className="mt-6 md:mt-8 px-6 md:px-8 py-3 rounded-xl text-base md:text-lg font-bold transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #3498db, #2980b9)',
                color: '#fff',
                fontFamily: 'Nunito, sans-serif',
                boxShadow: '0 4px 20px rgba(52,152,219,0.4)'
              }}
            >
              Start Playing!
            </button>
          </div>
        </div>
      )}

      {/* Level selector */}
      <div className="absolute bottom-16 md:bottom-20 left-0 right-0 z-10 flex justify-center gap-1.5 md:gap-2 px-4 overflow-x-auto pb-2">
        {LEVELS.map((l, i) => (
          <button
            key={l.id}
            onClick={() => setCurrentLevel(i)}
            className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full text-xs md:text-sm font-bold transition-all hover:scale-110"
            style={{
              background: i === currentLevel
                ? 'linear-gradient(135deg, #f39c12, #e67e22)'
                : 'rgba(255,255,255,0.1)',
              color: i === currentLevel ? '#fff' : '#a0aec0',
              fontFamily: 'Nunito, sans-serif',
              boxShadow: i === currentLevel ? '0 4px 15px rgba(243,156,18,0.4)' : 'none'
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        className="touch-none"
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0a0f1a']} />
        <fog attach="fog" args={['#0a0f1a', 10, 25]} />

        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <directionalLight position={[-5, 3, -5]} intensity={0.3} color="#3498db" />
        <pointLight position={[0, 0, 5]} intensity={0.5} color="#f39c12" />

        <Suspense fallback={null}>
          <PuzzleScene
            level={level}
            onPinPull={handlePinPull}
            pins={pins}
            gameState={gameState}
          />
          <Environment preset="night" />
        </Suspense>

        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={15}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.5}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3 md:p-4 text-center">
        <p className="text-xs" style={{ fontFamily: 'Nunito, sans-serif', color: 'rgba(160,174,192,0.5)' }}>
          Requested by <a href="https://twitter.com/imjastory" target="_blank" rel="noopener noreferrer" className="hover:underline">@imjastory</a> · Built by <a href="https://twitter.com/clonkbot" target="_blank" rel="noopener noreferrer" className="hover:underline">@clonkbot</a>
        </p>
      </div>

      {/* Global styles */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}
