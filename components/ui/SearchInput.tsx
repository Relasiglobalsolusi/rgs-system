"use client";

import { Search } from "lucide-react";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: SearchInputProps) {
  return (
    <div className="relative w-full max-w-md">
      <Search
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
      />

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          h-12
          w-full
          rounded-2xl
          border
          border-white/5
          bg-[#151b22]
          pl-11
          pr-4
          text-sm
          text-white
          outline-none
          transition
          placeholder:text-slate-500
          focus:border-[#54bfb4]/40
          focus:ring-2
          focus:ring-[#54bfb4]/20
        "
      />
    </div>
  );
}