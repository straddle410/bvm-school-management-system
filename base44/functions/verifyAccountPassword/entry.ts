import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { account_type, username, password } = await req.json();

    if (!account_type || !username || !password) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedUsername = username.trim().toLowerCase();

    if (account_type === 'student') {
      const students = await base44.asServiceRole.entities.Student.filter({
        student_id_norm: normalizedUsername
      });

      // Also try by username field
      let student = students?.[0];
      if (!student) {
        const byUsername = await base44.asServiceRole.entities.Student.filter({ username: username.trim() });
        student = byUsername?.[0];
      }

      if (!student) {
        return Response.json({ error: 'Account not found.' }, { status: 401 });
      }

      if (student.is_deleted || student.is_active === false) {
        return Response.json({ error: 'Account is inactive.' }, { status: 403 });
      }

      let valid = false;
      if (student.password_hash) {
        valid = await bcrypt.compare(password, student.password_hash);
      } else if (student.password) {
        valid = password === student.password;
      }

      if (!valid) {
        return Response.json({ error: 'Incorrect password.' }, { status: 401 });
      }

      return Response.json({ success: true, name: student.name, id: student.id });

    } else {
      // Staff
      const allStaff = await base44.asServiceRole.entities.StaffAccount.list();
      const staff = (allStaff || []).filter(s =>
        (s.username || '').trim().toLowerCase() === normalizedUsername
      );

      const account = staff?.[0];
      if (!account) {
        return Response.json({ error: 'Account not found.' }, { status: 401 });
      }

      if (!account.is_active) {
        return Response.json({ error: 'Account is inactive.' }, { status: 403 });
      }

      if (!account.password_hash) {
        return Response.json({ error: 'Password not set. Contact administrator.' }, { status: 401 });
      }

      let valid = false;
      if (account.password_hash?.startsWith('$2')) {
        valid = await bcrypt.compare(password, account.password_hash);
      }

      if (!valid) {
        return Response.json({ error: 'Incorrect password.' }, { status: 401 });
      }

      return Response.json({ success: true, name: account.name, id: account.id });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});