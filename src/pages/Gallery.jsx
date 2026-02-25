import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Upload, X, Check, Trash2, ChevronLeft, Image } from 'lucide-react';
import { getStaffSession } from '@/components/useStaffSession';

// Receives pre-fetched photos to avoid N+1 API calls
function AlbumPhotoStrip({ photos = [] }) {
  const published = photos.filter(p => p.status === 'Published' || p.status === 'Approved').slice(0, 4);
  if (published.length === 0) return null;
  return (
    <div className="flex gap-1 px-2 pb-2">
      {published.map(photo => (
        <div key={photo.id} className="flex-1 rounded-md overflow-hidden" style={{ height: 36 }}>
          <img src={photo.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        </div>
      ))}
    </div>
  );
}

export default function Gallery() {
  const [user, setUser] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [newAlbum, setNewAlbum] = useState({ name: '', description: '', event_date: '', visibility: ['Public'] });
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    const session = getStaffSession();
    console.log('Staff session:', session);
    if (session) {
      setUser(session);
    } else {
      base44.auth.me().then(setUser).catch(() => {});
    }
  }, []);



  const isAdmin = user?.role === 'Admin' || user?.role === 'Principal';
  const hasGalleryPermission = user?.permissions?.gallery === true;
  const canUpload = isAdmin || hasGalleryPermission;
  const canCreateAlbum = isAdmin || hasGalleryPermission;
  const needsApproval = !isAdmin && user?.permissions?.gallery_needs_approval !== false;

  const { data: albums = [] } = useQuery({
    queryKey: ['albums'],
    queryFn: () => base44.entities.EventAlbum.filter({ status: 'Published' }),
    staleTime: 120000,
  });

  // Fetch all cover-strip photos in ONE query (not per-album)
  const albumIds = albums.map(a => a.id);
  const { data: allAlbumStripPhotos = [] } = useQuery({
    queryKey: ['albumStripAll', albumIds.join(',')],
    queryFn: () => base44.entities.GalleryPhoto.list('-created_date', 100),
    enabled: albumIds.length > 0,
    staleTime: 120000,
  });

  // Group strip photos by album_id
  const photosByAlbum = allAlbumStripPhotos.reduce((acc, p) => {
    if (!acc[p.album_id]) acc[p.album_id] = [];
    acc[p.album_id].push(p);
    return acc;
  }, {});

  const { data: allPhotos = [] } = useQuery({
    queryKey: ['photos', selectedAlbum?.id],
    queryFn: () => base44.entities.GalleryPhoto.filter({ album_id: selectedAlbum.id }),
    enabled: !!selectedAlbum
  });

  const visiblePhotos = isAdmin
    ? allPhotos
    : allPhotos.filter(p => p.status === 'Published' || p.status === 'Approved' || (canUpload && p.uploaded_by === user?.email));

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadFile });
      return base44.entities.GalleryPhoto.create({
        album_id: selectedAlbum.id,
        photo_url: file_url,
        caption,
        uploaded_by: user?.email || '',
        status: needsApproval ? 'Pending' : 'Published'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', selectedAlbum?.id] });
      setShowUpload(false);
      setUploadFile(null);
      setCaption('');
    }
  });

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.GalleryPhoto.update(id, { status: 'Published' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['photos', selectedAlbum?.id] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.GalleryPhoto.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['photos', selectedAlbum?.id] })
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

  const createAlbumMutation = useMutation({
    mutationFn: () => base44.entities.EventAlbum.create({ ...newAlbum, status: 'Published' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setShowCreateAlbum(false);
      setNewAlbum({ name: '', description: '', event_date: '', visibility: ['Public'] });
    }
  });

  if (selectedAlbum) {
    return (
      <div className="bg-gray-100 min-h-screen pb-6">
        <div className="bg-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
          <button onClick={() => setSelectedAlbum(null)} className="text-gray-600">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 truncate">{selectedAlbum.name}</h2>
            <p className="text-xs text-gray-500">{visiblePhotos.length} photos</p>
          </div>
          {canUpload && (
            <Button size="sm" className="bg-[#1a237e] hover:bg-[#283593]" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-1" /> Upload
            </Button>
          )}
        </div>

        {/* Pending badge for admins */}
        {isAdmin && allPhotos.some(p => p.status === 'Pending') && (
          <div className="mx-4 mt-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-sm text-yellow-800 font-medium">
            {allPhotos.filter(p => p.status === 'Pending').length} photo(s) pending approval
          </div>
        )}

        {visiblePhotos.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-gray-400 gap-2">
            <Image className="h-12 w-12 opacity-30" />
            <p className="text-sm">No photos yet</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {/* Hero photo */}
            <div
              className="relative w-full rounded-2xl overflow-hidden cursor-pointer shadow-md"
              style={{ height: 240 }}
              onClick={() => handlePhotoClick(visiblePhotos[0], 0)}
            >
              <img src={visiblePhotos[0].photo_url} alt={visiblePhotos[0].caption} className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300" />
              {visiblePhotos[0].status === 'Pending' && (
                <div className="absolute top-2 left-2">
                  <span className="text-white text-[10px] font-bold bg-yellow-500 px-2 py-0.5 rounded-full">Pending</span>
                </div>
              )}
              {isAdmin && (
                <div className="absolute top-2 right-2 flex gap-1">
                  {visiblePhotos[0].status === 'Pending' && (
                    <button onClick={e => { e.stopPropagation(); approveMutation.mutate(visiblePhotos[0].id); }} className="bg-green-500 text-white rounded-full p-1.5 shadow">
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                  <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(visiblePhotos[0].id); }} className="bg-red-500 text-white rounded-full p-1.5 shadow">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {visiblePhotos[0].caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-white text-xs">{visiblePhotos[0].caption}</p>
                </div>
              )}
            </div>

            {/* Rest in 3-col grid */}
            {visiblePhotos.length > 1 && (
              <div className="grid grid-cols-3 gap-1.5">
                {visiblePhotos.slice(1).map((photo, idx) => (
                  <div
                    key={photo.id}
                    className="relative rounded-xl overflow-hidden cursor-pointer shadow-sm"
                    style={{ height: 100 }}
                    onClick={() => handlePhotoClick(photo, idx + 1)}
                  >
                    <img src={photo.photo_url} alt={photo.caption} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                    {photo.status === 'Pending' && (
                      <div className="absolute inset-0 bg-black/40 flex items-end justify-start p-1">
                        <span className="text-white text-[9px] font-bold bg-yellow-500 px-1.5 py-0.5 rounded-full">Pending</span>
                      </div>
                    )}
                    {isAdmin && (
                      <div className="absolute top-1 right-1 flex gap-0.5">
                        {photo.status === 'Pending' && (
                          <button onClick={e => { e.stopPropagation(); approveMutation.mutate(photo.id); }} className="bg-green-500 text-white rounded-full p-1 shadow">
                            <Check className="h-2.5 w-2.5" />
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(photo.id); }} className="bg-red-500 text-white rounded-full p-1 shadow">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Photo Lightbox Dialog */}
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-2xl w-full bg-black border-0 p-0">
            <div className="relative">
              <img src={selectedPhoto?.photo_url} alt={selectedPhoto?.caption} className="w-full h-auto max-h-[80vh] object-contain" />
              {selectedPhoto?.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 text-white text-sm">
                  {selectedPhoto.caption}
                </div>
              )}
              <button
                onClick={goToPrevPhoto}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={goToNextPhoto}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition"
              >
                <ChevronLeft className="h-6 w-6 rotate-180" />
              </button>
              <div className="absolute top-2 right-2">
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                {selectedPhotoIndex + 1} / {visiblePhotos.length}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Upload Dialog */}
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Photo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Photo</Label>
                <label className="mt-1 flex items-center gap-3 cursor-pointer">
                  <span className="px-4 py-2 bg-[#1a237e] text-white rounded-lg text-sm font-medium">
                    {uploadFile ? uploadFile.name : 'Choose Photo'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => setUploadFile(e.target.files[0])} />
                </label>
              </div>
              <div>
                <Label>Caption (optional)</Label>
                <Input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption..." />
              </div>
              {needsApproval && (
                <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                  Your photo will be visible after admin approval.
                </p>
              )}
              <Button
                className="w-full bg-[#1a237e] hover:bg-[#283593]"
                disabled={!uploadFile || uploadMutation.isPending}
                onClick={() => uploadMutation.mutate()}
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Upload Photo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9fa] min-h-screen pb-6">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <h2 className="font-bold text-gray-900 text-lg">Gallery</h2>
        {canCreateAlbum && (
          <Button size="sm" className="bg-[#1a237e] hover:bg-[#283593]" onClick={() => setShowCreateAlbum(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Album
          </Button>
        )}
      </div>

      {albums.length === 0 ? (
        <div className="py-24 flex flex-col items-center text-gray-400 gap-3">
          <Image className="h-16 w-16 opacity-20" />
          <p className="text-base font-medium">No albums yet</p>
          {canCreateAlbum && <p className="text-sm text-gray-400">Create your first album to get started</p>}
        </div>
      ) : (
        <div className="p-3 space-y-3">
          {/* Hero Album — first album large */}
          {albums[0] && (
            <button className="w-full text-left" onClick={() => setSelectedAlbum(albums[0])}>
              <div className="relative w-full rounded-2xl overflow-hidden shadow-md" style={{ height: 220 }}>
                {albums[0].cover_photo_url
                  ? <img src={albums[0].cover_photo_url} alt={albums[0].name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-[#1a237e] to-[#3949ab] flex items-center justify-center"><Image className="h-14 w-14 text-white/30" /></div>
                }
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0">
                  <AlbumPhotoStrip photos={photosByAlbum[albums[0].id] || []} />
                  <div className="px-4 pb-3">
                    <p className="text-white font-bold text-lg leading-tight">{albums[0].name}</p>
                    {albums[0].event_date && <p className="text-white/70 text-xs mt-0.5">{albums[0].event_date}</p>}
                  </div>
                </div>
              </div>
            </button>
          )}

          {/* Remaining albums in 2-col grid */}
          {albums.length > 1 && (
            <div className="grid grid-cols-2 gap-3">
              {albums.slice(1).map(album => (
                <button key={album.id} className="text-left" onClick={() => setSelectedAlbum(album)}>
                  <div className="relative rounded-xl overflow-hidden shadow-sm" style={{ height: 130 }}>
                    {album.cover_photo_url
                      ? <img src={album.cover_photo_url} alt={album.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gradient-to-br from-[#283593] to-[#5c6bc0] flex items-center justify-center"><Image className="h-8 w-8 text-white/30" /></div>
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0">
                      <AlbumPhotoStrip albumId={album.id} />
                      <div className="px-2.5 pb-2">
                        <p className="text-white font-semibold text-xs leading-tight truncate">{album.name}</p>
                        {album.event_date && <p className="text-white/60 text-[10px] mt-0.5">{album.event_date}</p>}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Album Dialog */}
      <Dialog open={showCreateAlbum} onOpenChange={setShowCreateAlbum}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Album</DialogTitle></DialogHeader>
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
                        const updated = e.target.checked
                          ? [...current, opt]
                          : current.filter(v => v !== opt);
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
              {createAlbumMutation.isPending ? 'Creating...' : 'Create Album'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}