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
import { Badge } from "@/components/ui/badge";
import { 
  Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths } from 'date-fns';
import { toast } from "sonner";

const EVENT_TYPES = [
  { value: 'Holiday', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'Exam', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'PTM', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'Event', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'Meeting', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'Other', color: 'bg-slate-100 text-slate-700 border-slate-200' }
];

export default function Calendar() {
  const [user, setUser] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'Event',
    start_date: '',
    end_date: '',
    all_day: true
  });
  
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (e) {
        // Check if staff is logged in via staff login
        const staffSession = localStorage.getItem('staff_session');
        if (staffSession) {
          const staff = JSON.parse(staffSession);
          setUser({ role: staff.role, full_name: staff.full_name, email: staff.email });
        } else {
          setUser(null);
        }
      }
    };
    loadUser();
  }, []);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => base44.entities.CalendarEvent.list()
  });

  // Fetch marked holidays from Holiday entity
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => base44.entities.Holiday.filter({ status: 'Active' }),
  });

  // Build a set of holiday date strings
  const holidayDateSet = React.useMemo(() => {
    const set = new Set();
    holidays.forEach(h => { if (h.date) set.add(h.date); });
    return set;
  }, [holidays]);

  // Check if date is Sunday or marked holiday
  const isAttendanceHoliday = (date) => {
    const isSunday = date.getDay() === 0;
    const isMarkedHoliday = holidayDateSet.has(format(date, 'yyyy-MM-dd'));
    return isSunday || isMarkedHoliday;
  };

  const createEventMutation = useMutation({
    mutationFn: (data) => base44.entities.CalendarEvent.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['calendar-events']);
      setShowEventDialog(false);
      resetEventForm();
      toast.success('Event created successfully');
    }
  });

  const resetEventForm = () => {
    setEventForm({
      title: '',
      description: '',
      event_type: 'Event',
      start_date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '',
      end_date: '',
      all_day: true
    });
  };

  const userRole = user?.role || 'user';
  const isAdmin = ['Admin', 'Principal'].includes(userRole);
  const isTeacher = ['Admin', 'Principal', 'Teacher'].includes(userRole);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startPadding = monthStart.getDay();
  const paddedDays = Array(startPadding).fill(null).concat(days);

  const getEventsForDay = (date) => {
    return events.filter(event => {
      if (event.status !== 'Published' && !isAdmin) return false;
      const eventStart = new Date(event.start_date);
      const eventEnd = event.end_date ? new Date(event.end_date) : eventStart;
      return date >= eventStart && date <= eventEnd;
    });
  };

  const getEventColor = (type) => {
    return EVENT_TYPES.find(t => t.value === type)?.color || EVENT_TYPES[5].color;
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    if (isTeacher) {
      setEventForm({
        ...eventForm,
        start_date: format(date, 'yyyy-MM-dd'),
        end_date: format(date, 'yyyy-MM-dd')
      });
    }
  };

  const handleClearStaleHolidays = async () => {
    try {
      await base44.functions.invoke('clearStaleHolidays', {});
      queryClient.invalidateQueries(['attendance-holidays']);
      toast.success('Stale holiday records cleared');
    } catch (err) {
      toast.error('Failed to clear stale records');
    }
  };

  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
         title="School Calendar"
         subtitle="Events, holidays and important dates"
         actions={
           isTeacher && (
             <div className="flex gap-2">
               <Button onClick={() => setShowEventDialog(true)}>
                 <Plus className="mr-2 h-4 w-4" /> Add Event
               </Button>
               {isAdmin && (
                 <Button variant="outline" onClick={handleClearStaleHolidays}>
                   Clear Stale Records
                 </Button>
               )}
             </div>
           )
         }
       />

      <div className="p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Today
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Day Headers */}
              <div className="grid grid-cols-7 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {paddedDays.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="aspect-square" />;
                  }
                  
                  const dayEvents = getEventsForDay(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isHolidayDay = isAttendanceHoliday(day);

                  return (
                   <div
                     key={day.toISOString()}
                     onClick={() => handleDateClick(day)}
                     className={`
                       aspect-square p-1 rounded-xl cursor-pointer transition-all
                       ${isHolidayDay && !isToday(day) ? 'bg-red-50' : ''}
                       ${isToday(day) ? 'bg-blue-50' : ''}
                       ${isSelected ? 'ring-2 ring-blue-500' : ''}
                       hover:bg-slate-100
                     `}
                   >
                     <div className={`
                       h-7 w-7 rounded-full flex items-center justify-center text-sm mx-auto
                       ${isToday(day) ? 'bg-blue-600 text-white' : isHolidayDay ? 'bg-red-500 text-white' : 'text-slate-700'}
                     `}>
                        {format(day, 'd')}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {dayEvents.slice(0, 2).map(event => (
                          <div
                            key={event.id}
                            className={`text-xs truncate px-1 py-0.5 rounded ${getEventColor(event.event_type)}`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-slate-500 text-center">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sidebar - Selected Date & Upcoming Events */}
          <div className="space-y-6">
            {/* Selected Date Events */}
            {selectedDate && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    {format(selectedDate, 'MMMM d, yyyy')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedDateEvents.length > 0 ? (
                    <div className="space-y-3">
                      {selectedDateEvents.map(event => (
                        <div key={event.id} className="p-3 bg-slate-50 rounded-xl">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-slate-900">{event.title}</p>
                              <Badge variant="outline" className={`mt-1 ${getEventColor(event.event_type)}`}>
                                {event.event_type}
                              </Badge>
                            </div>
                          </div>
                          {event.description && (
                            <p className="text-sm text-slate-600 mt-2">{event.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-4">No events on this day</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Legend */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Event Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map(type => (
                    <Badge key={type.value} variant="outline" className={type.color}>
                      {type.value}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Events */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Upcoming Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {events
                    .filter(e => new Date(e.start_date) >= new Date() && (e.status === 'Published' || isAdmin))
                    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
                    .slice(0, 5)
                    .map(event => (
                      <div key={event.id} className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <CalendarIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">{event.title}</p>
                          <p className="text-xs text-slate-500">
                            {format(new Date(event.start_date), 'MMM d')}
                          </p>
                        </div>
                      </div>
                    ))}
                  {events.filter(e => new Date(e.start_date) >= new Date()).length === 0 && (
                    <p className="text-slate-500 text-center py-4">No upcoming events</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Create Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            createEventMutation.mutate({
              ...eventForm, 
              status: isAdmin ? 'Published' : 'Pending'
            });
          }} className="space-y-4">
            <div>
              <Label>Event Title *</Label>
              <Input
                value={eventForm.title}
                onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                placeholder="Enter event title"
                required
              />
            </div>
            <div>
              <Label>Event Type *</Label>
              <Select
                value={eventForm.event_type}
                onValueChange={(v) => setEventForm({...eventForm, event_type: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={eventForm.start_date}
                  onChange={(e) => setEventForm({...eventForm, start_date: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={eventForm.end_date}
                  onChange={(e) => setEventForm({...eventForm, end_date: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={eventForm.description}
                onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                placeholder="Event details"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowEventDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createEventMutation.isPending}>
                {createEventMutation.isPending ? 'Creating...' : 'Create Event'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}