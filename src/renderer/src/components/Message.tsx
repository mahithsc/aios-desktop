import type { JSX } from 'react'
import type {
  AssistantMessage as AssistantChatMessage,
  ChatMessage,
  TokenEvent,
  UserMessage
} from 'src/shared/chat'

interface MessagesProps {
  messages: ChatMessage[]
}

const getAssistantText = (message: AssistantChatMessage): string => {
  return message.events
    .filter((event): event is TokenEvent => event.type === 'token')
    .map((event) => event.value)
    .join('')
}

const Messages = ({ messages }: MessagesProps): JSX.Element => {
  return (
    <div className="space-y-2">
      {messages.map((message) => (
        <div key={message.id}>
          {message.role === 'assistant' ? (
            <AssistantMessageView message={message} />
          ) : (
            <UserMessageView message={message} />
          )}
        </div>
      ))}
    </div>
  )
}

interface AssistantMessageViewProps {
  message: AssistantChatMessage
}

const AssistantMessageView = ({ message }: AssistantMessageViewProps): JSX.Element => {
  return <div>{getAssistantText(message)}</div>
}

interface UserMessageViewProps {
  message: UserMessage
}

const UserMessageView = ({ message }: UserMessageViewProps): JSX.Element => {
  return <div>{message.content}</div>
}

export default Messages
