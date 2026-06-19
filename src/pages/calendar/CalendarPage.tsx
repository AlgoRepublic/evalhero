import React, { useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { CalendarOutlined } from '@ant-design/icons';
import { Layout, Grid } from 'antd';
import { useAppSelector } from '../../hooks';
import { CalendarSidebar, type CalendarSourceKey } from './CalendarSidebar';
import { DocumentCalendar } from './DocumentCalendar';
import type { CalendarFiltersState } from './CalendarFilters';

const { Content } = Layout;
const { useBreakpoint } = Grid;

const initialCalendarFilters: CalendarFiltersState = {
  roleIds: [],
  locationIds: [],
  departmentIds: [],
  profileIds: [],
};

export const CalendarPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user, selectedProfile } = useAppSelector((state) => state.auth);
  const isAdmin = user?.isAdmin === true;

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedSourceKey, setSelectedSourceKey] = useState<CalendarSourceKey | null>('profile-documents');
  const [calendarFilters, setCalendarFilters] = useState<CalendarFiltersState>(initialCalendarFilters);

  const profileIds = useMemo(() => {
    if (isAdmin) return undefined;
    if (selectedProfile?._id) return [selectedProfile._id];
    return undefined;
  }, [isAdmin, selectedProfile?._id]);

  const handleDateChange = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  return (
    <>
      <Helmet>
        <title>Calendar - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Calendar"
        breadcrumbs={[
          {
            title: (
              <>
                <CalendarOutlined />
                <span>Calendar</span>
              </>
            ),
          },
          { title: 'Calendar' },
        ]}
      />
      <Layout
        style={{
          background: 'transparent',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'flex-start',
        }}
      >
        {!isMobile && (
          <CalendarSidebar
            currentDate={currentDate}
            onDateChange={handleDateChange}
            selectedSourceKey={selectedSourceKey}
            onSourceSelect={setSelectedSourceKey}
            isAdmin={isAdmin}
            calendarFilters={calendarFilters}
            onCalendarFiltersChange={setCalendarFilters}
          />
        )}
        <Content
          style={{
            flex: 1,
            minWidth: 0,
            padding: isMobile ? 0 : '0 0 24px 0',
          }}
        >
          {selectedSourceKey === 'profile-documents' && (
            <DocumentCalendar
              currentDate={currentDate}
              onDateChange={handleDateChange}
              profileIds={profileIds}
              adminFilters={isAdmin ? calendarFilters : undefined}
            />
          )}
        </Content>
      </Layout>
    </>
  );
};
