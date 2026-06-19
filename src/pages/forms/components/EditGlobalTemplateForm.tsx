import React, { useEffect, useRef, useState } from 'react';
import {
  Affix,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Grid,
  Input,
  Row,
  Space,
  Spin,
  Tooltip,
  Typography,
  message,
  theme,
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  GlobalFormTemplate,
  useUpdateGlobalFormTemplateMutation,
} from '../../../services/globalFormTemplatesApi';
import { PATH_FORMS } from '../../../constants/routes';
import { useTiptapInstance } from '../../../hooks/useTiptapInstance';
import { extensions } from '../../CanvasBuilderPage/Editor/extensions';
import { TemplateEditor } from '../../CanvasBuilderPage';
import { parseSchemaDocument } from '../../CanvasBuilderPage/Editor/utils';
import { computeScoringFromSchema } from '../utils/computeScoringFromSchema';
import {
  setCopiedGlobalTemplate,
  getCopiedGlobalTemplate,
  hasCopiedGlobalTemplate,
} from '../utils/copiedGlobalTemplateStorage';
import type { JSONContent } from '@tiptap/core';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

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

type Props = {
  template: GlobalFormTemplate;
};

const EditGlobalTemplateForm: React.FC<Props> = ({ template }) => {
  const screens = useBreakpoint();
  const isXS = !screens.sm;
  const isMobile = !screens.md;
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [isDirty, setIsDirty] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const isInitializingRef = useRef(true);
  const schemaLoadedRef = useRef(false);
  const expectedSchemaRef = useRef<EditorDoc | null>(null);
  const initializationCompleteRef = useRef(false);

  // Responsive spacing & sizes (aligned with EditTemplate / AddTemplate)
  const headerPadding = isXS ? token.paddingSM : isMobile ? token.paddingMD : token.paddingLG;
  const formRowGutter: [number, number] = isXS ? [12, 12] : isMobile ? [16, 16] : [24, 24];
  const cardPadding = isXS ? 0 : isMobile ? token.paddingMD : token.paddingLG;
  const dividerMargin = isMobile ? { marginTop: 16, marginBottom: 12 } : { marginTop: 24, marginBottom: 16 };
  const inputSize = isXS ? 'small' : 'middle';
  const buttonSize = isMobile ? 'small' : 'middle';
  const pageMarginTop = isMobile ? token.marginMD : token.marginLG;

  const formSchema = template.currentGlobalFormTemplateSchema?.formSchema ?? null;

  const tiptap = useTiptapInstance({
    extensions,
    onUpdate: () => {
      if (isInitializingRef.current || !schemaLoadedRef.current || !initializationCompleteRef.current) {
        setIsDirty(false);
        return;
      }
      if (expectedSchemaRef.current && tiptap.editor) {
        try {
          const currentContent = tiptap.getJSON();
          const currentNormalized = normalizeEditorContent(currentContent);
          const currentStr = JSON.stringify(currentNormalized);
          const expectedStr = JSON.stringify(expectedSchemaRef.current);
          if (currentStr === expectedStr) {
            setIsDirty(false);
            return;
          }
        } catch {
          return;
        }
      }
      setIsDirty(true);
    },
    initialContent: formSchema || '',
    mode: 'edit',
  });

  const [updateTemplate, { isLoading: saving }] = useUpdateGlobalFormTemplateMutation();

  const handleCopyTemplate = () => {
    const schema = template.currentGlobalFormTemplateSchema;
    setCopiedGlobalTemplate({
      name: template.name ?? '',
      description: template.description ?? undefined,
      formSchema: schema?.formSchema,
      totalScore: schema?.totalScore,
      totalPassFail: schema?.totalPassFail,
      configSets: template.configSets,
    });
    setJustCopied(true);
    message.success('Template copied. You can paste it in another organization.');
  };

  const handlePasteTemplate = () => {
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
        expectedSchemaRef.current = sanitized;
        schemaLoadedRef.current = true;
        setIsDirty(true);
        message.success('Template pasted. Save to apply.');
      } catch {
        message.error('Could not apply pasted form schema');
      }
    } else {
      setIsDirty(true);
      message.success('Template name and description pasted. Save to apply.');
    }
  };

  useEffect(() => {
    form.setFieldsValue({
      name: template.name ?? '',
      description: template.description ?? '',
    });
    setIsDirty(false);
  }, [template._id, template.name, template.description, form]);

  useEffect(() => {
    if (tiptap.editor && formSchema && !expectedSchemaRef.current) {
      expectedSchemaRef.current = normalizeEditorContent(formSchema) as EditorDoc;
    }
  }, [tiptap.editor, formSchema]);

  useEffect(() => {
    isInitializingRef.current = true;
    schemaLoadedRef.current = false;
    initializationCompleteRef.current = false;
    setIsDirty(false);
    if (!tiptap.editor) return;
    if (formSchema) {
      const parsed = parseSchemaDocument(formSchema);
      const sanitized = normalizeEditorContent(parsed) as EditorDoc;
      expectedSchemaRef.current = sanitized;
      isInitializingRef.current = true;
      schemaLoadedRef.current = false;
      tiptap.setJSON(sanitized);
      const timer = setTimeout(() => {
        if (tiptap.editor) {
          try {
            const currentContent = tiptap.getJSON();
            const currentNormalized = normalizeEditorContent(currentContent) as EditorDoc;
            expectedSchemaRef.current = currentNormalized;
          } catch {
            // no-op
          }
        }
        schemaLoadedRef.current = true;
        isInitializingRef.current = false;
        initializationCompleteRef.current = true;
        setIsDirty(false);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      expectedSchemaRef.current = null;
      schemaLoadedRef.current = true;
      isInitializingRef.current = false;
      initializationCompleteRef.current = true;
      setIsDirty(false);
    }
  }, [formSchema, tiptap.editor, template._id]);

  const handleSubmit = async (values: { name: string; description?: string }) => {
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
        : computeScoringFromSchema(tiptap.editor?.getJSON());

      await updateTemplate({
        id: template._id,
        body: {
          name: values.name,
          description: values.description || undefined,
          ...(formSchemaPayload && { formSchema: formSchemaPayload }),
          totalScore: scoring.totalScore,
          totalPassFail: scoring.totalPassFail,
        },
      }).unwrap();
      message.success('Global template updated successfully');
      if (formSchemaPayload) {
        expectedSchemaRef.current = formSchemaPayload as EditorDoc;
        setIsDirty(false);
      }
    } catch (err: unknown) {
      let errMsg = 'Failed to update global template';
      if (typeof err === 'object' && err !== null) {
        const maybe = err as { data?: { message?: string } };
        errMsg = maybe?.data?.message ?? errMsg;
      } else if (err instanceof Error) errMsg = err.message;
      message.error(errMsg);
    }
  };

  return (
    <div
      style={{
        background: token.colorBgLayout,
        padding: `0 ${isMobile ? token.paddingSM : token.paddingLG} ${isMobile ? 32 : 48}px`,
      }}
    >
      {/* Header */}
      <Affix offsetTop={isMobile ? 56 : 65}>
        <div
          style={{
            background: token.colorBgContainer,
            boxShadow: token.boxShadowTertiary,
            padding: headerPadding,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: isMobile ? token.borderRadius : 12,
          }}
        >
          <Title
            level={isMobile ? 5 : 4}
            style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 16 : undefined }}
          >
            <ArrowLeftOutlined
              style={{ color: token.colorPrimary }}
              onClick={() => navigate(PATH_FORMS.globalTemplates)}
            />
            Edit Global Template
            {isDirty && (
              <Text type="warning" style={{ fontSize: isMobile ? 11 : 12 }}>
                • Unsaved changes
              </Text>
            )}
          </Title>

          <Space size={isMobile ? 'small' : 'middle'}>
            <Tooltip title="Copy this template to paste in another organization">
              <Button
                variant="solid"
                color="green"
                size={buttonSize}
                onClick={handleCopyTemplate}
              >
                Copy template
              </Button>
            </Tooltip>
            <Tooltip title={hasCopiedGlobalTemplate() || justCopied ? 'Paste copied template here' : 'Copy a template first from the list or another edit page'}>
              <Button
                variant="solid"
                color="purple"
                size={buttonSize}
                onClick={handlePasteTemplate}
                disabled={!hasCopiedGlobalTemplate() && !justCopied}
              >
                Paste template
              </Button>
            </Tooltip>
            <Tooltip title="Save template">
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size={buttonSize}
                loading={saving}
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
              borderRadius: isMobile ? token.borderRadiusLG : 12,
              boxShadow: token.boxShadowSecondary,
              padding: cardPadding,
            }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ name: template.name ?? '', description: template.description ?? '' }}
            >
              <Row gutter={formRowGutter} style={{ width: '100%' }}>
                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    label="Name"
                    name="name"
                    rules={[{ required: true, message: 'Name is required' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input disabled={saving} size={inputSize} placeholder="Enter template name" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item label="Description" name="description" style={{ marginBottom: 0 }}>
                    <Input
                      placeholder="Enter description"
                      disabled={saving}
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

export default EditGlobalTemplateForm;
