"use client";

import { m } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

export function HeroHeadline() {
  return (
    <div>
      <m.h1
        className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-zinc-950 sm:text-5xl lg:text-[3.15rem]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease, delay: 0.05 }}
      >
        The easiest way to send a fax.
      </m.h1>
      <m.p
        className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-zinc-700 sm:mt-8 sm:text-xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease, delay: 0.16 }}
      >
        Upload a document, pay once, and we transmit securely — built for
        teams that need proof of delivery without hardware.
      </m.p>
    </div>
  );
}
