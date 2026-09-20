import { useEffect, useRef, useState } from "react";

interface Doctor {
  id: string;
  name: string;
}

interface Props {
  doctors: Doctor[];
  selected: Doctor | null;
  onSelect: (doctor: Doctor) => void;
}

export default function DoctorSearchDropdown({ doctors, selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered =
    query.trim() === ""
      ? doctors
      : doctors.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={selected ? selected.name : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (selected) onSelect(null as unknown as Doctor);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Type your name..."
        autoComplete="off"
        className="w-full rounded-lg border border-slate-300 px-4 py-4 text-lg"
      />
      {open && (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {filtered.length === 0 && <li className="px-4 py-3 text-slate-400">No matching doctor</li>}
          {filtered.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(d);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-lg hover:bg-slate-50"
              >
                {d.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
