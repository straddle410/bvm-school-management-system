import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'principal'].includes(user.role)) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { backupId } = await req.json();
    if (!backupId) return Response.json({ error: 'backupId required' }, { status: 400 });

    const sdk = base44.asServiceRole;
    const backups = await sdk.entities.FeesBackup.filter({ id: backupId });
    const backup = backups[0];
    if (!backup) return Response.json({ error: 'Backup not found' }, { status: 404 });
    if (backup.status !== 'COMPLETED') return Response.json({ error: 'Backup is not completed' }, { status: 400 });

    // Get Google Drive access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    // Build file name
    const meta = backup.file_json?.meta || {};
    const dateStr = new Date(backup.created_date).toISOString().replace('T', '_').slice(0, 16).replace(':', '-');
    const fileName = `FeesBackup_${(meta.schoolName || 'School').replace(/\s+/g, '_')}_${meta.academicYear || 'ALL'}_${dateStr}_${backup.backup_type}.json`;

    const jsonContent = JSON.stringify(backup.file_json, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });

    // Upload to Google Drive using multipart
    const boundary = 'boundary_fees_backup_' + Date.now();
    const metadata = JSON.stringify({ name: fileName, mimeType: 'application/json' });
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      jsonContent,
      `--${boundary}--`
    ].join('\r\n');

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      await sdk.entities.FeesBackup.update(backup.id, {
        drive_export_status: 'FAILED',
        drive_error: errText.slice(0, 500)
      });
      return Response.json({ error: `Drive upload failed: ${errText}` }, { status: 500 });
    }

    const driveFile = await uploadRes.json();

    await sdk.entities.FeesBackup.update(backup.id, {
      drive_export_status: 'EXPORTED',
      drive_file_id: driveFile.id,
      drive_file_name: fileName,
      drive_exported_at: new Date().toISOString(),
      drive_error: null
    });

    return Response.json({ success: true, driveFileId: driveFile.id, fileName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});