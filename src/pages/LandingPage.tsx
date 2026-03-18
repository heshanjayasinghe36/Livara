import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const galleryImages = [
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-pink-50 px-6 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center overflow-hidden rounded-[32px] border border-white/70 bg-white/70 p-6 shadow-2xl backdrop-blur md:p-10">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="max-w-xl">
            <div className="mb-4 inline-block rounded-full bg-violet-100 px-4 py-2 text-sm font-medium text-violet-700">
              Livara Room Designer
            </div>

            <h1 className="text-4xl font-black leading-tight sm:text-5xl md:text-6xl">
              Design your
              <span className="block bg-gradient-to-r from-violet-600 to-sky-500 bg-clip-text text-transparent">
                room today
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
              Create your ideal space with an easy furniture visualizer. Plan,
              arrange, and preview your room in a simple and beautiful way.
            </p>

            <button
              onClick={() => navigate("/admin/login")}
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-base font-semibold text-white transition hover:scale-[1.03]"
            >
              Start Designing
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          <div className="relative flex h-[420px] items-center justify-center">
            <img
              src={galleryImages[0]}
              alt="Room inspiration 1"
              className="absolute left-8 top-5 h-44 w-40 rotate-[-12deg] rounded-[24px] object-cover shadow-xl sm:h-52 sm:w-44"
            />
            <img
              src={galleryImages[1]}
              alt="Room inspiration 2"
              className="absolute right-10 top-4 h-52 w-44 rotate-[10deg] rounded-[24px] object-cover shadow-xl sm:h-60 sm:w-48"
            />
            <img
              src={galleryImages[2]}
              alt="Room inspiration 3"
              className="absolute bottom-8 left-16 h-48 w-44 rotate-[8deg] rounded-[24px] object-cover shadow-xl sm:h-56 sm:w-48"
            />
            <img
              src={galleryImages[3]}
              alt="Room inspiration 4"
              className="absolute bottom-10 right-8 h-44 w-40 rotate-[-10deg] rounded-[24px] object-cover shadow-xl sm:h-52 sm:w-44"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
