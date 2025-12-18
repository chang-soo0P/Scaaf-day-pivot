import EmailDetailClient from "./email-detail-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { id: string } | Promise<{ id: string }>

export default async function Page({ params }: { params: Params }) {
  const { id } = await Promise.resolve(params) // ✅ Next 16 대응
  return <EmailDetailClient emailId={id} />
}
