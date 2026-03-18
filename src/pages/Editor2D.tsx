import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Stage,
  Layer,
  Rect,
  Transformer,
  Text,
  Image as KonvaImage,
  Group,
  Circle as KonvaCircle,
  Line,
} from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import { supabase } from "../supabaseClient";
import {
  ArrowLeft,
  Armchair,
  Circle,
  Eye,
  GitBranch,
  RectangleHorizontal,
  Ruler,
  Sofa,
  Square,
  Trash2,
} from "lucide-react";

type Room = {
  length: number;
  width: number;
  height: number;
  wallColor: string;
  floorColor: string;
};

type RoomShape = "rectangle" | "square" | "circular" | "l-shape";

type RoomConfigState = {
  shape: RoomShape;
  values: Record<string, string>;
  wallColor?: string;
  floorColor?: string;
};

type FurnitureType = "CHAIR" | "DINING TABLE" | "SIDE TABLE" | "SOFA" | "BED";
type OpeningType = "DOOR" | "WINDOW";

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

type FurnitureCanvasItem = BaseCanvasItem & {
  itemKind: "furniture";
  type: FurnitureType;
  color?: string;
};

type OpeningCanvasItem = BaseCanvasItem & {
  itemKind: "opening";
  type: OpeningType;
  wallId?: string;
};

type CanvasItem = FurnitureCanvasItem | OpeningCanvasItem;

type RoomPx = {
  x: number;
  y: number;
  wPx: number;
  hPx: number;
};

type ParsedRoomData = {
  room: Room;
  shape: RoomShape;
  shapeValues: Record<string, number>;
  wallColor: string;
  floorColor: string;
};

type Editor2DLocationState = {
  room?: Room;
  roomConfig?: RoomConfigState;
  items?: CanvasItem[];
};

type WallSegment = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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
    icon: Circle,
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

function getShapeLabel(shape: RoomShape) {
  switch (shape) {
    case "rectangle":
      return "Rectangle";
    case "square":
      return "Square";
    case "circular":
      return "Circular";
    case "l-shape":
      return "L-Shape";
    default:
      return "Rectangle";
  }
}

