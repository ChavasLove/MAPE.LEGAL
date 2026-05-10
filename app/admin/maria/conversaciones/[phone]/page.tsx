import ConversationThread from './ConversationThread';

export const dynamic = 'force-dynamic';

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone } = await params;
  return <ConversationThread phone={phone} />;
}
