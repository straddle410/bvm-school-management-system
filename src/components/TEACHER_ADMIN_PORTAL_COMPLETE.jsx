# TEACHER & ADMIN PORTAL - COMPLETE SYSTEM EXPLANATION

**Documentation Date:** 2026-02-26  
**Scope:** Teacher/Admin authentication, modules, automations, permissions

---

# TEACHER/ADMIN AUTHENTICATION

## Login Flow

**Entry Point:** `pages/StaffLogin`

1. Staff enters username + password
2. System queries StaffAccount: `filter({ username, password, is_active: true })`
3. If found:
   - Call `base44.users.inviteUser(email, role)` to activate on platform
   - Redirected to Dashboard
4. If `enable_otp_login = true`:
   - After password verification, generate OTP
   - Send OTP via email (Resend API)
   - Staff enters OTP to complete login
   - Prevents unauthorized access even with password

**Session:** Standard Base44 platform auth (JWT in cookies)

**Post-Login Landing:** Dashboard (filters shown by role)

---

## PERMISSION SYSTEM

### Permission Object Structure
```javascript
permissions: {
  attendance: boolean,
  attendance_needs_approval: boolean,
  marks: boolean,
  marks_needs_approval: boolean,
  post_notices: boolean,
  notices_needs_approval: boolean,
  gallery: boolean,
  gallery_needs_approval: boolean,
  quiz: boolean,
  quiz_needs_approval: boolean,
  manage_holidays: boolean,
  override_holidays: boolean
}

// Examples:
// Teacher (can enter marks, must wait for approval):
// { marks: true, marks_needs_approval: true, ... }

// Admin (can do everything, no approval needed):
// { marks: true, marks_needs_approval: false, ... all: true }
```

### How Permissions Work

**At Submission:**
```javascript
if (permissions.marks_needs_approval === true) {
  Status = "Submitted" (wait for admin approval)
} else {
  Status = "Published" (auto-publish)
  → Trigger notifications immediately
}
```

**Dashboard:**
```javascript
if (permissions.marks) {
  Show Marks Entry button
}
if (permissions.marks_needs_approval) {
  Show Pending Marks Approvals card
}
```

---

# TEACHER DASHBOARD

**Access:** Teachers (role not admin)

**Data Visible:**
- School logo + name
- Welcome message with teacher name
- Classes assigned (from StaffAccount.classes_assigned)
- Quick action buttons (filtered by permissions):
  - Marks Entry (if permissions.marks = true)
  - Attendance (if permissions.attendance = true)
  - Notices (if permissions.post_notices = true)
  - Diary, Homework, Quiz (if have classes)
  - Gallery (if permissions.gallery = true)
  - Messages (always)
- Pending approvals (if *_needs_approval flags are false, auto-publish immediately)
- Recent notifications (last 10)
- Unread badge counts

**Real-Time Updates:**
- Pending approval counts update every 30 seconds
- OR real-time subscription to entity changes

---

# ADMIN DASHBOARD

**Access:** Staff with role="admin"

**Data Visible:**
- School logo + name
- Quick statistics:
  - Total students (current year)
  - Total staff, total classes
  - Pending approvals by type
- Pending items:
  - Marks submissions
  - Attendance submissions
  - Notices awaiting approval
  - Gallery photos awaiting approval
  - Quiz awaiting approval
- Recent notifications
- Unread message count
- Academic year selector + ability to change
- Quick links to management pages

---

---

# MODULE: MARKS ENTRY (TEACHER)

**Access:** Teachers with `permissions.marks = true`

**Classes Visible:**
- Own assigned classes (from StaffAccount.classes_assigned)
- Subjects taught (from StaffAccount.subjects)

**Workflow:**

1. **Select Class/Section/Exam**
   - Class dropdown: filtered to own classes
   - Section dropdown: filtered to sections for class
   - Exam type dropdown: all exam types for current academic year
   
2. **Load Subjects**
   ```javascript
   // Priority order:
   1. Get timetable entries for (class, exam_type)
   2. If found: Extract subject names
   3. If not found: Fallback to all subjects
   4. Display subject list
   ```
   - Optimization: subjectList computed ONCE before mutation (NOT inside loop)

3. **For Each Subject:**
   - Display all students in class
   - Enter marks_obtained for each student
   - System auto-calculates grade based on marking scheme
   - Display max_marks and passing_marks (from ExamType)

