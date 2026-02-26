import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import GalleryImage from '@/components/GalleryImage';
import UploadDialog from '@/components/gallery/UploadDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Upload, X, Check, ChevronLeft, Image, ChevronRight } from 'lucide-react';
import { getStaffSession } from '@/components/useStaffSession';

export default function Gallery() {
  const [user, setUser] = useState(undefined);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newAlbum, setNewAlbum] = useState({ name: '', description: '', event_date: '', visibility: ['Public'] });
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [photoLimit, setPhotoLimit] = useState(200);
  const queryClient = useQueryClient();

  useEffect(() => {
    const session = getStaffSession();
    if (session) {
      setUser(session);
    } else {
      base44.auth.me().then(setUser).catch(() => setUser(null));
    }
  }, []);

  const isAdmin = user?.role === 'Admin' || user?.role === 'Principal' || user?.role === 'admin';
  const hasGalleryPermission = user?.permissions?.gallery === true;
  const canUpload = isAdmin || hasGalleryPermission;
  const canCreateAlbum = isAdmin || hasGalleryPermission;
  const needsApproval = !isAdmin && user?.permissions?.gallery_needs_approval !== false;

  const { data: albums = [] } = useQuery({
    queryKey: ['albums'],
    queryFn: () => base44.entities.EventAlbum.filter({ status: 'Published' }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allAlbumPhotos = [] } = useQuery({
    queryKey: ['allAlbumPhotos'],
    queryFn: () => base44.entities.GalleryPhoto.filter({ status: 'Published' }, '-created_date', 50),
    enabled: albums.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allPhotos = [], isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['photos', selectedAlbum?.id, photoLimit],
    queryFn: () => base44.entities.GalleryPhoto.filter({ album_id: selectedAlbum.id }, '-created_date', photoLimit),
    enabled: !!selectedAlbum,
    staleTime: 0,
  });

  const visiblePhotos = isAdmin
    ? allPhotos
    : allPhotos.filter(p => p.status === 'Published' || p.status === 'Approved' || (canUpload && p.uploaded_by === user?.email));

  const handleUploadSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['photos', selectedAlbum?.id] });
  };

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.GalleryPhoto.update(id, { status: 'Published' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['photos', selectedAlbum?.id] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.GalleryPhoto.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', selectedAlbum?.id] });
      setSelectedPhoto(null);
    }
  });

  const createAlbumMutation = useMutation({
    mutationFn: () => base44.entities.EventAlbum.create({ ...newAlbum, status: 'Published' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setShowCreateAlbum(false);
      setNewAlbum({ name: '', description: '', event_date: '', visibility: ['Public'] });
    }
  });

  const handlePhotoClick = (photo, index) => {
    setSelectedPhoto(photo);
    setSelectedPhotoIndex(index);
  };

  const goToPrevPhoto = () => {
    const newIndex = selectedPhotoIndex === 0 ? visiblePhotos.length - 1 : selectedPhotoIndex - 1;
    setSelectedPhotoIndex(newIndex);
    setSelectedPhoto(visiblePhotos[newIndex]);
  };

  const goToNextPhoto = () => {
    const newIndex = selectedPhotoIndex === visiblePhotos.length - 1 ? 0 : selectedPhotoIndex + 1;
    setSelectedPhotoIndex(newIndex);
    setSelectedPhoto(visiblePhotos[newIndex]);
  };

  if (user === null) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Image className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Login Required</h2>
          <p className="text-gray-500 text-sm mb-6">Please login to view the gallery.</p>
          <Button className="bg-[#1a237e] hover:bg-[#283593] w-full" onClick={() => base44.auth.redirectToLogin(window.location.href)}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (user === undefined) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a237e]" />
      </div>
    );
  }

  // ── Album Photo Grid ──────────────────────────────────────────────────────
  if (selectedAlbum) {
    const pendingCount = allPhotos.filter(p => p.status === 'Pending').length;

    return (
      <div className="bg-white min-h-screen">
        {/* Album header */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{selectedAlbum.name}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{visiblePhotos.length} Photos</p>
          </div>
          {canUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="bg-[#1a237e] text-white rounded-full px-4 py-1.5 text-sm font-medium flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          )}
        </div>

        {isAdmin && pendingCount > 0 && (
          <div className="mx-4 mb-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 font-medium">
            {pendingCount} photo{pendingCount > 1 ? 's' : ''} pending approval
          </div>
        )}

        {visiblePhotos.length === 0 ? (
          <div className="py-32 flex flex-col items-center text-gray-300 gap-3">
            <Image className="h-14 w-14" />
            <p className="text-sm text-gray-400">No photos yet</p>
          </div>
        ) : (
          <>
            {/* Dense square grid — iOS Photos style */}
            <div className="grid grid-cols-3 gap-[1.5px]">
              {visiblePhotos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="relative aspect-square cursor-pointer overflow-hidden"
                  onClick={() => handlePhotoClick(photo, idx)}
                >
                  <GalleryImage
                    src={photo.photo_url}
                    alt={photo.caption}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {photo.status === 'Pending' && (
                    <div className="absolute inset-0 bg-black/30 flex items-end p-1">
                      <span className="text-white text-[8px] font-bold bg-amber-500 px-1.5 py-0.5 rounded-full">Pending</span>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="absolute top-1 right-1 flex gap-0.5">
                      {photo.status === 'Pending' && (
                        <button
                          onClick={e => { e.stopPropagation(); approveMutation.mutate(photo.id); }}
                          className="bg-green-500 text-white rounded-full p-1 shadow"
                        >
                          <Check className="h-2.5 w-2.5" />
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); deleteMutation.mutate(photo.id); }}
                        className="bg-red-500 text-white rounded-full p-1 shadow"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {allPhotos.length >= photoLimit && (
              <div className="flex justify-center py-6">
                <button
                  onClick={() => setPhotoLimit(prev => prev + 200)}
                  disabled={isLoadingPhotos}
                  className="text-[#1a237e] text-sm font-medium"
                >
                  {isLoadingPhotos ? 'Loading…' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Lightbox */}
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-full w-full h-full bg-black border-0 p-0 flex items-center justify-center">
            <div className="relative w-full flex items-center justify-center">
              {selectedPhoto?.photo_url && (
                <GalleryImage
                  src={selectedPhoto.photo_url}
                  alt={selectedPhoto?.caption}
                  className="w-full max-h-[85vh] object-contain"
                />
              )}
              {selectedPhoto?.caption && (
                <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm px-4">
                  {selectedPhoto.caption}
                </div>
              )}
              <button onClick={goToPrevPhoto} className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={goToNextPhoto} className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2">
                <ChevronRight className="h-5 w-5" />
              </button>
              <button onClick={() => setSelectedPhoto(null)} className="absolute top-3 right-3 bg-black/40 text-white rounded-full p-2">
                <X className="h-5 w-5" />
              </button>
              <div className="absolute top-3 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/40 px-3 py-1 rounded-full">
                {selectedPhotoIndex + 1} / {visiblePhotos.length}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <UploadDialog
          open={showUpload}
          onOpenChange={setShowUpload}
          selectedAlbum={selectedAlbum}
          user={user}
          needsApproval={needsApproval}
          onUploadSuccess={handleUploadSuccess}
        />
      </div>
    );
  }

  // ── Albums List — iOS Photos Albums tab ───────────────────────────────────
  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-end justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Albums</h1>
        {canCreateAlbum && (
          <button
            onClick={() => setShowCreateAlbum(true)}
            className="text-[#1a237e] font-medium text-sm flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> New
          </button>
        )}
      </div>

      <div className="h-px bg-gray-100 mx-4" />

      {albums.length === 0 ? (
        <div className="py-32 flex flex-col items-center gap-3">
          <Image className="h-14 w-14 text-gray-200" />
          <p className="text-sm text-gray-400">No albums yet</p>
          {canCreateAlbum && <p className="text-xs text-gray-300">Tap "New" to create your first album</p>}
        </div>
      ) : (
        <div className="px-4 pt-4 pb-8 grid grid-cols-2 gap-x-4 gap-y-6">
          {albums.map(album => {
            const thumbs = allAlbumPhotos.filter(p => p.album_id === album.id && p.photo_url?.trim());
            const coverUrl = album.cover_photo_url?.trim() || thumbs[0]?.photo_url;
            const photoCount = allAlbumPhotos.filter(p => p.album_id === album.id).length;

            return (
              <button key={album.id} className="text-left" onClick={() => setSelectedAlbum(album)}>
                {/* Square cover */}
                <div className="aspect-square w-full rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
                  {coverUrl ? (
                    <GalleryImage src={coverUrl} alt={album.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="h-10 w-10 text-gray-300" />
                    </div>
                  )}
                </div>
                {/* Title below — iOS style */}
                <div className="mt-2 px-0.5">
                  <p className="text-sm font-semibold text-gray-900 truncate">{album.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{photoCount > 0 ? `${photoCount} items` : album.event_date || ''}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create Album Dialog */}
      <Dialog open={showCreateAlbum} onOpenChange={setShowCreateAlbum}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Album</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Album Name</Label>
              <Input value={newAlbum.name} onChange={e => setNewAlbum({ ...newAlbum, name: e.target.value })} placeholder="e.g., Annual Day 2025" />
            </div>
            <div>
              <Label>Event Date</Label>
              <Input type="date" value={newAlbum.event_date} onChange={e => setNewAlbum({ ...newAlbum, event_date: e.target.value })} />
            </div>
            <div>
              <Label>Visibility</Label>
              <div className="mt-1 space-y-2 border border-gray-200 rounded-lg p-3">
                {['Public', 'Staff Only', 'Students & Parents'].map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(newAlbum.visibility || []).includes(opt)}
                      onChange={e => {
                        const current = newAlbum.visibility || [];
                        const updated = e.target.checked ? [...current, opt] : current.filter(v => v !== opt);
                        setNewAlbum({ ...newAlbum, visibility: updated });
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button
              className="w-full bg-[#1a237e] hover:bg-[#283593]"
              disabled={!newAlbum.name || createAlbumMutation.isPending}
              onClick={() => createAlbumMutation.mutate()}
            >
              {createAlbumMutation.isPending ? 'Creating…' : 'Create Album'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}