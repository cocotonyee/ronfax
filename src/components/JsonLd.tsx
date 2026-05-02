import { APP_NAME } from "@/lib/constants";
import { getSiteUrl } from "@/lib/site-url";

export function JsonLd() {
  const url = getSiteUrl();

  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: APP_NAME,
    operatingSystem: "Web",
    applicationCategory: "BusinessApplication",
    description:
      "Securely send faxes to US and Canada fax numbers. Pay as you go, no subscription.",
    url,
    offers: {
      "@type": "Offer",
      price: "1.99",
      priceCurrency: "USD",
      description: "Send fax up to 3 pages (USD); additional pages billed per page.",
      availability: "https://schema.org/InStock",
    },
  };

  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to send a fax with ${APP_NAME}`,
    description:
      "Enter the recipient fax number, upload a PDF or image, then complete checkout.",
    totalTime: "PT5M",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Enter fax number",
        text: "Type or paste a valid 10-digit US or Canada fax number (country code +1 is fixed).",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Upload document",
        text: "Attach a PDF or image (JPG/PNG), up to 8 MB.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Pay and send",
        text: "Enter your name and email for confirmation, pay the quoted price (from $1.99 for up to 3 pages), and submit. Track delivery on the status page.",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplication),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo) }}
      />
    </>
  );
}
