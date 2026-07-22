import { getProductTypes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getProductTypes();
  return Response.json(rows);
}
