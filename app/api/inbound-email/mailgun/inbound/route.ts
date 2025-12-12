import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 중요! 서비스 키 필요
);

export async function POST(req: NextRequest) {
  const payload = await req.formData();

  const signature = payload.get("signature") as any;
  const timestamp = signature.timestamp;
  const token = signature.token;
  const sig = signature.signature;

  const apiKey = process.env.MAILGUN_PRIVATE_API_KEY!;

  // Verify signature
  const expectedSig = crypto
    .createHmac("sha256", apiKey)
    .update(timestamp + token)
    .digest("hex");

  if (expectedSig !== sig) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const from = payload.get("from");
  const subject = payload.get("subject");
  const body = payload.get("body-plain");

  // Save into Supabase
  const { error } = await supabase.from("emails").insert({
    from_address: from,
    subject,
    body_text: body,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
