import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';

export function useGoogleDriveFolderPicker() {
  const pickerRef = useRef(null);
  const accessTokenRef = useRef(null);

  useEffect(() => {
    // Load Google Picker API
    if (!window.gapi) {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = initGooglePicker;
      document.body.appendChild(script);
    } else {
      initGooglePicker();
    }
  }, []);

  const initGooglePicker = () => {
    if (window.gapi && window.gapi.load) {
      window.gapi.load('picker', {
        callback: () => {
          // Picker API loaded
        }
      });
    }
  };

  const openFolderPicker = async (onSelect, onCancel) => {
    try {
      // Get access token from backend
      const tokenRes = await base44.functions.invoke('selectDriveFolder', {});
      
      if (!tokenRes.data?.accessToken) {
        toast.error('Google Drive not connected');
        return;
      }

      accessTokenRef.current = tokenRes.data.accessToken;

      // Open Google's official Picker using the connector's access token
      if (window.google?.picker) {
        const picker = new window.google.picker.PickerBuilder()
          .addView(new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS))
          .setOAuthToken(accessTokenRef.current)
          .setCallback((data) => {
            if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
              const folder = data[window.google.picker.Response.DOCUMENTS][0];
              onSelect({
                folderId: folder.id,
                folderName: folder.name
              });
            }
          })
          .build();
        picker.setVisible(true);
      }
    } catch (error) {
      console.error('Folder picker error:', error);
      toast.error('Failed to open folder picker');
      onCancel?.();
    }
  };

  return { openFolderPicker };
}

// For now, we'll use a simple approach: a modal dialog where users paste their folder ID
// This works with Base44's OAuth constraints and doesn't require complex Picker API setup
export default function GoogleDriveFolderPickerDialog({ isOpen, onClose, onSelect }) {
  const [folderId, setFolderId] = React.useState('');
  const [folderName, setFolderName] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSelectFolder = async () => {
    if (!folderId.trim()) {
      toast.error('Please enter a folder ID');
      return;
    }

    setLoading(true);
    try {
      // Verify the folder exists and is accessible
      const response = await base44.functions.invoke('verifyDriveFolder', {
        folderId: folderId.trim()
      });

      if (response.data.success) {
        onSelect({
          folderId: folderId.trim(),
          folderName: folderName.trim() || response.data.folderName || 'Full Backups Folder'
        });
        setFolderId('');
        setFolderName('');
        onClose();
      } else {
        toast.error('Folder not accessible or invalid');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to verify folder');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
        <h2 className="text-lg font-semibold">Select Google Drive Folder</h2>
        
        <div>
          <label className="text-sm font-medium">Folder ID</label>
          <input
            type="text"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            placeholder="Paste folder ID from Drive URL"
            className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
          />
          <p className="text-xs text-gray-500 mt-1">
            Open the folder in Google Drive, copy the ID from the URL (the part after /folders/)
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">Folder Name (optional)</label>
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="e.g., School Backups"
            className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
          />
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSelectFolder}
            disabled={loading || !folderId.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Select Folder'}
          </button>
        </div>
      </div>
    </div>
  );
}