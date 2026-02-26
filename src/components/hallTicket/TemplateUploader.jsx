import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';

export default function TemplateUploader({ onTemplateUpload }) {
  const [templateUrl, setTemplateUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Save template URL to SchoolProfile
      const profiles = await base44.entities.SchoolProfile.list();
      if (profiles.length > 0) {
        await base44.entities.SchoolProfile.update(profiles[0].id, { hall_ticket_template_url: file_url });
      }
      
      setTemplateUrl(file_url);
      onTemplateUpload?.(file_url);
      toast.success('Template uploaded successfully');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hall Ticket Template</CardTitle>
        <CardDescription>Upload an image/document showing your desired hall ticket format</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!templateUrl ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition">
              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <label className="cursor-pointer">
                <span className="text-blue-600 font-medium">Click to upload</span>
                <span className="text-gray-600"> or drag and drop</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  disabled={loading}
                />
              </label>
              <p className="text-xs text-gray-500 mt-2">PNG, JPG, PDF, DOCX up to 10MB</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-100 rounded-lg p-4">
                <img 
                  src={templateUrl.includes('base44.app') ? `https://images.weserv.nl/?url=${encodeURIComponent(templateUrl)}` : templateUrl} 
                  alt="Uploaded template" 
                  className="max-h-96 mx-auto rounded"
                  onError={() => (
                    <p className="text-gray-600 text-center">Unable to preview file</p>
                  )}
                />
              </div>
              <Button
                onClick={async () => {
                  try {
                    const profiles = await base44.entities.SchoolProfile.list();
                    if (profiles.length > 0) {
                      await base44.entities.SchoolProfile.update(profiles[0].id, { hall_ticket_template_url: null });
                    }
                    setTemplateUrl(null);
                    onTemplateUpload?.(null);
                    toast.success('Template removed');
                  } catch (error) {
                    toast.error('Failed to remove template');
                  }
                }}
                variant="outline"
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Remove Template
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}