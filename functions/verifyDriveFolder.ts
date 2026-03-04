import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Extract folder ID from Google Drive URL or return as-is if already an ID
const extractFolderId = (input) => {
  if (!input) return null;
  // Handle full Drive URL: https://drive.google.com/drive/folders/FOLDER_ID
  const match = input.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  // If it looks like an ID (alphanumeric with hyphens/underscores), return as-is
  if (/^[a-zA-Z0-9-_]+$/.test(input.trim())) return input.trim();
  return null;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    let folderId = extractFolderId(body.folderId);

    if (!folderId) {
      return Response.json({ error: 'Invalid folder URL or ID. Please enter a valid Google Drive folder link or folder ID.' }, { status: 400 });
    }

    // Get Google Drive access token
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googledrive');
      accessToken = conn?.accessToken;
    } catch (e) {
      return Response.json({ error: 'Google Drive connector not authorized. Please connect your Google Drive account in settings first.' }, { status: 401 });
    }

    if (!accessToken) {
      return Response.json({ error: 'Google Drive not authorized' }, { status: 401 });
    }

    // Verify folder exists and is accessible
    const verifyResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!verifyResponse.ok) {
      if (verifyResponse.status === 404) {
        return Response.json({ error: 'Folder not found or not accessible' }, { status: 404 });
      }
      return Response.json({ error: 'Failed to verify folder' }, { status: 400 });
    }

    const folderData = await verifyResponse.json();

    // Verify it's actually a folder
    if (folderData.mimeType !== 'application/vnd.google-apps.folder') {
      return Response.json({ error: 'Selected item is not a folder' }, { status: 400 });
    }

    return Response.json({
      success: true,
      folderId: folderData.id,
      folderName: folderData.name
    });
  } catch (error) {
    console.error('Verify folder error:', error);
    return Response.json(
      { error: 'Failed to verify folder' },
      { status: 500 }
    );
  }
});