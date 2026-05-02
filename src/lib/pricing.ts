/** First tier: up to this many pages included in the base price. */
export const INCLUDED_PAGES = 3;

/** Base price in USD cents for pages 1–3 (inclusive). */
export const BASE_PRICE_CENTS = 199;

/** Each page beyond {@link INCLUDED_PAGES}, in USD cents (half dollar). */
export const EXTRA_PAGE_CENTS = 50;

export function priceCentsForPages(pageCount: number): number {
  if (!Number.isFinite(pageCount) || pageCount < 1) {
    throw new Error("Invalid page count");
  }
  const n = Math.floor(pageCount);
  if (n <= INCLUDED_PAGES) return BASE_PRICE_CENTS;
  return BASE_PRICE_CENTS + (n - INCLUDED_PAGES) * EXTRA_PAGE_CENTS;
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export type PriceBreakdownLine = {
  label: string;
  amountCents: number;
};

export type PriceBreakdown = {
  pageCount: number;
  lines: PriceBreakdownLine[];
  totalCents: number;
};

/** $1.99 for first 3 pages + $0.50 per additional page — itemized for checkout UI. */
export function getPriceBreakdown(pageCount: number): PriceBreakdown {
  const n = Math.floor(pageCount);
  if (n < 1) throw new Error("Invalid page count");

  const totalCents = priceCentsForPages(n);
  const lines: PriceBreakdownLine[] = [];

  if (n <= INCLUDED_PAGES) {
    lines.push({
      label: `First ${INCLUDED_PAGES} pages (bundle, covers ${n} page${n === 1 ? "" : "s"})`,
      amountCents: BASE_PRICE_CENTS,
    });
  } else {
    const extra = n - INCLUDED_PAGES;
    lines.push({
      label: `First ${INCLUDED_PAGES} pages (bundle)`,
      amountCents: BASE_PRICE_CENTS,
    });
    lines.push({
      label: `${extra} extra page${extra === 1 ? "" : "s"} (${formatUsdFromCents(EXTRA_PAGE_CENTS)} each)`,
      amountCents: extra * EXTRA_PAGE_CENTS,
    });
  }

  return { pageCount: n, lines, totalCents };
}
