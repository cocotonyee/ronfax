import type { Metadata } from "next";
import { TemplatesSearch } from "@/components/TemplatesSearch";
import { getClinicsIndex } from "@/lib/clinics";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Templates & directory",
  description: `Search institutions and send a fax with ${APP_NAME}.`,
};

export default async function TemplatesPage() {
  const { list } = await getClinicsIndex();

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
      <h1 className="text-center text-3xl font-bold tracking-tight text-zinc-950">
        Institution directory
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed text-zinc-600">
        Search verified fax destinations. Open a page to auto-fill the fax
        number on the send form.
      </p>
      <div className="mt-14 sm:mt-16">
        <TemplatesSearch clinics={list} />
      </div>
    </div>
  );
}
