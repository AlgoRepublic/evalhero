import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import type { View } from 'react-big-calendar';
import { Spin, Alert } from 'antd';
import { useLazyGetCalendarDocumentsQuery } from '../../services/profileDocumentsApi';
import type { ProfileDocumentRecord } from '../../services/profileDocumentsApi';
import type { CalendarFiltersState } from './CalendarFilters';
import { DocumentEventModal } from './DocumentEventModal';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar.css';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ProfileDocumentRecord;
}

const DOCUMENT_TYPE_COLORS: Record<string, string> = {
  license: '#3174ad',
  certificate: '#7cb342',
  passport: '#e53935',
  visa: '#fb8c00',
  insurance: '#8e24aa',
  id: '#00acc1',
  other: '#757575',
};

function docToEvent(doc: ProfileDocumentRecord): CalendarEvent {
  const d = doc.expirationDate ? new Date(doc.expirationDate) : new Date();
  return {
    id: doc._id,
    title: doc.title,
    start: d,
    end: d,
    resource: doc,
  };
}

export interface DocumentCalendarProps {
  /** Current date to display; when user picks date in sidebar, pass here */
  currentDate: Date;
  profileIds?: string[];
  /** Admin-only filters (Role, Location, Department, User); sent to API when present */
  adminFilters?: CalendarFiltersState;
  onDateChange?: (date: Date) => void;
}

export const DocumentCalendar: React.FC<DocumentCalendarProps> = ({
  currentDate,
  profileIds,
  adminFilters,
  onDateChange,
}) => {
  const [fetchDocuments, { data: documents = [], isFetching, isError, error }] =
    useLazyGetCalendarDocumentsQuery();
  const [selectedDocument, setSelectedDocument] = useState<ProfileDocumentRecord | null>(null);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(currentDate);

  const events = useMemo(() => documents.map(docToEvent), [documents]);

  useEffect(() => {
    setDate(currentDate);
  }, [currentDate]);

  const fetchRange = useCallback(
    (rangeStart: Date, rangeEnd: Date) => {
      const startDate = rangeStart.toISOString();
      const endDate = rangeEnd.toISOString();

      if (adminFilters) {
        fetchDocuments({
          startDate,
          endDate,
          ...(adminFilters.roleIds.length ? { roles: adminFilters.roleIds } : {}),
          ...(adminFilters.locationIds.length ? { locations: adminFilters.locationIds } : {}),
          ...(adminFilters.departmentIds.length ? { departments: adminFilters.departmentIds } : {}),
          ...(adminFilters.profileIds.length ? { profileIds: adminFilters.profileIds } : {}),
        });
      } else {
        fetchDocuments({
          startDate,
          endDate,
          ...(profileIds?.length ? { profileIds } : {}),
        });
      }
    },
    [fetchDocuments, profileIds, adminFilters]
  );

  const rangeForDateAndView = useMemo(() => {
    if (view === 'month') {
      return { start: startOfMonth(date), end: endOfMonth(date) };
    }
    if (view === 'week') {
      return { start: startOfWeek(date), end: endOfWeek(date) };
    }
    return { start: startOfDay(date), end: endOfDay(date) };
  }, [date, view]);

  useEffect(() => {
    fetchRange(rangeForDateAndView.start, rangeForDateAndView.end);
  }, [rangeForDateAndView.start.getTime(), rangeForDateAndView.end.getTime(), fetchRange]);

  const handleRangeChange = useCallback(
    (range: { start: Date; end: Date } | Date[] | undefined) => {
      if (!range) return;
      if (Array.isArray(range)) {
        const r0 = range[0];
        const r1 = range[range.length - 1];
        if (r0 && r1) fetchRange(r0, r1);
      } else {
        fetchRange(range.start, range.end);
      }
    },
    [fetchRange]
  );

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedDocument(event.resource);
  }, []);

  const handleNavigate = useCallback(
    (newDate: Date) => {
      setDate(newDate);
      onDateChange?.(newDate);
    },
    [onDateChange]
  );

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const doc = event.resource;
    const backgroundColor = DOCUMENT_TYPE_COLORS[doc.documentType] ?? DOCUMENT_TYPE_COLORS.other;
    return {
      style: {
        backgroundColor,
        borderRadius: 6,
        opacity: 0.9,
        color: '#fff',
        border: 'none',
        fontSize: '0.85em',
      },
    };
  }, []);

  return (
    <>
      {isError && (
        <Alert
          type="error"
          message="Failed to load calendar documents"
          description={error && 'message' in error ? String((error as { message?: string }).message) : undefined}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <div className="calendar-wrapper" style={{ position: 'relative' }}>
        {isFetching && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              borderRadius: 8,
            }}
          >
            <Spin size="large" />
          </div>
        )}
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          date={date}
          onView={setView}
          onNavigate={handleNavigate}
          onRangeChange={handleRangeChange}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          views={['month', 'week', 'day']}
          popup
          showMultiDayTimes
        />
      </div>
      <DocumentEventModal
        open={!!selectedDocument}
        onClose={() => setSelectedDocument(null)}
        document={selectedDocument}
      />
    </>
  );
};
