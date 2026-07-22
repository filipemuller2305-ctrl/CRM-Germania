import { getCrossSellList } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getCrossSellList();
  return Response.json(rows);
}
