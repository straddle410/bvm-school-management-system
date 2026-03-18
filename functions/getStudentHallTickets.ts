import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id } = await req.json();

    if (!student_id) {
      return Response.json({ error: 'student_id required' }, { status: 400 });
    }

    // STRICT FILTERING: Only Published tickets for current academic year
    // Get current academic year from config
    const academicYears = await base44.asServiceRole.entities.AcademicYear.filter({ is_current: true });
    const currentAcademicYear = academicYears.length > 0 ? academicYears[0].year : null;

    if (!currentAcademicYear) {
      return Response.json({ 
        error: 'Current academic year not configured', 
        hallTickets: [], 
        schoolProfile: null 
      });
    }

    // Fetch ONLY Published tickets for current academic year
    const hallTickets = await base44.asServiceRole.entities.HallTicket.filter({
      student_id,
      status: 'Published',
      academic_year: currentAcademicYear
    }, '-created_date');

    if (hallTickets.length === 0) {
      const schoolProfiles = await base44.asServiceRole.entities.SchoolProfile.list();
      return Response.json({ 
        hallTickets: [], 
        schoolProfile: schoolProfiles[0] || null 
      });
    }

    // OPTIMIZATION: Batch fetch timetables grouped by exam_type
    // Instead of fetching per ticket (N+1), batch by exam type
    const examTypeSet = new Set(hallTickets.map(t => t.exam_type));
    const timetableMap = {};

    await Promise.all(
      Array.from(examTypeSet).map(async (examTypeId) => {
        const timetables = await base44.asServiceRole.entities.ExamTimetable.filter({
          exam_type: examTypeId,
          academic_year: currentAcademicYear
        }, 'exam_date');
        
        timetableMap[examTypeId] = timetables;
      })
    );

    // Fetch all exam types to resolve names
    const examTypes = await base44.asServiceRole.entities.ExamType.list();
    const examTypeMap = {};
    examTypes.forEach(et => { 
      examTypeMap[et.id] = et.name; 
    });

    // Attach timetable to each ticket
    const ticketsWithTimetable = hallTickets.map(ticket => ({
      ...ticket,
      exam_type_name: examTypeMap[ticket.exam_type] || ticket.exam_type,
      timetable: timetableMap[ticket.exam_type] || []
    }));

    // Fetch school profile
    const schoolProfiles = await base44.asServiceRole.entities.SchoolProfile.list();
    const schoolProfile = schoolProfiles[0] || null;

    return Response.json({ 
      hallTickets: ticketsWithTimetable, 
      schoolProfile,
      academicYear: currentAcademicYear
    });
  } catch (error) {
    console.error('Error fetching student hall tickets:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});