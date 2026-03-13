import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useThesisStore } from '../store/useThesisStore';
import { ClassificationBadge, CompositeScoreBar } from '../components/common/ScoreDisplay';

export default function ThesisList() {
  const { theses, fetchTheses, loading } = useThesisStore();
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    fetchTheses(filter !== 'all' ? { status: filter } : {});
  }, [fetchTheses, filter]);

  const statusFilters = ['all', 'draft', 'active', 'approved', 'executing', 'closed', 'invalidated'];

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Theses</h1>
          <p className="text-sm text-slate-500 mt-1">Structured views. Not stories.</p>
        </div>
        <Link to="/thesis/new"
          className="px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded text-sm hover:bg-cyan-500/20">
          + New Thesis
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-4">
        {statusFilters.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === f ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-slate-600 py-8 text-center">Loading...</p>
      ) : theses.length === 0 ? (
        <p className="text-sm text-slate-600 py-12 text-center">No theses in this view.</p>
      ) : (
        <div className="space-y-2">
          {theses.map(thesis => (
            <Link key={thesis.id} to={`/thesis/${thesis.id}`} className="block">
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 hover:border-slate-700 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 mr-4">
                    <h3 className="text-sm font-medium text-slate-200">{thesis.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{thesis.thesis_statement}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ClassificationBadge classification={thesis.classification} />
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      thesis.status === 'active' ? 'bg-cyan-500/10 text-cyan-400' :
                        thesis.status === 'quarantined' ? 'bg-red-500/10 text-red-400' :
                          'bg-slate-800 text-slate-500'
                    }`}>
                      {thesis.status}
                    </span>
                  </div>
                </div>
                <div className="w-64">
                  <CompositeScoreBar score={thesis.composite_score || 0} />
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-600">
                  <span>P: {((thesis.probability_best || 0) * 100).toFixed(0)}%</span>
                  <span>Assumptions: {(thesis.key_assumptions || []).length}</span>
                  <span>Updated: {new Date(thesis.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
