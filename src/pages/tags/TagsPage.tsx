import { Helmet } from 'react-helmet-async';
import { PageHeader, ProtectedComponent } from '../../components';
import { TagsOutlined } from '@ant-design/icons';
import { Button, Grid } from 'antd';
import { useNavigate } from 'react-router-dom';
import TagsTable from './components/TagsTable';

const { useBreakpoint } = Grid;

const TagsPage = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  return (
    <div>
      <Helmet>
        <title>Tags - Eval Hero</title>
      </Helmet>
      <PageHeader
        title="Tags"
        breadcrumbs={[
          {
            title: (
              <>
                <TagsOutlined />
                <span>Tags</span>
              </>
            ),
          },
        ]}
      />
      <div>
        <ProtectedComponent permission="tag::create">
          <Button
            onClick={() => navigate('/tags/add')}
            type="primary"
            style={{ marginBottom: 16, width: isMobile ? '100%' : undefined }}
          >
            Add Tag
          </Button>
        </ProtectedComponent>
        <TagsTable />
      </div>
    </div>
  );
};

export { TagsPage };
