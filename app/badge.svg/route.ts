import { permanentRedirect } from "next/navigation";

export const runtime = "nodejs";

export function GET() {
  permanentRedirect("/badge/sfrangulov");
}
