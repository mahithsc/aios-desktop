import type { Chat } from "./chat"

export type WSEnvelopeTypes = 'chat'


export interface WSEnvelope {
    type: WSEnvelopeTypes
    data: any
}