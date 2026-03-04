import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const hashSHA256 = async (data) => {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role || '').toLowerCase() !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { backupType = 'MANUAL', academicYear } = body;

    const profile = (await base44.asServiceRole.entities.SchoolProfile.list())[0];
    if (!profile) {
      return Response.json({ error: 'School profile not found' }, { status: 400 });
    }

    const counts = {};
    // Get current time in IST (UTC+5:30)
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    
    const payload = {
      meta: {
        schoolName: profile.school_name,
        createdAt: istTime.toISOString(),
        backupType,
        academicYear: academicYear || null
      },
      entities: {}
    };

    // Fetch Students
    const students = academicYear 
      ? await base44.asServiceRole.entities.Student.filter({ academic_year: academicYear })
      : await base44.asServiceRole.entities.Student.list();
    payload.entities.Student = students;
    counts.Student = students.length;

    // Fetch Attendance
    const attendanceFilter = academicYear ? { academic_year: academicYear } : {};
    const attendance = await base44.asServiceRole.entities.Attendance.filter(attendanceFilter);
    payload.entities.Attendance = attendance;
    counts.Attendance = attendance.length;

    // Fetch Exams/Marks
    const examTypeFilter = academicYear ? { academic_year: academicYear } : {};
    const examTypes = await base44.asServiceRole.entities.ExamType.filter(examTypeFilter);
    payload.entities.ExamType = examTypes;
    counts.ExamType = examTypes.length;

    const marksFilter = academicYear ? { academic_year: academicYear } : {};
    const marks = await base44.asServiceRole.entities.Marks.filter(marksFilter);
    payload.entities.Marks = marks;
    counts.Marks = marks.length;

    // Fetch Subjects & ClassSubjectConfig
    const subjects = await base44.asServiceRole.entities.Subject.list();
    payload.entities.Subject = subjects;
    counts.Subject = subjects.length;

    const classSubjectFilter = academicYear ? { academic_year: academicYear } : {};
    const classSubjects = await base44.asServiceRole.entities.ClassSubjectConfig.filter(classSubjectFilter);
    payload.entities.ClassSubjectConfig = classSubjects;
    counts.ClassSubjectConfig = classSubjects.length;

    // Generate checksum
    const payloadStr = JSON.stringify(payload);
    const checksum = await hashSHA256(payloadStr);

    // Create FullSchoolBackup record
    const backup = await base44.asServiceRole.entities.FullSchoolBackup.create({
      created_by_user_id: user.email,
      backup_type: backupType,
      academic_year: academicYear || null,
      status: 'COMPLETED',
      counts_summary: counts,
      file_json: payload,
      checksum
    });

    // If auto-export enabled, export to Drive
    if (profile.auto_export_full_backup_to_drive && profile.full_backup_drive_folder_id) {
     console.log(`[CreateBackup] Auto-export enabled. Triggering export for backup ${backup.id}`);
     console.log(`[CreateBackup] auto_export_full_backup_to_drive=${profile.auto_export_full_backup_to_drive}, folder=${profile.full_backup_drive_folder_id}`);
     try {
       const exportRes = await base44.asServiceRole.functions.invoke('exportFullSchoolBackupToDrive', {
         backupId: backup.id,
         folderId: profile.full_backup_drive_folder_id
       });
       console.log(`[CreateBackup] Export triggered successfully`);
     } catch (exportErr) {
       console.error(`[CreateBackup] Export failed: ${exportErr.message}`);
       // Don't rethrow - backup is already created, just export failed (will be marked FAILED by export function)
     }
    } else {
     console.log(`[CreateBackup] Auto-export disabled or no folder configured. auto_export=${profile.auto_export_full_backup_to_drive}, folder=${profile.full_backup_drive_folder_id}`);
    }

    // Retention: keep last 12 WEEKLY_AUTO backups
    if (backupType === 'WEEKLY_AUTO') {
      const weeklyBackups = await base44.asServiceRole.entities.FullSchoolBackup.filter(
        { backup_type: 'WEEKLY_AUTO' },
        '-created_date'
      );
      if (weeklyBackups.length > 12) {
        const toDelete = weeklyBackups.slice(12);
        for (const b of toDelete) {
          await base44.asServiceRole.entities.FullSchoolBackup.delete(b.id);
        }
      }
    }

    return Response.json({ 
      id: backup.id,
      status: 'COMPLETED',
      counts: counts,
      checksum
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});