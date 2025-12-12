// app/api/inbound-email/mailgun/inbound/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.formData();

    const from = body.get("from")?.toString() || "";
    const to = body.get("recipient")?.toString() || "";
    const subject = body.get("subject")?.toString() || "";
    const bodyPlain = body.get("body-plain")?.toString() || "";
    const bodyHtml = body.get("body-html")?.toString() || "";
    const timestamp = body.get("timestamp")?.toString() || "";

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("inbox_emails")
      .insert({
        from_address: from,
        to_address: to,
        subject,
        body_text: bodyPlain,
        body_html: bodyHtml,
        received_at: new Date(Number(timestamp) * 1000).toISOString(),
      })
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ ok: false, error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ ok: false, err }, { status: 500 });
  }
}

// ❗ 중요: 절대로 GET/HANDLER 같은 export 하지 말 것
// Next.js는 GET이 있으면 GET 우선해서 POST를 받지 못함
