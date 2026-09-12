export type AppRole = 'owner' | 'admin' | 'member'
export type MembershipStatus = 'active' | 'suspended' | 'deactivated'

export interface DeployedApp {
  id: string
  name: string
  public_slug: string | null
  status: 'active' | 'deleting' | 'deleted'
  created_at: string
  role: AppRole
  membership_status: MembershipStatus
  canonical_url: string | null
  live: boolean
  auth_enabled: boolean
  can_manage_users: boolean
}

export interface AppMember {
  app_id: string
  app_user_id: string
  auth_user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: AppRole
  status: MembershipStatus
  created_at: string
  updated_at: string
  last_login_at: string | null
}

export interface AppInvitation {
  id: string
  app_id: string
  email: string
  role: Exclude<AppRole, 'owner'>
  status: 'pending' | 'accepted' | 'cancelled' | 'expired'
  invited_by_auth_user_id: string
  expires_at: string
  created_at: string
  updated_at: string
}

export interface AppAuditEvent {
  id: string
  app_id: string
  actor_auth_user_id: string | null
  action: string
  target_auth_user_id: string | null
  target_invitation_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AppAccessOverview {
  members: AppMember[]
  invitations: AppInvitation[]
  events: AppAuditEvent[]
}

export interface AppMemberUpdate {
  role?: AppRole
  status?: MembershipStatus
}
