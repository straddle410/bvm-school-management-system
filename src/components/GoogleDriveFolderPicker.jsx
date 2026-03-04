import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, FolderPlus } from 'lucide-react';

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

export default function GoogleDriveFolderPickerDialog({ isOpen, onClose, onSelect }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const accessTokenRef = useRef(null);

  // Load Google API and Picker
  useEffect(() => {
    if (!isOpen) return;

    if (!window.gapi) {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.gapi) {
          window.gapi.load('picker', {});
        }
      };
      document.body.appendChild(script);
    } else if (window.gapi) {
      window.gapi.load('picker', {});
    }
  }, [isOpen]);

  // Open folder picker
  const openFolderPicker = async () => {
    setError('');
    setLoading(true);

    try {
      // Get access token from backend
      const tokenRes = await base44.functions.invoke('selectDriveFolder', {});

      if (!tokenRes.data?.accessToken) {
        setError('Google Drive not connected. Please authorize access first.');
        toast.error('Google Drive not connected');
        setLoading(false);
        return;
      }

      accessTokenRef.current = tokenRes.data.accessToken;

      // Build and open picker
      const buildPicker = () => {
        if (window.google?.picker && accessTokenRef.current) {
          const picker = new window.google.picker.PickerBuilder()
            .addView(new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS))
            .setOAuthToken(accessTokenRef.current)
            .setCallback(handlePickerCallback)
            .build();

          picker.setVisible(true);
          setLoading(false);
        } else {
          setTimeout(buildPicker, 100);
        }
      };

      buildPicker();
    } catch (err) {
      console.error('Picker error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to open folder picker';
      setError(errorMsg);
      toast.error(errorMsg);
      setLoading(false);
    }
  };

  // Handle picker callback
  const handlePickerCallback = (data) => {
    if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
      const folder = data[window.google.picker.Response.DOCUMENTS][0];
      onSelect({
        folderId: folder.id,
        folderName: folder.name
      });
      onClose();
    } else if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.CANCEL) {
      // User cancelled the picker
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Google Drive Folder</DialogTitle>
          <DialogDescription>
            Choose a folder where weekly backups will be stored
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="text-center py-6">
            <Button
              onClick={openFolderPicker}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Opening Google Drive...
                </>
              ) : (
                'Browse Google Drive'
              )}
            </Button>
            <p className="text-xs text-gray-500 mt-3">
              Click the button to open Google Drive folder browser
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}