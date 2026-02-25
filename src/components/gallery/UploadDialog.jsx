import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, CheckCircle2, AlertCircle, Loader2, Plus } from 'lucide-react';
import { compressImage } from './ImageCompressor';
import { cleanPhotoUrl } from './PhotoValidator';
import GalleryImage from '@/components/GalleryImage';

export default function UploadDialog({
  open,
  onOpenChange,
  selectedAlbum,
  user,
  needsApproval,
  isUploading: parentIsUploading,
  onUploadSuccess
}) {
  const [uploadFiles, setUploadFiles] = useState([]);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFilesSelected = (files) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    setUploadFiles(arr.map(file => ({
      file,
      status: 'pending',
      progress: 0,
      preview: URL.createObjectURL(file)
    })));
  };

  const handleUploadAll = async () => {
    if (!uploadFiles.length || isUploading) return;
    
    setIsUploading(true);
    const updated = [...uploadFiles];
    let successCount = 0;

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === 'done') continue;
      
      updated[i] = { ...updated[i], status: 'uploading', progress: 10 };
      setUploadFiles([...updated]);

      try {
        const compressed = await compressImage(updated[i].file);
        updated[i] = { ...updated[i], progress: 40 };
        setUploadFiles([...updated]);

        const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
        updated[i] = { ...updated[i], progress: 80 };
        setUploadFiles([...updated]);

        // Validate URL before saving
        const validUrl = cleanPhotoUrl(file_url);
        if (!validUrl) {
          throw new Error('Invalid URL returned from upload service');
        }

        await base44.entities.GalleryPhoto.create({
          album_id: selectedAlbum.id,
          photo_url: validUrl,
          caption,
          uploaded_by: user?.email || 'unknown',
          status: needsApproval ? 'Pending' : 'Published'
        });

        updated[i] = { ...updated[i], status: 'done', progress: 100 };
        successCount++;
      } catch (error) {
        console.error('Upload error:', error);
        updated[i] = { ...updated[i], status: 'error', progress: 0 };
      }
      
      setUploadFiles([...updated]);
    }

    setIsUploading(false);

    if (successCount > 0) {
      setTimeout(() => {
        onUploadSuccess();
        setShowUpload(false);
        setUploadFiles([]);
        setCaption('');
      }, 800);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      onOpenChange(false);
      setUploadFiles([]);
      setCaption('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Photos</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {uploadFiles.length === 0 && (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-[#1a237e] hover:bg-blue-50/40 transition-all">
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-600">Tap to select photos</p>
              <p className="text-xs text-gray-400 mt-1">Multiple files supported • Auto-compressed</p>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleFilesSelected(e.target.files)}
                disabled={isUploading}
              />
            </label>
          )}

          {uploadFiles.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {uploadFiles.map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
                  <GalleryImage
                    src={item.preview}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{item.file.name}</p>
                    <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.status === 'error'
                            ? 'bg-red-500'
                            : item.status === 'done'
                            ? 'bg-green-500'
                            : 'bg-[#1a237e]'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {item.status === 'done' && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    {item.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 text-[#1a237e] animate-spin" />
                    )}
                    {item.status === 'pending' && !isUploading && (
                      <button
                        onClick={() => setUploadFiles(f => f.filter((_, idx) => idx !== i))}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {uploadFiles.length > 0 && !isUploading && (
            <label className="flex items-center gap-2 text-sm text-[#1a237e] font-medium cursor-pointer hover:underline">
              <Plus className="h-4 w-4" /> Add more photos
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => {
                  const more = Array.from(e.target.files)
                    .filter(f => f.type.startsWith('image/'))
                    .map(file => ({
                      file,
                      status: 'pending',
                      progress: 0,
                      preview: URL.createObjectURL(file)
                    }));
                  setUploadFiles(prev => [...prev, ...more]);
                }}
              />
            </label>
          )}

          <div>
            <Label>Caption (optional)</Label>
            <Input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Add a caption for all photos..."
              className="mt-1"
              disabled={isUploading}
            />
          </div>

          {needsApproval && (
            <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              Photos will be visible after admin approval.
            </p>
          )}

          <Button
            className="w-full bg-[#1a237e] hover:bg-[#283593]"
            disabled={!uploadFiles.length || isUploading}
            onClick={handleUploadAll}
          >
            {isUploading
              ? `Uploading ${uploadFiles.filter(f => f.status === 'done').length}/${uploadFiles.length}...`
              : `Upload ${uploadFiles.length} Photo${uploadFiles.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}