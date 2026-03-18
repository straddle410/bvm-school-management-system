import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { username, password } = await req.json();

  if (!username || !password) {
    return Response.json({ success: false, error: "Username and password are required" });
  }

  // Find staff by username
  const staffList = await base44.asServiceRole.entities.StaffAccount.filter({ username });

  if (!staffList || staffList.length === 0) {
    return Response.json({ success: false, error: "Invalid username or password" });
  }

  const staff = staffList[0];

  // Check password (temp_password field)
  if (staff.temp_password !== password) {
    return Response.json({ success: false, error: "Invalid username or password" });
  }

  // Check if account is active
  if (staff.is_active === false) {
    return Response.json({ success: false, error: "Your account has been deactivated. Contact admin." });
  }

  // Return staff info (without password)
  return Response.json({
    success: true,
    staff: {
      id: staff.id,
      full_name: staff.full_name,
      username: staff.username,
      email: staff.email,
      role: staff.role,
      subjects: staff.subjects,
      classes_assigned: staff.classes_assigned,
      must_change_password: staff.must_change_password,
    }
  });
});