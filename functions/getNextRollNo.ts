import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Returns next available roll_no for class+section+academic_year
// Also used to get all students for a class (for Manage Roll Numbers tool)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action = 'next', class_name, section, academic_year } = body;

    if (!class_name || !section || !academic_year) {
      return Response.json({ error: 'class_name, section, academic_year are required' }, { status: 400 });
    }

    const students = await base44.asServiceRole.entities.Student.filter(
      { class_name, section, academic_year },
      'roll_no',
      10000
    );

    if (action === 'next') {
      // Find max roll_no among existing students in this class
      const maxRoll = students.reduce((max, s) => {
        const r = parseInt(s.roll_no);
        return !isNaN(r) && r > max ? r : max;
      }, 0);
      return Response.json({ next_roll_no: maxRoll + 1 });
    }

    if (action === 'list') {
      // Return sorted list of students for Manage Roll Numbers tool
      const sorted = [...students].sort((a, b) => {
        const ra = parseInt(a.roll_no) || 9999;
        const rb = parseInt(b.roll_no) || 9999;
        return ra - rb;
      });
      return Response.json({ students: sorted });
    }

    if (action === 'save_rolls') {
      // Admin saves edited roll numbers
      const { updates } = body; // [{ id, roll_no }]
      if (!Array.isArray(updates)) return Response.json({ error: 'updates array required' }, { status: 400 });

      // Validate uniqueness
      const seen = new Map();
      for (const u of updates) {
        const roll = parseInt(u.roll_no);
        if (!roll || roll < 1) return Response.json({ error: `Invalid roll number for student ${u.id}` }, { status: 400 });
        if (seen.has(roll)) return Response.json({ error: `Duplicate roll number: ${roll}` }, { status: 400 });
        seen.set(roll, u.id);
      }

      // Also check against students NOT in the updates list (students not in current view)
      const updatingIds = new Set(updates.map(u => u.id));
      for (const s of students) {
        if (!updatingIds.has(s.id) && s.roll_no) {
          if (seen.has(parseInt(s.roll_no))) {
            return Response.json({ error: `Roll number ${s.roll_no} conflicts with another student in this class` }, { status: 400 });
          }
        }
      }

      // Apply updates
      for (const u of updates) {
        await base44.asServiceRole.entities.Student.update(u.id, { roll_no: parseInt(u.roll_no) });
      }

      return Response.json({ success: true, updated: updates.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});