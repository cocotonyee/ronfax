import { APP_NAME } from "@/lib/constants";
import { getSiteUrl } from "@/lib/site-url";

export function JsonLd() {
  const url = getSiteUrl();

  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: APP_NAME,
    operatingSystem: "Web, iOS Safari",
    applicationCategory: "BusinessApplication",
    description:
      "Online fax service — send fax from computer or phone without a printer or visiting Staples/FedEx. US fax numbers, pay as you go, Cocofax/FaxZero-style simplicity.",
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
    name: "How to send a fax from printer",
    description:
      "No printer or phone line required — upload a PDF, enter the fax destination, pay securely, and RonFax transmits your document.",
    totalTime: "PT5M",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Upload PDF",
        text: "Upload your PDF (or image) on ronfax.com — no fax machine or printer hardware needed.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Enter fax number",
        text: "Enter the 10-digit US fax number; we format it for transmission.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Pay and send",
        text: "Complete secure Stripe checkout; we send your fax to the carrier network and you get a tracking link.",
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
