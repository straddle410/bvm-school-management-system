import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CSV template with header row and one example row
    const headers = [
      'name',
      'class_name',
      'section',
      'roll_no',
      'parent_name',
      'parent_phone',
      'parent_email',
      'dob',
      'gender',
      'address',
      'blood_group'
    ];

    const exampleRow = [
      'John Doe',
      '5',
      'A',
      '1',
      'Jane Doe',
      '9876543210',
      'jane@example.com',
      '2015-06-15',
      'Male',
      '123 Main St, City',
      'O+'
    ];

    const csvContent = [
      headers.join(','),
      exampleRow.join(',')
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