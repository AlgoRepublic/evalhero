import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Form,
  Row,
  Col,
  Select,
  InputNumber,
  Button,
  Space,
  Typography,
  Switch,
  Divider,
  message,
  Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { InlineFormBlock } from '../../../types/course';
import { useGetTemplatesQuery } from '../../../services/templatesAPI';
import type { ConfigSet } from '../../../services/templatesAPI';
import { useListConfigSetsQuery } from '../../../services/configSetsApi';
import {
  buildConfigSetSelectGroupedOptions,
  getConfigSetFromValue,
  normalizeConfigSetValue,
} from '../../forms/utils/configSetSelectUtils';
// import { useGetCourseRolesQuery } from '../../../services/coursesApi';
import { useGetProfilesQuery } from '../../../services/profilesAPI';
import { Profile } from '../../../features/auth/authSlice';
import type { CourseInlineFormConfigSet } from '../../../types/course';

const { Text } = Typography;

/** Resolve form template ID (API may return string or populated object). */
function getFormTemplateId(formTemplate: InlineFormBlock['formTemplate']): string | undefined {
  if (!formTemplate) return undefined;
  return typeof formTemplate === 'string' ? formTemplate : formTemplate._id;
}

interface InlineFormBlockEditorProps {
  value?: InlineFormBlock[];
  onChange?: (blocks: InlineFormBlock[]) => void;
  courseId?: string;
}

