import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BOARD, type Tile } from "../game/data";
import type { GameState, Player } from "../game/types";

export function tilePosition(id: number): [number, number] {
  const spacing = 1.32,
    extent = 4 * spacing;
  if (id <= 8) return [extent - id * spacing, extent];
  if (id <= 16) return [-extent, extent - (id - 8) * spacing];
  if (id <= 24) return [-extent + (id - 16) * spacing, -extent];
  return [extent, -extent + (id - 24) * spacing];
}
function textureLabel(
  text: string,
  sub: string,
  color = "#263d39",
  background = "",
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 512, 256);
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.font = `bold ${text.length > 6 ? 60 : 108}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillText(text, 256, 125, 480);
  ctx.font = '500 43px "PingFang SC", sans-serif';
  ctx.fillText(sub, 256, 201, 480);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function Label({
  text,
  sub = "",
  color,
  width = 1,
  height = 0.5,
  position = [0, 0.22, 0],
  rotate = 0,
}: {
  text: string;
  sub?: string;
  color?: string;
  width?: number;
  height?: number;
  position?: [number, number, number];
  rotate?: number;
}) {
  const map = useMemo(() => textureLabel(text, sub, color), [text, sub, color]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, rotate]} position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} />
    </mesh>
  );
}
function Building({
  color,
  height = 1,
  position = [0, 0, 0],
  hotel = false,
}: {
  color: string;
  height?: number;
  position?: [number, number, number];
  hotel?: boolean;
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[hotel ? 0.5 : 0.34, height, 0.38]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      <mesh castShadow position={[0, height + 0.04, 0]}>
        <boxGeometry args={[hotel ? 0.56 : 0.4, 0.08, 0.44]} />
        <meshStandardMaterial color={hotel ? "#d7b573" : "#eef1e6"} />
      </mesh>
      {[0.3, 0.62, 0.94]
        .filter((y) => y < height)
        .map((y) => (
          <group key={y}>
            <mesh position={[0, y, 0.196]}>
              <boxGeometry args={[hotel ? 0.35 : 0.22, 0.09, 0.01]} />
              <meshStandardMaterial
                color="#def0e9"
                emissive="#cce1ca"
                emissiveIntensity={0.15}
              />
            </mesh>
            <mesh position={[0.176, y, 0]}>
              <boxGeometry args={[0.01, 0.09, 0.22]} />
              <meshStandardMaterial color="#d4e3da" />
            </mesh>
          </group>
        ))}
    </group>
  );
}
function Tree({
  position,
  size = 1,
}: {
  position: [number, number, number];
  size?: number;
}) {
  return (
    <group position={position} scale={size}>
      <mesh castShadow position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.035, 0.05, 0.36, 6]} />
        <meshStandardMaterial color="#8b7560" />
      </mesh>
      <mesh castShadow position={[0, 0.48, 0]}>
        <icosahedronGeometry args={[0.23, 1]} />
        <meshStandardMaterial color="#92b980" flatShading />
      </mesh>
      <mesh castShadow position={[0.09, 0.39, 0.04]}>
        <icosahedronGeometry args={[0.17, 1]} />
        <meshStandardMaterial color="#aec995" flatShading />
      </mesh>
    </group>
  );
}
function TileMesh({
  tile,
  state,
  selected,
  onSelect,
}: {
  tile: Tile;
  state: GameState | null;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const [x, z] = tilePosition(tile.id),
    e = state?.estates[tile.id];
  const [hover, setHover] = useState(false);
  const owner =
    e?.owner !== null && e?.owner !== undefined
      ? state!.players[e.owner]
      : null;
  const rotate =
    tile.id <= 8
      ? 0
      : tile.id <= 16
        ? -Math.PI / 2
        : tile.id <= 24
          ? Math.PI
          : Math.PI / 2;
  return (
    <group
      position={[x, selected === tile.id ? 0.08 : 0, z]}
      rotation={[0, rotate, 0]}
    >
      <mesh
        castShadow
        receiveShadow
        position={[0, 0.08, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(tile.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <boxGeometry args={[1.23, 0.2, 1.23]} />
        <meshStandardMaterial
          color={
            selected === tile.id
              ? "#eaffbe"
              : hover
                ? "#ffffed"
                : e?.mortgaged
                  ? "#bfc7bd"
                  : "#faf9ef"
          }
          roughness={0.9}
        />
      </mesh>
      <mesh position={[0, 0.185, -0.44]}>
        <boxGeometry args={[1.23, 0.02, 0.25]} />
        <meshStandardMaterial color={tile.color} />
      </mesh>
      {owner && (
        <mesh position={[0, 0.19, 0.53]}>
          <boxGeometry args={[1.23, 0.025, 0.08]} />
          <meshStandardMaterial color={owner.color} />
        </mesh>
      )}
      <Label
        text={tile.short}
        sub={
          tile.price
            ? `₡ ${tile.price}`
            : tile.kind === "start"
              ? "+ 200"
              : tile.kind === "tax"
                ? "− 120"
                : ""
        }
        width={1.13}
        height={0.56}
        position={[0, 0.2, 0.25]}
      />
      {tile.kind === "property" && (
        <group position={[0, 0.2, -0.17]}>
          {!e?.level ? (
            <Building color={tile.color} height={0.3} />
          ) : e.level === 5 ? (
            <Building color={tile.color} height={0.92} hotel />
          ) : (
            Array.from({ length: e.level }, (_, i) => (
              <Building
                key={i}
                color={tile.color}
                height={0.42}
                position={[
                  ((i % 2) - 0.5) * 0.44,
                  0,
                  Math.floor(i / 2) * 0.34 - 0.17,
                ]}
              />
            ))
          )}
        </group>
      )}
      {tile.kind === "station" && (
        <group position={[0, 0.27, -0.15]}>
          <mesh castShadow>
            <boxGeometry args={[0.65, 0.2, 0.3]} />
            <meshStandardMaterial color="#748f9b" />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <boxGeometry args={[0.72, 0.12, 0.38]} />
            <meshStandardMaterial color="#e0b97c" />
          </mesh>
        </group>
      )}
      {tile.kind === "utility" && (
        <mesh castShadow position={[0, 0.4, -0.18]}>
          <cylinderGeometry args={[0.2, 0.25, 0.4, 10]} />
          <meshStandardMaterial color={tile.color} />
        </mesh>
      )}
      {[
        "chance",
        "market",
        "jail",
        "goJail",
        "start",
        "parking",
        "tax",
      ].includes(tile.kind) && (
        <Label
          text={
            tile.kind === "chance"
              ? "?"
              : tile.kind === "market"
                ? "✦"
                : tile.kind === "start"
                  ? "➜"
                  : tile.kind === "parking"
                    ? "P"
                    : tile.kind === "tax"
                      ? "₡"
                      : "▥"
          }
          color={tile.color}
          width={0.6}
          height={0.45}
          position={[0, 0.205, -0.13]}
        />
      )}
      {!!e?.boost && (
        <mesh position={[0.48, 0.5, -0.4]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial
            color="#ffbc59"
            emissive="#ffbc59"
            emissiveIntensity={0.5}
          />
        </mesh>
      )}
    </group>
  );
}
function City() {
  return (
    <group position={[0, 0.05, 0]}>
      <mesh receiveShadow position={[0, -0.04, 0]}>
        <boxGeometry args={[9.13, 0.22, 9.13]} />
        <meshStandardMaterial color="#d1dfc7" />
      </mesh>
      <mesh receiveShadow position={[0, 0.077, -0.9]}>
        <boxGeometry args={[8.95, 0.025, 0.62]} />
        <meshStandardMaterial color="#bccbc2" />
      </mesh>
      <mesh receiveShadow position={[-1.1, 0.079, -0.1]}>
        <boxGeometry args={[0.62, 0.025, 8.95]} />
        <meshStandardMaterial color="#bccbc2" />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-4.1 + i * 0.55, 0.098, -0.9]}
        >
          <planeGeometry args={[0.23, 0.025]} />
          <meshBasicMaterial color="#edf0da" />
        </mesh>
      ))}
      <Label
        text="CITY CIRCUIT"
        sub="MAKE THE CITY YOURS"
        color="#506a51"
        width={5.8}
        height={2.9}
        position={[0.8, 0.1, 2.9]}
      />
      <group position={[-3.5, 0.09, -3.15]}>
        <Building color="#b7cad1" height={1.2} position={[0, 0, 0]} />
        <Building color="#ede2c7" height={1.7} position={[0.65, 0, 0.15]} />
        <Building color="#bbbaa6" height={0.8} position={[1.35, 0, -0.15]} />
        <Building color="#b6c5d4" height={0.65} position={[0.05, 0, 1.12]} />
        <Building color="#d6bba8" height={1.2} position={[0.78, 0, 1.08]} />
        <Building color="#dbdaca" height={0.75} position={[1.4, 0, 0.9]} />
      </group>
      <group position={[0.15, 0.09, -3.2]}>
        <Building color="#c6d5b5" height={0.9} position={[0, 0, 0]} />
        <Building color="#e3c0a1" height={1.45} position={[0.7, 0, 0.12]} />
        <Building
          color="#b6cacb"
          height={2.15}
          position={[1.45, 0, -0.1]}
          hotel
        />
        <Building color="#c6b7d0" height={1.2} position={[2.25, 0, 0.23]} />
        <Building color="#d6ceb8" height={0.65} position={[0.2, 0, 1.1]} />
        <Building color="#b7c8bf" height={0.95} position={[1.15, 0, 1.05]} />
        <Building color="#e0c9ac" height={0.7} position={[2.13, 0, 1.15]} />
      </group>
      <group position={[-3.1, 0.1, 1.2]}>
        <mesh receiveShadow position={[0, 0, 0]}>
          <cylinderGeometry args={[1, 1, 0.1, 40]} />
          <meshStandardMaterial color="#b0c6a1" />
        </mesh>
        <mesh position={[0, 0.085, 0]}>
          <cylinderGeometry args={[0.54, 0.65, 0.12, 40]} />
          <meshStandardMaterial color="#dce2d3" />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.44, 0.44, 0.02, 40]} />
          <meshStandardMaterial
            color="#87bfcb"
            metalness={0.25}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.025, 0.055, 0.35, 12]} />
          <meshStandardMaterial color="#e0e4da" />
        </mesh>
        <Tree position={[-0.65, 0.08, -0.42]} size={1.5} />
        <Tree position={[0.65, 0.08, 0.32]} size={1.3} />
      </group>
      {[
        [-4, 3.4],
        [-3.3, 3.5],
        [-2.5, 3.6],
        [3.4, 0.2],
        [3.45, 1],
        [3.5, 1.8],
        [3.5, 2.6],
        [3.3, -3.8],
        [-3.8, -0.12],
        [0.3, 0.25],
        [1.15, 0.3],
        [2, 0.3],
      ].map(([x, z], i) => (
        <Tree key={i} position={[x, 0.09, z]} size={i % 2 ? 1.15 : 0.95} />
      ))}
      <mesh position={[0.8, 0.1, 1.28]}>
        <boxGeometry args={[3.2, 0.1, 0.12]} />
        <meshStandardMaterial color="#bdccae" />
      </mesh>
    </group>
  );
}
function Pawn({ player, state }: { player: Player; state: GameState }) {
  const invalidate = useThree((s) => s.invalidate);
  const ref = useRef<THREE.Group>(null);
  const animation = useRef({
    elapsed: 0,
    from: player.position,
    steps: 0,
    teleport: false,
  });
  const angle = (player.id * Math.PI * 2) / state.players.length;
  const offset: [number, number] = [
    Math.cos(angle) * 0.28,
    Math.sin(angle) * 0.28,
  ];
  useEffect(() => {
    if (state.movement?.player === player.id) {
      animation.current = {
        elapsed: 0,
        from: state.movement.from,
        steps: state.movement.steps,
        teleport: state.movement.teleport,
      };
    }
    invalidate();
  }, [state.movement?.id, player.id, player.position, invalidate]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const a = animation.current;
    a.elapsed += Math.min(dt, 0.05);
    if (a.steps && a.elapsed < a.steps * 0.105) {
      const progress = a.elapsed / 0.105,
        step = Math.floor(progress),
        fraction = progress - step;
      const start = tilePosition((a.from + step) % 32),
        end = tilePosition((a.from + step + 1) % 32);
      ref.current.position.set(
        THREE.MathUtils.lerp(start[0], end[0], fraction) + offset[0],
        0.24 + Math.sin(fraction * Math.PI) * 0.2,
        THREE.MathUtils.lerp(start[1], end[1], fraction) + offset[1],
      );
      invalidate();
    } else {
      const [x, z] = tilePosition(player.position);
      ref.current.position.set(x + offset[0], 0.24, z + offset[1]);
    }
  });
  if (player.bankrupt) return null;
  const [x, z] = tilePosition(player.position);
  return (
    <group ref={ref} position={[x + offset[0], 0.24, z + offset[1]]}>
      <mesh castShadow position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.12, 0.17, 0.12, 16]} />
        <meshStandardMaterial
          color={player.color}
          metalness={0.15}
          roughness={0.3}
        />
      </mesh>
      <mesh castShadow position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.065, 0.105, 0.3, 16]} />
        <meshStandardMaterial
          color={player.color}
          metalness={0.15}
          roughness={0.3}
        />
      </mesh>
      <mesh castShadow position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.115, 16, 16]} />
        <meshStandardMaterial
          color={player.color}
          metalness={0.15}
          roughness={0.3}
        />
      </mesh>
      {state.current === player.id && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.027, 0]}>
          <ringGeometry args={[0.18, 0.22, 32]} />
          <meshBasicMaterial color={player.color} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
function CameraRig({ view }: { view: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const factor = Math.max(1, 1.22 / (size.width / size.height));
    camera.position.set(
      view % 3 === 1 ? 0 : view % 3 === 2 ? -11.1 * factor : 11.1 * factor,
      view % 3 === 1 ? 20 * factor : 13.8 * factor,
      view % 3 === 1 ? 1 : 13.8 * factor,
    );
    camera.lookAt(0, -1.25, 0);
    camera.updateProjectionMatrix();
  }, [view, camera, size.width, size.height]);
  return (
    <OrbitControls
      key={`${view}-${size.width}-${size.height}`}
      makeDefault
      target={[0, -1.25, 0]}
      enablePan
      screenSpacePanning={false}
      minDistance={10}
      maxDistance={38}
      minPolarAngle={0.08}
      maxPolarAngle={Math.PI / 2.55}
      enableDamping
      dampingFactor={0.08}
    />
  );
}
function Scene({ state, selected, onSelect, view }: BoardProps) {
  return (
    <>
      <color attach="background" args={["#e3ebe0"]} />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#f5f2dd", "#aebea3", 1]} />
      <directionalLight
        castShadow
        position={[-7, 15, 7]}
        intensity={2.4}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0003}
      />
      <mesh receiveShadow position={[0, -0.66, 0]}>
        <boxGeometry args={[12.45, 0.75, 12.45]} />
        <meshStandardMaterial color="#a7baa0" roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[0, -0.24, 0]}>
        <boxGeometry args={[12.2, 0.12, 12.2]} />
        <meshStandardMaterial color="#c4d1b8" />
      </mesh>
      <City />
      {BOARD.map((t) => (
        <TileMesh
          key={t.id}
          tile={t}
          state={state}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
      {state?.players.map((p) => (
        <Pawn key={p.id} player={p} state={state} />
      ))}
      <ContactShadows
        frames={1}
        position={[0, -1.06, 0]}
        opacity={0.32}
        scale={23}
        blur={2.8}
        far={10}
        resolution={512}
        color="#55634b"
      />
      <CameraRig view={view} />
    </>
  );
}
type BoardProps = {
  state: GameState | null;
  selected: number | null;
  onSelect: (id: number) => void;
  view: number;
};
function FlatBoard({ state, onSelect }: BoardProps) {
  return (
    <div className="flat-board" role="img" aria-label="城市棋盘兼容视图">
      <div className="flat-center">
        <span>
          CITY
          <br />
          CIRCUIT
        </span>
        <small>浏览器未能启用 3D，已切换兼容棋盘</small>
      </div>
      {BOARD.map((t) => {
        const [x, z] = tilePosition(t.id);
        return (
          <button
            key={t.id}
            style={{
              gridColumn: Math.round(x / 1.32) + 5,
              gridRow: Math.round(z / 1.32) + 5,
              borderTopColor: t.color,
            }}
            onClick={() => onSelect(t.id)}
          >
            <strong>{t.short}</strong>
            <small>{t.price ? `₡${t.price}` : t.subtitle}</small>
            <div>
              {state?.players
                .filter((p) => p.position === t.id && !p.bankrupt)
                .map((p) => (
                  <i key={p.id} style={{ background: p.color }} />
                ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
class BoardBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function Board(props: BoardProps) {
  return (
    <BoardBoundary fallback={<FlatBoard {...props} />}>
      <Canvas
        shadows
        frameloop="demand"
        camera={{ position: [13, 15, 16], fov: 39 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        fallback={<FlatBoard {...props} />}
      >
        <Suspense fallback={null}>
          <Scene {...props} />
        </Suspense>
      </Canvas>
    </BoardBoundary>
  );
}
