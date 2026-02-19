import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Image as ImageIcon, Upload, X, FolderOpen, Trash2, Calendar, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "sonner";
import { getStaffSession } from '@/components/useStaffSession';

export default function Gallery() {
  const [staffUser, setStaffUser] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [showAlbumDialog, setShowAlbumDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [albumForm, setAlbumForm] = useState({ name: '', description: '', event_date: '', visibility: 'Public' });

  const queryClient = useQueryClient();

  useEffect(() => {
    setStaffUser(getStaffSession());
  }, []);

  const isAdmin = staffUser?.role === 'Admin' || staffUser?.role === 'Principal';
  const hasGalleryPermission = isAdmin || staffUser?.permissions?.gallery === true;
  const needsApproval = !isAdmin && staffUser?.permissions?.gallery_needs_approval !== false;

  const { data: albums = [], isLoading } = useQuery({
    queryKey: ['albums'],
    queryFn: () => base44.entities.EventAlbum.list('-created_date')
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['photos', selectedAlbum?.id],
    queryFn: () => base44.entities.GalleryPhoto.filter({ album_id: selectedAlbum.id }),
    enabled: !!selectedAlbum
  });

  const createAlbumMutation = useMutation({
    mutationFn: (data) => base44.entities.EventAlbum.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['albums']);
      setShowAlbumDialog(false);
      setAlbumForm({ name: '', description: '', event_date: '', visibility: 'Public' });
      toast.success('Album created successfully');
    }
  });

  const uploadPhotosMutation = useMutation({
    mutationFn: async () => {
      const promises = uploadFiles.map(async (file) => {
        const result = await base44.integrations.Core.UploadFile({ file });
        return base44.entities.GalleryPhoto.create({
          album_id: selectedAlbum.id,
          photo_url: result.file_url,
          uploaded_by: staffUser?.email || staffUser?.username,
          status: needsApproval ? 'Pending' : 'Published'
        });
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['photos']);
      setShowUploadDialog(false);
      setUploadFiles([]);
      toast.success(needsApproval ? 'Photos submitted for approval' : 'Photos uploaded successfully');
    }
  });

  const approvePhotoMutation = useMutation({
    mutationFn: (id) => base44.entities.GalleryPhoto.update(id, { status: 'Published' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['photos']);
      toast.success('Photo approved and published');
    }
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (id) => base44.entities.GalleryPhoto.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['photos']);
      toast.success('Photo deleted');
    }
  });

  const publishAlbumMutation = useMutation({
    mutationFn: (id) => base44.entities.EventAlbum.update(id, { status: 'Published' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['albums']);
      toast.success('Album published');
    }
  });

  const deleteAlbumMutation = useMutation({
    mutationFn: (id) => base44.entities.EventAlbum.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['albums']);
      setSelectedAlbum(null);
      toast.success('Album deleted');
    }
  });

  const visibleAlbums = albums.filter(a => a.status === 'Published' || isAdmin);
  const visiblePhotos = photos.filter(p => p.status === 'Published' || isAdmin);

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Photo Gallery"
        subtitle="School events and memories"
        actions={
          isAdmin && (
            <Button onClick={() => setShowAlbumDialog(true)} className="bg-[#1a237e] hover:bg-[#283593]">
              <Plus className="mr-2 h-4 w-4" /> Create Album
            </Button>
          )
        }
      />

      <div className="p-4 lg:p-8">
        {!selectedAlbum ? (
          // Album Grid
          <div>
            {isLoading && <p className="text-center py-12 text-slate-400">Loading...</p>}
            {!isLoading && visibleAlbums.length === 0 && (
              <div className="py-16 text-center">
                <FolderOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">No Albums Yet</h3>
                {isAdmin && <p className="text-slate-500 mt-1">Create your first event album</p>}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {visibleAlbums.map(album => (
                <Card
                  key={album.id}
                  className="border-0 shadow-sm overflow-hidden cursor-pointer group hover:shadow-lg transition-all"
                  onClick={() => setSelectedAlbum(album)}
                >
                  <div className="aspect-video bg-slate-100 relative overflow-hidden">
                    {album.cover_photo_url ? (
                      <img
                        src={album.cover_photo_url}
                        alt={album.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FolderOpen className="h-12 w-12 text-slate-300" />
                      </div>
                    )}
                    {isAdmin && album.status !== 'Published' && (
                      <div className="absolute top-2 right-2">
                        <StatusBadge status={album.status} />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-slate-900 truncate">{album.name}</h3>
                    {album.event_date && (
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(album.event_date), 'MMM d, yyyy')}
                      </p>
                    )}
                    {album.description && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{album.description}</p>}
                    {isAdmin && album.status !== 'Published' && (
                      <Button
                        size="sm"
                        className="mt-2 w-full bg-green-600 hover:bg-green-700 text-xs h-7"
                        onClick={(e) => { e.stopPropagation(); publishAlbumMutation.mutate(album.id); }}
                      >
                        Publish Album
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          // Album Photos View
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <Button variant="ghost" onClick={() => setSelectedAlbum(null)} className="mb-1 -ml-2 text-slate-600">
                  ← Back to Albums
                </Button>
                <h2 className="text-xl font-bold text-slate-900">{selectedAlbum.name}</h2>
                {selectedAlbum.description && <p className="text-slate-600 mt-0.5 text-sm">{selectedAlbum.description}</p>}
                {selectedAlbum.event_date && (
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {format(new Date(selectedAlbum.event_date), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {hasGalleryPermission && (
                  <Button onClick={() => setShowUploadDialog(true)} className="bg-[#1a237e] hover:bg-[#283593]">
                    <Upload className="mr-2 h-4 w-4" /> Upload Photos
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => { if (confirm('Delete this album and all its photos?')) deleteAlbumMutation.mutate(selectedAlbum.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {isAdmin && photos.filter(p => p.status === 'Pending').length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                {photos.filter(p => p.status === 'Pending').length} photo(s) pending approval
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {visiblePhotos.map(photo => (
                <div
                  key={photo.id}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-pointer"
                  onClick={() => { setLightboxImage(photo.photo_url); setShowLightbox(true); }}
                >
                  <img src={photo.photo_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  {photo.status === 'Pending' && isAdmin && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="icon"
                        className="h-8 w-8 bg-green-500 hover:bg-green-600"
                        onClick={(e) => { e.stopPropagation(); approvePhotoMutation.mutate(photo.id); }}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); deletePhotoMutation.mutate(photo.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {isAdmin && photo.status === 'Published' && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); deletePhotoMutation.mutate(photo.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {photo.status === 'Pending' && (
                    <div className="absolute top-1 left-1">
                      <span className="text-[9px] bg-amber-400 text-white px-1.5 py-0.5 rounded-full font-semibold">Pending</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {visiblePhotos.length === 0 && (
              <div className="py-16 text-center">
                <ImageIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">No Photos Yet</h3>
                {hasGalleryPermission && <p className="text-slate-500 mt-1">Upload photos to this album</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Album Dialog (Admin only) */}
      <Dialog open={showAlbumDialog} onOpenChange={setShowAlbumDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Album</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createAlbumMutation.mutate({ ...albumForm, status: 'Draft' }); }} className="space-y-4">
            <div>
              <Label>Album / Event Name *</Label>
              <Input value={albumForm.name} onChange={(e) => setAlbumForm({ ...albumForm, name: e.target.value })} placeholder="e.g., Annual Day 2024" required />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={albumForm.description} onChange={(e) => setAlbumForm({ ...albumForm, description: e.target.value })} placeholder="Brief description of the event" />
            </div>
            <div>
              <Label>Event Date</Label>
              <Input type="date" value={albumForm.event_date} onChange={(e) => setAlbumForm({ ...albumForm, event_date: e.target.value })} />
            </div>
            <div>
              <Label>Visibility</Label>
              <Select value={albumForm.visibility} onValueChange={(v) => setAlbumForm({ ...albumForm, visibility: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Public">Public</SelectItem>
                  <SelectItem value="Staff Only">Staff Only</SelectItem>
                  <SelectItem value="Students & Parents">Students & Parents</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAlbumDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createAlbumMutation.isPending} className="bg-[#1a237e] hover:bg-[#283593]">
                {createAlbumMutation.isPending ? 'Creating...' : 'Create Album'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Photos Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Photos to "{selectedAlbum?.name}"</DialogTitle>
          </DialogHeader>
          {needsApproval && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              Your photos will be submitted for admin approval before being published.
            </div>
          )}
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
              <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600 mb-3">Select photos to upload</p>
              <label className="inline-block">
                <span className="px-4 py-2 bg-[#1a237e] text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-[#283593] transition-colors">
                  Select Photos
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setUploadFiles(Array.from(e.target.files))}
                />
              </label>
            </div>
            {uploadFiles.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {uploadFiles.map((file, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                    <button
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                      onClick={() => setUploadFiles(uploadFiles.filter((_, j) => j !== i))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
              <Button
                onClick={() => uploadPhotosMutation.mutate()}
                disabled={uploadFiles.length === 0 || uploadPhotosMutation.isPending}
                className="bg-[#1a237e] hover:bg-[#283593]"
              >
                {uploadPhotosMutation.isPending ? 'Uploading...' : `Upload ${uploadFiles.length} Photo${uploadFiles.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {showLightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowLightbox(false)}>
          <button className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20" onClick={() => setShowLightbox(false)}>
            <X className="h-6 w-6" />
          </button>
          <img src={lightboxImage} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}