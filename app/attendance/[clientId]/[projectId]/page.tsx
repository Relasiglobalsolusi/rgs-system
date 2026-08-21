import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function AttendanceProjectRedirectPage({ params }: Props) {
  const { projectId } = await params;
  redirect(`/progress?projectId=${encodeURIComponent(projectId)}`);
}
