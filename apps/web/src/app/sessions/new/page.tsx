"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TrackResponse } from "@racing-coach/types";

export default function NewSessionPage() {
  const router = useRouter();
  const [tracks, setTracks] = useState<TrackResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    trackId: "",
    date: new Date().toISOString().split("T")[0],
    carName: "",
    carNotes: "",
    conditions: "dry" as "dry" | "wet" | "mixed",
  });

  useEffect(() => {
    fetch("/api/tracks")
      .then((r) => r.json())
      .then(setTracks)
      .catch(() => setError("Failed to load tracks"));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          date: new Date(form.date).toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create session");
      }

      const session = await res.json();
      router.push(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Session</h1>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="label">
            Session Name
          </label>
          <input
            id="name"
            type="text"
            className="input w-full"
            placeholder="e.g. Saturday Morning Practice"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        <div>
          <label htmlFor="trackId" className="label">
            Track
          </label>
          <select
            id="trackId"
            className="input w-full"
            value={form.trackId}
            onChange={(e) => setForm({ ...form, trackId: e.target.value })}
            required
          >
            <option value="">Select a track...</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.location} ({t.cornerCount} corners)
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="date" className="label">
              Date
            </label>
            <input
              id="date"
              type="date"
              className="input w-full"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="conditions" className="label">
              Conditions
            </label>
            <select
              id="conditions"
              className="input w-full"
              value={form.conditions}
              onChange={(e) =>
                setForm({
                  ...form,
                  conditions: e.target.value as "dry" | "wet" | "mixed",
                })
              }
            >
              <option value="dry">Dry</option>
              <option value="wet">Wet</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="carName" className="label">
            Car (optional)
          </label>
          <input
            id="carName"
            type="text"
            className="input w-full"
            placeholder="e.g. 2019 Mazda MX-5"
            value={form.carName}
            onChange={(e) => setForm({ ...form, carName: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="carNotes" className="label">
            Car Notes (optional)
          </label>
          <textarea
            id="carNotes"
            className="input w-full"
            rows={2}
            placeholder="Tires, mods, setup notes..."
            value={form.carNotes}
            onChange={(e) => setForm({ ...form, carNotes: e.target.value })}
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating..." : "Create Session"}
        </button>
      </form>
    </div>
  );
}
