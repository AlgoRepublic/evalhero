import React from 'react';
import { Typography, Pagination, Row, Col, Grid, theme, Spin } from 'antd';

interface ResponsivePaginationProps {
  page: number;
  perPage: number;
  total: number;
  onChange: (page: number, perPage: number) => void;
  pageSizeOptions?: string[];
  loading?: boolean;
}

const { useBreakpoint } = Grid;

export const ResponsivePagination: React.FC<ResponsivePaginationProps> = ({
  page,
  perPage,
  total,
  onChange,
  pageSizeOptions = ['5', '10', '20', '50'],
  loading = false,
}) => {
  const screens = useBreakpoint();
  const isMD = screens.md; // Below md (768px) is mobile
  const isMobile = screens.xs; // Below sm (576px) is extra small
  const isSM = screens.sm;

  const {
    token: { 
      colorBgContainer, 
      borderRadiusLG, 
      paddingSM, 
      paddingMD, 
      marginSM, 
      marginMD,
      boxShadowTertiary,
      colorBorderSecondary,
      colorTextSecondary,
      colorTextTertiary,
    },
  } = theme.useToken();

  const startItem = (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, total);
  
  // Don't render if no items
  if (total === 0) {
    return null;
  }

  return (
    <div
      style={{
        padding: isSM ? `${paddingSM}px ${paddingSM}px` : `${paddingMD}px ${paddingMD * 1.5}px`,
        background: colorBgContainer,
        borderRadius: borderRadiusLG,
        marginTop: isSM ? marginSM : marginMD,
        border: `1px solid ${colorBorderSecondary}`,
        boxShadow: boxShadowTertiary,
        transition: 'all 0.2s ease',
      }}
    >
      <Spin spinning={loading} tip={isSM ? undefined : 'Loading...'}>
        <Row 
          gutter={isMobile ? [0, 16] : [24, 0]} 
          justify="space-between" 
          align="middle"
        >
          <Col 
            xs={24} 
            sm={10}
            md={8}
            lg={8}
            flex={isMobile ? undefined : '1 1 auto'}
            style={{ 
              textAlign: isMobile ? 'center' : 'left',
              marginBottom: isMobile ? 12 : 0,
              minWidth: 0, // Prevent overflow
            }}
          >
            <Typography.Text 
              type="secondary"
              style={{ 
                fontSize: isMobile ? '13px' : '14px',
                display: 'block',
                color: colorTextSecondary,
                fontWeight: isMobile ? 400 : 500,
                // lineHeight: 1.5,
              }}
            >
              {/* {isMobile ? (
                <span>
                  <strong style={{ color: colorTextTertiary }}>{startItem}–{endItem}</strong>
                  {' '}of{' '}
                  <strong style={{ color: colorTextTertiary }}>{total}</strong>
                </span>
              ) : (
                <> */}
                  Showing{' '}
                  <strong style={{ color: colorTextTertiary }}>
                    {startItem}–{endItem}
                  </strong>
                  {' '}of{' '}
                  <strong style={{ color: colorTextTertiary }}>{total}</strong>
                  {' '}items
                {/* </>
              )} */}
            </Typography.Text>
          </Col>

          <Col 
            xs={24} 
            sm={14}
            md={16}
            lg={16}
            flex={isMobile ? undefined : '0 0 auto'}
            style={{ 
              textAlign: isMobile ? 'center' : 'right',
              display: 'flex',
              justifyContent: isMobile ? 'center' : 'flex-end',
              alignItems: 'center',
            }}
          >
            <Pagination
              current={page}
              pageSize={perPage}
              total={total}
              showSizeChanger={isMD}
              pageSizeOptions={pageSizeOptions}
              onChange={onChange}
              onShowSizeChange={onChange}
              showQuickJumper={isMD}
              showTotal={undefined}
              size={isMobile ? 'small' : 'default'}
              style={{ 
                fontSize: isMobile ? '13px' : undefined,
              }}
              responsive
              simple={isMobile}
            />
          </Col>
        </Row>
      </Spin>
    </div>
  );
};
