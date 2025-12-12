import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    // Mailgun sends POST body as form-data
    const body = await req.formData();

    const from = body.get("from")?.toString() || "";
    const to = body.get("recipient")?.toString() || "";
    const subject = body.get("subject")?.toString() || "";
    const bodyPlain = body.get("body-plain")?.toString() || "";
    const bodyHtml = body.get("body-html")?.toString() || "";
    const timestamp = body.get("timestamp")?.toString() || "";

    // 🔐 Supabase service client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string // Service role is required for inserts from server
    );

    // 📨 Save inbound email into DB
    const { data, error } = await supabase
      .from("inbox_emails")
      .insert({
        from_address: from,
        to_address: to,
        subject: subject,
        body_text: bodyPlain,
        body_html: bodyHtml,
        received_at: timestamp
          ? new Date(Number(timestamp) * 1000).toISOString()
          : new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error("[Supabase Insert Error]", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    console.log("📩 New inbound email saved:", data);

    return NextResponse.json(
      { ok: true, received: true, email: data },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[Webhook Runtime Error]", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
