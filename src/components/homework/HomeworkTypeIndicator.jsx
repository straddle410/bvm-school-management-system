import React from 'react';

/**
 * Display homework type indicator.
 * For VIEW_ONLY homework, show "View Only".
 * For SUBMISSION_REQUIRED, show the homework_type field.
 */
export default function HomeworkTypeIndicator({ homework, showText = true }) {
  let type, color;

  if (homework.submission_mode === 'VIEW_ONLY') {
    type = 'View Only';
    color = 'bg-cyan-100 text-cyan-700';
  } else {
    type = homework.homework_type || 'Assignment';
    const typeColors = {
      'MCQ': 'bg-purple-100 text-purple-700',
      'Descriptive': 'bg-blue-100 text-blue-700',
      'Project': 'bg-green-100 text-green-700',
      'Assignment': 'bg-amber-100 text-amber-700',
      'Other': 'bg-gray-100 text-gray-700',
    };
    color = typeColors[type] || typeColors['Assignment'];
  }

  return (
    <span className={`${color} px-2.5 py-1 rounded-full text-xs font-semibold`}>
      {type}
    </span>
  );
}