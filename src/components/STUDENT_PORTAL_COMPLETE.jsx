# STUDENT PORTAL - COMPLETE SYSTEM EXPLANATION

**Documentation Date:** 2026-02-26  
**Scope:** Student authentication, modules, automations, notifications

---

## STUDENT LOGIN FLOW

**Entry Point:** `pages/StudentLogin`

1. Student enters username (or student_id) + password
2. System queries `Student` entity: `filter({ username, password })`
3. If found → Store session in localStorage: `student_session = { student_id, name, class_name, section, academic_year }`
4. Redirected to `StudentDashboard`
5. All subsequent pages check localStorage for session
6. If accessing staff pages → Redirected back to StudentDashboard
7. Layout uses StudentBottomNav instead of staff nav bar

---

## MODULE: STUDENT DASHBOARD

**Access:** Students only (via student_session)

**Data Visible:**
- School logo + name (from SchoolProfile)
- Welcome message with student name
- Latest diary entry (from Diary where class_name = student.class_name)
- Upcoming events (from CalendarEvent)
- Quick access buttons: Notices, Gallery, Calendar, Diary, Results, Quiz

**Real-Time Updates:**
- Latest diary: Refetches every 60 seconds
- Notices count: Via StudentBottomNav badge

---

## MODULE: STUDENT NOTICES

**Access:** All students

**Data Filter:**
```
target_audience IN ["All", "Students"]
AND target_classes = [] (all) OR target_classes contains student.class_name
AND academic_year = student.academic_year
AND status = "Published"
```

**Actions:**
- View notice details
- Mark as read (automatic on tap)
- Download attachments

**When Marked as Read:**
1. Linked Notification marked `is_read: true`
2. Badge count updates in StudentBottomNav

**Automations Triggered:**
- When admin/teacher publishes notice:
  - Automation: `notifyStudentsOnNoticePublish` (backend)
  - Creates Notification for each student
  - Sends push notification

**Notifications Created:**
- Type: `notice_posted`
- Title: "New Notice: [Title]"
- Message: "[Notice Type] published"
- Recipient: Each student in target class

**Badge Updates:**
- StudentBottomNav: Unread notice count

**Push Notifications:**
- Message: "[Notice Type]: [Title]"
- Condition: StudentNotificationPreference.browser_push_enabled = true

---

## MODULE: STUDENT DIARY

**Access:** All students

**Data Filter:**
```
class_name = student.class_name
AND section = student.section
AND academic_year = student.academic_year
AND status = "Published"
Order by: created_date DESC
```

**Actions:**
- View diary entry
- Download attachments
- Mark as read (automatic on tap)

**When Viewed & Marked Read:**
1. Notification marked is_read = true
2. Unread diary count decreases

**Automations Triggered:**
- When teacher publishes diary:
  - Automation: `notifyStudentsOnDiaryPublish` (backend)
  - Creates Notification for each student in class
  - Sends push notification

**Notifications Created:**
- Type: `diary_published`
- Title: "New Diary: [Title]"
- Message: "[Teacher Name] posted a diary entry"
- Recipient: Each student in class

**Badge Updates:**
- StudentBottomNav: Unread diary count increases

**Push Notifications:**
- Message: "New Diary: [Title]"
- Tap → Opens Diary page

---

## MODULE: STUDENT HOMEWORK

**Access:** All students

**Data Filter:**
```
class_name = student.class_name
AND section = student.section
AND academic_year = student.academic_year
AND status IN ["Published", "InProgress"]
Order by: due_date ASC
```

**Actions:**
1. View homework details (subject, title, due date)
2. Submit homework:
   - Opens modal
   - Student selects file
   - File uploaded via uploadPhotoRecord
   - Creates HomeworkSubmission with submission_date
   - Status changes to "Submitted"

**When Submitted:**
1. HomeworkSubmission created
2. Teacher receives notification: `homework_submitted`
3. Teacher gets push notification

**Automations Triggered:**
- When student submits:
  - (Currently no explicit automation - could add)
  - Teacher notified via backend

**Notifications Created:**
- Type: `homework_submitted` (to teacher)
- Title: "[Student] submitted homework"
- Recipient: Teacher

**Badge Updates:** None for student

**Push Notifications:** None for student (teacher receives)

---

## MODULE: STUDENT QUIZ

**Access:** All students

