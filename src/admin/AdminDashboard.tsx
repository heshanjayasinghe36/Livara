import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../supabaseClient";
import { 
  Package, 
  DoorOpen, 
  Trash2, 
  Edit, 
  X, 
  Image as ImageIcon,
  Ruler,
  RotateCw,
  Scale,
  ChevronDown,
  Plus
} from "lucide-react";

type ModelType = "CHAIR" | "DINING TABLE" | "SIDE TABLE" | "SOFA" | "BED";
type OpeningType = "DOOR" | "WINDOW";

type FurnitureModelRow = {
  id: string;
  type: ModelType;
  name: string;
  model_path: string;
  public_url: string;
  ftop_url: string | null;
  fpic_url: string | null;
  default_scale: number;
  rotation_y: number;
  created_at: string;
  width_m: number | null;
  depth_m: number | null;
};

type OpeningRow = {
  id: string;
  name: string;
  glb_path: string;
  public_url: string;
  type: OpeningType;
  created_at: string;
  "d&w_url": string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"furniture" | "openings">("furniture");
  
  // Furniture states
  const [type, setType] = useState<ModelType>("CHAIR");
  const [name, setName] = useState("");
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [topFile, setTopFile] = useState<File | null>(null);
  const [picFile, setPicFile] = useState<File | null>(null);
  const [defaultScale, setDefaultScale] = useState<number>(1);
  const [rotationY, setRotationY] = useState<number>(0);
  const [widthM, setWidthM] = useState<number>(0.8);
  const [depthM, setDepthM] = useState<number>(0.8);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<FurnitureModelRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Opening states
  const [openingType, setOpeningType] = useState<OpeningType>("DOOR");
  const [openingName, setOpeningName] = useState("");
  const [openingGlbFile, setOpeningGlbFile] = useState<File | null>(null);
  const [openingPicFile, setOpeningPicFile] = useState<File | null>(null);
  const [openingLoading, setOpeningLoading] = useState(false);
  const [openings, setOpenings] = useState<OpeningRow[]>([]);
  const [openingError, setOpeningError] = useState<string | null>(null);

  // Edit states
  const [editingFurniture, setEditingFurniture] = useState<FurnitureModelRow | null>(null);
  const [editingOpening, setEditingOpening] = useState<OpeningRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editWidth, setEditWidth] = useState<number>(0);
  const [editDepth, setEditDepth] = useState<number>(0);
  const [editScale, setEditScale] = useState<number>(1);
  const [editRotation, setEditRotation] = useState<number>(0);
  const [editLoading, setEditLoading] = useState(false);

  // Upload form visibility
  const [showFurnitureForm, setShowFurnitureForm] = useState(false);
  const [showOpeningForm, setShowOpeningForm] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then((r) => console.log("AUTH USER:", r.data.user));
  }, []);

  async function loadModels() {
    setError(null);
    const res = await supabase
      .from("furniture_models")
      .select("*")
      .order("created_at", { ascending: false });

    if (res.error) {
      setError(res.error.message);
      return;
    }
    setModels((res.data ?? []) as FurnitureModelRow[]);
  }

  async function loadOpenings() {
    setOpeningError(null);
    const res = await supabase
      .from("doors_windows")
      .select('*')
      .order("created_at", { ascending: false });

    if (res.error) {
      setOpeningError(res.error.message);
      return;
    }
    setOpenings((res.data ?? []) as OpeningRow[]);
  }

  useEffect(() => {
    loadModels();
    loadOpenings();
  }, []);

  function extFromName(filename: string) {
    const parts = filename.split(".");
    return (parts[parts.length - 1] || "").toLowerCase();
  }

  async function uploadToBucket(bucket: string, path: string, file: File, contentType?: string) {
    const up = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType,
    });

    if (up.error) throw up.error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Please enter a model name.");
    if (!glbFile) return setError("Please choose a .glb file.");
    if (!glbFile.name.toLowerCase().endsWith(".glb")) return setError("Only .glb files allowed.");
    if (!(widthM > 0)) return setError("Please enter a valid Width (m).");
    if (!(depthM > 0)) return setError("Please enter a valid Depth (m).");

    if (topFile && !["png", "jpg", "jpeg", "webp"].includes(extFromName(topFile.name))) {
      return setError("Top image must be png/jpg/jpeg/webp.");
    }

    if (picFile && !["png", "jpg", "jpeg", "webp"].includes(extFromName(picFile.name))) {
      return setError("Preview image must be png/jpg/jpeg/webp.");
    }

    setLoading(true);

    try {
      const id = crypto.randomUUID();

      const glbPath = `${type.toLowerCase()}/${id}.glb`;
      const glbUrl = await uploadToBucket("models", glbPath, glbFile, "model/gltf-binary");

      let ftopUrl: string | null = null;
      if (topFile) {
        const topExt = extFromName(topFile.name);
        const topPath = `${type.toLowerCase()}/${id}.${topExt}`;
        ftopUrl = await uploadToBucket("ftops", topPath, topFile, topFile.type || undefined);
      }

      let fpicUrl: string | null = null;
      if (picFile) {
        const picExt = extFromName(picFile.name);
        const picPath = `${type.toLowerCase()}/${id}.${picExt}`;
        fpicUrl = await uploadToBucket("fpics", picPath, picFile, picFile.type || undefined);
      }

      const ins = await supabase.from("furniture_models").insert({
        type,
        name: name.trim(),
        model_path: glbPath,
        public_url: glbUrl,
        ftop_url: ftopUrl,
        fpic_url: fpicUrl,
        default_scale: defaultScale,
        rotation_y: rotationY,
        width_m: widthM,
        depth_m: depthM,
      });

      if (ins.error) throw ins.error;

      // Reset form
      setName("");
      setGlbFile(null);
      setTopFile(null);
      setPicFile(null);
      setDefaultScale(1);
      setRotationY(0);
      setWidthM(0.8);
      setDepthM(0.8);
      setShowFurnitureForm(false);

      const glbInput = document.getElementById("glbInput") as HTMLInputElement | null;
      const topInput = document.getElementById("topInput") as HTMLInputElement | null;
      const picInput = document.getElementById("picInput") as HTMLInputElement | null;

      if (glbInput) glbInput.value = "";
      if (topInput) topInput.value = "";
      if (picInput) picInput.value = "";

      await loadModels();
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "Upload failed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleOpeningUpload(e: FormEvent) {
    e.preventDefault();
    setOpeningError(null);

    if (!openingName.trim()) return setOpeningError("Please enter a door/window name.");
    if (!openingGlbFile) return setOpeningError("Please choose a .glb file.");
    if (!openingGlbFile.name.toLowerCase().endsWith(".glb")) {
      return setOpeningError("Only .glb files allowed.");
    }

    if (
      openingPicFile &&
      !["png", "jpg", "jpeg", "webp"].includes(extFromName(openingPicFile.name))
    ) {
      return setOpeningError("Display image must be png/jpg/jpeg/webp.");
    }

    setOpeningLoading(true);

    try {
      const id = crypto.randomUUID();
      const folder = openingType === "DOOR" ? "doors" : "windows";

      const glbPath = `${folder}/${id}.glb`;
      const publicUrl = await uploadToBucket(
        "Doors&Windows",
        glbPath,
        openingGlbFile,
        "model/gltf-binary"
      );

      let openingPicUrl: string | null = null;
      if (openingPicFile) {
        const picExt = extFromName(openingPicFile.name);
        const picPath = `${folder}/${id}.${picExt}`;
        openingPicUrl = await uploadToBucket(
          "d&wpics",
          picPath,
          openingPicFile,
          openingPicFile.type || undefined
        );
      }

      const ins = await supabase.from("doors_windows").insert({
        name: openingName.trim(),
        glb_path: glbPath,
        public_url: publicUrl,
        type: openingType,
        "d&w_url": openingPicUrl,
      });

      if (ins.error) throw ins.error;

      setOpeningName("");
      setOpeningGlbFile(null);
      setOpeningPicFile(null);
      setOpeningType("DOOR");
      setShowOpeningForm(false);

      const openingInput = document.getElementById("openingGlbInput") as HTMLInputElement | null;
      const openingPicInput = document.getElementById("openingPicInput") as HTMLInputElement | null;

      if (openingInput) openingInput.value = "";
      if (openingPicInput) openingPicInput.value = "";

      await loadOpenings();
    } catch (err: unknown) {
      console.error(err);
      setOpeningError(getErrorMessage(err, "Door/Window upload failed"));
    } finally {
      setOpeningLoading(false);
    }
  }

  async function deleteFurniture(id: string) {
    if (!confirm("Are you sure you want to delete this furniture item?")) return;

    try {
      const { error } = await supabase
        .from("furniture_models")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await loadModels();
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Failed to delete"));
    }
  }

  async function deleteOpening(id: string) {
    if (!confirm("Are you sure you want to delete this door/window?")) return;

    try {
      const { error } = await supabase
        .from("doors_windows")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await loadOpenings();
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Failed to delete"));
    }
  }

  function openEditFurniture(item: FurnitureModelRow) {
    setEditingFurniture(item);
    setEditName(item.name);
    setEditWidth(item.width_m || 0);
    setEditDepth(item.depth_m || 0);
    setEditScale(item.default_scale);
    setEditRotation(item.rotation_y);
  }

  function openEditOpening(item: OpeningRow) {
    setEditingOpening(item);
    setEditName(item.name);
  }

  async function saveEditFurniture() {
    if (!editingFurniture) return;
    setEditLoading(true);

    try {
      const { error } = await supabase
        .from("furniture_models")
        .update({
          name: editName,
          width_m: editWidth,
          depth_m: editDepth,
          default_scale: editScale,
          rotation_y: editRotation,
        })
        .eq("id", editingFurniture.id);

      if (error) throw error;
      
      setEditingFurniture(null);
      await loadModels();
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Failed to update"));
    } finally {
      setEditLoading(false);
    }
  }

  async function saveEditOpening() {
    if (!editingOpening) return;
    setEditLoading(true);

    try {
      const { error } = await supabase
        .from("doors_windows")
        .update({ name: editName })
        .eq("id", editingOpening.id);

      if (error) throw error;
      
      setEditingOpening(null);
      await loadOpenings();
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Failed to update"));
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab("furniture")}
              className={`flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold transition-all ${
                activeTab === "furniture"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg"
                  : "bg-white text-slate-700 hover:bg-purple-50"
              }`}
            >
              <Package className="h-4 w-4" />
              Furniture
            </button>
            <button
              onClick={() => setActiveTab("openings")}
              className={`flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold transition-all ${
                activeTab === "openings"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg"
                  : "bg-white text-slate-700 hover:bg-purple-50"
              }`}
            >
              <DoorOpen className="h-4 w-4" />
              Doors & Windows
            </button>
          </div>
        </div>

        {/* Edit Modals */}
        {editingFurniture && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">Edit Furniture</h3>
                <button
                  onClick={() => setEditingFurniture(null)}
                  className="rounded-xl p-2 hover:bg-purple-50"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Width (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editWidth}
                      onChange={(e) => setEditWidth(Number(e.target.value))}
                      className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Depth (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editDepth}
                      onChange={(e) => setEditDepth(Number(e.target.value))}
                      className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Scale</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editScale}
                      onChange={(e) => setEditScale(Number(e.target.value))}
                      className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Rotation</label>
                    <input
                      type="number"
                      step="1"
                      value={editRotation}
                      onChange={(e) => setEditRotation(Number(e.target.value))}
                      className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setEditingFurniture(null)}
                    className="flex-1 rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-purple-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditFurniture}
                    disabled={editLoading}
                    className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 text-sm font-medium text-white hover:shadow-lg disabled:opacity-50"
                  >
                    {editLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingOpening && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">Edit Door/Window</h3>
                <button
                  onClick={() => setEditingOpening(null)}
                  className="rounded-xl p-2 hover:bg-purple-50"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setEditingOpening(null)}
                    className="flex-1 rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-purple-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditOpening}
                    disabled={editLoading}
                    className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 text-sm font-medium text-white hover:shadow-lg disabled:opacity-50"
                  >
                    {editLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="space-y-6">
          {activeTab === "furniture" ? (
            <>
              {/* Add Furniture Button */}
              <button
                onClick={() => setShowFurnitureForm(!showFurnitureForm)}
                className="flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 p-2 text-white">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="font-medium text-slate-900">Add New Furniture</span>
                </div>
                <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform ${showFurnitureForm ? "rotate-180" : ""}`} />
              </button>

              {/* Furniture Upload Form */}
              {showFurnitureForm && (
                <form
                  onSubmit={handleUpload}
                  className="rounded-3xl border border-purple-100 bg-white p-6 shadow-lg"
                >
                  <h2 className="mb-4 text-xl font-semibold text-slate-900">Upload New Furniture</h2>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Type</label>
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value as ModelType)}
                          className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400"
                        >
                          <option value="CHAIR">Chair</option>
                          <option value="DINING TABLE">Dining Table</option>
                          <option value="SIDE TABLE">Side Table</option>
                          <option value="BED">Bed</option>
                          <option value="SOFA">Sofa</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g., Modern Chair"
                          className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Width (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={widthM}
                          onChange={(e) => setWidthM(Number(e.target.value))}
                          className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Depth (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={depthM}
                          onChange={(e) => setDepthM(Number(e.target.value))}
                          className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Scale</label>
                        <input
                          type="number"
                          step="0.1"
                          value={defaultScale}
                          onChange={(e) => setDefaultScale(Number(e.target.value))}
                          className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Rotation</label>
                        <input
                          type="number"
                          step="1"
                          value={rotationY}
                          onChange={(e) => setRotationY(Number(e.target.value))}
                          className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">GLB File</label>
                      <input
                        id="glbInput"
                        type="file"
                        accept=".glb"
                        onChange={(e) => setGlbFile(e.target.files?.[0] || null)}
                        className="w-full text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-violet-700 hover:file:bg-violet-100"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Top View (optional)</label>
                        <input
                          id="topInput"
                          type="file"
                          accept="image/*"
                          onChange={(e) => setTopFile(e.target.files?.[0] || null)}
                          className="w-full text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-violet-700"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Preview (optional)</label>
                        <input
                          id="picInput"
                          type="file"
                          accept="image/*"
                          onChange={(e) => setPicFile(e.target.files?.[0] || null)}
                          className="w-full text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-violet-700"
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-50"
                    >
                      {loading ? "Uploading..." : "Upload Furniture"}
                    </button>
                  </div>
                </form>
              )}

              {/* Furniture List */}
              <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-lg">
                <h2 className="mb-4 text-xl font-semibold text-slate-900">Furniture Collection</h2>

                {models.length === 0 ? (
                  <div className="rounded-2xl bg-purple-50 p-8 text-center">
                    <Package className="mx-auto h-12 w-12 text-violet-300" />
                    <p className="mt-2 text-sm text-slate-600">No furniture yet. Add your first piece!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {models.map((item) => (
                      <div
                        key={item.id}
                        className="group rounded-2xl border border-purple-100 bg-gradient-to-r from-white to-purple-50/30 p-4 transition-all hover:shadow-md"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                                {item.type}
                              </span>
                              <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                            </div>

                            <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
                              <div className="flex items-center gap-1 text-slate-600">
                                <Ruler className="h-4 w-4 text-violet-500" />
                                <span>{item.width_m?.toFixed(2)}m × {item.depth_m?.toFixed(2)}m</span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-600">
                                <Scale className="h-4 w-4 text-violet-500" />
                                <span>Scale: {item.default_scale}</span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-600">
                                <RotateCw className="h-4 w-4 text-violet-500" />
                                <span>Rot: {item.rotation_y}°</span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-600">
                                <ImageIcon className="h-4 w-4 text-violet-500" />
                                <span>{item.fpic_url ? "Has preview" : "No preview"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditFurniture(item)}
                              className="rounded-xl bg-white p-2 text-slate-600 shadow-sm transition-all hover:bg-violet-50 hover:text-violet-600"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteFurniture(item.id)}
                              className="rounded-xl bg-white p-2 text-slate-600 shadow-sm transition-all hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2 text-xs">
                          <a
                            href={item.public_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-violet-50 px-3 py-1 text-violet-700 hover:bg-violet-100"
                          >
                            View GLB
                          </a>
                          {item.ftop_url && (
                            <a
                              href={item.ftop_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-100"
                            >
                              Top View
                            </a>
                          )}
                          {item.fpic_url && (
                            <a
                              href={item.fpic_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-green-50 px-3 py-1 text-green-700 hover:bg-green-100"
                            >
                              Preview
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Add Opening Button */}
              <button
                onClick={() => setShowOpeningForm(!showOpeningForm)}
                className="flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 p-2 text-white">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="font-medium text-slate-900">Add New Door/Window</span>
                </div>
                <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform ${showOpeningForm ? "rotate-180" : ""}`} />
              </button>

              {/* Opening Upload Form */}
              {showOpeningForm && (
                <form
                  onSubmit={handleOpeningUpload}
                  className="rounded-3xl border border-purple-100 bg-white p-6 shadow-lg"
                >
                  <h2 className="mb-4 text-xl font-semibold text-slate-900">Upload New Door/Window</h2>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Type</label>
                        <select
                          value={openingType}
                          onChange={(e) => setOpeningType(e.target.value as OpeningType)}
                          className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400"
                        >
                          <option value="DOOR">Door</option>
                          <option value="WINDOW">Window</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                        <input
                          value={openingName}
                          onChange={(e) => setOpeningName(e.target.value)}
                          placeholder="e.g., Main Door"
                          className="w-full rounded-xl border border-purple-200 px-4 py-3 text-sm outline-none focus:border-violet-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">GLB File</label>
                      <input
                        id="openingGlbInput"
                        type="file"
                        accept=".glb"
                        onChange={(e) => setOpeningGlbFile(e.target.files?.[0] || null)}
                        className="w-full text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-violet-700"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Display Image (optional)</label>
                      <input
                        id="openingPicInput"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setOpeningPicFile(e.target.files?.[0] || null)}
                        className="w-full text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-violet-700"
                      />
                    </div>

                    {openingError && (
                      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                        {openingError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={openingLoading}
                      className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-50"
                    >
                      {openingLoading ? "Uploading..." : "Upload Door/Window"}
                    </button>
                  </div>
                </form>
              )}

              {/* Openings List */}
              <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-lg">
                <h2 className="mb-4 text-xl font-semibold text-slate-900">Doors & Windows Collection</h2>

                {openings.length === 0 ? (
                  <div className="rounded-2xl bg-purple-50 p-8 text-center">
                    <DoorOpen className="mx-auto h-12 w-12 text-violet-300" />
                    <p className="mt-2 text-sm text-slate-600">No doors or windows yet. Add your first one!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {openings.map((item) => (
                      <div
                        key={item.id}
                        className="group rounded-2xl border border-purple-100 bg-gradient-to-r from-white to-purple-50/30 p-4 transition-all hover:shadow-md"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                                {item.type}
                              </span>
                              <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditOpening(item)}
                              className="rounded-xl bg-white p-2 text-slate-600 shadow-sm transition-all hover:bg-violet-50 hover:text-violet-600"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteOpening(item.id)}
                              className="rounded-xl bg-white p-2 text-slate-600 shadow-sm transition-all hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2 text-xs">
                          <a
                            href={item.public_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-violet-50 px-3 py-1 text-violet-700 hover:bg-violet-100"
                          >
                            View GLB
                          </a>
                          {item["d&w_url"] && (
                            <a
                              href={item["d&w_url"]}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-green-50 px-3 py-1 text-green-700 hover:bg-green-100"
                            >
                              Preview
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}