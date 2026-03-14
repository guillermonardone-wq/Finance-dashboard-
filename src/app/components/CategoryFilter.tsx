// Horizontal pill filter for market categories
"use client";

const CATEGORIES = [
  "all",
  "politics",
  "economics",
  "crypto",
  "technology",
  "science",
  "sports",
  "finance",
];

interface Props {
  active: string;
  onChange: (cat: string) => void;
}

export default function CategoryFilter({ active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition ${
            active === cat
              ? "bg-indigo-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