const InlineFormBlockEditor: React.FC<InlineFormBlockEditorProps> = ({
  value = [],
  onChange,
  // courseId,
}) => {
  const [blocks, setBlocks] = useState<InlineFormBlock[]>(value);
  const { data: templatesData } = useGetTemplatesQuery({
    page: 1,
    perPage: 100,
  });
  // useGetCourseRolesQuery(courseId || '', { skip: !courseId });
  const { data: profilesData } = useGetProfilesQuery({
    page: 1,
    perPage: 100,
  });
  const templates = useMemo(() => templatesData?.data?.records ?? [], [templatesData?.data?.records]);
  const profiles = profilesData?.data?.profiles?.records || [];
  const { data: globalConfigSetsData } = useListConfigSetsQuery({ page: 1, perPage: 200 });
  const globalConfigSets = useMemo(
    () => globalConfigSetsData?.data?.configSets?.records?.filter((r) => !r.deletedAt) ?? [],
    [globalConfigSetsData?.data?.configSets?.records]
  );

  /** Per-block selected config set id (for dropdown + reset). Keyed by formBlockId. */
  const [selectedConfigSetIdByBlock, setSelectedConfigSetIdByBlock] = useState<Record<string, string>>({});

  useEffect(() => {
    if (JSON.stringify(value) !== JSON.stringify(blocks)) {
      setBlocks(value);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // When blocks load with a configSet (e.g. from API), set the Config Set dropdown to the matching template or global value
  useEffect(() => {
    if (blocks.length === 0 || templates.length === 0) return;
    setSelectedConfigSetIdByBlock((prev) => {
      let next = { ...prev };
      for (const block of blocks) {
        if (!block.configSet?.hasApproval) continue;
        if (prev[block.formBlockId] != null) continue; // already selected by user
        const template =
          typeof block.formTemplate === 'object' &&
          block.formTemplate != null &&
          'configSets' in block.formTemplate
            ? (block.formTemplate as { configSets?: Array<{ _id?: string; name?: string }> })
            : templates.find((t) => t._id === getFormTemplateId(block.formTemplate));
        const configSetsList = template?.configSets ?? [];
        const configSetId =
          (block.configSet as { _id?: string })?._id ||
          configSetsList.find((cs) => cs.name === block.configSet?.name)?._id;
        if (configSetId) {
          const normalized = normalizeConfigSetValue(
            configSetId,
            configSetsList,
            globalConfigSets
          );
          if (normalized) next = { ...next, [block.formBlockId]: normalized };
        }
      }
      return next;
    });
  }, [blocks, templates, globalConfigSets]);

  const updateBlocks = (newBlocks: InlineFormBlock[]) => {
    setBlocks(newBlocks);
    onChange?.(newBlocks);
  };

  const addBlock = () => {
    const newBlock: InlineFormBlock = {
      formBlockId: `block-${Date.now()}`,
      configSet: null,
    };
    updateBlocks([...blocks, newBlock]);
  };

  const removeBlock = (index: number) => {
    updateBlocks(blocks.filter((_, i) => i !== index));
  };

  const updateBlock = (index: number, block: InlineFormBlock) => {
    const newBlocks = [...blocks];
    newBlocks[index] = block;
    updateBlocks(newBlocks);
  };

  const templatesOptions = templates.map((t) => ({
    label: t.name,
    value: t._id,
  }));

  const approversOptions = profiles.map((profile: Profile) => ({
    value: profile._id,
    label:
      (typeof profile.user === 'object' && profile.user !== null
        ? (profile.user as { name?: string })?.name
        : undefined) ?? profile._id,
  }));

  /** Map template ConfigSet to course block configSet (extract IDs for approvers / questionApprovers / omitSignatureApprovers). */
  const configSetToBlockConfigSet = useCallback((cs: ConfigSet): CourseInlineFormConfigSet => {
    const approverIds = (cs.approvers || [])
      .map((a) => (typeof a === 'string' ? a : a._id))
      .filter(Boolean) as string[];
    const questionApproverIds = (cs.questionApprovers || [])
      .map((a) => (typeof a === 'string' ? a : a._id))
      .filter(Boolean) as string[];
    const omitIds = (cs.omitSignatureApprovers || [])
      .map((a) => (typeof a === 'string' ? a : a._id))
      .filter(Boolean) as string[];
    return {
      name: cs.name ?? 'Form Approval Config',
      hasApproval: cs.hasApproval ?? true,
      hasDisputes: cs.hasDisputes ?? false,
      signatureRequired: cs.signatureRequired ?? false,
      omitSignatureAllowed: cs.omitSignatureAllowed ?? false,
      omitSignatureApprovers: omitIds,
      approvalRule: cs.approvalRule ?? 'ALL',
      approvalMinCount: cs.approvalMinCount ?? 1,
      approvers: approverIds,
      questionApprovers: questionApproverIds,
    };
  }, []);

  const handleConfigSetChange = (index: number, block: InlineFormBlock, value: string | undefined) => {
    if (!value) {
      setSelectedConfigSetIdByBlock((prev) => {
        const next = { ...prev };
        delete next[block.formBlockId];
        return next;
      });
      updateBlock(index, { ...block, configSet: null });
      return;
    }
    const templateId = getFormTemplateId(block.formTemplate);
    const selectedTemplate = templates.find((t) => t._id === templateId);
    const configSet = getConfigSetFromValue(
      value,
      selectedTemplate?.configSets,
      globalConfigSets
    ) as ConfigSet | undefined;
    if (configSet) {
      setSelectedConfigSetIdByBlock((prev) => ({ ...prev, [block.formBlockId]: value }));
      updateBlock(index, {
        ...block,
        configSet: configSetToBlockConfigSet(configSet),
      });
      message.success(`Config set "${configSet.name}" applied`);
    }
  };

  const handleResetConfigSet = (index: number, block: InlineFormBlock) => {
    const value = selectedConfigSetIdByBlock[block.formBlockId];
    if (!value) {
      message.warning('No config set selected');
      return;
    }
    const templateId = getFormTemplateId(block.formTemplate);
    const selectedTemplate = templates.find((t) => t._id === templateId);
    const configSet = getConfigSetFromValue(
      value,
      selectedTemplate?.configSets,
      globalConfigSets
    ) as ConfigSet | undefined;
    if (configSet) {
      updateBlock(index, {
        ...block,
        configSet: configSetToBlockConfigSet(configSet),
      });
      message.success(`Config set "${configSet.name}" reset`);
    }
  };

  const formItemStyle = { marginBottom: 4 };
  const dividerStyle = { margin: '6px 0', fontSize: 12 };

  return (
    <Card size="small" bodyStyle={{ padding: 12 }}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text strong style={{ fontSize: 13 }}>Inline Form Blocks</Text>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addBlock}>
            Add Form Block
          </Button>
        </div>

        {blocks.map((block, index) => (
          <Card
            key={block._id || block.formBlockId || index}
            size="small"
            style={{ marginTop: 6 }}
            bodyStyle={{ padding: 10 }}
          >
            <Form layout="vertical" size="small">
              {/* Basics: Template only (type, startDate, timezone, subjectMode, subjects are hidden and sent as defaults from parent) */}
              <Divider style={{ ...dividerStyle, marginTop: 0 }}>Basics</Divider>
              <Row gutter={[12, 6]}>
                <Col xs={24} md={12} lg={8}>
                  <Form.Item label="Form Template" style={formItemStyle}>
                    <Select
                      placeholder="Select form template"
                      value={getFormTemplateId(block.formTemplate)}
                      onChange={(formTemplate) => {
                        const template = templates.find((t) => t._id === formTemplate);
                        setSelectedConfigSetIdByBlock((prev) => {
                          const next = { ...prev };
                          delete next[block.formBlockId];
                          return next;
                        });
                        console.log("template", template);
                        updateBlock(index, {
                          ...block,
                          formTemplate: template,
                          formTemplateSchema: template?.currentFormTemplateSchema?._id,
                        });
                      }}
                      style={{ width: '100%' }}
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      options={templatesOptions}
                    />
                  </Form.Item>
                </Col>
                {(() => {
                  const templateId = getFormTemplateId(block.formTemplate);
                  const selectedTemplate =
                    typeof block.formTemplate === 'object' &&
                    block.formTemplate !== null &&
                    'configSets' in block.formTemplate
                      ? (block.formTemplate as { configSets?: Array<{ _id?: string; name?: string }>; _id?: string; name?: string })
                      : templates.find((t) => t._id === templateId);
                  const groupedOptions = buildConfigSetSelectGroupedOptions(
                    selectedTemplate?.configSets,
                    globalConfigSets,
                    selectedTemplate?.name
                  );
                  const selectedConfigSetId = selectedConfigSetIdByBlock[block.formBlockId];
                  const hasOptions = groupedOptions.some((g) => g.options.length > 0);
                  return (
                    <Col xs={24} md={12} lg={8}>
                      <Form.Item
                        label="Config Set (Optional)"
                        style={formItemStyle}
                        tooltip="Select a config set to pre-fill approval settings (from template or global)"
                      >
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Select
                            placeholder="Select config set"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            filterOption={(input, opt) =>
                              (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                            }
                            value={selectedConfigSetId ?? undefined}
                            onChange={(val) => handleConfigSetChange(index, block, val)}
                            disabled={!hasOptions}
                            options={groupedOptions}
                            style={{ flex: 1 }}
                            size="small"
                          />
                          {selectedConfigSetId && (
                            <Tooltip title="Reset to config set values">
                              <Button
                                type="text"
                                size="small"
                                icon={<ReloadOutlined />}
                                onClick={() => handleResetConfigSet(index, block)}
                              />
                            </Tooltip>
                          )}
                        </div>
                      </Form.Item>
                    </Col>
                  );
                })()}
              </Row>

              {/* Approvals (configSet) */}
              <Divider style={dividerStyle}>Approvals</Divider>
              <Row gutter={[12, 6]}>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item label="Approval Required" style={formItemStyle}>
                    <Switch
                      checked={!!block.configSet?.hasApproval}
                      onChange={(checked) =>
                        updateBlock(index, {
                          ...block,
                          configSet: checked
                            ? {
                                name: block.configSet?.name ?? 'Form Approval Config',
                                hasApproval: true,
                                hasDisputes: false,
                                signatureRequired: false,
                                omitSignatureAllowed: false,
                                omitSignatureApprovers: [],
                                approvalRule:
                                  (block.configSet?.approvalRule as 'ALL' | 'ANY' | 'MIN') ?? 'ALL',
                                approvalMinCount: block.configSet?.approvalMinCount ?? 1,
                                approvers: (block.configSet?.approvers as string[]) ?? [],
                              }
                            : null,
                        })
                      }
                    />
                  </Form.Item>
                </Col>
                {block.configSet?.hasApproval && (
                  <>
                    <Col xs={24} md={12}>
                      <Form.Item label="Approvers" style={{ marginBottom: 8 }}>
                        <Select
                          mode="multiple"
                          placeholder="Select approvers"
                          value={Array.isArray(block.configSet.approvers)
                            ? (block.configSet.approvers as (string | Profile)[]).map((a) =>
                                typeof a === 'string' ? a : a._id
                              )
                            : []}
                          onChange={(ids: string[]) =>
                            updateBlock(index, {
                              ...block,
                              configSet: block.configSet
                                ? { ...block.configSet, approvers: ids }
                                : null,
                            })
                          }
                          style={{ width: '100%' }}
                          showSearch
                          filterOption={(input, option) =>
                            (option?.label ?? '')
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          options={approversOptions}
                          size="small"
                          maxTagCount="responsive"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="Question Approvers" style={{ marginBottom: 8 }}>
                        <Select
                          mode="multiple"
                          placeholder="Select question approvers (optional)"
                          value={Array.isArray(block.configSet.questionApprovers)
                            ? (block.configSet.questionApprovers as (string | Profile)[]).map((a) =>
                                typeof a === 'string' ? a : a._id
                              )
                            : []}
                          onChange={(ids: string[]) =>
                            updateBlock(index, {
                              ...block,
                              configSet: block.configSet
                                ? { ...block.configSet, questionApprovers: ids }
                                : null,
                            })
                          }
                          style={{ width: '100%' }}
                          showSearch
                          filterOption={(input, option) =>
                            (option?.label ?? '')
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          options={approversOptions}
                          size="small"
                          maxTagCount="responsive"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item label="Approval Rule" style={formItemStyle}>
                        <Select
                          placeholder="Rule"
                          value={block.configSet.approvalRule ?? 'ALL'}
                          onChange={(approvalRule) =>
                            updateBlock(index, {
                              ...block,
                              configSet: block.configSet
                                ? {
                                    ...block.configSet,
                                    approvalRule: approvalRule as 'ALL' | 'ANY' | 'MIN',
                                  }
                                : null,
                            })
                          }
                          style={{ width: '100%' }}
                          size="small"
                          options={[
                            { value: 'ALL', label: 'All must approve' },
                            { value: 'ANY', label: 'Any can approve' },
                            { value: 'MIN', label: 'Minimum count' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    {block.configSet.approvalRule === 'MIN' && (
                      <Col xs={24} sm={12} md={8}>
                        <Form.Item label="Min Approvals" style={{ marginBottom: 8 }}>
                          <InputNumber
                            placeholder="Min"
                            value={block.configSet.approvalMinCount ?? 1}
                            onChange={(approvalMinCount) =>
                              updateBlock(index, {
                                ...block,
                                configSet: block.configSet
                                  ? {
                                      ...block.configSet,
                                      approvalMinCount: approvalMinCount ?? 0,
                                    }
                                  : null,
                              })
                            }
                            style={{ width: '100%' }}
                            min={1}
                            size="small"
                          />
                        </Form.Item>
                      </Col>
                    )}
                  </>
                )}
              </Row>

              <div style={{ marginTop: 4 }}>
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeBlock(index)}
                >
                  Remove Block
                </Button>
              </div>
            </Form>
          </Card>
        ))}
      </Space>
    </Card>
  );
};

export default InlineFormBlockEditor;
