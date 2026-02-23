import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { Eye, Download, Trash2 } from 'lucide-react';
import { useAcademicYear } from '@/components/AcademicYearContext';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function ProgressCardsList() {
  const { academicYear } = useAcademicYear();
  const [filters, setFilters] = useState({ class: '', student_name: '' });
  const [selectedCard, setSelectedCard] = useState(null);

  const { data: progressCards = [], isLoading } = useQuery({
    queryKey: ['progressCards', academicYear, filters],
    queryFn: async () => {
      const query = { academic_year: academicYear };
      if (filters.class) query.class_name = filters.class;
      const cards = await base44.entities.ProgressCard.filter(query);
      if (filters.student_name) {
        return cards.filter(c => c.student_name.toLowerCase().includes(filters.student_name.toLowerCase()));
      }
      return cards;
    }
  });

  const handleViewDetails = (card) => {
    setSelectedCard(card);
  };

  const handleDownloadPDF = (card) => {
    // TODO: Implement PDF download
    alert('PDF download feature coming soon');
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Progress Cards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Class</label>
              <select
                value={filters.class}
                onChange={(e) => setFilters({ ...filters, class: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Classes</option>
                {CLASSES.map(c => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Student Name</label>
              <input
                type="text"
                placeholder="Search student..."
                value={filters.student_name}
                onChange={(e) => setFilters({ ...filters, student_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setFilters({ class: '', student_name: '' })}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Cards List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Generated Progress Cards ({progressCards.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : progressCards.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No progress cards found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {progressCards.map((card) => (
                <div key={card.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{card.student_name}</h3>
                      <p className="text-sm text-gray-600">
                        Class {card.class_name} - Section {card.section} | Roll: {card.roll_number}
                      </p>
                      <div className="mt-2 flex gap-4 text-sm">
                        <span className="text-gray-600">
                          Overall: <span className="font-semibold text-blue-600">{card.overall_stats?.overall_percentage?.toFixed(2) || 0}%</span>
                        </span>
                        <span className="text-gray-600">
                          Grade: <span className="font-semibold text-green-600">{card.overall_stats?.overall_grade || '-'}</span>
                        </span>
                        <span className="text-gray-600">
                          Rank: <span className="font-semibold text-purple-600">#{card.overall_stats?.overall_rank || '-'}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleViewDetails(card)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleDownloadPDF(card)}
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      {selectedCard && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">{selectedCard.student_name} - Progress Card Details</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Class {selectedCard.class_name} | Section {selectedCard.section}</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => setSelectedCard(null)}
              className="text-lg"
            >
              ×
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-white p-3 rounded-lg border">
                <div className="text-sm text-gray-600">Overall Percentage</div>
                <div className="text-2xl font-bold text-blue-600">{selectedCard.overall_stats?.overall_percentage?.toFixed(2) || 0}%</div>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <div className="text-sm text-gray-600">Overall Grade</div>
                <div className="text-2xl font-bold text-green-600">{selectedCard.overall_stats?.overall_grade || '-'}</div>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <div className="text-sm text-gray-600">Overall Rank</div>
                <div className="text-2xl font-bold text-purple-600">#{selectedCard.overall_stats?.overall_rank || '-'}</div>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <div className="text-sm text-gray-600">Total Marks</div>
                <div className="text-2xl font-bold text-orange-600">
                  {selectedCard.overall_stats?.total_marks_obtained || 0}/{selectedCard.overall_stats?.total_possible_marks || 0}
                </div>
              </div>
            </div>

            {/* Exam Performance */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Exam Performance</h4>
              <div className="space-y-2">
                {selectedCard.exam_performance?.map((exam, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-gray-900">{exam.exam_name}</h5>
                      <div className="flex gap-3">
                        <span className="text-sm text-gray-600">{exam.percentage?.toFixed(2) || 0}%</span>
                        <span className="font-semibold text-green-600">{exam.grade}</span>
                        <span className="text-sm text-purple-600">Rank #{exam.rank || '-'}</span>
                      </div>
                    </div>
                    {exam.subject_details?.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600">
                        {exam.subject_details.map((sub, sidx) => (
                          <div key={sidx} className="bg-gray-50 p-2 rounded">
                            <div className="font-medium text-gray-900">{sub.subject}</div>
                            <div>{sub.marks_obtained}/{sub.max_marks} ({((sub.marks_obtained/sub.max_marks)*100).toFixed(1)}%)</div>
                            <div className="text-green-600">Grade: {sub.grade}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}