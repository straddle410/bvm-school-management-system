import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Plus, Image as ImageIcon, Upload, X, FolderOpen, Eye, Pencil, Trash2, Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "sonner";

export default function Gallery() {
  const [user, setUser] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [showAlbumDialog, setShowAlbumDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [albumForm, setAlbumForm] = useState({
    name: '',
    description: '',
    event_date: '',
    visibility: 'Public'
  });
  
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

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
          uploaded_by: user?.email,
          status: 'Pending'
        });
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['photos']);
      setShowUploadDialog(false);
      setUploadFiles([]);
      toast.success('Photos uploaded successfully');
    }
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (id) => base44.entities.GalleryPhoto.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['photos']);
      toast.success('Photo deleted');
    }
  });

  const userRole = user?.role || 'user';
  const isAdmin = ['admin', 'principal'].includes(userRole);
  const publishedPhotos = photos.filter(p => p.status === 'Published' || isAdmin);

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Photo Gallery"
        subtitle="School events and memories"
        actions={
          isAdmin && (
            <Button onClick={() => setShowAlbumDialog(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Album
            </Button>
          )
        }
      />

      <div className="p-4 lg:p-8">
        {!selectedAlbum ? (
          // Album Grid
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {albums
              .filter(a => a.status === 'Published' || isAdmin)
              .map(album => (
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
                </CardContent>
              </Card>
            ))}

            {albums.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <FolderOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">No Albums Yet</h3>
                <p className="text-slate-500 mt-1">Create your first album to start uploading photos</p>
              </div>
            )}
          </div>
        ) : (
          // Album Photos View
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedAlbum(null)}
                  className="mb-2"
                >
                  ← Back to Albums
                </Button>
                <h2 className="text-2xl font-bold text-slate-900">{selectedAlbum.name}</h2>
                {selectedAlbum.description && (
                  <p className="text-slate-600 mt-1">{selectedAlbum.description}</p>
                )}
              </div>
              {(isAdmin || selectedAlbum.upload_permission?.includes(user?.email)) && (
                <Button onClick={() => setShowUploadDialog(true)}>
                  <Upload className="mr-2 h-4 w-4" /> Upload Photos
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {publishedPhotos.map(photo => (
                <div 
                  key={photo.id}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-pointer"
                  onClick={() => {
                    setLightboxImage(photo.photo_url);
                    setShowLightbox(true);
                  }}
                >
                  <img 
                    src={photo.photo_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {isAdmin && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button 
                        size="icon" 
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePhotoMutation.mutate(photo.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {isAdmin && photo.status !== 'Published' && (
                    <div className="absolute top-2 left-2">
                      <StatusBadge status={photo.status} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {publishedPhotos.length === 0 && (
              <div className="py-16 text-center">
                <ImageIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">No Photos Yet</h3>
                <p className="text-slate-500 mt-1">Upload photos to this album</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Album Dialog */}
      <Dialog open={showAlbumDialog} onOpenChange={setShowAlbumDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Album</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            createAlbumMutation.mutate({...albumForm, status: 'Draft'});
          }} className="space-y-4">
            <div>
              <Label>Album Name *</Label>
              <Input
                value={albumForm.name}
                onChange={(e) => setAlbumForm({...albumForm, name: e.target.value})}
                placeholder="e.g., Annual Day 2024"
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={albumForm.description}
                onChange={(e) => setAlbumForm({...albumForm, description: e.target.value})}
                placeholder="Brief description of the event"
              />
            </div>
            <div>
              <Label>Event Date</Label>
              <Input
                type="date"
                value={albumForm.event_date}
                onChange={(e) => setAlbumForm({...albumForm, event_date: e.target.value})}
              />
            </div>
            <div>
              <Label>Visibility</Label>
              <Select
                value={albumForm.visibility}
                onValueChange={(v) => setAlbumForm({...albumForm, visibility: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Public">Public</SelectItem>
                  <SelectItem value="Staff Only">Staff Only</SelectItem>
                  <SelectItem value="Students & Parents">Students & Parents</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAlbumDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createAlbumMutation.isPending}>
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
            <DialogTitle>Upload Photos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
              <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600 mb-3">
                Select photos to upload
              </p>
              <label className="inline-block">
                <span className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-700 transition-colors">
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
                    <img 
                      src={URL.createObjectURL(file)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
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

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowUploadDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => uploadPhotosMutation.mutate()}
                disabled={uploadFiles.length === 0 || uploadPhotosMutation.isPending}
              >
                {uploadPhotosMutation.isPending ? 'Uploading...' : `Upload ${uploadFiles.length} Photos`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {showLightbox && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          <button 
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            onClick={() => setShowLightbox(false)}
          >
            <X className="h-6 w-6" />
          </button>
          <img 
            src={lightboxImage}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}