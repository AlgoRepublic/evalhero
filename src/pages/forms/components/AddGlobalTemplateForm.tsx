import React, { useCallback } from 'react';
import {
  Button,
  Col,
  Divider,
  Form,
  Grid,
  Input,
  Row,
  Spin,
  Typography,
  Card,
  Space,
  theme,
  message,
  Affix,
  Tooltip,
} from 'antd';
import { SaveOutlined, FormOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCreateGlobalFormTemplateMutation } from '../../../services/globalFormTemplatesApi';
import { PATH_FORMS } from '../../../constants/routes';
import { getCopiedGlobalTemplate, hasCopiedGlobalTemplate } from '../utils/copiedGlobalTemplateStorage';
import { useTiptapInstance } from '../../../hooks/useTiptapInstance';
import { extensions } from '../../CanvasBuilderPage/Editor/extensions';
import { TemplateEditor } from '../../CanvasBuilderPage';
import { parseSchemaDocument } from '../../CanvasBuilderPage/Editor/utils';
import { computeScoringFromSchema } from '../utils/computeScoringFromSchema';
import type { JSONContent } from '@tiptap/core';

type EditorNode = { type?: string; content?: EditorNode[]; [key: string]: unknown };
type EditorDoc = { content?: EditorNode[]; [key: string]: unknown };

const normalizeEditorContent = (doc: EditorDoc | null | undefined) => {
  if (!doc?.content) return doc;
  const filtered = doc.content.filter(
    (node: EditorNode) =>
      !(node.type === 'paragraph' && (!node.content || node.content.length === 0))
  );
  return { ...doc, content: filtered };
};

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const AddGlobalTemplateForm: React.FC = () => {
  const screens = useBreakpoint();
  const isXS = !screens.sm;
  const isMobile = !screens.md;
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // Responsive spacing & sizes (aligned with AddTemplate)
  const headerPadding = isXS ? token.paddingSM : isMobile ? token.paddingMD : token.paddingLG;
  const formRowGutter: [number, number] = isXS ? [12, 12] : isMobile ? [16, 16] : [24, 24];
  const cardPadding = isXS ? 0 : isMobile ? token.paddingMD : token.paddingLG;
  const inputSize = isXS ? 'small' : 'middle';
  const buttonSize = isMobile ? 'small' : 'middle';
  const pageMarginTop = isMobile ? token.marginMD : token.marginLG;
  const dividerMargin = isMobile ? { marginTop: 16, marginBottom: 12 } : { marginTop: 24, marginBottom: 16 };

  const tiptap = useTiptapInstance({
    extensions,
    initialContent: '',
    mode: 'edit',
  });

  const [createTemplate, { isLoading: isCreating }] = useCreateGlobalFormTemplateMutation();
  const isSaving = isCreating;

  const handlePasteTemplate = useCallback(() => {
    const copied = getCopiedGlobalTemplate();
    if (!copied) {
      message.warning('No template copied. Copy a template first from the list or edit page.');
      return;
    }
    form.setFieldsValue({
      name: copied.name,
      description: copied.description ?? '',
    });
    if (copied.formSchema && tiptap.editor) {
      try {
        const parsed = parseSchemaDocument(copied.formSchema);
        const sanitized = normalizeEditorContent(parsed) as EditorDoc;
        tiptap.setJSON(sanitized);
        message.success('Template pasted. Save to create with form schema.');
      } catch {
        message.success('Name and description pasted. Save to create.');
      }
    } else {
      message.success('Name and description pasted. Save to create.');
    }
  }, [form, tiptap.editor]);

  const handleSubmit = useCallback(
    async (values: { name: string; description?: string }) => {
      try {
        let formSchemaPayload: JSONContent | undefined;
        if (tiptap.editor) {
          const json = tiptap.getJSON();
          if (json) {
            formSchemaPayload = normalizeEditorContent(json) as JSONContent;
          }
        }
        const scoring = formSchemaPayload
          ? computeScoringFromSchema(formSchemaPayload)
          : { totalScore: 0, totalPassFail: 0 };

        const res = await createTemplate({
          name: values.name,
          description: values.description || undefined,
          ...(formSchemaPayload && {
            formSchema: formSchemaPayload,
            totalScore: scoring.totalScore,
            totalPassFail: scoring.totalPassFail,
          }),
        }).unwrap();
        message.success('Global template created successfully');
        navigate(`${PATH_FORMS.globalTemplates}/edit/${res.data.globalFormTemplate._id}`);
      } catch (err: unknown) {
        let errMsg = 'Failed to create global template';
        if (typeof err === 'object' && err !== null) {
          const maybe = err as { data?: { message?: string } };
          errMsg = maybe?.data?.message ?? errMsg;
        } else if (err instanceof Error) errMsg = err.message;
        message.error(errMsg);
      }
    },
    [createTemplate, navigate, tiptap.editor]
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
            Add Global Template
          </Title>

          <Space size={isMobile ? 'small' : 'middle'}>
            <Tooltip
              title={
                hasCopiedGlobalTemplate()
                  ? 'Paste copied template (name, description, and schema on save)'
                  : 'Copy a template first from the list or edit page'
              }
            >
              <Button
                size={buttonSize}
                variant="solid"
                color="purple"
                onClick={handlePasteTemplate}
                disabled={!hasCopiedGlobalTemplate()}
              >
                Paste template
              </Button>
            </Tooltip>
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
              initialValues={{ name: '', description: '' }}
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

              <Divider style={dividerMargin}>
                <Text type="secondary">Template Builder</Text>
              </Divider>

              <Card
                size="small"
                style={{
                  border: `1px dashed ${token.colorBorderSecondary}`,
                  borderRadius: isMobile ? token.borderRadius : 12,
                  background: token.colorFillAlter,
                  width: '100%',
                }}
                styles={{ body: { padding: isMobile ? token.paddingSM : token.paddingMD } }}
              >
                {tiptap.editor ? (
                  <TemplateEditor instance={tiptap} />
                ) : (
                  <Spin tip="Editor initializing..." />
                )}
              </Card>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AddGlobalTemplateForm;
