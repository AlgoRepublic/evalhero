import { Descriptions, Space, Tag, Typography } from 'antd';
import { TeamOutlined, EnvironmentOutlined, SafetyOutlined } from '@ant-design/icons';
import type { Profile } from '../../../features/auth/authSlice';

export interface OrganizationDetailsSectionProps {
  profile: Profile;
  isAdmin: boolean;
  roleMap: Map<string, string>;
  departmentMap: Map<string, string>;
  locationMap: Map<string, string>;
  isMobile: boolean;
  createdAtFormatted: string;
  updatedAtFormatted: string;
}

export function OrganizationDetailsSection({
  profile,
  isAdmin,
  roleMap,
  departmentMap,
  locationMap,
  isMobile,
  createdAtFormatted,
  updatedAtFormatted,
}: OrganizationDetailsSectionProps) {
  return (
    <Descriptions
      column={isMobile ? 1 : 2}
      size={isMobile ? 'small' : 'middle'}
      bordered
      labelStyle={{ fontWeight: 500 }}
    >
      <Descriptions.Item label="Organization">
        {profile.organization?.name ?? '—'}
      </Descriptions.Item>
      <Descriptions.Item label="Profile ID">{profile._id ?? '—'}</Descriptions.Item>
      {!isAdmin && (
        <>
          <Descriptions.Item label="Roles" span={2}>
            {profile.roles && profile.roles.length > 0 ? (
              <Space wrap size="small">
                {profile.roles.map((roleItem) => (
                  <Tag key={roleItem._id} color="blue" icon={<SafetyOutlined />}>
                    {roleMap.get(roleItem.role) || roleItem.role}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">No roles assigned</Typography.Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Departments" span={2}>
            {profile.departments && profile.departments.length > 0 ? (
              <Space wrap size="small">
                {profile.departments.map((deptItem) => (
                  <Tag key={deptItem._id} color="purple" icon={<TeamOutlined />}>
                    {departmentMap.get(deptItem.department) || deptItem.department}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">No departments assigned</Typography.Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Locations" span={2}>
            {profile.locations && profile.locations.length > 0 ? (
              <Space wrap size="small">
                {profile.locations.map((locItem) => (
                  <Tag key={locItem._id} color="green" icon={<EnvironmentOutlined />}>
                    {locationMap.get(locItem.location) || locItem.location}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">No locations assigned</Typography.Text>
            )}
          </Descriptions.Item>
        </>
      )}
      <Descriptions.Item label="Created">{createdAtFormatted}</Descriptions.Item>
      <Descriptions.Item label="Updated">{updatedAtFormatted}</Descriptions.Item>
    </Descriptions>
  );
}
