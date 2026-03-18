import { useLocation, useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import React, { Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  Undo2,   
  Redo2,    
  GitBranch,
  Home,
  RectangleHorizontal,
  Square,
  Circle as CircleIcon,
  Armchair,
  Trash2,
  Sofa,
  Save,
  Sun,
} from "lucide-react";
import { supabase } from "../supabaseClient";

type Room = {
  length: number;
  width: number;
  height: number;
  wallColor: string;
  floorColor: string;
};

type RoomShape = "rectangle" | "square" | "circular" | "l-shape";
type FurnitureType = "CHAIR" | "DINING TABLE" | "SIDE TABLE" | "SOFA" | "BED";
type OpeningType = "DOOR" | "WINDOW";

type RoomConfig = {
  shape?: RoomShape;
  values?: Record<string, string>;
  wallColor?: string;
  floorColor?: string;
};

type RoomPx = {
  x: number;
  y: number;
  wPx: number;
  hPx: number;
};

type FurnitureModel = {
  id: string;
  type: FurnitureType;
  name: string;
  public_url: string;
  ftop_url: string | null;
  fpic_url: string | null;
  default_scale: number;
  rotation_y: number;
  width_m: number | null;
  depth_m: number | null;
};

type OpeningRow = {
  id: string;
  name: string;
  glb_path: string;
  type: OpeningType;
  created_at: string;
  "d&w_url": string | null;
};

type OpeningAsset = {
  id: string;
  name: string;
  public_url: string;
  type: OpeningType;
  fpic_url: string | null;
};

type BaseCanvasItem = {
  id: string;
  modelId: string;
  modelName: string;
  modelGlbUrl: string;
  modelTopUrl: string | null;
  modelPicUrl: string | null;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  wMeters: number;
  hMeters: number;
};

type FurnitureItem = BaseCanvasItem & {
  itemKind: "furniture";
  type: FurnitureType;
  color?: string;
};

type OpeningItem = BaseCanvasItem & {
  itemKind: "opening";
  type: OpeningType;
  wallId?: string;
};

type CanvasItem = FurnitureItem | OpeningItem;

type HistoryItem = {
  items: CanvasItem[];
  selectedId: string | null;
};

type LightSettings = {
  enabled: boolean;
  intensity: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  color: string;
};

type Viewer3DLocationState = {
  room?: Room;
  roomConfig?: RoomConfig;
  items?: CanvasItem[];
  pxPerMeter?: number;
  roomPx?: RoomPx;
};

const fallbackRoom: Room = {
  length: 5.5,
  width: 4.2,
  height: 2.8,
  wallColor: "#d1d5db",
  floorColor: "#fdf2f8",
};

const roomShapes = [
  {
    id: "rectangle" as RoomShape,
    name: "Rectangle",
    icon: RectangleHorizontal,
    description: "Standard rectangular room layout.",
    fields: [
      { key: "length", label: "Room length", unit: "m" },
      { key: "width", label: "Room width", unit: "m" },
      { key: "height", label: "Room height", unit: "m" },
    ],
  },
  {
    id: "l-shape" as RoomShape,
    name: "L-Shape",
    icon: GitBranch,
    description: "Useful for open-plan spaces or extensions.",
    fields: [
      { key: "mainLength", label: "Main length", unit: "m" },
      { key: "mainWidth", label: "Main width", unit: "m" },
      { key: "cutoutLength", label: "Cutout length", unit: "m" },
      { key: "cutoutWidth", label: "Cutout width", unit: "m" },
      { key: "height", label: "Room height", unit: "m" },
    ],
  },
  {
    id: "square" as RoomShape,
    name: "Square",
    icon: Square,
    description: "Balanced layout with equal sides.",
    fields: [
      { key: "side", label: "Side length", unit: "m" },
      { key: "height", label: "Room height", unit: "m" },
    ],
  },
  {
    id: "circular" as RoomShape,
    name: "Circular",
    icon: CircleIcon,
    description: "Curved room layout with diameter-based sizing.",
    fields: [
      { key: "diameter", label: "Diameter", unit: "m" },
      { key: "height", label: "Room height", unit: "m" },
    ],
  },
];

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
}

