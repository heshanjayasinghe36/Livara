import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { 
  Home, 
  Calendar, 
  User, 
  Hash,
  Trash2,
  Eye,
  ArrowLeft,
  Package // Add this import for the furniture icon
} from "lucide-react";

type Design = {
  id: string;
  customer_id: string;
  customer_name: string;
  room_config: any;
  items: any[];
  thumbnail_url: string | null;
  created_at: string;
};

export default function DesignsGallery() {
  const navigate = useNavigate();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDesigns();
  }, []);

  async function loadDesigns() {
    try {
      const { data, error } = await supabase
        .from("designs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDesigns(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load designs");
    } finally {
      setLoading(false);
    }
  }

  async function deleteDesign(id: string) {
    if (!confirm("Are you sure you want to delete this design?")) return;

    try {
      // Get the design to find its thumbnail
      const design = designs.find(d => d.id === id);
      
      // Delete from database
      const { error } = await supabase
        .from("designs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // If there's a thumbnail, delete it from storage
      if (design?.thumbnail_url) {
        const filePath = `${id}.jpg`;
        await supabase.storage
          .from('design-thumbnails')
          .remove([filePath]);
      }

      setDesigns(designs.filter(d => d.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete design");
    }
  }

  function loadDesign(design: Design) {
    navigate("/editor-2d", {
      state: {
        room: {
          length: design.room_config.values?.length || 
                  design.room_config.values?.side || 
                  design.room_config.values?.diameter || 
                  5.5,
          width: design.room_config.values?.width || 
                 design.room_config.values?.side || 
                 design.room_config.values?.diameter || 
                 4.2,
          height: design.room_config.values?.height || 2.8,
          wallColor: design.room_config.wallColor || "#ffffff",
          floorColor: design.room_config.floorColor || "#e5e5e5",
        },
        roomConfig: design.room_config,
        items: design.items,
      },
    });
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading designs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate("/dashboard")}
              className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-purple-200 bg-purple-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-purple-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-semibold">Design Gallery</h1>
            <p className="mt-2 text-slate-600">
              View and manage all your saved designs
            </p>
          </div>

          <div className="flex gap-3">
            {/* Manage Furniture Button - New */}
            <button
              onClick={() => navigate("/admin/dashboard")}
              className="inline-flex items-center gap-2 rounded-2xl border border-purple-200 bg-purple-100 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-purple-200 hover:scale-[1.02]"
            >
              <Package className="h-4 w-4" />
              Manage Furniture
            </button>

            {/* Create New Design Button - Existing */}
            <button
              onClick={() => navigate("/dashboard")}
              className="rounded-2xl bg-gradient-to-r from-sky-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] hover:shadow-xl"
            >
              Create New Design
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Designs grid */}
        {designs.length === 0 ? (
          <div className="rounded-3xl border border-purple-200 bg-purple-100 p-16 text-center">
            <Home className="mx-auto h-12 w-12 text-violet-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No designs yet</h3>
            <p className="mt-2 text-slate-600">Create your first design to see it here.</p>
            <button
              onClick={() => navigate("/editor-2d")}
              className="mt-6 rounded-2xl bg-gradient-to-r from-sky-500 to-violet-500 px-6 py-3 text-white"
            >
              Start Designing
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {designs.map((design) => (
              <div
                key={design.id}
                className="group rounded-3xl border border-purple-200 bg-white/80 shadow-sm backdrop-blur-sm transition-all hover:shadow-xl hover:-translate-y-1"
              >
                {/* Thumbnail */}
                <div className="relative h-48 overflow-hidden rounded-t-3xl bg-gradient-to-br from-sky-100 to-violet-100">
                  {design.thumbnail_url ? (
                    <img
                      src={design.thumbnail_url}
                      alt={`Design ${design.customer_name}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Home className="h-12 w-12 text-violet-300" />
                    </div>
                  )}
                  
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-3">
                    <button
                      onClick={() => loadDesign(design)}
                      className="rounded-xl bg-white p-3 text-violet-600 transition hover:scale-110"
                      title="View Design"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => deleteDesign(design.id)}
                      className="rounded-xl bg-white p-3 text-red-600 transition hover:scale-110"
                      title="Delete Design"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Design info - NO NAME FIELD */}
                <div className="p-5">
                  {/* Customer info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Hash className="h-4 w-4 text-violet-500" />
                      <span className="font-medium">ID: {design.customer_id}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <User className="h-4 w-4 text-violet-500" />
                      <span>{design.customer_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="h-4 w-4 text-violet-500" />
                      <span>{formatDate(design.created_at)}</span>
                    </div>
                  </div>

                  {/* Room shape badge */}
                  <div className="mt-4">
                    <span className="inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                      {design.room_config.shape || "rectangle"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
