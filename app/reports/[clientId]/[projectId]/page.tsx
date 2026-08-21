import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function ReportsProjectRedirectPage({ params }: Props) {
  const { projectId } = await params;
  redirect(`/progress?projectId=${encodeURIComponent(projectId)}`);
}
