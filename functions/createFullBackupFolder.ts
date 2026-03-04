import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Google Drive access token via connector
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    if (!accessToken) {
      return Response.json({ error: 'Google Drive not authorized' }, { status: 403 });
    }

    // Create parent folder: "School ERP Backups"
    const parentFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'School ERP Backups',
        mimeType: 'application/vnd.google-apps.folder',
        properties: {
          schoolErpBackupRoot: 'true',
        },
      }),
    });

    if (!parentFolderRes.ok) {
      const err = await parentFolderRes.json();
      console.error('Failed to create parent folder:', err);
      return Response.json({ error: 'Failed to create backup folder structure' }, { status: 400 });
    }

    const parentFolder = await parentFolderRes.json();
    const parentFolderId = parentFolder.id;

    // Create child folder: "Full Weekly Backups"
    const childFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Full Weekly Backups',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      }),
    });

    if (!childFolderRes.ok) {
      const err = await childFolderRes.json();
      console.error('Failed to create child folder:', err);
      return Response.json({ error: 'Failed to create backup subfolder' }, { status: 400 });
    }

    const childFolder = await childFolderRes.json();
    const childFolderId = childFolder.id;

    // Save to SchoolProfile
    const profiles = await base44.entities.SchoolProfile.list();
    if (profiles.length > 0) {
      await base44.entities.SchoolProfile.update(profiles[0].id, {
        full_backup_drive_folder_id: childFolderId,
        full_backup_drive_folder_name: 'Full Weekly Backups',
      });
    }

    return Response.json({
      success: true,
      folderId: childFolderId,
      folderName: 'Full Weekly Backups',
      parentFolderId: parentFolderId,
    });
  } catch (error) {
    console.error('Error creating backup folder:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});