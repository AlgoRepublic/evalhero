import React, { useEffect, useState, useRef } from 'react';
import {
  Affix,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Grid,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  SaveOutlined,
  FormOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { theme } from 'antd';

import {
  Template,
  useUpdateTemplateMutation,
  ConfigSet,
  ApproverOrSubject,
} from '../../../services/templatesAPI';
import { useListGlobalFormTemplatesQuery } from '../../../services/globalFormTemplatesApi';
import { useTiptapInstance } from '../../../hooks/useTiptapInstance';
import { extensions } from '../../CanvasBuilderPage/Editor/extensions';
import { TemplateEditor } from '../../CanvasBuilderPage';
import { JSONContent } from '@tiptap/core';
import { 
  useGetSubjectsQuery,
  useGetApproversQuery,
  useGetOmitSignatureApproversQuery,
} from '../../../services/assignmentsApi';
import { User } from '../../../features/auth/authSlice';
import ConfigSetForm from './ConfigSetForm';
import { parseSchemaDocument } from '../../CanvasBuilderPage/Editor/utils';
import { computeScoringFromSchema } from '../utils/computeScoringFromSchema';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

// Form values use string[] for approvers/subjects/omitSignatureApprovers/questionApprovers (for Select component compatibility)
interface FormConfigSet extends Omit<ConfigSet, 'approvers' | 'subjects' | 'omitSignatureApprovers' | 'questionApprovers'> {
  approvers?: string[];
  subjects?: string[];
  questionApprovers?: string[];
  omitSignatureApprovers?: string[];
}

interface FormValues {
  name: string;
  description?: string;
  configSets?: FormConfigSet[];
  /** Optional default minimum score to pass (used when creating assignments from this template). */
  passingScore?: number;
  /** Optional default minimum pass/fail count (used when creating assignments from this template). */
  passingPassFailCount?: number;
}

/* ------------------- UTIL ------------------- */
type EditorNode = {
  type?: string;
  content?: EditorNode[];
  [key: string]: unknown;
};

type EditorDoc = {
  content?: EditorNode[];
  [key: string]: unknown;
};

const normalizeEditorContent = (doc: EditorDoc | null | undefined) => {
  if (!doc?.content) return doc;
  const filtered = doc.content.filter(
    (node: EditorNode) =>
      !(
        node.type === 'paragraph' &&
        (!node.content || node.content.length === 0)
      )
  );
  return { ...doc, content: filtered };
};

export const EditTemplate: React.FC<{
  template: Template;
}> = ({ template }) => {
  const screens = useBreakpoint();
  const isXS = !screens.sm;
  const isMobile = !screens.md;
  const { token } = theme.useToken();
  // const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm<FormValues>();

  // Responsive spacing & sizes (aligned with AddTemplate)
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
  const [isDirty, setIsDirty] = useState(false);
  const [selectedGlobalTemplateId, setSelectedGlobalTemplateId] = useState<string | undefined>(undefined);
  const isInitializingRef = useRef(true);
  const schemaLoadedRef = useRef(false);
  const expectedSchemaRef = useRef<EditorDoc | null>(null);
  const originalConfigSetsRef = useRef<ConfigSet[]>([]); // Store original configSets for comparison
  const initializationCompleteRef = useRef(false); // Track if initialization has completed

  const { data: globalTemplatesData } = useListGlobalFormTemplatesQuery({ page: 1, perPage: 100 });

  const { data: subjectsRes, isLoading: subjectsLoading } = useGetSubjectsQuery();
  const { data: approversRes, isLoading: approversLoading } = useGetApproversQuery();
  const { data: omitSignatureApproversRes, isLoading: omitSignatureApproversLoading } = useGetOmitSignatureApproversQuery();

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

  /* ------------------- SAVE ------------------- */

  const [updateTemplate, { isLoading: saving }] = useUpdateTemplateMutation();
  // const [updateDraft] = useUpdateDraftMutation();
  // const [lockVersion] = useLockVersionMutation();

  // The actual form schema we want to load into the editor
  // Get formSchema from template.currentFormTemplateSchema.formSchema
  const formSchema = template.currentFormTemplateSchema?.formSchema ?? null;

  /* ------------------- TIPTAP INSTANCE ------------------- */
  const tiptap = useTiptapInstance({
    extensions,
    onUpdate: () => {
      // During initialization or before schema is loaded, ignore all updates
      // This prevents setJSON from triggering dirty flag
      if (isInitializingRef.current || !schemaLoadedRef.current || !initializationCompleteRef.current) {
        setIsDirty(false);
        return;
      }
      
      // After initialization, always check if content matches expected schema first
      // This prevents false positives from normalization or timing issues
      if (expectedSchemaRef.current && tiptap.editor) {
        try {
          const currentContent = tiptap.getJSON();
          const currentNormalized = normalizeEditorContent(currentContent);
          
          // Compare normalized content with expected (which is also normalized)
          const currentStr = JSON.stringify(currentNormalized);
          const expectedStr = JSON.stringify(expectedSchemaRef.current);
          
          // If content matches exactly, don't mark as dirty
          if (currentStr === expectedStr) {
            setIsDirty(false);
            return;
          }
        } catch (e) {
          // If comparison fails, don't mark as dirty - might be a timing issue
          // This prevents false positives during initialization
          return;
        }
      }
      
      // Only set dirty flag if we've confirmed it's a real change
      // This ensures we don't mark as dirty during initialization artifacts
      setIsDirty(true);
    },
    // onUpdate: ({ editor }) => {
    //   if (!editor) return;
    //   console.log('editor', editor);
    //   const json = editor?.getJSON();
    //   setIsDirty(true);
    //   // persist to localStorage
    //   console.log('json', json);
    //   localStorage.setItem(`draft_${id}`, JSON.stringify(json));
    // },
    initialContent: formSchema || '',
    mode: 'edit',
  });

  // Helper to convert API format (objects) to form format (strings)
  // Form format uses string[] for approvers/subjects, API format uses ApproverOrSubject[]
  const convertConfigSetsToFormFormat = (configSets: ConfigSet[]): FormConfigSet[] => {
    return configSets.map((configSet) => {
      // Convert approvers from objects to string array for form
      const approvers = configSet.approvers?.map((approver) => {
        return typeof approver === 'string' ? approver : approver._id;
      });
      
      // Convert subjects from objects to string array for form
      const subjects = configSet.subjects?.map((subject) => {
        return typeof subject === 'string' ? subject : subject._id;
      });
      // Convert omitSignatureApprovers from objects to string array for form
      // Handle both ApproverOrSubject objects and full Profile objects
      const omitSignatureApprovers = configSet.omitSignatureApprovers?.map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        // Handle ApproverOrSubject with _id property
        if (item && typeof item === 'object') {
          // Try _id property first (most common)
          if ('_id' in item && typeof item._id === 'string') {
            return item._id;
          }
          // Try id property (some APIs use lowercase)
          if ('id' in item && typeof item.id === 'string') {
            return item.id;
          }
        }
        console.warn('Could not extract ID from omitSignatureApprover item:', item);
        return null;
      }).filter((id): id is string => id !== null && id !== undefined) || [];

      const questionApprovers = configSet.questionApprovers?.map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && '_id' in item && typeof item._id === 'string') return item._id;
        if (item && typeof item === 'object' && 'id' in item && typeof item.id === 'string') return item.id;
        return null;
      }).filter((id): id is string => id !== null && id !== undefined) || [];

      return {
        ...configSet,
        approvers: approvers || [],
        subjects: subjects || [],
        questionApprovers,
        omitSignatureApprovers: omitSignatureApprovers,
      };
    });
  };

  // Helper to convert form format to API format with actions
  const convertConfigSetsToApiFormat = (
    formConfigSets: FormConfigSet[],
    originalConfigSets: ConfigSet[]
  ): ConfigSet[] => {
    const result: ConfigSet[] = [];
    
    // Create a map of original configSets by _id for quick lookup
    const originalMap = new Map<string, ConfigSet>();
    originalConfigSets.forEach((cs) => {
      if (cs._id) {
        originalMap.set(cs._id, cs);
      }
    });
    
    // Create a map of original configSets by index (for those without _id)
    const originalByIndex = [...originalConfigSets];
    
    // Process existing and new configSets
    formConfigSets.forEach((formConfigSet, index) => {
      const originalConfigSet = formConfigSet._id 
        ? originalMap.get(formConfigSet._id)
        : originalByIndex[index];
      
      // Determine action for configSet
      let configSetAction: 'add' | 'update' | 'remove' = 'add';
      if (formConfigSet._id && originalConfigSet) {
        // Check if anything changed
        const hasChanges =
          formConfigSet.name !== originalConfigSet.name ||
          formConfigSet.hasApproval !== originalConfigSet.hasApproval ||
          formConfigSet.hasDisputes !== originalConfigSet.hasDisputes ||
          formConfigSet.signatureRequired !== originalConfigSet.signatureRequired ||
          formConfigSet.approvalRule !== originalConfigSet.approvalRule ||
          formConfigSet.approvalMinCount !== originalConfigSet.approvalMinCount ||
          formConfigSet.omitSignatureAllowed !== originalConfigSet.omitSignatureAllowed;
        
        configSetAction = hasChanges ? 'update' : 'update'; // Always update if exists
      } else if (!formConfigSet._id) {
        configSetAction = 'add';
      }
      
      // Convert approvers (formConfigSet.approvers is string[])
      // Only include approvers that were added or removed, not unchanged ones
      const formApproverIds = formConfigSet.approvers || [];
      const originalApproverIds = originalConfigSet?.approvers?.map(a => 
        typeof a === 'string' ? a : a._id
      ) || [];
      
      const approvers: ApproverOrSubject[] = [];
      
      // Find added approvers (in form but not in original)
      formApproverIds.forEach((approverId) => {
        if (!originalApproverIds.includes(approverId)) {
          approvers.push({ _id: approverId, action: 'add' });
        }
        // Don't include unchanged approvers (exist in both)
      });
      
      // Find removed approvers (in original but not in form)
      originalApproverIds.forEach((approverId) => {
        if (!formApproverIds.includes(approverId)) {
          approvers.push({ _id: approverId, action: 'remove' });
        }
      });
      
      // Convert subjects (formConfigSet.subjects is string[])
      // Only include subjects that were added or removed, not unchanged ones
      const formSubjectIds = formConfigSet.subjects || [];
      const originalSubjectIds = originalConfigSet?.subjects?.map(s => 
        typeof s === 'string' ? s : s._id
      ) || [];
      
      const subjects: ApproverOrSubject[] = [];
      
      // Find added subjects (in form but not in original)
      formSubjectIds.forEach((subjectId) => {
        if (!originalSubjectIds.includes(subjectId)) {
          subjects.push({ _id: subjectId, action: 'add' });
        }
        // Don't include unchanged subjects (exist in both)
      });
      
      // Find removed subjects (in original but not in form)
      originalSubjectIds.forEach((subjectId) => {
        if (!formSubjectIds.includes(subjectId)) {
          subjects.push({ _id: subjectId, action: 'remove' });
        }
      });
      
      // Convert omitSignatureApprovers (formConfigSet.omitSignatureApprovers is string[])
      // Only include omitSignatureApprovers that were added or removed, not unchanged ones
      const formOmitSignatureApproversIds = formConfigSet.omitSignatureApprovers || [];
      const originalOmitSignatureApproversIds = originalConfigSet?.omitSignatureApprovers?.map(item => {
        if (typeof item === 'string') {
          return item;
        }
        // Handle ApproverOrSubject or Profile objects with _id property
        if (item && typeof item === 'object' && '_id' in item) {
          return item._id;
        }
        return null;
      }).filter((id): id is string => id !== null) || [];
      
      const omitSignatureApprovers: ApproverOrSubject[] = [];
      
      // Find added omitSignatureApprovers (in form but not in original)
      formOmitSignatureApproversIds.forEach((itemId) => {
        if (!originalOmitSignatureApproversIds.includes(itemId)) {
          omitSignatureApprovers.push({ _id: itemId, action: 'add' });
        }
      });
      
      // Find removed omitSignatureApprovers (in original but not in form)
      originalOmitSignatureApproversIds.forEach((itemId) => {
        if (!formOmitSignatureApproversIds.includes(itemId)) {
          omitSignatureApprovers.push({ _id: itemId, action: 'remove' });
        }
      });

      // Convert questionApprovers (same pattern as approvers)
      const formQuestionApproverIds = formConfigSet.questionApprovers || [];
      const originalQuestionApproverIds = originalConfigSet?.questionApprovers?.map((a) =>
        typeof a === 'string' ? a : a._id
      ) || [];
      const questionApprovers: ApproverOrSubject[] = [];
      formQuestionApproverIds.forEach((id) => {
        if (!originalQuestionApproverIds.includes(id)) {
          questionApprovers.push({ _id: id, action: 'add' });
        }
      });
      originalQuestionApproverIds.forEach((id) => {
        if (!formQuestionApproverIds.includes(id)) {
          questionApprovers.push({ _id: id, action: 'remove' });
        }
      });

      result.push({
        ...formConfigSet,
        action: configSetAction,
        approvers: approvers as ApproverOrSubject[],
        subjects: subjects as ApproverOrSubject[],
        questionApprovers: questionApprovers as ApproverOrSubject[],
        omitSignatureApprovers: omitSignatureApprovers as ApproverOrSubject[],
      } as ConfigSet);
    });
    
    // Find removed configSets (exist in original but not in form)
    originalConfigSets.forEach((originalConfigSet) => {
      if (originalConfigSet._id) {
        const stillExists = formConfigSets.some(cs => cs._id === originalConfigSet._id);
        if (!stillExists) {
          // ConfigSet was removed
          result.push({
            ...originalConfigSet,
            action: 'remove',
            approvers: [],
            subjects: [],
            questionApprovers: [],
            omitSignatureApprovers: [],
          });
        }
      }
    });
    
    return result;
  };

  /* ------------------- INITIAL LOAD ------------------- */
  useEffect(() => {
    if (template) {
      const t = template;
      const configSets = t.configSets || [];
      
      // Store original configSets for comparison
      originalConfigSetsRef.current = JSON.parse(JSON.stringify(configSets));
      
      // Convert to form format (strings instead of objects)
      const formConfigSets = convertConfigSetsToFormFormat(configSets);
      
      // Set form values - Form.List needs the entire configSets array set at once
      form.setFieldsValue({
        name: t.name,
        description: t.description ?? '',
        configSets: formConfigSets,
        passingScore: typeof t.passingScore === 'number' ? t.passingScore : undefined,
        passingPassFailCount: typeof t.passingPassFailCount === 'number' ? t.passingPassFailCount : undefined,
      });
      
      // Verify the values were set correctly
      // setTimeout(() => {
      //   const currentConfigSets = form.getFieldValue('configSets');
      //   console.log('Form configSets after setFieldsValue:', currentConfigSets);
      //   if (currentConfigSets && currentConfigSets.length > 0) {
      //     currentConfigSets.forEach((cs: FormConfigSet, idx: number) => {
      //       console.log(`ConfigSet ${idx} (${cs.name}) omitSignatureApprovers:`, cs.omitSignatureApprovers);
      //       const fieldValue = form.getFieldValue(['configSets', idx, 'omitSignatureApprovers']);
      //       console.log(`ConfigSet ${idx} field value:`, fieldValue);
      //     });
      //   }
      // }, 100);
    }

    setIsDirty(false);
  }, [template, form, tiptap]);

  // Handle editor creation - keep initializing until editor is ready
  useEffect(() => {
    if (tiptap.editor) {
      // Editor is ready, but keep initializing until schema is loaded
      isInitializingRef.current = true;
      schemaLoadedRef.current = false;
      setIsDirty(false);
      
      // Set expected schema if available (for initialContent comparison)
      if (formSchema && !expectedSchemaRef.current) {
        expectedSchemaRef.current = normalizeEditorContent(formSchema) as EditorDoc;
      }
    }
  }, [tiptap.editor, formSchema]);

  useEffect(() => {
    // Reset flags when formSchema or editor changes
    isInitializingRef.current = true;
    schemaLoadedRef.current = false;
    initializationCompleteRef.current = false;
    setIsDirty(false);
    
    // Wait for editor to be ready before loading schema
    if (!tiptap.editor) {
      // Editor not ready yet, keep initializing
      return;
    }
    
    // const persisted = localStorage.getItem(`draft_${id}`);
    // console.log('persisted', persisted, typeof undefined);
    // if (persisted && persisted != 'undefined') {
    //   try {
    //     const parsed = JSON.parse(persisted);
    //     tiptap.setJSON(parsed);
    //     setIsDirty(true);
    //     message.info('Loaded unsaved changes from local draft');
    //     return; // don't override with schema
    //   } catch (e) {
    //     console.error('Invalid persisted draft', e);
    //   }
    // }

    // Load formSchema if available (this is programmatic, not user edit)
    if (formSchema) {
      // Parse schema to convert string booleans/numbers to proper types
      // This is needed because FormData (used by API) converts everything to strings
      const parsed = parseSchemaDocument(formSchema);
      const sanitized = normalizeEditorContent(parsed) as EditorDoc;
      // Set expected schema BEFORE calling setJSON so comparison works
      expectedSchemaRef.current = sanitized;
      
      // Set initialization flag to prevent onUpdate from marking as dirty
      isInitializingRef.current = true;
      schemaLoadedRef.current = false;
      
      // Load the schema into editor
      // The UniqueID extension will preserve existing IDs from the JSON
      // and generate new IDs only for nodes that don't have them
      // parseSchemaDocument is called inside setJSON, but we also call it here for expectedSchemaRef
      tiptap.setJSON(sanitized);
      
      // Mark schema as loaded and initialization as complete after a delay
      // This ensures all updates triggered by setJSON have settled
      const timer = setTimeout(() => {
        if (tiptap.editor) {
          try {
            // Get the actual content from editor after normalization
            const currentContent = tiptap.getJSON();
            const currentNormalized = normalizeEditorContent(currentContent) as EditorDoc;
            
            // Update expected schema to match what's actually in the editor
            // This ensures future comparisons will work correctly
            expectedSchemaRef.current = currentNormalized;
            
            // Mark as initialized
            schemaLoadedRef.current = true;
            isInitializingRef.current = false;
            initializationCompleteRef.current = true;
            setIsDirty(false);
          } catch (e) {
            // If anything fails, still mark as initialized
            schemaLoadedRef.current = true;
            isInitializingRef.current = false;
            initializationCompleteRef.current = true;
            setIsDirty(false);
          }
        } else {
          // Editor not available, mark as initialized anyway
          schemaLoadedRef.current = true;
          isInitializingRef.current = false;
          initializationCompleteRef.current = true;
          setIsDirty(false);
        }
      }, 1000); // Increased delay to ensure all updates have settled
      
      return () => clearTimeout(timer);
    } else {
      expectedSchemaRef.current = null;
      // If no schema, mark as initialized immediately
      schemaLoadedRef.current = true;
      isInitializingRef.current = false;
      initializationCompleteRef.current = true;
      setIsDirty(false);
    }
  }, [formSchema, tiptap.editor, tiptap, id]);

  // No template-level flag interdependencies

  // Helper to build JSON body with the nested structure for configSets
  const buildTemplateFormData = (
    body: {
      name?: string;
      description?: string;
      configSets?: ConfigSet[];
      formSchema?: JSONContent;
      totalScore?: number;
      totalPassFail?: number;
      passingScore?: number;
      passingPassFailCount?: number;
    }
  ): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    
    // Add basic fields
    if (body.name) result.name = body.name;
    if (body.description) result.description = body.description;
    
    // Add formSchema if present
    if (body.formSchema) {
      result.formSchema = body.formSchema;
    }
    
    // Scoring: totalScore and totalPassFail (from form schema single/multiple choice scoring)
    if (typeof body.totalScore === 'number') result.totalScore = body.totalScore;
    if (typeof body.totalPassFail === 'number') result.totalPassFail = body.totalPassFail;
    // Default passing thresholds (optional; used to pre-fill when creating assignments)
    if (typeof body.passingScore === 'number') result.passingScore = body.passingScore;
    if (typeof body.passingPassFailCount === 'number') result.passingPassFailCount = body.passingPassFailCount;

    // Add configSets in the nested format
    if (body.configSets && Array.isArray(body.configSets)) {
      result.configSets = body.configSets.map((configSet) => {
        const configSetAction = configSet.action || 'add';
        const configSetObj: Record<string, unknown> = {
          action: configSetAction,
        };
        
        // If updating, include _id
        if (configSet._id && configSetAction !== 'add') {
          configSetObj._id = configSet._id;
        }
        
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

  /* ------------------- SAVE ------------------- */
  const save = async (values: FormValues) => {
    try {
      // Convert form format to API format with actions
      const configSetsWithActions = convertConfigSetsToApiFormat(
        values.configSets || [],
        originalConfigSetsRef.current
      );
      
      // Include schema if builder has changes
      // Get JSON from editor - this will include all node IDs from UniqueID extension
      let formSchema: JSONContent | undefined;
      if (tiptap.editor) {
        // Always get the current JSON to ensure IDs are included
        // The UniqueID extension automatically includes IDs in getJSON()
        const json = tiptap.getJSON();
        if (json) {
          // Normalize content (remove empty paragraphs)
          // Note: Boolean attributes are already proper booleans from the editor
          // The parseSchemaDocument is only needed when loading from API (FormData)
          formSchema = normalizeEditorContent(json) as JSONContent;
        }
      }
      
      // Compute totalScore and totalPassFail from current form schema (single/multiple choice with scoring enabled)
      const scoring = formSchema
        ? computeScoringFromSchema(formSchema)
        : computeScoringFromSchema(tiptap.editor?.getJSON());
      
      // Build JSON body
      const requestBody = buildTemplateFormData({
        name: values.name,
        description: values.description,
        configSets: configSetsWithActions,
        ...(formSchema && { formSchema }),
        totalScore: scoring.totalScore,
        totalPassFail: scoring.totalPassFail,
        passingScore: typeof values.passingScore === 'number' ? values.passingScore : undefined,
        passingPassFailCount: typeof values.passingPassFailCount === 'number' ? values.passingPassFailCount : undefined,
      });
      
      await updateTemplate({ 
        id: id!,
        body: requestBody,
      }).unwrap();
      
      message.success('Template saved successfully');
      
      // Update original configSets ref after successful save
      originalConfigSetsRef.current = JSON.parse(JSON.stringify(configSetsWithActions));
      
      // Update expected schema to match what we just saved
      if (formSchema) {
        expectedSchemaRef.current = formSchema as EditorDoc;
        setIsDirty(false);
      }
    } catch (err: unknown) {
      // Narrow unknown safely: prefer Error instance, otherwise handle API error shape
      if (err instanceof Error) {
        message.error(err.message || 'Failed to save template');
      } else {
        const apiErr = err as { data?: { message?: string } } | undefined;
        message.error(apiErr?.data?.message ?? 'Failed to save template');
      }
    }
  };

  /* ------------------- PUBLISH ------------------- */
  // const saveAllAndLock = async () => {
  //   try {
  //     const values = await form.validateFields();
  //     await saveMeta(values);
  //     await saveDraft();

  //     if (versionId) {
  //       await lockVersion(versionId).unwrap();
  //       message.success('Template locked and published');
  //     }
  //   } catch (err: any) {
  //     message.error(err?.data?.message ?? 'Failed to publish template');
  //   }
  // };

  /* ------------------- PREVIEW ------------------- */
  // const handlePreview = () => {
  //   const json = tiptap.getJSON();
  //   message.info({
  //     content: (
  //       <pre style={{ maxHeight: 300, overflow: 'auto', margin: 0 }}>
  //         {json ? JSON.stringify(json, null, 2) : 'Empty'}
  //       </pre>
  //     ),
  //     duration: 6,
  //   });
  // };

  const handlePrepopulateFromGlobal = (globalId: string) => {
    if (!globalId || !tiptap.editor) return;
    const records = globalTemplatesData?.data?.records ?? [];
    const selected = records.find((r) => r._id === globalId);
    const schema = selected?.currentGlobalFormTemplateSchema?.formSchema;
    if (!schema) {
      message.error('Global template has no form schema');
      setSelectedGlobalTemplateId(undefined);
      return;
    }
    const parsed = parseSchemaDocument(schema);
    const sanitized = normalizeEditorContent(parsed) as EditorDoc;
    tiptap.setJSON(sanitized);
    expectedSchemaRef.current = sanitized;
    setIsDirty(true);
    setSelectedGlobalTemplateId(undefined);
    message.success('Form schema loaded from global template');
  };

  // Precalculated totals from current form schema (for display and validation)
  const currentSchemaForScoring = tiptap.editor ? tiptap.getJSON() : null;
  const computedScoring = computeScoringFromSchema(currentSchemaForScoring);
  const totalScore = computedScoring.totalScore;
  const totalPassFail = computedScoring.totalPassFail;

  return (
    <div
      style={{
        background: token.colorBgLayout,
        padding: `0 ${isMobile ? token.paddingSM : token.paddingLG} ${isMobile ? 32 : 48}px`,
      }}
    >
      {/* ---------- HEADER ---------- */}
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
            <FormOutlined style={{ color: token.colorPrimary }} />
            Edit Template
            {isDirty && (
              <Text type="warning" style={{ fontSize: isMobile ? 11 : 12 }}>
                • Unsaved changes
              </Text>
            )}
          </Title>

          <Space size={isMobile ? 'small' : 'middle'}>
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

      {/* ---------- FORM + EDITOR ---------- */}
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
              onFinish={save}
              initialValues={{}}
            >
              <Row gutter={formRowGutter} style={{ width: '100%' }}>
                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    label="Name"
                    name="name"
                    rules={[{ required: true, message: 'Name is required' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input disabled={saving} size={inputSize} />
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

              {/* Config Sets Section */}
              <Divider style={dividerMargin}>
                <Space size={isMobile ? 'small' : 'middle'} wrap>
                  <Tooltip title="Add a new config set">
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      size={buttonSize}
                      onClick={() => {
                        const configSets =
                          form.getFieldValue('configSets') || [];
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
                      disabled={saving}
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
                                  disabled={saving}
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
                                disabled={saving}
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
                        No config sets added. Click "Add Config Set" to create
                        one.
                      </div>
                    )}
                  </div>
                )}
              </Form.List>

              {/* Scoring: precalculated totals and optional default passing thresholds */}
              <Divider style={dividerMargin}>
                <Text type="secondary">Scoring</Text>
              </Divider>
              <Row gutter={formRowGutter}>
                <Col xs={24} sm={24} md={12}>
                  <div style={{ marginBottom: 8 }}>
                    <Typography.Text type="secondary">Total score (from form)</Typography.Text>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>{totalScore}</div>
                  </div>
                </Col>
                <Col xs={24} sm={24} md={12}>
                  <div style={{ marginBottom: 8 }}>
                    <Typography.Text type="secondary">Total pass/fail count (from form)</Typography.Text>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>{totalPassFail}</div>
                  </div>
                </Col>
                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    label="Default passing score"
                    name="passingScore"
                    tooltip="Minimum score required to pass. Used as default when creating assignments from this template."
                    rules={[
                      { required: true, message: 'Default passing score is required' },
                      { type: 'number', min: 0, message: 'Must be ≥ 0' },
                      { type: 'number', max: totalScore, message: `Cannot exceed total score (${totalScore})` },
                    ]}
                  >
                    <InputNumber min={0} max={totalScore} style={{ width: '100%' }} placeholder="0" disabled={saving} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    label="Default passing pass/fail count"
                    name="passingPassFailCount"
                    tooltip="Minimum number of pass items required. Used as default when creating assignments from this template."
                    rules={[
                      { required: true, message: 'Default passing pass/fail count is required' },
                      { type: 'number', min: 0, message: 'Must be ≥ 0' },
                      { type: 'number', max: totalPassFail, message: `Cannot exceed total pass/fail count (${totalPassFail})` },
                    ]}
                  >
                    <InputNumber min={0} max={totalPassFail} style={{ width: '100%' }} placeholder="0" disabled={saving} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Prepopulate from global template"
                style={{ marginTop: dividerMargin.marginTop, marginBottom: 0 }}
              >
                <Select
                  placeholder="Select a global template to load its form schema…"
                  allowClear
                  value={selectedGlobalTemplateId}
                  onChange={(value) => {
                    setSelectedGlobalTemplateId(value ?? undefined);
                    if (value) handlePrepopulateFromGlobal(value);
                  }}
                  disabled={saving}
                  size={inputSize}
                  style={{ width: '100%' }}
                  options={(globalTemplatesData?.data?.records ?? []).map((r) => ({
                    label: r.name,
                    value: r._id,
                  }))}
                />
              </Form.Item>

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
