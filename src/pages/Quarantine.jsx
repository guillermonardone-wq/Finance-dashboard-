import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useThesisStore } from '../store/useThesisStore';
import { ClassificationBadge } from '../components/common/ScoreDisplay';

export default function Quarantine() {
  const { theses, fetchTheses } = useThesisStore();

  useEffect(() => {
    fetchTheses({ status: 'quarantined' });
  }, [fetchTheses]);

  const quarantined = theses.filter(t => t.status === 'quarantined' || t.classification === 'QUARANTINED');

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Quarantine</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ideas held here are compelling but under-validated. They stay here until evidence catches up.
        </p>
      </div>

      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mb-6">
        <p className="text-sm text-red-300">
          <span className="font-bold">QUARANTINE RULES:</span> Theses land here because of emotional state compromise,
          insufficient evidence, excessive assumptions, or stale supporting data. No action is permitted on quarantined items.
          Review them after cooling off. Upgrade only when evidence improves.
        </p>
      </div>

      {quarantined.length === 0 ? (
        <p className="text-sm text-slate-600 text-center py-12">Nothing quarantined. Good discipline.</p>
      ) : (
        <div className="space-y-3">
          {quarantined.map(t => (
            <Link key={t.id} to={`/thesis/${t.id}`} className="block">
              <div className="bg-slate-900 rounded-lg border border-red-900/30 p-4 hover:border-red-800/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-medium text-slate-200">{t.title}</h3>
                  <ClassificationBadge classification="QUARANTINED" />
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{t.thesis_statement}</p>
                {t.quarantine_reason && (
                  <p className="text-xs text-red-400 mt-2">Reason: {t.quarantine_reason}</p>
                )}
                {t.quarantine_until && (
                  <p className="text-xs text-amber-400 mt-1">
                    Review after: {new Date(t.quarantine_until).toLocaleString()}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
