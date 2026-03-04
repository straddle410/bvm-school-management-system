import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  let backupId = null;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role || '').toLowerCase() !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const bodyPayload = await req.json();
    const { backupId: bid, folderId } = bodyPayload;
    backupId = bid;

    if (!backupId || !folderId) {
      return Response.json({ error: 'backupId and folderId required' }, { status: 400 });
    }

    console.log(`[Export] Starting export for backup ${backupId} to folder ${folderId}`);

    // Get backup record
    const backups = await base44.asServiceRole.entities.FullSchoolBackup.filter({ id: backupId });
    if (!backups || backups.length === 0) {
      throw new Error('Backup not found');
    }
    const backup = backups[0];
    console.log(`[Export] Found backup: ${backup.id}, type=${backup.backup_type}, status=${backup.status}`);

    // Get school profile for name
    const profile = (await base44.asServiceRole.entities.SchoolProfile.list())[0];
    
    // Build filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('Z')[0];
    const year = backup.academic_year || 'ALL';
    const filename = `FullBackup_${profile?.school_name || 'School'}_${year}_${timestamp}_${backup.backup_type}.json`;
    console.log(`[Export] Filename: ${filename}`);

    // Get Google Drive access token
    console.log('[Export] Getting Google Drive access token...');
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    console.log(`[Export] Got access token, length=${accessToken?.length || 0}`);

    // Upload to Google Drive
    const fileContent = JSON.stringify(backup.file_json, null, 2);
    console.log(`[Export] File content size: ${fileContent.length} bytes`);
    
    const boundary = '===============7330845974216740156==';
    const bodyParts = [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({
        name: filename,
        parents: [folderId],
        mimeType: 'application/json'
      })}\r\n`,
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${fileContent}\r\n`,
      `--${boundary}--`
    ];
    const body = bodyParts.join('');
    console.log(`[Export] Multipart body size: ${body.length} bytes`);

    console.log(`[Export] Uploading to Drive API...`);
    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`
      },
      body: body
    });

    console.log(`[Export] Drive API response: status=${uploadRes.status}`);
    
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.log(`[Export] Drive API error: ${errText}`);
      let errMsg = 'Drive upload failed';
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errText;
      } catch {}
      throw new Error(`[Drive ${uploadRes.status}] ${errMsg}`);
    }

    const driveFile = await uploadRes.json();
    console.log(`[Export] Upload successful! File ID: ${driveFile.id}`);

    // Update backup record - MARK AS EXPORTED
    console.log(`[Export] Updating backup record to EXPORTED...`);
    await base44.asServiceRole.entities.FullSchoolBackup.update(backupId, {
      drive_file_id: driveFile.id,
      drive_file_name: filename,
      drive_export_status: 'EXPORTED',
      drive_exported_at: new Date().toISOString(),
      drive_error: null
    });
    console.log(`[Export] Backup ${backupId} marked as EXPORTED`);

    return Response.json({ 
      success: true,
      file_id: driveFile.id,
      file_name: filename
    });
  } catch (error) {
    const errorMsg = error.message || 'Unknown error';
    console.error(`[Export] Error: ${errorMsg}`);
    
    // Mark export as FAILED if we have backupId
    if (backupId) {
      try {
        const base44 = createClientFromRequest(req);
        console.log(`[Export] Marking backup ${backupId} as FAILED with error: ${errorMsg}`);
        await base44.asServiceRole.entities.FullSchoolBackup.update(backupId, {
          drive_export_status: 'FAILED',
          drive_error: errorMsg
        });
        console.log(`[Export] Backup ${backupId} marked as FAILED`);
      } catch (updateErr) {
        console.error(`[Export] Failed to update backup status: ${updateErr.message}`);
      }
    }
    return Response.json({ error: errorMsg }, { status: 500 });
  }
});