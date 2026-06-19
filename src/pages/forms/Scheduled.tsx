// src/pages/schedules/SchedulesPage.tsx
import { Helmet } from 'react-helmet-async';
import { PageHeader, ProtectedComponent } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import SchedulesTable from './ScheduledComponents/SchedulesTable';
import { useNavigate } from 'react-router-dom';
import { Button, Grid } from 'antd';

const { useBreakpoint } = Grid;

export const SchedulesPage = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  return (
    <>
      <Helmet>
        <title>Scheduled Assignments - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Scheduled Assignments"
        breadcrumbs={[
          {
            title: (
              <>
                <FormOutlined />
                <span>Forms</span>
              </>
            ),
          },
          { title: 'Schedules' },
        ]}
      />
      <div>
        <ProtectedComponent permission="schedule::create">
          <Button
            onClick={() => navigate('/forms/schedules/add')}
            type="primary"
            style={{ marginBottom: 16, width: isMobile ? '100%' : undefined }}
          >
            Add Schedule
          </Button>
        </ProtectedComponent>
        <SchedulesTable />
      </div>
    </>
  );
};
