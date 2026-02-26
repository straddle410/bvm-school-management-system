import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit2, Trash2, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function DiaryList({ entries, canEdit, onEdit, onDelete, unreadIds = {}, onItemRead }) {
  if (!entries || entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">No diary entries found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map(entry => {
        const isUnread = !!unreadIds[entry.id];
        return (
        <Card key={entry.id} className={isUnread ? 'border-l-4 border-blue-500' : ''} onClick={() => isUnread && onItemRead && onItemRead(entry.id)}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 flex items-start gap-2">
                {isUnread && <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-2.5" />}
                <div className="flex-1">
                <CardTitle className={`text-lg ${isUnread ? 'font-extrabold' : ''}`}>{entry.title}</CardTitle>
                <div className="flex gap-2 mt-2 flex-wrap">
                   <Badge variant="outline">Class {entry.class_name}-{entry.section}</Badge>
                   <Badge variant="outline">{entry.subject}</Badge>
                   <Badge variant={entry.status === 'Published' ? 'default' : 'secondary'}>
                     {entry.status}
                   </Badge>
                 </div>
                </div>
                </div>
                {canEdit && (
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => onEdit(entry)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => onDelete(entry.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-gray-700 whitespace-pre-wrap">{entry.description}</p>

            {entry.attachment_urls && entry.attachment_urls.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium text-gray-600 mb-2">Attachments:</p>
                <div className="flex flex-wrap gap-2">
                  {entry.attachment_urls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                    >
                      <FileText className="h-4 w-4" />
                      <span>File {idx + 1}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
              <span>By: {entry.posted_by_name || entry.posted_by}</span>
              <span>{entry.created_date ? format(new Date(entry.created_date), 'MMM dd, yyyy') : 'N/A'}</span>
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}