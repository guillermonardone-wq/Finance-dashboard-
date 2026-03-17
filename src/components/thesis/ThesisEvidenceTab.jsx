import { useState, useCallback } from "react";
import { api } from "../../lib/api";
import { useSignalStore } from "../../store/useSignalStore";
import SourceBadge from "./SourceBadge";

/**
 * ThesisEvidenceTab — Linked signals list + search/link panel.
 *
 * Encapsulates all signal-linking state so ThesisDetail doesn't need it.
 */
export default function ThesisEvidenceTab({ thesisId, signals }) {
  const { updateSignal, fetchCounts } = useSignalStore();
  const fetchSignals = useSignalStore((s) => s.fetchSignals);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const refreshLinked = useCallback(() => {
    fetchSignals({ thesis_id: thesisId });
  }, [fetchSignals, thesisId]);

  const loadInboxSignals = useCallback(async (query) => {
    try {
      const results = await api.getSignals({ status: "inbox" });
      if (query) {
        const q = query.toLowerCase();
        return results
          .filter(
            (s) =>
              s.title.toLowerCase().includes(q) ||
              (s.description && s.description.toLowerCase().includes(q)),
          )
          .slice(0, 10);
      }
      return results.slice(0, 10);
    } catch {
      return [];
    }
  }, []);

  const handleSearchChange = useCallback(
    async (value) => {
      setSearchQuery(value);
      if (value.trim().length >= 2) {
        setSearchResults(await loadInboxSignals(value));
      } else if (value.trim().length === 0) {
        setSearchResults(await loadInboxSignals(null));
      }
    },
    [loadInboxSignals],
  );

  const handleSearchFocus = useCallback(async () => {
    if (searchResults.length === 0) {
      setSearchResults(await loadInboxSignals(null));
    }
  }, [searchResults.length, loadInboxSignals]);

  const handleLink = useCallback(
    async (signalId) => {
      await updateSignal(signalId, { thesis_id: thesisId, status: "linked" });
      refreshLinked();
      fetchCounts();
      setSearchResults((prev) => prev.filter((r) => r.id !== signalId));
    },
    [updateSignal, thesisId, refreshLinked, fetchCounts],
  );

  const handleUnlink = useCallback(
    async (signalId) => {
      await updateSignal(signalId, { thesis_id: null, status: "inbox" });
      refreshLinked();
      fetchCounts();
    },
    [updateSignal, refreshLinked, fetchCounts],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-bold text-slate-300">Linked Signals</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {signals.length} signal{signals.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="px-3 py-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded transition-colors"
          >
            {showSearch ? "Close" : "+ Add Signal"}
          </button>
        </div>
      </div>

      {/* Search / browse panel */}
      {showSearch && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <input
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={handleSearchFocus}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 mb-3"
            placeholder="Search inbox signals by title or description..."
            autoFocus
          />
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-600 py-4 text-center">
                {searchQuery
                  ? "No matching signals in inbox."
                  : "No unlinked signals available."}
              </p>
            ) : (
              searchResults.map((s) => {
                const alreadyLinked = signals.some(
                  (linked) => linked.id === s.id,
                );
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-3 py-2 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-xs text-slate-200 truncate">
                        {s.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <SourceBadge type={s.source_type} />
                        <span className="text-xs text-slate-600">
                          {s.category?.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                    {alreadyLinked ? (
                      <span className="text-xs text-slate-600 flex-shrink-0">
                        linked
                      </span>
                    ) : (
                      <button
                        onClick={() => handleLink(s.id)}
                        className="px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded flex-shrink-0 transition-colors"
                      >
                        Link
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Linked signals list */}
      {signals.length === 0 ? (
        <p className="text-sm text-slate-600 py-8 text-center">
          No linked signals yet. Click "+ Add Signal" to search and link
          evidence.
        </p>
      ) : (
        signals.map((s) => (
          <div
            key={s.id}
            className="bg-slate-800/50 rounded p-3 border border-slate-700/30"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-200">{s.title}</span>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {s.description}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <SourceBadge type={s.source_type} />
                  <span className="text-xs text-slate-600">
                    {s.category?.replace(/_/g, " ")}
                  </span>
                  {s.source_attribution && (
                    <span className="text-xs text-slate-600">
                      via {s.source_attribution}
                    </span>
                  )}
                  <span
                    className={`text-xs ${s.reliability === "verified" ? "text-emerald-400" : "text-slate-500"}`}
                  >
                    {s.reliability}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleUnlink(s.id)}
                className="px-2 py-1 text-xs text-slate-500 hover:text-red-400 rounded ml-2 flex-shrink-0 transition-colors"
                title="Unlink this signal"
              >
                unlink
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
