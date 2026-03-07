import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CSV template with header row and two example rows
    // NOTE: class_name and section must match Settings → Class Sections for the academic year.
    // student_id is intentionally excluded — it is auto-generated on Approval.
    const headers = [
      'name',
      'class_name',
      'section',
      'parent_name',
      'parent_phone',
      'parent_email',
      'dob',
      'gender',
      'address',
      'blood_group'
    ];

    const exampleRows = [
      ['John Doe', '5', 'A', 'Jane Doe', '9876543210', 'jane@example.com', '2015-06-15', 'Male', '123 Main St City', 'O+'],
      ['Priya Sharma', '5', 'B', 'Raj Sharma', '9876543211', '', '2015-03-22', 'Female', '456 Park Ave City', 'A+']
    ];

    const csvContent = [
      headers.join(','),
      ...exampleRows.map(row => row.join(','))
    ].join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="student_import_template.csv"'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});