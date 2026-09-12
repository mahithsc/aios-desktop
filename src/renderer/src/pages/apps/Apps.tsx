import {
  Activity,
  Boxes,
  ChevronRight,
  Globe2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import type {
  AppAccessOverview,
  AppAuditEvent,
  AppInvitation,
  AppMember,
  AppRole,
  DeployedApp,
  MembershipStatus
} from '@shared/appAccess'

const displayName = (member: AppMember): string => {
  const name = [member.first_name, member.last_name].filter(Boolean).join(' ')
  return name || member.email || 'Lotus user'
}

const formatDate = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}

const roleLabel = (role: AppRole): string => `${role.charAt(0).toUpperCase()}${role.slice(1)}`

const errorText = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

const SectionHeading = ({
  description,
  title
}: {
  description: string
  title: string
}): JSX.Element => (
  <div>
    <h3 className="text-base font-medium text-foreground">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
  </div>
)

const AppRow = ({
  app,
  active,
  onSelect
}: {
  app: DeployedApp
  active: boolean
  onSelect: () => void
}): JSX.Element => {
  const accessLabel = !app.auth_enabled
    ? 'Authentication not enabled'
    : app.membership_status !== 'active'
      ? `${app.membership_status} access`
      : `${app.role} access`

  return (
    <button
      type="button"
      disabled={!app.can_manage_users}
      onClick={onSelect}
      className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
        active
          ? 'border-violet-400/40 bg-violet-400/10'
          : 'border-transparent hover:border-border hover:bg-accent/55'
      } disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-transparent disabled:hover:bg-transparent`}
      aria-label={`${app.name}, ${accessLabel}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/12 text-violet-200">
        <Boxes className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{app.name}</div>
        <div className="mt-0.5 truncate text-xs capitalize text-muted-foreground">
          {accessLabel} · {app.live ? 'Live' : 'Not live'}
        </div>
      </div>
      {app.can_manage_users ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
      ) : (
        <LockKeyhole className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  )
}

