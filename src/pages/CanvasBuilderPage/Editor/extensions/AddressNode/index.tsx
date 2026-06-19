import { Attributes, CommandProps, Node, RawCommands, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import AddressComponent from './view';
import { genId } from '../../utils';

export const AddressNode = Node.create({
  name: 'addressField',
  group: 'block',
  atom: false,
  draggable: true,
  content: '(paragraph | heading)+',

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      label: { default: 'Address' },
      name: { default: null },
      street: { default: '' },
      apartment: { default: '' },
      city: { default: '' },
      state: { default: '' },
      postalCode: { default: '' },
      country: { default: '' },
      formatted: { default: '' },
      lat: { default: null },
      lng: { default: null },
      mapEnabled: { default: false },
      streetEnabled: { default: true },
      apartmentEnabled: { default: true },
      cityEnabled: { default: true },
      stateEnabled: { default: true },
      postalCodeEnabled: { default: true },
      countryEnabled: { default: true },
      queryParam: { default: null }, // Query parameter key for pre-population
      required: { default: false },
      approvalRequired: { default: false },
      // Node-based grouping (per-field) - used in submit mode for subject groups
      enableGrouping: { default: false },
      nodeGroups: {
        default: [] as Array<{ id: string; name: string; subjectIds: string[] }>,
        parseHTML: (element) => {
          const data = element.getAttribute('data-node-groups');
          if (!data) return [];
          try {
            return JSON.parse(data);
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.nodeGroups || attributes.nodeGroups.length === 0) {
            return {};
          }
          return { 'data-node-groups': JSON.stringify(attributes.nodeGroups) };
        },
      },
      nodeGroupValues: {
        default: {} as Record<string, string>,
        parseHTML: (element) => {
          const data = element.getAttribute('data-node-group-values');
          if (!data) return {};
          try {
            return JSON.parse(data);
          } catch {
            return {};
          }
        },
        renderHTML: (attributes) => {
          if (
            !attributes?.nodeGroupValues ||
            Object.keys(attributes.nodeGroupValues).length === 0
          ) {
            return {};
          }
          return {
            'data-node-group-values': JSON.stringify(attributes.nodeGroupValues),
          };
        },
      },
      // Approval status per subject/group (similar to nodeGroupValues)
      nodeGroupApprovalStatus: {
        default: {} as Record<string, 'pending' | 'approved' | 'rejected'>, // groupId/subjectId -> approvalStatus
        parseHTML: (element) => {
          const data = element.getAttribute('data-node-group-approval-status');
          if (!data) return {};
          try {
            return JSON.parse(data);
          } catch {
            return {};
          }
        },
        renderHTML: (attributes) => {
          if (
            !attributes?.nodeGroupApprovalStatus ||
            Object.keys(attributes.nodeGroupApprovalStatus).length === 0
          ) {
            return {};
          }
          return {
            'data-node-group-approval-status': JSON.stringify(attributes.nodeGroupApprovalStatus),
          };
        },
      },
      visibility: {
        default: { match: 'all', rules: [] },
        parseHTML: (element) => {
          const data = element.getAttribute('data-visibility');
          if (!data) return { match: 'all', rules: [] };
          try {
            return JSON.parse(data);
          } catch {
            return { match: 'all', rules: [] };
          }
        },
        renderHTML: (attributes) => {
          if (
            !attributes?.visibility ||
            attributes?.visibility?.rules?.length === 0
          ) {
            return {};
          }
          return { 'data-visibility': JSON.stringify(attributes.visibility) };
        },
      },
      // Tags association
      tags: {
        default: [] as string[],
        parseHTML: (element) => {
          const data = element.getAttribute('data-tags');
          if (!data) return [];
          try {
            return JSON.parse(data);
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => {
          if (!attributes?.tags || attributes.tags.length === 0) {
            return {};
          }
          return { 'data-tags': JSON.stringify(attributes.tags) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="address-field"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'address-field' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AddressComponent);
  },

  addCommands() {
    return {
      insertAddress:
        (attrs?: Record<string, unknown>) =>
        ({ commands }: { commands: CommandProps['commands'] }) => {
          const label = (attrs as Attributes)?.label ?? 'Address';
          return commands.insertContent({
            type: this.name,
            attrs: {
              label: 'Address',
              name: attrs?.name || genId(),
              street: attrs?.street || '',
              apartment: attrs?.apartment || '',
              city: attrs?.city || '',
              state: attrs?.state || '',
              postalCode: attrs?.postalCode || '',
              country: attrs?.country || '',
              formatted: attrs?.formatted || '',
              lat: attrs?.lat !== undefined ? (typeof attrs.lat === 'number' ? attrs.lat : Number(attrs.lat)) : null,
              lng: attrs?.lng !== undefined ? (typeof attrs.lng === 'number' ? attrs.lng : Number(attrs.lng)) : null,
              mapEnabled: attrs?.mapEnabled === true,
              streetEnabled: attrs?.streetEnabled !== undefined ? !!attrs.streetEnabled : true,
              apartmentEnabled: attrs?.apartmentEnabled !== undefined ? !!attrs.apartmentEnabled : true,
              cityEnabled: attrs?.cityEnabled !== undefined ? !!attrs.cityEnabled : true,
              stateEnabled: attrs?.stateEnabled !== undefined ? !!attrs.stateEnabled : true,
              postalCodeEnabled: attrs?.postalCodeEnabled !== undefined ? !!attrs.postalCodeEnabled : true,
              countryEnabled: attrs?.countryEnabled !== undefined ? !!attrs.countryEnabled : true,
              ...attrs,
            },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: String(label) }],
              },
            ],
          });
        },
    } as Partial<RawCommands>;
  },
});
