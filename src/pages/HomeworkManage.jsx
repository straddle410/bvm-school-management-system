import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, BookOpen, Trash2, Eye, CheckCircle, Clock, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import HomeworkForm from '@/components/homework/HomeworkForm.jsx';
import HomeworkSubmissions from '@/components/homework/HomeworkSubmissions.jsx';

const CLASSES = ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10','11','12'];
const TYPE_COLORS = {
  MCQ: 'bg-purple-100 text-purple-700',
  Descriptive: 'bg-blue-100 text-blue-700',
  Project: 'bg-green-100 text-green-700',
  Assignment: 'bg-amber-100 text-amber-700',
  Other: 'bg-gray-100 text-gray-700',
};

export default function HomeworkManage() {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterClass, setFilterClass] = useState('');
  const [viewSubmissions, setViewSubmissions] = useState(null);
  const qc = useQueryClient();

  useEffect(() => {
    const s = localStorage.getItem('staff_session');
    if (s) { try { setUser(JSON.parse(s)); } catch {} }
  }, []);

  const { data: homeworks = [], isLoading } = useQuery({
    queryKey: ['homeworks-manage', filterClass],
    queryFn: () => {
      const filter = {};
      if (filterClass) filter.class_name = filterClass;
      return base44.entities.Homework.filter(filter, '-created_date', 100);
    }
  });

  const publishMutation = useMutation({
    mutationFn: (hw) => base44.entities.Homework.update(hw.id, { status: hw.status === 'Published' ? 'Draft' : 'Published' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['homeworks-manage'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Homework.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['homeworks-manage'] })
  });

  const isAdmin = user?.role === 'Admin' || user?.role === 'admin' || user?.role === 'Principal';
  const isTeacher = user?.role === 'Teacher' || user?.role === 'teacher';
  const canCreate = isAdmin || isTeacher;

  if (!user) return (
    <div className="p-6 text-center text-gray-500">
      <BookOpen className="h-10 w-10 mx-auto mb-2 text-gray-300" />
      <p>Please login as staff to manage homework.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      <div className="bg-[#1a237e] text-white px-4 py-4">
        <h1 className="text-lg font-bold">Homework Management</h1>
        <p className="text-blue-200 text-xs mt-0.5">Create, manage & review homework</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Filter + Create */}
        <div className="flex gap-2">
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
          >
            <option value="">All Classes</option>
            {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
          {canCreate && (
            <Button
              onClick={() => { setEditItem(null); setShowForm(true); }}
              className="bg-[#1a237e] hover:bg-[#283593] text-white rounded-xl px-4"
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-10 text-gray-400">Loading...</div>
        ) : homeworks.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
            <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No homework found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {homeworks.map(hw => (
              <div key={hw.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[hw.homework_type] || 'bg-gray-100 text-gray-600'}`}>
                          {hw.homework_type}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${hw.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {hw.status}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 mt-1 text-sm">{hw.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {hw.subject} • Class {hw.class_name}{hw.section && hw.section !== 'All' ? `-${hw.section}` : ''} 
                        {hw.assigned_by ? ` • ${hw.assigned_by}` : ''}
                      </p>
                      {hw.due_date && (
                        <p className="text-xs mt-1 flex items-center gap-1 text-slate-500">
                          <Clock className="h-3 w-3" /> Due: {format(new Date(hw.due_date), 'dd MMM yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => publishMutation.mutate(hw)}
                      className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium ${hw.status === 'Published' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}
                    >
                      <CheckCircle className="h-3 w-3" />
                      {hw.status === 'Published' ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      onClick={() => setViewSubmissions(hw)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium bg-blue-100 text-blue-700"
                    >
                      <Users className="h-3 w-3" /> Submissions
                    </button>
                    <button
                      onClick={() => { setEditItem(hw); setShowForm(true); }}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium bg-amber-100 text-amber-700"
                    >
                      <Eye className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => { if(confirm('Delete this homework?')) deleteMutation.mutate(hw.id); }}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium bg-red-100 text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <HomeworkForm
          editItem={editItem}
          user={user}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ['homeworks-manage'] });
          }}
        />
      )}

      {viewSubmissions && (
        <HomeworkSubmissions
          homework={viewSubmissions}
          onClose={() => setViewSubmissions(null)}
        />
      )}
    </div>
  );
}