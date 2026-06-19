import React, { useCallback } from 'react';
import {
  Button,
  Col,
  Form,
  Grid,
  Input,
  Row,
  Typography,
  Card,
  Space,
  theme,
  message,
  Affix,
  Tooltip,
  Divider,
} from 'antd';
import { SaveOutlined, FormOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useCreateTemplateMutation, ConfigSet } from '../../../services/templatesAPI';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  useGetSubjectsQuery,
  useGetApproversQuery,
  useGetOmitSignatureApproversQuery,
} from '../../../services/assignmentsApi';
import { User } from '../../../features/auth/authSlice';
import ConfigSetForm from './ConfigSetForm';
import { JSONContent } from '@tiptap/core';

const { Title } = Typography;
const { useBreakpoint } = Grid;

const AddTemplate: React.FC = () => {
  const screens = useBreakpoint();
  const isXS = !screens.sm;
  const isMobile = !screens.md;
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const folderId = (location.state as { folderId?: string | null } | null)?.folderId ?? undefined;

  // Responsive spacing & sizes
  const headerPadding = isXS ? token.paddingSM : isMobile ? token.paddingMD : token.paddingLG;
  const formRowGutter: [number, number] = isXS ? [12, 12] : isMobile ? [16, 16] : [24, 24];
  const cardPadding = isXS ? 0 : isMobile ? token.paddingMD : token.paddingLG;
  const dividerMargin = isMobile ? { marginTop: 16, marginBottom: 12 } : { marginTop: 24, marginBottom: 16 };
  const configCardMargin = isMobile ? 8 : 12;
  const configCardBodyPadding = isMobile ? '8px 12px' : '12px 16px';
  const inputSize = isXS ? 'small' : 'middle';
  const buttonSize = isMobile ? 'small' : 'middle';
  const pageMarginTop = isMobile ? token.marginMD : token.marginLG;
  const emptyStatePadding = isMobile ? '12px 16px' : '16px 24px';
  const emptyStateFontSize = isMobile ? 12 : 13;
  const cardTitleGutter: [number, number] = isXS ? [4, 4] : [8, 8];


  // RTK Query Mutations
  const [createTemplate, { isLoading: isCreating }] =
    useCreateTemplateMutation();

  const { data: subjectsRes, isLoading: subjectsLoading } = useGetSubjectsQuery();
  const { data: approversRes, isLoading: approversLoading } = useGetApproversQuery();
  const { data: omitSignatureApproversRes, isLoading: omitSignatureApproversLoading } = useGetOmitSignatureApproversQuery();

  const isSaving = isCreating;

  const subjects = subjectsRes?.data || [];
  const approvers = approversRes?.data || [];
  const omitSignatureApprovers = omitSignatureApproversRes?.data || [];

  const subjectsOptions = subjects.map((profile) => ({
    label: (profile.user as User)?.name,
    value: profile._id,
  }));

  const approversOptions = approvers.map((profile) => ({
    label: (profile.user as User)?.name,
    value: profile._id,
  }));

  const omitSignatureApproversOptions = omitSignatureApprovers.map((profile) => ({
    label: (profile.user as User)?.name,
    value: profile._id,
  }));

  // No template-level approval/dispute/signature controls anymore

  // Form values type
  interface TemplateFormValues {
    name: string;
    description: string;
    configSets?: (Omit<ConfigSet, 'omitSignatureApprovers' | 'questionApprovers'> & { omitSignatureApprovers?: string[]; questionApprovers?: string[] })[];
  }

  // Helper to build JSON body with the nested structure for configSets
  const buildTemplateFormData = (
    body: {
      name: string;
      description?: string;
      folder?: string | null;
      configSets?: ConfigSet[];
      schema: JSONContent;
      totalScore?: number;
      totalPassFail?: number;
    }
  ): Record<string, unknown> => {
    const result: Record<string, unknown> = {
      name: body.name,
    };

    // Add basic fields
    if (body.description) result.description = body.description;
    if (body.folder !== undefined) result.folder = body.folder ?? null;

    // Add schema (required for create)
    result.schema = body.schema;
    
    // Scoring: totalScore and totalPassFail (0 for new template with empty schema)
    result.totalScore = typeof body.totalScore === 'number' ? body.totalScore : 0;
    result.totalPassFail = typeof body.totalPassFail === 'number' ? body.totalPassFail : 0;
    
    // Add configSets in the nested format
    if (body.configSets && Array.isArray(body.configSets)) {
      result.configSets = body.configSets.map((configSet) => {
        const configSetAction = configSet.action || 'add';
        const configSetObj: Record<string, unknown> = {
          action: configSetAction,
        };
        
        // Build configSet nested object
        const nestedConfigSet: Record<string, unknown> = {};
        
        if (configSet.name) {
          nestedConfigSet.name = configSet.name;
        }
        
        if (configSet.hasApproval !== undefined) {
          nestedConfigSet.hasApproval = configSet.hasApproval;
        }
        
        if (configSet.hasDisputes !== undefined) {
          nestedConfigSet.hasDisputes = configSet.hasDisputes;
        }
        
        if (configSet.signatureRequired !== undefined) {
          nestedConfigSet.signatureRequired = configSet.signatureRequired;
        }
        
        if (configSet.approvalRule) {
          nestedConfigSet.approvalRule = configSet.approvalRule;
        }
        
        if (configSet.approvalMinCount !== undefined) {
          nestedConfigSet.approvalMinCount = configSet.approvalMinCount;
        }
        
        if (configSet.omitSignatureAllowed !== undefined) {
          nestedConfigSet.omitSignatureAllowed = configSet.omitSignatureAllowed;
        }
        
        // Add omitSignatureApprovers (only include if action is "add" or "remove")
        if (configSet.omitSignatureApprovers && Array.isArray(configSet.omitSignatureApprovers) && configSet.omitSignatureApprovers.length > 0) {
          const omitSignatureApprovers = configSet.omitSignatureApprovers
            .filter((item) => {
              const itemAction = typeof item === 'string' ? 'add' : (item.action || 'add');
              return itemAction === 'add' || itemAction === 'remove';
            })
            .map((item) => {
              const itemId = typeof item === 'string' ? item : item._id;
              const itemAction = typeof item === 'string' ? 'add' : (item.action || 'add');
              return {
                action: itemAction,
                _id: itemId,
              };
            });
          
          if (omitSignatureApprovers.length > 0) {
            nestedConfigSet.omitSignatureApprovers = omitSignatureApprovers;
          }
        }
        
        // Add approvers (only include if action is "add" or "remove")
        if (configSet.approvers && Array.isArray(configSet.approvers) && configSet.approvers.length > 0) {
          const approvers = configSet.approvers
            .filter((approver) => {
              const approverAction = typeof approver === 'string' ? 'add' : (approver.action || 'add');
              return approverAction === 'add' || approverAction === 'remove';
            })
            .map((approver) => {
              const approverId = typeof approver === 'string' ? approver : approver._id;
              const approverAction = typeof approver === 'string' ? 'add' : (approver.action || 'add');
              return {
                action: approverAction,
                _id: approverId,
              };
            });
          
          if (approvers.length > 0) {
            nestedConfigSet.approvers = approvers;
          }
        }

        // Add questionApprovers (only include if action is "add" or "remove")
        if (configSet.questionApprovers && Array.isArray(configSet.questionApprovers) && configSet.questionApprovers.length > 0) {
          const questionApprovers = configSet.questionApprovers
            .filter((item) => {
              const itemAction = typeof item === 'string' ? 'add' : (item.action || 'add');
              return itemAction === 'add' || itemAction === 'remove';
            })
            .map((item) => {
              const itemId = typeof item === 'string' ? item : item._id;
              const itemAction = typeof item === 'string' ? 'add' : (item.action || 'add');
              return { action: itemAction, _id: itemId };
            });
          if (questionApprovers.length > 0) {
            nestedConfigSet.questionApprovers = questionApprovers;
          }
        }

        // Add subjects (only include if action is "add" or "remove")
        if (configSet.subjects && Array.isArray(configSet.subjects) && configSet.subjects.length > 0) {
          const subjects = configSet.subjects
            .filter((subject) => {
              const subjectAction = typeof subject === 'string' ? 'add' : (subject.action || 'add');
              return subjectAction === 'add' || subjectAction === 'remove';
            })
            .map((subject) => {
              const subjectId = typeof subject === 'string' ? subject : subject._id;
              const subjectAction = typeof subject === 'string' ? 'add' : (subject.action || 'add');
              return {
                action: subjectAction,
                _id: subjectId,
              };
            });
          
          if (subjects.length > 0) {
            nestedConfigSet.subjects = subjects;
          }
        }
        
        configSetObj.configSet = nestedConfigSet;
        return configSetObj;
      });
    }
    
    return result;
  };

  // Convert form values to API structure with actions
  const convertFormValuesToConfigSets = (vals: TemplateFormValues): ConfigSet[] => {
    // For create, all configSets should have action="add"
    return (vals.configSets || []).map((configSet) => {
      // Convert approvers from string[] to ApproverOrSubject[] with action="add"
      const approvers = configSet.approvers?.map((approver) => {
        if (typeof approver === 'string') {
          return { _id: approver, action: 'add' as const };
        }
        return { ...approver, action: approver.action || 'add' };
      });
      
      // Convert subjects from string[] to ApproverOrSubject[] with action="add"
      const subjects = configSet.subjects?.map((subject) => {
        if (typeof subject === 'string') {
          return { _id: subject, action: 'add' as const };
        }
        return { ...subject, action: subject.action || 'add' };
      });
      
      // Convert omitSignatureApprovers from string[] to ApproverOrSubject[] with action="add"
      const omitSignatureApprovers = configSet.omitSignatureApprovers?.map((item: string) => {
        return { _id: item, action: 'add' as const };
      });

      // Convert questionApprovers from string[] to ApproverOrSubject[] with action="add"
      const questionApprovers = configSet.questionApprovers?.map((id: string) => ({
        _id: id,
        action: 'add' as const,
      }));

      return {
        ...configSet,
        action: 'add' as const,
        approvers,
        subjects,
        questionApprovers,
        omitSignatureApprovers,
      };
    });
  };

  // --- Save Template (meta + editor JSON) ---
  const handleSubmit = useCallback(
    async (values: TemplateFormValues) => {
      // Convert form values to ConfigSet format with actions
      const configSets = convertFormValuesToConfigSets(values);
      // Build JSON body
      // Note: When creating a new template, the schema is empty
      // Node IDs will be automatically generated by the UniqueID extension
      // when nodes are added in the EditTemplate view
      const requestBody = buildTemplateFormData({
        name: values.name,
        description: values.description,
        folder: folderId || null,
        configSets,
        schema: {
          type: "doc",
          content: []
        },
        totalScore: 0,
        totalPassFail: 0,
      });

      try {
        const createResp = await createTemplate(requestBody).unwrap();

        message.success('Template created successfully');
        navigate('/forms/templates/edit/' + createResp?.data?.formTemplate?._id);
      } catch (err: unknown) {
        console.error(err);
        let errMsg = 'Failed to save template';
        if (typeof err === 'object' && err !== null) {
          const maybe = err as { data?: { message?: string } };
          errMsg = maybe?.data?.message ?? errMsg;
        } else if (typeof err === 'string') {
          errMsg = err;
        } else if (err instanceof Error) {
          errMsg = err.message;
        }
        message.error(errMsg);
      }
    },
    [createTemplate, navigate, folderId]
  );

  return (
    <div
      style={{
        backgroundColor: token.colorBgLayout,
        padding: `0 ${isMobile ? token.paddingSM : token.paddingLG} ${isMobile ? 32 : 48}px`,
      }}
    >
      {/* Header */}
      <Affix offsetTop={isMobile ? 56 : 65}>
        <div
          style={{
            background: token.colorBgContainer,
            boxShadow: token.boxShadowTertiary,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            padding: headerPadding,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 100,
            borderRadius: isMobile ? token.borderRadius : 16,
          }}
        >
          <Title
            level={isMobile ? 5 : 4}
            style={{ margin: 0, display: 'flex', gap: 8, fontSize: isMobile ? 16 : undefined }}
          >
            <FormOutlined style={{ color: token.colorPrimary }} />
            Add Template
          </Title>

          <Space size={isMobile ? 'small' : 'middle'}>
            <Tooltip title="Save Template">
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size={buttonSize}
                loading={isSaving}
                onClick={() => form.submit()}
              >
                Save
              </Button>
            </Tooltip>
          </Space>
        </div>
      </Affix>

      {/* Form */}
      <Row justify="center" style={{ marginTop: pageMarginTop }}>
        <Col xs={24} sm={24} md={24} lg={24} xl={22} xxl={20}>
          <Card
            style={{
              borderRadius: isMobile ? token.borderRadiusLG : 16,
              boxShadow: token.boxShadowSecondary,
              padding: cardPadding,
              background: token.colorBgContainer,
            }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{}}
            >
              <Row gutter={formRowGutter}>
                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    label="Template Name"
                    name="name"
                    rules={[{ required: true, message: 'Please enter name' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input
                      placeholder="Enter template name"
                      disabled={isSaving}
                      size={inputSize}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    label="Description"
                    name="description"
                    // rules={[
                    //   { required: true, message: 'Please enter description' },
                    // ]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input
                      placeholder="Enter description"
                      disabled={isSaving}
                      size={inputSize}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {/* Config Sets Section */}
              <Divider style={dividerMargin}>
                <Space size={isMobile ? 'small' : 'middle'} wrap>
                  <Tooltip title="Add a new config set">
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      size={buttonSize}
                      onClick={() => {
                        const configSets = form.getFieldValue('configSets') || [];
                        form.setFieldValue('configSets', [
                          ...configSets,
                          {
                            name: '',
                            hasApproval: false,
                            hasDisputes: false,
                            signatureRequired: false,
                            omitSignatureAllowed: false,
                            subjects: [],
                            questionApprovers: [],
                            omitSignatureApprovers: [],
                          },
                        ]);
                      }}
                      disabled={isSaving}
                    >
                      Add Config Set
                    </Button>
                  </Tooltip>
                </Space>
              </Divider>

              <Form.List name="configSets">
                {(fields, { remove }) => (
                  <div style={{ width: '100%' }}>
                    {fields.map((field) => (
                      <Card
                        key={field.key}
                        size="small"
                        style={{
                          marginBottom: configCardMargin,
                          border: `1px solid ${token.colorBorderSecondary}`,
                        }}
                        styles={{ body: { padding: configCardBodyPadding } }}
                        title={
                          <Row gutter={cardTitleGutter} align="middle">
                            <Col xs={24} sm={18} md={20} flex="auto">
                              <Form.Item
                                {...field}
                                name={[field.name, 'name']}
                                rules={[
                                  {
                                    required: true,
                                    message: 'Config set name is required',
                                  },
                                ]}
                                style={{ marginBottom: 0 }}
                              >
                                <Input
                                  placeholder="Config set name"
                                  disabled={isSaving}
                                  size={inputSize}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={6} md={4} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => remove(field.name)}
                                disabled={isSaving}
                                size="small"
                              >
                                Remove
                              </Button>
                            </Col>
                          </Row>
                        }
                      >
                        <ConfigSetForm
                          form={form}
                          index={field.name}
                          subjectsOptions={subjectsOptions}
                          approversOptions={approversOptions}
                          questionApproversOptions={approversOptions}
                          omitSignatureApproversOptions={omitSignatureApproversOptions}
                          subjectsLoading={subjectsLoading}
                          approversLoading={approversLoading}
                          questionApproversLoading={approversLoading}
                          omitSignatureApproversLoading={omitSignatureApproversLoading}
                        />
                      </Card>
                    ))}
                    {fields.length === 0 && (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: emptyStatePadding,
                          color: token.colorTextSecondary,
                          fontSize: emptyStateFontSize,
                        }}
                      >
                        No config sets added. Click "Add Config Set" to create one.
                      </div>
                    )}
                  </div>
                )}
              </Form.List>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AddTemplate;
