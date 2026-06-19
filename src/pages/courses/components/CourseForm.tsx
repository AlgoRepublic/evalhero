import React, { useEffect, useState } from 'react';
import {
  Form,
  Input,
  Select,
  Switch,
  Button,
  Card,
  Row,
  Col,
  Upload,
  message,
  Space,
  Tabs,
  Affix,
  Tooltip,
  Typography,
  theme,
  Grid,
} from 'antd';
import { UploadOutlined, SaveOutlined, BookOutlined, EyeOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { useSelector } from 'react-redux';
import {
  useCreateCourseMutation,
  useUpdateCourseMutation,
} from '../../../services/coursesApi.ts';
import { RootState } from '../../../store';
import { usePermission, useAssetUrl } from '../../../hooks';
import type { 
  Course, 
  CreateCourseDto, 
  UpdateCourseDto,
  CourseStatus,
  CourseVisibility,
  EnrollmentPolicy,
  SequencingMode,
  SpecialNodeRules,
} from '../../../types/course.ts';
import ProgressionLogicEditor from './ProgressionLogicEditor';
import { uploadFile } from '../../../utils/uploadApi';

const { TextArea } = Input;
const { Title } = Typography;
const { useBreakpoint } = Grid;

interface CourseFormProps {
  course?: Course;
  folderId?: string | null;
  onSuccess?: (courseId: string) => void;
  onCancel?: () => void;
}

const CourseForm: React.FC<CourseFormProps> = ({
  course,
  folderId,
  onSuccess,
  onCancel,
}) => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [form] = Form.useForm();
  const [coverImageFile, setCoverImageFile] = useState<UploadFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [createCourse, { isLoading: isCreating }] = useCreateCourseMutation();
  const [updateCourse, { isLoading: isUpdating }] = useUpdateCourseMutation();
  const { selectedProfile } = useSelector((state: RootState) => state.auth);
  const hasEditPermission = usePermission('course::edit');
  const sequencingEnabled = Form.useWatch('sequencing.enabled', form);
  const sequencingMode = Form.useWatch('sequencing.mode', form);

  const isEditMode = !!course;
  const isSaving = isCreating || isUpdating || uploading;
  
  // Check if user can edit this course (must be creator and have permission)
  const canEditCourse = !isEditMode || (course?.createdBy === selectedProfile?._id && hasEditPermission);
  const [isHoveringCover, setIsHoveringCover] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const { url: coverImageResolvedUrl } = useAssetUrl(course?.coverImage);

  interface CourseFormValues {
    title: string;
    status: CourseStatus;
    visibility: CourseVisibility;
    description: string;
    enrollmentPolicy: EnrollmentPolicy;
    'sequencing.enabled': boolean;
    'sequencing.strict': boolean;
    'sequencing.allowRetake': boolean;
    'sequencing.mode': SequencingMode;
    nonOrgGuestsAllowed: boolean;
    coverImage?: string;
    progressionRules: SpecialNodeRules[];
  }

  interface ApiError {
    data?: {
      message?: string;
    };
    message?: string;
  }

  useEffect(() => {
    if (course) {
      form.setFieldsValue({
        title: course.title,
        status: course.status,
        visibility: course.visibility,
        description: course.description,
        // tags: course.tags?.join(', '),
        enrollmentPolicy: course.enrollmentPolicy,
        'sequencing.enabled': course.sequencing?.enabled,
        'sequencing.strict': course.sequencing?.strict,
        'sequencing.allowRetake': course.sequencing?.allowRetake,
        'sequencing.mode': course.sequencing?.mode,
        nonOrgGuestsAllowed: course.nonOrgGuestsAllowed,
        coverImage: course.coverImage,
        progressionRules: course.progressionRules || [],
      });

      // Set existing cover image for display (resolve S3 key via useAssetUrl when not already a URL)
      if (course.coverImage) {
        const imageUrl = course.coverImage.startsWith('http')
          ? course.coverImage
          : coverImageResolvedUrl;
        if (imageUrl) {
          setCoverImageFile({
            uid: '-1',
            name: 'existing-cover-image.jpg',
            status: 'done',
            url: imageUrl,
            thumbUrl: imageUrl,
          } as UploadFile);
        }
      } else {
        setCoverImageFile(null);
      }
    } else {
      // Reset cover image when creating new course
      setCoverImageFile(null);
    }
  }, [course, form, coverImageResolvedUrl]);

  const handleSubmit = async (values: CourseFormValues) => {
    // Additional check: prevent non-creators from updating
    if (isEditMode && course && !canEditCourse) {
      message.error('You can only edit courses that you created');
      return;
    }

    try {
      let coverImageUrl = values.coverImage;

      // Upload cover image if a new file was selected
      if (coverImageFile?.originFileObj) {
        setUploading(true);
        try {
          coverImageUrl = await uploadFile(coverImageFile.originFileObj);
          // message.success('Cover image uploaded successfully');
        } catch (error: unknown) {
          const apiError = error as ApiError;
          message.error(apiError?.message || 'Failed to upload cover image');
          setUploading(false);
          return;
        } finally {
          setUploading(false);
        }
      }

      const payload: CreateCourseDto | UpdateCourseDto = {
        title: values.title,
        status: values.status || ('draft' as CourseStatus),
        visibility: values.visibility || ('open' as CourseVisibility),
        description: values.description,
        // tags: values.tags
        //   ? values.tags.split(',').map((t: string) => t.trim())
        //   : [],
        enrollmentPolicy: values.enrollmentPolicy || ('auto-join' as EnrollmentPolicy),
        sequencing: {
          enabled: values['sequencing.enabled'] ?? false,
          strict: values['sequencing.strict'] ?? false,
          allowRetake: values['sequencing.allowRetake'] ?? false,
          mode: values['sequencing.mode'] || ('linearStrict' as SequencingMode),
        },
        nonOrgGuestsAllowed: values.nonOrgGuestsAllowed ?? false,
        coverImage: coverImageUrl,
        progressionRules: values.progressionRules || [],
      };

      if (isEditMode && course) {
        await updateCourse({
          id: course._id,
          data: payload as UpdateCourseDto,
        }).unwrap();
        message.success('Course updated successfully');
        onSuccess?.(course._id);
      } else {
        // For create, ensure title is required (not optional)
        const createPayload: CreateCourseDto = {
          ...payload,
          title: payload.title!, // title is required for create
          ...(folderId !== undefined && { folder: folderId ?? null }),
        };
        const result = await createCourse(createPayload).unwrap();
        message.success('Course created successfully');
        onSuccess?.(result.data.course._id);
      }
    } catch (err: unknown) {
      const apiError = err as ApiError;
      message.error(apiError?.data?.message || 'Failed to save course');
    }
  };

  return (
    <div style={{ backgroundColor: token.colorBgLayout, paddingBottom: isMobile ? token.paddingLG : 48 }}>
      {/* Header */}
      <Affix offsetTop={isMobile ? 56 : 65}>
        <div
          style={{
            background: token.colorBgContainer,
            boxShadow: token.boxShadowTertiary,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            padding: isMobile ? token.paddingSM : 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            zIndex: 100,
            borderRadius: isMobile ? token.borderRadius : 16,
          }}
        >
          <Title level={isMobile ? 5 : 4} style={{ margin: 0, display: 'flex', gap: 8, fontSize: isMobile ? 16 : undefined }}>
            <BookOutlined style={{ color: token.colorPrimary }} />
            {isEditMode ? 'Edit Course' : 'Create Course'}
          </Title>

          <Space size={isMobile ? 'small' : 'middle'}>
            <Tooltip title={isEditMode ? 'Update Course' : 'Save Course'}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size={isMobile ? 'small' : 'middle'}
                loading={isSaving}
                onClick={() => form.submit()}
              >
                {isEditMode ? 'Update' : 'Save'}
              </Button>
            </Tooltip>
            {onCancel && (
              <Button size={isMobile ? 'small' : 'middle'} onClick={onCancel}>Cancel</Button>
            )}
          </Space>
        </div>
      </Affix>

      {/* Form */}
      <Row justify="center" style={{ marginTop: isMobile ? token.marginMD : 32 }}>
        <Col xs={24}>
          <Card
            style={{
              borderRadius: isMobile ? token.borderRadiusLG : 16,
              boxShadow: token.boxShadowSecondary,
              background: token.colorBgContainer,
            }}
            styles={{ body: {
              padding: isMobile ? token.paddingMD : '16px',
            } }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                status: 'draft',
                visibility: 'open',
                enrollmentPolicy: 'auto-join',
                'sequencing.enabled': false,
                'sequencing.strict': false,
                'sequencing.allowRetake': false,
                'sequencing.mode': 'linearStrict',
                nonOrgGuestsAllowed: false,
                progressionRules: course?.progressionRules || [],
              }}
            >
            <Tabs
              style={{ width: '100%' }}
              items={[
                {
                  key: 'basic',
                  label: 'Basic Info',
                  children: (
                    <div style={{ padding: '4px 0' }}>
                      {/* Row 1: Cover Image + Title/Description */}
                      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                        {/* Cover Image Column */}
                        <Col xs={24} sm={24} md={8} lg={6} xl={6}>
                          <Form.Item name="coverImage" label="Cover Image" hidden>
                            <Input />
                          </Form.Item>

                          <Form.Item 
                            label={
                              <span>
                                Cover Image
                                <Tooltip title="Recommended: 1200x600px or 16:9 aspect ratio. Max 10MB.">
                                  <span style={{ marginLeft: 4, color: token.colorTextSecondary }}>
                                    ℹ️
                                  </span>
                                </Tooltip>
                              </span>
                            }
                            style={{ marginBottom: 0 }}
                          >
                            <div style={{ 
                              display: 'flex', 
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: 12,
                              width: '100%',
                            }}>
                              <Upload
                                className='cover-image-upload'
                                beforeUpload={(file) => {
                                  const isImage = file.type.startsWith('image/');
                                  if (!isImage) {
                                    message.error('Only image files are allowed (JPG, PNG, GIF, etc.)');
                                    return Upload.LIST_IGNORE;
                                  }
                                  const isLt10M = file.size / 1024 / 1024 < 10;
                                  if (!isLt10M) {
                                    message.error('Image size must be less than 10MB. Please compress your image.');
                                    return Upload.LIST_IGNORE;
                                  }
                                  return false;
                                }}
                                multiple={false}
                                maxCount={1}
                                fileList={coverImageFile ? [coverImageFile] : []}
                                onChange={({ fileList }) => {
                                  if (fileList.length > 0) {
                                    const f = fileList[0];
                                    if (f.originFileObj) {
                                      f.thumbUrl = URL.createObjectURL(f.originFileObj);
                                    }
                                    setCoverImageFile(f);
                                  } else {
                                    setCoverImageFile(null);
                                    form.setFieldValue('coverImage', undefined);
                                  }
                                }}
                                onRemove={() => {
                                  setCoverImageFile(null);
                                  form.setFieldValue('coverImage', undefined);
                                }}
                                accept="image/*"
                                listType="picture-card"
                                showUploadList={false}
                                style={{ 
                                  width: '100%',
                                  maxWidth: 200,
                                }}
                              >
                                {coverImageFile ? (
                                  <div 
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      position: 'relative',
                                      cursor: 'pointer',
                                      borderRadius: 8,
                                      overflow: 'hidden',
                                    }}
                                    onMouseEnter={() => setIsHoveringCover(true)}
                                    onMouseLeave={() => setIsHoveringCover(false)}
                                  >
                                    <img
                                      src={coverImageFile.thumbUrl || coverImageFile.url}
                                      alt="Cover preview"
                                      style={{ 
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        pointerEvents: 'none',
                                      }}
                                    />
                                    {/* Hover overlay */}
                                    <div
                                      style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: isHoveringCover ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        pointerEvents: 'none',
                                      }}
                                    >
                                      <div style={{
                                        color: '#fff',
                                        fontSize: 12,
                                        fontWeight: 500,
                                        opacity: isHoveringCover ? 1 : 0,
                                        transition: 'opacity 0.2s',
                                      }}>
                                        Click to change
                                      </div>
                                    </div>
                                    {/* Preview button */}
                                    <div
                                      style={{
                                        position: 'absolute',
                                        top: 4,
                                        left: 4,
                                        background: 'rgba(0, 0, 0, 0.6)',
                                        borderRadius: '50%',
                                        width: 24,
                                        height: 24,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        zIndex: 10,
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewVisible(true);
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(24, 144, 255, 0.9)';
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                                        e.currentTarget.style.transform = 'scale(1)';
                                      }}
                                      title="Preview image"
                                    >
                                      <EyeOutlined style={{ color: '#fff', fontSize: 12 }} />
                                    </div>
                                    {/* Remove button */}
                                    <div
                                      style={{
                                        position: 'absolute',
                                        top: 4,
                                        right: 4,
                                        background: 'rgba(0, 0, 0, 0.6)',
                                        borderRadius: '50%',
                                        width: 24,
                                        height: 24,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        zIndex: 10,
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCoverImageFile(null);
                                        form.setFieldValue('coverImage', undefined);
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 77, 79, 0.9)';
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                                        e.currentTarget.style.transform = 'scale(1)';
                                      }}
                                      title="Remove image"
                                    >
                                      <span style={{ color: '#fff', fontSize: 14, lineHeight: 1 }}>×</span>
                                    </div>
                                    {/* Preview Modal */}
                                    {previewVisible && (
                                      <div
                                        style={{
                                          position: 'fixed',
                                          top: 0,
                                          left: 0,
                                          right: 0,
                                          bottom: 0,
                                          background: 'rgba(0, 0, 0, 0.85)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          zIndex: 1000,
                                          cursor: 'pointer',
                                        }}
                                        onClick={() => setPreviewVisible(false)}
                                      >
                                        <div
                                          style={{
                                            maxWidth: '90%',
                                            maxHeight: '90%',
                                            position: 'relative',
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <img
                                            src={coverImageFile.thumbUrl || coverImageFile.url}
                                            alt="Cover preview full size"
                                            style={{
                                              width: '100%',
                                              height: '100%',
                                              objectFit: 'contain',
                                              borderRadius: 8,
                                            }}
                                          />
                                          <div
                                            style={{
                                              position: 'absolute',
                                              top: -40,
                                              right: 0,
                                              background: 'rgba(0, 0, 0, 0.6)',
                                              borderRadius: '50%',
                                              width: 32,
                                              height: 32,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              cursor: 'pointer',
                                            }}
                                            onClick={() => setPreviewVisible(false)}
                                          >
                                            <span style={{ color: '#fff', fontSize: 18 }}>×</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '16px',
                                    width: '100%',
                                    height: '100%',
                                  }}>
                                    <UploadOutlined style={{ 
                                      fontSize: 32, 
                                      color: token.colorTextSecondary,
                                      marginBottom: 8,
                                    }} />
                                    <div style={{ 
                                      color: token.colorTextSecondary,
                                      fontSize: 12,
                                      textAlign: 'center',
                                      marginTop: 4,
                                    }}>
                                      Click to upload
                                    </div>
                                    <div style={{ 
                                      color: token.colorTextTertiary,
                                      fontSize: 11,
                                      textAlign: 'center',
                                      marginTop: 4,
                                    }}>
                                      or drag and drop
                                    </div>
                                  </div>
                                )}
                              </Upload>
                              
                              {/* Helpful text */}
                              {!coverImageFile && (
                                <div style={{
                                  fontSize: 11,
                                  color: token.colorTextTertiary,
                                  lineHeight: 1.5,
                                  width: '100%',
                                }}>
                                  <div>• JPG, PNG, GIF</div>
                                  <div>• Max 10MB</div>
                                  <div>• Recommended: 16:9 ratio</div>
                                </div>
                              )}
                              
                              {/* File info when uploaded */}
                              {coverImageFile && (
                                <div style={{
                                  fontSize: 11,
                                  color: token.colorTextSecondary,
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: token.colorFillTertiary,
                                  borderRadius: 6,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4,
                                }}>
                                  <div style={{ fontWeight: 500 }}>
                                    {coverImageFile.name || 'Cover image'}
                                  </div>
                                  {coverImageFile.size && (
                                    <div style={{ color: token.colorTextTertiary }}>
                                      {(coverImageFile.size / 1024 / 1024).toFixed(2)} MB
                                    </div>
                                  )}
                                  {/* <Tooltip title="Click the image to change">
                                    <div style={{ 
                                      color: token.colorPrimary,
                                      cursor: 'pointer',
                                      fontSize: 10,
                                      textDecoration: 'underline',
                                    }}>
                                      Click image to change
                                    </div>
                                  </Tooltip> */}
                                </div>
                              )}
                            </div>
                          </Form.Item>
                        </Col>

                        {/* Title and Description Column */}
                        <Col xs={24} sm={24} md={16} lg={18} xl={18}>
                          <Row gutter={[12, 12]}>
                            {/* Course Title */}
                            <Col xs={24} sm={24} md={24} lg={24} xl={24}>
                              <Form.Item
                                name="title"
                                label="Course Title"
                                rules={[
                                  { required: true, message: 'Please enter course title' },
                                ]}
                                style={{ marginBottom: 12 }}
                              >
                                <Input 
                                  placeholder="Enter course title" 
                                  size="middle"
                                />
                              </Form.Item>
                            </Col>

                            {/* Description */}
                            <Col xs={24} sm={24} md={24} lg={24} xl={24}>
                              <Form.Item
                                name="description"
                                label="Description"
                                rules={[
                                  { required: true, message: 'Please enter course description' },
                                ]}
                                style={{ marginBottom: isMobile ? 12 : 24 }}
                              >
                                <TextArea
                                  rows={3}
                                  placeholder="Enter course description"
                                  showCount
                                  maxLength={1000}
                                  style={{ resize: 'vertical' }}
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Col>
                      </Row>

                      {/* Row 2: Settings and Sequencing */}
                      <Row gutter={[16, 16]}>
                        {/* Settings Card */}
                        <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                          <Card 
                            size="small" 
                            title="Settings" 
                            style={{ 
                              marginBottom: 0,
                              height: '100%',
                            }}
                            styles={{ body: { padding: '12px' } }}
                          >
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                              <Form.Item
                                name="status"
                                label="Status"
                                rules={[{ required: true }]}
                                style={{ marginBottom: 8 }}
                              >
                                <Select size="small">
                                  <Select.Option value="draft">Draft</Select.Option>
                                  <Select.Option value="published">Published</Select.Option>
                                  <Select.Option value="archived">Archived</Select.Option>
                                </Select>
                              </Form.Item>

                              <Form.Item
                                name="visibility"
                                label="Visibility"
                                rules={[{ required: true }]}
                                style={{ marginBottom: 8 }}
                              >
                                <Select size="small">
                                  <Select.Option value="open">Open</Select.Option>
                                  <Select.Option value="invite-only">Invite Only</Select.Option>
                                </Select>
                              </Form.Item>

                              <Form.Item
                                name="enrollmentPolicy"
                                label="Enrollment Policy"
                                rules={[{ required: true }]}
                                style={{ marginBottom: 8 }}
                              >
                                <Select size="small">
                                  <Select.Option value="auto-join">Auto Join</Select.Option>
                                  <Select.Option value="request-join">
                                    Request Join
                                  </Select.Option>
                                  <Select.Option value="invite-only">Invite Only</Select.Option>
                                </Select>
                              </Form.Item>

                              <Form.Item
                                name="nonOrgGuestsAllowed"
                                label="Allow Non-Org Guests"
                                valuePropName="checked"
                                style={{ marginBottom: 0 }}
                              >
                                <Switch size="small" />
                              </Form.Item>
                            </Space>
                          </Card>
                        </Col>

                        {/* Sequencing Card */}
                        <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                          <Card 
                            size="small" 
                            title="Sequencing"
                            style={{ 
                              marginBottom: 0,
                              height: '100%',
                            }}
                            styles={{ body: { padding: '12px' } }}
                          >
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                              <Form.Item
                                name="sequencing.enabled"
                                label="Enable Sequencing"
                                valuePropName="checked"
                                style={{ marginBottom: 8 }}
                              >
                                <Switch size="small" />
                              </Form.Item>

                              <Form.Item 
                                name="sequencing.mode" 
                                label="Sequencing Mode"
                                style={{ marginBottom: 0 }}
                              >
                                <Select size="small" disabled={!sequencingEnabled}>
                                  <Select.Option value="linearStrict">
                                    Linear Strict
                                  </Select.Option>
                                  <Select.Option value="linearSoft">Linear Soft</Select.Option>
                                  {/* <Select.Option value="clustered">Clustered</Select.Option> */}
                                </Select>
                              </Form.Item>

                              <Form.Item
                                name="sequencing.strict"
                                label="Strict Mode"
                                valuePropName="checked"
                                style={{ marginBottom: 8 }}
                              >
                                <Switch size="small" disabled={!sequencingEnabled || sequencingMode !== 'linearSoft'} />
                              </Form.Item>

                              <Form.Item
                                name="sequencing.allowRetake"
                                label="Allow Retake"
                                valuePropName="checked"
                                style={{ marginBottom: 8 }}
                              >
                                <Switch size="small" disabled={true} />
                              </Form.Item>
                            </Space>
                          </Card>
                        </Col>
                      </Row>
                    </div>
                  ),
                },
                {
                  key: 'progression',
                  label: 'Progression Logic',
                  children: (
                    <Form.Item name="progressionRules" style={{ marginBottom: 0 }}>
                      <ProgressionLogicEditor />
                    </Form.Item>
                  ),
                },
              ]}
            />
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CourseForm;
