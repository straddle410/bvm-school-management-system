import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Debug function: compares student session with actual homework in database
 * Call with student_id to see why homework isn't showing
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, academic_year } = await req.json();

    if (!student_id) {
      return Response.json({ error: 'student_id required' }, { status: 400 });
    }

    // Get student record
    const students = await base44.asServiceRole.entities.Student.filter({ student_id });
    if (!students || students.length === 0) {
      return Response.json({ error: `Student ${student_id} not found` }, { status: 404 });
    }

    const student = students[0];
    console.log('[DEBUG_HW] Student found:', {
      student_id: student.student_id,
      name: student.name,
      class_name: student.class_name,
      section: student.section,
      academic_year: student.academic_year,
    });

    const filterYear = academic_year || student.academic_year || '2024-25';

    // Get ALL homework for Class 2, Section A to see what exists
    const allHomeworkClass2 = await base44.asServiceRole.entities.Homework.filter(
      { class_name: '2', status: 'Published' },
      '-due_date',
      50
    );

    console.log('[DEBUG_HW] All published homework for Class 2:', allHomeworkClass2.length, 'records');
    allHomeworkClass2.forEach(hw => {
      console.log('[DEBUG_HW_RECORD]', {
        id: hw.id,
        title: hw.title,
        class_name: hw.class_name,
        section: hw.section || 'NOT_SET',
        academic_year: hw.academic_year || 'NOT_SET',
        status: hw.status,
        created_date: hw.created_date,
      });
    });

    // Get homework filtered like StudentHomework does
    const studentHomeworkQuery = await base44.asServiceRole.entities.Homework.filter(
      { class_name: student.class_name, status: 'Published' },
      '-due_date',
      200
    );

    console.log('[DEBUG_HW] Query result for class ' + student.class_name + ':', studentHomeworkQuery.length, 'records');

    // Apply section filter like StudentHomework does
    const filtered = studentHomeworkQuery.filter(hw => {
      const hwSection = hw.section || 'All';
      const classMatch = hw.class_name === student.class_name;
      const sectionMatch = hwSection === 'All' || hwSection === student.section;
      const match = classMatch && sectionMatch;

      if (!match) {
        console.log('[DEBUG_HW_REJECT]', {
          id: hw.id,
          title: hw.title,
          class: hw.class_name,
          expectedClass: student.class_name,
          section: hwSection,
          expectedSection: student.section,
          sectionMatch,
          classMatch,
        });
      }

      return match;
    });

    console.log('[DEBUG_HW] After section filter:', filtered.length, 'records');

    return Response.json({
      student: {
        student_id: student.student_id,
        name: student.name,
        class_name: student.class_name,
        section: student.section,
        academic_year: student.academic_year,
      },
      query: {
        class_name: student.class_name,
        status: 'Published',
      },
      results: {
        all_published_class2_count: allHomeworkClass2.length,
        query_result_count: studentHomeworkQuery.length,
        after_section_filter_count: filtered.length,
      },
      class2_records: allHomeworkClass2.map(hw => ({
        id: hw.id,
        title: hw.title,
        class_name: hw.class_name,
        section: hw.section || 'NOT_SET',
        academic_year: hw.academic_year || 'NOT_SET',
        status: hw.status,
      })),
      filtered_records: filtered.map(hw => ({
        id: hw.id,
        title: hw.title,
        class_name: hw.class_name,
        section: hw.section,
      })),
    });
  } catch (error) {
    console.error('[debugStudentHomeworkVisibility]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});