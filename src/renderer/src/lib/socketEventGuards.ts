import type { Chat, ChatMetadata, LLMEvent } from 'src/shared/chat'
import type { Notification, NotificationListResponse } from 'src/shared/notification'
import type { Run, RunEvent } from 'src/shared/run'

export const isLLMEvent = (value: unknown): value is LLMEvent =>
  typeof value === 'object' && value !== null && 'type' in value && 'createdAt' in value

export const isChat = (value: unknown): value is Chat =>
  typeof value === 'object' && value !== null && 'id' in value && 'messages' in value

export const isChatHistory = (value: unknown): value is ChatMetadata[] => Array.isArray(value)

export const isRunEvent = (value: unknown): value is RunEvent =>
  typeof value === 'object' && value !== null && 'runId' in value && 'event' in value

export const isRun = (value: unknown): value is Run =>
  typeof value === 'object' && value !== null && 'id' in value && 'kind' in value

export const isNotification = (value: unknown): value is Notification =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  'title' in value &&
  'body' in value &&
  'createdAt' in value

export const isNotificationListResponse = (value: unknown): value is NotificationListResponse =>
  typeof value === 'object' && value !== null && 'notifications' in value
