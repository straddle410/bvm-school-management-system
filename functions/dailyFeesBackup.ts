import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// This function is called by the daily automation at 11:59 PM IST
// It creates a DAILY_AUTO backup and optionally exports to Drive
// Last redeployed: 2026-03-08

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Use service role for scheduled jobs
    const sdk = base44.asServiceRole;

    // Check Drive auto-export setting from SchoolProfile
    const profiles = await sdk.entities.SchoolProfile.list();
    const profile = profiles[0];
    const autoExportToDrive = !!profile?.backup_auto_drive_export;

    // Create the daily backup via internal SDK call
    const FEE_ENTITIES = [
      'FeeHead', 'FeePlan', 'FeeReceiptConfig',
      'FeeInvoice', 'FeePayment', 'StudentFeeDiscount',
      'FeeFamily', 'AdditionalCharge'
    ];

    const entities = {};
    const countsSummary = {};
    for (const entityName of FEE_ENTITIES) {
      try {
        const records = await sdk.entities[entityName].list();
        entities[entityName] = records || [];
        countsSummary[entityName] = (records || []).length;
      } catch {
        entities[entityName] = [];
        countsSummary[entityName] = 0;
      }
    }

    const payload = {
      meta: {
        schoolName: profile?.school_name || 'Unknown',
        createdAt: new Date().toISOString(),
        academicYear: 'ALL',
        backupType: 'DAILY_AUTO',
        checksumVersion: '1',
        totalRecords: Object.values(countsSummary).reduce((a, b) => a + b, 0)
      },
      entities
    };

    // Simple checksum
    const payloadStr = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const checksum = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const backupRecord = await sdk.entities.FeesBackup.create({
      created_by_user_id: null,
      backup_type: 'DAILY_AUTO',
      academic_year: '',
      status: 'COMPLETED',
      file_json: payload,
      counts_summary: countsSummary,
      checksum
    });

    // Retention: keep last 30 DAILY_AUTO
    const allAuto = await sdk.entities.FeesBackup.filter({ backup_type: 'DAILY_AUTO' });
    const sorted = allAuto.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    for (const old of sorted.slice(30)) {
      await sdk.entities.FeesBackup.delete(old.id).catch(() => {});
    }

    // Auto-export to Drive if enabled
    if (autoExportToDrive) {
      try {
        const { accessToken } = await sdk.connectors.getConnection('googledrive');
        const dateStr = new Date().toISOString().replace('T', '_').slice(0, 16).replace(':', '-');
        const fileName = `FeesBackup_${(profile?.school_name || 'School').replace(/\s+/g, '_')}_ALL_${dateStr}_DAILY_AUTO.json`;
        const jsonContent = JSON.stringify(payload, null, 2);
        const boundary = 'boundary_daily_' + Date.now();
        const metadata = JSON.stringify({ name: fileName, mimeType: 'application/json' });
        const body = [
          `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', metadata,
          `--${boundary}`, 'Content-Type: application/json', '', jsonContent,
          `--${boundary}--`
        ].join('\r\n');

        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
          body
        });

        if (uploadRes.ok) {
          const driveFile = await uploadRes.json();
          await sdk.entities.FeesBackup.update(backupRecord.id, {
            drive_export_status: 'EXPORTED',
            drive_file_id: driveFile.id,
            drive_file_name: fileName,
            drive_exported_at: new Date().toISOString()
          });
        } else {
          await sdk.entities.FeesBackup.update(backupRecord.id, { drive_export_status: 'FAILED' });
        }
      } catch (driveErr) {
        await sdk.entities.FeesBackup.update(backupRecord.id, { drive_export_status: 'FAILED', drive_error: driveErr.message });
      }
    }

    return Response.json({ success: true, backupId: backupRecord.id, countsSummary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});