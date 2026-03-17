/**
 * ThesisAuditTab — Creation/update metadata and classification history.
 */
export default function ThesisAuditTab({ thesis }) {
  const prevClassifications = Array.isArray(thesis.previous_classifications)
    ? thesis.previous_classifications
    : [];

  return (
    <div className="space-y-4">
      {/* Metadata */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 space-y-1">
        <AuditRow label="Created" value={thesis.created_at} />
        <AuditRow label="Updated" value={thesis.updated_at} />
        <AuditRow label="Status" value={thesis.status} />
        <AuditRow label="Classification" value={thesis.classification} />
        {thesis.composite_score != null && (
          <AuditRow
            label="Last Composite Score"
            value={`${thesis.composite_score}/100`}
          />
        )}
        {thesis.score_at_creation != null && (
          <AuditRow
            label="Score at Creation"
            value={`${thesis.score_at_creation}/100`}
          />
        )}
        {thesis.classification_at_creation && (
          <AuditRow
            label="Classification at Creation"
            value={thesis.classification_at_creation}
          />
        )}
        {thesis.quarantine_reason && (
          <AuditRow
            label="Quarantine Reason"
            value={thesis.quarantine_reason}
            warn
          />
        )}
      </div>

      {/* Classification history */}
      {prevClassifications.length > 0 && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-300 mb-3">
            Classification History
          </h3>
          <div className="space-y-1">
            {prevClassifications.map((c, i) => (
              <div
                key={i}
                className="text-xs text-slate-400 py-1.5 border-b border-slate-800/30 flex gap-3"
              >
                <span className="text-slate-600 w-36 flex-shrink-0">
                  {c.date}
                </span>
                <span>
                  {c.from} <span className="text-slate-600 mx-1">&rarr;</span>{" "}
                  {c.to}
                </span>
                <span className="text-slate-600 ml-auto">{c.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditRow({ label, value, warn }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-slate-500 w-40 flex-shrink-0">{label}:</span>
      <span className={warn ? "text-red-400" : "text-slate-300"}>
        {value || "—"}
      </span>
    </div>
  );
}
