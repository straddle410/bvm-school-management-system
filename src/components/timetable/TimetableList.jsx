import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function TimetableList({ entries, onEdit, onDelete, onView, canEdit = false }) {
  if (!entries || entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Timetable Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">No timetable entries found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timetable Entries ({entries.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {entries.map(entry => (
            <div key={entry.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex gap-2 mb-2">
                    <span className="font-semibold">Class {entry.class_name} - {entry.section}</span>
                    <Badge variant={entry.status === 'Published' ? 'default' : 'outline'}>
                      {entry.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                    <div><span className="font-medium">{entry.day}</span> {entry.start_time}-{entry.end_time}</div>
                    <div><span className="font-medium">{entry.subject}</span></div>
                    <div><span className="font-medium">{entry.teacher_name}</span></div>
                    <div>Room: {entry.room_number || 'N/A'}</div>
                  </div>
                  {entry.notes && (
                    <div className="text-sm text-orange-600 italic mt-1">Note: {entry.notes}</div>
                  )}
                </div>
                <div className="flex gap-2">
                   {canEdit && (
                     <>
                       <Button
                         size="icon"
                         variant="outline"
                         onClick={() => onEdit(entry)}
                         title="Edit"
                       >
                         <Edit2 className="h-4 w-4" />
                       </Button>
                       <Button
                         size="icon"
                         variant="outline"
                         onClick={() => onDelete(entry.id)}
                         title="Delete"
                         className="text-red-600 hover:text-red-700"
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     </>
                   )}
                   {!canEdit && (
                     <Button
                       size="icon"
                       variant="outline"
                       onClick={() => onView(entry)}
                       title="View"
                     >
                       <Eye className="h-4 w-4" />
                     </Button>
                   )}
                 </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}