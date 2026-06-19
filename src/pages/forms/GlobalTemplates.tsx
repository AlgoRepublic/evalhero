import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../../components';
import { FormOutlined } from '@ant-design/icons';
import { Button, Grid } from 'antd';
import { useNavigate } from 'react-router-dom';
import GlobalTemplatesTable from './components/GlobalTemplatesTable';
import { PATH_FORMS } from '../../constants/routes';

const { useBreakpoint } = Grid;

const GlobalTemplatesPage = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  return (
    <div>
      <Helmet>
        <title>Global Templates - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Global Templates"
        breadcrumbs={[
          {
            title: (
              <>
                <FormOutlined />
                <span>Forms</span>
              </>
            ),
          },
          {
            title: 'Global Templates',
          },
        ]}
      />
      <div>
        <Button
          type="primary"
          style={{ marginBottom: 16, width: isMobile ? '100%' : undefined }}
          onClick={() => navigate(`${PATH_FORMS.globalTemplates}/add`)}
        >
          Add Global Template
        </Button>
        <GlobalTemplatesTable />
      </div>
    </div>
  );
};

export { GlobalTemplatesPage };
