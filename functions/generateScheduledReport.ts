import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { report_id } = await req.json();

    // Get the report
    const report = await base44.entities.ScheduledReport.get(report_id);
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    // Update status to Generated
    await base44.entities.ScheduledReport.update(report_id, { status: 'Generated' });

    // If email delivery is enabled and recipients exist, send email
    if (report.include_in_email && report.delivery_recipients?.length > 0) {
      const emailSubject = `${report.report_type} Report - Class ${report.class_name}-${report.section}`;
      const emailBody = `
Dear Parent/Teacher,

Please find attached the ${report.report_type} report for Class ${report.class_name}-${report.section}.

Period: ${report.start_date} to ${report.end_date}

Best regards,
School Management System
      `.trim();

      for (const recipient of report.delivery_recipients) {
        await base44.integrations.Core.SendEmail({
          to: recipient,
          subject: emailSubject,
          body: emailBody,
        });
      }

      // Update status to Sent
      await base44.entities.ScheduledReport.update(report_id, { status: 'Sent' });
    }

    return Response.json({
      success: true,
      message: 'Report generated successfully',
      report_id,
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});