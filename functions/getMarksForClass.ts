import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const STAFF_ROLES = ['admin', 'principal', 'teacher', 'staff', 'exam_staff', 'accountant'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = String(user.role || '').trim().toLowerCase();
    if (!STAFF_ROLES.includes(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { className, section, examType, academicYear } = await req.json();

    if (!className || !section || !academicYear) {
      return Response.json({ error: 'className, section, academicYear required' }, { status: 400 });
    }

    const filter = { class_name: className, section, academic_year: academicYear };
    if (examType) filter.exam_type = examType;

    const marks = await base44.asServiceRole.entities.Marks.filter(filter, '-created_date', 500);

    return Response.json({ marks: marks || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});