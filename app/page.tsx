import { redirect } from "next/navigation";

// Until auth (M5), the dashboard is the entry point.
export default function Home() {
  redirect("/dashboard");
}
