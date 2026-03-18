import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { monitorType, days = 1 } = await req.json();

    if (monitorType === 'duplicate_attempts') {
      // Monitor validateAttendanceCreateDedup calls over past N days
      // This tracks how many create attempts found duplicates

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Note: Function logs don't persist in database by default
      // Manual monitoring: check function execution logs via Dashboard

      return Response.json({
        monitor: 'duplicate_attempts',
        period: `Last ${days} days`,
        note: 'Check function logs: Dashboard → Code → Functions → validateAttendanceCreateDedup',
        alert_threshold: '5+ duplicates/day indicates user confusion or retry loop',
        action: 'If threshold exceeded, check attendance completion deadline notice',
        timestamp: new Date().toISOString()
      });
    }

    if (monitorType === 'unlock_audit_logs') {
      // Query unlock audit logs
      const auditLogs = await base44.asServiceRole.entities.AuditLog.filter({
        action: 'unlock_and_edit',
        module: 'Attendance'
      });

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentLogs = auditLogs.filter(log => 
        new Date(log.created_date) >= cutoffDate
      );

      // Group by admin email to detect abuse patterns
      const byAdmin = {};
      recentLogs.forEach(log => {
        if (!byAdmin[log.performed_by]) {
          byAdmin[log.performed_by] = [];
        }
        byAdmin[log.performed_by].push({
          date: log.date,
          timestamp: log.created_date,
          details: log.details
        });
      });

      // Flag if same admin unlocked same date multiple times
      const suspiciousPatterns = Object.entries(byAdmin).filter(
        ([_, logs]) => logs.length > 3
      );

      return Response.json({
        monitor: 'unlock_audit_logs',
        period: `Last ${days} days`,
        totalUnlocks: recentLogs.length,
        uniqueAdmins: Object.keys(byAdmin).length,
        byAdmin: byAdmin,
        suspiciousPatterns: suspiciousPatterns.length > 0 ? suspiciousPatterns : [],
        alert: suspiciousPatterns.length > 0 ? 
          `⚠️ ${suspiciousPatterns[0][0]} has unlocked >3 times` : 
          'No suspicious patterns',
        timestamp: new Date().toISOString()
      });
    }

    if (monitorType === 'lock_execution') {
      // Verify auto-lock executed today (or most recent day)
      const today = new Date().toISOString().split('T')[0];

      // Check if any records are locked from today
      const lockedToday = await base44.asServiceRole.entities.Attendance.filter({
        date: today,
        is_locked: true
      });

      // Check locked_at timestamps to verify they're near 3:00 PM IST
      const lockTimestamps = lockedToday.map(record => {
        const lockTime = new Date(record.locked_at);
        const hours = lockTime.getHours();
        const minutes = lockTime.getMinutes();
        return {
          record_id: record.id,
          student: record.student_name,
          locked_at: record.locked_at,
          lock_time_display: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
        };
      });

      const lockedCount = lockedToday.length;
      const expectedLockTime = '15:00'; // 3:00 PM

      // Check if locks occurred near 3:00 PM (±15 minutes)
      const correctTimingCount = lockTimestamps.filter(t => {
        const [h, m] = t.lock_time_display.split(':');
        const lockMinutes = parseInt(h) * 60 + parseInt(m);
        const expectedMinutes = 15 * 60;
        return Math.abs(lockMinutes - expectedMinutes) <= 15;
      }).length;

      return Response.json({
        monitor: 'lock_execution',
        date: today,
        totalLockedRecords: lockedCount,
        lockedCorrectly: correctTimingCount,
        lockTimestamps: lockTimestamps,
        expectedLockTime: `${expectedLockTime} IST (±15 min)`,
        status: correctTimingCount === lockedCount ? '✅ PASS' : '⚠️ TIMING ISSUE',
        alert: lockedCount === 0 ? 
          '⚠️ No records locked - automation may not have run' : 
          correctTimingCount < lockedCount ? 
          '⚠️ Some records locked outside 3:00 PM window' : 
          '✅ All locks correct',
        timestamp: new Date().toISOString()
      });
    }

    if (monitorType === 'daily_summary') {
      // Comprehensive daily monitoring report
      const today = new Date().toISOString().split('T')[0];

      // Get all records from today
      const todayRecords = await base44.asServiceRole.entities.Attendance.filter({
        date: today
      });

      // Count locked
      const lockedCount = todayRecords.filter(r => r.is_locked).length;
      const unlockedCount = todayRecords.length - lockedCount;

      // Get audit logs from today
      const auditToday = await base44.asServiceRole.entities.AuditLog.filter({
        module: 'Attendance',
        action: 'unlock_and_edit'
      });

      const recentAuditToday = auditToday.filter(log => 
        log.date === today
      );

      // Count by attendance type
      const byType = {
        full_day: todayRecords.filter(r => r.attendance_type === 'full_day').length,
        half_day: todayRecords.filter(r => r.attendance_type === 'half_day').length,
        absent: todayRecords.filter(r => r.attendance_type === 'absent').length,
        holiday: todayRecords.filter(r => r.attendance_type === 'holiday').length
      };

      return Response.json({
        monitor: 'daily_summary',
        date: today,
        totalRecords: todayRecords.length,
        locked: lockedCount,
        unlocked: unlockedCount,
        byType: byType,
        adminUnlocks: recentAuditToday.length,
        alerts: [
          unlockedCount > 0 ? `⚠️ ${unlockedCount} unlocked records (will lock at 3:30 PM)` : null,
          recentAuditToday.length > 2 ? `⚠️ ${recentAuditToday.length} admin unlocks today` : null,
          lockedCount === 0 && todayRecords.length > 0 ? '⚠️ No locks yet (before 3:00 PM)' : null
        ].filter(Boolean),
        timestamp: new Date().toISOString()
      });
    }

    return Response.json({
      error: 'Invalid monitorType. Use: duplicate_attempts, unlock_audit_logs, lock_execution, daily_summary'
    });
  } catch (error) {
    console.error('Monitoring error:', error);
    return Response.json(
      { error: error.message || 'Monitoring failed', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
});