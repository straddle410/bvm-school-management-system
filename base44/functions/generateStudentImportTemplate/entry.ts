Deno.serve(async (req) => {
  try {
    const headers = [
      'name', 'class_name', 'section', 'parent_name', 'parent_phone',
      'parent_email', 'dob', 'gender', 'address', 'blood_group'
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