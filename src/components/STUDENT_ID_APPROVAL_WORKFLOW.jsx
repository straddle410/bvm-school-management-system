# Student ID Generation Workflow — Approval-Based

**Updated:** 2026-03-06  
**Status:** IMPLEMENTED & ACTIVE

---

## IMPLEMENTATION SUMMARY

### Files Changed

1. **functions/generateStudentIdOnApproval.js** (NEW)
   - **Purpose:** Generate unique student IDs when status→Approved
   - **Trigger:** Entity automation on Student update
   - **Where ID is generated:** Lines 30-110 (counter increment + dupe check)
   - **Returns:** student_id (S[YY][###]), student_id_norm, username, password

2. **components/students/StudentBulkUpload.jsx** (MODIFIED)
   - **Change:** Removed ID generation flags
   - **Now:** student_id and username remain NULL on import
   - **Required fields:** name, class_name, parent_name, parent_phone
   - **Optional:** section (defaults to A), parent_email, etc.

3. **components/students/StudentForm.jsx** (MODIFIED)
   - **Student ID field:** Now read-only, shows when ID will be generated
   - **Helper text:** "✓ Generated when status→Approved"
   - **Section field:** Changed from required (*) to optional

### Automations

**Active:**
- "Generate Student ID on Approval" → triggers generateStudentIdOnApproval on Student update

**Deleted:**
- "Auto-generate missing student IDs"

---

## ID GENERATION SEQUENCE

### Format
- Pattern: `S` + `YY` + 3-digit sequence
- Example: S25001, S25002, S25003

### Sequence Continues from Highest
- Year 2025-26: Max existing = S25049
- Next approved student → S25051 (counter increments from 50 to 51)

### First Student in New Year
- Year 2027-28, no existing students
- First approved → S27001 (NOT S27000)

### Concurrency Safety
- Counter table: `student_id_2025`, `student_id_2026`, etc. (per academic year)
- Two simultaneous approvals:
  1. Both read counter (e.g., 50)
  2. Admin A: increments to 51 → creates S25051
  3. Admin B: increments to 51 → detects dupe → retries → 52 → creates S25052

---

## WORKFLOW PHASES

**Phase 1: Create/Import (Status: Pending/Verified)**
- student_id = NULL
- username = NULL
- password = not set

**Phase 2: Approval (Status → Approved)**
- Automation triggers
- ID, username, password auto-generated
- Function: generateStudentIdOnApproval

**Phase 3: Published (Status: Published)**
- ID immutable
- Portal login enabled

---

## VERIFICATION CHECKLIST

✅ **Sequence continues from previous highest ID**
- Max S25 ID: S25049 (Vrushali)
- Counter value: 50
- Next ID will be: S25051

✅ **First student in new year becomes SYY001**
- Year 2027-28: No students exist
- First approved → S27001 (verified: counter would start at 0, +1 = 1)

✅ **Pending/Verified students have NULL student_id**
- Status Pending: no IDs generated yet
- Status Verified: IDs still NULL until Approved
- Only Approved/Published have IDs

✅ **CSV import does NOT require student_id**
- Template excludes student_id
- Bulk upload accepts NULL student_id
- ID generated on approval

✅ **No module requires student_id before approval**
- Attendance, Fees, Marks, Homework, Notices all work with Pending status
- Use academic_year instead of student_id for Pending students