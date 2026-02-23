import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';

const COMMON_SUBJECTS = ['English', 'Math', 'Science', 'Social Studies', 'Hindi', 'Sanskrit', 'Computer', 'Art', 'PE'];

export default function ExamTypeDetailedConfig({ examType, onChange }) {
  const [showGradingScale, setShowGradingScale] = useState(false);
  const [showSubjectMarks, setShowSubjectMarks] = useState(false);

  const gradingScale = examType.grading_scale || [];
  const subjectMaxMarks = examType.subject_max_marks || {};

  const addGradeRow = () => {
    const newGrade = {
      grade: '',
      min_percentage: 0,
      max_percentage: 100,
      description: ''
    };
    onChange({
      ...examType,
      grading_scale: [...gradingScale, newGrade]
    });
  };

  const updateGradeRow = (idx, field, value) => {
    const updated = [...gradingScale];
    updated[idx][field] = field === 'grade' || field === 'description' ? value : Number(value);
    onChange({
      ...examType,
      grading_scale: updated
    });
  };

  const removeGradeRow = (idx) => {
    const updated = gradingScale.filter((_, i) => i !== idx);
    onChange({
      ...examType,
      grading_scale: updated
    });
  };

  const addSubjectMarks = () => {
    const newMarks = { ...subjectMaxMarks, '': 100 };
    onChange({
      ...examType,
      subject_max_marks: newMarks
    });
  };

  const updateSubjectMarks = (oldSubject, newSubject, marks) => {
    const updated = { ...subjectMaxMarks };
    delete updated[oldSubject];
    updated[newSubject] = Number(marks);
    onChange({
      ...examType,
      subject_max_marks: updated
    });
  };

  const removeSubjectMarks = (subject) => {
    const updated = { ...subjectMaxMarks };
    delete updated[subject];
    onChange({
      ...examType,
      subject_max_marks: updated
    });
  };

  return (
    <div className="space-y-4">
      {/* Weight */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exam Weight</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="0"
              max="100"
              value={examType.weight || 0}
              onChange={(e) => onChange({ ...examType, weight: Number(e.target.value) })}
              className="flex-1 px-3 py-2 border rounded-lg"
              placeholder="Enter weight percentage (0-100)"
            />
            <span className="text-sm font-medium text-gray-600">%</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">This exam's contribution to overall score</p>
        </CardContent>
      </Card>

      {/* Grading Scale */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Custom Grading Scale</CardTitle>
          <Button
            size="sm"
            variant={showGradingScale ? 'default' : 'outline'}
            onClick={() => setShowGradingScale(!showGradingScale)}
          >
            {showGradingScale ? 'Hide' : 'Edit'}
          </Button>
        </CardHeader>
        {showGradingScale && (
          <CardContent className="space-y-3">
            {gradingScale.length === 0 ? (
              <p className="text-sm text-gray-500">No grading scale configured</p>
            ) : (
              <div className="space-y-2">
                {gradingScale.map((grade, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2 items-end border p-3 rounded-lg">
                    <input
                      type="text"
                      placeholder="Grade (A, B, C...)"
                      value={grade.grade}
                      onChange={(e) => updateGradeRow(idx, 'grade', e.target.value)}
                      className="px-3 py-2 border rounded-lg text-sm font-semibold"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={grade.min_percentage}
                        onChange={(e) => updateGradeRow(idx, 'min_percentage', e.target.value)}
                        className="px-2 py-2 border rounded text-sm w-full"
                      />
                      <span className="text-xs text-gray-600">%</span>
                    </div>
                    <span className="text-center text-xs text-gray-600">to</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={grade.max_percentage}
                        onChange={(e) => updateGradeRow(idx, 'max_percentage', e.target.value)}
                        className="px-2 py-2 border rounded text-sm w-full"
                      />
                      <span className="text-xs text-gray-600">%</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeGradeRow(idx)}
                      className="h-9 w-9 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="Description (e.g., Excellent)"
              className="hidden"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={addGradeRow}
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" /> Add Grade
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Subject-wise Max Marks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Subject-wise Max Marks</CardTitle>
          <Button
            size="sm"
            variant={showSubjectMarks ? 'default' : 'outline'}
            onClick={() => setShowSubjectMarks(!showSubjectMarks)}
          >
            {showSubjectMarks ? 'Hide' : 'Edit'}
          </Button>
        </CardHeader>
        {showSubjectMarks && (
          <CardContent className="space-y-3">
            {Object.keys(subjectMaxMarks).length === 0 ? (
              <p className="text-sm text-gray-500">No subjects configured</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(subjectMaxMarks).map(([subject, marks], idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 items-end border p-3 rounded-lg">
                    <select
                      value={subject}
                      onChange={(e) => updateSubjectMarks(subject, e.target.value, marks)}
                      className="col-span-2 px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">{subject}</option>
                      {COMMON_SUBJECTS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={marks}
                        onChange={(e) => updateSubjectMarks(subject, subject, e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm w-full"
                      />
                      <span className="text-xs text-gray-600">marks</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeSubjectMarks(subject)}
                      className="h-9 w-9 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={addSubjectMarks}
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" /> Add Subject
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}