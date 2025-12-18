import EmailDetailClient from "./email-detail-client"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EmailDetailClient emailId={id} />
}