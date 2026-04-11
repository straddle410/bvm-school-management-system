import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { academic_year } = body;

    if (!academic_year) {
      return Response.json({ error: 'academic_year is required' }, { status: 400 });
    }

    // Fetch all active routes
    const routes = await base44.asServiceRole.entities.TransportRoute.list();

    // Fetch all non-deleted students for this academic year
    const students = await base44.asServiceRole.entities.Student.filter({
      academic_year,
      is_deleted: false,
      status: 'Published'
    });

    // Group students by route
    const routeMap = {};

    // Initialize all routes with 0
    for (const route of routes) {
      routeMap[route.id] = {
        route_id: route.id,
        route_name: route.name,
        fee_type: route.fee_type,
        is_active: route.is_active,
        student_count: 0,
        students: []
      };
    }

    // Count students per route
    let noTransportCount = 0;
    const noTransportStudents = [];

    for (const student of students) {
      if (student.transport_enabled && student.transport_route_id && routeMap[student.transport_route_id]) {
        routeMap[student.transport_route_id].student_count++;
        routeMap[student.transport_route_id].students.push({
          name: student.name,
          class_name: student.class_name,
          section: student.section,
          stop_name: student.transport_stop_name || ''
        });
      } else {
        noTransportCount++;
        noTransportStudents.push({
          name: student.name,
          class_name: student.class_name,
          section: student.section
        });
      }
    }

    const routeSummary = Object.values(routeMap).sort((a, b) => b.student_count - a.student_count);

    return Response.json({
      success: true,
      total_students: students.length,
      transport_students: students.filter(s => s.transport_enabled).length,
      no_transport_count: noTransportCount,
      routes: routeSummary
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});