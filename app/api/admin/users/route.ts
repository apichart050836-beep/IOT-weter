import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/adminAuth";

export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase is not configured on the server" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user || !isAdminEmail(userData.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [{ data: profiles, error: profilesError }, { data: devices, error: devicesError }] = await Promise.all([
    supabase.from("profiles").select("id, email, created_at").order("created_at", { ascending: false }),
    supabase.from("devices").select("id, name, location, owner_id, last_seen_at, pipe_size"),
  ]);

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });
  if (devicesError) return NextResponse.json({ error: devicesError.message }, { status: 500 });

  const users = (profiles ?? []).map((p) => ({
    id: p.id as string,
    email: p.email as string,
    createdAt: p.created_at as string,
    device: (devices ?? [])
      .filter((d) => d.owner_id === p.id)
      .map((d) => ({
        id: d.id as string,
        name: d.name as string,
        location: (d.location as string) ?? null,
        lastSeenAt: (d.last_seen_at as string) ?? null,
        pipeSize: (d.pipe_size as string) ?? '3/4"',
      }))[0] ?? null,
  }));

  return NextResponse.json({ users });
}
