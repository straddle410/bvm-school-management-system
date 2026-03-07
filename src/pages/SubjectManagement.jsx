import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import LoginRequired from '@/components/LoginRequired';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

function SubjectManagementContent() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    classes: [],
    is_optional: false
  });

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const subs = await base44.entities.Subject.list();
      return subs.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }
  });

  const reorderMutation = useMutation({
    mutationFn: async (updates) => {
      await Promise.all(updates.map(({ id, sort_order }) => 
        base44.entities.Subject.update(id, { sort_order })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Subject.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      resetForm();
      toast.success('Subject created successfully');
    },
    onError: () => toast.error('Failed to create subject')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Subject.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      resetForm();
      toast.success('Subject updated successfully');
    },
    onError: () => toast.error('Failed to update subject')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Subject.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Subject deleted successfully');
    },
    onError: () => toast.error('Failed to delete subject')
  });

  const resetForm = () => {
    setFormData({ name: '', code: '', classes: [], is_optional: false });
    setEditingSubject(null);
    setShowForm(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Subject name is required');
      return;
    }
    if (editingSubject) {
      updateMutation.mutate({ id: editingSubject.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      code: subject.code || '',
      classes: subject.classes || [],
      is_optional: subject.is_optional || false
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this subject?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.index === destination.index) return;

    const items = Array.from(subjects);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);

    const updates = items.map((item, index) => ({
      id: item.id,
      sort_order: index
    }));

    reorderMutation.mutate(updates);
  };

  const toggleClass = (className) => {
    setFormData({
      ...formData,
      classes: formData.classes.includes(className)
        ? formData.classes.filter(c => c !== className)
        : [...formData.classes, className]
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <PageHeader
        title="Subject Management"
        subtitle="Create and manage subjects"
      />

      <div className="max-w-6xl mx-auto space-y-6">
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" /> Add Subject
          </Button>
        )}

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Subject Name *</label>
                    <input
                      type="text"
                      placeholder="e.g., Mathematics"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Subject Code</label>
                    <input
                      type="text"
                      placeholder="e.g., MATH-101"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium">Applicable Classes</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({
                        ...formData,
                        classes: formData.classes.length === CLASSES.length ? [] : CLASSES
                      })}
                      className="text-xs h-7"
                    >
                      {formData.classes.length === CLASSES.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {CLASSES.map(cls => (
                      <label key={cls} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.classes.includes(cls)}
                          onChange={() => toggleClass(cls)}
                          className="rounded"
                        />
                        <span className="text-sm">{cls}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_optional}
                    onChange={(e) => setFormData({ ...formData, is_optional: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Optional Subject</span>
                </label>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={resetForm}>Cancel</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    {editingSubject ? 'Update' : 'Create'} Subject
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Subjects List */}
        <Card>
          <CardHeader>
            <CardTitle>All Subjects ({subjects.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-gray-500 text-center py-8">Loading subjects...</p>
            ) : subjects.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No subjects found</p>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="subjects">
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`space-y-2 ${snapshot.isDraggingOver ? 'bg-blue-50 rounded p-2' : ''}`}
                    >
                      {subjects.map((subject, index) => (
                        <Draggable key={subject.id} draggableId={subject.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-3 p-3 bg-white border rounded-lg ${snapshot.isDragging ? 'shadow-lg bg-blue-50' : 'hover:bg-gray-50'}`}
                            >
                              <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                <GripVertical className="h-5 w-5 text-gray-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">{subject.name}</div>
                                <div className="text-sm text-gray-600">{subject.code ? `Code: ${subject.code}` : 'No code'}</div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {subject.classes?.map(cls => (
                                  <span key={cls} className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                                    {cls}
                                  </span>
                                ))}
                              </div>
                              <span className={`inline-block px-2 py-1 rounded text-xs ${subject.is_optional ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                {subject.is_optional ? 'Optional' : 'Mandatory'}
                              </span>
                              <div className="flex gap-2">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => handleEdit(subject)}
                                  className="h-8 w-8"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => handleDelete(subject.id)}
                                  className="h-8 w-8 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}