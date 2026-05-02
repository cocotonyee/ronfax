import { unstable_cache } from "next/cache";
import type { ClinicRecord } from "@/lib/clinic-types";
import localClinics from "@/data/clinics.json";

async function loadClinicsRows(): Promise<ClinicRecord[]> {
  const remote = process.env.CLINICS_JSON_URL;
  if (remote) {
    const res = await fetch(remote, { next: { revalidate: 3600 } });
    if (!res.ok) {
      throw new Error(`CLINICS_JSON_URL fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data as ClinicRecord[];
  }

  const rows = localClinics as unknown as ClinicRecord[];
  return Array.isArray(rows) ? rows : [];
}

/** Only JSON-serializable payloads can live in unstable_cache output; Maps break after rehydrate. */
const loadClinicsCached = unstable_cache(
  async (): Promise<ClinicRecord[]> => {
    return loadClinicsRows();
  },
  ["ronfax-clinics-list", process.env.CLINICS_JSON_URL ?? "src/data/clinics.json"],
  { revalidate: 3600 },
);

function slugMapFrom(list: ClinicRecord[]): Map<string, ClinicRecord> {
  const bySlug = new Map<string, ClinicRecord>();
  for (const row of list) {
    if (row?.slug) bySlug.set(row.slug, row);
  }
  return bySlug;
}

export async function getClinicsIndex(): Promise<{
  list: ClinicRecord[];
  bySlug: Map<string, ClinicRecord>;
}> {
  const list = await loadClinicsCached();
  return { list, bySlug: slugMapFrom(list) };
}

export async function getClinicBySlug(
  slug: string,
): Promise<ClinicRecord | undefined> {
  const { bySlug } = await getClinicsIndex();
  return bySlug.get(slug);
}
