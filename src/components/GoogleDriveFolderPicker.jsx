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
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [error, setError] = useState('');
  const gapiLoadedRef = useRef(false);

  // Load Google API once
  useEffect(() => {
    if (!window.gapi && !gapiLoadedRef.current) {
      gapiLoadedRef.current = true;
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('Google API script loaded');
        if (window.gapi) {
          window.gapi.load('picker', {
            callback: () => console.log('Google Picker API loaded'),
          });
          window.gapi.load('client', {
            callback: () => console.log('Google Client API loaded'),
          });
        }
      };
      script.onerror = () => {
        console.error('Failed to load Google API script');
        gapiLoadedRef.current = false;
      };
      document.body.appendChild(script);
    }
  }, []);

  // Create folder in Drive
  const createBackupFolder = async () => {
    setError('');
    setCreatingFolder(true);

    try {
      const res = await base44.functions.invoke('createFullBackupFolder', {});

      if (res.data?.success) {
        onSelect({
          folderId: res.data.folderId,
          folderName: res.data.folderName,
        });
        toast.success('Backup folder created successfully');
        onClose();
      } else {
        throw new Error(res.data?.error || 'Failed to create folder');
      }
    } catch (err) {
      console.error('Create folder error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create backup folder';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setCreatingFolder(false);
    }
  };

  // Open folder picker
  const openFolderPicker = async () => {
    setError('');
    setLoading(true);

    try {
      console.log('Checking gapi status:', { gapiReady: !!window.gapi, pickerReady: !!window.google?.picker });

      if (!window.gapi) {
        throw new Error('Google API not loaded. Please refresh and try again.');
      }

      if (!window.google?.picker) {
        throw new Error('Google Picker API not ready. Please try again.');
      }

      // Get access token from backend
      const tokenRes = await base44.functions.invoke('selectDriveFolder', {});

      if (!tokenRes.data?.accessToken) {
        throw new Error('Google Drive not authorized. Please authorize access first.');
      }

      const accessToken = tokenRes.data.accessToken;
      console.log('Got access token, opening picker');

      // Create and open picker immediately
      const docsView = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS);
      docsView.setSelectFolderEnabled(true);
      docsView.setIncludeFolders(true);

      const picker = new window.google.picker.PickerBuilder()
        .addView(docsView)
        .setOAuthToken(accessToken)
        .setCallback(handlePickerCallback)
        .build();

      picker.setVisible(true);
      setLoading(false);
      console.log('Picker opened');
    } catch (err) {
      console.error('Picker error:', err);
      const errorMsg = err.message || 'Failed to open folder picker. Please allow popups or reconnect Google Drive.';
      setError(errorMsg);
      toast.error(errorMsg);
      setLoading(false);
    }
  };

  // Handle picker callback
  const handlePickerCallback = (data) => {
    console.log('Picker callback:', data);
    if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
      const folder = data[window.google.picker.Response.DOCUMENTS][0];
      console.log('Folder selected:', folder);
      onSelect({
        folderId: folder.id,
        folderName: folder.name,
      });
      onClose();
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