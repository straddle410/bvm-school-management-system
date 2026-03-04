import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const RESTORE_ORDER = [
  'FeeHead', 'FeePlan', 'FeeReceiptConfig',
  'FeeFamily', 'FeeInvoice',
  'FeePayment', 'StudentFeeDiscount', 'AdditionalCharge'
];

// Safe delete order (dependencies first)
const DELETE_ORDER = [
  'FeePayment', 'StudentFeeDiscount', 'AdditionalCharge',
  'FeeFamily', 'FeeInvoice', 'FeePlan', 'FeeHead', 'FeeReceiptConfig'
];

async function deleteAll(sdk, entityName) {
  let deleted = 0;
  try {
    const records = await sdk.entities[entityName].list();
    for (const r of (records || [])) {
      try { await sdk.entities[entityName].delete(r.id); deleted++; } catch {}
    }
  } catch {}
  return deleted;
}

async function upsertRecords(sdk, entityName, records) {
  let inserted = 0;
  for (const record of (records || [])) {
    try {
      // Try update first (MERGE: by id), then create
      const { id, created_date, updated_date, ...data } = record;
      if (id) {
        try {
          await sdk.entities[entityName].update(id, data);
          inserted++;
          continue;
        } catch {}
      }
      await sdk.entities[entityName].create(data);
      inserted++;
    } catch {}
  }
  return inserted;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'principal'].includes(user.role)) {
      return Response.json({ error: 'Admin only: restore access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { backupId, restoreMode, confirmation_phrase, confirmation_school_name, confirmation_date } = body;

    if (!backupId || !restoreMode) return Response.json({ error: 'backupId and restoreMode required' }, { status: 400 });
    if (!['MERGE', 'REPLACE'].includes(restoreMode)) return Response.json({ error: 'Invalid restoreMode' }, { status: 400 });

    // Validate confirmations
    const today = new Date().toISOString().split('T')[0];
    if (confirmation_phrase !== 'RESTORE FEES BACKUP') {
      return Response.json({ error: 'Confirmation phrase incorrect' }, { status: 400 });
    }

    const sdk = base44.asServiceRole;
    const profiles = await sdk.entities.SchoolProfile.list();
    const schoolName = profiles[0]?.school_name || '';
    if (confirmation_school_name !== schoolName) {
      return Response.json({ error: 'School name confirmation incorrect' }, { status: 400 });
    }
    if (confirmation_date !== today) {
      return Response.json({ error: 'Date confirmation incorrect' }, { status: 400 });
    }

    // Fetch backup
    const backups = await sdk.entities.FeesBackup.filter({ id: backupId });
    const backup = backups[0];
    if (!backup || backup.status !== 'COMPLETED') {
      return Response.json({ error: 'Backup not found or incomplete' }, { status: 404 });
    }

    const entities = backup.file_json?.entities || {};
    const deletedCounts = {};
    const insertedCounts = {};

    // REPLACE: wipe current fees data first
    if (restoreMode === 'REPLACE') {
      for (const entityName of DELETE_ORDER) {
        deletedCounts[entityName] = await deleteAll(sdk, entityName);
      }
    }

    // Restore in dependency order
    for (const entityName of RESTORE_ORDER) {
      const records = entities[entityName] || [];
      if (restoreMode === 'REPLACE') {
        // Re-create all
        let created = 0;
        for (const record of records) {
          try {
            const { id, created_date, updated_date, ...data } = record;
            await sdk.entities[entityName].create(data);
            created++;
          } catch {}
        }
        insertedCounts[entityName] = created;
      } else {
        // MERGE: upsert by id
        insertedCounts[entityName] = await upsertRecords(sdk, entityName, records);
      }
    }

    // Write restore log
    await sdk.entities.FeesRestoreLog.create({
      restored_at: new Date().toISOString(),
      restored_by_user_id: user.email,
      backup_id: backupId,
      restore_mode: restoreMode,
      status: 'COMPLETED',
      deleted_counts: restoreMode === 'REPLACE' ? deletedCounts : {},
      inserted_counts: insertedCounts
    });

    return Response.json({
      success: true,
      restoreMode,
      deletedCounts: restoreMode === 'REPLACE' ? deletedCounts : {},
      insertedCounts,
      totalRestored: Object.values(insertedCounts).reduce((a, b) => a + b, 0)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});