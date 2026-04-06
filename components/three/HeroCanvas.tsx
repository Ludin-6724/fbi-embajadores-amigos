"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, Center } from "@react-three/drei";
import * as random from "maath/random/dist/maath-random.esm";
import * as THREE from "three";

function CelestialParticles() {
  const ref = useRef<THREE.Points>(null);
  const [particleCount, setParticleCount] = useState(800);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setParticleCount(200);
    }
  }, []);
  
  // Create particles within a sphere
  const sphere = useMemo(() => 
    random.inSphere(new Float32Array(particleCount * 3), { radius: 3 }) as Float32Array
  , [particleCount]);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.x -= delta / 10;
      ref.current.rotation.y -= delta / 15;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={ref} positions={sphere} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#D4A017"
          size={0.02}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0.6}
        />
      </Points>
    </group>
  );
}

function DivineSymbol() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.3;
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
    }
  });

  return (
    <Center>
      <mesh ref={meshRef}>
        {/* Abstract star/cross symbol */}
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial 
          color="#D4A017" 
          wireframe 
          transparent
          opacity={0.8}
          emissive="#D4A017"
          emissiveIntensity={0.5}
        />
      </mesh>
    </Center>
  );
}

export default function HeroCanvas() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 4], fov: 60 }}>
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 10, 10]} />
        <CelestialParticles />
        <DivineSymbol />
      </Canvas>
    </div>
  );
}
