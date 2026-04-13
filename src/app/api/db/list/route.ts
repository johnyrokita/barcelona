import { listDatabases } from "@/lib/pg";

export async function GET(request: Request) {
  const databases = await listDatabases();

  return Response.json({
    ok: true,
    data: databases,
  });
}
