/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSONContent, NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Radio,
  Select,
  Space,
  Button,
  Flex,
  Tooltip,
  theme,
  Card,
  Input,
  Tag,
  Modal,
  Typography,
} from 'antd';
import { EditOutlined, DeleteOutlined, SettingOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
// import { getSetEditingNodeFromEditor } from '../../utils';
import SingleChoiceEditModal from './editModel';
import { NodeGroupingManager } from '../ShortTextField/NodeGroupingManager';
import { getQueryParam, evaluateVisibility, extractNodeLabel } from '../../utils';
import { getApprovalStatusForSubject } from '../../../../forms/QueuesComponents/questionApprovalUtils';
import { useGetTagsByIdsQuery } from '../../../../../services/tagsApi';
import { AssetImage } from '../../../../../components';

const { Option } = Select;
const { Text } = Typography;

function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length;
  while (currentIndex > 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}

const SingleChoiceComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
  getPos,
}) => {
  const { token } = theme.useToken();

  const {
    variant = 'radio',
    layout = 'horizontal',
    randomize = false,
    value = null,
    allowOther = false,
    otherPlaceholder = 'Other…',
    enablePoints = false,
    enablePassFail = false,
    enableCalculation = false,
    optionPoints = {},
    optionLimits = {},
    required = false,
    approvalRequired: rawApprovalRequired = false,
    queryParam = null,
    visibility = { match: 'all', rules: [] },
    enableGrouping = false,
    nodeGroups = [],
    nodeGroupValues = {},
    tags = [],
  } = node.attrs as any;
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
  // Convert enablePoints and enablePassFail from string to boolean if needed
  const enablePointsBool = typeof enablePoints === 'string'
    ? enablePoints === 'true'
    : !!enablePoints;
  const enablePassFailBool = typeof enablePassFail === 'string'
    ? enablePassFail === 'true'
    : !!enablePassFail;
  
  // Ensure optionPoints is always an object, not an array or null
  // If it's an array, we need to convert it to an object keyed by option values
  const normalizedOptionPoints: Record<string, any> = useMemo(() => {
    if (!optionPoints) return {};
    if (Array.isArray(optionPoints)) {
      // Convert array to object by mapping to option values
      // This handles legacy data where optionPoints was stored as an array
      const result: Record<string, any> = {};
      const content = node.content?.content;
      if (Array.isArray(content)) {
        const optionNodes = content.filter((child: any) => child?.type?.name === 'singleChoiceOption');
        optionNodes.forEach((child: any, index: number) => {
          const optValue = child?.attrs?.value;
          if (optValue != null && optionPoints[index] != null) {
            result[String(optValue)] = optionPoints[index];
          }
        });
      }
      return result;
    }
    if (typeof optionPoints === 'object') {
      return optionPoints;
    }
    return {};
  }, [optionPoints, node.content]);

  const content = node.content?.content;
  const otherNode = Array.isArray(content)
    ? content.find((child: any) => child?.type?.name === 'singleChoiceOther')
    : undefined;

  const otherValue = otherNode?.textContent || '';

  const [error] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showGroupingModal, setShowGroupingModal] = useState(false);

  // const setEditingNode = getSetEditingNodeFromEditor(editor);

  const mode = (editor.storage as any).formBuilder?.mode || 'readonly';
  const isSubmitMode = mode === 'submit';

  // const IsSubmitMode = mode === 'submit';
  // const isReadonlyMode = mode === 'readonly';
  const isEditMode = mode === 'edit';

  // Fetch tags for display using getByIds API (always, in all modes)
  // First check if tags are already in storage (from SubmitQueue optimization)
  // Otherwise, fetch by IDs using the getByIds API
  const editorStorage = useMemo(() => (editor as any)?.storage?.formBuilder, [editor]);
  const tagsFromStorage = editorStorage?.tagsByIds || [];
  const tagIds = (tags || []) as string[];
  const hasTagsInStorage = tagIds.length > 0 && tagsFromStorage.length > 0 && 
    tagIds.every((id) => tagsFromStorage.some((t: { _id: string; }) => t._id === id));
  
  const { data: tagsByIdsResponse } = useGetTagsByIdsQuery(
    { tagIds },
    { skip: tagIds.length === 0 || hasTagsInStorage }
  );
  
  const fetchedTags = tagsByIdsResponse?.data?.tags || [];
  
  const associatedTags = useMemo(() => {
    if (!tagIds || tagIds.length === 0) return [];
    // Use tags from storage if available and complete, otherwise use fetched tags
    const availableTags = hasTagsInStorage ? tagsFromStorage : fetchedTags;
    return availableTags.filter((tag: { _id: string; }) => tagIds.includes(tag._id));
  }, [tagIds, hasTagsInStorage, tagsFromStorage, fetchedTags]);

  const onChange = (val: string) => {
    const content = node.content?.content;
    const hasOther = Array.isArray(content)
      ? !!content.find((child: any) => child?.type?.name === 'singleChoiceOther')
      : false;
    if (val === '__other__' && !hasOther) {
      const pos = typeof getPos === 'function' ? getPos() : null;
      if (pos != null && editor?.commands?.insertContentAt) {
      editor.commands.insertContentAt(pos + node.nodeSize - 1, {
        type: 'singleChoiceOther',
        attrs: {
          value: '__other__',
          points: 0,
          isCorrect: false,
        },
      });
      } else {
        // Position or command not available in this context; skip inserting node.
        // (node attribute update below will still set the value)
        console.warn(
          'Cannot insert "Other" node: editor position or command not available.'
        );
      }
    }
    updateAttributes({ value: val });
  };

  const options: {
    value: string;
    label: string;
    imageUrl: string | null;
    isCorrect: boolean;
    points: number;
  }[] = useMemo(() => {
    // Helper function to clean label by removing scoring details in parentheses
    const cleanLabel = (text: string, shouldClean: boolean): string => {
      if (!shouldClean) return text;
      // Remove scoring details in parentheses like "(Correct, 10 pts)", "(Incorrect, 0 pts)", "(Partial, 5 pts)", etc.
      return text.replace(/\s*\([^)]*\)\s*$/, '').trim();
    };

    if (variant === 'yesno') {
      return [
        {
          value: 'Yes',
          label: 'Yes',
          imageUrl: null,
          isCorrect: node.attrs.optionPoints?.Yes?.isCorrect || false,
          points: typeof node.attrs.optionPoints?.Yes?.points === 'number' 
            ? node.attrs.optionPoints.Yes.points 
            : (node.attrs.optionPoints?.Yes?.points !== undefined && node.attrs.optionPoints?.Yes?.points !== null && node.attrs.optionPoints?.Yes?.points !== ''
                ? (typeof node.attrs.optionPoints.Yes.points === 'string' && !isNaN(Number(node.attrs.optionPoints.Yes.points)) && node.attrs.optionPoints.Yes.points.trim() !== ''
                    ? Number(node.attrs.optionPoints.Yes.points)
                    : 0)
                : 0),
        },
        {
          value: 'No',
          label: 'No',
          imageUrl: null,
          isCorrect: node.attrs.optionPoints?.No?.isCorrect || false,
          points: typeof node.attrs.optionPoints?.No?.points === 'number' 
            ? node.attrs.optionPoints.No.points 
            : (node.attrs.optionPoints?.No?.points !== undefined && node.attrs.optionPoints?.No?.points !== null && node.attrs.optionPoints?.No?.points !== ''
                ? (typeof node.attrs.optionPoints.No.points === 'string' && !isNaN(Number(node.attrs.optionPoints.No.points)) && node.attrs.optionPoints.No.points.trim() !== ''
                    ? Number(node.attrs.optionPoints.No.points)
                    : 0)
                : 0),
        },
      ];
    }

    const content = node.content?.content;
    if (!Array.isArray(content)) {
      return [];
    }

    // console.log('content', content);
    return content
      .filter((child: any) => child?.type?.name === 'singleChoiceOption')
      .map((child: any) => {
        const rawLabel = child?.textContent || child?.attrs?.value || child?.attrs?.label || '';
        const optValue = child?.attrs?.value || '';
        
        // Get points: prioritize from child.attrs.points (node attribute), fall back to optionPoints
        let points = 0;
        if (child?.attrs?.points !== undefined && child?.attrs?.points !== null && child?.attrs?.points !== '') {
          points = typeof child.attrs.points === 'number' 
            ? child.attrs.points 
            : (typeof child.attrs.points === 'string' && !isNaN(Number(child.attrs.points)) && child.attrs.points.trim() !== ''
                ? Number(child.attrs.points)
                : 0);
        } else if (node.attrs.optionPoints?.[optValue]?.points !== undefined && node.attrs.optionPoints[optValue].points !== null && node.attrs.optionPoints[optValue].points !== '') {
          const pointsValue = node.attrs.optionPoints[optValue].points;
          points = typeof pointsValue === 'number' 
            ? pointsValue 
            : (typeof pointsValue === 'string' && !isNaN(Number(pointsValue)) && pointsValue.trim() !== ''
                ? Number(pointsValue)
                : 0);
        }
        
        return {
          value: optValue,
          label: cleanLabel(rawLabel, isSubmitMode),
          imageUrl: child?.attrs?.imageUrl || null,
          isCorrect: child?.attrs?.isCorrect == true || child?.attrs?.isCorrect == 'true',
          points: points,
          submissionLimit: child?.attrs?.submissionLimit || null,
        };
      });
  }, [variant, node, isSubmitMode]);

  // Stable randomization for single choice: only when source options change
  const [shuffledValues, setShuffledValues] = useState<string[]>([]);
  const lastSourceValuesRef = useRef<string[] | null>(null);
  const sourceValuesKey = useMemo(
    () => Array.isArray(options) ? options.map((o) => String(o?.value || '')).join('|') : '',
    [options]
  );
  useEffect(() => {
    const sourceValues = options.map((o) => o.value);
    const sameOrder =
      !!lastSourceValuesRef.current &&
      lastSourceValuesRef.current.length === sourceValues.length &&
      lastSourceValuesRef.current.every((v, i) => v === sourceValues[i]);
    if (randomize && variant !== 'yesno') {
      if (!sameOrder) {
        lastSourceValuesRef.current = sourceValues.slice();
        setShuffledValues((prev) =>
          prev.length ? prev : shuffle([...sourceValues])
        );
      }
    } else {
      lastSourceValuesRef.current = sourceValues.slice();
      if (shuffledValues.length) setShuffledValues([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [randomize, variant, sourceValuesKey]);

  const displayOptions = useMemo(() => {
    if (randomize && variant !== 'yesno' && shuffledValues.length) {
      const byValue = new Map(options.map((o) => [o.value, o] as const));
      return shuffledValues
        .map((v) => byValue.get(v))
        .filter(Boolean) as typeof options;
    }
    return options;
  }, [randomize, variant, shuffledValues, options]);

  // Query parameter handling - pre-populate from URL
  useEffect(() => {
    if (queryParam && isSubmitMode && !value) {
      const paramValue = getQueryParam(queryParam);
      if (paramValue) {
        // Parse query param: can be index (0,1,2), label name, or comma-separated
        const paramParts = paramValue.split(',');
        const firstPart = paramParts[0].trim();
        
        // Try to match by index
        const index = parseInt(firstPart, 10);
        if (!isNaN(index) && index >= 0 && index < options.length) {
          onChange(options[index].value);
          return;
        }
        
        // Try to match by label/value
        const matchedOption = options.find(
          (opt) => opt.value === firstPart || opt.label === firstPart
        );
        if (matchedOption) {
          onChange(matchedOption.value);
        }
      }
    }
  }, [queryParam, isSubmitMode, options]);

  // Visibility evaluation
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

  // Global/default groups and subjects from editor storage
  const subjectsOptionsFromStorage =
    (editor.storage as any)?.formBuilder?.subjects || [];
  const globalGroups =
    (editor.storage as any)?.formBuilder?.globalGroups || [];
  const globalAvailableSubjects =
    (editor.storage as any)?.formBuilder?.availableSubjects || [];
  const isAllLocked =
    (editor.storage as any)?.formBuilder?.isAllLocked || false;

  // Determine groups to use: node-level groups if enabled, otherwise global
  const groupsToUse =
    enableGroupingBool && (nodeGroups as any[]).length > 0
      ? (nodeGroups as any[])
      : globalGroups;

  // Compute node-level ungrouped subjects when node groups exist,
  // otherwise fall back to global ungrouped subjects
  const usedSubjectIds = new Set<string>();
  if (enableGroupingBool && (nodeGroups as any[]).length > 0) {
    (nodeGroups as any[]).forEach((g: any) => {
      (g.subjectIds || []).forEach((id: string) => usedSubjectIds.add(id));
    });
  }
  const availableSubjects =
    enableGroupingBool && (nodeGroups as any[]).length > 0
      ? subjectsOptionsFromStorage.filter(
          (s: any) => !usedSubjectIds.has(s.value),
        )
      : globalAvailableSubjects;

  const isReadonlyMode = mode === 'readonly';
  const canOpenApprovalDrawer = (editor.storage as any)?.formBuilder?.canOpenApprovalDrawer === true;
  const shouldShowGrouping =
    (isSubmitMode || isReadonlyMode) &&
    (isSubmitMode ? isAllLocked : true) && // In submit mode, require isAllLocked; in readonly, always show if groups exist
    (groupsToUse.length > 0 || availableSubjects.length > 0);

  // Helper function to sync grouped/ungrouped values
  const updateEntityValue = (entityId: string, val: any) => {
    const updated = {
      ...(nodeGroupValues as any),
      [entityId]: val,
    };

    // Sync values between grouped and ungrouped subjects
    // If a group value is changed, also store it for each subject in that group
    if (entityId.startsWith('group-')) {
      const groupId = entityId.replace('group-', '');
      const group = groupsToUse.find((g: any) => g.id === groupId);
      if (group && group.subjectIds) {
        // Store the group value for each subject in the group as ungrouped value
        group.subjectIds.forEach((subjectId: string) => {
          const ungroupedKey = `ungrouped-${subjectId}`;
          updated[ungroupedKey] = val;
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
        updated[groupKey] = val;
        // Also update ungrouped values for all other subjects in the same group
        group.subjectIds.forEach((otherSubjectId: string) => {
          const otherUngroupedKey = `ungrouped-${otherSubjectId}`;
          updated[otherUngroupedKey] = val;
        });
      });
    }

    updateAttributes({ nodeGroupValues: updated });
  };

  // Filter options based on submission limits
  const availableOptions = useMemo(() => {
    return displayOptions.filter((opt) => {
      const limit = optionLimits[opt.value];
      if (limit && typeof limit === 'number' && limit > 0) {
        // In a real implementation, you'd check submission count from server
        // For now, we'll just show all options
        return true;
      }
      return true;
    });
  }, [displayOptions, optionLimits]);

  // const content = node.content?.content;
  const hasOtherNode = Array.isArray(content)
    ? !!content.find((child: any) => child?.type?.name === 'singleChoiceOther')
    : false;
  const isOtherSelected = value === '__other__';
  const isOtherFilled = (otherValue || '').trim().length > 0;
  const requiredError =
    isSubmitMode &&
    required &&
    (!value || (isOtherSelected && hasOtherNode && !isOtherFilled));

  const renderMeta = (optValue: string) => {
    // Show points and correct/incorrect info only in edit mode
    if (!isEditMode) return null;
    if (!enablePointsBool && !enablePassFailBool) return null;
    
    // Get meta from optionPoints, but also check the options array for isCorrect
    // (since isCorrect is stored in child node attrs, not always in optionPoints)
    const meta = normalizedOptionPoints?.[optValue] || {};
    const optionFromArray = options.find(opt => opt.value === optValue);
    
    const parts: React.ReactNode[] = [];
    
    // Handle points - convert string to number if needed
    // Prioritize from optionPoints, but could also come from option if needed
    const pointsValue = meta.points;
    const points = typeof pointsValue === 'number' 
      ? pointsValue 
      : (pointsValue !== undefined && pointsValue !== null && pointsValue !== '' 
          ? (typeof pointsValue === 'string' && !isNaN(Number(pointsValue)) && pointsValue.trim() !== ''
              ? Number(pointsValue)
              : pointsValue)
          : undefined);
    
    if (enablePointsBool && typeof points === 'number') {
      parts.push(
        <Tag
          key={`pts-${optValue}`}
          color="geekblue"
          style={{ marginInlineEnd: 0, fontSize: '11px' }}
        >
          {points} pts
        </Tag>
      );
    }
    
    // Handle isCorrect - prioritize from option array (child node attrs), fall back to optionPoints
    // This is important because isCorrect is stored in child.attrs.isCorrect, not always in optionPoints
    const isCorrectValue = optionFromArray?.isCorrect !== undefined 
      ? optionFromArray.isCorrect 
      : meta.isCorrect;
    const isCorrect = typeof isCorrectValue === 'boolean'
      ? isCorrectValue
      : (isCorrectValue === 'true' || isCorrectValue === true
          ? true
          : (isCorrectValue === 'false' || isCorrectValue === false || isCorrectValue === null || isCorrectValue === undefined
              ? false
              : !!isCorrectValue));
    
    if (enablePassFailBool && typeof isCorrect === 'boolean') {
      parts.push(
        <Tag 
          key={`pf-${optValue}`} 
          color={isCorrect ? 'green' : 'red'}
          style={{ fontSize: '11px' }}
        >
          {isCorrect ? 'Correct' : 'Incorrect'}
        </Tag>
      );
    }
    if (!parts.length) return null;
    return <Space size={4} wrap style={{ marginLeft: 4 }}>{parts}</Space>;
  };

  const renderBadgesRow = () => {
    const tags: React.ReactNode[] = [];
    // Removed Yes/No tag as it's redundant - the Yes/No radio buttons already indicate the variant
    if (randomize && variant !== 'yesno')
      tags.push(
        <Tag key="rnd" color="blue">
          Randomized
        </Tag>
      );
    // Hide scoring-related badges in submit mode
    if (!isSubmitMode) {
      if (enablePassFailBool)
        tags.push(
          <Tag key="pf" color="green">
            Pass/Fail
          </Tag>
        );
      if (enablePointsBool)
        tags.push(
          <Tag key="pts" color="geekblue">
            Points
          </Tag>
        );
      if ((node.attrs as any).failCritical)
        tags.push(
          <Tag key="fc" color="orange">
            Fail Critical
          </Tag>
        );
    }
    if (requiredBool)
      tags.push(
        <Tag key="req" color="red">
          Required
        </Tag>
      );
    if (enableCalculation)
      tags.push(
        <Tag key="calc" color="purple">
          Calculable
        </Tag>
      );
    if (!tags.length) return null;
    return (
      <Space size={4} style={{ marginBottom: 8 }} wrap>
        {tags}
      </Space>
    );
  };

  const handleSave = (values: any) => {
    const {
      options: newOptions,
      yesPoints,
      noPoints,
      otherPoints,
      yesIsCorrect,
      noIsCorrect,
      otherIsCorrect,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      optionPoints: _optionPoints, // Exclude from attrs - we build it separately
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      optionLimits: _optionLimits, // Exclude from attrs - we build it separately
      ...attrs
    } = values;

    // --- 1️⃣ Build final options with all attributes ---
    let finalOptions = [];
    const finalOptionPoints: Record<string, any> = {};
    const finalOptionLimits: Record<string, number> = {};

    if (values.variant === 'yesno') {
      finalOptions = [
        {
          label: 'Yes',
          value: 'Yes',
          imageUrl: null,
          points: yesPoints || 0,
          isCorrect: yesIsCorrect || false,
        },
        {
          label: 'No',
          value: 'No',
          imageUrl: null,
          points: noPoints || 0,
          isCorrect: noIsCorrect || false,
        },
      ];
    } else {
      finalOptions = (newOptions || []).map((opt: any) => ({
        label: opt.label,
        value: opt.value || opt.label,
        imageUrl: opt.imageUrl || null,
        points: opt.points || 0,
        isCorrect: opt.isCorrect || false,
        submissionLimit: opt.submissionLimit || null,
      }));
    }

    // Add "Other" if enabled
    if (values.allowOther) {
      finalOptions.push({
        label: values.otherPlaceholder || 'Other',
        value: '__other__',
        imageUrl: null,
        points: otherPoints || 0,
        isCorrect: otherIsCorrect || false,
      });
    }

    // Build optionPoints (for compatibility)
    // Ensure we only process options with valid values
    finalOptions.forEach(
      (opt: { value: string | number; points: any; isCorrect: any; submissionLimit?: number }) => {
        // Only add to optionPoints if value is valid (not empty, null, or undefined)
        if (opt.value != null && opt.value !== '') {
          finalOptionPoints[String(opt.value)] = {
            points: opt.points || 0,
            isCorrect: opt.isCorrect || false,
          };
          if (opt.submissionLimit && opt.submissionLimit > 0) {
            finalOptionLimits[String(opt.value)] = opt.submissionLimit;
          }
        }
      }
    );
    // Always ensure optionPoints and optionLimits are objects, not arrays
    attrs.optionPoints = finalOptionPoints;
    attrs.optionLimits = finalOptionLimits;

    // --- 2️⃣ Update parent node attributes ---
    updateAttributes(attrs);

    const currentPos = typeof getPos === 'function' ? getPos() : null;
    if (currentPos == null) {
      setShowModal(false);
      return;
    }

    const currentNode = editor.state.doc.nodeAt(currentPos);

    // --- 3️⃣ Build mirrored option nodes ---
    const optionNodes = finalOptions
      .filter((opt: { value: string }) => opt.value !== '__other__')
      .map(
        (opt: {
          label: any;
          value: any;
          imageUrl: any;
          points: any;
          isCorrect: any;
        }) => ({
          type: 'singleChoiceOption',
          attrs: {
            label: opt.label,
            value: opt.value,
            imageUrl: opt.imageUrl,
            points: opt.points,
            isCorrect: opt.isCorrect,
          },
          content: [{ type: 'text', text: opt.label }],
        })
      );

    // --- 4️⃣ Remove existing options (for fresh insert) ---
    if (!currentNode) {
      setShowModal(false);
      return;
    }

    // compute precise from/to to only replace option nodes (preserve leading label paragraph)
    let cursor = currentPos + 1;
    let from = -1;
    let to = -1;
    currentNode.content.content.forEach((child: any) => {
      const childSize = child.nodeSize;
      if (child.type.name === 'singleChoiceOption') {
        if (from === -1) from = cursor;
        to = cursor + childSize;
      }
      cursor += childSize;
    });

    // if no options existed, set from to end of node (right before closing)
    if (from === -1) {
      from = currentPos + currentNode.nodeSize - 1;
      to = from;
    }

    if (to > from) editor.commands.deleteRange({ from, to });
    editor.commands.insertContentAt(from, optionNodes);

    // --- 5️⃣ Handle "Other" node mirror ---
    const updatedNode = editor.state.doc.nodeAt(currentPos);

    if (!updatedNode) {
      setShowModal(false);
      return;
    }

    const contentNodes = updatedNode?.content?.content || [];
    let otherIndex = -1;

    contentNodes.forEach((c: any, i: number) => {
      if (c.type.name === 'singleChoiceOther') otherIndex = i;
    });

    const hasOther = otherIndex !== -1;

    if (values.allowOther && !hasOther) {
      const otherData = finalOptions.find(
        (o: { value: string }) => o.value === '__other__'
      );
      editor.commands.insertContentAt(currentPos + updatedNode?.nodeSize - 1, {
        type: 'singleChoiceOther',
        attrs: {
          label: otherData?.label,
          value: '__other__',
          imageUrl: otherData?.imageUrl || null,
          points: otherData?.points || 0,
          isCorrect: otherData?.isCorrect || false,
        },
        content: [{ type: 'text', text: otherData?.label }],
      });
    }

    if (!values.allowOther && hasOther) {
      let from = currentPos + 1;
      for (let i = 0; i < otherIndex; i++) {
        from += contentNodes[i].nodeSize;
      }
      const to = from + contentNodes[otherIndex].nodeSize;
      editor.commands.deleteRange({ from, to });
    }

    setShowModal(false);
  };

  const renderOtherInput = () => {
    const content = node.content?.content;
    const otherNode = Array.isArray(content)
      ? content.find((child: any) => child?.type?.name === 'singleChoiceOther')
      : undefined;
    if (!otherNode) return null;

    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos == null) {
      // If we don't have a position (e.g. rendering context), show a read-only input to avoid runtime errors
      return (
        <Input
          style={{ marginTop: 8, maxWidth: 200 }}
          placeholder={otherPlaceholder}
          value={otherValue}
          readOnly={mode !== 'submit'}
        />
      );
    }

    let otherPos = pos + 1;
    // const content = node.content?.content;
    if (Array.isArray(content)) {
      content.forEach((child: any) => {
        if (child?.type?.name === 'singleChoiceOther') {
          return;
        }
        otherPos += child?.nodeSize || 0;
      });
    }

    return (
      <Input
        style={{ marginTop: 8, maxWidth: 200 }}
        placeholder={otherPlaceholder}
        value={otherValue}
        onChange={(e) => {
          const newValue = e.target.value;
          const contentFrom = otherPos + 1;
          const contentTo = otherPos + otherNode.nodeSize - 1;
          editor
            .chain()
            .deleteRange({ from: contentFrom, to: contentTo })
            .insertContentAt(contentFrom, newValue)
            .run();
        }}
        readOnly={mode !== 'submit'}
      />
    );
  };

  // Don't render if not visible (except in edit mode)
  if (!isVisible && !isEditMode) {
    return null;
  }

  return (
    <NodeViewWrapper
      {...(isEditMode ? { 'data-drag-handle': true } : {})}
      style={{ margin: '8px 0', display: isVisible || isEditMode ? 'block' : 'none' }}
      data-node-type="singleChoice"
      data-node-name={String((node.attrs as any)?.name || '')}
    >
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
              nodeGroups: (nodeGroups as any[]) || [],
            }}
            onChange={(value) => {
              updateAttributes({
                enableGrouping: value.enableGrouping,
                nodeGroups: value.nodeGroups,
              });
            }}
            // Use subjects & global groups from editor storage
            subjectsOptions={
              (editor.storage as any)?.formBuilder?.subjects || []
            }
            globalGroups={
              (editor.storage as any)?.formBuilder?.globalGroups || []
            }
            fieldLabel={extractNodeLabel(node)}
          />
        </Modal>
      )}
      <SingleChoiceEditModal
        open={showModal}
        onClose={() => setShowModal(false)}
        nodeAttrs={node.attrs}
        options={
          variant === 'yesno'
            ? []
            : node.content.content
                .filter(
                  (child: any) => child.type.name === 'singleChoiceOption'
                )
                .map((child: any) => {
                  const optValue = child.attrs.value;
                  const optionPointsData = node.attrs.optionPoints?.[optValue];
                  
                  // Convert points to number (handle string "0", "10", etc.)
                  const pointsValue = optionPointsData?.points;
                  const points = pointsValue !== undefined && pointsValue !== null
                    ? (typeof pointsValue === 'number' ? pointsValue : parseFloat(String(pointsValue)) || 0)
                    : 0;
                  
                  // isCorrect: prioritize from child.attrs, fall back to optionPoints
                  // Handle both boolean and string "true"/"false"
                  let isCorrect = false;
                  if (child.attrs.isCorrect !== undefined && child.attrs.isCorrect !== null) {
                    isCorrect = child.attrs.isCorrect === true || child.attrs.isCorrect === 'true';
                  } else if (optionPointsData?.isCorrect !== undefined && optionPointsData.isCorrect !== null) {
                    isCorrect = optionPointsData.isCorrect === true || optionPointsData.isCorrect === 'true';
                  }
                  
                  return {
                    value: optValue,
                    label: child.textContent || optValue,
                    imageUrl: child.attrs.imageUrl || '',
                    points: points,
                    isCorrect: isCorrect,
                  };
                })
        }
        onSave={handleSave}
      />
      <Card
        size="small"
        style={{
          margin: '8px 0',
          borderColor:
            error || requiredError ? token.colorError : token.colorBorder,
          borderRadius: token.borderRadiusLG,
          transition: 'border-color 0.2s ease',
          background: token.colorBgContainer,
        }}
        variant="outlined"
      >
        <Flex justify="space-between" style={{ marginLeft: 8 }}>
          <div style={{ marginBottom: 8, width: '100%' }} contentEditable={isSubmitMode ? false : undefined}>
            {/* Hide option nodes (including "Other") from rendering inside the label container */}
            <style>{`.singlechoice-label [data-type="single-choice-option"], .singlechoice-label [data-type="single-choice-other"]{display:none}`}</style>
            <NodeViewContent className="singlechoice-label" />
            {associatedTags.length > 0 && (
              <div style={{ marginTop: 6, marginBottom: 6, display: 'flex', flexWrap: 'nowrap', gap: 4, alignItems: 'center', overflowX: 'auto' }}>
                <span style={{ fontSize: 11, color: token.colorTextSecondary, marginRight: 4, flexShrink: 0 }}>Tags:</span>
                {associatedTags.map((tag: { _id: string; name: string; }) => (
                  <Tag key={tag._id} color="blue" style={{ fontSize: 11, flexShrink: 0 }}>
                    {tag.name}
                  </Tag>
                ))}
              </div>
            )}
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
        </Flex>
        {isSubmitMode && effectiveApprovalRequired && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <Tag
              color="warning"
              style={{
                marginLeft: 8,
                fontSize: 11,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                paddingInline: 8,
                paddingBlock: 2,
              }}
            >
              <ExclamationCircleOutlined style={{ fontSize: 12 }} />
              <span style={{ marginLeft: 4 }}>Approval required</span>
            </Tag>
            
            {/* Approval Status Badge */}
            {/* Don't show tag when status is "pending" - that means approval hasn't been requested yet */}
            {node.attrs.approvalStatus && node.attrs.approvalStatus !== 'pending' && (
              <Tag
                color={
                  node.attrs.approvalStatus === 'approved' 
                    ? 'success' 
                    : node.attrs.approvalStatus === 'rejected' 
                      ? 'error' 
                      : 'processing'
                }
                style={{
                  fontSize: 11,
                  paddingInline: 8,
                  paddingBlock: 2,
                }}
              >
                {node.attrs.approvalStatus === 'approved' && '✓ Approved'}
                {node.attrs.approvalStatus === 'rejected' && '✗ Rejected'}
                {node.attrs.approvalStatus === 'requested' && '⏱ Pending Approval'}
              </Tag>
            )}
          </div>
        )}
        
        {/* Rejection Message */}
        {isSubmitMode && node.attrs.rejectionMessage && (
          <div
            style={{
              padding: 8,
              background: token.colorErrorBg,
              border: `1px solid ${token.colorErrorBorder}`,
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            <Text type="danger" style={{ fontSize: 12 }}>
              <strong>Rejection Feedback:</strong> {node.attrs.rejectionMessage}
            </Text>
          </div>
        )}
        
        {!isSubmitMode && effectiveApprovalRequired && (
          <Tag
            color="warning"
            style={{
              marginLeft: 8,
              fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              paddingInline: 8,
              paddingBlock: 2,
              marginBottom: 8,
            }}
          >
            <ExclamationCircleOutlined style={{ fontSize: 12 }} />
            <span style={{ marginLeft: 4 }}>Approval required</span>
          </Tag>
        )}
        {renderBadgesRow()}
        {isSubmitMode && shouldShowGrouping && (
          <div style={{ marginBottom: 8, textAlign: 'right' }}>
            <Button
              size="small"
              type="default"
              icon={<SettingOutlined />}
              variant='solid'
              color='blue'
              onClick={() => setShowGroupingModal(true)}
            >
              Subject Group Settings
            </Button>
          </div>
        )}
        <br />
        {/* When grouping is active in submit mode after lock, selection happens per group/subject
            via nodeGroupValues. The single global value UI is used only when grouping is not shown. */}
        {shouldShowGrouping ? (
          <>
            {/* Per-group selections */}
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {groupsToUse.map((group: any) => {
                const entityId = `group-${group.id}`;
                const selected = (nodeGroupValues as any)[entityId] ?? null;
                const groupSubjects = (group.subjectIds || [])
                  .map((id: string) =>
                    subjectsOptionsFromStorage.find((s: any) => s.value === id),
                  )
                  .filter(Boolean)
                  .map((s: any) => s.label)
                  .join(', ');
                
                // Get approval status for this group to disable inputs if approved
                const globalGroups = (editor.storage as any)?.formBuilder?.globalGroups || [];
                const groupApprovalStatus = effectiveApprovalRequired
                  ? getApprovalStatusForSubject(
                      node as unknown as JSONContent,
                      (group.subjectIds || [])[0] || '',
                      globalGroups
                    )
                  : null;
                const isApproved = groupApprovalStatus === 'approved';
                
                return (
                  <Card
                    key={entityId}
                    size="small"
                    style={{ background: token.colorFillAlter }}
                    title={
                      <Space>
                        <Tag color="blue">Group</Tag>
                        <span>{group.name}</span>
                        {groupSubjects && (
                          <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                            ({groupSubjects})
                          </span>
                        )}
                      </Space>
                    }
                  >
                    {variant === 'dropdown' ? (
                      <Select
                        value={selected ?? undefined}
                        onChange={(val) => {
                          const updated = {
                            ...(nodeGroupValues as any),
                            [entityId]: val,
                          };
                          updateAttributes({ nodeGroupValues: updated });
                        }}
                        placeholder="Select..."
                        style={{ minWidth: 200 }}
                        disabled={!isSubmitMode || isApproved}
                      >
                        {availableOptions.map((opt, i) => (
                          <Option key={i} value={opt.value}>
                            <Space>
                              {opt.imageUrl && (
                                <AssetImage
                                  src={opt.imageUrl}
                                  alt=""
                                  style={{ width: 20, height: 20 }}
                                />
                              )}
                              <span>{opt.label}</span>
                            </Space>
                          </Option>
                        ))}
                      </Select>
                    ) : variant === 'buttons' ? (
                      <Space
                        direction={
                          layout === 'vertical' ? 'vertical' : 'horizontal'
                        }
                        wrap
                        size={[8, 8]}
                        style={{ width: '100%' }}
                      >
                        {availableOptions.map((opt, i) => (
                          <Button
                            key={i}
                            type={
                              selected === opt.value ? 'primary' : 'default'
                            }
                            onClick={() => {
                              const next =
                                selected === opt.value ? null : opt.value;
                              updateEntityValue(entityId, next);
                            }}
                            disabled={!isSubmitMode || isApproved}
                            style={{
                              marginBottom:
                                layout === 'vertical' ? 8 : 0,
                            }}
                          >
                            <Space size={4} wrap>
                              {opt.imageUrl && (
                                <AssetImage
                                  src={opt.imageUrl}
                                  alt=""
                                  style={{
                                    width: 20,
                                    height: 20,
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              <span style={{ whiteSpace: 'nowrap' }}>
                                {opt.label}
                              </span>
                              {renderMeta(opt.value)}
                            </Space>
                          </Button>
                        ))}
                      </Space>
                    ) : (
                      <Radio.Group
                        value={selected ?? undefined}
                        onChange={(e) => {
                          updateEntityValue(entityId, e.target.value);
                        }}
                        disabled={!isSubmitMode || isApproved}
                      >
                        <Space
                          direction={
                            layout === 'vertical' ? 'vertical' : 'horizontal'
                          }
                          wrap
                          size={[12, 8]}
                          style={{ width: '100%' }}
                        >
                          {availableOptions.map((opt, i) => (
                            <Radio
                              key={i}
                              value={opt.value}
                              style={{ marginRight: 0 }}
                            >
                              <Space size={4} wrap>
                                {opt.imageUrl && (
                                  <AssetImage
                                    src={opt.imageUrl}
                                    alt=""
                                    style={{
                                      width: 20,
                                      height: 20,
                                      flexShrink: 0,
                                    }}
                                  />
                                )}
                                <span style={{ whiteSpace: 'nowrap' }}>
                                  {opt.label}
                                </span>
                              </Space>
                            </Radio>
                          ))}
                        </Space>
                      </Radio.Group>
                    )}
                    
                    {/* Approval Status and Request Button for Group */}
                    {effectiveApprovalRequired && (() => {
                      // Get global groups from editor storage
                      const globalGroups = (editor.storage as any)?.formBuilder?.globalGroups || [];
                      
                      // Get approval status for this specific group
                      const groupApprovalStatus = getApprovalStatusForSubject(
                        node as unknown as JSONContent,
                        (group.subjectIds || [])[0] || '', // Use first subject ID to get group status
                        globalGroups
                      );
                      // Enable View/Request Approval when answer is filled (selection made; if Other, text filled)
                      const hasAnswer = selected != null && selected !== '' && (selected !== '__other__' || (otherValue || '').trim().length > 0);
                      
                      // Show approval status badge
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
                            {(!isReadonlyMode || canOpenApprovalDrawer) && (
                              <Tooltip 
                                title={
                                  !canOpenApprovalDrawer && !hasAnswer 
                                    ? 'Please fill this field before requesting approval' 
                                    : groupApprovalStatus === 'approved' || canOpenApprovalDrawer
                                    ? 'Open approval discussion'
                                    : ''
                                }
                              >
                                <Button
                                  size="small"
                                  type={groupApprovalStatus === 'rejected' && !canOpenApprovalDrawer ? 'primary' : 'default'}
                                  danger={groupApprovalStatus === 'rejected' && !canOpenApprovalDrawer}
                                  onClick={() => {
                                    const openDrawer = (editor.storage as any)?.formBuilder?.openQuestionApprovalDrawer;
                                    if (openDrawer) {
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
                                  disabled={!canOpenApprovalDrawer && !hasAnswer}
                                  style={{
                                    fontSize: 11,
                                    opacity: groupApprovalStatus === 'approved' ? 0.6 : 1,
                                  }}
                                >
                                  {canOpenApprovalDrawer
                                    ? 'View Approval'
                                    : groupApprovalStatus === 'rejected' 
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

              {/* Per-ungrouped-subject selections */}
              {availableSubjects.length > 0 && (
                <Card
                  size="small"
                  style={{ background: token.colorFillAlter }}
                  title={
                    <Space>
                      <Tag>Ungrouped Subjects</Tag>
                    </Space>
                  }
                >
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    {availableSubjects.map((subject: any) => {
                      const entityId = `ungrouped-${subject.value}`;
                      const selected =
                        (nodeGroupValues as any)[entityId] ?? null;
                      
                      // Get approval status for this subject to disable inputs if approved
                      const globalGroups = (editor.storage as any)?.formBuilder?.globalGroups || [];
                      const subjectApprovalStatus = effectiveApprovalRequired
                        ? getApprovalStatusForSubject(
                            node as unknown as JSONContent,
                            subject.value,
                            globalGroups
                          )
                        : null;
                      const isApproved = subjectApprovalStatus === 'approved';
                      
                      return (
                        <div key={entityId}>
                          <div style={{ marginBottom: 4 }}>
                            <Tag>{subject.label}</Tag>
                          </div>
                          {variant === 'dropdown' ? (
                            <Select
                              value={selected ?? undefined}
                              onChange={(val) => {
                                const updated = {
                                  ...(nodeGroupValues as any),
                                  [entityId]: val,
                                };
                                updateAttributes({ nodeGroupValues: updated });
                              }}
                              placeholder="Select..."
                              style={{ minWidth: 200 }}
                              disabled={!isSubmitMode || isApproved}
                            >
                              {availableOptions.map((opt, i) => (
                                <Option key={i} value={opt.value}>
                                  <Space>
                                    {opt.imageUrl && (
                                      <AssetImage
                                        src={opt.imageUrl}
                                        alt=""
                                        style={{ width: 20, height: 20 }}
                                      />
                                    )}
                                    <span>{opt.label}</span>
                                  </Space>
                                </Option>
                              ))}
                            </Select>
                          ) : variant === 'buttons' ? (
                            <Space
                              direction={
                                layout === 'vertical'
                                  ? 'vertical'
                                  : 'horizontal'
                              }
                              wrap
                              size={[8, 8]}
                              style={{ width: '100%' }}
                            >
                              {availableOptions.map((opt, i) => (
                                <Button
                                  key={i}
                                  type={
                                    selected === opt.value
                                      ? 'primary'
                                      : 'default'
                                  }
                                  onClick={() => {
                                    const next =
                                      selected === opt.value ? null : opt.value;
                                    const updated = {
                                      ...(nodeGroupValues as any),
                                      [entityId]: next,
                                    };
                                    updateAttributes({
                                      nodeGroupValues: updated,
                                    });
                                  }}
                                  disabled={!isSubmitMode || isApproved}
                                  style={{
                                    marginBottom:
                                      layout === 'vertical' ? 8 : 0,
                                  }}
                                >
                                  <Space size={4} wrap>
                                    {opt.imageUrl && (
                                      <AssetImage
                                        src={opt.imageUrl}
                                        alt=""
                                        style={{
                                          width: 20,
                                          height: 20,
                                          flexShrink: 0,
                                        }}
                                      />
                                    )}
                                    <span style={{ whiteSpace: 'nowrap' }}>
                                      {opt.label}
                                    </span>
                                    {renderMeta(opt.value)}
                                  </Space>
                                </Button>
                              ))}
                            </Space>
                          ) : (
                            <Radio.Group
                              value={selected ?? undefined}
                              onChange={(e) => {
                                const updated = {
                                  ...(nodeGroupValues as any),
                                  [entityId]: e.target.value,
                                };
                                updateAttributes({
                                  nodeGroupValues: updated,
                                });
                              }}
                              disabled={!isSubmitMode || isApproved}
                            >
                              <Space
                                direction={
                                  layout === 'vertical'
                                    ? 'vertical'
                                    : 'horizontal'
                                }
                                wrap
                                size={[12, 8]}
                                style={{ width: '100%' }}
                              >
                                {availableOptions.map((opt, i) => (
                                  <Radio
                                    key={i}
                                    value={opt.value}
                                    style={{ marginRight: 0 }}
                                  >
                                    <Space size={4} wrap>
                                      {opt.imageUrl && (
                                        <AssetImage
                                          src={opt.imageUrl}
                                          alt=""
                                          style={{
                                            width: 20,
                                            height: 20,
                                            flexShrink: 0,
                                          }}
                                        />
                                      )}
                                      <span style={{ whiteSpace: 'nowrap' }}>
                                        {opt.label}
                                      </span>
                                    </Space>
                                  </Radio>
                                ))}
                              </Space>
                            </Radio.Group>
                          )}
                          
                          {/* Approval Status and Request Button for Ungrouped Subject */}
                          {effectiveApprovalRequired && (() => {
                            // Get global groups from editor storage
                            const globalGroups = (editor.storage as any)?.formBuilder?.globalGroups || [];
                            
                            // Get approval status for this specific subject
                            const subjectApprovalStatus = getApprovalStatusForSubject(
                              node as unknown as JSONContent,
                              subject.value,
                              globalGroups
                            );
                            // Enable View/Request Approval when answer is filled (selection made; if Other, text filled)
                            const selectedUngrouped = (nodeGroupValues as any)[entityId] ?? null;
                            const hasAnswer = selectedUngrouped != null && selectedUngrouped !== '' && (selectedUngrouped !== '__other__' || (otherValue || '').trim().length > 0);
                            
                            // Show approval status badge
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
                                  {(!isReadonlyMode || canOpenApprovalDrawer) && (
                                    <Tooltip 
                                      title={
                                        !canOpenApprovalDrawer && !hasAnswer 
                                          ? 'Please fill this field before requesting approval' 
                                          : subjectApprovalStatus === 'approved' || canOpenApprovalDrawer
                                          ? 'Open approval discussion'
                                          : ''
                                      }
                                    >
                                      <Button
                                        size="small"
                                        type={subjectApprovalStatus === 'rejected' && !canOpenApprovalDrawer ? 'primary' : 'default'}
                                        danger={subjectApprovalStatus === 'rejected' && !canOpenApprovalDrawer}
                                        onClick={() => {
                                          const openDrawer = (editor.storage as any)?.formBuilder?.openQuestionApprovalDrawer;
                                          if (openDrawer) {
                                            const subjectContext = {
                                              type: 'ungrouped' as const,
                                              subjectId: subject.value,
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
                                        disabled={!canOpenApprovalDrawer && !hasAnswer}
                                        style={{ 
                                          fontSize: 11,
                                          opacity: subjectApprovalStatus === 'approved' ? 0.6 : 1,
                                        }}
                                      >
                                        {canOpenApprovalDrawer
                                          ? 'View Approval'
                                          : subjectApprovalStatus === 'rejected' 
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
                        </div>
                      );
                    })}
                  </Space>
                </Card>
              )}
            </Space>
          </>
        ) : !shouldShowGrouping && variant === 'dropdown' ? (
          <>
            <Select
              value={value ?? undefined}
              onChange={onChange}
              placeholder="Select..."
              style={{ minWidth: 200 }}
              disabled={mode !== 'submit' || (effectiveApprovalRequired && node.attrs.approvalStatus === 'approved')}
            >
              {availableOptions.map((opt, i) => (
                <Option key={i} value={opt.value}>
                  <Space>
                    {opt.imageUrl && (
                      <AssetImage
                        src={opt.imageUrl}
                        alt=""
                        style={{ width: 20, height: 20 }}
                      />
                    )}
                    <span>{opt.label}</span>
                    {renderMeta(opt.value)}
                  </Space>
                </Option>
              ))}
              {allowOther && (
                <Option key="__other__" value="__other__">
                  <Space>
                    <span>{otherPlaceholder}</span>
                    {renderMeta('__other__')}
                  </Space>
                </Option>
              )}
            </Select>
            {allowOther && value === '__other__' && renderOtherInput()}
            {requiredError && (
              <div
                style={{ color: token.colorError, marginTop: 6, fontSize: 12 }}
              >
                This field is required
              </div>
            )}
          </>
        ) : !shouldShowGrouping && variant === 'buttons' ? (
          <>
            <Space
              direction={layout === 'vertical' ? 'vertical' : 'horizontal'}
              wrap
              size={[8, 8]}
              style={{ width: '100%' }}
            >
              {availableOptions.map((opt, i) => (
                <Button
                  key={i}
                  type={value === opt.value ? 'primary' : 'default'}
                  onClick={() => onChange(opt.value)}
                  disabled={mode !== 'submit' || (effectiveApprovalRequired && node.attrs.approvalStatus === 'approved')}
                  style={{ marginBottom: layout === 'vertical' ? 8 : 0 }}
                >
                  <Space size={4} wrap>
                    {opt.imageUrl && (
                      <AssetImage
                        src={opt.imageUrl}
                        alt=""
                        style={{ width: 20, height: 20, flexShrink: 0 }}
                      />
                    )}
                    <span style={{ whiteSpace: 'nowrap' }}>{opt.label}</span>
                    {renderMeta(opt.value)}
                  </Space>
                </Button>
              ))}
              {allowOther && (
                <Button
                  type={value === '__other__' ? 'primary' : 'default'}
                  onClick={() => onChange('__other__')}
                  disabled={mode !== 'submit' || (effectiveApprovalRequired && node.attrs.approvalStatus === 'approved')}
                  style={{ marginBottom: layout === 'vertical' ? 8 : 0 }}
                >
                  <Space size={4} wrap>
                    <span style={{ whiteSpace: 'nowrap' }}>{otherPlaceholder}</span>
                    {renderMeta('__other__')}
                  </Space>
                </Button>
              )}
            </Space>
            {allowOther && value === '__other__' && renderOtherInput()}
            {requiredError && (
              <div
                style={{ color: token.colorError, marginTop: 6, fontSize: 12 }}
              >
                This field is required
              </div>
            )}
          </>
        ) : !shouldShowGrouping ? (
          <>
            <Radio.Group
              value={value ?? undefined}
              onChange={(e) => onChange(e.target.value)}
              disabled={mode !== 'submit'}
            >
              <Space
                direction={layout === 'vertical' ? 'vertical' : 'horizontal'}
                wrap
                size={[12, 8]}
                style={{ width: '100%' }}
              >
                {availableOptions.map((opt, i) => (
                  <Radio key={i} value={opt.value} style={{ marginRight: 0 }}>
                    <Space size={4} wrap>
                      {opt.imageUrl && (
                        <AssetImage
                          src={opt.imageUrl}
                          alt=""
                          style={{ width: 20, height: 20, flexShrink: 0 }}
                        />
                      )}
                      <span style={{ whiteSpace: 'nowrap' }}>{opt.label}</span>
                      {renderMeta(opt.value)}
                    </Space>
                  </Radio>
                ))}
                {allowOther && (
                  <Radio value="__other__" style={{ marginRight: 0 }}>
                    <Space size={4} wrap>
                      <span style={{ whiteSpace: 'nowrap' }}>{otherPlaceholder}</span>
                      {renderMeta('__other__')}
                    </Space>
                  </Radio>
                )}
              </Space>
            </Radio.Group>
            {allowOther && value === '__other__' && renderOtherInput()}
            {requiredError && (
              <div
                style={{ color: token.colorError, marginTop: 6, fontSize: 12 }}
              >
                This field is required
              </div>
            )}
          </>
        ) : null}
        {/* Single-user / course case: show approval status and Request Approval button when no grouping (one enrollee) */}
        {!shouldShowGrouping && effectiveApprovalRequired && (isSubmitMode || canOpenApprovalDrawer) && (() => {
          const singleApprovalStatus = node.attrs.approvalStatus;
          const openDrawer = (editor.storage as any)?.formBuilder?.openQuestionApprovalDrawer;
          const hasAnswer = value != null && value !== '' && (value !== '__other__' || (otherValue || '').trim().length > 0);
          const getStatusBadge = () => {
            if (singleApprovalStatus === 'approved') {
              return (
                <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 11 }}>
                  Approved
                </Tag>
              );
            }
            if (singleApprovalStatus === 'rejected') {
              return (
                <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 11 }}>
                  Rejected
                </Tag>
              );
            }
            if (singleApprovalStatus === 'requested') {
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
                {(!isReadonlyMode || canOpenApprovalDrawer) && (
                  <Tooltip
                    title={
                      !canOpenApprovalDrawer && !hasAnswer
                        ? 'Please fill this field before requesting approval'
                        : singleApprovalStatus === 'approved' || canOpenApprovalDrawer
                        ? 'Open approval discussion'
                        : ''
                    }
                  >
                    <Button
                      size="small"
                      type={singleApprovalStatus === 'rejected' && !canOpenApprovalDrawer ? 'primary' : 'default'}
                      danger={singleApprovalStatus === 'rejected' && !canOpenApprovalDrawer}
                      onClick={() => {
                        if (openDrawer) {
                          openDrawer(
                            { type: node.type.name, attrs: node.attrs, content: node.content },
                            { type: 'ungrouped', subjectId: ['current'], subjectName: 'Current user', subjects: [] }
                          );
                        }
                      }}
                      disabled={!canOpenApprovalDrawer && !hasAnswer}
                      style={{
                        fontSize: 11,
                        opacity: singleApprovalStatus === 'approved' ? 0.6 : 1,
                      }}
                    >
                      {canOpenApprovalDrawer
                        ? 'View Approval'
                        : singleApprovalStatus === 'rejected'
                        ? 'Re-request Approval'
                        : singleApprovalStatus === 'approved'
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
    </NodeViewWrapper>
  );
};

export default SingleChoiceComponent;
