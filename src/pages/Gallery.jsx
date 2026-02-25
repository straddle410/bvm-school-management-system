import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import GalleryImage from '@/components/GalleryImage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Upload, X, Check, ChevronLeft, Image, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { getStaffSession } from '@/components/useStaffSession';

// Compress an image file using canvas
async function compressImage(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}


export default function Gallery() {
  const [user, setUser] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]); // [{file, status: 'pending'|'uploading'|'done'|'error', progress}]
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
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
    staleTime: 5 * 60 * 1000,
  });

  const { data: allAlbumPhotos = [] } = useQuery({
    queryKey: ['allAlbumPhotos'],
    queryFn: () => base44.entities.GalleryPhoto.filter({ status: 'Published' }, '-created_date', 50),
    enabled: albums.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allPhotos = [] } = useQuery({
    queryKey: ['photos', selectedAlbum?.id],
    queryFn: () => base44.entities.GalleryPhoto.filter({ album_id: selectedAlbum.id }, '-created_date', 100),
    enabled: !!selectedAlbum,
    staleTime: 5 * 60 * 1000,
  });

  const visiblePhotos = isAdmin
    ? allPhotos
    : allPhotos.filter(p => p.status === 'Published' || p.status === 'Approved' || (canUpload && p.uploaded_by === user?.email));

  const handleFilesSelected = async (files) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    setUploadFiles(arr.map(file => ({ file, status: 'pending', progress: 0, preview: URL.createObjectURL(file) })));
  };

  const handleUploadAll = async () => {
    if (!uploadFiles.length || isUploading) return;
    setIsUploading(true);
    const updated = [...uploadFiles];
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
        await base44.entities.GalleryPhoto.create({
          album_id: selectedAlbum.id,
          photo_url: file_url,
          caption,
          uploaded_by: user?.email || '',
          status: needsApproval ? 'Pending' : 'Published'
        });
        updated[i] = { ...updated[i], status: 'done', progress: 100 };
        setUploadFiles([...updated]);
      } catch {
        updated[i] = { ...updated[i], status: 'error', progress: 0 };
        setUploadFiles([...updated]);
      }
    }
    setIsUploading(false);
    const allDone = updated.every(f => f.status === 'done' || f.status === 'error');
    if (allDone) {
      queryClient.invalidateQueries({ queryKey: ['photos', selectedAlbum?.id] });
      setTimeout(() => {
        setShowUpload(false);
        setUploadFiles([]);
        setCaption('');
      }, 800);
    }
  };

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
              <GalleryImage
                src={visiblePhotos[0].photo_url}
                alt={visiblePhotos[0].caption}
                className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                onClick={() => handlePhotoClick(visiblePhotos[0], 0)}
                loading="lazy"
              />
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
                    <GalleryImage
                       src={photo.photo_url}
                       alt={photo.caption}
                       className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                       onClick={() => handlePhotoClick(photo, idx + 1)}
                       loading="lazy"
                     />
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
        <Dialog open={!!selectedPhoto && selectedPhoto?.photo_url?.trim()} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-2xl w-full bg-black border-0 p-0">
            <div className="relative">
              {selectedPhoto?.photo_url?.trim() && <img src={selectedPhoto.photo_url} alt={selectedPhoto?.caption} className="w-full h-auto max-h-[80vh] object-contain" />}
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
        <Dialog open={showUpload} onOpenChange={open => { if (!isUploading) { setShowUpload(open); if (!open) { setUploadFiles([]); setCaption(''); } } }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Upload Photos</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Drop zone */}
              {uploadFiles.length === 0 && (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-[#1a237e] hover:bg-blue-50/40 transition-all">
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-600">Tap to select photos</p>
                  <p className="text-xs text-gray-400 mt-1">Multiple files supported • Auto-compressed</p>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleFilesSelected(e.target.files)} />
                </label>
              )}

              {/* File list with progress */}
              {uploadFiles.length > 0 && (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {uploadFiles.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
                      <img src={item.preview} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{item.file.name}</p>
                        <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${item.status === 'error' ? 'bg-red-500' : item.status === 'done' ? 'bg-green-500' : 'bg-[#1a237e]'}`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {item.status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {item.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                        {item.status === 'uploading' && <Loader2 className="h-4 w-4 text-[#1a237e] animate-spin" />}
                        {item.status === 'pending' && !isUploading && (
                          <button onClick={() => setUploadFiles(f => f.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-400">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add more button */}
              {uploadFiles.length > 0 && !isUploading && (
                <label className="flex items-center gap-2 text-sm text-[#1a237e] font-medium cursor-pointer hover:underline">
                  <Plus className="h-4 w-4" /> Add more photos
                  <input type="file" accept="image/*" multiple className="hidden" onChange={e => {
                    const more = Array.from(e.target.files).filter(f => f.type.startsWith('image/')).map(file => ({ file, status: 'pending', progress: 0, preview: URL.createObjectURL(file) }));
                    setUploadFiles(prev => [...prev, ...more]);
                  }} />
                </label>
              )}

              <div>
                <Label>Caption (optional)</Label>
                <Input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption for all photos..." className="mt-1" />
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
          {albums[0] && (() => {
            const heroPhotos = allAlbumPhotos.filter(p => p.album_id === albums[0].id).slice(0, 4);
            const coverUrl = albums[0].cover_photo_url?.trim() || heroPhotos[0]?.photo_url;
            return (
              <button className="w-full text-left" onClick={() => setSelectedAlbum(albums[0])}>
                <div className="relative w-full rounded-2xl overflow-hidden shadow-md" style={{ height: 220 }}>
                  <GalleryImage src={coverUrl} alt={albums[0].name} className="w-full h-full object-cover" loading="eager" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  {/* Small photo strip inside hero */}
                  {heroPhotos.filter(p => p.photo_url?.trim()).length > 0 && (
                    <div className="absolute top-2 right-2 flex gap-1">
                      {heroPhotos.filter(p => p.photo_url?.trim()).map(p => (
                        <div key={p.id} className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white/60 shadow">
                          <GalleryImage src={p.photo_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white font-bold text-lg leading-tight">{albums[0].name}</p>
                    {albums[0].event_date && <p className="text-white/70 text-xs mt-0.5">{albums[0].event_date}</p>}
                  </div>
                </div>
              </button>
            );
          })()}

          {/* Remaining albums in 2-col grid */}
          {albums.length > 1 && (
            <div className="grid grid-cols-2 gap-3">
              {albums.slice(1).map(album => {
                const thumbs = allAlbumPhotos.filter(p => p.album_id === album.id).slice(0, 3);
                const coverUrl = album.cover_photo_url?.trim() || thumbs[0]?.photo_url;
                return (
                  <button key={album.id} className="text-left" onClick={() => setSelectedAlbum(album)}>
                    <div className="relative rounded-xl overflow-hidden shadow-sm" style={{ height: 130 }}>
                      {coverUrl
                        ? <img src={coverUrl} alt={album.name} loading="lazy" className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-gradient-to-br from-[#283593] to-[#5c6bc0] flex items-center justify-center"><Image className="h-8 w-8 text-white/30" /></div>
                      }
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                      {/* Small thumbnails top-right */}
                      {thumbs.filter(p => p.photo_url?.trim()).length > 0 && (
                        <div className="absolute top-1.5 right-1.5 flex gap-0.5">
                          {thumbs.filter(p => p.photo_url?.trim()).map(p => (
                            <div key={p.id} className="w-7 h-7 rounded-md overflow-hidden border border-white/50 shadow">
                              <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5">
                        <p className="text-white font-semibold text-xs leading-tight truncate">{album.name}</p>
                        {album.event_date && <p className="text-white/60 text-[10px] mt-0.5">{album.event_date}</p>}
                      </div>
                    </div>
                  </button>
                );
              })}
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