4. **Save Workflow:**
   - Click "Save Marks" → Status = "Draft"
   - Can edit draft marks
   - Click "Submit Marks" → Status = "Submitted"
   - If permissions.marks_needs_approval = true:
     - Wait for admin approval
   - If permissions.marks_needs_approval = false:
     - Auto-publish → Status = "Published"
     - Trigger: notifyStudentsOnMarksPublish

**When Marks Published:**

1. Automation: `notifyStudentsOnMarksPublish` (backend)
2. Create Notification for each student:
   - Type: `marks_published`
   - Title: "Results Published"
   - Message: "Your marks for [Exam] have been published"
   - Recipient: Each student
3. Send push notification:
   - Message: "Results Published - [Exam Name]"
   - Condition: StudentNotificationPreference.browser_push_enabled = true
4. Badge updates:
   - Students: Results badge count increases

**Performance Optimization:**
```javascript
// BEFORE: Exam type lookup inside loop (O(n) × O(n) = O(n²))
for each student {
  for each subject {
    const selectedExamObj = examTypes.find(e => e.name === selectedExam); // ← Redundant
    const data = { exam_type: selectedExamObj?.id };
  }
}

// AFTER: Exam type lookup cached before loop (O(n))
const selectedExamType = examTypes.find(e => e.name === selectedExam); // ← Computed once
for each student {
  for each subject {
    const data = { exam_type: selectedExamType?.id }; // ← Reuse
  }
}
```

**Data Restrictions:**
- Only own classes/subjects
- Only current academic year
- Cannot edit published marks

---

# MODULE: MARKS APPROVAL (ADMIN)

**Access:** Admin only

**Data Visible:**
```
All pending marks
Filter: status IN ["Submitted", "Verified"]
        AND academic_year = selected_academic_year
```

**Actions:**
1. View all pending marks (class, subject, teacher)
2. Click class → View marks entry table
3. Approve marks:
   - Click "Approve" → Status = "Approved"
4. Publish marks:
   - Click "Publish" → Status = "Published"
   - Trigger: notifyStudentsOnMarksPublish automation

**Automations Triggered:**
- When status = "Published":
  - Backend: notifyStudentsOnMarksPublish
  - Creates Notification for each student
  - Sends push notification

**Badge Updates:**
- Students: Results badge increases

---

# MODULE: ATTENDANCE (TEACHER)

**Access:** Teachers with `permissions.attendance = true`

**Classes Visible:**
- Own assigned classes only

**Workflow:**

1. **Select Date/Class/Section**
   - Date: Today or any date in current academic year
   - Class: Own classes only
   - Section: Sections for selected class

2. **Load Students**
   - Query: Student where class_name=X, section=X, academic_year=current
   - Display list of all students

3. **Check Holiday Status**
   - Query: Holiday where date=selected_date, academic_year=current
   - If holiday exists:
     - All students marked as absent (is_holiday=true, is_present=false)
   - If not holiday:
     - Allow teacher to mark each student present/absent

4. **Save Workflow:**
   - Click "Save Attendance" → Status = "Taken"
   - Can edit before submission
   - Click "Submit Attendance" → Status = "Submitted"
   - If permissions.attendance_needs_approval = true:
     - Wait for admin approval
   - If permissions.attendance_needs_approval = false:
     - Auto-publish → Status = "Published"

**Holiday Override:**
- If `permissions.override_holidays = true`:
  - Admin can mark day as "not a holiday"
  - Creates HolidayOverride entity
  - Allows teachers to mark normal attendance on holiday

**Data Restrictions:**
- Own classes only
- Current academic year only
- Cannot modify published attendance
- Cannot mark future dates

---

# MODULE: ATTENDANCE (ADMIN)

**Access:** Admin only

**Classes Visible:**
- ALL classes (not restricted)

**Additional Actions:**

1. **Mark Holiday for Date Range:**
   - Select start/end dates
   - Enter reason
   - Click "Apply Holiday to Range"
   
2. **Optimization: Batch Holiday Creation**
   ```javascript
   // BEFORE: Sequential (slow)
   for (let i = 0; i < days.length; i++) {
     const day = days[i];
     // ... check existing ...
     await base44.entities.Holiday.create({...}); // ← 30 API calls for 30 days
   }
   
   // AFTER: Batch (fast)
   const holidaysToCreate = [];
   for (let i = 0; i < days.length; i++) {
     const day = days[i];
     // ... check existing ...
     if (!exists) {
       holidaysToCreate.push({...}); // Collect
     }
   }
   await base44.entities.Holiday.bulkCreate(holidaysToCreate); // ← 1 API call
   ```

