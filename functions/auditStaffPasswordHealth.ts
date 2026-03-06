import bcrypt from 'npm:bcryptjs@2.4.3';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Admin audit: scans all StaffAccount records and identifies
 * corrupt/invalid/legacy password_hash values.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const allStaff = await base44.asServiceRole.entities.StaffAccount.list('', 10000);

    const results = {
      total: allStaff.length,
      ok_bcrypt: [],
      no_password: [],
      legacy_fake_bcrypt: [],
      corrupt_hash: [],
      unknown_format: [],
    };

    for (const s of allStaff) {
      const info = { id: s.id, username: s.username, name: s.name, is_active: s.is_active };

      if (!s.password_hash) {
        results.no_password.push(info);
        continue;
      }

      const isBcryptPrefix = s.password_hash.startsWith('$2a$') || s.password_hash.startsWith('$2b$') || s.password_hash.startsWith('$2y$');

      if (!isBcryptPrefix) {
        results.unknown_format.push({ ...info, hash_prefix: s.password_hash.substring(0, 10) });
        continue;
      }

      // Looks like bcrypt — validate it's structurally valid by probing with bcrypt
      try {
        await bcrypt.compare('__probe__', s.password_hash);
        // If we get here, hash is valid bcrypt format
        results.ok_bcrypt.push(info);
      } catch (err) {
        // bcrypt threw — hash is malformed (fake/corrupt)
        const isLegacyFake = s.password_hash.startsWith('$2b$10$') && s.password_hash.length < 60;
        if (isLegacyFake) {
          results.legacy_fake_bcrypt.push({ ...info, hash_length: s.password_hash.length });
        } else {
          results.corrupt_hash.push({ ...info, hash_length: s.password_hash.length, error: err.message });
        }
      }
    }

    const summary = {
      total: results.total,
      ok_bcrypt: results.ok_bcrypt.length,
      no_password: results.no_password.length,
      legacy_fake_bcrypt: results.legacy_fake_bcrypt.length,
      corrupt_hash: results.corrupt_hash.length,
      unknown_format: results.unknown_format.length,
      action_required: results.no_password.length + results.legacy_fake_bcrypt.length + results.corrupt_hash.length + results.unknown_format.length,
    };

    console.log('[auditStaffPasswordHealth] Summary:', JSON.stringify(summary));

    return Response.json({
      summary,
      details: {
        ok_bcrypt: results.ok_bcrypt,
        no_password: results.no_password,
        legacy_fake_bcrypt: results.legacy_fake_bcrypt,
        corrupt_hash: results.corrupt_hash,
        unknown_format: results.unknown_format,
      },
      timestamp: new Date().toISOString(),
      note: 'Accounts in no_password, legacy_fake_bcrypt, corrupt_hash, or unknown_format need admin password reset.',
    });
  } catch (error) {
    console.error('[auditStaffPasswordHealth] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});