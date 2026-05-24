import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";

export default async function DashboardRedirect() {
  const viewer = await getViewer();
  if (!viewer.login) redirect("/login");
  redirect(`/u/${viewer.login}`);
}
