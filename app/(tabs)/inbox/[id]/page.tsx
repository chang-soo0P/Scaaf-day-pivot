import EmailDetailClient from "./email-detail-client"

export default function Page({ params }: { params: { id: string } }) {
  return <EmailDetailClient emailId={params.id} />
}
