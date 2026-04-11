import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Bus, Plus, Trash2, Edit2, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_ROUTE = { name: '', description: '', fee_type: 'yearly', fixed_yearly_fee: 0, fixed_monthly_fee: 0, is_active: true };
const EMPTY_STOP = { name: '', fee_amount: 0, sort_order: 0 };

function computeAnnualFee(route, stop) {
  if (!route) return 0;
  if (route.fee_type === 'yearly') return route.fixed_yearly_fee || 0;
  if (route.fee_type === 'monthly') return (route.fixed_monthly_fee || 0) * 12;
  if (route.fee_type === 'stop_based') return stop?.fee_amount || 0;
  return 0;
}

export default function TransportManagementTab() {
  const queryClient = useQueryClient();
  const [expandedRouteId, setExpandedRouteId] = useState(null);
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [routeForm, setRouteForm] = useState({ ...EMPTY_ROUTE });
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [editingStop, setEditingStop] = useState(null);
  const [stopRouteId, setStopRouteId] = useState(null);
  const [stopForm, setStopForm] = useState({ ...EMPTY_STOP });

  const { data: routes = [], isLoading: loadingRoutes } = useQuery({
    queryKey: ['transport-routes'],
    queryFn: () => base44.entities.TransportRoute.list('name')
  });

  const { data: allStops = [] } = useQuery({
    queryKey: ['transport-stops'],
    queryFn: () => base44.entities.TransportStop.list('sort_order')
  });

  const saveRouteMutation = useMutation({
    mutationFn: async (data) => {
      if (editingRoute) {
        return base44.entities.TransportRoute.update(editingRoute.id, data);
      }
      return base44.entities.TransportRoute.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['transport-routes']);
      setShowRouteDialog(false);
      toast.success(editingRoute ? 'Route updated' : 'Route created');
    },
    onError: (e) => toast.error(e.message)
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (id) => {
      // Delete all stops for this route first
      const stopsForRoute = allStops.filter(s => s.route_id === id);
      await Promise.all(stopsForRoute.map(s => base44.entities.TransportStop.delete(s.id)));
      return base44.entities.TransportRoute.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['transport-routes']);
      queryClient.invalidateQueries(['transport-stops']);
      toast.success('Route deleted');
    },
    onError: (e) => toast.error(e.message)
  });

  const saveStopMutation = useMutation({
    mutationFn: async (data) => {
      if (editingStop) {
        return base44.entities.TransportStop.update(editingStop.id, data);
      }
      return base44.entities.TransportStop.create({ ...data, route_id: stopRouteId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['transport-stops']);
      setShowStopDialog(false);
      toast.success(editingStop ? 'Stop updated' : 'Stop added');
    },
    onError: (e) => toast.error(e.message)
  });

  const deleteStopMutation = useMutation({
    mutationFn: (id) => base44.entities.TransportStop.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['transport-stops']);
      toast.success('Stop deleted');
    },
    onError: (e) => toast.error(e.message)
  });

  const toggleRouteMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.TransportRoute.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries(['transport-routes'])
  });

  const openAddRoute = () => {
    setEditingRoute(null);
    setRouteForm({ ...EMPTY_ROUTE });
    setShowRouteDialog(true);
  };

  const openEditRoute = (route) => {
    setEditingRoute(route);
    setRouteForm({ name: route.name, description: route.description || '', fee_type: route.fee_type, fixed_yearly_fee: route.fixed_yearly_fee || 0, fixed_monthly_fee: route.fixed_monthly_fee || 0, is_active: route.is_active !== false });
    setShowRouteDialog(true);
  };

  const openAddStop = (routeId) => {
    setStopRouteId(routeId);
    setEditingStop(null);
    setStopForm({ ...EMPTY_STOP });
    setShowStopDialog(true);
  };

  const openEditStop = (stop) => {
    setStopRouteId(stop.route_id);
    setEditingStop(stop);
    setStopForm({ name: stop.name, fee_amount: stop.fee_amount || 0, sort_order: stop.sort_order || 0 });
    setShowStopDialog(true);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bus className="h-5 w-5 text-amber-600" /> Transport Management
          </CardTitle>
          <CardDescription>
            Manage transport routes, stops and fees. Assign students to routes from the Students page.
          </CardDescription>
        </div>
        <Button onClick={openAddRoute} className="gap-2 bg-amber-600 hover:bg-amber-700">
          <Plus className="h-4 w-4" /> Add Route
        </Button>
      </CardHeader>

      <CardContent>
        {loadingRoutes ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Bus className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No routes configured yet</p>
            <p className="text-sm mt-1">Create a route to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {routes.map(route => {
              const stops = allStops.filter(s => s.route_id === route.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
              const isExpanded = expandedRouteId === route.id;
              const annualFee = route.fee_type === 'yearly' ? route.fixed_yearly_fee : route.fee_type === 'monthly' ? (route.fixed_monthly_fee || 0) * 12 : null;

              return (
                <div key={route.id} className={`border rounded-xl overflow-hidden ${route.is_active ? 'border-amber-200' : 'border-slate-200 opacity-60'}`}>
                  {/* Route Header */}
                  <div className={`flex items-center gap-3 px-4 py-3 ${route.is_active ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <button onClick={() => setExpandedRouteId(isExpanded ? null : route.id)} className="flex-shrink-0 text-slate-500">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800">{route.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          route.fee_type === 'yearly' ? 'bg-blue-100 text-blue-700' :
                          route.fee_type === 'monthly' ? 'bg-purple-100 text-purple-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {route.fee_type === 'yearly' ? 'Yearly' : route.fee_type === 'monthly' ? 'Monthly' : 'Stop-based'}
                        </span>
                      </div>
                      {route.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{route.description}</p>}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {route.fee_type === 'yearly' && `Annual fee: ₹${(route.fixed_yearly_fee || 0).toLocaleString()}`}
                        {route.fee_type === 'monthly' && `Monthly: ₹${(route.fixed_monthly_fee || 0).toLocaleString()} × 12 = ₹${((route.fixed_monthly_fee || 0) * 12).toLocaleString()}/year`}
                        {route.fee_type === 'stop_based' && `${stops.length} stop(s) · fee varies by stop`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={route.is_active !== false}
                        onCheckedChange={(v) => toggleRouteMutation.mutate({ id: route.id, is_active: v })}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditRoute(route)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-400 hover:text-red-600"
                        onClick={() => { if (window.confirm(`Delete route "${route.name}"? This will also delete all its stops.`)) deleteRouteMutation.mutate(route.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Stops */}
                  {isExpanded && (
                    <div className="border-t divide-y">
                      {stops.map(stop => (
                        <div key={stop.id} className="flex items-center gap-3 px-5 py-2.5 bg-white hover:bg-slate-50">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700">{stop.name}</p>
                            {route.fee_type === 'stop_based' && (
                              <p className="text-xs text-slate-400">₹{(stop.fee_amount || 0).toLocaleString()} / year</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditStop(stop)}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-400 hover:text-red-600"
                              onClick={() => { if (window.confirm(`Delete stop "${stop.name}"?`)) deleteStopMutation.mutate(stop.id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="px-5 py-2 bg-white">
                        <Button size="sm" variant="ghost" className="text-xs gap-1 text-amber-700 hover:bg-amber-50" onClick={() => openAddStop(route.id)}>
                          <Plus className="h-3 w-3" /> Add Stop
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Route Dialog */}
      <Dialog open={showRouteDialog} onOpenChange={setShowRouteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRoute ? 'Edit Route' : 'Add Transport Route'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Route Name *</Label>
              <Input value={routeForm.name} onChange={e => setRouteForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., North Zone Route 1" className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={routeForm.description} onChange={e => setRouteForm(p => ({ ...p, description: e.target.value }))} placeholder="Coverage area (optional)" className="mt-1" />
            </div>
            <div>
              <Label>Fee Type *</Label>
              <Select value={routeForm.fee_type} onValueChange={v => setRouteForm(p => ({ ...p, fee_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yearly">Yearly (fixed annual fee)</SelectItem>
                  <SelectItem value="monthly">Monthly (monthly × 12)</SelectItem>
                  <SelectItem value="stop_based">Stop-based (fee per stop)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {routeForm.fee_type === 'yearly' && (
              <div>
                <Label>Annual Fee (₹)</Label>
                <Input type="number" min="0" value={routeForm.fixed_yearly_fee} onChange={e => setRouteForm(p => ({ ...p, fixed_yearly_fee: parseInt(e.target.value) || 0 }))} className="mt-1" />
              </div>
            )}
            {routeForm.fee_type === 'monthly' && (
              <div>
                <Label>Monthly Fee (₹)</Label>
                <Input type="number" min="0" value={routeForm.fixed_monthly_fee} onChange={e => setRouteForm(p => ({ ...p, fixed_monthly_fee: parseInt(e.target.value) || 0 }))} className="mt-1" />
                {routeForm.fixed_monthly_fee > 0 && (
                  <p className="text-xs text-slate-500 mt-1">Annual equivalent: ₹{(routeForm.fixed_monthly_fee * 12).toLocaleString()}</p>
                )}
              </div>
            )}
            {routeForm.fee_type === 'stop_based' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">
                ℹ️ Add stops after saving the route. Each stop will have its own fee amount.
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={routeForm.is_active} onCheckedChange={v => setRouteForm(p => ({ ...p, is_active: v }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowRouteDialog(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                disabled={!routeForm.name || saveRouteMutation.isPending}
                onClick={() => saveRouteMutation.mutate(routeForm)}
              >
                {saveRouteMutation.isPending ? 'Saving...' : editingRoute ? 'Update Route' : 'Create Route'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stop Dialog */}
      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingStop ? 'Edit Stop' : 'Add Stop'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Stop Name *</Label>
              <Input value={stopForm.name} onChange={e => setStopForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., City Park" className="mt-1" />
            </div>
            {(() => {
              const route = routes.find(r => r.id === stopRouteId);
              return route?.fee_type === 'stop_based' ? (
                <div>
                  <Label>Fee Amount (₹ / year)</Label>
                  <Input type="number" min="0" value={stopForm.fee_amount} onChange={e => setStopForm(p => ({ ...p, fee_amount: parseInt(e.target.value) || 0 }))} className="mt-1" />
                </div>
              ) : null;
            })()}
            <div>
              <Label>Sort Order</Label>
              <Input type="number" min="0" value={stopForm.sort_order} onChange={e => setStopForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} className="mt-1" placeholder="0" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowStopDialog(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                disabled={!stopForm.name || saveStopMutation.isPending}
                onClick={() => saveStopMutation.mutate(stopForm)}
              >
                {saveStopMutation.isPending ? 'Saving...' : editingStop ? 'Update Stop' : 'Add Stop'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}