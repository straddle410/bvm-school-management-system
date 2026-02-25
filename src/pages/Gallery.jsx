import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Upload, X, Check, ChevronLeft, Image as ImageIcon } from 'lucide-react';
import { getStaffSession } from '@/components/useStaffSession';

export default function Gallery() {
  const [user, setUser] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [newAlbum, setNewAlbum] = useState({ name: '', event_date: '' });
  const [uploadProgress, setUploadProgress] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    const session = getStaffSession();
    if (session) {
      setUser(session);
    } else {
      base44.auth.me().then(u => u && setUser(u)).catch(() => setUser(null));
    }
  }, []);

  const isAdmin = user?.role === 'Admin' || user?.role === 'Principal';
  const canUpload = isAdmin || user?.permissions?.gallery === true;
  const canCreateAlbum = isAdmin || user?.permissions?.gallery === true;
  const needsApproval = !isAdmin && user?.permissions?.gallery_needs_approval !== false;

  const { data: albums = [] } = useQuery({
    queryKey: ['albums'],
    queryFn: async () => {
      try {
        return await base44.entities.EventAlbum.filter({ status: 'Published' });
      } catch (e) {
        console.log('Error fetching albums:', e);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: albumPhotos = [] } = useQuery({
    queryKey: ['albumPhotos', selectedAlbum?.id],
    queryFn: () => base44.entities.GalleryPhoto.filter({ album_id: selectedAlbum.id }, '-created_date', 100),
    enabled: !!selectedAlbum,
    staleTime: 5 * 60 * 1000,
  });

  const visiblePhotos = isAdmin ? albumPhotos : albumPhotos.filter(p => p.status === 'Published' || p.status === 'Approved' || (canUpload && p.uploaded_by === user?.email));

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.GalleryPhoto.update(id, { status: 'Published' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['albumPhotos', selectedAlbum?.id] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.GalleryPhoto.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['albumPhotos', selectedAlbum?.id] })
  });

  const createAlbumMutation = useMutation({
    mutationFn: () => base44.entities.EventAlbum.create({ ...newAlbum, status: 'Published' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setShowCreateAlbum(false);
      setNewAlbum({ name: '', event_date: '' });
    }
  });

  const handleUploadPhotos = async (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = `${Date.now()}-${i}`;
      
      try {
        setUploadProgress(p => ({ ...p, [fileId]: 'uploading' }));
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        await base44.entities.GalleryPhoto.create({
          album_id: selectedAlbum.id,
          photo_url: file_url,
          uploaded_by: user?.email || '',
          status: needsApproval ? 'Pending' : 'Published'
        });

        setUploadProgress(p => ({ ...p, [fileId]: 'done' }));
      } catch (err) {
        setUploadProgress(p => ({ ...p, [fileId]: 'error' }));
      }
    }

    queryClient.invalidateQueries({ queryKey: ['albumPhotos', selectedAlbum?.id] });
    setShowUpload(false);
    setUploadProgress({});
  };

  if (selectedAlbum) {
    return (
      <div className="bg-gray-50 min-h-screen pb-8">
        <div className="bg-white px-4 py-3 sticky top-0 z-20 shadow-sm flex items-center gap-3">
          <button onClick={() => setSelectedAlbum(null)} className="text-gray-600">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex-1">
            <h2 className="font-bold text-gray-900">{selectedAlbum.name}</h2>
            <p className="text-xs text-gray-500">{visiblePhotos.length} photos</p>
          </div>
          {canUpload && (
            <label>
              <Button size="sm" className="bg-[#1a237e] hover:bg-[#283593]" onClick={() => setShowUpload(true)}>
                <Upload className="h-4 w-4 mr-1" /> Upload
              </Button>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleUploadPhotos} />
            </label>
          )}
        </div>

        {visiblePhotos.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-gray-400">
            <ImageIcon className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">No photos yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-2">
            {visiblePhotos.map((photo) => (
              <div key={photo.id} className="relative rounded-lg overflow-hidden bg-gray-200 aspect-square group cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                {photo.photo_url ? (
                  <img src={photo.photo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 text-gray-400" /></div>
                )}
                {photo.status === 'Pending' && (
                  <div className="absolute top-1 left-1 bg-yellow-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">Pending</div>
                )}
                {isAdmin && (
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    {photo.status === 'Pending' && (
                      <button onClick={(e) => { e.stopPropagation(); approveMutation.mutate(photo.id); }} className="bg-green-500 text-white rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(photo.id); }} className="bg-red-500 text-white rounded-full p-1">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Photo Viewer */}
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-lg bg-black border-0 p-0">
            <div className="relative bg-black">
              {selectedPhoto?.photo_url ? (
                <img src={selectedPhoto.photo_url} alt="" className="w-full h-auto max-h-[70vh] object-contain" />
              ) : (
                <div className="w-full h-[70vh] flex items-center justify-center text-gray-400">No image</div>
              )}
              <button onClick={() => setSelectedPhoto(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-2">
                <X className="h-5 w-5" />
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Upload Dialog */}
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Upload Photos</DialogTitle></DialogHeader>
            <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#1a237e]">
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Tap to select photos</p>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleUploadPhotos} />
            </label>
            {needsApproval && <p className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded">Photos need approval before publishing</p>}
            <Button className="w-full bg-[#1a237e] hover:bg-[#283593]" onClick={() => setShowUpload(false)}>Done</Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-8">
      <div className="bg-white px-4 py-3 sticky top-0 z-20 shadow-sm flex items-center justify-between">
        <h2 className="font-bold text-gray-900">Gallery</h2>
        {canCreateAlbum && (
          <Button size="sm" className="bg-[#1a237e] hover:bg-[#283593]" onClick={() => setShowCreateAlbum(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Album
          </Button>
        )}
      </div>

      {albums.length === 0 ? (
        <div className="py-16 flex flex-col items-center text-gray-400">
          <ImageIcon className="h-12 w-12 mb-2 opacity-30" />
          <p className="text-sm">No albums yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-3">
          {albums.map((album) => (
            <button key={album.id} onClick={() => setSelectedAlbum(album)} className="text-left rounded-lg overflow-hidden bg-gray-200 aspect-square group relative">
              {album.cover_photo_url ? (
                <img src={album.cover_photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a237e] to-[#3949ab]"><ImageIcon className="h-8 w-8 text-white/30" /></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                <div>
                  <p className="text-white font-semibold text-sm">{album.name}</p>
                  {album.event_date && <p className="text-white/70 text-xs">{album.event_date}</p>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Album Dialog */}
      <Dialog open={showCreateAlbum} onOpenChange={setShowCreateAlbum}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Album</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Album Name</Label>
              <Input value={newAlbum.name} onChange={(e) => setNewAlbum({ ...newAlbum, name: e.target.value })} placeholder="e.g., Annual Day 2025" />
            </div>
            <div>
              <Label>Event Date</Label>
              <Input type="date" value={newAlbum.event_date} onChange={(e) => setNewAlbum({ ...newAlbum, event_date: e.target.value })} />
            </div>
            <Button className="w-full bg-[#1a237e] hover:bg-[#283593]" disabled={!newAlbum.name || createAlbumMutation.isPending} onClick={() => createAlbumMutation.mutate()}>
              {createAlbumMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}