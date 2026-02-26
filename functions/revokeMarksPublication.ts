import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { marksIds } = await req.json();

    if (!marksIds || !Array.isArray(marksIds) || marksIds.length === 0) {
      return Response.json({ error: 'marksIds array required' }, { status: 400 });
    }

    // Fetch all marks
    const allMarks = await base44.asServiceRole.entities.Marks.list();
    const marksToRevoke = allMarks.filter(m =>
      marksIds.includes(m.id) && m.status === 'Published'
    );

    if (marksToRevoke.length === 0) {
      return Response.json({
        error: 'No published marks found to revoke'
      }, { status: 404 });
    }

    // Revoke: revert Published → Verified (server-side)
    const revokePromises = marksToRevoke.map(m =>
      base44.asServiceRole.entities.Marks.update(m.id, { status: 'Verified' })
    );

    await Promise.all(revokePromises);

    // Log revocation
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'marks_publication_revoked',
      module: 'Marks',
      date: new Date().toISOString().split('T')[0],
      performed_by: user.email,
      details: JSON.stringify({
        records_revoked: marksToRevoke.length,
        marks_ids: marksIds,
        status_transition: 'Published → Verified',
        timestamp: new Date().toISOString(),
        revoked_by_email: user.email
      })
    });

    return Response.json({
      success: true,
      message: `Revoked publication of ${marksToRevoke.length} marks`,
      records_revoked: marksToRevoke.length,
      new_status: 'Verified'
    }, { status: 200 });
  } catch (error) {
    console.error('Marks revocation error:', error);
    return Response.json(
      { error: error.message || 'Failed to revoke marks publication' },
      { status: 500 }
    );
  }
});