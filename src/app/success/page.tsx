import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/constants";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function SuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;

  if (session_id) {
    redirect(`/status/${session_id}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-16 text-center">
      <div className="max-w-md space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Thanks for using {APP_NAME}
        </h1>
        <p className="text-pretty text-zinc-600">
          If you completed a payment, open the link from your confirmation email
          or return to the home page to send another fax.
        </p>
        <Link
          href="/#send"
          className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          Send a fax
        </Link>
      </div>
    </div>
  );
}
