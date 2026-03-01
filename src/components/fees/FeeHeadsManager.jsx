import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

export default function FeeHeadsManager() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', is_active: true });

  const { data: feeHeads = [], isLoading } = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => base44.entities.FeeHead.list('sort_order')
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.FeeHead.update(editing.id, data)
      : base44.entities.FeeHead.create({ ...data, sort_order: feeHeads.length }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-heads'] });
      toast.success(editing ? 'Fee head updated' : 'Fee head added');
      setShowForm(false); setEditing(null); setForm({ name: '', description: '', is_active: true });
    },
    onError: (e) => toast.error(e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FeeHead.update(id, { is_active: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fee-heads'] }); toast.success('Fee head deactivated'); }
  });

  const handleEdit = (fh) => {
    setEditing(fh);
    setForm({ name: fh.name, description: fh.description || '', is_active: fh.is_active });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{feeHeads.filter(f => f.is_active).length} active fee heads</p>
        <Button size="sm" onClick={() => { setEditing(null); setForm({ name: '', description: '', is_active: true }); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Fee Head
        </Button>
      </div>

      {showForm && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Name *</label>
                <input className="border rounded-lg px-3 py-2 text-sm w-full mt-1" placeholder="e.g. Tuition Fee" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <input className="border rounded-lg px-3 py-2 text-sm w-full mt-1" placeholder="Optional" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
              <Button size="sm" onClick={() => { if (!form.name.trim()) { toast.error('Name is required'); return; } saveMutation.mutate(form); }} disabled={saveMutation.isPending}>
                {editing ? 'Update' : 'Add'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : feeHeads.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-slate-400">No fee heads defined yet. Add your first one.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {feeHeads.map(fh => (
            <Card key={fh.id} className={`border-0 shadow-sm ${!fh.is_active ? 'opacity-50' : ''}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-slate-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900">{fh.name}</p>
                    {!fh.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                  {fh.description && <p className="text-sm text-slate-500 truncate">{fh.description}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(fh)}><Edit2 className="h-4 w-4 text-slate-400" /></Button>
                  {fh.is_active && <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(fh.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}