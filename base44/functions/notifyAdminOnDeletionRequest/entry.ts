import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data } = payload;

    // Only fire on new Pending deletion requests
    if (event?.type !== 'create') return Response.json({ skipped: true });

    const request = data;
    if (!request || request.status !== 'Pending') return Response.json({ skipped: true });

    // Get all admin users to notify
    const allUsers = await base44.asServiceRole.entities.User.list();
    const admins = allUsers.filter(u => u.role === 'admin');

    const accountLabel = request.account_type === 'student' ? 'Student' : 'Staff';
    const name = request.display_name || request.username || 'Unknown';
    const reason = request.reason || 'No reason provided';

    const subject = `⚠️ Account Deletion Request — ${name} (${accountLabel})`;
    const body = `
A new account deletion request has been submitted.

Account Type: ${accountLabel}
Username: ${request.username}
Name: ${name}
Reason: ${reason}
${request.additional_notes ? `Notes: ${request.additional_notes}` : ''}

Please log in to the admin portal and go to:
Students → Deletion Requests tab

to review and approve or reject this request.
    `.trim();

    for (const admin of admins) {
      if (admin.email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject,
          body,
        });
      }
    }

    console.log(`[notifyAdminOnDeletionRequest] Notified ${admins.length} admin(s) about deletion request for "${name}"`);
    return Response.json({ success: true, notified: admins.length });

  } catch (error) {
    console.error('[notifyAdminOnDeletionRequest] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});