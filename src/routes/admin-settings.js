import { getDb } from '../db/client.js';
import { hasSecretEncryptionKey, encryptTenantSecret } from '../lib/secret-crypto.js';
import { writeAuditLog } from '../lib/audit.js';
import { requireTenantStaffWithPermissions, hasPermission } from '../lib/guards.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

async function requireTenantAdmin(request, env) {
  return requireTenantStaffWithPermissions(request, env, 'tenant_admin', 'manager', 'officer');
}

async function getSettings(request, env) {
  const session = await requireTenantAdmin(request, env);
  if (!session) return error('Not authorised', 403);
  if (!hasPermission(session, 'settings.view')) return error('Not authorised', 403);

  const sql = getDb(env);
  const rows = await sql`
    SELECT
      t.id,
      t.name,
      t.slug,
      t.subdomain,
      t.status,
      t.contact_name,
      t.contact_email,
      tl.max_staff_users,
      tl.max_applications,
      ts.bootstrap_admin_user_id,
      ts.council_display_name,
      ts.support_email,
      ts.support_phone,
      ts.support_contact_name,
      ts.internal_admin_name,
      ts.internal_admin_email,
      ts.logo_url,
      ts.welcome_text,
      ts.public_homepage_text,
      ts.contact_us_text,
      sso.saml_enabled,
      sso.saml_metadata_xml,
      sso.saml_entity_id,
      sso.saml_login_url,
      sso.saml_certificate,
      sso.oidc_enabled,
      sso.oidc_client_id,
      sso.oidc_client_secret_hint,
      sso.oidc_client_secret_scheme,
      sso.oidc_client_secret_updated_at,
      sso.oidc_client_secret_id,
      sso.oidc_directory_id,
      sso.oidc_issuer,
      sso.oidc_authorization_endpoint,
      sso.oidc_token_endpoint,
      sso.oidc_userinfo_endpoint,
      sso.oidc_scopes,
      sso.auth_runtime_status,
      bu.email AS bootstrap_admin_email,
      bu.full_name AS bootstrap_admin_name
    FROM tenants t
    LEFT JOIN tenant_limits tl ON tl.tenant_id = t.id
    LEFT JOIN tenant_settings ts ON ts.tenant_id = t.id
    LEFT JOIN tenant_sso_configs sso ON sso.tenant_id = t.id
    LEFT JOIN users bu ON bu.id = ts.bootstrap_admin_user_id
    WHERE t.id = ${session.tenant_id}
    LIMIT 1
  `;

  if (rows.length === 0) return error('Tenant not found', 404);
  const row = rows[0];

  return json({
    settings: {
      tenant: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        subdomain: row.subdomain,
        status: row.status,
        max_staff_users: row.max_staff_users,
        max_applications: row.max_applications,
      },
      organisation: {
        council_name: row.name,
        council_display_name: row.council_display_name || row.name,
        support_contact_name: row.support_contact_name || row.contact_name || '',
        support_email: row.support_email || row.contact_email || '',
        support_phone: row.support_phone || '',
        internal_admin_name: row.internal_admin_name || '',
        internal_admin_email: row.internal_admin_email || '',
      },
      branding: {
        logo_url: row.logo_url || '',
        welcome_text: row.welcome_text || '',
        public_homepage_text: row.public_homepage_text || '',
        contact_us_text: row.contact_us_text || '',
      },
      sso: {
        saml_enabled: row.saml_enabled,
        saml_metadata_xml: row.saml_metadata_xml || '',
        saml_entity_id: row.saml_entity_id || '',
        saml_login_url: row.saml_login_url || '',
        saml_certificate: row.saml_certificate || '',
        oidc_enabled: row.oidc_enabled,
        oidc_client_id: row.oidc_client_id || '',
        oidc_client_secret_hint: row.oidc_client_secret_hint || '',
        has_oidc_client_secret: Boolean(row.oidc_client_secret_scheme),
        oidc_client_secret_updated_at: row.oidc_client_secret_updated_at,
        oidc_client_secret_id: row.oidc_client_secret_id || '',
        oidc_directory_id: row.oidc_directory_id || '',
        oidc_issuer: row.oidc_issuer || '',
        oidc_authorization_endpoint: row.oidc_authorization_endpoint || '',
        oidc_token_endpoint: row.oidc_token_endpoint || '',
        oidc_userinfo_endpoint: row.oidc_userinfo_endpoint || '',
        oidc_scopes: row.oidc_scopes || 'openid profile email',
        auth_runtime_status: row.auth_runtime_status,
      },
      bootstrap: {
        admin_name: row.bootstrap_admin_name || '',
        admin_email: row.bootstrap_admin_email || '',
        uses_local_break_glass_account: true,
        live_sso_supported: false,
      },
      capabilities: {
        can_store_encrypted_client_secret: hasSecretEncryptionKey(env),
      },
    },
  });
}