**Data Filter:**
```
class_name = student.class_name
AND status = "Published"
AND academic_year = student.academic_year
Order by: quiz_date DESC
```

**Actions:**
1. View available quizzes
2. Attempt quiz (only once):
   - Opens modal
   - Student answers MCQ/Descriptive questions
   - Student submits
   - MCQ auto-scored, Descriptive marked for teacher grading
   - Creates QuizAttempt entity
   - Score calculated and displayed

**When Submitted:**
1. QuizAttempt created with answers + score
2. Notification sent to teacher: `quiz_submitted`
3. Teacher receives push notification

**Automations Triggered:**
- When student submits quiz:
  - Automation: `notifyStudentsOnQuizSubmission` (backend)
  - Creates Notification for teacher
  - Sends push notification to teacher

**Notifications Created:**
- Type: `quiz_submitted` (to teacher)
- Title: "[Student Name] submitted quiz: [Title]"
- Recipient: Teacher
- Related: QuizAttempt ID

**Badge Updates:** None for student

**Push Notifications:** None for student (teacher receives)

---

## MODULE: STUDENT RESULTS/MARKS

**Access:** All students

**Data Filter:**
```
student_id = current_student.student_id
AND status = "Published"
AND academic_year = current_academic_year
Order by: exam_type, subject
```

**Data Visible:**
- Subject, exam type (Summative/Formative Assessment)
- Marks obtained, max marks, grade
- Percentage, pass/fail
- Teacher remarks

**Actions:**
- View marks (read-only)
- No editing possible

**When Marks Published:**
1. Notification created: `marks_published`
2. Push notification sent
3. Badge updated in StudentBottomNav (Results tab)

**Automations Triggered:**
- Admin publishes marks:
  - Automation: `notifyStudentsOnMarksPublish` (backend)
  - Creates Notification for each student
  - Sends push notification

**Notifications Created:**
- Type: `marks_published`
- Title: "Results Published"
- Message: "Your marks for [Exam] have been published"
- Recipient: Each student

**Badge Updates:**
- StudentBottomNav: "Results" tab shows unread marks count

**Push Notifications:**
- Message: "Results Published - [Exam Name]"
- Condition: StudentNotificationPreference.browser_push_enabled = true

---

## MODULE: STUDENT GALLERY

**Access:** All students

**Data Filter:**
```
visibility contains "Students & Parents" OR "Public"
AND status = "Published"
Order by: event_date DESC
```

**Data Visible:**
- Album name, event date, cover photo
- All photos in album with captions
- Photo count

**Actions:**
- Browse albums
- View photos
- No uploads (read-only)

**Automations:** None

**Notifications:** None

**Badge Updates:** None

---

## MODULE: STUDENT CALENDAR

**Access:** All students

**Data Filter:**
```
status = "Published"
AND (target_audience contains "All" OR "Students")
Order by: start_date ASC
```

**Data Visible:**
- Event type (Holiday, Exam, PTM, Event)
- Title, description, start/end dates
- All-day flag

**Actions:**
- View calendar grid
- Tap event for details
- No editing

**Automations:** None

