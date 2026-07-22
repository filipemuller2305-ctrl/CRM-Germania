import { getPipelinesWithStages } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getPipelinesWithStages();
  return Response.json(rows);
}
