import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getStaffSession } from '@/components/useStaffSession';
import LoginRequired from '@/components/LoginRequired';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Upload, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DiaryForm from '@/components/diary/DiaryForm';
import DiaryList from '@/components/diary/DiaryList';

export default function DiaryManagement() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [filterClass, setFilterClass] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    setUser(getStaffSession());
  }, []);

  const { data: diaries = [] } = useQuery({
    queryKey: ['diaries', academicYear],
    queryFn: () => base44.entities.Diary.filter({ academic_year: academicYear }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Diary.create({
      ...data,
      posted_by: user?.email,
      posted_by_name: user?.full_name
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
      setShowForm(false);
      toast.success('Diary entry posted successfully');
    },
    onError: () => toast.error('Failed to post diary entry')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Diary.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
      setShowForm(false);
      setEditingEntry(null);
      toast.success('Diary entry updated successfully');
    },
    onError: () => toast.error('Failed to update diary entry')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Diary.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
      toast.success('Diary entry deleted successfully');
    },
    onError: () => toast.error('Failed to delete diary entry')
  });

  const publishMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(
        ids.map(id => base44.entities.Diary.update(id, { status: 'Published' }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diaries'] });
      setSelectedEntries(new Set());
      toast.success('Diary entries published successfully');
    },
    onError: () => toast.error('Failed to publish diary entries')
  });

  const handleSubmit = (formData) => {
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this diary entry?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingEntry(null);
  };

  const handleSelectEntry = (entryId) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedEntries(newSelected);
  };

  const handlePublish = () => {
    if (selectedEntries.size === 0) {
      toast.error('Please select entries to publish');
      return;
    }
    if (confirm(`Publish ${selectedEntries.size} diary entry/entries?`)) {
      publishMutation.mutate(Array.from(selectedEntries));
    }
  };

  const userDiaries = diaries
    .filter(d => d.posted_by === user?.email)
    .filter(d => !filterClass || d.class_name === filterClass);

  const uniqueClasses = [...new Set(diaries.filter(d => d.posted_by === user?.email).map(d => d.class_name))].sort();
  const draftEntries = userDiaries.filter(d => d.status === 'Draft');

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="Diary Management">
      <div className="min-h-screen bg-gray-100 p-4">
        <PageHeader
          title="Class Diary"
          subtitle="Post daily class activities and assignments"
        />

        <div className="max-w-4xl mx-auto space-y-6">
           {!showForm && (
             <div className="flex gap-3 items-center flex-wrap">
               <Button
                 onClick={() => setShowForm(true)}
                 className="bg-blue-600 hover:bg-blue-700"
               >
                 <Plus className="h-4 w-4 mr-2" /> New Diary Entry
               </Button>

               <div className="w-48">
                 <Select value={filterClass} onValueChange={setFilterClass}>
                   <SelectTrigger>
                     <SelectValue placeholder="Filter by Class" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value={null}>All Classes</SelectItem>
                     {uniqueClasses.map(cls => (
                       <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

               {selectedEntries.size > 0 && (
                 <Button
                   onClick={handlePublish}
                   className="bg-green-600 hover:bg-green-700"
                   disabled={publishMutation.isPending}
                 >
                   <Upload className="h-4 w-4 mr-2" /> Publish ({selectedEntries.size})
                 </Button>
               )}
             </div>
           )}

          {showForm && (
            <DiaryForm
              entry={editingEntry}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              academicYear={academicYear}
            />
          )}

          {draftEntries.length > 0 && (
             <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
               <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
               <div>
                 <p className="text-sm font-medium text-yellow-900">
                   {draftEntries.length} draft entry/entries. Select and click Publish button below to make them visible to students.
                 </p>
               </div>
             </div>
           )}

          <Card>
             <CardContent className="pt-6">
               <h3 className="text-lg font-semibold mb-4">Your Diary Entries</h3>
               <div className="space-y-2">
                 {userDiaries.length === 0 ? (
                   <p className="text-gray-500 text-sm">No diary entries found</p>
                 ) : (
                   userDiaries.sort((a, b) => new Date(b.diary_date || b.created_date) - new Date(a.diary_date || a.created_date)).map(entry => (
                     <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
                       <input
                         type="checkbox"
                         checked={selectedEntries.has(entry.id)}
                         onChange={() => handleSelectEntry(entry.id)}
                         disabled={entry.status === 'Published'}
                         className="mt-1 w-4 h-4 cursor-pointer"
                       />
                       <div className="flex-1 min-w-0">
                         <p className="font-medium text-sm">{entry.title}</p>
                         <p className="text-xs text-gray-600">
                           Class {entry.class_name}-{entry.section} • {entry.subject} • {entry.diary_date ? new Date(entry.diary_date).toLocaleDateString() : 'N/A'}
                         </p>
                         <p className="text-xs text-gray-500 mt-1 line-clamp-2">{entry.description}</p>
                       </div>
                       <div className="flex gap-2 flex-shrink-0">
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => handleEdit(entry)}
                         >
                           Edit
                         </Button>
                         <Button
                           size="sm"
                           variant="outline"
                           className="text-red-600 hover:bg-red-50"
                           onClick={() => handleDelete(entry.id)}
                         >
                           Delete
                         </Button>
                       </div>
                       {entry.status === 'Published' && (
                         <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded whitespace-nowrap">
                           Published
                         </span>
                       )}
                     </div>
                   ))
                 )}
               </div>
             </CardContent>
           </Card>
        </div>
      </div>
    </LoginRequired>
  );
}