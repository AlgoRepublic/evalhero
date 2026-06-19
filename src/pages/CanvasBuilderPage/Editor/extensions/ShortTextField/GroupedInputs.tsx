/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Input, Space, Typography, Card, Tag, Button, Tooltip } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import { validateNodeRequirements, getApprovalStatusForSubject } from '../../../../forms/QueuesComponents/questionApprovalUtils';
import type { JSONContent } from '@tiptap/core';

const { Text } = Typography;

interface GroupedInputsProps {
  groups: Array<{ id: string; name: string; subjectIds: string[] }>;
  availableSubjects: Array<{ label: string; value: string }>;
  variant: string;
  placeholder: string;
  minLength?: number | null;
  maxLength?: number | null;
  required: boolean;
  namePrefix?: boolean;
  nameSuffix?: boolean;
  namePrefixRequired?: boolean;
  nameSuffixRequired?: boolean;
  middleName?: boolean;
  middleNameRequired?: boolean;
  phoneCountryIsoCode?: string;
  initialValues: Record<string, string>;
  onValueChange: (groupId: string, value: string) => void;
  subjectsOptions: Array<{ label: string; value: string }>;
  // Approval-related props
  approvalRequired?: boolean;
  approvalStatus?: string | null;
  editor?: any;
  node?: any;
  // Readonly mode
  isReadonly?: boolean;
}

