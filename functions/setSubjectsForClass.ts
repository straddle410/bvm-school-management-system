import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Normalize class name to match entity enum
const normalizeClassName = (cls) => cls?.toString().trim() || '';

// Validate and sanitize subject_names
const sanitizeSubjects = (subjects) => {
  if (!Array.isArray(subjects)) return [];
  return [...new Set(
    subjects
      .filter(s => typeof s === 'string' && s.trim().length > 0)
      .map(s => s.trim())
  )];
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role?.toLowerCase() !== 'admin' && user.role?.toLowerCase() !== 'principal')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let { academic_year, class_name, subject_names } = await req.json();

    // Request logging
    console.log('[SET_SUBJECTS_FOR_CLASS_REQ]', {
      academic_year,
      class_name,
      subject_names_count: subject_names?.length || 0
    });

    // Validate inputs
    if (!academic_year || typeof academic_year !== 'string' || academic_year.trim().length === 0) {
      return Response.json({ 
        success: false, 
        code: 'INVALID_ACADEMIC_YEAR', 
        message: 'academic_year must be a non-empty string' 
      }, { status: 400 });
    }

    if (!class_name || typeof class_name !== 'string' || class_name.trim().length === 0) {
      return Response.json({ 
        success: false, 
        code: 'INVALID_CLASS_NAME', 
        message: 'class_name must be a non-empty string' 
      }, { status: 400 });
    }

    if (!Array.isArray(subject_names)) {
      return Response.json({ 
        success: false, 
        code: 'INVALID_SUBJECT_NAMES', 
        message: 'subject_names must be an array' 
      }, { status: 400 });
    }

    // Normalize and sanitize
    academic_year = academic_year.trim();
    class_name = normalizeClassName(class_name);
    subject_names = sanitizeSubjects(subject_names);

    console.log('[SET_SUBJECTS_FOR_CLASS_NORMALIZED]', {
      academic_year,
      class_name,
      subject_names_count: subject_names.length,
      subject_names
    });

    // Validate academic_year is active (not archived)
    const years = await base44.asServiceRole.entities.AcademicYear.filter({ year: academic_year });
    const yearRecord = years.find(y => (y.status || '').toLowerCase() !== 'archived');
    if (!yearRecord) {
      return Response.json({ 
        success: false, 
        code: 'INVALID_ACADEMIC_YEAR', 
        message: `Academic year "${academic_year}" is not active or does not exist.` 
      }, { status: 422 });
    }

    // Upsert: find existing config or create new
    const existing = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year,
      class_name
    });

    console.log('[SET_SUBJECTS_FOR_CLASS_EXISTING]', { found: existing.length > 0, recordId: existing[0]?.id || 'N/A' });

    let result;
    if (existing.length > 0) {
      result = await base44.asServiceRole.entities.ClassSubjectConfig.update(existing[0].id, { subject_names });
      console.log('[SET_SUBJECTS_FOR_CLASS_UPDATED]', { recordId: result.id, subject_count: result.subject_names?.length || 0 });
    } else {
      result = await base44.asServiceRole.entities.ClassSubjectConfig.create({
        academic_year,
        class_name,
        subject_names
      });
      console.log('[SET_SUBJECTS_FOR_CLASS_CREATED]', { recordId: result.id, subject_count: result.subject_names?.length || 0 });
    }

    return Response.json({ success: true, config: result });

  } catch (error) {
    console.error('[SET_SUBJECTS_FOR_CLASS_ERR]', error);
    return Response.json({ 
      success: false, 
      code: 'SET_SUBJECTS_500', 
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});