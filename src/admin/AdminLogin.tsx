import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (username === "admin" && password === "admin123") {
      setError("");
      login();
      navigate("/dashboard");
    } else {
      setError("Invalid username or password.");
    }
  };

  return (
    <div className="min-h-screen bg-pink-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.10),transparent_30%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-purple-100 p-8 shadow-xl shadow-slate-200/60">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 text-xl font-bold text-white shadow-lg">
              L
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Livara
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Sign in to access your furniture dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Username
              </label>
              <input
  type="text"
  placeholder="Enter username (admin)"
  value={username}
  onChange={(e) => {
    setUsername(e.target.value);
    if (error) setError("");
  }}
  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(167,139,250,0.25),0_12px_30px_rgba(139,92,246,0.12)]"
/>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
  type="password"
  placeholder="Enter password (admin123)"
  value={password}
  onChange={(e) => {
    setPassword(e.target.value);
    if (error) setError("");
  }}
  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(167,139,250,0.25),0_12px_30px_rgba(139,92,246,0.12)]"
/>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-violet-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.01]"
            >
              Sign in
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-300" />
            <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
              protected access
            </span>
            <div className="h-px flex-1 bg-slate-300" />
          </div>

          <p className="text-center text-sm text-slate-500">Authorized users only</p>
        </div>
      </div>
    </div>
  );
}