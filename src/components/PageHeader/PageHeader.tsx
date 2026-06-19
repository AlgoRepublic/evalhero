import React from 'react';
import {
  Breadcrumb,
  BreadcrumbProps,
  Divider,
  Grid,
  Space,
  Typography,
} from 'antd';

import './styles.css';
import { Link } from 'react-router-dom';

const { useBreakpoint } = Grid;

type Props = {
  title: string;
  breadcrumbs: BreadcrumbProps['items'];
} & React.HTMLAttributes<HTMLDivElement>;

export const PageHeader = ({ breadcrumbs, title, ...others }: Props) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  return (
    <div {...others}>
      <Space direction="vertical" size={isMobile ? 'small' : 'small'}>
        <Typography.Title
          level={isMobile ? 5 : 4}
          style={{ padding: 0, margin: 0, textTransform: 'capitalize' }}
        >
          {title}
        </Typography.Title>
        <Breadcrumb
          items={breadcrumbs}
          className="page-header-breadcrumbs"
          style={isMobile ? { fontSize: 12 } : undefined}
          itemRender={(route, _, routes) => {
            const isLast = routes.indexOf(route) === routes.length - 1;
            return isLast || !route.path ? (
              <span>{route.title}</span>
            ) : (
              <Link to={route.path}>{route.title}</Link>
            );
          }}
        />
      </Space>
      <Divider orientation="right" plain>
        {/* <span style={{ textTransform: 'capitalize' }}>{title}</span> */}
      </Divider>
    </div>
  );
};
