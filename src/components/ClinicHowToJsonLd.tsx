import type { ClinicRecord } from "@/lib/clinic-types";
import { formatUsPhone } from "@/lib/phone";
import { getSiteUrl } from "@/lib/site-url";

type Props = {
  entry: ClinicRecord;
};

export function ClinicHowToJsonLd({ entry }: Props) {
  const site = getSiteUrl();
  const faxDisplay = entry.faxDisplay ?? formatUsPhone(entry.faxDigits);
  const sendUrl = `${site}/?fax=${entry.faxDigits}`;

  const json = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to send a fax to ${entry.name}`,
    description: `Send a fax to ${entry.name} in ${entry.city}, ${entry.state} using RonFax—upload a PDF or image, pay from $1.99 (up to 3 pages), and track delivery.`,
    totalTime: "PT10M",
    tool: {
      "@type": "HowToTool",
      name: "RonFax web app",
    },
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Open the send form with this fax number",
        text: `Go to RonFax and confirm the recipient line shows ${faxDisplay} (country code +1).`,
        url: sendUrl,
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Upload your document",
        text: "Attach a PDF or image (JPG/PNG), up to 8 MB. Export Word files to PDF first.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Pay and send",
        text: "Enter your name and email for confirmation, pay the shown total ($1.99 for up to 3 pages; $0.50 per extra page), then submit. Follow the status page for delivery.",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
