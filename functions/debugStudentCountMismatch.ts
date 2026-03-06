import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Debug: compare Reports vs Students page counts for a given academic_year.
 * Temporary diagnostic function — safe to delete after investigation.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const academic_year = body.academic_year || '2025-26';

    // === Reports page query ===
    // pages/Reports: base44.entities.Student.filter({ status: 'Published' })
    // NO academic_year filter, NO is_deleted filter
    const reportsStudents = await base44.asServiceRole.entities.Student.filter({ status: 'Published' });
    const reportsForYear = reportsStudents.filter(s => s.academic_year === academic_year);

    // === Students page query (via getStudentsPaginated) ===
    // Filters: academic_year, exclude_archived=true (when showArchived=false, filterStatus='all')
    // exclude_archived removes status in ['Passed Out','Transferred']
    // is_deleted=false always excluded
    // Default view (no filters): status NOT in [Passed Out, Transferred], is_deleted != true
    const ARCHIVED_STATUSES = ['Passed Out', 'Transferred'];
    const allForYear = await base44.asServiceRole.entities.Student.filter({ academic_year });
    const studentsPageStudents = allForYear.filter(s =>
      !s.is_deleted &&
      !ARCHIVED_STATUSES.includes(s.status)
    );

    // === Find the difference ===
    const reportsIds = new Set(reportsForYear.map(s => s.id));
    const studentsPageIds = new Set(studentsPageStudents.map(s => s.id));

    const inReportsNotInStudentsPage = reportsForYear.filter(s => !studentsPageIds.has(s.id));
    const inStudentsPageNotInReports = studentsPageStudents.filter(s => !reportsIds.has(s.id));

    return Response.json({
      academic_year,
      reports_count: reportsForYear.length,
      students_page_count: studentsPageStudents.length,
      difference: reportsForYear.length - studentsPageStudents.length,

      // These are the extra ones Reports shows but Students page hides
      in_reports_not_in_students_page: inReportsNotInStudentsPage.map(s => ({
        id: s.id,
        student_id: s.student_id,
        name: s.name,
        status: s.status,
        is_deleted: s.is_deleted,
        academic_year: s.academic_year,
      })),

      // These are ones Students page shows but Reports misses
      in_students_page_not_in_reports: inStudentsPageNotInReports.map(s => ({
        id: s.id,
        student_id: s.student_id,
        name: s.name,
        status: s.status,
        is_deleted: s.is_deleted,
        academic_year: s.academic_year,
      })),

      reports_all_statuses_breakdown: reportsForYear.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {}),

      students_page_all_statuses_breakdown: studentsPageStudents.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});