**Notifications:** None (system doesn't auto-notify on calendar view)

---

## MODULE: STUDENT MESSAGING

**Access:** All students

**Inbox Filter:**
```
recipient_type IN ["individual", "class"]
AND recipient_id = student_id OR recipient_class = student.class_name
AND academic_year = student.academic_year
Order by: created_date DESC
```

**Data Visible:**
- Sender name, role
- Message subject, body
- Unread status
- Thread ID (if reply)

**Actions:**
1. View message → Mark as read (automatic)
2. Reply to message:
   - Opens reply modal
   - Student types message
   - Student sends
   - Creates new Message with parent_message_id + thread_id
3. Cannot send to class (only individual teacher)

**When Message Marked as Read:**
1. Message.is_read = true
2. Linked Notification.is_read = true
3. Badge count decreases

**When Student Sends Reply:**
1. Message created with:
   - sender_id = student_id
   - sender_role = "student"
   - recipient_id = teacher email
   - recipient_type = "individual"
   - thread_id = same as original
2. Notification created: `student_message` (to teacher)
3. Teacher receives push notification

**Automations Triggered:**
- Student sends message:
  - Automation: `notifyStaffOnStudentMessage` (backend)
  - Creates Notification in staff inbox
  - Sends push notification to teacher

**Notifications Created:**
- Type: `student_message` (to teacher)
- Title: "[Student Name] sent a message"
- Recipient: Teacher/Staff

**Badge Updates:**
- StudentBottomNav: "More" tab shows message badge

**Push Notifications:**
- Teacher receives: "[Student Name]: [Message preview]"

---

## MODULE: STUDENT NOTIFICATIONS PAGE

**Access:** All students

**Data Filter:**
```
recipient_student_id = student_id
AND academic_year = student.academic_year
Order by: created_date DESC (unread first)
```

**Notification Types Visible:**
- `diary_published` - New diary
- `homework_assigned` - New homework
- `quiz_posted` - New quiz
- `notice_posted` - New notice
- `marks_published` - Results published
- `student_message` - Message from teacher
- `attendance_alert` - Attendance warning (if system sends)

**Actions:**
1. Tap notification → Navigate to related entity
2. Auto-marks as read on tap
3. Delete notification (swipe/button)

**Weekly Cleanup Automation:**
- Scheduled: Every Monday 2 AM UTC (7:30 AM IST)
- Deletes: Read notifications older than 90 days
- Excludes:
  - Unread notifications (never deleted)
  - Current academic year (always preserved)
- Safety check: Only deletes if count > 1000 (prevents accidental mass delete)

---

## MODULE: STUDENT PROFILE

**Access:** Students

**Data Visible:**
- Name, student ID, photo
- Class, section, roll number
- Parent name, phone, email
- DOB, gender, blood group
- Address, admission date
- Enrollment status

**Actions:**
- View profile (read-only)
- Change password

**Automations:** None

---

## REAL-TIME SUBSCRIPTIONS FOR STUDENTS

```javascript
// Notifications
base44.entities.Notification.subscribe((event) => {
  if (event.type === 'create') {
    // New notification received
    // Badge count increases
    // May trigger push notification
  } else if (event.type === 'update') {
    // Notification marked as read
    // Badge count decreases
  } else if (event.type === 'delete') {
    // Notification deleted
    // Badge count decreases
  }
})

// Messages
base44.entities.Message.subscribe((event) => {
  if (event.type === 'create') {
    // New message received
    // Thread updates
    // Badge increases
  }
})
```

---

## DATA RESTRICTIONS FOR STUDENTS

### Academic Year Isolation
```
Query filter: academic_year = student.academic_year
Cannot access previous/future year records
Cannot change academic year (follows school setting)
```

### Class Isolation
```
Query filter: class_name = student.class_name AND section = student.section
Cannot see data from other classes
Cannot see other students' marks/results/homework
```

### Role-Based Access
```
UI blocks access to staff pages
If trying to access teacher/admin page → Redirected to StudentDashboard
Student session required for all student pages
```

### Content Visibility
```
- Notices: Only published + target audience includes students/all + for their class
- Diary: Only published + for their class
- Homework: Only published/InProgress + for their class  
- Quiz: Only published + for their class
- Results: Only published + for current student + current year
- Gallery: Only published + visibility includes students & parents/public
- Messages: Only sent to them or their class
```

---

## BADGE SYSTEM FOR STUDENTS

| Badge | Trigger | Location | Clears When |
|---|---|---|---|
| Unread Notices | Notice published to class | StudentBottomNav "Notices" | Marked as read |
| Unread Diary | Diary published to class | StudentBottomNav "Diary" | Marked as read |
| Unread Results | Marks published | StudentBottomNav "Results" | Marked as read |
| Unread Messages | Message received | StudentBottomNav "More" | Marked as read |
| Unread Notifications | Any notification created | StudentBottomNav "More" | Marked as read |

---

## PUSH NOTIFICATIONS FOR STUDENTS

| Event | Message | Condition |
|---|---|---|
| Notice published | "[Type]: [Title]" | browser_push_enabled = true |
| Diary published | "New Diary: [Title]" | browser_push_enabled = true |
| Marks published | "Results Published - [Exam]" | browser_push_enabled = true |
| Message from teacher | "[Teacher]: [Preview]" | browser_push_enabled = true |
| Homework assigned | "[Subject] Homework Due" | (if automated) |
| Quiz published | "New Quiz: [Title]" | (if automated) |

---

**All student modules documented and production-ready.**