export const GroupedInputs: React.FC<GroupedInputsProps> = ({
  groups,
  availableSubjects,
  variant,
  placeholder,
  // minLength,
  maxLength,
  // required,
  // namePrefix,
  // nameSuffix,
  // namePrefixRequired,
  // nameSuffixRequired,
  // middleName,
  // middleNameRequired,
  // phoneCountryIsoCode,
  initialValues,
  onValueChange,
  subjectsOptions,
  approvalRequired = false,
  approvalStatus = null,
  editor,
  node,
  isReadonly = false,
}) => {
  const { token } = theme.useToken();

  const renderInput = (entityId: string, entityName: string, value: string) => {
    console.log('entityName', entityName);
    const handleChange = (newValue: string) => {
      onValueChange(entityId, newValue);
    };

    if (variant === 'name') {
      // For name variant, we'd need more complex handling
      // For now, render a simple input
      return (
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          maxLength={maxLength || undefined}
          size="middle"
          disabled={isReadonly}
          readOnly={isReadonly}
        />
      );
    }

    return (
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        maxLength={maxLength || undefined}
        size="middle"
        type={variant === 'email' ? 'email' : 'text'}
        disabled={isReadonly}
        readOnly={isReadonly}
      />
    );
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* Render inputs for each group */}
      {groups.map((group) => {
        const groupSubjects = group.subjectIds
          .map((id) => subjectsOptions.find((opt) => opt.value === id))
          .filter(Boolean)
          .map((opt) => opt?.label)
          .join(', ');

        const entityId = `group-${group.id}`;
        const value = initialValues[entityId] || '';

        return (
          <Card
            key={entityId}
            size="small"
            style={{
              background: token.colorFillAlter,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
            title={
              <Space>
                <Text strong>Group: {group.name}</Text>
                <Tag color="blue">{groupSubjects}</Tag>
              </Space>
            }
          >
            {renderInput(entityId, `Group: ${group.name}`, value)}
            
            {/* Approval Status and Request Button for Group */}
            {approvalRequired && (() => {
              // Get global groups and available subjects from editor storage
              const globalGroups = (editor?.storage as any)?.formBuilder?.globalGroups || [];
              const globalAvailableSubjects = (editor?.storage as any)?.formBuilder?.availableSubjects || [];
              
              // Get approval status for this specific group
              const groupApprovalStatus = node ? getApprovalStatusForSubject(
                node as JSONContent,
                group.subjectIds[0] || '', // Use first subject ID to get group status
                globalGroups
              ) : approvalStatus;
              
              // Validate if requirements are fulfilled for this group
              // For groups, we check if the group value is valid
              const requirementsValid = node && value 
                ? validateNodeRequirements(
                    node as JSONContent,
                    group.subjectIds[0] || '',
                    globalGroups,
                    globalAvailableSubjects
                  ).ok
                : !!value;
              
              // Show approval status badge
              // Don't show tag when status is "pending" - that means approval hasn't been requested yet
              const getStatusBadge = () => {
                if (groupApprovalStatus === 'approved') {
                  return (
                    <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 11 }}>
                      Approved
                    </Tag>
                  );
                }
                // Skip "pending" status - don't show tag when approval hasn't been requested yet
                if (groupApprovalStatus === 'rejected') {
                  return (
                    <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 11 }}>
                      Rejected
                    </Tag>
                  );
                }
                if (groupApprovalStatus === 'requested') {
                  return (
                    <Tag icon={<ClockCircleOutlined />} color="processing" style={{ fontSize: 11 }}>
                      Pending
                    </Tag>
                  );
                }
                return null;
              };
              
              return (
                <div style={{ marginTop: 8 }}>
                  <Space>
                    {getStatusBadge()}
                    {!isReadonly && (
                      <Tooltip 
                        title={
                          !requirementsValid 
                            ? 'Please fill this field before requesting approval' 
                            : groupApprovalStatus === 'approved'
                            ? 'This question has been approved. You can still view the conversation.'
                            : ''
                        }
                      >
                        <Button
                          size="small"
                          type={groupApprovalStatus === 'rejected' ? 'primary' : 'default'}
                          danger={groupApprovalStatus === 'rejected'}
                          onClick={() => {
                            const openDrawer = (editor?.storage as any)?.formBuilder?.openQuestionApprovalDrawer;
                            if (openDrawer && node) {
                              const subjectContext = {
                                type: 'group' as const,
                                subjectId: group.subjectIds || [],
                                subjectName: groupSubjects,
                                groupId: group.id,
                                groupName: group.name,
                              };
                              openDrawer(
                                {
                                  type: node.type.name,
                                  attrs: node.attrs,
                                  content: node.content,
                                },
                                subjectContext
                              );
                            }
                          }}
                          disabled={!requirementsValid}
                          style={{ 
                            fontSize: 11,
                            opacity: groupApprovalStatus === 'approved' ? 0.6 : 1,
                          }}
                        >
                          {groupApprovalStatus === 'rejected' 
                            ? 'Re-request Approval' 
                            : groupApprovalStatus === 'approved'
                            ? 'View Approval'
                            : 'Request Approval'}
                        </Button>
                      </Tooltip>
                    )}
                  </Space>
                </div>
              );
            })()}
          </Card>
        );
      })}

      {/* Render inputs for each ungrouped subject */}
      {availableSubjects.map((subject) => {
        const entityId = `ungrouped-${subject.value}`;
        const value = initialValues[entityId] || '';

        return (
          <Card
            key={entityId}
            size="small"
            style={{
              background: token.colorFillAlter,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
            title={<Text strong>Ungrouped: {subject.label}</Text>}
          >
            {renderInput(entityId, `Ungrouped: ${subject.label}`, value)}
            
            {/* Approval Status and Request Button for Ungrouped Subject */}
            {approvalRequired && (() => {
              // Get global groups and available subjects from editor storage
              const globalGroups = (editor?.storage as any)?.formBuilder?.globalGroups || [];
              const globalAvailableSubjects = (editor?.storage as any)?.formBuilder?.availableSubjects || [];
              
              // Get approval status for this specific subject
              const subjectApprovalStatus = node ? getApprovalStatusForSubject(
                node as JSONContent,
                subject.value,
                globalGroups
              ) : approvalStatus;
              
              // Validate if requirements are fulfilled for this subject
              const requirementsValid = node
                ? validateNodeRequirements(
                    node as JSONContent,
                    subject.value,
                    globalGroups,
                    globalAvailableSubjects
                  ).ok
                : !!value;
              
              // Show approval status badge
              // Don't show tag when status is "pending" - that means approval hasn't been requested yet
              const getStatusBadge = () => {
                if (subjectApprovalStatus === 'approved') {
                  return (
                    <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 11 }}>
                      Approved
                    </Tag>
                  );
                }
                // Skip "pending" status - don't show tag when approval hasn't been requested yet
                if (subjectApprovalStatus === 'rejected') {
                  return (
                    <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 11 }}>
                      Rejected
                    </Tag>
                  );
                }
                if (subjectApprovalStatus === 'requested') {
                  return (
                    <Tag icon={<ClockCircleOutlined />} color="processing" style={{ fontSize: 11 }}>
                      Pending
                    </Tag>
                  );
                }
                return null;
              };
              
              return (
                <div style={{ marginTop: 8 }}>
                  <Space>
                    {getStatusBadge()}
                    {!isReadonly && (
                      <Tooltip 
                        title={
                          !requirementsValid 
                            ? 'Please fill this field before requesting approval' 
                            : subjectApprovalStatus === 'approved'
                            ? 'This question has been approved. You can still view the conversation.'
                            : ''
                        }
                      >
                        <Button
                          size="small"
                          type={subjectApprovalStatus === 'rejected' ? 'primary' : 'default'}
                          danger={subjectApprovalStatus === 'rejected'}
                          onClick={() => {
                            const openDrawer = (editor?.storage as any)?.formBuilder?.openQuestionApprovalDrawer;
                            if (openDrawer && node) {
                              const subjectContext = {
                                type: 'ungrouped' as const,
                                subjectId: [subject.value],
                                subjectName: subject.label,
                              };
                              openDrawer(
                                {
                                  type: node.type.name,
                                  attrs: node.attrs,
                                  content: node.content,
                                },
                                subjectContext
                              );
                            }
                          }}
                          disabled={!requirementsValid}
                          style={{ 
                            fontSize: 11,
                            opacity: subjectApprovalStatus === 'approved' ? 0.6 : 1,
                          }}
                        >
                          {subjectApprovalStatus === 'rejected' 
                            ? 'Re-request Approval' 
                            : subjectApprovalStatus === 'approved'
                            ? 'View Approval'
                            : 'Request Approval'}
                        </Button>
                      </Tooltip>
                    )}
                  </Space>
                </div>
              );
            })()}
          </Card>
        );
      })}
    </Space>
  );
};