async function updateSettings(request, env) {
  const session = await requireTenantAdmin(request, env);
  if (!session) return error('Not authorised', 403);
  if (!hasPermission(session, 'settings.edit')) return error('Not authorised', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const tenantName = body.organisation?.council_name?.trim() || null;
  const displayName = body.organisation?.council_display_name?.trim() || null;
  const supportContactName = body.organisation?.support_contact_name?.trim() || null;
  const supportEmail = body.organisation?.support_email?.trim().toLowerCase() || null;
  const supportPhone = body.organisation?.support_phone?.trim() || null;
  const internalAdminName = body.organisation?.internal_admin_name?.trim() || null;
  const internalAdminEmail = body.organisation?.internal_admin_email?.trim().toLowerCase() || null;
  const logoUrl = body.branding?.logo_url?.trim() || null;
  const welcomeText = body.branding?.welcome_text?.trim() || null;
  const publicHomepageText = body.branding?.public_homepage_text?.trim() || null;
  const contactUsText = body.branding?.contact_us_text?.trim() || null;
  const samlEnabled = body.sso?.saml_enabled === true;
  const samlMetadataXml = body.sso?.saml_metadata_xml?.trim() || null;
  const samlEntityId = body.sso?.saml_entity_id?.trim() || null;
  const samlLoginUrl = body.sso?.saml_login_url?.trim() || null;
  const samlCertificate = body.sso?.saml_certificate?.trim() || null;
  const oidcEnabled = body.sso?.oidc_enabled === true;
  const oidcClientId = body.sso?.oidc_client_id?.trim() || null;
  const oidcClientSecret = body.sso?.oidc_client_secret?.trim() || '';
  const clearOidcClientSecret = body.sso?.clear_oidc_client_secret === true;
  const oidcClientSecretId = body.sso?.oidc_client_secret_id?.trim() || null;
  const oidcDirectoryId = body.sso?.oidc_directory_id?.trim() || null;
  const oidcIssuer = body.sso?.oidc_issuer?.trim() || null;
  const oidcAuthorizationEndpoint = body.sso?.oidc_authorization_endpoint?.trim() || null;
  const oidcTokenEndpoint = body.sso?.oidc_token_endpoint?.trim() || null;
  const oidcUserinfoEndpoint = body.sso?.oidc_userinfo_endpoint?.trim() || null;
  const oidcScopes = body.sso?.oidc_scopes?.trim() || 'openid profile email';

  if (supportEmail && !supportEmail.includes('@')) return error('Support email must be a valid email address.');
  if (internalAdminEmail && !internalAdminEmail.includes('@')) return error('Internal admin email must be a valid email address.');
  if (logoUrl && !/^https?:\/\//i.test(logoUrl)) return error('Logo URL must start with http:// or https://');
  if (oidcEnabled && !oidcClientId) return error('OIDC client ID is required when OIDC is enabled.');
  if (oidcClientSecret && !hasSecretEncryptionKey(env)) {
    return error('SECRET_ENCRYPTION_KEY is required before you can save an OIDC client secret.');
  }

  let encryptedSecret = null;
  let clientSecretHint = null;
  if (oidcClientSecret) {
    encryptedSecret = await encryptTenantSecret(env, oidcClientSecret, {
      scope: 'tenant_sso.oidc_client_secret',
      tenant_id: session.tenant_id,
    });
    clientSecretHint = `${oidcClientSecret.slice(0, 2)}...${oidcClientSecret.slice(-2)}`;
  }

  const sql = getDb(env);
  const tenantRows = await sql`
    UPDATE tenants
    SET
      name = COALESCE(${tenantName}, name),
      contact_name = ${supportContactName},
      contact_email = ${supportEmail}
    WHERE id = ${session.tenant_id}
    RETURNING id, name, slug, subdomain, status, contact_name, contact_email
  `;

  await sql`
    INSERT INTO tenant_settings (
      tenant_id,
      council_display_name,
      support_email,
      support_phone,
      support_contact_name,
      internal_admin_name,
      internal_admin_email,
      logo_url,
      welcome_text,
      public_homepage_text,
      contact_us_text
    )
    VALUES (
      ${session.tenant_id},
      ${displayName},
      ${supportEmail},
      ${supportPhone},
      ${supportContactName},
      ${internalAdminName},
      ${internalAdminEmail},
      ${logoUrl},
      ${welcomeText},
      ${publicHomepageText},
      ${contactUsText}
    )
    ON CONFLICT (tenant_id) DO UPDATE
    SET
      council_display_name = EXCLUDED.council_display_name,
      support_email = EXCLUDED.support_email,
      support_phone = EXCLUDED.support_phone,
      support_contact_name = EXCLUDED.support_contact_name,
      internal_admin_name = EXCLUDED.internal_admin_name,
      internal_admin_email = EXCLUDED.internal_admin_email,
      logo_url = EXCLUDED.logo_url,
      welcome_text = EXCLUDED.welcome_text,
      public_homepage_text = EXCLUDED.public_homepage_text,
      contact_us_text = EXCLUDED.contact_us_text,
      updated_at = NOW()
  `;

  await sql`
    INSERT INTO tenant_sso_configs (
      tenant_id,
      saml_enabled,
      saml_metadata_xml,
      saml_entity_id,
      saml_login_url,
      saml_certificate,
      oidc_enabled,
      oidc_client_id,
      oidc_client_secret_ciphertext,
      oidc_client_secret_iv,
      oidc_client_secret_hint,
      oidc_client_secret_scheme,
      oidc_client_secret_updated_at,
      oidc_client_secret_id,
      oidc_directory_id,
      oidc_issuer,
      oidc_authorization_endpoint,
      oidc_token_endpoint,
      oidc_userinfo_endpoint,
      oidc_scopes
    )
    VALUES (
      ${session.tenant_id},
      ${samlEnabled},
      ${samlMetadataXml},
      ${samlEntityId},
      ${samlLoginUrl},
      ${samlCertificate},
      ${oidcEnabled},
      ${oidcClientId},
      ${encryptedSecret?.ciphertext ?? null},
      ${encryptedSecret?.iv ?? null},
      ${clientSecretHint},
      ${encryptedSecret?.scheme ?? null},
      ${encryptedSecret ? new Date().toISOString() : null},
      ${oidcClientSecretId},
      ${oidcDirectoryId},
      ${oidcIssuer},
      ${oidcAuthorizationEndpoint},
      ${oidcTokenEndpoint},
      ${oidcUserinfoEndpoint},
      ${oidcScopes}
    )
    ON CONFLICT (tenant_id) DO UPDATE
    SET
      saml_enabled = EXCLUDED.saml_enabled,
      saml_metadata_xml = EXCLUDED.saml_metadata_xml,
      saml_entity_id = EXCLUDED.saml_entity_id,
      saml_login_url = EXCLUDED.saml_login_url,
      saml_certificate = EXCLUDED.saml_certificate,
      oidc_enabled = EXCLUDED.oidc_enabled,
      oidc_client_id = EXCLUDED.oidc_client_id,
      oidc_client_secret_ciphertext = CASE
        WHEN ${clearOidcClientSecret} THEN NULL
        WHEN ${Boolean(encryptedSecret)} THEN EXCLUDED.oidc_client_secret_ciphertext
        ELSE tenant_sso_configs.oidc_client_secret_ciphertext
      END,
      oidc_client_secret_iv = CASE
        WHEN ${clearOidcClientSecret} THEN NULL
        WHEN ${Boolean(encryptedSecret)} THEN EXCLUDED.oidc_client_secret_iv
        ELSE tenant_sso_configs.oidc_client_secret_iv
      END,
      oidc_client_secret_hint = CASE
        WHEN ${clearOidcClientSecret} THEN NULL
        WHEN ${Boolean(encryptedSecret)} THEN EXCLUDED.oidc_client_secret_hint
        ELSE tenant_sso_configs.oidc_client_secret_hint
      END,
      oidc_client_secret_scheme = CASE
        WHEN ${clearOidcClientSecret} THEN NULL
        WHEN ${Boolean(encryptedSecret)} THEN EXCLUDED.oidc_client_secret_scheme
        ELSE tenant_sso_configs.oidc_client_secret_scheme
      END,
      oidc_client_secret_updated_at = CASE
        WHEN ${clearOidcClientSecret} THEN NULL
        WHEN ${Boolean(encryptedSecret)} THEN EXCLUDED.oidc_client_secret_updated_at
        ELSE tenant_sso_configs.oidc_client_secret_updated_at
      END,
      oidc_client_secret_id = EXCLUDED.oidc_client_secret_id,
      oidc_directory_id = EXCLUDED.oidc_directory_id,
      oidc_issuer = EXCLUDED.oidc_issuer,
      oidc_authorization_endpoint = EXCLUDED.oidc_authorization_endpoint,
      oidc_token_endpoint = EXCLUDED.oidc_token_endpoint,
      oidc_userinfo_endpoint = EXCLUDED.oidc_userinfo_endpoint,
      oidc_scopes = EXCLUDED.oidc_scopes,
      updated_at = NOW()
  `;

  await writeAuditLog(sql, {
    tenantId: session.tenant_id,
    actorType: 'tenant_admin',
    actorId: session.user_id,
    action: 'tenant.settings.updated',
    recordType: 'tenant',
    recordId: session.tenant_id,
    meta: {
      name: tenantRows[0].name,
      contact_name: tenantRows[0].contact_name,
      contact_email: tenantRows[0].contact_email,
      saml_enabled: samlEnabled,
      oidc_enabled: oidcEnabled,
      has_oidc_client_secret: clearOidcClientSecret ? false : Boolean(oidcClientSecret),
    },
  });

  return getSettings(request, env);
}

export async function handleAdminSettingsRoutes(request, env) {
  const url = new URL(request.url);
  const { method } = request;

  if (method === 'GET' && url.pathname === '/api/admin/settings') {
    return getSettings(request, env);
  }

  if (method === 'PUT' && url.pathname === '/api/admin/settings') {
    return updateSettings(request, env);
  }

  return null;
}
