import type {
  AppAccessOverview,
  AppAuditEvent,
  AppInvitation,
  AppMember,
  AppMemberUpdate,
  AppRole,
  DeployedApp
} from '../../shared/appAccess'
import type { AuthService } from './AuthService'

const CLOUD_URL = (process.env.AIOS_CLOUD_URL ?? 'https://computer.trywink.io').replace(/\/$/, '')

const responseError = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as {
      detail?: string | { message?: string }
    }
    if (typeof body.detail === 'string' && body.detail.trim()) return body.detail
    if (body.detail && typeof body.detail === 'object' && typeof body.detail.message === 'string') {
      return body.detail.message
    }
  } catch {
    // Fall through to a stable status-based message for non-JSON failures.
  }
  return `Lotus Cloud request failed (${response.status})`
}

const appPath = (appId: string): string => `/v1/apps/${encodeURIComponent(appId)}`

/**
 * Makes authenticated Lotus Cloud calls without exposing the Supabase session
 * to the renderer process.
 */
export class AppAccessService {
  constructor(private readonly authService: AuthService) {}

  async listApps(): Promise<DeployedApp[]> {
    return this.request('/v1/me/apps')
  }

  async getOverview(appId: string): Promise<AppAccessOverview> {
    const prefix = appPath(appId)
    const [members, invitations, audit] = await Promise.all([
      this.request<{ members: AppMember[] }>(`${prefix}/members`),
      this.request<{ invitations: AppInvitation[] }>(`${prefix}/invitations`),
      this.request<{ events: AppAuditEvent[] }>(`${prefix}/auth-audit-events?limit=25`)
    ])
    return {
      members: members.members,
      invitations: invitations.invitations,
      events: audit.events
    }
  }

  async createInvitation(
    appId: string,
    email: string,
    role: Exclude<AppRole, 'owner'>
  ): Promise<AppInvitation> {
    return this.request(`${appPath(appId)}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email, role })
    })
  }

  async cancelInvitation(appId: string, invitationId: string): Promise<AppInvitation> {
    return this.request(`${appPath(appId)}/invitations/${encodeURIComponent(invitationId)}`, {
      method: 'DELETE'
    })
  }

  async updateMember(
    appId: string,
    appUserId: string,
    update: AppMemberUpdate
  ): Promise<AppMember> {
    return this.request(`${appPath(appId)}/members/${encodeURIComponent(appUserId)}`, {
      method: 'PATCH',
      body: JSON.stringify(update)
    })
  }

  async removeMember(appId: string, appUserId: string): Promise<void> {
    return this.request(`${appPath(appId)}/members/${encodeURIComponent(appUserId)}`, {
      method: 'DELETE'
    })
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    await this.authService.ensureFreshToken()
    const accessToken = this.authService.getAccessToken()
    if (!accessToken) throw new Error('Sign in to manage deployed apps.')

    const response = await fetch(`${CLOUD_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {})
      }
    })
    if (!response.ok) throw new Error(await responseError(response))
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }
}
