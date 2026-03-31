import { Conversation } from '@/types'
import { getContactDisplayPhone } from '@/lib/utils'

interface ConversationHeaderProps {
  conversation?: Conversation | null
}

export function ConversationHeader({ conversation }: ConversationHeaderProps) {
  const contact = conversation?.contacts || null
  const displayPhone = getContactDisplayPhone(contact)

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <p className="font-medium">{contact?.name || displayPhone || 'Conversation'}</p>
        <p className="font-mono text-sm text-muted-foreground">{displayPhone || 'Unknown'}</p>
      </div>
      <span className="text-sm text-muted-foreground">{conversation?.status || 'open'}</span>
    </div>
  )
}