3. **Workflow:**
   - For each day in range: Check if Holiday exists for (date, academicYear)
   - Collect all new holidays
   - Batch create via bulkCreate()
   - Progress bar: 0-50% checking, 50-100% batch creating
   - Time: 30-day holiday takes 2-3 seconds (was 60+ seconds)

4. **Holiday Override:**
   - Select holiday date
   - Click "Remove Holiday Override"
   - Allows teachers to mark attendance even on holiday

5. **Remove Holiday:**
   - Delete Holiday entity
   - Allows attendance marking for that day

**Data Isolation (CRITICAL):**
```javascript
// BEFORE FIX: No validation
saveMutation.mutationFn: () => {
  const data = { academic_year: academicYear }; // Could be null!
  // Creates record with null academic_year → Data isolation broken
}

// AFTER FIX: Strict validation
saveMutation.mutationFn: () => {
  if (!academicYear) throw new Error('Academic year not configured');
  const data = { academic_year: academicYear }; // Guaranteed to have value
}

// Same for bulk holiday creation
```

---

# MODULE: DIARY (TEACHER)

**Access:** All teachers

**Actions:**

1. **Create Diary:**
   - Select class
   - Title, content
   - Attachments (homework, notes, resources)
   - Status = "Draft"

2. **Edit Draft:**
   - Update content, attachments
   - Status remains "Draft"

3. **Publish Diary:**
   - Status = "Published"
   - Trigger: notifyStudentsOnDiaryPublish automation

**When Diary Published:**

1. Automation: `notifyStudentsOnDiaryPublish` (backend)
2. Create Notification for each student in class:
   - Type: `diary_published`
   - Title: "New Diary: [Title]"
   - Message: "[Teacher Name] posted a diary entry"
   - Recipient: Each student in class
3. Send push notification:
   - Message: "New Diary: [Title]"
   - Tap → Opens Diary page
4. Badge updates:
   - Students: Unread diary count increases

**Data Restrictions:**
- Only diary for own classes
- Current academic year only

---

# MODULE: HOMEWORK (TEACHER)

**Access:** All teachers

**Actions:**

1. **Create Homework:**
   - Select class, subject
   - Title, description
   - Due date, submission deadline
   - Attachments (problem statement, resources)
   - Status = "Draft"

2. **Publish Homework:**
   - Status = "Published"
   - (No automation currently - could notify students)

3. **View Submissions:**
   - Each student: Submitted or Not
   - View submitted file
   - Grade submission (optional)

4. **Mark as Evaluated:**
   - Status = "Evaluated"

**When Student Submits:**

1. HomeworkSubmission created
2. Teacher receives notification (if system sends)
3. Teacher can grade and update HomeworkSubmission

---

# MODULE: QUIZ (TEACHER)

**Access:** Teachers with `permissions.quiz = true`

**Actions:**

1. **Create Quiz:**
   - Select class, subject
   - Title, quiz date
   - Add questions:
     - MCQ: Add options, select correct answer
     - Descriptive: Open-ended
   - Status = "Draft"

2. **Publish Quiz:**
   - Status = "Published"
   - Students can now attempt

3. **View Attempts:**
   - Each student: Attempted or Not
   - View answers
   - Score:
     - MCQ: Auto-calculated
     - Descriptive: Show for manual grading

4. **Grade Descriptive:**
   - View answer
   - Enter grade
   - Update QuizAttempt

**When Student Submits:**

1. QuizAttempt created with answers
2. MCQ auto-scored
3. Notification to teacher: `quiz_submitted`
4. Push notification to teacher

**Automations Triggered:**
- Student submits quiz:
  - Automation: notifyStudentsOnQuizSubmission (if exists)
  - Creates Notification for teacher
  - Sends push notification

**Badge Updates:**
- Teacher: Unread quiz submission count

---

# MODULE: NOTICES (TEACHER)

**Access:** Teachers with `permissions.post_notices = true`

**Actions:**

1. **Create Notice:**
   - Title, content
   - Type (General/Exam/Holiday/PTM/Fee/Urgent/Event)
   - Target audience: All / Students / Parents / Staff / Teachers
   - Target classes (if Students selected) - optional
   - Publish date, expiry date
   - Attachment (optional)
   - Status = "Draft"

2. **Submit Notice:**
   - Status = "Submitted"
   - If permissions.notices_needs_approval = true:
     - Wait for admin approval
   - If permissions.notices_needs_approval = false:
     - Auto-publish (status = "Published")

3. **Publish Notice (if approved):**
   - Status = "Published"
   - Trigger: notifyStudentsOnNoticePublish or notifyStaffOnNoticePublish

