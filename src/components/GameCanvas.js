import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';

const fallbackLocations = [
  { position: [-8, 1, -5], name: 'Ancient Ruins', color: 0x78716c },
  { position: [10, 1, 8], name: 'Magma Vault', color: 0xb45309 },
  { position: [-12, 1, 10], name: 'Storm Obelisk', color: 0x475569 },
  { position: [5, 1, -12], name: 'Shaded Cavern', color: 0x334155 },
  { position: [0, 1, 0], name: 'Central Sanctum', color: 0xfacc15 }
];

const GameCanvas = ({ currentLocation = 0, discoveredTreasures = [], onExploreLocation, locations = [] }) => {
  const islandRef = useRef();
  const [hoveredLocation, setHoveredLocation] = useState(null);

  const treasureLocations = locations.length > 0 ? locations : fallbackLocations;

  const trees = useMemo(() => {
    return Array.from({ length: 22 }).map((_, i) => {
      const angle = (i / 22) * Math.PI * 2;
      const radius = 12.5 + ((i * 7) % 5);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const canopy = 1.6 + ((i * 13) % 10) / 10;
      return { x, z, canopy };
    });
  }, []);

  useFrame((state) => {
    if (islandRef.current) {
      islandRef.current.rotation.y += 0.001;
    }
  });

  const handleLocationClick = (index) => {
    if (!discoveredTreasures.includes(index)) {
      onExploreLocation(index);
    }
  };

  return (
    <>
      <color attach="background" args={['#05070d']} />

      {/* Island Base */}
      <mesh ref={islandRef} position={[0, -1.1, 0]} receiveShadow>
        <cylinderGeometry args={[15, 20, 2.4, 32]} />
        <meshStandardMaterial color={0x4a2c1b} roughness={0.88} metalness={0.06} />
      </mesh>

      {/* Grass */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[15, 20, 0.1, 32]} />
        <meshStandardMaterial color={0x2f8f46} roughness={0.9} metalness={0.02} />
      </mesh>

      {/* Water ring */}
      <mesh position={[0, -1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[20.5, 32, 72]} />
        <meshStandardMaterial color={0x164e63} roughness={0.25} metalness={0.2} transparent opacity={0.72} />
      </mesh>

      {/* Treasure Locations */}
      {treasureLocations.map((location, index) => (
        <group key={index}>
          <mesh 
            position={location.position}
            onClick={() => handleLocationClick(index)}
            onPointerOver={() => setHoveredLocation(index)}
            onPointerOut={() => setHoveredLocation(null)}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial
              color={location.color}
              roughness={0.5}
              metalness={0.3}
              emissive={index === currentLocation ? 0x38bdf8 : 0x000000}
              emissiveIntensity={index === currentLocation ? 0.22 : 0}
            />
          </mesh>

          {hoveredLocation === index && (
            <mesh position={[location.position[0], location.position[1] + 2.4, location.position[2]]}>
              <boxGeometry args={[2.3, 0.35, 2.3]} />
              <meshBasicMaterial color={0x7dd3fc} transparent opacity={0.6} />
            </mesh>
          )}

          {/* Glow effect for undiscovered treasures */}
          {!discoveredTreasures.includes(index) && (
            <mesh position={[location.position[0], location.position[1] + 2.1, location.position[2]]}>
              <sphereGeometry args={[3.1, 18, 18]} />
              <meshBasicMaterial
                color={0xfbbf24}
                transparent
                opacity={0.22}
              />
            </mesh>
          )}

          {/* Collected marker */}
          {discoveredTreasures.includes(index) && (
            <mesh position={[location.position[0], location.position[1] + 2.1, location.position[2]]}>
              <octahedronGeometry args={[0.75, 0]} />
              <meshStandardMaterial
                color={0x34d399}
                emissive={0x34d399}
                emissiveIntensity={0.5}
                metalness={0.2}
                roughness={0.3}
              />
            </mesh>
          )}

          {/* Active selection ring */}
          {index === currentLocation && (
            <mesh position={[location.position[0], 0.2, location.position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.3, 1.8, 26]} />
              <meshBasicMaterial color={0x38bdf8} transparent opacity={0.85} />
            </mesh>
          )}
        </group>
      ))}

      {/* Trees */}
      {trees.map((tree, i) => (
        <group key={i} position={[tree.x, 0, tree.z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.28, 0.45, 2.8]} />
            <meshStandardMaterial color={0x6b3f23} roughness={0.95} />
          </mesh>
          <mesh position={[0, 2.4, 0]} castShadow>
            <sphereGeometry args={[tree.canopy, 10, 8]} />
            <meshStandardMaterial color={0x2f9a4d} roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* Lighting */}
      <hemisphereLight intensity={0.7} color={0xbfe8ff} groundColor={0x2f3f2f} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[18, 22, 10]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-14, 10, -10]} intensity={0.5} color={0xa855f7} />
      <pointLight position={[12, 8, 15]} intensity={0.45} color={0x22d3ee} />
    </>
  );
};

export default GameCanvas;
