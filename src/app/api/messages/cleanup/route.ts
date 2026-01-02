import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const now = new Date().toISOString();

    // 1. Delete all viewed messages that are NOT saved
    const { data: viewedMessages, error: viewedError } = await supabaseAdmin
      .from("messages")
      .select("id")
      .eq("is_viewed", true)
      .or("is_saved.is.null,is_saved.eq.false");

    if (viewedError) {
      return NextResponse.json({ error: viewedError.message }, { status: 500 });
    }

    // 2. Delete all expired messages (3h limit) that are NOT saved
    const { data: expiredMessages, error: expiredError } = await supabaseAdmin
      .from("messages")
      .select("id")
      .lt("expires_at", now)
      .or("is_saved.is.null,is_saved.eq.false");

    if (expiredError) {
      return NextResponse.json({ error: expiredError.message }, { status: 500 });
    }

    const idsToDelete = [
      ...(viewedMessages?.map(m => m.id) || []),
      ...(expiredMessages?.map(m => m.id) || [])
    ];

    const uniqueIds = [...new Set(idsToDelete)];

    if (uniqueIds.length === 0) {
      return NextResponse.json({ message: "No messages to delete", deleted: 0 });
    }

    const { error: deleteError, count } = await supabaseAdmin
      .from("messages")
      .delete()
      .in("id", uniqueIds);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: "Messages cleaned up", 
      deleted: count || uniqueIds.length 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
