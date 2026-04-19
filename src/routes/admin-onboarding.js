import { getDb } from '../db/client.js';
import { requireTenantStaff } from '../lib/guards.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

function computeScore(checks) {
  let score = 0;
  if (checks.orgDetails) score += 20;
  if (checks.branding) score += 15;
  if (checks.staffAdded) score += 20;
  if (checks.ssoConfigured) score += 30;
  if (checks.logoSet) score += 5;
  if (checks.internalAdminSet) score += 10;
  return score;
}

function scoreLevel(score) {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 40) return 'fair';
  return 'needs_attention';
}

function buildRecommendations(checks) {
  const recs = [];
  if (!checks.ssoConfigured) {
    recs.push({ id: 'sso', priority: 'high', label: 'Configure SSO to secure staff sign-in', href: '/admin/settings', points: 30 });
  }
  if (!checks.staffAdded) {
    recs.push({ id: 'staff', priority: 'high', label: 'Add your first officer or manager', href: '/admin/users', points: 20 });
  }
  if (!checks.orgDetails) {
    recs.push({ id: 'org', priority: 'medium', label: 'Complete your organisation details', href: '/admin/settings', points: 20 });
  }
  if (!checks.branding) {
    recs.push({ id: 'branding', priority: 'medium', label: 'Set your public homepage content', href: '/admin/settings', points: 15 });
  }
  if (!checks.logoSet) {
    recs.push({ id: 'logo', priority: 'low', label: 'Add your council logo', href: '/admin/settings', points: 5 });
  }
  if (!checks.internalAdminSet) {
    recs.push({ id: 'internal_admin', priority: 'low', label: 'Set an internal admin contact', href: '/admin/settings', points: 10 });
  }
  return recs;
}

async function getOnboarding(request, env) {
  const session = await requireTenantStaff(request, env, 'tenant_admin');
  if (!session) return error('Not authorised', 403);

  const sql = getDb(env);
  const [tenantRows, settingsRows, ssoRows, staffRows] = await Promise.all([
    sql`
      SELECT id, name, slug, subdomain, status, trial_ends_at, activated_at, created_at
      FROM tenants
      WHERE id = ${session.tenant_id}
      LIMIT 1
    `,
    sql`
      SELECT council_display_name, support_email, support_phone,
             internal_admin_name, internal_admin_email,
             welcome_text, public_homepage_text, logo_url
      FROM tenant_settings
      WHERE tenant_id = ${session.tenant_id}
      LIMIT 1
    `,
    sql`
      SELECT saml_enabled, oidc_enabled
      FROM tenant_sso_configs
      WHERE tenant_id = ${session.tenant_id}
      LIMIT 1
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM memberships
      WHERE tenant_id = ${session.tenant_id}
        AND role IN ('officer', 'manager')
    `,
  ]);

  if (tenantRows.length === 0) return error('Tenant not found', 404);

  const tenant = tenantRows[0];
  const settings = settingsRows[0] ?? {};
  const sso = ssoRows[0] ?? {};
  const staffCount = staffRows[0]?.count ?? 0;

  const checks = {
    orgDetails: Boolean(settings.council_display_name && settings.support_email && settings.support_phone),
    branding: Boolean(settings.welcome_text && settings.public_homepage_text),
    staffAdded: staffCount > 0,
    ssoConfigured: Boolean(sso.saml_enabled || sso.oidc_enabled),
    logoSet: Boolean(settings.logo_url),
    internalAdminSet: Boolean(settings.internal_admin_name && settings.internal_admin_email),
  };

  const score = computeScore(checks);

  // Trial info: use trial_ends_at if set, else derive from created_at + 30 days
  const trialEndsAt = tenant.trial_ends_at
    ? new Date(tenant.trial_ends_at)
    : new Date(new Date(tenant.created_at).getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24)));
  const isExpired = trialEndsAt < now;

  return json({
    checklist: {
      org_details: { complete: checks.orgDetails, label: 'Confirm your organisation details', href: '/admin/settings' },
      branding: { complete: checks.branding, label: 'Set your public homepage content', href: '/admin/settings' },
      staff_added: { complete: checks.staffAdded, label: 'Add your first officer or manager', href: '/admin/users', badge: staffCount > 0 ? `${staffCount} added` : null },
      sso_configured: { complete: checks.ssoConfigured, label: 'Configure staff authentication (SSO)', href: '/admin/settings' },
    },
    security_score: {
      score,
      level: scoreLevel(score),
      recommendations: buildRecommendations(checks),
    },
    trial: {
      trial_ends_at: trialEndsAt.toISOString(),
      days_remaining: daysRemaining,
      is_expired: isExpired,
    },
    stats: {
      staff_count: staffCount,
    },
  });
}

export async function handleAdminOnboardingRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (method === 'GET' && url.pathname === '/api/admin/onboarding') {
    return getOnboarding(request, env);
  }

  return null;
}