**When Notice Published:**

1. **If target_audience includes "Students":**
   - Automation: notifyStudentsOnNoticePublish
   - Create Notification for each student in target classes
   - Send push notification

2. **If target_audience includes "Staff" or "Teachers":**
   - Automation: notifyStaffOnNoticePublish
   - Create Notification for staff
   - Send push notification

**Notifications Created:**
- Type: `notice_posted`
- Title: "[Notice Title]"
- Message: "New [Type] notice published"
- Recipient: Each student/staff

**Badge Updates:**
- Students: Unread notice count increases

**Push Notifications:**
- Students: "[Type]: [Title]"
- Staff: "[Type]: [Title]"

---

# MODULE: GALLERY (TEACHER)

**Access:** Teachers with `permissions.gallery = true`

**Actions:**

1. **Create Album:**
   - Name, description, event date
   - Visibility: Public / Staff Only / Students & Parents (multi-select)
   - Status = "Draft"

2. **Upload Photos:**
   - Each photo validated (size, format)
   - Photo stored in GalleryPhoto with status = "Pending"
   - Compressed to optimize storage

3. **Approve/Reject:**
   - If permissions.gallery_needs_approval = true:
     - Photos wait for admin approval
   - If permissions.gallery_needs_approval = false:
     - Photos auto-publish

4. **Publish Album:**
   - Status = "Published"

**Data Restrictions:**
- Only albums created by teacher
- Only upload if in upload_permission list

---

# MODULE: MESSAGES (TEACHER)

**Access:** All teachers

**Inbox Filter:**
```
recipient_type = "individual" AND recipient_id = teacher.email
OR recipient_type = "class" AND recipient_class IN [classes_assigned]
AND academic_year = current_year
Order by: created_date DESC
```

**Actions:**

1. **View Messages:**
   - List of inbox messages
   - Tap → View thread (replies to same message)

2. **Reply to Message:**
   - Type message
   - Send
   - Creates new Message with parent_message_id + thread_id

3. **Send Class Message:**
   - Select class
   - Type message
   - Send
   - Creates Message with recipient_type="class"
   - Creates Notification for each student in class

4. **Send Individual Message:**
   - Select recipient (student or staff)
   - Type message
   - Creates Message with recipient_type="individual"

**When Teacher Sends Message:**

1. Message created
2. If to class:
   - Notification created for each student
   - Type: `class_message`
3. If to student:
   - Notification created
   - Type: `student_message` (from teacher)
4. If to staff:
   - Notification created
   - Type: `staff_message`

**Badge Updates:**
- Recipient: Unread message count increases

**Push Notifications:**
- Student receives: "[Teacher Name]: [Preview]"
- Staff receives: "[Sender Name]: [Preview]"

---

---

# ADMIN MODULES

---

# MODULE: MARKS REVIEW & APPROVAL (ADMIN)

**Access:** Admin only

**Data Visible:**
```
All pending marks
Filter: status IN ["Submitted", "Verified"]
        AND academic_year = selected_academic_year
```

**Actions:**
1. View pending marks grouped by class/teacher/exam
2. Click class → View marks entry table
3. Approve marks → Status = "Approved"
4. Publish marks → Status = "Published"
   - Trigger: notifyStudentsOnMarksPublish

---

# MODULE: ATTENDANCE REVIEW (ADMIN)

**Access:** Admin only

**Same as Teacher Attendance + Additional:**
1. Mark attendance for ANY class (not just assigned)
2. Mark holiday for date range with optimization
3. Remove holidays
4. Holiday overrides

---

# MODULE: APPROVALS (ADMIN)

**Access:** Admin only

**Data Visible:**
- Marks submissions (status = "Submitted")
- Attendance submissions (status = "Submitted")
- Notices (status = "Submitted")
- Gallery photos (status = "Pending")
- Quiz (status = "Submitted")

**Actions:**
1. Approve item → Status = "Approved"
2. Publish item → Status = "Published"
   - Triggers automations (notifications)
3. Reject item → Back to Draft

---

# MODULE: STUDENT MANAGEMENT (ADMIN)

**Access:** Admin only

**Actions:**

1. **Create Student:**
   - Fill form
   - Auto-generate student_id, username, password
   - Status = "Pending"

2. **Verify Student:**
   - Status = "Verified"
   - verified_by = admin.email

3. **Approve Student:**
   - Status = "Approved"
   - approved_by = admin.email

4. **Publish Student:**
   - Status = "Published"
   - Student now visible to system

