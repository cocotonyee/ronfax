"use client";

import { useEffect, useState } from "react";
import { RECENT_DESTINATION_SAMPLES } from "@/lib/recent-destinations";

function pickThree() {
  const shuffled = [...RECENT_DESTINATION_SAMPLES].sort(
    () => Math.random() - 0.5,
  );
  return shuffled.slice(0, 3);
}

export function RecentTransmissionsTicker() {
  const [items, setItems] = useState(pickThree);

  useEffect(() => {
    const id = setInterval(() => {
      setItems(pickThree());
    }, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/60 py-3 shadow-sm"
      aria-label="Example destinations"
    >
      <p className="px-4 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
        Recently transmitted to
      </p>
      <ul className="mt-2 space-y-1.5 px-4 text-center text-sm text-zinc-600">
        {items.map((d) => (
          <li
            key={`${d.name}-${d.city}-${d.state}`}
            className="transition-opacity duration-500"
          >
            <span className="text-zinc-500">→</span>{" "}
            <span className="font-medium text-zinc-800">{d.name}</span>
            <span className="text-zinc-500">
              , {d.city}, {d.state}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
