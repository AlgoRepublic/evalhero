/* eslint-disable @typescript-eslint/no-explicit-any */
import { validatePhoneNumber, Country, PhoneValidationResult } from './utils'; // Adjust path to your utils file
import React, { useState, useMemo } from 'react';
import { NodeViewProps, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import {
  Form,
  Input,
  Button,
  Space,
  Card,
  Typography,
  Tooltip,
  theme,
  Select,
  Modal,
  Tag,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import ShortTextEditModal from './editModel';
import { GroupedInputs } from './GroupedInputs';
import { NodeGroupingManager } from './NodeGroupingManager';
import countries from '../../../../../data/countries.json'; // Adjust path as needed
import { getQueryParam, evaluateVisibility, extractNodeLabel } from '../../utils';
import { Tag as TagType, useGetTagsByIdsQuery } from '../../../../../services/tagsApi';

const { Text } = Typography;
const { Option } = Select;

const prefixes = [
  'Mr.',
  'Mrs.',
  'Ms.',
  'Miss',
  'Dr.',
  'Prof.',
  'Rev.',
  'Hon.',
  'Capt.',
  'Col.',
  'Gen.',
  'Lt.',
  'Maj.',
  'Sgt.',
  'Sir',
  'Lady',
  'Lord',
  'Mx.',
  'Fr.',
  'Sr.',
  'Bro.',
];

const suffixes = [
  'Jr.',
  'Sr.',
  'II',
  'III',
  'IV',
  'Esq.',
  'PhD',
  'MD',
  'DO',
  'DDS',
  'JD',
  'RN',
  'CPA',
  'LPN',
  'MBA',
  'BSc',
  'MSc',
];

const ShortTextView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
  // getPos,
}) => {
  const { token } = theme.useToken();

  // Define a narrow type for the part of editor.storage we use to avoid `any`
  interface FormBuilderStorage {
    formBuilder?: {
      mode?: 'readonly' | 'edit' | 'submit';
    };
  }

  const storage = editor.storage as unknown as FormBuilderStorage;
  const mode = storage.formBuilder?.mode ?? 'readonly';
  const isSubmitMode = mode === 'submit';
  const submitted = (editor.storage as any)?.formBuilder?.submitted === true;

  // const IsSubmitMode = mode === 'submit';
  // const isReadonlyMode = mode === 'readonly';
  const isEditMode = mode === 'edit';

  const {
    variant = 'text',
    // label,
    // name,
    placeholder,
    minLength,
    maxLength,
    regex,
    mask,
    required,
    approvalRequired: rawApprovalRequired = false,
    requiredKeywords,
    requiredKeywordsMode = 'all',
    namePrefix,
    nameSuffix,
    namePrefixRequired = false,
    nameSuffixRequired = false,
    middleName,
    middleNameRequired = false,
    phoneCountryIsoCode = '',
    queryParam = null,
    visibility = { match: 'all', rules: [] },
    // Node-based grouping attributes (no longer configurable in edit UI, but kept for compatibility)
    // ⚠️ Historic schemas may store this as the string "false"/"true".
    // Always normalize to a boolean before using it in logic.
    enableGrouping = false,
    nodeGroups = [],
    nodeGroupValues = {},
    tags = [],
  } = node.attrs;
  const approvalRequired = typeof rawApprovalRequired === 'string' 
    ? rawApprovalRequired === 'true' 
    : !!rawApprovalRequired;
  const templateHasApproval = (editor.storage as any)?.formBuilder?.templateHasApproval;
  const effectiveApprovalRequired = templateHasApproval !== false && approvalRequired;
  const requiredBool = typeof required === 'string'
    ? required === 'true'
    : !!required;
  const enableGroupingBool =
    typeof enableGrouping === 'string'
      ? enableGrouping === 'true'
      : !!enableGrouping;

  const initialValue = String(node.attrs.value ?? '');
  const [prefix, setPrefix] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleNameValue, setMiddleNameValue] = useState('');
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<Country | null>(() => {
    if (!phoneCountryIsoCode) return null;
    return (
      countries.find((c: Country) => c.isoCode === phoneCountryIsoCode) || null
    );
  });

  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showGroupingModal, setShowGroupingModal] = useState(false);

  // Fetch tags for display using getByIds API (always, in all modes)
  // First check if tags are already in storage (from SubmitQueue optimization)
  // Otherwise, fetch by IDs using the getByIds API
  const editorStorage = (editor as any)?.storage?.formBuilder;
  const tagsFromStorage = editorStorage?.tagsByIds || [];
  const tagIds = (tags || []) as string[];
  const hasTagsInStorage = tagIds.length > 0 && tagsFromStorage.length > 0 && 
    tagIds.every((id) => tagsFromStorage.some((t: { _id: string; }) => t._id === id));
  
  const { data: tagsByIdsResponse } = useGetTagsByIdsQuery(
    { tagIds },
    { skip: tagIds.length === 0 || hasTagsInStorage }
  );
  
  const fetchedTags = tagsByIdsResponse?.data?.tags || [];
  
  const associatedTags: TagType[] = useMemo(() => {
    if (!tagIds || tagIds.length === 0) return [];
    // Use tags from storage if available and complete, otherwise use fetched tags
    const availableTags = hasTagsInStorage ? tagsFromStorage : fetchedTags;
    return availableTags.filter((tag: { _id: string; }) => tagIds.includes(tag._id));
  }, [tagIds, hasTagsInStorage, tagsFromStorage, fetchedTags]);
  // compute submit-mode required flag for red border/message
  const computeSubmitRequired = (): boolean => {
    if (!requiredBool || !isSubmitMode || !submitted) return false;
    if (variant === 'name') {
      // Enforce required parts for name
      if (!firstName.trim() || !lastName.trim()) return true;
      if (namePrefixRequired && !prefix) return true;
      if (middleNameRequired && !middleNameValue.trim()) return true;
      if (nameSuffixRequired && !suffix) return true;
      return false;
    }
    if (variant === 'phone') {
      const hasCountry = !!phoneCountry;
      const hasNumber = !!phoneNumber.trim();
      return !hasCountry || !hasNumber;
    }
    // Use live input state for immediate validation feedback (ignore possibly stale attrs)
    const liveValue = String(firstName ?? '').trim();
    return liveValue.length === 0;
  };
  const requiredErrorSubmit = computeSubmitRequired();

  // Query parameter handling - pre-populate from URL
  React.useEffect(() => {
    if (queryParam && isSubmitMode && !initialValue) {
      const paramValue = getQueryParam(queryParam);
      if (paramValue) {
        if (variant === 'name') {
          const parts = paramValue.split(' ').filter((part) => part);
          if (namePrefix && prefixes.includes(parts[0])) {
            setPrefix(parts[0]);
            parts.shift();
          }
          if (nameSuffix && suffixes.includes(parts[parts.length - 1])) {
            setSuffix(parts[parts.length - 1]);
            parts.pop();
          }
          if (parts.length >= 2 && middleName) {
            setFirstName(parts[0]);
            setMiddleNameValue(parts.slice(1, -1).join(' '));
            setLastName(parts[parts.length - 1]);
          } else if (parts.length >= 1) {
            setFirstName(parts[0]);
            setLastName(parts.slice(1).join(' '));
          }
        } else if (variant === 'phone') {
          const match = paramValue.match(/^(\+\d{1,4})?\s*(.*)$/);
          if (match) {
            const code = match[1] || '';
            const number = match[2] || paramValue;
            const country = countries.find((c: Country) => c.dialCode === code) || null;
            setPhoneCountry(country);
            setPhoneNumber(number);
          }
        } else {
          setFirstName(paramValue);
        }
      }
    }
  }, [queryParam, isSubmitMode, variant, namePrefix, nameSuffix, middleName]);

  // Visibility evaluation - get all field values from editor
  const formState = useMemo(() => {
    const json = editor.getJSON();
    const state: Record<string, any> = {};
    const walk = (node: any) => {
      if (node.attrs && node.attrs.name) {
        state[node.attrs.name] = node.attrs.value ?? null;
      }
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(walk);
      }
    };
    if (json.content) json.content.forEach(walk);
    return state;
  }, [editor, node.attrs.value]);

  const isVisible = useMemo(() => {
    if (!visibility?.rules || visibility.rules.length === 0) return true;
    return evaluateVisibility(visibility.rules, formState, visibility.match || 'all');
  }, [visibility, formState]);

  // Parse initial value and keep it in sync when attrs.value changes (readonly/submit hydration)
  React.useEffect(() => {
    if (variant === 'name' && initialValue) {
      const parts = initialValue.split(' ').filter((part) => part);
      let newPrefix = '';
      let newFirstName = '';
      let newMiddleName = '';
      let newLastName = '';
      let newSuffix = '';

      if (namePrefix && prefixes.includes(parts[0])) {
        newPrefix = parts[0];
        parts.shift();
      }
      if (nameSuffix && suffixes.includes(parts[parts.length - 1])) {
        newSuffix = parts[parts.length - 1];
        parts.pop();
      }
      if (parts.length >= 2 && middleName) {
        newFirstName = parts[0];
        newMiddleName = parts.slice(1, -1).join(' ');
        newLastName = parts[parts.length - 1];
      } else if (parts.length >= 1) {
        newFirstName = parts[0];
        newLastName = parts.slice(1).join(' ');
      }

      setPrefix(newPrefix);
      setFirstName(newFirstName);
      setMiddleNameValue(newMiddleName);
      setLastName(newLastName);
      setSuffix(newSuffix);
    } else if (variant === 'phone' && initialValue) {
      const match = initialValue.match(/^(\+\d{1,4})?\s*(.*)$/);
      if (match) {
        const code = match[1] || phoneCountry?.dialCode || '';
        const number = match[2] || initialValue;
        const country =
          countries.find((c: Country) => c.dialCode === code) || null;
        setPhoneCountry(country);
        setPhoneNumber(number);
      }
    } else {
      setFirstName(initialValue);
    }
  }, [initialValue, variant, namePrefix, nameSuffix, middleName, phoneCountry]);

  // Keep attrs.value synchronized with local state so submit JSON is always accurate
  React.useEffect(() => {
    // In readonly mode, we should not update the node attributes from local state
    // as this can overwrite the passed-in value with empty initial state
    if (mode === 'readonly') return;

    let val = firstName;
    if (variant === 'name') {
      val = [prefix, firstName, middleNameValue, lastName, suffix]
        .filter((v) => v)
        .join(' ')
        .trim();
      if (mask === 'uppercase') val = val.toUpperCase();
    } else if (variant === 'phone') {
      if (phoneCountry && phoneNumber) {
        val = `${phoneCountry.dialCode} ${phoneNumber}`.trim();
      } else {
        val = phoneNumber;
      }
    } else if (mask === 'uppercase') {
      val = (firstName || '').toUpperCase();
    } else if (mask === 'digitsOnly') {
      val = (firstName || '').replace(/\D/g, '');
    }
    updateAttributes({ value: val });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, prefix, firstName, middleNameValue, lastName, suffix, phoneCountry, phoneNumber, mask, mode]);

  // 🔥 Real-time name validation effect (including prefix/suffix)
  React.useEffect(() => {
    if (variant === 'name') {
      const applyError = (msg: string | null) => {
        if (mode === 'submit' && !touched) {
          setError(null);
        } else {
          setError(msg);
        }
      };

      // Check required prefix
      if (namePrefixRequired && !prefix) {
        applyError('Prefix required');
        return;
      }

      // Check required middle name
      if (middleNameRequired && !middleNameValue.trim()) {
        applyError('Middle name required');
        return;
      }

      // Check required suffix
      if (nameSuffixRequired && !suffix) {
        applyError('Suffix required');
        return;
      }

      // Check required first/last name
      if (required) {
        if (!firstName.trim()) {
          applyError('First name required');
          return;
        }
        if (!lastName.trim()) {
          applyError('Last name required');
          return;
        }
      }

      // Validate name format if any name parts are filled
      const nameParts = [firstName, middleNameValue, lastName].filter((v) => v);
      if (nameParts.length > 0) {
        const nameRegex = /^[A-Za-z\s]+$/;
        if (!nameParts.every((part) => nameRegex.test(part))) {
          applyError('Name must contain only letters and spaces');
          return;
        }
      }

      // Check length constraints
      const fullName = [prefix, firstName, middleNameValue, lastName, suffix]
        .filter((v) => v)
        .join(' ')
        .trim();
      
      if (minLength && fullName.length > 0 && fullName.length < minLength) {
        applyError(`Minimum ${minLength} characters`);
        return;
      }
      
      if (maxLength && fullName.length > maxLength) {
        applyError(`Maximum ${maxLength} characters`);
        return;
      }

      // All validations passed
      applyError(null);
    }
  }, [variant, prefix, firstName, middleNameValue, lastName, suffix, namePrefixRequired, middleNameRequired, nameSuffixRequired, required, minLength, maxLength, mode, touched]);

  // 🔥 Real-time phone validation effect
  React.useEffect(() => {
    if (variant === 'phone') {
      const applyError = (msg: string | null) => {
        if (mode === 'submit' && !touched) {
          setError(null);
        } else {
          setError(msg);
        }
      };
      const hasCountry = !!phoneCountry;
      const hasNumber = !!phoneNumber.trim();

      // Case 1: not required and both empty → no error
      if (!required && !hasCountry && !hasNumber) {
        applyError(null);
        return;
      }

      // Case 2: required but missing either part → error
      if (required && (!hasCountry || !hasNumber)) {
        applyError('Both country and phone number are required');
        return;
      }

      // Case 3: partial fill for optional → error
      if (
        !required &&
        (hasCountry || hasNumber) &&
        !(hasCountry && hasNumber)
      ) {
        applyError('Both country and phone number must be provided');
        return;
      }

      // Case 4: both filled → validate format
      if (hasCountry && hasNumber) {
        const result = validatePhoneNumber(phoneCountry, phoneNumber);
        if (!result.isValid) {
          applyError('Invalid phone number');
        } else {
          applyError(null);
        }
      }
    }
  }, [variant, phoneCountry, phoneNumber, required, mode, touched]);

  const validate = (val: string) => {
    const applyError = (msg: string | null) => {
      if (mode === 'submit' && !touched) {
        setError(null);
      } else {
        setError(msg);
      }
    };
    if (required && !val.trim()) {
      applyError('Required');
      return false;
    }
    if (variant === 'name') {
      if (namePrefixRequired && !prefix) {
        applyError('Prefix required');
        return false;
      }
      if (middleNameRequired && !middleNameValue.trim()) {
        applyError('Middle name required');
        return false;
      }
      if (nameSuffixRequired && !suffix) {
        applyError('Suffix required');
        return false;
      }
      if (required && !firstName.trim()) {
        applyError('First name required');
        return false;
      }
      if (required && !lastName.trim()) {
        applyError('Last name required');
        return false;
      }
      const nameParts = [firstName, middleNameValue, lastName].filter((v) => v);
      if (nameParts.length) {
        const nameRegex = /^[A-Za-z\s]+$/;
        if (!nameParts.every((part) => nameRegex.test(part))) {
          applyError('Name must contain only letters and spaces');
          return false;
        }
      }
      if (minLength && val.length < minLength) {
        applyError(`Minimum ${minLength} characters`);
        return false;
      }
      if (maxLength && val.length > maxLength) {
        applyError(`Maximum ${maxLength} characters`);
        return false;
      }
    } else if (variant === 'email' && val.trim()) {
      let re: RegExp;
      try {
        re =
          regex && regex.trim()
            ? new RegExp(regex)
            : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
      } catch {
        re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
      }
      if (!re.test(val)) {
        applyError('Invalid email format');
        return false;
      }
    } else if (variant === 'phone') {
      const hasCountry = !!phoneCountry;
      const hasNumber = !!phoneNumber.trim();

      // Case 1: not required and empty → no error
      if (!required && !hasCountry && !hasNumber) {
        applyError(null);
        return true;
      }

      // Case 2: required but missing either part → error
      if (required && (!hasCountry || !hasNumber)) {
        applyError('Both country and phone number are required');
        return false;
      }

      // Case 3: something entered (either required or optional)
      if (hasCountry && hasNumber) {
        const result: PhoneValidationResult = validatePhoneNumber(
          phoneCountry,
          phoneNumber
        );
        if (!result.isValid) {
          applyError('Invalid phone number');
          return false;
        }
      }

      // Case 4: not required but only one filled → soft validation
      if (
        !required &&
        (hasCountry || hasNumber) &&
        !(hasCountry && hasNumber)
      ) {
        applyError('Both country and phone number must be provided');
        return false;
      }

      applyError(null);
      return true;
    } else if (regex && val.trim()) {
      try {
        const re = new RegExp(regex);
        if (!re.test(val)) {
          applyError('Invalid format');
          return false;
        }
      } catch {
        applyError('Invalid regex');
        return false;
      }
    }
    if (requiredKeywords && variant === 'text' && val.trim()) {
      const keywords = requiredKeywords
        .split(',')
        .map((k: string) => k.trim())
        .filter((k: string) => k);
      if (keywords.length) {
        const hasAll = keywords.every((k: string) => val.includes(k));
        const hasAny = keywords.some((k: string) => val.includes(k));
        const has = requiredKeywordsMode === 'all' ? hasAll : hasAny;
        if (!has) {
          applyError(
            `Must include ${requiredKeywordsMode} of the keywords: ${requiredKeywords}`
          );
          return false;
        }
      }
    }
    applyError(null);
    return true;
  };

  const handleChange = (
    value: string | Country | null,
    field:
      | 'prefix'
      | 'firstName'
      | 'middleName'
      | 'lastName'
      | 'suffix'
      | 'phoneCountry'
      | 'phoneNumber'
  ) => {
    let newPrefix = prefix;
    let newFirstName = firstName;
    let newMiddleName = middleNameValue;
    let newLastName = lastName;
    let newSuffix = suffix;
    let newPhoneCountry = phoneCountry;
    let newPhoneNumber = phoneNumber;

    if (field === 'prefix') {
      newPrefix = value as string;
    } else if (field === 'firstName') {
      newFirstName = value as string;
    } else if (field === 'middleName') {
      newMiddleName = value as string;
    } else if (field === 'lastName') {
      newLastName = value as string;
    } else if (field === 'suffix') {
      newSuffix = value as string;
    } else if (field === 'phoneCountry') {
      newPhoneCountry = value as Country | null;
    } else if (field === 'phoneNumber') {
      newPhoneNumber = (value as string).replace(/[^\d+ ]/g, '');
    }

    let val = newFirstName;
    if (variant === 'name') {
      val = [newPrefix, newFirstName, newMiddleName, newLastName, newSuffix]
        .filter((v) => v)
        .join(' ')
        .trim();
      if (mask === 'uppercase') {
        val = val.toUpperCase();
      }
    } else if (variant === 'phone' && newPhoneCountry && newPhoneNumber) {
      val = `${newPhoneCountry.dialCode} ${newPhoneNumber}`.trim();
    } else if (variant === 'phone') {
      val = newPhoneNumber;
    } else if (mask === 'uppercase') {
      val = (value as string).toUpperCase();
    } else if (mask === 'digitsOnly') {
      val = (value as string).replace(/\D/g, '');
    } else {
      val = value as string;
    }

    if (field === 'prefix') setPrefix(newPrefix);
    else if (field === 'firstName') setFirstName(newFirstName);
    else if (field === 'middleName') setMiddleNameValue(newMiddleName);
    else if (field === 'lastName') setLastName(newLastName);
    else if (field === 'suffix') setSuffix(newSuffix);
    else if (field === 'phoneCountry') {
      setPhoneCountry(newPhoneCountry);

      if (newPhoneCountry) {
        updateAttributes({ phoneCountryIsoCode: newPhoneCountry.isoCode });
      } else {
        // Explicitly remove the attribute when cleared
        updateAttributes({ phoneCountryIsoCode: '' });
      }
    } else setPhoneNumber(newPhoneNumber);

    setTouched(true);
    validate(val);
    // Keep node attrs in sync for submit-time validation (all variants)
    updateAttributes({ value: val });
  };

  const handleBlur = () => {
    setTouched(true);
    let finalValue = firstName;

    if (variant === 'name') {
      finalValue = [prefix, firstName, middleNameValue, lastName, suffix]
        .filter((v) => v)
        .join(' ')
        .trim();
    } else if (variant === 'phone' && phoneCountry && phoneNumber) {
      const result = validatePhoneNumber(phoneCountry, phoneNumber);
      finalValue =
        result.international ||
        `${phoneCountry.dialCode} ${phoneNumber}`.trim();
    } else if (variant === 'phone') {
      finalValue = phoneNumber;
    }

    if (validate(finalValue)) {
      // ✅ Just update the text content, don't delete or reinsert node
      updateAttributes({ value: finalValue });
    }
  };

  // Get subjects, global/default groups and ungrouped subjects from storage
  const subjectsOptionsFromStorage =
    (editor.storage as any)?.formBuilder?.subjects || [];
  const globalGroups = (editor.storage as any)?.formBuilder?.globalGroups || [];
  const globalAvailableSubjects =
    (editor.storage as any)?.formBuilder?.availableSubjects || [];
  const isAllLocked = (editor.storage as any)?.formBuilder?.isAllLocked || false;

  // Determine which groups to use:
  // - If node-based grouping is enabled and nodeGroups exist, use node groups
  // - Otherwise use global groups (default for all nodes)
  const groupsToUse =
    enableGroupingBool && nodeGroups.length > 0 ? nodeGroups : globalGroups;

  // Compute ungrouped subjects for this node:
  // - If node-based groups are enabled and present, ungrouped = subjects not in any node group
  // - Otherwise, fall back to global ungrouped subjects
  const usedSubjectIds = new Set<string>();
  if (enableGroupingBool && nodeGroups.length > 0) {
    nodeGroups.forEach((g: any) => {
      (g.subjectIds || []).forEach((id: string) => usedSubjectIds.add(id));
    });
  }

  const availableSubjects =
    enableGroupingBool && nodeGroups.length > 0
      ? subjectsOptionsFromStorage.filter((s: any) => !usedSubjectIds.has(s.value))
      : globalAvailableSubjects;

  // Show grouping in submit mode or readonly mode, after "Start Submission" lock, and
  // when there is at least one group or ungrouped subject
  // In readonly mode, show groups even if isAllLocked is false (for viewing before submission starts)
  const isReadonlyMode = mode === 'readonly';
  const shouldShowGrouping =
    (isSubmitMode || isReadonlyMode) &&
    (isSubmitMode ? isAllLocked : true) && // In submit mode, require isAllLocked; in readonly, always show if groups exist
    (groupsToUse.length > 0 || availableSubjects.length > 0);

  // Don't render if not visible (except in edit mode)
  if (!isVisible && !isEditMode) {
    return null;
  }

  return (
    <NodeViewWrapper
      {...(isEditMode ? { 'data-drag-handle': true } : {})}
      style={{ margin: '8px 0', display: isVisible || isEditMode ? 'block' : 'none' }}
      data-node-type="shortText"
      data-node-name={String((node.attrs as any)?.name || '')}
    >
      <ShortTextEditModal
        open={showModal}
        onClose={() => setShowModal(false)}
        nodeAttrs={node.attrs}
        onSave={(values) => {
          updateAttributes(values);
          setShowModal(false);
        }}
      />
      {/* Submit-mode only: per-field grouping configuration in a popup */}
      {isSubmitMode && (
        <Modal
          open={showGroupingModal}
          title="Configure Groups for This Field"
          onCancel={() => setShowGroupingModal(false)}
          footer={null}
          destroyOnHidden
        >
          <NodeGroupingManager
            value={{
              enableGrouping: enableGroupingBool,
              nodeGroups: nodeGroups || [],
            }}
            onChange={(value) => {
              updateAttributes({
                enableGrouping: value.enableGrouping,
                nodeGroups: value.nodeGroups,
              });
            }}
            subjectsOptions={subjectsOptionsFromStorage}
            globalGroups={globalGroups}
            fieldLabel={extractNodeLabel(node)}
          />
        </Modal>
      )}
      <Card
        size="small"
        style={{
          margin: '8px 0',
          borderColor:
            !isEditMode && (error || requiredErrorSubmit) ? token.colorError : token.colorBorder,
          borderRadius: token.borderRadiusLG,
          transition: 'border-color 0.2s ease',
          background: token.colorBgContainer,
        }}
        variant="outlined"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 6, width: '100%' }} contentEditable={mode === 'submit' ? false : undefined}>
              <NodeViewContent className="shorttext-label" />
            </div>
            {requiredBool && (
              <Tag
                color="red"
                style={{
                  marginLeft: 0,
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  paddingInline: 8,
                  paddingBlock: 2,
                  marginBottom: 6,
                }}
              >
                Required
              </Tag>
            )}
            {!isSubmitMode && effectiveApprovalRequired && (
              <Tag
                color="warning"
                style={{
                  marginLeft: 0,
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  paddingInline: 8,
                  paddingBlock: 2,
                  marginBottom: 6,
                }}
              >
                <ExclamationCircleOutlined style={{ fontSize: 12 }} />
                <span style={{ marginLeft: 4 }}>Approval required</span>
              </Tag>
            )}
            {associatedTags.length > 0 && (
              <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'nowrap', gap: 4, alignItems: 'center', overflowX: 'auto' }}>
                <span style={{ fontSize: 11, color: token.colorTextSecondary, marginRight: 4, flexShrink: 0 }}>Tags:</span>
                {associatedTags.map((tag) => (
                  <Tag key={tag._id} color="blue" style={{ fontSize: 11, flexShrink: 0 }}>
                    {tag.name}
                  </Tag>
                ))}
              </div>
            )}
            <Form.Item
              style={{ marginBottom: 0 }}
              validateStatus={!isEditMode && (error || requiredErrorSubmit) ? 'error' : undefined}
              help={
                !isEditMode
                  ? error ||
                    (requiredErrorSubmit
                      ? variant === 'name'
                        ? 'Please complete the required name parts'
                        : variant === 'phone'
                          ? 'Country and phone number are required'
                          : 'This field is required'
                      : undefined)
                  : undefined
              }
              labelCol={{ span: 24 }}
            >
            {shouldShowGrouping ? (
              <>
                {isSubmitMode && (
                  <div style={{ marginBottom: 12, textAlign: 'right' }}>
                    <Button
                      size="small"
                      icon={<SettingOutlined />}
                      variant='solid'
                      color='blue'
                      type="default"
                      onClick={() => setShowGroupingModal(true)}
                    >
                      Subject Group Settings
                    </Button>
                  </div>
                )}
                <GroupedInputs
                  groups={groupsToUse}
                  availableSubjects={availableSubjects}
                  variant={variant}
                  placeholder={placeholder}
                  minLength={minLength}
                  maxLength={maxLength}
                  required={required}
                  namePrefix={namePrefix}
                  nameSuffix={nameSuffix}
                  namePrefixRequired={namePrefixRequired}
                  nameSuffixRequired={nameSuffixRequired}
                  middleName={middleName}
                  middleNameRequired={middleNameRequired}
                  phoneCountryIsoCode={phoneCountryIsoCode}
                  initialValues={nodeGroupValues}
                  isReadonly={isReadonlyMode}
                  onValueChange={(entityId, value) => {
                    const updated = { ...nodeGroupValues, [entityId]: value };
                    
                    // Sync values between grouped and ungrouped subjects
                    // If a group value is changed, also store it for each subject in that group
                    if (entityId.startsWith('group-')) {
                      const groupId = entityId.replace('group-', '');
                      const group = groupsToUse.find((g: any) => g.id === groupId);
                      if (group && group.subjectIds) {
                        // Store the group value for each subject in the group as ungrouped value
                        group.subjectIds.forEach((subjectId: string) => {
                          const ungroupedKey = `ungrouped-${subjectId}`;
                          updated[ungroupedKey] = value;
                        });
                      }
                    }
                    // If an ungrouped value is changed, also update the group value if that subject is in a group
                    else if (entityId.startsWith('ungrouped-')) {
                      const subjectId = entityId.replace('ungrouped-', '');
                      // Find which group(s) this subject belongs to
                      const subjectGroups = groupsToUse.filter((g: any) => 
                        g.subjectIds && g.subjectIds.includes(subjectId)
                      );
                      // Update group value for each group this subject belongs to
                      subjectGroups.forEach((group: any) => {
                        const groupKey = `group-${group.id}`;
                        updated[groupKey] = value;
                        // Also update ungrouped values for all other subjects in the same group
                        group.subjectIds.forEach((otherSubjectId: string) => {
                          const otherUngroupedKey = `ungrouped-${otherSubjectId}`;
                          updated[otherUngroupedKey] = value;
                        });
                      });
                    }
                    
                    updateAttributes({ nodeGroupValues: updated });
                  }}
                  subjectsOptions={subjectsOptionsFromStorage}
                  approvalRequired={effectiveApprovalRequired}
                  approvalStatus={node.attrs.approvalStatus}
                  editor={editor}
                  node={node}
                />
              </>
            ) : variant === 'name' ? (
              <Space>
                {namePrefix && (
                  <Select
                    value={prefix}
                    onChange={(value) => handleChange(value, 'prefix')}
                    style={{ width: 100 }}
                    allowClear={!required}
                    disabled={mode !== 'submit'}
                    placeholder="Prefix"
                  >
                    {prefixes.map((p) => (
                      <Option key={p} value={p}>
                        {p}
                      </Option>
                    ))}
                  </Select>
                )}
                <Input
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => handleChange(e.target.value, 'firstName')}
                  onBlur={handleBlur}
                  maxLength={maxLength || undefined}
                  size="middle"
                  style={{ width: 150 }}
                  readOnly={mode !== 'submit'}
                />
                {middleName && (
                  <Input
                    placeholder="Middle Name"
                    value={middleNameValue}
                    onChange={(e) => handleChange(e.target.value, 'middleName')}
                    onBlur={handleBlur}
                    maxLength={maxLength || undefined}
                    size="middle"
                    style={{ width: 150 }}
                    readOnly={mode !== 'submit'}
                  />
                )}
                <Input
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => handleChange(e.target.value, 'lastName')}
                  onBlur={handleBlur}
                  maxLength={maxLength || undefined}
                  size="middle"
                  style={{ width: 150 }}
                  readOnly={mode !== 'submit'}
                />
                {nameSuffix && (
                  <Select
                    value={suffix}
                    onChange={(value) => handleChange(value, 'suffix')}
                    style={{ width: 100 }}
                    allowClear={!required}
                    disabled={mode !== 'submit'}
                    placeholder="Suffix"
                  >
                    {suffixes.map((s) => (
                      <Option key={s} value={s}>
                        {s}
                      </Option>
                    ))}
                  </Select>
                )}
              </Space>
            ) : variant === 'phone' ? (
              <Space>
                <Select
                  value={phoneCountry?.isoCode}
                  onChange={(value) => {
                    const country = value
                      ? countries.find((c: Country) => c.isoCode === value) ||
                        null
                      : null;
                    handleChange(country, 'phoneCountry');
                  }}
                  placeholder="Select Country"
                  style={{ width: 200 }}
                  showSearch
                  allowClear
                  disabled={mode !== 'submit'}
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  {countries.map((country: Country) => (
                    <Option key={country.isoCode} value={country.isoCode}>
                      {`${country.emoji} ${country.name} (${country.dialCode})`}
                    </Option>
                  ))}
                </Select>
                <Input
                  placeholder="Phone Number"
                  value={phoneNumber}
                  onChange={(e) => handleChange(e.target.value, 'phoneNumber')}
                  onBlur={handleBlur}
                  maxLength={maxLength || undefined}
                  size="middle"
                  style={{ width: 200 }}
                  readOnly={mode !== 'submit'}
                />
              </Space>
            ) : (
              <Input
                placeholder={placeholder}
                // In readonly/submit, prefer attrs.value to ensure hydrated value is displayed
                value={isEditMode ? firstName : String(node.attrs.value ?? firstName)}
                onChange={(e) => handleChange(e.target.value, 'firstName')}
                onBlur={handleBlur}
                maxLength={maxLength || undefined}
                size="middle"
                status={error ? 'error' : undefined}
                type={variant === 'email' ? 'email' : 'text'}
                readOnly={mode !== 'submit'}
              />
            )}
            {maxLength && (
              <Text
                type="secondary"
                style={{
                  fontSize: 12,
                  display: 'block',
                  textAlign: 'right',
                  marginTop: 2,
                }}
              >
                {variant === 'name'
                  ? [firstName, middleNameValue, lastName].join(' ').length
                  : variant === 'phone'
                    ? phoneNumber.length
                    : firstName.length}
                /{maxLength}
              </Text>
            )}
            </Form.Item>
          </div>

          {isEditMode && (
            <Space size={4} style={{ alignSelf: 'flex-start', marginLeft: 8 }}>
              <Tooltip title="Edit field settings">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => setShowModal(true)}
                />
              </Tooltip>
              <Tooltip title="Delete field">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={deleteNode}
                />
              </Tooltip>
            </Space>
          )}
        </div>
      </Card>
    </NodeViewWrapper>
  );
};

export default ShortTextView;
