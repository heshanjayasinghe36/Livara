import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  Home,
  RectangleHorizontal,
  Square,
  Circle,
  SlidersHorizontal,
  Ruler,
  GitBranch,
  ArrowRight,
  LogOut,
} from "lucide-react";

const roomShapes = [
  {
    id: "rectangle",
    name: "Rectangle",
    icon: RectangleHorizontal,
    description: "Best for standard bedrooms, living rooms, and offices.",
    fields: [
      { key: "length", label: "Room length", unit: "m" },
      { key: "width", label: "Room width", unit: "m" },
      { key: "height", label: "Room height", unit: "m" },
    ],
  },
  {
    id: "l-shape",
    name: "L-Shape",
    icon: GitBranch,
    description: "Useful for open-plan spaces or rooms with extensions.",
    fields: [
      { key: "mainLength", label: "Main length", unit: "m" },
      { key: "mainWidth", label: "Main width", unit: "m" },
      { key: "cutoutLength", label: "Cutout length", unit: "m" },
      { key: "cutoutWidth", label: "Cutout width", unit: "m" },
      { key: "height", label: "Room height", unit: "m" },
    ],
  },
  {
    id: "square",
    name: "Square",
    icon: Square,
    description: "Ideal for compact, balanced layouts with equal sides.",
    fields: [
      { key: "side", label: "Side length", unit: "m" },
      { key: "height", label: "Room height", unit: "m" },
    ],
  },
  {
    id: "circular",
    name: "Circular",
    icon: Circle,
    description: "For unique curved layouts and custom interior concepts.",
    fields: [
      { key: "diameter", label: "Diameter", unit: "m" },
      { key: "height", label: "Room height", unit: "m" },
    ],
  },
];

const defaults: Record<string, Record<string, string>> = {
  rectangle: { length: "5.5", width: "4.2", height: "2.8" },
  "l-shape": {
    mainLength: "6.5",
    mainWidth: "4.5",
    cutoutLength: "2.0",
    cutoutWidth: "1.8",
    height: "2.8",
  },
  square: { side: "4.0", height: "2.8" },
  circular: { diameter: "5.0", height: "2.8" },
};

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [selectedShape, setSelectedShape] = useState("rectangle");
  const [values, setValues] = useState<Record<string, string>>(defaults.rectangle);

  const shape = useMemo(
    () => roomShapes.find((item) => item.id === selectedShape) ?? roomShapes[0],
    [selectedShape]
  );

  const handleShapeChange = (shapeId: string) => {
    setSelectedShape(shapeId);
    setValues(defaults[shapeId]);
  };

  const handleFieldChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-pink-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
  <div>
    <button
      type="button"
      onClick={() => navigate("/designs")}
      className="inline-flex items-center gap-3 rounded-full border border-purple-200 bg-purple-100 px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:bg-purple-200"
    >
      <Home className="h-4 w-4 text-violet-600" />
      Livara Room Planner
    </button>

    <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
      Configure room geometry before placing furniture
    </h1>

    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
      Choose a room shape, enter its dimensions, and prepare a clean layout
      foundation for 2D planning and 3D visualization.
    </p>
  </div>

  <div className="flex flex-wrap gap-3">
    <button
      onClick={handleLogout}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-purple-200 bg-purple-100 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-purple-200"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>

    <button
      onClick={() =>
        navigate("/editor-2d", {
          state: {
            roomConfig: {
              shape: selectedShape,
              values,
              wallColor: "#d1d5db",
              floorColor: "#fdf2f8",
            },
            items: [],
          },
        })
      }
      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:scale-[1.01]"
    >
      Continue
      <ArrowRight className="h-4 w-4" />
    </button>
  </div>
</header>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-purple-200 bg-purple-100 p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-white p-3 text-violet-600">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Room setup</h2>
                <p className="text-sm text-slate-600">
                  Select the room structure and provide exact measurements.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {roomShapes.map((item) => {
  const Icon = item.icon;
  const active = item.id === selectedShape;

  return (
    <button
      key={item.id}
      type="button"
      onClick={() => handleShapeChange(item.id)}
      className={`flex h-full min-h-[220px] flex-col items-start justify-start rounded-2xl border p-5 text-left align-top transition ${
        active
          ? "border-violet-400 bg-white shadow-[0_0_0_3px_rgba(167,139,250,0.25),0_12px_30px_rgba(139,92,246,0.12)]"
          : "border-purple-200 bg-white/70 hover:bg-white"
      }`}
    >
      <div
        className={`mb-4 inline-flex rounded-xl p-3 ${
          active
            ? "bg-violet-100 text-violet-700"
            : "bg-purple-100 text-slate-600"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <h3 className="text-base font-semibold">{item.name}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        {item.description}
      </p>
    </button>
  );
})}
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-2">
  {shape.fields.map((field) => (
    <div key={field.key} className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          {field.label}
        </label>
        <span className="text-sm font-semibold text-violet-700">
          {values[field.key] || "2.0"} {field.unit}
        </span>
      </div>

      <div className="rounded-2xl border border-purple-200 bg-white px-4 py-4">
        <input
          type="range"
          min="2"
          max="10"
          step="0.1"
          value={values[field.key] ?? "2"}
          onChange={(e) => handleFieldChange(field.key, e.target.value)}
          className="w-full accent-violet-600"
        />

        <div className="mt-3 flex items-center gap-3">
          <input
            type="number"
            min="2"
            max="10"
            step="0.1"
            value={values[field.key] ?? ""}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-28 rounded-xl border border-purple-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(167,139,250,0.18)]"
          />
          <span className="text-sm text-slate-500">{field.unit}</span>
          <span className="ml-auto text-xs text-slate-400">2m — 10m</span>
        </div>
      </div>
    </div>
  ))}
</div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Wall thickness", value: "0.15 m" },
                { label: "Ceiling profile", value: "Flat ceiling" },
                { label: "Floor origin", value: "Center aligned" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-purple-200 bg-white p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <aside>
            <section className="rounded-3xl border border-purple-200 bg-purple-100 p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-white p-3 text-violet-600">
                  <Ruler className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Preview summary</h2>
                  <p className="text-sm text-slate-600">Current room parameters</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-purple-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Selected shape
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {shape.name}
                  </p>
                </div>

                {shape.fields.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center justify-between rounded-2xl border border-purple-200 bg-white px-4 py-3"
                  >
                    <span className="text-sm text-slate-600">{field.label}</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {values[field.key] || "0.0"} {field.unit}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}