function renderShapeIcon(shape: RoomShape) {
  switch (shape) {
    case "rectangle":
      return <RectangleHorizontal className="h-5 w-5" />;
    case "square":
      return <Square className="h-5 w-5" />;
    case "circular":
      return <Circle className="h-5 w-5" />;
    case "l-shape":
      return <GitBranch className="h-5 w-5" />;
    default:
      return <RectangleHorizontal className="h-5 w-5" />;
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

const fallbackRoom: Room = {
  length: 5.5,
  width: 4.2,
  height: 2.8,
  wallColor: "#d1d5db",
  floorColor: "#fdf2f8",
};

const fallbackParsedRoomData: ParsedRoomData = {
  room: fallbackRoom,
  shape: "rectangle",
  shapeValues: getDefaultShapeValues("rectangle"),
  wallColor: fallbackRoom.wallColor,
  floorColor: fallbackRoom.floorColor,
};

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

function buildRoomData(state: Editor2DLocationState | null | undefined): ParsedRoomData | null {
  if (state?.roomConfig) {
    const cfg = state.roomConfig;
    const values = cfg.values ?? {};

    const wallColor = cfg.wallColor ?? "#d1d5db";
    const floorColor = cfg.floorColor ?? "#fdf2f8";

    if (cfg.shape === "rectangle") {
      const length = toNum(values.length, 5.5);
      const width = toNum(values.width, 4.2);
      const height = toNum(values.height, 2.8);

      return {
        shape: "rectangle",
        room: { length, width, height, wallColor, floorColor },
        shapeValues: { length, width, height },
        wallColor,
        floorColor,
      };
    }

    if (cfg.shape === "square") {
      const side = toNum(values.side, 4);
      const height = toNum(values.height, 2.8);

      return {
        shape: "square",
        room: { length: side, width: side, height, wallColor, floorColor },
        shapeValues: { side, height },
        wallColor,
        floorColor,
      };
    }

    if (cfg.shape === "circular") {
      const diameter = toNum(values.diameter, 5);
      const height = toNum(values.height, 2.8);

      return {
        shape: "circular",
        room: { length: diameter, width: diameter, height, wallColor, floorColor },
        shapeValues: { diameter, height },
        wallColor,
        floorColor,
      };
    }

    if (cfg.shape === "l-shape") {
      const mainLength = toNum(values.mainLength, 6.5);
      const mainWidth = toNum(values.mainWidth, 4.5);
      const cutoutLength = toNum(values.cutoutLength, 2);
      const cutoutWidth = toNum(values.cutoutWidth, 1.8);
      const height = toNum(values.height, 2.8);

      return {
        shape: "l-shape",
        room: {
          length: mainLength,
          width: mainWidth,
          height,
          wallColor,
          floorColor,
        },
        shapeValues: {
          mainLength,
          mainWidth,
          cutoutLength,
          cutoutWidth,
          height,
        },
        wallColor,
        floorColor,
      };
    }
  }

  if (state?.room) {
    const oldRoom = state.room;
    return {
      shape: "rectangle",
      room: oldRoom,
      shapeValues: {
        length: oldRoom.length,
        width: oldRoom.width,
        height: oldRoom.height,
      },
      wallColor: oldRoom.wallColor,
      floorColor: oldRoom.floorColor,
    };
  }

  return null;
}

function getWallSegments(
  selectedShape: RoomShape,
  roomPx: RoomPx,
  editorShapeValues: Record<string, number>,
  pxPerMeter: number
): WallSegment[] {
  if (selectedShape === "l-shape") {
    const cutoutLengthPx = (editorShapeValues.cutoutLength ?? 2) * pxPerMeter;
    const cutoutWidthPx = (editorShapeValues.cutoutWidth ?? 1.8) * pxPerMeter;

    return [
      { id: "top", x1: roomPx.x, y1: roomPx.y, x2: roomPx.x + roomPx.wPx, y2: roomPx.y },
      {
        id: "right-top",
        x1: roomPx.x + roomPx.wPx,
        y1: roomPx.y,
        x2: roomPx.x + roomPx.wPx,
        y2: roomPx.y + roomPx.hPx - cutoutWidthPx,
      },
      {
        id: "inner-top",
        x1: roomPx.x + roomPx.wPx,
        y1: roomPx.y + roomPx.hPx - cutoutWidthPx,
        x2: roomPx.x + roomPx.wPx - cutoutLengthPx,
        y2: roomPx.y + roomPx.hPx - cutoutWidthPx,
      },
      {
        id: "inner-right",
        x1: roomPx.x + roomPx.wPx - cutoutLengthPx,
        y1: roomPx.y + roomPx.hPx - cutoutWidthPx,
        x2: roomPx.x + roomPx.wPx - cutoutLengthPx,
        y2: roomPx.y + roomPx.hPx,
      },
      {
        id: "bottom",
        x1: roomPx.x + roomPx.wPx - cutoutLengthPx,
        y1: roomPx.y + roomPx.hPx,
        x2: roomPx.x,
        y2: roomPx.y + roomPx.hPx,
      },
      {
        id: "left",
        x1: roomPx.x,
        y1: roomPx.y + roomPx.hPx,
        x2: roomPx.x,
        y2: roomPx.y,
      },
    ];
  }

  if (selectedShape === "circular") {
    return [];
  }

  return [
    { id: "top", x1: roomPx.x, y1: roomPx.y, x2: roomPx.x + roomPx.wPx, y2: roomPx.y },
    {
      id: "right",
      x1: roomPx.x + roomPx.wPx,
      y1: roomPx.y,
      x2: roomPx.x + roomPx.wPx,
      y2: roomPx.y + roomPx.hPx,
    },
    {
      id: "bottom",
      x1: roomPx.x + roomPx.wPx,
      y1: roomPx.y + roomPx.hPx,
      x2: roomPx.x,
      y2: roomPx.y + roomPx.hPx,
    },
    { id: "left", x1: roomPx.x, y1: roomPx.y + roomPx.hPx, x2: roomPx.x, y2: roomPx.y },
  ];
}

function snapPointToSegment(px: number, py: number, seg: WallSegment) {
  const vx = seg.x2 - seg.x1;
  const vy = seg.y2 - seg.y1;
  const lenSq = vx * vx + vy * vy || 1;

  let t = ((px - seg.x1) * vx + (py - seg.y1) * vy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const sx = seg.x1 + t * vx;
  const sy = seg.y1 + t * vy;

  const dx = px - sx;
  const dy = py - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const angle = Math.atan2(vy, vx) * (180 / Math.PI);

  return { sx, sy, dist, angle, t };
}

function TopImageGroup({
  x,
  y,
  w,
  h,
  rotation,
  scaleX,
  scaleY,
  url,
  selected,
  itemKind,
  openingType,
  color,
  onSelect,
  onDragEndCommit,
  onTransformEndCommit,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  url: string | null;
  selected: boolean;
  itemKind: "furniture" | "opening";
  openingType?: OpeningType;
  color?: string;
  onSelect: (node: Konva.Group) => void;
  onDragEndCommit: (node: Konva.Group) => void;
  onTransformEndCommit: (node: Konva.Group) => void;
}) {
  const [img] = useImage(url ?? "", "anonymous");

  let cropX = 0;
  let cropY = 0;
  let cropW = img?.width || 1;
  let cropH = img?.height || 1;

  if (img) {
    const iw = img.width || 1;
    const ih = img.height || 1;
    const imgRatio = iw / ih;
    const boxRatio = w / h;

    if (imgRatio > boxRatio) {
      cropH = ih;
      cropW = ih * boxRatio;
      cropX = (iw - cropW) / 2;
      cropY = 0;
    } else {
      cropW = iw;
      cropH = iw / boxRatio;
      cropX = 0;
      cropY = (ih - cropH) / 2;
    }
  }

  const placeholderFill =
    itemKind === "opening"
      ? openingType === "DOOR"
        ? "#f5d0fe"
        : "#bfdbfe"
      : "#d0d0d0";

  const placeholderLabel =
    itemKind === "opening" ? (openingType === "DOOR" ? "DOOR" : "WINDOW") : "ITEM";

  return (
    <Group
      x={x}
      y={y}
      rotation={rotation}
      scaleX={scaleX}
      scaleY={scaleY}
      draggable
      onMouseDown={(e) => {
        e.cancelBubble = true;
        onSelect(e.currentTarget as Konva.Group);
      }}
      onTouchStart={(e) => {
        e.cancelBubble = true;
        onSelect(e.currentTarget as Konva.Group);
      }}
      onDragEnd={(e) => onDragEndCommit(e.target as Konva.Group)}
      onTransformEnd={(e) => onTransformEndCommit(e.target as Konva.Group)}
    >
      <Rect x={0} y={0} width={w} height={h} fill="rgba(0,0,0,0.01)" />

      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        stroke={selected ? "#7c3aed" : "#666"}
        strokeWidth={selected ? 3 : 1}
        cornerRadius={8}
        listening={false}
      />

      {img ? (
        <>
          <KonvaImage
            x={0}
            y={0}
            width={w}
            height={h}
            image={img}
            listening={false}
            cropX={cropX}
            cropY={cropY}
            cropWidth={cropW}
            cropHeight={cropH}
          />

          {itemKind === "furniture" && color && (
            <Rect
              x={0}
              y={0}
              width={w}
              height={h}
              fill={color}
              opacity={0.45}
              globalCompositeOperation="multiply"
              cornerRadius={8}
              listening={false}
            />
          )}
        </>
      ) : (
        <>
          <Rect
            x={0}
            y={0}
            width={w}
            height={h}
            fill={itemKind === "furniture" && color ? color : placeholderFill}
            cornerRadius={8}
            listening={false}
          />
          <Text
            x={0}
            y={h / 2 - 8}
            width={w}
            text={placeholderLabel}
            align="center"
            fontSize={12}
            fill="#444"
            listening={false}
          />
        </>
      )}
    </Group>
  );
}

export default function Editor2D() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as Editor2DLocationState | null | undefined;

  const parsed = useMemo(() => buildRoomData(locationState), [locationState]);
  const incomingItems = locationState?.items ?? [];
  const roomMissing = !parsed;
  const resolvedParsed = parsed ?? fallbackParsedRoomData;

  const { room, shape: initialShape, shapeValues, wallColor, floorColor } = resolvedParsed;

  const [selectedShape, setSelectedShape] = useState<RoomShape>(initialShape);
  const [editorShapeValues, setEditorShapeValues] =
    useState<Record<string, number>>(shapeValues);
  const [roomSetupOpen, setRoomSetupOpen] = useState(false);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<"furniture" | "openings">("furniture");
  const [furnitureTab, setFurnitureTab] = useState<FurnitureType>("CHAIR");
  const [openingTab, setOpeningTab] = useState<OpeningType>("DOOR");

  const [openingAssets, setOpeningAssets] = useState<OpeningAsset[]>([]);
  const [openingsLoading, setOpeningsLoading] = useState(false);
  const [openingsError, setOpeningsError] = useState<string | null>(null);

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

  const activeShapeConfig =
    roomShapes.find((item) => item.id === selectedShape) ?? roomShapes[0];

  const effectiveRoom = useMemo<Room>(() => {
    if (selectedShape === "rectangle") {
      return {
        length: editorShapeValues.length ?? room.length,
        width: editorShapeValues.width ?? room.width,
        height: editorShapeValues.height ?? room.height,
        wallColor,
        floorColor,
      };
    }

    if (selectedShape === "square") {
      const side = editorShapeValues.side ?? room.length;
      return {
        length: side,
        width: side,
        height: editorShapeValues.height ?? room.height,
        wallColor,
        floorColor,
      };
    }

    if (selectedShape === "circular") {
      const diameter = editorShapeValues.diameter ?? room.length;
      return {
        length: diameter,
        width: diameter,
        height: editorShapeValues.height ?? room.height,
        wallColor,
        floorColor,
      };
    }

    return {
      length: editorShapeValues.mainLength ?? room.length,
      width: editorShapeValues.mainWidth ?? room.width,
      height: editorShapeValues.height ?? room.height,
      wallColor,
      floorColor,
    };
  }, [selectedShape, editorShapeValues, room.length, room.width, room.height, wallColor, floorColor]);

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
    const padding = 80;
    const maxW = STAGE_W - padding * 2;
    const maxH = STAGE_H - padding * 2;
    return Math.floor(Math.min(maxW / outerRoomMeters.width, maxH / outerRoomMeters.height));
  }, [outerRoomMeters.width, outerRoomMeters.height]);

  const roomPx = useMemo(() => {
    const wPx = outerRoomMeters.width * pxPerMeter;
    const hPx = outerRoomMeters.height * pxPerMeter;
    const x = (STAGE_W - wPx) / 2;
    const y = (STAGE_H - hPx) / 2;
    return { x, y, wPx, hPx };
  }, [outerRoomMeters.width, outerRoomMeters.height, pxPerMeter]);

  const [models, setModels] = useState<FurnitureModel[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
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

  const [items, setItems] = useState<CanvasItem[]>(incomingItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const trRef = useRef<Konva.Transformer>(null);

  if (roomMissing) {
    return (
      <div className="min-h-screen bg-pink-50 px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-purple-200 bg-purple-100 p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">2D Editor</h1>
          <p className="mt-3 text-slate-600">
            No room data found. Go back to Dashboard and create a room first.
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

  function updateItem(id: string, patch: Partial<CanvasItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? ({ ...it, ...patch } as CanvasItem) : it)));
  }

  function onSelectNode(node: Konva.Node | null) {
    const tr = trRef.current;
    if (!tr) return;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }

  function clearSelection(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
      onSelectNode(null);
    }
  }

  function deleteSelected() {
    if (!selectedId) return;
    setItems((prev) => prev.filter((it) => it.id !== selectedId));
    setSelectedId(null);
    onSelectNode(null);
  }

  function clampNodeInsideRoom(node: Konva.Node) {
    const bounds = { x: roomPx.x, y: roomPx.y, w: roomPx.wPx, h: roomPx.hPx };

    const rect = node.getClientRect({
      skipShadow: true,
      skipStroke: false,
    });

    let dx = 0;
    let dy = 0;

    if (rect.x < bounds.x) dx = bounds.x - rect.x;
    if (rect.y < bounds.y) dy = bounds.y - rect.y;

    const rectRight = rect.x + rect.width;
    const rectBottom = rect.y + rect.height;
    const boundsRight = bounds.x + bounds.w;
    const boundsBottom = bounds.y + bounds.h;

    if (rectRight > boundsRight) dx = boundsRight - rectRight;
    if (rectBottom > boundsBottom) dy = boundsBottom - rectBottom;

    if (dx !== 0 || dy !== 0) {
      node.position({ x: node.x() + dx, y: node.y() + dy });
    }
  }

  function snapOpeningNodeToWall(node: Konva.Group) {
    const wallSegments = getWallSegments(selectedShape, roomPx, editorShapeValues, pxPerMeter);

    if (selectedShape === "circular") {
      const centerX = roomPx.x + roomPx.wPx / 2;
      const centerY = roomPx.y + roomPx.hPx / 2;
      const radius = roomPx.wPx / 2;

      const itemW = node.width() * node.scaleX();
      const itemH = node.height() * node.scaleY();

      const angle = Math.atan2(node.y() - centerY, node.x() - centerX);
      const sx = centerX + Math.cos(angle) * radius;
      const sy = centerY + Math.sin(angle) * radius;

      node.position({
        x: sx - itemW / 2,
        y: sy - itemH / 2,
      });

      node.rotation((angle * 180) / Math.PI + 90);
      return;
    }

    const itemW = node.width() * node.scaleX();
    const itemH = node.height() * node.scaleY();
    const centerX = node.x() + itemW / 2;
    const centerY = node.y() + itemH / 2;

    let best:
      | {
          seg: WallSegment;
          sx: number;
          sy: number;
          dist: number;
          angle: number;
        }
      | undefined;

    for (const seg of wallSegments) {
      const snap = snapPointToSegment(centerX, centerY, seg);
      if (!best || snap.dist < best.dist) {
        best = { seg, sx: snap.sx, sy: snap.sy, dist: snap.dist, angle: snap.angle };
      }
    }

    if (!best) return;

    node.position({
      x: best.sx - itemW / 2,
      y: best.sy - itemH / 2,
    });

    node.rotation(best.angle);
  }

  function addModelToCanvas(m: FurnitureModel) {
    const wMeters = m.width_m ?? 0.8;
    const hMeters = m.depth_m ?? 0.8;

    const wPx = wMeters * pxPerMeter;
    const hPx = hMeters * pxPerMeter;

    const x = roomPx.x + roomPx.wPx / 2 - wPx / 2;
    const y = roomPx.y + roomPx.hPx / 2 - hPx / 2;

    const newItem: FurnitureCanvasItem = {
      id: uid(),
      itemKind: "furniture",
      type: m.type,
      modelId: m.id,
      modelName: m.name,
      modelGlbUrl: m.public_url,
      modelTopUrl: m.ftop_url,
      modelPicUrl: m.fpic_url,
      x,
      y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      wMeters,
      hMeters,
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedId(newItem.id);
  }

  function addOpeningToCanvas(asset: OpeningAsset) {
    const wMeters = asset.type === "DOOR" ? 0.9 : 1.2;
    const hMeters = asset.type === "DOOR" ? 0.18 : 0.16;

    const wallSegments = getWallSegments(selectedShape, roomPx, editorShapeValues, pxPerMeter);

    if (selectedShape === "circular") {
      const radius = roomPx.wPx / 2;
      const centerX = roomPx.x + roomPx.wPx / 2;
      const centerY = roomPx.y + roomPx.hPx / 2;
      const angle = -90;

      const x = centerX + radius - (wMeters * pxPerMeter) / 2;
      const y = centerY - (hMeters * pxPerMeter) / 2;

      const newItem: OpeningCanvasItem = {
        id: uid(),
        itemKind: "opening",
        type: asset.type,
        modelId: asset.id,
        modelName: asset.name,
        modelGlbUrl: asset.public_url,
        modelTopUrl: null,
        modelPicUrl: asset.fpic_url,
        x,
        y,
        rotation: angle,
        scaleX: 1,
        scaleY: 1,
        wMeters,
        hMeters,
      };

      setItems((prev) => [...prev, newItem]);
      setSelectedId(newItem.id);
      return;
    }

    const defaultSeg = wallSegments[0];
    if (!defaultSeg) return;

    const snap = snapPointToSegment(
      (defaultSeg.x1 + defaultSeg.x2) / 2,
      (defaultSeg.y1 + defaultSeg.y2) / 2,
      defaultSeg
    );

    const wPx = wMeters * pxPerMeter;
    const hPx = hMeters * pxPerMeter;

    const newItem: OpeningCanvasItem = {
      id: uid(),
      itemKind: "opening",
      type: asset.type,
      modelId: asset.id,
      modelName: asset.name,
      modelGlbUrl: asset.public_url,
      modelTopUrl: null,
      modelPicUrl: asset.fpic_url,
      x: snap.sx - wPx / 2,
      y: snap.sy - hPx / 2,
      rotation: snap.angle,
      scaleX: 1,
      scaleY: 1,
      wMeters,
      hMeters,
      wallId: defaultSeg.id,
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedId(newItem.id);
  }

  const selectedItem = items.find((i) => i.id === selectedId) || null;

  function renderRoomShape() {
    if (selectedShape === "circular") {
      const radius = roomPx.wPx / 2;
      return (
        <>
          <KonvaCircle
            x={roomPx.x + roomPx.wPx / 2}
            y={roomPx.y + roomPx.hPx / 2}
            radius={radius}
            fill={effectiveRoom.floorColor}
            stroke="#333"
            strokeWidth={2}
            listening={false}
          />
          <Text
            x={roomPx.x + roomPx.wPx / 2 - 22}
            y={roomPx.y - 22}
            text="ROOM"
            fontSize={14}
            fill="#333"
            listening={false}
          />
        </>
      );
    }

    if (selectedShape === "l-shape") {
      const cutoutLengthPx = (editorShapeValues.cutoutLength ?? 2) * pxPerMeter;
      const cutoutWidthPx = (editorShapeValues.cutoutWidth ?? 1.8) * pxPerMeter;

      const points = [
        roomPx.x,
        roomPx.y,
        roomPx.x + roomPx.wPx,
        roomPx.y,
        roomPx.x + roomPx.wPx,
        roomPx.y + roomPx.hPx - cutoutWidthPx,
        roomPx.x + roomPx.wPx - cutoutLengthPx,
        roomPx.y + roomPx.hPx - cutoutWidthPx,
        roomPx.x + roomPx.wPx - cutoutLengthPx,
        roomPx.y + roomPx.hPx,
        roomPx.x,
        roomPx.y + roomPx.hPx,
      ];

      return (
        <>
          <Line
            points={points}
            closed
            fill={effectiveRoom.floorColor}
            stroke="#333"
            strokeWidth={2}
            listening={false}
          />
          <Text
            x={roomPx.x}
            y={roomPx.y - 22}
            text="ROOM"
            fontSize={14}
            fill="#333"
            listening={false}
          />
        </>
      );
    }

    return (
      <>
        <Rect
          x={roomPx.x}
          y={roomPx.y}
          width={roomPx.wPx}
          height={roomPx.hPx}
          fill={effectiveRoom.floorColor}
          stroke="#333"
          strokeWidth={2}
          listening={false}
        />
        <Text
          x={roomPx.x}
          y={roomPx.y - 22}
          text="ROOM"
          fontSize={14}
          fill="#333"
          listening={false}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 text-slate-900">
      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <button
              onClick={() => navigate("/dashboard")}
              className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-purple-200 bg-purple-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-purple-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>

            <h1 className="text-3xl font-semibold">2D Editor</h1>
            <p className="mt-2 text-slate-600">
              Room: {getShapeLabel(selectedShape)} • Height: {editorShapeValues.height ?? effectiveRoom.height}m • Scale: 1m = {pxPerMeter}px
            </p>
          </div>

          <button
            onClick={() =>
              navigate("/viewer-3d", {
                state: {
                  room: effectiveRoom,
                  roomConfig: {
                    shape: selectedShape,
                    values: Object.fromEntries(
                      Object.entries(editorShapeValues).map(([k, v]) => [k, String(v)])
                    ),
                    wallColor,
                    floorColor,
                  },
                  items,
                  pxPerMeter,
                  roomPx,
                },
              })
            }
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.01]"
          >
            <Eye className="h-4 w-4" />
            View in 3D
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="rounded-3xl border border-purple-200 bg-purple-100 p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white p-3 text-violet-600">
                      {renderShapeIcon(selectedShape)}
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
                  <p className="text-sm text-slate-600">Current canvas selection</p>
                </div>
              </div>

              {selectedItem ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-purple-200 bg-white p-4">
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">Name:</span> {selectedItem.modelName}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">Kind:</span>{" "}
                      {selectedItem.itemKind === "opening" ? selectedItem.type : selectedItem.type}
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
                    Doors and windows snap to walls. Furniture stays on the floor.
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
                <Ruler className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Canvas</h2>
                <p className="text-sm text-slate-600">Room and asset layout editor</p>
              </div>
            </div>

            <div className="overflow-auto rounded-3xl border border-purple-200 bg-white p-4">
              <Stage
                width={STAGE_W}
                height={STAGE_H}
                onMouseDown={clearSelection}
                onTouchStart={clearSelection}
                perfectDrawEnabled={false}
                hitOnDragEnabled
              >
                <Layer>
                  <Rect
                    x={0}
                    y={0}
                    width={STAGE_W}
                    height={STAGE_H}
                    fill="#fffafc"
                    listening={false}
                  />

                  {renderRoomShape()}

                  {items.map((it) => {
                    const wPx = it.wMeters * pxPerMeter;
                    const hPx = it.hMeters * pxPerMeter;

                    return (
                      <TopImageGroup
                        key={it.id}
                        x={it.x}
                        y={it.y}
                        w={wPx}
                        h={hPx}
                        rotation={it.rotation}
                        scaleX={it.scaleX}
                        scaleY={it.scaleY}
                        url={it.modelTopUrl}
                        selected={it.id === selectedId}
                        itemKind={it.itemKind}
                        openingType={it.itemKind === "opening" ? it.type : undefined}
                        color={it.itemKind === "furniture" ? it.color : undefined}
                        onSelect={(node) => {
                          setSelectedId(it.id);
                          onSelectNode(node);
                        }}
                        onDragEndCommit={(node) => {
                          if (it.itemKind === "opening") {
                            snapOpeningNodeToWall(node);
                            updateItem(it.id, {
                              x: node.x(),
                              y: node.y(),
                              rotation: node.rotation(),
                            });
                          } else {
                            clampNodeInsideRoom(node);
                            updateItem(it.id, { x: node.x(), y: node.y() });
                          }
                          onSelectNode(node);
                        }}
                        onTransformEndCommit={(node) => {
                          const sx = Math.max(0.4, Math.min(node.scaleX(), 3));
                          const sy = Math.max(0.4, Math.min(node.scaleY(), 3));
                          node.scaleX(sx);
                          node.scaleY(sy);

                          if (it.itemKind === "opening") {
                            snapOpeningNodeToWall(node);
                            updateItem(it.id, {
                              x: node.x(),
                              y: node.y(),
                              rotation: node.rotation(),
                              scaleX: sx,
                              scaleY: sy,
                            });
                          } else {
                            clampNodeInsideRoom(node);
                            updateItem(it.id, {
                              x: node.x(),
                              y: node.y(),
                              rotation: node.rotation(),
                              scaleX: sx,
                              scaleY: sy,
                            });
                          }
                          onSelectNode(node);
                        }}
                      />
                    );
                  })}

                  <Transformer
                    ref={trRef}
                    rotateEnabled
                    enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < 20 || newBox.height < 20) return oldBox;
                      return newBox;
                    }}
                  />
                </Layer>
              </Stage>
            </div>
          </main>
        </div>
      </div>

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
                    addModelToCanvas(m);
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
                    addOpeningToCanvas(asset);
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
    </div>
  );
}