import { redirect } from "next/navigation";

/** Website CMS retired from ERP — direct callers to /dashboard. */
export default function WebsitePage() {
  redirect("/dashboard");
}
