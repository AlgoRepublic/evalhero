import { Node, mergeAttributes } from '@tiptap/core';

export const MultipleChoiceOtherNode = Node.create({
  name: 'multipleChoiceOther',
  group: 'block',
  content: 'text*',
  atom: false,
  selectable: false,

  addAttributes() {
    return {
      id: { default: null }, // Unique ID managed by UniqueID extension
      value: { default: '__other__' },
      points: {
        default: 0,
        parseHTML: element => {
          const data = element.getAttribute('data-points');
          if (!data) return 0;
          const parsed = parseFloat(data);
          return isNaN(parsed) ? 0 : parsed;
        },
        renderHTML: attributes => {
          if (attributes.points === undefined || attributes.points === null || attributes.points === 0) {
            return {};
          }
          return { 'data-points': String(attributes.points) };
        },
      },
      isCorrect: {
        default: false,
        parseHTML: (element) =>
          element.getAttribute('data-is-correct') === 'true',
        renderHTML: (attributes) => {
          if (!attributes.isCorrect) {
            return {};
          }
          return { 'data-is-correct': 'true' };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="multiple-choice-other"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-type': 'multiple-choice-other' }),
      0, // placeholder for text content
    ];
  },
});
