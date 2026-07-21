import { redirect } from "next/navigation";

/** Legacy /invoicing → /billing */
export default function InvoicingRedirectPage() {
  redirect("/billing");
}
