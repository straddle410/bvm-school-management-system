import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

/**
 * APPROVAL WORKFLOW: Approve student, generate ID, and assign roll number
 * Called when status transitions to Approved or Published
 * 
 * This function:
 * 1. Verifies student exists and is in Pending/Verified status
 * 2. Changes status to Approved
 * 3. Generates next sequential student_id
 * 4. Generates username from student_id
 * 5. Generates next roll_no for class+section+academic_year
 * 6. Returns updated record
 * 
 * Roll number scope: class + section + academic_year (per business rule)
 * Roll number is ONLY assigned here, never during initial creation
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_db_id, staffInfo } = await req.json();
    if (!staffInfo || !staffInfo.staff_id) {
      return Response.json({ error: 'Unauthorized: Missing staff info' }, { status: 401 });
    }
    const user = staffInfo;

    if (!student_db_id) {
      return Response.json({ error: 'student_db_id required in payload' }, { status: 400 });
    }

    // Fetch student
    const students = await base44.asServiceRole.entities.Student.filter({ id: student_db_id });
    if (!students || students.length === 0) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const student = students[0];

    // Validate academic year exists
    if (!student.academic_year) {
      return Response.json({ error: 'Student missing academic_year' }, { status: 400 });
    }

    // If already has student_id, don't regenerate (idempotent)
    if (student.student_id) {
      return Response.json({
        success: true,
        already_assigned: true,
        student_id: student.student_id,
        username: student.username,
        roll_no: student.roll_no,
        status: student.status,
        message: `Student already has ID ${student.student_id}`
      });
    }

    // Validate current status allows approval
    if (!['Pending', 'Verified'].includes(student.status)) {
      return Response.json(
        { error: `Cannot approve student with status: ${student.status}` },
        { status: 400 }
      );
    }

    // Parse academic year (format: YYYY-YY e.g., 2025-26)
    const match = student.academic_year.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return Response.json({ error: 'Invalid academic_year format' }, { status: 400 });
    }

    const startYear = match[1];
    const yy = startYear.slice(2); // "2025" → "25"

    // ========== GENERATE STUDENT ID ==========
    const allStudents = await base44.asServiceRole.entities.Student.filter({ 
      academic_year: student.academic_year
    });
    
    const pattern = new RegExp(`^S${yy}(\\d{3})$`);
    const existing = allStudents
      .map(s => s.student_id)
      .filter(id => id && pattern.test(id))
      .map(id => {
        const m = id.match(/^S\d{2}(\d{3})$/);
        return m ? parseInt(m[1], 10) : 0;
      });
    
    const maxExisting = existing.length > 0 ? Math.max(...existing) : 0;
    const nextNumber = maxExisting + 1;
    const generatedId = `S${yy}${String(nextNumber).padStart(3, '0')}`;

    // Collision check: ensure no other student has this ID
    const collision = await base44.asServiceRole.entities.Student.filter({
      student_id: generatedId
    });
    
    if (collision.length > 0) {
      return Response.json(
        { 
          error: 'Student ID collision',
          details: `${generatedId} was already assigned`
        },
        { status: 409 }
      );
    }

    // ========== GENERATE ROLL NUMBER ==========
    // Scope: class + section + academic_year
    if (!student.class_name || !student.section) {
      return Response.json(
        { error: 'Student must have class_name and section to assign roll number' },
        { status: 400 }
      );
    }

    const classStudents = await base44.asServiceRole.entities.Student.filter({
      class_name: student.class_name,
      section: student.section,
      academic_year: student.academic_year
    });

    // Exclude archived/passed-out/transferred/deleted students
    const EXCLUDED_STATUSES = ['Archived', 'Passed Out', 'Transferred'];
    const activeStudents = classStudents.filter(s => !s.is_deleted && !EXCLUDED_STATUSES.includes(s.status));
    
    const maxRoll = activeStudents.reduce((max, s) => {
      const r = parseInt(s.roll_no);
      return !isNaN(r) && r > max ? r : max;
    }, 0);
    
    const assignedRollNo = maxRoll + 1;

    // ========== ATOMIC UPDATE ==========
    const DEFAULT_PASSWORD = 'BVM123';
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // Change status + set ID + set roll_no + set credentials in one operation
    await base44.asServiceRole.entities.Student.update(student_db_id, {
      status: 'Approved',
      student_id: generatedId,
      student_id_norm: generatedId.toLowerCase(),
      username: generatedId,
      password_hash: passwordHash,
      password: null,
      must_change_password: true,
      roll_no: assignedRollNo,
      approved_by: user.email
    });

    return Response.json({
      success: true,
      already_assigned: false,
      student_id: generatedId,
      username: generatedId,
      roll_no: assignedRollNo,
      status: 'Approved',
      must_change_password: true,
      approved_by: user.email,
      message: `Student approved. ID ${generatedId} and Roll No ${assignedRollNo} generated`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});