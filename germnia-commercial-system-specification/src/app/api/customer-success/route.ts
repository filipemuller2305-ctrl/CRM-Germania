import { getCustomerSuccessList } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getCustomerSuccessList();
  return Response.json(rows);
}
