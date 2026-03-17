import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Eye, Download, Printer, CheckSquare2, Square, Trash2 } from 'lucide-react';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { toast } from 'sonner';
import ProgressCardModal from './ProgressCardModal';
import { getClassesForYear } from '@/components/classSectionHelper';

export default function ProgressCardsList() {
  const { academicYear } = useAcademicYear();
  const [availableClasses, setAvailableClasses] = useState([]);

  useEffect(() => {
    if (!academicYear) return;
    getClassesForYear(academicYear)
      .then(res => setAvailableClasses(res.classes || []))
      .catch(() => setAvailableClasses([]));
  }, [academicYear]);
  const [filters, setFilters] = useState({ class: '', student_name: '', exam_type: '' });
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedCards, setSelectedCards] = useState(new Set());

  const { data: examTypes = [] } = useQuery({
    queryKey: ['examTypes', academicYear],
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear, is_active: true })
  });

  const { data: progressCards = [], isLoading, refetch } = useQuery({
    queryKey: ['progressCards', academicYear, filters],
    queryFn: async () => {
      const query = { academic_year: academicYear };
      if (filters.class) query.class_name = filters.class;
      
      // Paginate to fetch ALL cards beyond the 50 default limit
      let allCards = [];
      let skip = 0;
      const batchSize = 100;
      while (true) {
        const batch = await base44.entities.ProgressCard.filter(query, null, batchSize, skip);
        if (!batch || batch.length === 0) break;
        allCards = allCards.concat(batch);
        if (batch.length < batchSize) break;
        skip += batchSize;
      }
      
      let cards = allCards;
      
      // Filter by exam type (check exam_performance array)
      if (filters.exam_type) {
        cards = cards.filter(c => 
          c.exam_performance && c.exam_performance.some(ep => 
            ep.exam_type === filters.exam_type || ep.exam_type_id === filters.exam_type
          )
        );
      }
      
      if (filters.student_name) {
        cards = cards.filter(c => c.student_name.toLowerCase().includes(filters.student_name.toLowerCase()));
      }
      
      return cards;
    },
    staleTime: 0
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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const cardIds = progressCards.filter(c => selectedCards.has(c.id)).map(c => c.id);
      const response = await base44.functions.invoke('deleteProgressCards', { cardIds });
      return response.data.deletedCount;
    },
    onSuccess: (count) => {
      refetch();
      toast.success(`Deleted ${count} progress cards`);
      setSelectedCards(new Set());
    },
    onError: (error) => {
      toast.error('Failed to delete progress cards');
    }
  });

  const handleDeleteSelected = () => {
    const count = selectedCards.size;
    if (!window.confirm(`Delete ${count} progress card(s)? This cannot be undone.`)) return;
    deleteMutation.mutate();
  };

  const handlePrintSelected = () => {
    const cardsToPrint = progressCards.filter(c => selectedCards.has(c.id));
    if (cardsToPrint.length === 0) {
      toast.error('Please select at least one progress card to print');
      return;
    }

    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .page { page-break-after: always; border: 1px solid #ccc; padding: 40px; min-height: 297mm; margin-bottom: 20px; }
          .header { background: linear-gradient(135deg, #1a237e 0%, #283593 100%); color: white; padding: 20px; margin: -40px -40px 20px -40px; }
          .header h2 { font-size: 24px; margin-bottom: 5px; }
          .info { margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; margin: 10px 0; font-size: 14px; }
          .stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin: 20px 0; }
          .stat-box { background: #f5f5f5; padding: 15px; text-align: center; border-left: 4px solid #1a237e; }
          .stat-value { font-size: 28px; font-weight: bold; color: #1a237e; }
          .stat-label { font-size: 11px; color: #666; margin-top: 5px; }
          @media print { body { padding: 0; } .page { page-break-after: always; margin: 0; } }
        </style>
      </head>
      <body>
        ${cardsToPrint.map(card => `
          <div class="page">
            <div class="header">
              <h2>${card.student_name}</h2>
              <p style="font-size: 12px;">Progress Card</p>
            </div>
            <div class="info">
              <div class="info-row">
                <span><strong>Class:</strong> ${card.class_name}</span>
                <span><strong>Section:</strong> ${card.section}</span>
                <span><strong>Roll:</strong> ${card.roll_number}</span>
              </div>
            </div>
            <div class="stats">
              <div class="stat-box">
                <div class="stat-value">${(card.overall_stats?.overall_percentage || 0).toFixed(1)}%</div>
                <div class="stat-label">Overall %</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${card.overall_stats?.overall_grade || '-'}</div>
                <div class="stat-label">Grade</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">#${card.overall_stats?.overall_rank || '-'}</div>
                <div class="stat-label">Rank</div>
              </div>
            </div>
          </div>
        `).join('')}
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Class</label>
              <select
                value={filters.class}
                onChange={(e) => setFilters({ ...filters, class: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Classes</option>
                {availableClasses.map(c => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Exam Type</label>
              <select
                value={filters.exam_type}
                onChange={(e) => setFilters({ ...filters, exam_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Exam Types</option>
                {examTypes.map(exam => (
                  <option key={exam.id} value={exam.id}>{exam.name}</option>
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
                onClick={() => setFilters({ class: '', student_name: '', exam_type: '' })}
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
                     <Button
                       size="sm"
                       variant="destructive"
                       onClick={handleDeleteSelected}
                       disabled={deleteMutation.isPending}
                       className="gap-2"
                     >
                       <Trash2 className="h-4 w-4" />
                       {deleteMutation.isPending ? 'Deleting...' : `Delete Selected (${selectedCards.size})`}
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
                        {card.exam_performance?.[0]?.exam_name && (
                          <p className="text-xs text-blue-600 font-medium mt-1">
                            Exam: {card.exam_performance[0].exam_name}
                          </p>
                        )}
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