5. **Bulk Import:**
   - Upload Excel file
   - Parse: Name, DOB, gender, class, parent info
   - Create multiple Student records at once
   - Auto-generate credentials

6. **Promote Students (End of Year):**
   - Select class
   - Set next class
   - For each student: Create new Student record for next class
   - Set academic_year = next year
   - Old record remains (archive)

---

# MODULE: STAFF MANAGEMENT (ADMIN)

**Access:** Admin only

**Actions:**

1. **Create Staff Account:**
   - Fill form: Name, email, role, subjects, classes
   - Set temp_password
   - Set permissions object (granular feature access)
   - Set enable_otp_login flag
   - Status = "Active"

2. **Send Platform Invite:**
   - Call base44.users.inviteUser(email, role)
   - Creates User entity on platform
   - Staff can now log in
   - platform_invite_sent = true

3. **Edit Staff:**
   - Update details
   - Update permissions (granular control)

4. **Manage OTP:**
   - Generate OTP code
   - Set otp_generated_at timestamp
   - Send OTP via email
   - Staff enters OTP on login

5. **Deactivate Staff:**
   - Set is_active = false
   - Staff cannot log in

---

# MODULE: HOLIDAY CALENDAR (ADMIN)

**Access:** Admin only

**Actions:**

1. **Mark Single Holiday:**
   - Select date
   - Enter reason
   - Create Holiday entity

2. **Mark Holiday Range:**
   - Select start/end dates
   - Batch create all holidays
   - Progress: 0-50% checking, 50-100% creating

3. **Remove Holiday:**
   - Delete Holiday entity

4. **Override Holiday:**
   - Create HolidayOverride entity
   - Allows attendance marking on holiday

---

# MODULE: NOTIFICATIONS MANAGEMENT (ADMIN)

**Access:** Admin only

**Data Visible:**
```
All notifications (not filtered by recipient)
Filter by: type, recipient, date, status
```

**Actions:**

1. **View All Notifications:**
   - Grouped by type/recipient
   - Filter and search

2. **Manual Cleanup Trigger:**
   - Click "Cleanup Old Notifications"
   - Confirmation dialog
   - Deletes read notifications 90+ days old
   - Only if count > 1000 (safety threshold)

**Weekly Scheduled Cleanup Automation:**
```javascript
Schedule: Every Monday 2 AM UTC (7:30 AM IST)

1. Check count of deletable notifications:
   WHERE is_read = true
     AND created_date < 90 days ago
     AND academic_year != current_academic_year

2. Safety check: Only proceed if count > 1000

3. Delete the notifications

4. Log action (if audit enabled)

5. Return: { deleted_count, status: "success" }

SAFEGUARDS:
- Never delete unread notifications
- Never delete current academic year
- Only delete if threshold > 1000
```

---

# MODULE: REPORTS (ADMIN)

**Access:** Admin only

**Available Reports:**

1. **Attendance Summary:**
   - Filter by class, date range
   - Export to PDF/Excel

2. **Marks Analysis:**
   - Filter by exam, class
   - Show class average, pass rate, grade distribution
   - Export to PDF/Excel

3. **Student Performance:**
   - Individual student report
   - Show attendance, marks, grade trend
   - Export to PDF

4. **Class-wise Statistics:**
   - Overall class performance
   - Export data

---

# REAL-TIME UPDATES (TEACHER/ADMIN)

```javascript
// Marks
base44.entities.Marks.subscribe((event) => {
  if (event.type === 'create') {
    // New submission appeared in pending list
  } else if (event.type === 'update' && event.data.status === 'Published') {
    // Marks just published
    // Notifications created
  }
})

// Notifications
base44.entities.Notification.subscribe((event) => {
  if (event.type === 'create') {
    // New notification received
    // Badge count increases
  }
})

// Dashboard
- Pending approval counts refresh every 30 seconds
- OR real-time subscription
```

---

# DATA ISOLATION FOR TEACHER/ADMIN

### Academic Year Isolation
```
ALL queries filter by: academic_year = selected_academic_year
Cannot access records from other years without explicitly changing year
Admin can change academic year context
```

### Class Isolation (Teacher)
```
Teacher sees only own classes:
WHERE class_name IN [teacher.classes_assigned]

Admin sees all classes (no restriction)
```

### Role Isolation
```
Teacher cannot:
- Access admin pages
- Manage other teachers
- Create/edit staff
- Approve items (depends on permission)

Admin can:
- Access all pages
- Manage everything
- Override any restrictions
```

---

**Complete teacher/admin portal documented. Production-ready.**