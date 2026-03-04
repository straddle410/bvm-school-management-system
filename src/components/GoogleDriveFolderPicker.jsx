import React, { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const GOOGLE_API_KEY = 'AIzaSyA9RHVINNb9YmZlC9T6CqB6RfXj4DgFZJ8'; // Public key for picker
const CLIENT_ID = '546873827360-1a2m7c0pjk1j4c2f5j5l5f5j5l5j5l5.apps.googleusercontent.com'; // Placeholder - will use connector token

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
      // Check if Google Drive is authorized
      const authCheck = await base44.functions.invoke('selectDriveFolder', {});
      
      if (!authCheck.data.hasAccessToken) {
        toast.error('Connect Google Drive first');
        return;
      }

      // Since we can't get the token from frontend and Picker API is complex,
      // we'll use a simpler approach: open Google Drive web picker via redirect
      // This is more reliable and works with Base44's OAuth flow

      // For now, show a simple dialog to paste folder link
      // In production, you'd use Google Drive's official picker

      return {
        folderId: null,
        folderName: null,
        cancelled: true
      };
    } catch (error) {
      console.error('Folder picker error:', error);
      toast.error('Google Drive picker failed');
      onCancel?.();
      return {
        folderId: null,
        folderName: null,
        cancelled: true,
        error
      };
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