const MemberRow = ({
  appRole,
  busy,
  member,
  onRemove,
  onRoleChange,
  onStatusChange
}: {
  appRole: AppRole
  busy: boolean
  member: AppMember
  onRemove: () => void
  onRoleChange: (role: 'admin' | 'member') => void
  onStatusChange: (status: MembershipStatus) => void
}): JSX.Element => {
  const targetIsOwner = member.role === 'owner'
  const canManageTarget = appRole === 'owner' || member.role === 'member'
  const canChangeRole = appRole === 'owner' && !targetIsOwner

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-400/15 text-sm font-semibold text-violet-200">
          {displayName(member).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{displayName(member)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {member.email || member.auth_user_id}
          </div>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs capitalize text-secondary-foreground">
          {member.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Role
          <select
            aria-label={`Role for ${displayName(member)}`}
            value={member.role}
            disabled={!canChangeRole || busy}
            onChange={(event) => onRoleChange(event.target.value as 'admin' | 'member')}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-65"
          >
            {targetIsOwner ? <option value="owner">Owner</option> : null}
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
        </label>

        {canManageTarget && !targetIsOwner ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatusChange(member.status === 'active' ? 'suspended' : 'active')}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {member.status === 'active' ? 'Suspend' : 'Reactivate'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

const InvitationRow = ({
  busy,
  invitation,
  onCancel
}: {
  busy: boolean
  invitation: AppInvitation
  onCancel: () => void
}): JSX.Element => (
  <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
    <UserPlus className="h-4 w-4 shrink-0 text-violet-200" />
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm text-foreground">{invitation.email}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {roleLabel(invitation.role)} · expires {formatDate(invitation.expires_at)}
      </div>
    </div>
    <button
      type="button"
      disabled={busy}
      onClick={onCancel}
      className="rounded-lg px-2.5 py-1.5 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
    >
      Cancel
    </button>
  </div>
)

const AuditRow = ({ event }: { event: AppAuditEvent }): JSX.Element => (
  <div className="flex items-center gap-3 border-b border-border/70 py-3 last:border-b-0">
    <div className="h-2 w-2 shrink-0 rounded-full bg-violet-300" />
    <div className="min-w-0 flex-1 text-sm capitalize text-foreground">
      {event.action.replaceAll('.', ' ')}
    </div>
    <time className="shrink-0 text-xs text-muted-foreground">{formatDate(event.created_at)}</time>
  </div>
)

const AccessPanel = ({ app }: { app: DeployedApp }): JSX.Element => {
  const [overview, setOverview] = useState<AppAccessOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')

  const loadOverview = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setOverview(await window.api.appAccess.getOverview(app.id))
    } catch (nextError) {
      setError(errorText(nextError, 'Could not load app access.'))
    } finally {
      setLoading(false)
    }
  }, [app.id])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const runMutation = useCallback(
    async (key: string, mutation: () => Promise<unknown>): Promise<void> => {
      setBusyKey(key)
      setError(null)
      setNotice(null)
      try {
        await mutation()
        setOverview(await window.api.appAccess.getOverview(app.id))
      } catch (nextError) {
        setError(errorText(nextError, 'The access change failed.'))
      } finally {
        setBusyKey(null)
      }
    },
    [app.id]
  )

  const createInvitation = (): void => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Enter an email address.')
      return
    }
    void runMutation('invite', async () => {
      await window.api.appAccess.createInvitation(app.id, normalizedEmail, inviteRole)
      setEmail('')
      setNotice('Invitation created. Automatic invitation email delivery is not connected yet.')
    })
  }

  const removeMember = (member: AppMember): void => {
    if (!window.confirm(`Remove ${displayName(member)} from ${app.name}?`)) return
    void runMutation(`member:${member.app_user_id}`, () =>
      window.api.appAccess.removeMember(app.id, member.app_user_id)
    )
  }

  if (loading && !overview) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        Loading app access…
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <LockKeyhole className="h-8 w-8 text-red-300" />
        <p className="max-w-sm text-sm text-red-200">{error || 'Access data is unavailable.'}</p>
        <button
          type="button"
          onClick={() => void loadOverview()}
          className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 px-6 pb-10 pt-1">
        <section className="rounded-3xl border border-violet-400/25 bg-violet-400/[0.07] p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-200">
              <Users className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-medium text-foreground">{app.name}</h2>
                <span className="rounded-full bg-violet-400/15 px-2.5 py-1 text-xs text-violet-100">
                  {roleLabel(app.role)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {overview.members.length} {overview.members.length === 1 ? 'user' : 'users'} ·{' '}
                {app.live ? 'Live deployment' : 'Not live'}
              </p>
              {app.canonical_url ? (
                <a
                  href={app.canonical_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-violet-200 hover:text-violet-100"
                >
                  <Globe2 className="h-3.5 w-3.5" />
                  {app.canonical_url}
                </a>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void loadOverview()}
              aria-label="Refresh app access"
              className="rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </div>
        ) : null}
        {notice ? (
          <div
            role="status"
            className="rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
          >
            {notice}
          </div>
        ) : null}

        <section className="space-y-3">
          <SectionHeading title="Invite user" description="Add a Lotus user to this app." />
          <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-3">
            <input
              aria-label="Invitation email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') createInvitation()
              }}
              placeholder="name@example.com"
              className="min-w-56 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-violet-300/50"
            />
            {app.role === 'owner' ? (
              <select
                aria-label="Invitation role"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as 'admin' | 'member')}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            ) : null}
            <button
              type="button"
              disabled={busyKey === 'invite'}
              onClick={createInvitation}
              className="flex items-center gap-2 rounded-xl bg-violet-200 px-4 py-2 text-sm font-medium text-violet-950 transition hover:bg-violet-100 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              Create invitation
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading
            title="Users"
            description="Manage app-specific roles and account status."
          />
          <div className="space-y-2">
            {overview.members.map((member) => (
              <MemberRow
                key={member.app_user_id}
                appRole={app.role}
                member={member}
                busy={busyKey === `member:${member.app_user_id}`}
                onRoleChange={(role) =>
                  void runMutation(`member:${member.app_user_id}`, () =>
                    window.api.appAccess.updateMember(app.id, member.app_user_id, { role })
                  )
                }
                onStatusChange={(status) =>
                  void runMutation(`member:${member.app_user_id}`, () =>
                    window.api.appAccess.updateMember(app.id, member.app_user_id, { status })
                  )
                }
                onRemove={() => removeMember(member)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading
            title="Pending invitations"
            description="Invitations that have not been accepted."
          />
          <div className="space-y-2">
            {overview.invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                invitation={invitation}
                busy={busyKey === `invitation:${invitation.id}`}
                onCancel={() =>
                  void runMutation(`invitation:${invitation.id}`, () =>
                    window.api.appAccess.cancelInvitation(app.id, invitation.id)
                  )
                }
              />
            ))}
            {overview.invitations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                No pending invitations.
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading title="Activity" description="Recent access and invitation changes." />
          <div className="rounded-2xl border border-border bg-card px-4">
            {overview.events.map((event) => (
              <AuditRow key={event.id} event={event} />
            ))}
            {overview.events.length === 0 ? (
              <div className="py-5 text-center text-sm text-muted-foreground">
                No access changes yet.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}

const Apps = (): JSX.Element => {
  const [apps, setApps] = useState<DeployedApp[]>([])
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadApps = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const nextApps = await window.api.appAccess.listApps()
      setApps(nextApps)
      setSelectedAppId((current) => {
        if (current && nextApps.some((app) => app.id === current && app.can_manage_users)) {
          return current
        }
        return nextApps.find((app) => app.can_manage_users)?.id ?? null
      })
    } catch (nextError) {
      setError(errorText(nextError, 'Could not load deployed apps.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadApps()
  }, [loadApps])

  const selectedApp = useMemo(
    () => apps.find((app) => app.id === selectedAppId) ?? null,
    [apps, selectedAppId]
  )

  return (
    <div className="flex h-full min-h-0 w-full px-4 pb-6 sm:px-6 sm:pb-8">
      <div className="mx-auto grid h-full min-h-0 w-full max-w-6xl grid-cols-[minmax(250px,320px)_minmax(0,1fr)] overflow-hidden rounded-3xl border border-border bg-background shadow-sm">
        <aside className="flex min-h-0 flex-col border-r border-border bg-card/45">
          <div className="flex items-center justify-between border-b border-border px-4 py-4">
            <div>
              <h1 className="text-base font-medium text-foreground">Deployed apps</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">Users and permissions</p>
            </div>
            <button
              type="button"
              onClick={() => void loadApps()}
              aria-label="Refresh deployed apps"
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {apps.map((app) => (
              <AppRow
                key={app.id}
                app={app}
                active={app.id === selectedAppId}
                onSelect={() => setSelectedAppId(app.id)}
              />
            ))}
            {!loading && apps.length === 0 && !error ? (
              <div className="flex flex-col items-center px-5 py-12 text-center">
                <Boxes className="h-8 w-8 text-muted-foreground" />
                <div className="mt-3 text-sm text-foreground">No deployed apps yet</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Apps deployed with Lotus will appear here.
                </p>
              </div>
            ) : null}
            {error ? (
              <div
                role="alert"
                className="m-2 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-xs leading-5 text-red-200"
              >
                {error}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-violet-200" />
              Lotus app-specific access
            </div>
          </div>
        </aside>

        <section className="min-h-0 min-w-0">
          {selectedApp ? (
            <AccessPanel key={selectedApp.id} app={selectedApp} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              {loading ? (
                <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                <Activity className="h-8 w-8 text-muted-foreground" />
              )}
              <h2 className="mt-4 text-base font-medium text-foreground">
                {loading ? 'Loading deployed apps…' : 'No manageable app selected'}
              </h2>
              {!loading ? (
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Only active owners and admins can change an app&apos;s users and permissions.
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default Apps
