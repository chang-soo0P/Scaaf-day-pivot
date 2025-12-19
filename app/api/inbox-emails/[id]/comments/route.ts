import { NextResponse } from "next/server"

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: emailId } = await params
    // ... 이하 동일
    return NextResponse.json({ ok: true, comments: [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: emailId } = await ctx.params  // ✅ 중요
    const body = await req.json()
    // ... 이하 동일
    return NextResponse.json({ ok: true, comment: {} })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
  }
}
