import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Eye, Download, Printer, CheckSquare2, Square } from 'lucide-react';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { toast } from 'sonner';
import ProgressCardModal from './ProgressCardModal';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function ProgressCardsList() {
  const { academicYear } = useAcademicYear();
  const [filters, setFilters] = useState({ class: '', student_name: '' });
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedCards, setSelectedCards] = useState(new Set());

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

  const toggleCardSelection = (cardId) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCards(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCards.size === progressCards.length) {
      setSelectedCards(new Set());
    } else {
      setSelectedCards(new Set(progressCards.map(c => c.id)));
    }
  };

  const generateZipMutation = useMutation({
    mutationFn: async () => {
      const cardsToExport = progressCards.filter(c => selectedCards.has(c.id));
      const response = await base44.functions.invoke('generateProgressCardsZip', {
        progressCards: cardsToExport
      });
      return response.data;
    },
    onSuccess: (data) => {
      const blob = new Blob([Buffer.from(data.zipData, 'base64')], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Progress_Cards_${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('Progress cards downloaded as ZIP');
      setSelectedCards(new Set());
    },
    onError: (error) => {
      toast.error('Failed to download progress cards');
    }
  });

  const handlePrintSelected = () => {
    const cardsToPrint = progressCards.filter(c => selectedCards.has(c.id));
    if (cardsToprint.length === 0) {
      toast.error('Please select at least one progress card to print');
      return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><style>');
    printWindow.document.write('@media print { body { margin: 0; padding: 20px; } .page-break { page-break-after: always; } }');
    printWindow.document.write('</style></head><body>');

    cardsToprint.forEach((card, idx) => {
      printWindow.document.write(`
        <div class="page-break">
          <div style="border: 1px solid #ccc; padding: 20px; min-height: 280mm;">
            <h2>${card.student_name}</h2>
            <p>Class ${card.class_name} - Section ${card.section} | Roll: ${card.roll_number}</p>
            <hr/>
            <pre>${JSON.stringify(card.overall_stats, null, 2)}</pre>
          </div>
        </div>
      `);
    });

    printWindow.document.write('</body></html>');
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Generated Progress Cards ({progressCards.length})</CardTitle>
            {progressCards.length > 0 && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={toggleSelectAll}
                  className="gap-2"
                >
                  {selectedCards.size === progressCards.length ? (
                    <>
                      <CheckSquare2 className="h-4 w-4" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4" />
                      Select All
                    </>
                  )}
                </Button>
                {selectedCards.size > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={handlePrintSelected}
                      className="gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <Printer className="h-4 w-4" />
                      Print Selected ({selectedCards.size})
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => generateZipMutation.mutate()}
                      disabled={generateZipMutation.isPending}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <Download className="h-4 w-4" />
                      {generateZipMutation.isPending ? 'Downloading...' : `Download ZIP (${selectedCards.size})`}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
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
                <div key={card.id} className={`border rounded-lg p-4 transition cursor-pointer ${selectedCards.has(card.id) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={() => toggleCardSelection(card.id)}
                        className="mt-1 flex-shrink-0"
                      >
                        {selectedCards.has(card.id) ? (
                          <CheckSquare2 className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
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