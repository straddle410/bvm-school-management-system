import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role || '').toLowerCase() !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { backupId, folderId } = body;

    if (!backupId || !folderId) {
      return Response.json({ error: 'backupId and folderId required' }, { status: 400 });
    }

    // Get backup record
    const backups = await base44.asServiceRole.entities.FullSchoolBackup.filter({ id: backupId });
    if (!backups || backups.length === 0) {
      return Response.json({ error: 'Backup not found' }, { status: 404 });
    }
    const backup = backups[0];

    // Get school profile for name
    const profile = (await base44.asServiceRole.entities.SchoolProfile.list())[0];
    
    // Build filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('Z')[0];
    const year = backup.academic_year || 'ALL';
    const filename = `FullBackup_${profile?.school_name || 'School'}_${year}_${timestamp}_${backup.backup_type}.json`;

    // Get Google Drive access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    // Upload to Google Drive
    const fileContent = JSON.stringify(backup.file_json, null, 2);
    const blob = new Blob([fileContent], { type: 'application/json' });
    const formData = new FormData();
    formData.append('metadata', JSON.stringify({
      name: filename,
      parents: [folderId],
      mimeType: 'application/json'
    }));
    formData.append('file', blob, filename);

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: formData
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      throw new Error(err.error?.message || 'Drive upload failed');
    }

    const driveFile = await uploadRes.json();

    // Update backup record
    await base44.asServiceRole.entities.FullSchoolBackup.update(backupId, {
      drive_file_id: driveFile.id,
      drive_file_name: filename,
      drive_export_status: 'EXPORTED',
      drive_exported_at: new Date().toISOString(),
      drive_error: null
    });

    return Response.json({ 
      success: true,
      file_id: driveFile.id,
      file_name: filename
    });
  } catch (error) {
    // If we have a backupId from body, mark export as failed
    const body = await req.json().catch(() => ({}));
    if (body.backupId) {
      try {
        const base44 = createClientFromRequest(req);
        await base44.asServiceRole.entities.FullSchoolBackup.update(body.backupId, {
          drive_export_status: 'FAILED',
          drive_error: error.message
        });
      } catch {}
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});