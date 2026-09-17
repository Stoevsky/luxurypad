"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

type SearchResult = {
  kind: "market" | "launch" | "theme";
  title: string;
  subtitle: string;
  href: string;
};

export function SearchTrigger() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex h-10 items-center gap-2 border border-line bg-card px-3 text-[13px] text-muted transition-colors duration-200 hover:border-gold"
      >
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden border border-line px-1 text-[10px] sm:inline">⌘K</kbd>
        <span className="sm:hidden">⌕</span>
      </button>
      {open ? <SearchDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const { data, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: async (): Promise<SearchResult[]> => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return [];
      return (await res.json()).results as SearchResult[];
    },
    staleTime: 30_000,
  });

  const results = useMemo(() => data ?? [], [data]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/25 p-4 pt-[12vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg border border-line bg-card shadow-[0_30px_70px_-40px_rgb(17,16,15,0.6)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search LuxuryPad"
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search launches, tickers, companies, themes"
          className="w-full border-b border-line bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-muted"
        />
        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted">
              {isFetching ? "Searching…" : q ? "No matches." : "Type to search."}
            </p>
          ) : (
            results.map((r) => (
              <button
                key={r.href}
                onClick={() => {
                  router.push(r.href);
                  onClose();
                }}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-ground"
              >
                <span className="text-[14px]">{r.title}</span>
                <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-muted">
                  {r.subtitle}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
