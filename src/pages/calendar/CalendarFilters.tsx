import React from 'react';
import { Typography, Select, Button, Space } from 'antd';
import { FilterOutlined, ClearOutlined } from '@ant-design/icons';
import { useGetRolesQuery } from '../../services/roleApi';
import { useGetLocationsQuery } from '../../services/locationsApi';
import { useGetDepartmentsQuery } from '../../services/departmentApi';
import { useGetProfilesQuery } from '../../services/profilesAPI';
import type { Profile } from '../../features/auth/authSlice';
import type { User } from '../../features/auth/authSlice';

const { Text } = Typography;

export interface CalendarFiltersState {
  roleIds: string[];
  locationIds: string[];
  departmentIds: string[];
  profileIds: string[];
}

export interface CalendarFiltersProps {
  value: CalendarFiltersState;
  onChange: (value: CalendarFiltersState) => void;
}

function getProfileLabel(profile: Profile): string {
  const user = typeof profile.user === 'object' && profile.user ? (profile.user as User) : null;
  return user?.name ?? profile._id;
}

export const CalendarFilters: React.FC<CalendarFiltersProps> = ({ value, onChange }) => {
  const { data: rolesData } = useGetRolesQuery();
  const { data: locationsData } = useGetLocationsQuery();
  const { data: departmentsData } = useGetDepartmentsQuery();
  const { data: profilesData } = useGetProfilesQuery({ page: 1, perPage: 200 });

  const roles = rolesData?.data?.roles?.records ?? [];
  const locations = locationsData?.data?.locations?.records ?? [];
  const departments = departmentsData?.data?.departments?.records ?? [];
  const profiles = profilesData?.data?.profiles?.records ?? [];

  const hasActiveFilters =
    value.roleIds.length > 0 ||
    value.locationIds.length > 0 ||
    value.departmentIds.length > 0 ||
    value.profileIds.length > 0;

  const clearAll = () => {
    onChange({
      roleIds: [],
      locationIds: [],
      departmentIds: [],
      profileIds: [],
    });
  };

  const update = (key: keyof CalendarFiltersState, ids: string[]) => {
    onChange({ ...value, [key]: ids });
  };

  return (
    <div style={{ marginTop: 16 }}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        <FilterOutlined /> Filters
      </Text>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Select
          placeholder="Role"
          mode="multiple"
          allowClear
          value={value.roleIds}
          onChange={(ids) => update('roleIds', ids)}
          options={roles.map((r) => ({ value: r._id, label: r.name }))}
          style={{ width: '100%' }}
          maxTagCount="responsive"
        />
        <Select
          placeholder="Location"
          mode="multiple"
          allowClear
          value={value.locationIds}
          onChange={(ids) => update('locationIds', ids)}
          options={locations.map((l) => ({ value: l._id, label: l.name }))}
          style={{ width: '100%' }}
          maxTagCount="responsive"
        />
        <Select
          placeholder="Department"
          mode="multiple"
          allowClear
          value={value.departmentIds}
          onChange={(ids) => update('departmentIds', ids)}
          options={departments.map((d) => ({ value: d._id, label: d.name }))}
          style={{ width: '100%' }}
          maxTagCount="responsive"
        />
        <Select
          placeholder="User"
          mode="multiple"
          allowClear
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
          }
          value={value.profileIds}
          onChange={(ids) => update('profileIds', ids)}
          options={profiles.map((p) => ({ value: p._id, label: getProfileLabel(p) }))}
          style={{ width: '100%' }}
          maxTagCount="responsive"
        />
        {hasActiveFilters && (
          <Button type="link" size="small" icon={<ClearOutlined />} onClick={clearAll}>
            Clear all
          </Button>
        )}
      </Space>
    </div>
  );
};
