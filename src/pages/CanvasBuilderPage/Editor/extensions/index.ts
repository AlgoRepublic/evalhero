import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TableKit } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';
import UniqueID from '@tiptap/extension-unique-id';
import { v4 as uuidv4 } from 'uuid';
// import { TrailingNode, Placeholder } from '@tiptap/extensions';
import { FormNodes } from './FormNodes';
import 'prosemirror-view/style/prosemirror.css';
// import './tittap.css';

export const extensions = [
  StarterKit,
  TextStyleKit,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Highlight.configure({ multicolor: true }),
  TableKit.configure({ table: { resizable: true } }),
  UniqueID.configure({
    // Use 'id' as attribute name - TipTap will render it as data-id in HTML (hidden)
    // The ID is stored in node.attrs.id and persists in JSON, but rendered as data-id attribute
    attributeName: 'id',
    types: [
      'paragraph',
      'heading',
      'bulletList',
      'orderedList',
      'listItem',
      'table',
      'tableRow',
      'tableCell',
      'blockquote',
      'codeBlock',
      
      // Custom Nodes
      'slashCommand',
      'addressField',
      'longText',
      'sliderField',
      'multipleChoiceOption',
      'multipleChoice',
      'multipleChoiceOther',
      'numberField',
      'matrixField',
      'dateTimeField',
      'computedField',
      'hiddenField',
      'signatureField',
      'richText',
      'lookupField',
      'staticContent',
      'ranking',
      'singleChoice',
      'singleChoiceOption',
      'singleChoiceOther',
      'dateField',
      'fileField',
      'section',
      'ratingField',
      'repeater_item',
      'repeater',
      'inputField',
      'selectField',
      'checkboxField',
      'radioField',
      'textareaField',
      'shortText',
    ],
    // Generate UUID v4 for all nodes
    generateID: ({ node }) => {
      // Check if the node already has an ID
      const existingID = node.attrs?.id;
      
      // Preserve existing IDs if they're valid UUIDs
      if (existingID && typeof existingID === 'string' && existingID.trim()) {
        // Check if it's a valid UUID v4 format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(existingID)) {
          return existingID;
        }
      }
      
      // Generate a new UUID v4
      return uuidv4();
    },
  }),
  // TrailingNode.configure({
  //   node: 'paragraph',
  // }),
  // Placeholder.configure({
  //   placeholder: 'Type / to insert a field...',
  //   emptyEditorClass: 'is-editor-empty',
  // }),
  ...FormNodes,
];
