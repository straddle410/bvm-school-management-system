import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { Eye, Download, Trash2 } from 'lucide-react';
import { useAcademicYear } from '@/components/AcademicYearContext';
import ProgressCardModal from './ProgressCardModal';

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

      {/* Modal */}
      <ProgressCardModal
        card={selectedCard}
        isOpen={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </div>
  );
}