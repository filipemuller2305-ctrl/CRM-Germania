import { getUsers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getUsers();
  return Response.json(rows);
}
