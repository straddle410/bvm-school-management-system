import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role?.toLowerCase() !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { academicYear } = await req.json();

    if (!academicYear) {
      return Response.json({ error: 'academicYear is required' }, { status: 400 });
    }

    // Get students for the specified academic year ONLY
    const allStudents = await base44.asServiceRole.entities.Student.filter(
      { academic_year: academicYear },
      '',
      10000
    );
    
    // Find duplicates by name + dob + phone combinations within the academic year
    const grouped = {};
    const phoneDuplicates = {};
    const nameDobDuplicates = {};

    allStudents.forEach(student => {
      // Group by name + dob (case-insensitive name)
      if (student.name && student.dob) {
        const nameDobKey = `${student.name.toLowerCase()}_${student.dob}_${student.academic_year}`;
        if (!nameDobDuplicates[nameDobKey]) {
          nameDobDuplicates[nameDobKey] = [];
        }
        nameDobDuplicates[nameDobKey].push(student);
      }

      // Group by parent phone
      if (student.parent_phone) {
        const phoneKey = `${student.parent_phone}_${student.academic_year}`;
        if (!phoneDuplicates[phoneKey]) {
          phoneDuplicates[phoneKey] = [];
        }
        phoneDuplicates[phoneKey].push(student);
      }

      // Legacy: Group by name + class + academic_year
      const key = `${student.name}_${student.class_name}_${student.academic_year}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(student);
    });

    // Collect all duplicate groups across all checks
    const duplicates = [];

    // Check name + dob duplicates
    for (const key in nameDobDuplicates) {
      if (nameDobDuplicates[key].length > 1) {
        duplicates.push({
          type: 'name_dob',
          key,
          students: nameDobDuplicates[key]
        });
      }
    }

    // Check phone duplicates
    for (const key in phoneDuplicates) {
      if (phoneDuplicates[key].length > 1) {
        duplicates.push({
          type: 'phone',
          key,
          students: phoneDuplicates[key]
        });
      }
    }

    // Check legacy name + class duplicates
    for (const key in grouped) {
      if (grouped[key].length > 1) {
        // Only add if not already caught by more specific checks
        const notAlreadyCaught = !duplicates.some(d => 
          d.students.length === grouped[key].length && 
          grouped[key].every(s => d.students.some(ds => ds.id === s.id))
        );
        if (notAlreadyCaught) {
          duplicates.push({
            type: 'name_class',
            key,
            students: grouped[key]
          });
        }
      }
    }

    if (duplicates.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No duplicate students found in academic year ' + academicYear 
      });
    }

    // Delete the older duplicate (keep the most recent one)
    for (const group of duplicates) {
      const sorted = group.students.sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      );
      // Delete all but the first (most recent)
      for (let i = 1; i < sorted.length; i++) {
        await base44.asServiceRole.entities.Student.delete(sorted[i].id);
      }
    }

    return Response.json({
      success: true,
      message: `Cleaned up ${duplicates.length} duplicate groups in ${academicYear}`,
      academicYear: academicYear,
      duplicates: duplicates.map(d => ({
        type: d.type,
        key: d.key,
        count: d.students.length,
        deleted: d.students.length - 1
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});