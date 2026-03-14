// Dropdown to select sort order
"use client";

const OPTIONS = [
  { value: "dislocation", label: "Dislocation Score" },
  { value: "volume", label: "Volume (24h)" },
  { value: "spread", label: "Spread" },
  { value: "liquidity", label: "Liquidity (low first)" },
];

interface Props {
  value: string;
  onChange: (sort: string) => void;
}

export default function SortSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