function toNum(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getShapeIcon(shape: RoomShape) {
  switch (shape) {
    case "rectangle":
      return RectangleHorizontal;
    case "square":
      return Square;
    case "circular":
      return CircleIcon;
    case "l-shape":
      return GitBranch;
    default:
      return RectangleHorizontal;
  }
}

function getDefaultShapeValues(shape: RoomShape): Record<string, number> {
  switch (shape) {
    case "rectangle":
      return { length: 5.5, width: 4.2, height: 2.8 };
    case "square":
      return { side: 4.0, height: 2.8 };
    case "circular":
      return { diameter: 5.0, height: 2.8 };
    case "l-shape":
      return {
        mainLength: 6.5,
        mainWidth: 4.5,
        cutoutLength: 2.0,
        cutoutWidth: 1.8,
        height: 2.8,
      };
    default:
      return { length: 5.5, width: 4.2, height: 2.8 };
  }
}

function buildShapeValues(room: Room, roomConfig?: RoomConfig): Record<string, number> {
  const shape = (roomConfig?.shape ?? "rectangle") as RoomShape;
  const values = roomConfig?.values ?? {};

  if (shape === "rectangle") {
    return {
      length: toNum(values.length, room.length),
      width: toNum(values.width, room.width),
      height: toNum(values.height, room.height),
    };
  }

  if (shape === "square") {
    return {
      side: toNum(values.side, room.length),
      height: toNum(values.height, room.height),
    };
  }

  if (shape === "circular") {
    return {
      diameter: toNum(values.diameter, room.length),
      height: toNum(values.height, room.height),
    };
  }

  return {
    mainLength: toNum(values.mainLength, room.length),
    mainWidth: toNum(values.mainWidth, room.width),
    cutoutLength: toNum(values.cutoutLength, 2),
    cutoutWidth: toNum(values.cutoutWidth, 1.8),
    height: toNum(values.height, room.height),
  };
}

function getNextShapeValues(
  nextShape: RoomShape,
  prev: Record<string, number>
): Record<string, number> {
  const defaults = getDefaultShapeValues(nextShape);

  if (nextShape === "rectangle") {
    const nextValues: Record<string, number> = {
      length: prev.length ?? prev.side ?? prev.diameter ?? prev.mainLength ?? defaults.length,
      width: prev.width ?? prev.side ?? prev.diameter ?? prev.mainWidth ?? defaults.width,
      height: prev.height ?? defaults.height,
    };
    return nextValues;
  }

  if (nextShape === "square") {
    const nextValues: Record<string, number> = {
      side:
        prev.side ??
        prev.length ??
        prev.width ??
        prev.diameter ??
        prev.mainLength ??
        defaults.side,
      height: prev.height ?? defaults.height,
    };
    return nextValues;
  }

  if (nextShape === "circular") {
    const nextValues: Record<string, number> = {
      diameter:
        prev.diameter ??
        prev.length ??
        prev.width ??
        prev.side ??
        prev.mainLength ??
        defaults.diameter,
      height: prev.height ?? defaults.height,
    };
    return nextValues;
  }

  const nextValues: Record<string, number> = {
    mainLength: prev.mainLength ?? prev.length ?? prev.side ?? defaults.mainLength,
    mainWidth: prev.mainWidth ?? prev.width ?? prev.side ?? defaults.mainWidth,
    cutoutLength: prev.cutoutLength ?? defaults.cutoutLength,
    cutoutWidth: prev.cutoutWidth ?? defaults.cutoutWidth,
    height: prev.height ?? defaults.height,
  };
  return nextValues;
}

function materialHasColor(
  material: THREE.Material
): material is THREE.Material & { color: THREE.Color } {
  return "color" in material && (material as { color?: unknown }).color instanceof THREE.Color;
}

function getTransformedItemCenterPx(
  item: Pick<CanvasItem, "x" | "y" | "rotation" | "scaleX" | "scaleY" | "wMeters" | "hMeters">,
  pxPerMeter: number
) {
  const wPx = item.wMeters * pxPerMeter * (item.scaleX ?? 1);
  const hPx = item.hMeters * pxPerMeter * (item.scaleY ?? 1);
  const radians = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const localCenterX = wPx / 2;
  const localCenterY = hPx / 2;

  const centerXPx = item.x + localCenterX * cos - localCenterY * sin;
  const centerYPx = item.y + localCenterX * sin + localCenterY * cos;

  return { centerXPx, centerYPx };
}

export default function Viewer3D() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as Viewer3DLocationState | null | undefined;

  const initialRoom = locationState?.room;
  const initialRoomConfig = locationState?.roomConfig;
  const roomMissing = !initialRoom;
  const baseRoom = initialRoom ?? fallbackRoom;

  const incomingItems: CanvasItem[] = locationState?.items ?? [];
  const initialPxPerMeter = locationState?.pxPerMeter;
  const initialRoomPx = locationState?.roomPx;

  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<CanvasItem[]>(incomingItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roomSetupOpen, setRoomSetupOpen] = useState(false);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<"furniture" | "openings">("furniture");
  const [furnitureTab, setFurnitureTab] = useState<FurnitureType>("CHAIR");
  const [openingTab, setOpeningTab] = useState<OpeningType>("DOOR");

  const [models, setModels] = useState<FurnitureModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [openingAssets, setOpeningAssets] = useState<OpeningAsset[]>([]);
  const [openingsLoading, setOpeningsLoading] = useState(false);
  const [openingsError, setOpeningsError] = useState<string | null>(null);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [showWallColorControl, setShowWallColorControl] = useState(false);
  const [wallColor, setWallColor] = useState(baseRoom.wallColor);
  const [wallTransparency, setWallTransparency] = useState(0);

  // Light control states
  const [showLightControl, setShowLightControl] = useState(false);
  const [lightSettings, setLightSettings] = useState<LightSettings>({
    enabled: true,
    intensity: 1.0,
    position: {
      x: baseRoom.length * 1.2,
      y: baseRoom.height * 1.5,
      z: baseRoom.width * 1.2,
    },
    color: "#ffffff",
  });

  // History states
  const [history, setHistory] = useState<HistoryItem[]>([{
    items: incomingItems,
    selectedId: null,
  }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  const isUndoRedoRef = useRef(false);

  const [selectedShape, setSelectedShape] = useState<RoomShape>(
    (initialRoomConfig?.shape ?? "rectangle") as RoomShape
  );
  const [editorShapeValues, setEditorShapeValues] = useState<Record<string, number>>(
    buildShapeValues(baseRoom, initialRoomConfig)
  );

  const activeShapeConfig =
    roomShapes.find((item) => item.id === selectedShape) ?? roomShapes[0];

  const effectiveRoom = useMemo<Room>(() => {
    if (selectedShape === "rectangle") {
      return {
        length: editorShapeValues.length ?? baseRoom.length,
        width: editorShapeValues.width ?? baseRoom.width,
        height: editorShapeValues.height ?? baseRoom.height,
        wallColor,
        floorColor: baseRoom.floorColor,
      };
    }

    if (selectedShape === "square") {
      const side = editorShapeValues.side ?? baseRoom.length;
      return {
        length: side,
        width: side,
        height: editorShapeValues.height ?? baseRoom.height,
        wallColor,
        floorColor: baseRoom.floorColor,
      };
    }

    if (selectedShape === "circular") {
      const diameter = editorShapeValues.diameter ?? baseRoom.length;
      return {
        length: diameter,
        width: diameter,
        height: editorShapeValues.height ?? baseRoom.height,
        wallColor,
        floorColor: baseRoom.floorColor,
      };
    }

    return {
      length: editorShapeValues.mainLength ?? baseRoom.length,
      width: editorShapeValues.mainWidth ?? baseRoom.width,
      height: editorShapeValues.height ?? baseRoom.height,
      wallColor,
      floorColor: baseRoom.floorColor,
    };
  }, [selectedShape, editorShapeValues, baseRoom, wallColor]);

  // Update light position when room dimensions change
  useEffect(() => {
    setLightSettings(prev => ({
      ...prev,
      position: {
        x: effectiveRoom.length * 1.2,
        y: effectiveRoom.height * 1.5,
        z: effectiveRoom.width * 1.2,
      }
    }));
  }, [effectiveRoom.length, effectiveRoom.height, effectiveRoom.width]);

  const liveRoomConfig = useMemo<RoomConfig>(
    () => ({
      shape: selectedShape,
      values: Object.fromEntries(
        Object.entries(editorShapeValues).map(([k, v]) => [k, String(v)])
      ),
      wallColor: effectiveRoom.wallColor,
      floorColor: effectiveRoom.floorColor,
    }),
    [selectedShape, editorShapeValues, effectiveRoom.wallColor, effectiveRoom.floorColor]
  );

  const STAGE_W = 1100;
  const STAGE_H = 650;

  const outerRoomMeters = useMemo(() => {
    if (selectedShape === "square") {
      return {
        width: editorShapeValues.side ?? 4,
        height: editorShapeValues.side ?? 4,
      };
    }
    if (selectedShape === "circular") {
      return {
        width: editorShapeValues.diameter ?? 5,
        height: editorShapeValues.diameter ?? 5,
      };
    }
    if (selectedShape === "l-shape") {
      return {
        width: editorShapeValues.mainLength ?? 6.5,
        height: editorShapeValues.mainWidth ?? 4.5,
      };
    }
    return {
      width: effectiveRoom.length,
      height: effectiveRoom.width,
    };
  }, [selectedShape, editorShapeValues, effectiveRoom.length, effectiveRoom.width]);

  const pxPerMeter = useMemo(() => {
    if (initialPxPerMeter) return initialPxPerMeter;
    const padding = 80;
    const maxW = STAGE_W - padding * 2;
    const maxH = STAGE_H - padding * 2;
    return Math.floor(Math.min(maxW / outerRoomMeters.width, maxH / outerRoomMeters.height));
  }, [initialPxPerMeter, outerRoomMeters.width, outerRoomMeters.height]);

  const roomPx = useMemo(() => {
    if (initialRoomPx) return initialRoomPx;
    const wPx = outerRoomMeters.width * pxPerMeter;
    const hPx = outerRoomMeters.height * pxPerMeter;
    const x = (STAGE_W - wPx) / 2;
    const y = (STAGE_H - hPx) / 2;
    return { x, y, wPx, hPx };
  }, [initialRoomPx, outerRoomMeters.width, outerRoomMeters.height, pxPerMeter]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const canMapFrom2D = !!pxPerMeter && !!roomPx;

  const ShapeIcon = getShapeIcon(selectedShape);

  const PAN_STEP = useMemo(
    () => Math.max(0.15, Math.min(effectiveRoom.length, effectiveRoom.width) * 0.06),
    [effectiveRoom.length, effectiveRoom.width]
  );

  const VERT_STEP = useMemo(
    () => Math.max(0.15, effectiveRoom.height * 0.08),
    [effectiveRoom.height]
  );

  // Update undo/redo availability
  useEffect(() => {
    setCanUndo(historyIndex > 0);
    setCanRedo(historyIndex < history.length - 1);
  }, [historyIndex, history.length]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // Save state to history whenever items or selectedId change
  useEffect(() => {
    // Don't save if this change came from undo/redo
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    const currentHistory = historyRef.current;
    const currentHistoryIndex = historyIndexRef.current;

    // Don't save on initial mount
    if (
      currentHistoryIndex === 0 &&
      currentHistory.length === 1 &&
      JSON.stringify(currentHistory[0].items) === JSON.stringify(items) &&
      currentHistory[0].selectedId === selectedId
    ) {
      return;
    }

    // Create new history entry
    const newHistory = currentHistory.slice(0, currentHistoryIndex + 1);
    newHistory.push({ items, selectedId });
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [items, selectedId]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex - 1;
      const previousState = history[newIndex];
      setItems(previousState.items);
      setSelectedId(previousState.selectedId);
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex + 1;
      const nextState = history[newIndex];
      setItems(nextState.items);
      setSelectedId(nextState.selectedId);
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setModelsLoading(true);
      setModelsError(null);

      const res = await supabase
        .from("furniture_models")
        .select("id,type,name,public_url,ftop_url,fpic_url,default_scale,rotation_y,width_m,depth_m")
        .order("created_at", { ascending: false });

      if (!alive) return;

      if (res.error) {
        setModelsError(res.error.message);
        setModels([]);
      } else {
        setModels((res.data ?? []) as FurnitureModel[]);
      }

      setModelsLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      setOpeningsLoading(true);
      setOpeningsError(null);

      const { data, error } = await supabase
        .from("doors_windows")
        .select('id, name, glb_path, type, created_at, "d&w_url"')
        .order("created_at", { ascending: false });

      if (!alive) return;

      if (error) {
        setOpeningsError(error.message);
        setOpeningAssets([]);
        setOpeningsLoading(false);
        return;
      }

      const mapped: OpeningAsset[] = ((data ?? []) as OpeningRow[]).map((row) => {
        const { data: publicData } = supabase.storage
          .from("Doors&Windows")
          .getPublicUrl(row.glb_path);

        return {
          id: row.id,
          name: row.name,
          public_url: publicData.publicUrl,
          type: row.type,
          fpic_url: row["d&w_url"] ?? null,
        };
      });

      setOpeningAssets(mapped);
      setOpeningsLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  function handleShapeChange(nextShape: RoomShape) {
    setSelectedShape(nextShape);
    setEditorShapeValues((prev) => getNextShapeValues(nextShape, prev));
  }

  function handleEditorShapeValueChange(key: string, value: string) {
    const n = Number(value);
    setEditorShapeValues((prev) => ({
      ...prev,
      [key]: Number.isFinite(n) ? n : 0,
    }));
  }

  function updateItem(id: string, patch: Partial<CanvasItem>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? ({ ...it, ...patch } as CanvasItem) : it))
    );
  }

  const MOVE_STEP = pxPerMeter * 0.2;

  function rotateSelected(delta: number) {
    if (!selectedId) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === selectedId
          ? { ...it, rotation: (it.rotation ?? 0) + delta }
          : it
      )
    );
  }

  function moveSelected(dx: number, dy: number) {
    if (!selectedId) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === selectedId
          ? {
              ...it,
              x: it.x + dx,
              y: it.y + dy,
            }
          : it
      )
    );
  }

  function deleteSelected() {
    if (!selectedId) return;
    setItems((prev) => prev.filter((it) => it.id !== selectedId));
    setSelectedId(null);
  }

  function panRelative(delta: THREE.Vector3) {
    const ctrls = controlsRef.current;
    if (!ctrls) return;
    const cam = ctrls.object;
    const target = ctrls.target;
    cam.position.add(delta);
    target.add(delta);
    ctrls.update();
  }

  function moveVertical(dy: number) {
    const ctrls = controlsRef.current;
    if (!ctrls) return;
    const cam = ctrls.object;
    const target = ctrls.target;
    const nextY = Math.max(0.2, cam.position.y + dy);
    const actualDy = nextY - cam.position.y;
    cam.position.y = nextY;
    target.y += actualDy;
    ctrls.update();
  }

  function getViewRightVector(): THREE.Vector3 | null {
    const ctrls = controlsRef.current;
    if (!ctrls) return null;
    const cam = ctrls.object;
    const target = ctrls.target;
    const forward = new THREE.Vector3().subVectors(target, cam.position).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    right.y = 0;
    if (right.lengthSq() < 1e-6) return null;
    right.normalize();
    return right;
  }

  const onLeft = () => {
    const right = getViewRightVector();
    if (!right) return;
    panRelative(right.clone().multiplyScalar(-PAN_STEP));
  };

  const onRight = () => {
    const right = getViewRightVector();
    if (!right) return;
    panRelative(right.clone().multiplyScalar(PAN_STEP));
  };

  const onUp = () => moveVertical(VERT_STEP);
  const onDown = () => moveVertical(-VERT_STEP);

  function addModelToScene(m: FurnitureModel) {
    const wMeters = m.width_m ?? 0.8;
    const hMeters = m.depth_m ?? 0.8;

    const xPx = roomPx ? roomPx.x + roomPx.wPx / 2 - (wMeters * pxPerMeter) / 2 : 0;
    const yPx = roomPx ? roomPx.y + roomPx.hPx / 2 - (hMeters * pxPerMeter) / 2 : 0;

    const newItem: FurnitureItem = {
      id: uid(),
      itemKind: "furniture",
      type: m.type,
      modelId: m.id,
      modelName: m.name,
      modelGlbUrl: m.public_url,
      modelTopUrl: m.ftop_url,
      modelPicUrl: m.fpic_url,
      x: xPx,
      y: yPx,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      wMeters,
      hMeters,
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedId(newItem.id);
  }

  function addOpeningToScene(asset: OpeningAsset) {
    const wMeters = asset.type === "DOOR" ? 0.9 : 1.2;
    const hMeters = asset.type === "DOOR" ? 2.1 : 1.2;

    const xPx = roomPx ? roomPx.x + roomPx.wPx / 2 - (wMeters * pxPerMeter) / 2 : 0;
    const yPx = roomPx ? roomPx.y + 4 : 0;

    const newItem: OpeningItem = {
      id: uid(),
      itemKind: "opening",
      type: asset.type,
      modelId: asset.id,
      modelName: asset.name,
      modelGlbUrl: asset.public_url,
      modelTopUrl: null,
      modelPicUrl: asset.fpic_url,
      x: xPx,
      y: yPx,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      wMeters,
      hMeters,
      wallId: "bottom",
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedId(newItem.id);
  }

  const goBackTo2D = () => {
    navigate("/editor-2d", {
      state: {
        room: effectiveRoom,
        roomConfig: liveRoomConfig,
        items,
        pxPerMeter,
        roomPx,
      },
    });
  };

  async function captureThumbnail(): Promise<string | null> {
    if (!canvasContainerRef.current) return null;

    try {
      const canvas = canvasContainerRef.current.querySelector('canvas');
      if (!canvas) return null;

      await new Promise(requestAnimationFrame);

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          } else {
            resolve(null);
          }
        }, 'image/jpeg', 0.8);
      });
    } catch (error) {
      console.error('Failed to capture thumbnail:', error);
      return null;
    }
  }

  async function uploadThumbnail(designId: string, dataUrl: string): Promise<string | null> {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const filePath = `${designId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('design-thumbnails')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('design-thumbnails')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Failed to upload thumbnail:', error);
      return null;
    }
  }

  async function handleSaveDesign() {
    if (!customerId.trim() || !customerName.trim()) {
      setSaveError("Please enter customer ID and name");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const thumbnailDataUrl = await captureThumbnail();

      const designData = {
        customer_id: customerId.trim(),
        customer_name: customerName.trim(),
        room_config: liveRoomConfig,
        items: items.map(item => ({
          id: item.id,
          itemKind: item.itemKind,
          type: item.type,
          modelId: item.modelId,
          modelName: item.modelName,
          modelGlbUrl: item.modelGlbUrl,
          modelPicUrl: item.modelPicUrl,
          x: item.x,
          y: item.y,
          rotation: item.rotation,
          scaleX: item.scaleX,
          scaleY: item.scaleY,
          wMeters: item.wMeters,
          hMeters: item.hMeters,
          color: item.itemKind === "furniture" ? item.color : undefined,
          wallId: item.itemKind === "opening" ? item.wallId : undefined,
        })),
        thumbnail_url: null,
      };

      const { data: insertedDesign, error: insertError } = await supabase
        .from("designs")
        .insert([designData])
        .select()
        .single();

      if (insertError) throw insertError;

      if (thumbnailDataUrl) {
        const publicUrl = await uploadThumbnail(insertedDesign.id, thumbnailDataUrl);
        
        if (publicUrl) {
          await supabase
            .from("designs")
            .update({ thumbnail_url: publicUrl })
            .eq("id", insertedDesign.id);
        }
      }

      setSaveSuccess(true);
      
      setTimeout(() => {
        setSaveDialogOpen(false);
        setCustomerId("");
        setCustomerName("");
        setSaveSuccess(false);
      }, 2000);

    } catch (err) {
      console.error('Save process failed:', err);
      setSaveError(err instanceof Error ? err.message : "Failed to save design");
    } finally {
      setIsSaving(false);
    }
  }

  if (roomMissing) {
    return (
      <div className="min-h-screen bg-pink-50 px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-purple-200 bg-purple-100 p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">3D Viewer</h1>
          <p className="mt-3 text-slate-600">
            No room data found. Go back to Dashboard.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-6 rounded-2xl bg-gradient-to-r from-pink-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 text-slate-900">
      <div className="mx-auto max-w-[1700px] px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <button
              onClick={goBackTo2D}
              className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-purple-200 bg-purple-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-purple-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to 2D
            </button>

            <h1 className="text-3xl font-semibold">3D Viewer</h1>
            <p className="mt-2 text-slate-600">
              Explore your room layout in 3D with accurate data from the 2D editor.
            </p>
          </div>

          <button
            onClick={() => setSaveDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] hover:shadow-xl"
          >
            <Save className="h-4 w-4" />
            Save Design
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="rounded-3xl border border-purple-200 bg-purple-100 p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white p-3 text-violet-600">
                    <ShapeIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Room setup</h2>
                    <p className="text-sm text-slate-600">Edit shape and dimensions here</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRoomSetupOpen((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-200 bg-white text-violet-700 transition hover:bg-purple-50"
                  aria-label={roomSetupOpen ? "Collapse room setup" : "Expand room setup"}
                >
                  <span
                    className={`text-lg transition-transform duration-200 ${
                      roomSetupOpen ? "rotate-180" : "rotate-0"
                    }`}
                  >
                    ⌃
                  </span>
                </button>
              </div>

              {roomSetupOpen && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {roomShapes.map((item) => {
                      const Icon = item.icon;
                      const active = item.id === selectedShape;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleShapeChange(item.id)}
                          className={`flex min-h-[140px] flex-col items-start justify-start rounded-2xl border p-4 text-left transition ${
                            active
                              ? "border-violet-400 bg-white shadow-[0_0_0_3px_rgba(167,139,250,0.25),0_12px_30px_rgba(139,92,246,0.12)]"
                              : "border-purple-200 bg-white/80 hover:bg-white"
                          }`}
                        >
                          <div
                            className={`mb-3 inline-flex rounded-xl p-3 ${
                              active
                                ? "bg-violet-100 text-violet-700"
                                : "bg-purple-100 text-slate-600"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>

                          <h3 className="text-sm font-semibold">{item.name}</h3>
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            {item.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 space-y-4">
                    {activeShapeConfig.fields.map((field) => {
                      const value = editorShapeValues[field.key] ?? 0;
                      const isHeight = field.key === "height";
                      const min = isHeight ? 2 : 2;
                      const max = isHeight ? 5 : 10;

                      return (
                        <div
                          key={field.key}
                          className="rounded-2xl border border-purple-200 bg-white px-4 py-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-sm text-slate-600">{field.label}</span>
                            <span className="text-sm font-semibold text-violet-700">
                              {value} {field.unit}
                            </span>
                          </div>

                          <input
                            type="range"
                            min={min}
                            max={max}
                            step="0.1"
                            value={value}
                            onChange={(e) => handleEditorShapeValueChange(field.key, e.target.value)}
                            className="w-full accent-violet-600"
                          />

                          <div className="mt-3 flex items-center gap-3">
                            <input
                              type="number"
                              min={min}
                              max={max}
                              step="0.1"
                              value={value}
                              onChange={(e) => handleEditorShapeValueChange(field.key, e.target.value)}
                              className="w-24 rounded-xl border border-purple-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(167,139,250,0.18)]"
                            />
                            <span className="text-sm text-slate-500">{field.unit}</span>
                            <span className="ml-auto text-xs text-slate-400">
                              {min}m — {max}m
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>

            <section className="rounded-3xl border border-purple-200 bg-purple-100 p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-white p-3 text-violet-600">
                  <Sofa className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Furniture library</h2>
                  <p className="text-sm text-slate-600">Open the asset picker</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.01]"
              >
                Open Library
              </button>
            </section>

            <section className="rounded-3xl border border-purple-200 bg-purple-100 p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-white p-3 text-violet-600">
                  <Armchair className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Selected item</h2>
                  <p className="text-sm text-slate-600">Current 3D scene selection</p>
                </div>
              </div>

              {selectedItem ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-purple-200 bg-white p-4">
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">Name:</span>{" "}
                      {selectedItem.modelName}
                    </p>

                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">Kind:</span>{" "}
                      {selectedItem.type}
                    </p>

                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">Size:</span>{" "}
                      {selectedItem.wMeters.toFixed(2)}m × {selectedItem.hMeters.toFixed(2)}m
                    </p>

                    {selectedItem.itemKind === "furniture" && (
                      <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 p-3">
                        <label className="mb-2 block text-sm font-semibold text-slate-900">
                          Furniture color
                        </label>

                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            type="color"
                            value={selectedItem.color ?? "#ffffff"}
                            onChange={(e) =>
                              updateItem(selectedItem.id, {
                                color: e.target.value,
                              } as Partial<CanvasItem>)
                            }
                            className="h-11 w-16 cursor-pointer rounded-xl border border-purple-200 bg-white p-1"
                          />

                          <div className="rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm text-slate-600">
                            {selectedItem.color ?? "Original"}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              updateItem(selectedItem.id, {
                                color: undefined,
                              } as Partial<CanvasItem>)
                            }
                            className="rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-purple-50"
                          >
                            Reset color
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={deleteSelected}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete selected
                  </button>

                  <p className="text-xs text-slate-500">
                    Click any 3D item to select it. Changes here will also go back to 2D.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-purple-200 bg-white p-4 text-sm text-slate-500">
                  No selection
                </div>
              )}
            </section>
          </aside>

          <main className="rounded-3xl border border-purple-200 bg-purple-100 p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-white p-3 text-violet-600">
                <Home className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">3D Canvas</h2>
                <p className="text-sm text-slate-600">
                  Orbit, inspect, and validate the room layout in 3D.
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-purple-200 bg-white" ref={canvasContainerRef}>
              {/* Undo/Redo Buttons */}
              <div className="absolute left-4 top-4 z-10 flex gap-2">
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/40 bg-white/35 shadow-xl backdrop-blur-xl transition-all hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-40 ${
                    canUndo ? 'hover:scale-105 hover:text-violet-600' : ''
                  }`}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="h-5 w-5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/40 bg-white/35 shadow-xl backdrop-blur-xl transition-all hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-40 ${
                    canRedo ? 'hover:scale-105 hover:text-violet-600' : ''
                  }`}
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="h-5 w-5" />
                </button>
              </div>

              <div className="h-[720px] w-full">
                <Canvas
                  shadows
                  camera={{
                    position: [
                      effectiveRoom.length * 0.9,
                      effectiveRoom.height * 0.9,
                      effectiveRoom.width * 1.3,
                    ],
                    fov: 50,
                  }}
                  onPointerMissed={() => setSelectedId(null)}
                >
                  <ambientLight intensity={0.7} />
                  {lightSettings.enabled && (
                    <directionalLight
                      castShadow
                      position={[
                        lightSettings.position.x,
                        lightSettings.position.y,
                        lightSettings.position.z,
                      ]}
                      intensity={lightSettings.intensity}
                      color={lightSettings.color}
                      shadow-mapSize-width={1024}
                      shadow-mapSize-height={1024}
                    />
                  )}

                  <OrbitControls
                    ref={controlsRef}
                    makeDefault
                    target={[effectiveRoom.length / 2, 0.6, effectiveRoom.width / 2]}
                    enableDamping
                  />

                  <Room3D 
                    room={effectiveRoom} 
                    roomConfig={liveRoomConfig} 
                    wallTransparency={wallTransparency}
                  />

                  <Suspense fallback={null}>
                    {items.map((it) => (
                      <SceneItem3D
                        key={it.id}
                        item={it}
                        room={effectiveRoom}
                        map={{
                          canMapFrom2D,
                          pxPerMeter,
                          roomPx,
                        }}
                        selected={selectedId === it.id}
                        onSelect={() => setSelectedId(it.id)}
                      />
                    ))}
                  </Suspense>

                  <gridHelper args={[Math.max(effectiveRoom.length, effectiveRoom.width) * 2, 20]} />
                </Canvas>
              </div>

              <div className="pointer-events-none absolute bottom-5 right-5">
                {/* Light Control Button */}
                <div className="mb-3 flex justify-end gap-2">
                  <button
                    onClick={() => setShowLightControl(!showLightControl)}
                    className="pointer-events-auto rounded-2xl border border-white/40 bg-white/35 p-3 shadow-xl backdrop-blur-xl hover:bg-white/50 transition-all"
                    title="Change Light Settings"
                  >
                    <div className="flex items-center gap-2">
                      <Sun className={`h-4 w-4 ${lightSettings.enabled ? 'text-yellow-500' : 'text-slate-500'}`} />
                      <span className="text-xs font-medium text-slate-700">Light</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowWallColorControl(!showWallColorControl)}
                    className="pointer-events-auto rounded-2xl border border-white/40 bg-white/35 p-3 shadow-xl backdrop-blur-xl hover:bg-white/50 transition-all"
                    title="Change Wall Color"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border border-white/50" 
                        style={{ backgroundColor: wallColor }}
                      />
                      <span className="text-xs font-medium text-slate-700">Walls</span>
                    </div>
                  </button>
                </div>

                {/* Light Control Panel */}
                {showLightControl && (
                  <div className="pointer-events-auto mb-3 w-72 rounded-2xl border border-white/40 bg-white/35 p-4 shadow-xl backdrop-blur-xl">
                    <h4 className="text-sm font-semibold text-slate-800 mb-3">Light Settings</h4>
                    
                    {/* Enable/Disable Toggle */}
                    <div className="mb-3 flex items-center justify-between">
                      <label className="text-xs text-slate-600">Enable Light</label>
                      <button
                        onClick={() => setLightSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          lightSettings.enabled ? 'bg-violet-600' : 'bg-gray-400'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            lightSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Intensity Slider */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-slate-600">Intensity</label>
                        <span className="text-xs font-medium text-slate-700">{lightSettings.intensity.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={lightSettings.intensity}
                        onChange={(e) => setLightSettings(prev => ({ 
                          ...prev, 
                          intensity: parseFloat(e.target.value) 
                        }))}
                        className="w-full accent-violet-600"
                      />
                    </div>

                    {/* Position Controls */}
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-slate-700 mb-2">Position</h5>
                      
                      {/* X Position */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-slate-600">X</label>
                          <span className="text-xs font-medium text-slate-700">{lightSettings.position.x.toFixed(1)}m</span>
                        </div>
                        <input
                          type="range"
                          min="-10"
                          max="20"
                          step="0.1"
                          value={lightSettings.position.x}
                          onChange={(e) => setLightSettings(prev => ({ 
                            ...prev, 
                            position: { ...prev.position, x: parseFloat(e.target.value) }
                          }))}
                          className="w-full accent-violet-600"
                        />
                      </div>

                      {/* Y Position (Height) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-slate-600">Y (Height)</label>
                          <span className="text-xs font-medium text-slate-700">{lightSettings.position.y.toFixed(1)}m</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.1"
                          value={lightSettings.position.y}
                          onChange={(e) => setLightSettings(prev => ({ 
                            ...prev, 
                            position: { ...prev.position, y: parseFloat(e.target.value) }
                          }))}
                          className="w-full accent-violet-600"
                        />
                      </div>

                      {/* Z Position */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-slate-600">Z</label>
                          <span className="text-xs font-medium text-slate-700">{lightSettings.position.z.toFixed(1)}m</span>
                        </div>
                        <input
                          type="range"
                          min="-10"
                          max="20"
                          step="0.1"
                          value={lightSettings.position.z}
                          onChange={(e) => setLightSettings(prev => ({ 
                            ...prev, 
                            position: { ...prev.position, z: parseFloat(e.target.value) }
                          }))}
                          className="w-full accent-violet-600"
                        />
                      </div>
                    </div>

                    {/* Color Picker */}
                    <div className="mt-3">
                      <label className="block text-xs text-slate-600 mb-1">Light Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={lightSettings.color}
                          onChange={(e) => setLightSettings(prev => ({ ...prev, color: e.target.value }))}
                          className="w-10 h-10 rounded-lg border border-white/40 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={lightSettings.color}
                          onChange={(e) => setLightSettings(prev => ({ ...prev, color: e.target.value }))}
                          className="flex-1 rounded-lg border border-white/40 bg-white/60 px-2 py-1.5 text-xs text-slate-700"
                          placeholder="#RRGGBB"
                        />
                      </div>
                    </div>

                    {/* Reset to Default Button */}
                    <button
                      onClick={() => setLightSettings({
                        enabled: true,
                        intensity: 1.0,
                        position: {
                          x: effectiveRoom.length * 1.2,
                          y: effectiveRoom.height * 1.5,
                          z: effectiveRoom.width * 1.2,
                        },
                        color: "#ffffff",
                      })}
                      className="mt-3 w-full rounded-lg border border-white/40 bg-white/40 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white/60 transition-all"
                    >
                      Reset to Default
                    </button>
                  </div>
                )}

                {/* Wall Color Control Panel */}
                {showWallColorControl && (
                  <div className="pointer-events-auto mb-3 w-64 rounded-2xl border border-white/40 bg-white/35 p-4 shadow-xl backdrop-blur-xl">
                    <h4 className="text-sm font-semibold text-slate-800 mb-3">Wall Settings</h4>
                    
                    {/* Color Picker */}
                    <div className="mb-3">
                      <label className="block text-xs text-slate-600 mb-1">Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={wallColor}
                          onChange={(e) => {
                            setWallColor(e.target.value);
                          }}
                          className="w-10 h-10 rounded-lg border border-white/40 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={wallColor}
                          onChange={(e) => {
                            setWallColor(e.target.value);
                          }}
                          className="flex-1 rounded-lg border border-white/40 bg-white/60 px-2 py-1.5 text-xs text-slate-700"
                          placeholder="#RRGGBB"
                        />
                      </div>
                    </div>

                    {/* Transparency Slider */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-slate-600">Transparency</label>
                        <span className="text-xs font-medium text-slate-700">{wallTransparency}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="90"
                        step="5"
                        value={wallTransparency}
                        onChange={(e) => setWallTransparency(parseInt(e.target.value))}
                        className="w-full accent-violet-600"
                      />
                    </div>

                    {/* Preset Colors */}
                    <div className="mb-2">
                      <label className="block text-xs text-slate-600 mb-2">Presets</label>
                      <div className="flex flex-wrap gap-2">
                        {['#d1d5db', '#f87171', '#60a5fa', '#4ade80', '#fbbf24', '#c084fc'].map((color) => (
                          <button
                            key={color}
                            onClick={() => setWallColor(color)}
                            className="w-6 h-6 rounded-full border border-white/40 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="pointer-events-auto grid h-44 w-44 grid-cols-3 grid-rows-3 place-items-center rounded-3xl border border-white/40 bg-white/35 p-3 shadow-xl backdrop-blur-xl">
                  <PadSlot />
                  <PadSlot>
                    <GlassPadButton onClick={onUp}>
                      <ArrowUp className="h-5 w-5" />
                    </GlassPadButton>
                  </PadSlot>
                  <PadSlot />

                  <PadSlot>
                    <GlassPadButton onClick={onLeft}>
                      <ArrowLeft className="h-5 w-5" />
                    </GlassPadButton>
                  </PadSlot>
                  <PadSlot>
                    <div className="rounded-2xl border border-white/40 bg-white/40 p-3 text-violet-700 shadow-sm backdrop-blur-md">
                      <ArrowLeftRight className="h-5 w-5" />
                    </div>
                  </PadSlot>
                  <PadSlot>
                    <GlassPadButton onClick={onRight}>
                      <ArrowLeft className="h-5 w-5 rotate-180" />
                    </GlassPadButton>
                  </PadSlot>

                  <PadSlot />
                  <PadSlot>
                    <GlassPadButton onClick={onDown}>
                      <ArrowDown className="h-5 w-5" />
                    </GlassPadButton>
                  </PadSlot>
                  <PadSlot />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {selectedItem && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <div className="pointer-events-auto w-[720px] rounded-3xl border border-white/40 bg-white/35 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="mb-5 text-center text-sm font-semibold text-slate-800">
              {selectedItem.modelName}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-1 flex-col items-center justify-center">
                <span className="mb-3 text-xs text-slate-600">Rotate</span>

                <div className="flex gap-4">
                  <button
                    onClick={() => rotateSelected(15)}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/50 bg-white/60 text-lg backdrop-blur hover:bg-white"
                  >
                    ↺
                  </button>

                  <button
                    onClick={() => rotateSelected(-15)}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/50 bg-white/60 text-lg backdrop-blur hover:bg-white"
                  >
                    ↻
                  </button>
                </div>
              </div>

              <div className="mx-6 h-20 w-px bg-black/40" />

              <div className="flex flex-1 flex-col items-center">
                <span className="mb-3 text-xs text-slate-600">Move</span>

                <div className="grid grid-cols-3 gap-2">
                  <div />
                  <button
                    onClick={() => moveSelected(0, -MOVE_STEP)}
                    className="h-10 w-10 rounded-xl border border-white/50 bg-white/60 backdrop-blur hover:bg-white"
                  >
                    ↑
                  </button>
                  <div />
                  <button
                    onClick={() => moveSelected(-MOVE_STEP, 0)}
                    className="h-10 w-10 rounded-xl border border-white/50 bg-white/60 backdrop-blur hover:bg-white"
                  >
                    ←
                  </button>
                  <div />
                  <button
                    onClick={() => moveSelected(MOVE_STEP, 0)}
                    className="h-10 w-10 rounded-xl border border-white/50 bg-white/60 backdrop-blur hover:bg-white"
                  >
                    →
                  </button>
                  <div />
                  <button
                    onClick={() => moveSelected(0, MOVE_STEP)}
                    className="h-10 w-10 rounded-xl border border-white/50 bg-white/60 backdrop-blur hover:bg-white"
                  >
                    ↓
                  </button>
                  <div />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {libraryOpen && (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-[2px]">
    <div className="w-full max-w-6xl rounded-t-[32px] border border-white/40 bg-white/35 p-6 shadow-2xl backdrop-blur-2xl">
      <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-white/60" />

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Asset Library</h2>
        <button
          onClick={() => setLibraryOpen(false)}
          className="rounded-2xl border border-white/50 bg-white/50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white/70"
        >
          Close
        </button>
      </div>

      <div className="mb-6">
        <div className="relative flex rounded-2xl border border-white/40 bg-white/40 p-1">
          <button
            onClick={() => setLibraryTab("furniture")}
            className={`relative z-10 flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
              libraryTab === "furniture" ? "text-violet-700" : "text-slate-600"
            }`}
          >
            Furniture
          </button>
          <button
            onClick={() => setLibraryTab("openings")}
            className={`relative z-10 flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
              libraryTab === "openings" ? "text-violet-700" : "text-slate-600"
            }`}
          >
            Doors & Windows
          </button>

          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-white shadow-sm transition-all duration-300 ${
              libraryTab === "furniture" ? "left-1" : "left-[calc(50%+0px)]"
            }`}
          />
        </div>
      </div>

      {libraryTab === "furniture" ? (
        <>
          <div className="mb-6">
            <div className="relative flex rounded-2xl border border-white/40 bg-white/40 p-1">
              {[
                { key: "CHAIR", label: "Chairs" },
                { key: "DINING TABLE", label: "Dining Tables" },
                { key: "SIDE TABLE", label: "Side Tables" },
                { key: "SOFA", label: "Sofas" },
                { key: "BED", label: "Beds" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFurnitureTab(tab.key as FurnitureType)}
                  className={`relative z-10 flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    furnitureTab === tab.key ? "text-violet-700" : "text-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              {/* Slider indicator - properly positioned for 5 tabs */}
              <div
                className={`absolute top-1 bottom-1 rounded-xl bg-white shadow-sm transition-all duration-300 ${
                  furnitureTab === "CHAIR"
                    ? "left-1"
                    : furnitureTab === "DINING TABLE"
                    ? "left-[calc(20%+0px)]"
                    : furnitureTab === "SIDE TABLE"
                    ? "left-[calc(40%+0px)]"
                    : furnitureTab === "SOFA"
                    ? "left-[calc(60%+0px)]"
                    : "left-[calc(80%+0px)]"
                }`}
                style={{ width: 'calc(20% - 8px)' }}
              />
            </div>
          </div>

          {modelsLoading && (
            <div className="mb-4 text-sm text-slate-600">Loading furniture…</div>
          )}
          {modelsError && (
            <div className="mb-4 text-sm text-red-600">{modelsError}</div>
          )}

          <div className="grid max-h-[50vh] gap-4 overflow-auto pr-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {models
              .filter((m) => m.type === furnitureTab)
              .map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    addModelToScene(m);
                    setLibraryOpen(false);
                  }}
                  className="group rounded-3xl border border-white/50 bg-white/55 p-4 text-left shadow-lg backdrop-blur-xl transition hover:-translate-y-1 hover:bg-white/75"
                >
                  <div className="mb-3 flex h-36 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                    {m.fpic_url ? (
                      <img
                        src={m.fpic_url}
                        alt={m.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm text-slate-500">No preview</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{m.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {m.width_m && m.depth_m
                      ? `${m.width_m.toFixed(2)}m × ${m.depth_m.toFixed(2)}m`
                      : "Standard size"}
                  </div>
                </button>
              ))}
          </div>
        </>
      ) : (
        // Openings section
        <>
          <div className="mb-6">
            <div className="relative flex rounded-2xl border border-white/40 bg-white/40 p-1">
              {[
                { key: "DOOR", label: "Doors" },
                { key: "WINDOW", label: "Windows" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setOpeningTab(tab.key as OpeningType)}
                  className={`relative z-10 flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    openingTab === tab.key ? "text-violet-700" : "text-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-white shadow-sm transition-all duration-300 ${
                  openingTab === "DOOR" ? "left-1" : "left-[calc(50%+0px)]"
                }`}
              />
            </div>
          </div>

          {openingsLoading && (
            <div className="mb-4 text-sm text-slate-600">Loading doors and windows…</div>
          )}
          {openingsError && (
            <div className="mb-4 text-sm text-red-600">{openingsError}</div>
          )}

          <div className="grid max-h-[50vh] gap-4 overflow-auto pr-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {openingAssets
              .filter((a) => a.type === openingTab)
              .map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => {
                    addOpeningToScene(asset);
                    setLibraryOpen(false);
                  }}
                  className="group rounded-3xl border border-white/50 bg-white/55 p-4 text-left shadow-lg backdrop-blur-xl transition hover:-translate-y-1 hover:bg-white/75"
                >
                  <div className="mb-3 flex h-36 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                    {asset.fpic_url ? (
                      <img
                        src={asset.fpic_url}
                        alt={asset.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm text-slate-500">{asset.type}</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{asset.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Snaps to wall automatically
                  </div>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  </div>
)}

      {saveDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-3xl border border-white/40 bg-white/35 p-6 shadow-2xl backdrop-blur-2xl">
            <h3 className="mb-4 text-xl font-semibold text-slate-900">Save Design</h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="customerId" className="mb-2 block text-sm font-medium text-slate-700">
                  Customer ID
                </label>
                <input
                  id="customerId"
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="CUST001"
                  className="w-full rounded-xl border border-purple-200 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(167,139,250,0.18)]"
                  disabled={isSaving || saveSuccess}
                />
              </div>

              <div>
                <label htmlFor="customerName" className="mb-2 block text-sm font-medium text-slate-700">
                  Customer Name
                </label>
                <input
                  id="customerName"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-xl border border-purple-200 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(167,139,250,0.18)]"
                  disabled={isSaving || saveSuccess}
                />
              </div>

              {saveError && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-600">
                  Design saved successfully!
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setSaveDialogOpen(false);
                    setCustomerId("");
                    setCustomerName("");
                    setSaveError(null);
                    setSaveSuccess(false);
                  }}
                  className="rounded-xl border border-purple-200 bg-white/80 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDesign}
                  disabled={isSaving || saveSuccess || !customerId.trim() || !customerName.trim()}
                  className="rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white transition hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PadSlot({ children }: { children?: React.ReactNode }) {
  return <div className="flex items-center justify-center">{children ?? null}</div>;
}

function GlassPadButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/50 bg-white/55 text-slate-700 shadow-md backdrop-blur-md transition hover:bg-white/75 active:scale-95"
    >
      {children}
    </button>
  );
}

function Room3D({
  room,
  roomConfig,
  wallTransparency = 0,
}: {
  room: Room;
  roomConfig?: RoomConfig;
  wallTransparency?: number;
}) {
  const wallOpacity = Math.max(0, Math.min(1, 1 - (wallTransparency / 100)));

  const floorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: room.floorColor,
        side: THREE.DoubleSide,
      }),
    [room.floorColor]
  );

  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: room.wallColor,
        transparent: wallOpacity < 1,
        opacity: wallOpacity,
      }),
    [room.wallColor, wallOpacity]
  );

  const circularWallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: room.wallColor,
        side: THREE.DoubleSide,
        transparent: wallOpacity < 1,
        opacity: wallOpacity,
      }),
    [room.wallColor, wallOpacity]
  );

  const shape = (roomConfig?.shape ?? "rectangle") as RoomShape;
  const values = roomConfig?.values ?? {};
  const t = 0.08;

  const num = (v: string | undefined, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const lShapeGeometry = useMemo(() => {
    const mainLength = num(values.mainLength, room.length);
    const mainWidth = num(values.mainWidth, room.width);
    const cutoutLength = num(values.cutoutLength, 2);
    const cutoutWidth = num(values.cutoutWidth, 1.8);

    const shape2D = new THREE.Shape();
    shape2D.moveTo(0, 0);
    shape2D.lineTo(mainLength, 0);
    shape2D.lineTo(mainLength, mainWidth - cutoutWidth);
    shape2D.lineTo(mainLength - cutoutLength, mainWidth - cutoutWidth);
    shape2D.lineTo(mainLength - cutoutLength, mainWidth);
    shape2D.lineTo(0, mainWidth);
    shape2D.lineTo(0, 0);

    const wallBoxes = [
      {
        position: [mainLength / 2, room.height / 2, -t / 2],
        size: [mainLength, room.height, t],
      },
      {
        position: [mainLength + t / 2, room.height / 2, (mainWidth - cutoutWidth) / 2],
        size: [t, room.height, mainWidth - cutoutWidth],
      },
      {
        position: [
          mainLength - cutoutLength / 2,
          room.height / 2,
          mainWidth - cutoutWidth + t / 2,
        ],
        size: [cutoutLength, room.height, t],
      },
      {
        position: [
          mainLength - cutoutLength - t / 2,
          room.height / 2,
          mainWidth - cutoutWidth / 2,
        ],
        size: [t, room.height, cutoutWidth],
      },
      {
        position: [(mainLength - cutoutLength) / 2, room.height / 2, mainWidth + t / 2],
        size: [mainLength - cutoutLength, room.height, t],
      },
      {
        position: [-t / 2, room.height / 2, mainWidth / 2],
        size: [t, room.height, mainWidth],
      },
    ] as const;

    return { shape2D, wallBoxes };
  }, [
    room.height,
    room.length,
    room.width,
    t,
    values.cutoutLength,
    values.cutoutWidth,
    values.mainLength,
    values.mainWidth,
  ]);

  if (shape === "circular") {
    const diameter = num(values.diameter, room.length);
    const radius = diameter / 2;

    return (
      <group>
        <mesh
          receiveShadow
          rotation-x={-Math.PI / 2}
          position={[radius, 0, radius]}
          material={floorMat}
        >
          <circleGeometry args={[radius, 96]} />
        </mesh>

        <mesh
          receiveShadow
          castShadow
          position={[radius, room.height / 2, radius]}
          material={circularWallMat}
        >
          <cylinderGeometry args={[radius, radius, room.height, 96, 1, true]} />
        </mesh>
      </group>
    );
  }

  if (shape === "l-shape") {
    return (
      <group>
        <mesh receiveShadow rotation-x={-Math.PI / 2} material={floorMat}>
          <shapeGeometry args={[lShapeGeometry.shape2D]} />
        </mesh>

        {lShapeGeometry.wallBoxes.map((wall, index) => (
          <mesh
            key={index}
            receiveShadow
            castShadow
            material={wallMat}
            position={wall.position as [number, number, number]}
          >
            <boxGeometry args={wall.size as [number, number, number]} />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group>
      <mesh
        receiveShadow
        rotation-x={-Math.PI / 2}
        position={[room.length / 2, 0, room.width / 2]}
        material={floorMat}
      >
        <planeGeometry args={[room.length, room.width]} />
      </mesh>

      <mesh
        receiveShadow
        castShadow
        material={wallMat}
        position={[room.length / 2, room.height / 2, -t / 2]}
      >
        <boxGeometry args={[room.length, room.height, t]} />
      </mesh>

      <mesh
        receiveShadow
        castShadow
        material={wallMat}
        position={[room.length / 2, room.height / 2, room.width + t / 2]}
      >
        <boxGeometry args={[room.length, room.height, t]} />
      </mesh>

      <mesh
        receiveShadow
        castShadow
        material={wallMat}
        position={[-t / 2, room.height / 2, room.width / 2]}
      >
        <boxGeometry args={[t, room.height, room.width]} />
      </mesh>

      <mesh
        receiveShadow
        castShadow
        material={wallMat}
        position={[room.length + t / 2, room.height / 2, room.width / 2]}
      >
        <boxGeometry args={[t, room.height, room.width]} />
      </mesh>
    </group>
  );
}

function SceneItem3D({
  item,
  room,
  map,
  selected,
  onSelect,
}: {
  item: CanvasItem;
  room: Room;
  map: {
    canMapFrom2D: boolean;
    pxPerMeter: number;
    roomPx: RoomPx;
  };
  selected: boolean;
  onSelect: () => void;
}) {
  const gltf = useGLTF(item.modelGlbUrl);
  const itemColor = item.itemKind === "furniture" ? item.color : undefined;

  const prepared = useMemo(() => {
    const root = gltf.scene.clone(true);

    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) => mat.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (item.itemKind === "furniture" && itemColor) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              if (materialHasColor(mat)) {
                mat.color.set(itemColor);
              }
            });
          } else {
            const mat = mesh.material;
            if (materialHasColor(mat)) {
              mat.color.set(itemColor);
            }
          }
        }
      }
    });

    const wrapper = new THREE.Group();
    wrapper.add(root);

    let box = new THREE.Box3().setFromObject(wrapper);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y;

    box = new THREE.Box3().setFromObject(wrapper);
    box.getSize(size);

    size.x = Math.max(size.x, 1e-6);
    size.y = Math.max(size.y, 1e-6);
    size.z = Math.max(size.z, 1e-6);

    return { wrapper, size };
  }, [gltf.scene, item.itemKind, itemColor]);

  let xM = room.length / 2;
  let zM = room.width / 2;
  let yM = 0;
  
  let groupRotY = 0;
  let objectRotX = 0;
  const objectRotY = 0;
  const objectRotZ = 0;

  let scale: [number, number, number] = [1, 1, 1];

  if (item.itemKind === "furniture") {
    const targetW = item.wMeters * (item.scaleX ?? 1);
    const targetD = item.hMeters * (item.scaleY ?? 1);

    if (map.canMapFrom2D) {
      const pxpm = map.pxPerMeter;
      const { centerXPx, centerYPx } = getTransformedItemCenterPx(item, pxpm);

      xM = (centerXPx - map.roomPx.x) / pxpm;
      zM = (centerYPx - map.roomPx.y) / pxpm;
    }

    const sx = targetW / prepared.size.x;
    const sz = targetD / prepared.size.z;
    const sy = (sx + sz) / 2;

    scale = [sx, sy, sz];
    groupRotY = (item.rotation * Math.PI) / 180;
    
  } else {
    const openingWidth = item.wMeters * (item.scaleX ?? 1);
    const openingHeight = item.type === "DOOR" ? 2.1 : 1.2;
    const openingDepth = item.type === "DOOR" ? 0.1 : 0.08;

    const sx = openingWidth / prepared.size.x;
    const sy = openingHeight / prepared.size.y;
    const sz = openingDepth / prepared.size.z;
    
    scale = [sx, sy, sz];

    if (map.canMapFrom2D) {
      const pxpm = map.pxPerMeter;
      const { centerXPx, centerYPx } = getTransformedItemCenterPx(item, pxpm);

      const rawX = (centerXPx - map.roomPx.x) / pxpm;
      const rawZ = (centerYPx - map.roomPx.y) / pxpm;

      const deg = ((item.rotation % 360) + 360) % 360;
      const inset = 0.05;

      if (deg >= 315 || deg < 45) {
        xM = rawX;
        zM = inset;
        groupRotY = 0;
      } else if (deg >= 45 && deg < 135) {
        xM = room.length - inset;
        zM = rawZ;
        groupRotY = -Math.PI / 2;
      } else if (deg >= 135 && deg < 225) {
        xM = rawX;
        zM = room.width - inset;
        groupRotY = Math.PI;
      } else {
        xM = inset;
        zM = rawZ;
        groupRotY = Math.PI / 2;
      }
    } else {
      groupRotY = (item.rotation * Math.PI) / 180;
    }

    if (item.type === "DOOR") {
      yM = 0;
    } else {
      yM = 0.9;
    }

    if (prepared.size.y < prepared.size.z) {
      objectRotX = -Math.PI / 2;
    }
  }

  return (
    <group
      position={[xM, 0, zM]}
      rotation={[0, groupRotY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <group position={[0, yM, 0]} rotation={[objectRotX, objectRotY, objectRotZ]}>
        <primitive object={prepared.wrapper} scale={scale} />
      </group>

      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry
            args={[
              Math.max(item.wMeters, item.hMeters) * 0.45,
              Math.max(item.wMeters, item.hMeters) * 0.58,
              48,
            ]}
          />
          <meshBasicMaterial color="#7c3aed" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}
