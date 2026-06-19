import React from 'react';
import { NodeViewProps } from '@tiptap/react';

/** Rich Text Input (nested Tiptap editor inside form field) */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ShortTextNode } from './ShortTextField';
import { createFormNode } from '../utils';
import { InputComponent } from './InputComponent';
import { SelectComponent } from './SelectComponent';
import { DateNode } from './DateField';
import { CheckboxComponent } from './Checkbox';
import { RadioComponent } from './Radio';
import { TextareaComponent } from './Textarea';
import { LongTextNode } from './LongTextField';
import { SingleChoiceNode } from './SingleChoiceField';
import { MultipleChoiceNode } from './MultipleChoiceField';
import { RankingNode } from './RankingField';
import { RichTextNode } from './RichTextField';
import { NumberNode } from './NumberField';
import { SliderNode } from './SliderRangeField';
import { RatingNode } from './RatingField';
import { DateTimeNode } from './DateTimeField';
import { MatrixNode } from './matrix';
import { FileNode } from './FileField';
import { SignatureNode } from './SignatureField';
import { ComputedFieldNode } from './ComputedField';
import { HiddenFieldNode } from './HiddenFieldNode';
import { AddressNode } from './AddressNode';
import { LookupNode } from './LookupField';
import { RepeaterItemNode, RepeaterNode } from './RepeaterNode';
import { SectionNode } from './SectionNode';
import { StaticContentNode } from './StaticContentNode';
import { SingleChoiceOptionNode } from './SingleChoiceField/singleChoiceOption';
import { SingleChoiceOtherNode } from './SingleChoiceField/SingleChoiceOtherNode';
import { MultipleChoiceOtherNode } from './MultipleChoiceField/multipleChoiceOtherNode';
import { MultipleChoiceOptionNode } from './MultipleChoiceField/multipleChoiceOptionNode';
import { SlashCommandExtension } from './SlashCommand';
// import { MatrixNode } from './MatrixNode';
// import { RankingNode } from './RankingNode';

export const RichTextInput: React.FC<NodeViewProps> = ({ node }) => {
  const { label } = node.attrs;
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Start writing...</p>',
  });

  return (
    <div style={{ margin: '8px 0' }}>
      <label>{label}</label>
      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: 4,
          padding: 8,
          width: 500,
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export const InputNode = createFormNode({
  name: 'inputField',
  defaultAttrs: { label: 'Label', placeholder: 'Enter text...' },
  Component: InputComponent,
  commandName: 'insertInput',
});

export const SelectNode = createFormNode({
  name: 'selectField',
  defaultAttrs: { label: 'Label', options: ['Option 1', 'Option 2'] },
  Component: SelectComponent,
  commandName: 'insertSelect',
});

// export const DatePickerNode = createFormNode({
//   name: 'datePickerField',
//   defaultAttrs: { label: 'Label', placeholder: 'Select date...' },
//   Component: DatePickerComponent,
//   commandName: 'insertDatePicker',
// });

export const CheckboxNode = createFormNode({
  name: 'checkboxField',
  defaultAttrs: { label: 'Label', checked: false },
  Component: CheckboxComponent,
  commandName: 'insertCheckbox',
});

export const RadioNode = createFormNode({
  name: 'radioField',
  defaultAttrs: { label: 'Label', options: ['Option A', 'Option B'] },
  Component: RadioComponent,
  commandName: 'insertRadio',
});

export const TextareaNode = createFormNode({
  name: 'textareaField',
  defaultAttrs: { label: 'Label', placeholder: 'Enter text...' },
  Component: TextareaComponent,
  commandName: 'insertTextarea',
});

export const FormNodes = [
  InputNode,
  SelectNode,
  CheckboxNode,
  RadioNode,
  TextareaNode,
  ShortTextNode,
  LongTextNode,
  RichTextNode,
  SingleChoiceNode,
  SingleChoiceOptionNode,
  SingleChoiceOtherNode,
  MultipleChoiceNode,
  MultipleChoiceOtherNode,
  MultipleChoiceOptionNode,
  RankingNode,
  NumberNode,
  SliderNode,
  RatingNode,
  DateNode,
  DateTimeNode,
  MatrixNode,
  FileNode,
  SignatureNode,
  ComputedFieldNode,
  HiddenFieldNode,
  AddressNode,
  LookupNode,
  RepeaterNode,
  SectionNode,
  StaticContentNode,
  RepeaterItemNode,
  SlashCommandExtension,
];
