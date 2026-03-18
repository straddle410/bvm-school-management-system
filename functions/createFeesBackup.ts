import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const FEE_ENTITIES = [
  'FeeHead', 'FeePlan', 'FeeReceiptConfig',
  'FeeInvoice', 'FeePayment', 'StudentFeeDiscount',
  'FeeFamily', 'AdditionalCharge'
];

async function hashPayload(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const allowedRoles = ['admin', 'principal', 'accountant'];
    if (!user || !allowedRoles.includes(user.role)) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { academicYear, backupType = 'MANUAL' } = body;
    const sdk = base44.asServiceRole;

    // Create backup record (status: CREATED)
    const backupRecord = await sdk.entities.FeesBackup.create({
      created_by_user_id: user?.email || null,
      backup_type: backupType,
      academic_year: academicYear || '',
      status: 'CREATED'
    });

    // Fetch all fee entities
    const entities = {};
    const countsSummary = {};
    for (const entityName of FEE_ENTITIES) {
      try {
        let records;
        if (academicYear && ['FeeInvoice', 'FeePayment', 'StudentFeeDiscount', 'AdditionalCharge', 'FeePlan'].includes(entityName)) {
          records = await sdk.entities[entityName].filter({ academic_year: academicYear });
        } else {
          records = await sdk.entities[entityName].list();
        }
        entities[entityName] = records || [];
        countsSummary[entityName] = (records || []).length;
      } catch {
        entities[entityName] = [];
        countsSummary[entityName] = 0;
      }
    }

    // Fetch school profile for meta
    const profiles = await sdk.entities.SchoolProfile.list();
    const schoolName = profiles[0]?.school_name || 'Unknown School';

    const payload = {
      meta: {
        schoolName,
        createdAt: new Date().toISOString(),
        academicYear: academicYear || 'ALL',
        backupType,
        checksumVersion: '1',
        totalRecords: Object.values(countsSummary).reduce((a, b) => a + b, 0)
      },
      entities
    };

    const payloadStr = JSON.stringify(payload);
    const checksum = await hashPayload(payloadStr);

    // Update backup record with COMPLETED status
    await sdk.entities.FeesBackup.update(backupRecord.id, {
      status: 'COMPLETED',
      file_json: payload,
      counts_summary: countsSummary,
      checksum
    });

    // Retention: keep only last 30 DAILY_AUTO backups
    if (backupType === 'DAILY_AUTO') {
      const allAuto = await sdk.entities.FeesBackup.filter({ backup_type: 'DAILY_AUTO' });
      const sorted = allAuto.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      const toDelete = sorted.slice(30);
      for (const old of toDelete) {
        await sdk.entities.FeesBackup.delete(old.id).catch(() => {});
      }
    }

    return Response.json({
      success: true,
      backupId: backupRecord.id,
      countsSummary,
      checksum,
      totalRecords: payload.meta.totalRecords
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});