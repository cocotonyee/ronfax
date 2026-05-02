import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { getStripe } from "@/lib/stripe";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function ReplySuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;

  if (!session_id) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <p className="text-zinc-600">Missing payment reference.</p>
        <Link href="/" className="mt-4 font-medium text-primary underline">
          Home
        </Link>
      </div>
    );
  }

  let downloadToken: string | null = null;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (
      session.payment_status === "paid" &&
      session.metadata?.purpose === "reply_download"
    ) {
      downloadToken = session.metadata?.downloadToken?.trim() ?? null;
    }
  } catch {
    downloadToken = null;
  }

  if (!downloadToken) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <p className="text-zinc-600">
          Could not confirm payment for this session.
        </p>
        <Link href="/" className="mt-4 font-medium text-primary underline">
          Home
        </Link>
      </div>
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const downloadUrl = appUrl
    ? `${appUrl}/api/reply/download?d=${encodeURIComponent(downloadToken)}`
    : `/api/reply/download?d=${encodeURIComponent(downloadToken)}`;

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-20 text-center">
      <div className="max-w-md space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-2xl text-primary">
          ✓
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Payment received
        </h1>
        <p className="text-pretty text-zinc-600">
          {"Your $0.99 unlock for this inbound fax is complete. Download your reply PDF below."}
        </p>
        <a
          href={downloadUrl}
          className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Download reply PDF
        </a>
        <p className="text-xs text-zinc-500">
          {APP_NAME} — save this file; the link uses your payment session.
        </p>
        <Link href="/" className="block text-sm font-medium text-primary underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}
