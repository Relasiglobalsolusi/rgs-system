import { redirect } from "next/navigation";

type SearchParams = Promise<{
  year?: string;
  month?: string;
  view?: string;
}>;

/**
 * Standalone VAT module removed — VAT Output/Input/Net now lives inside
 * Tax Invoice. Redirect to the combined page, preserving any query params.
 */
export default async function VatRedirectPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.year) query.set("year", params.year);
  if (params.month) query.set("month", params.month);
  if (params.view) query.set("view", params.view);
  const qs = query.toString();
  redirect(`/billing/tax-invoices${qs ? `?${qs}` : ""}`);
}
