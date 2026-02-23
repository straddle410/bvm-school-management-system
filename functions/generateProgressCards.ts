import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { academicYear, classNameFilter, sectionFilter, examTypeIdOrName } = await req.json();

    if (!academicYear) {
      return Response.json({ error: 'Academic year is required' }, { status: 400 });
    }

    // Fetch published or approved marks with filters
    const marksFilter = {
      academic_year: academicYear
    };
    if (classNameFilter) marksFilter.class_name = classNameFilter;
    if (sectionFilter) marksFilter.section = sectionFilter;
    if (examTypeIdOrName) marksFilter.exam_type = examTypeIdOrName;

    const allMarks = await base44.asServiceRole.entities.Marks.filter(marksFilter);
    const publishedMarks = allMarks.filter(m => m.status === 'Published' || m.status === 'Approved');

    if (publishedMarks.length === 0) {
      return Response.json({ message: 'No approved or published marks found', cardsGenerated: 0 });
    }

    // Group by student and exam type
    const studentExamData = {};
    publishedMarks.forEach(mark => {
      const key = `${mark.student_id}__${mark.exam_type}`;
      if (!studentExamData[key]) {
        studentExamData[key] = {
          student_id: mark.student_id,
          student_name: mark.student_name,
          class_name: mark.class_name,
          section: mark.section,
          roll_number: mark.roll_number,
          exam_type: mark.exam_type,
          exam_name: mark.exam_type,
          subjects: [],
          total_marks: 0,
          max_marks: 0
        };
      }
      studentExamData[key].subjects.push({
        subject: mark.subject,
        marks_obtained: mark.marks_obtained,
        max_marks: mark.max_marks,
        grade: mark.grade
      });
      studentExamData[key].total_marks += mark.marks_obtained;
      studentExamData[key].max_marks += mark.max_marks;
    });

    // Get exam type names to display
    const examTypes = await base44.asServiceRole.entities.ExamType.list();
    const examTypeMap = {};
    examTypes.forEach(et => {
      examTypeMap[et.id] = et.name;
      examTypeMap[et.name] = et.name;
    });

    // Group by student to calculate ranks per exam
    const studentData = {};
    Object.values(studentExamData).forEach(examData => {
      if (!studentData[examData.student_id]) {
        studentData[examData.student_id] = {
          student_id: examData.student_id,
          student_name: examData.student_name,
          class_name: examData.class_name,
          section: examData.section,
          roll_number: examData.roll_number,
          exams: {}
        };
      }
      studentData[examData.student_id].exams[examData.exam_type] = examData;
    });

    // Calculate ranks for each exam type
    const examRanks = {};
    Object.values(studentExamData).forEach(examData => {
      const examKey = `${examData.exam_type}__${examData.class_name}__${examData.section}`;
      if (!examRanks[examKey]) examRanks[examKey] = [];
      examRanks[examKey].push({
        student_id: examData.student_id,
        total: examData.total_marks
      });
    });

    // Sort and assign ranks
    Object.keys(examRanks).forEach(key => {
      examRanks[key].sort((a, b) => b.total - a.total);
      examRanks[key] = examRanks[key].map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));
    });

    // Calculate overall statistics and generate progress cards
    const progressCards = [];
    Object.values(studentData).forEach(student => {
      const examPerformance = [];
      let totalMarksObtained = 0;
      let totalPossibleMarks = 0;

      Object.values(student.exams).forEach(examData => {
        const examKey = `${examData.exam_type}__${examData.class_name}__${examData.section}`;
        const rankData = examRanks[examKey].find(r => r.student_id === student.student_id);
        const percentage = (examData.total_marks / examData.max_marks) * 100;
        const grade = calculateGrade(percentage);

        examPerformance.push({
          exam_type: examData.exam_type,
          exam_name: examTypeMap[examData.exam_type] || examData.exam_type,
          total_marks: examData.total_marks,
          max_marks: examData.max_marks,
          percentage: Math.round(percentage * 100) / 100,
          rank: rankData?.rank || 0,
          grade: grade,
          subject_details: examData.subjects
        });

        totalMarksObtained += examData.total_marks;
        totalPossibleMarks += examData.max_marks;
      });

      const overallPercentage = totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0;
      const overallGrade = calculateGrade(overallPercentage);

      // Calculate overall rank
      const allStudentsTotal = Object.values(studentData).map(s => {
        let total = 0;
        Object.values(s.exams).forEach(e => (total += e.total_marks));
        return { student_id: s.student_id, total };
      });
      allStudentsTotal.sort((a, b) => b.total - a.total);
      const overallRank = allStudentsTotal.findIndex(s => s.student_id === student.student_id) + 1;

      progressCards.push({
        student_id: student.student_id,
        student_name: student.student_name,
        class_name: student.class_name,
        section: student.section,
        roll_number: student.roll_number,
        academic_year: academicYear,
        exam_performance: examPerformance,
        overall_stats: {
          total_marks_obtained: Math.round(totalMarksObtained * 100) / 100,
          total_possible_marks: totalPossibleMarks,
          overall_percentage: Math.round(overallPercentage * 100) / 100,
          overall_rank: overallRank,
          overall_grade: overallGrade
        },
        generated_at: new Date().toISOString(),
        status: 'Generated'
      });
    });

    // Clear existing cards for this class/section/year and recreate
    const existingCards = await base44.asServiceRole.entities.ProgressCard.filter({
      academic_year: academicYear,
      class_name: classNameFilter || undefined,
      section: sectionFilter || undefined
    });

    for (const card of existingCards) {
      if (!classNameFilter || card.class_name === classNameFilter) {
        if (!sectionFilter || card.section === sectionFilter) {
          await base44.asServiceRole.entities.ProgressCard.delete(card.id);
        }
      }
    }

    // Bulk create progress cards
    if (progressCards.length > 0) {
      await base44.asServiceRole.entities.ProgressCard.bulkCreate(progressCards);
    }

    return Response.json({
      message: `Generated progress cards for ${progressCards.length} students`,
      cardsGenerated: progressCards.length
    });
  } catch (error) {
    console.error('Progress card generation error:', error);
    return Response.json(
      { error: error.message || 'Failed to generate progress cards' },
      { status: 500 }
    );
  }
});

function calculateGrade(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
}