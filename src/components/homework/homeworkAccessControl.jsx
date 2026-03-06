/**
 * Homework Access Control Helper
 * Enforces ERP-grade role-based access:
 * - Admin/Principal: view all homework
 * - Teacher/Staff: view only own homework (assigned_by match)
 */

/**
 * Check if user is admin/principal (can see all homework)
 */
export const isHomeworkAdmin = (user) => {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  return role === 'admin' || role === 'principal';
};

/**
 * Check if user can VIEW a specific homework
 * - Admin/Principal: always true
 * - Teacher: only if homework.assigned_by === user.name
 */
export const canViewHomework = (homework, user) => {
  if (!homework || !user) return false;
  
  // Admin/Principal can view all
  if (isHomeworkAdmin(user)) return true;
  
  // Teacher/Staff can view only own
  return homework.assigned_by === user.name;
};

/**
 * Check if user can MANAGE (grade/request revision/delete/edit) a homework
 * Same rule as canViewHomework for now (can be extended if needed)
 */
export const canManageHomework = (homework, user) => {
  return canViewHomework(homework, user);
};

/**
 * Filter homework list by user access
 * Returns only homework user can access
 */
export const filterHomeworkByAccess = (homeworkList, user) => {
  if (!user || !homeworkList) return [];
  
  // Admin/Principal see all
  if (isHomeworkAdmin(user)) return homeworkList;
  
  // Teacher/Staff see only own
  return homeworkList.filter(hw => hw.assigned_by === user.name);
};

/**
 * Build base filter for homework queries
 * Use this for list queries to restrict at query level
 */
export const getHomeworkQueryFilter = (user, baseFilter = {}) => {
  const filter = { ...baseFilter };
  
  // If not admin, restrict to own homework
  if (user && !isHomeworkAdmin(user)) {
    filter.assigned_by = user.name;
  }
  
  return filter;
};