// src/lib/tiptap/extensions/SlashCommandExtension.ts
import React from 'react';
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { ReactRenderer } from '@tiptap/react';
import { CommandList, CommandListRef } from './CommandList';
import type { Editor } from '@tiptap/react';
import { isInsideCustomNode } from '../../utils';
import {
  FontSizeOutlined,
  FileTextOutlined,
  UnorderedListOutlined,
  RadiusSettingOutlined,
  CheckSquareOutlined,
  MinusOutlined,
  OrderedListOutlined,
  BlockOutlined,
  CodepenCircleOutlined,
  FieldNumberOutlined,
  SlidersOutlined,
  StarOutlined,
  CalendarOutlined,
  FieldTimeOutlined,
  EnvironmentOutlined,
  TrophyOutlined,
  TableOutlined,
  FormOutlined,
  UploadOutlined,
} from '@ant-design/icons';

export interface CommandItem {
  title: string;
  icon: React.ReactNode;
  category: 'text' | 'choice' | 'input' | 'numeric' | 'date' | 'file' | 'layout' | 'advanced';
  /** Auto-generated shortcuts: e.g. "h1", "p", "bl" */
  shortcuts?: string[];
  command: (args: { editor: Editor; range: { from: number; to: number } }) => void;
}

// Helper: generate shortcuts from title
const generateShortcuts = (title: string): string[] => {
  const map: Record<string, string> = {
    'Heading 1': 'h1',
    'Heading 2': 'h2',
    'Heading 3': 'h3',
    'Heading 4': 'h4',
    'Heading 5': 'h5',
    'Paragraph': 'p',
    'Bullet List': 'bl',
    'Ordered List': 'ol',
    'Blockquote': 'bq',
    'Code Block': 'cb',
    'Short Text': 'st',
    'Long Text': 'lt',
    'Rich Text': 'rt',
    'Single Choice': 'sc',
    'Multiple Choice': 'mc',
    'Number': 'num',
    'Date': 'date',
    'Date & Time': 'dt',
    'Rating': 'rate',
    'Slider': 'slider',
    'Address': 'addr',
    'Ranking': 'rank',
    'Divider': 'div',
    'Matrix': 'mx',
    'Signature': 'sig',
    'File Upload': 'file',
  };
  const shortcut = map[title];
  if (shortcut) return [shortcut];

  // Fallback: first letters
  return [title.toLowerCase().replace(/[^a-z]/g, '').slice(0, 3)];
};


export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        allow: ({ editor }) => {
          // Don't allow slash command inside custom nodes
          return !isInsideCustomNode(editor);
        },
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },

        items: ({ query, editor }: { query: string; editor: Editor }): CommandItem[] => {
          console.log('query', query)
          const insideCustom = isInsideCustomNode(editor);
          const all: CommandItem[] = [
            // ── TEXT ─────────────────────────────────────
            {
              title: 'Heading 1',
              icon: React.createElement(FontSizeOutlined, { style: { fontSize: `${18.5}px` } }),
              category: 'text',
              command: ({ editor, range }) => {
                const isInsideCustom = isInsideCustomNode(editor);
                if (isInsideCustom) {
                  // Inside custom node: convert paragraph to heading
                  editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
                } else {
                  // Outside custom node: replace node
                  editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
                }
              },
            },
            {
              title: 'Heading 2',
              icon: React.createElement(FontSizeOutlined, { style: { fontSize: `${17}px` } }),
              category: 'text',
              command: ({ editor, range }) => {
                const isInsideCustom = isInsideCustomNode(editor);
                if (isInsideCustom) {
                  editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
                } else {
                  editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
                }
              },
            },
            {
              title: 'Heading 3',
              icon: React.createElement(FontSizeOutlined, { style: { fontSize: `${15.5}px` } }),
              category: 'text',
              command: ({ editor, range }) => {
                const isInsideCustom = isInsideCustomNode(editor);
                if (isInsideCustom) {
                  editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
                } else {
                  editor.chain().focus().deleteRange(range).setNode('heading', { level: 3}).run();
                }
              },
            },
            {
              title: 'Heading 4',
              icon: React.createElement(FontSizeOutlined, { style: { fontSize: `${14}px` } }),
              category: 'text',
              command: ({ editor, range }) => {
                const isInsideCustom = isInsideCustomNode(editor);
                if (isInsideCustom) {
                  editor.chain().focus().deleteRange(range).toggleHeading({ level: 4 }).run();
                } else {
                  editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run();
                }
              },
            },
            {
              title: 'Heading 5',
              icon: React.createElement(FontSizeOutlined, { style: { fontSize: `${12.5}px` } }),
              category: 'text',
              command: ({ editor, range }) => {
                const isInsideCustom = isInsideCustomNode(editor);
                if (isInsideCustom) {
                  editor.chain().focus().deleteRange(range).toggleHeading({ level: 5 }).run();
                } else {
                  editor.chain().focus().deleteRange(range).setNode('heading', { level: 5 }).run();
                }
              },
            },
            {
              title: 'Paragraph',
              icon: React.createElement(FileTextOutlined),
              category: 'text',
              command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setParagraph().run();
              },
            },
            // Only show these when NOT inside custom node
            ...(insideCustom ? [] : [
              {
                title: 'Bullet List',
                icon: React.createElement(UnorderedListOutlined),
                category: 'text' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).toggleBulletList().run();
                },
              },
              {
                title: 'Ordered List',
                icon: React.createElement(OrderedListOutlined),
                category: 'text' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).toggleOrderedList().run();
                },
              },
              {
                title: 'Blockquote',
                icon: React.createElement(BlockOutlined),
                category: 'text' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).toggleBlockquote().run();
                },
              },
              {
                title: 'Code Block',
                icon: React.createElement(CodepenCircleOutlined),
                category: 'text' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
                },
              },
              {
                title: 'Short Text',
                icon: React.createElement(FontSizeOutlined),
                category: 'text' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertShortText().run();
                },
              },
              {
                title: 'Long Text',
                icon: React.createElement(FileTextOutlined),
                category: 'text' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertLongText().run();
                },
              },
              {
                title: 'Rich Text',
                icon: React.createElement(UnorderedListOutlined),
                category: 'text' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertRichText().run();
                },
              },
              // ── CHOICE ───────────────────────────────────
              {
                title: 'Single Choice',
                icon: React.createElement(RadiusSettingOutlined),
                category: 'choice' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertSingleChoice().run();
                },
              },
              {
                title: 'Multiple Choice',
                icon: React.createElement(CheckSquareOutlined),
                category: 'choice' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertMultipleChoice().run();
                },
              },
              // ── NUMERIC ────────────────────────────────────
              {
                title: 'Number',
                icon: React.createElement(FieldNumberOutlined),
                category: 'numeric' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertNumberField().run();
                },
              },
              {
                title: 'Slider',
                icon: React.createElement(SlidersOutlined),
                category: 'numeric' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertSliderField().run();
                },
              },
              {
                title: 'Rating',
                icon: React.createElement(StarOutlined),
                category: 'numeric' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertRatingField().run();
                },
              },
              // {
              //   title: 'Computed',
              //   icon: React.createElement(CalculatorOutlined),
              //   category: 'numeric',
              //   command: ({ editor, range }) => {
              //     editor.chain().focus().deleteRange(range).insertComputed().run();
              //   },
              // },
              // ── DATE & TIME ─────────────────────────────────
              {
                title: 'Date',
                icon: React.createElement(CalendarOutlined),
                category: 'date' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertDateField().run();
                },
              },
              {
                title: 'Date & Time',
                icon: React.createElement(FieldTimeOutlined),
                category: 'date' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertDateTimeField().run();
                },
              },

            // // ── FILE & SIGNATURE ────────────────────────────
              {
                title: 'File Upload',
                icon: React.createElement(UploadOutlined),
                category: 'file' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertFileField().run();
                },
              },
              {
                title: 'Signature',
                icon: React.createElement(FormOutlined),
                category: 'file' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertSignature().run();
                },
              },
              // ── ADVANCED ────────────────────────────────────
              {
                title: 'Address',
                icon: React.createElement(EnvironmentOutlined),
                category: 'advanced' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertAddress().run();
                },
              },
              {
                title: 'Ranking',
                icon: React.createElement(TrophyOutlined),
                category: 'advanced' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertRanking().run();
                },
              },
              {
                title: 'Matrix',
                icon: React.createElement(TableOutlined),
                category: 'advanced' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).insertMatrix().run();
                },
              },
                          // {
            //   title: 'Repeater',
            //   icon: React.createElement(AppstoreOutlined),
            //   category: 'advanced',
            //   command: ({ editor, range }) => {
            //     editor.chain().focus().deleteRange(range).insertRepeater().run();
            //   },
            // },
            // {
            //   title: 'Lookup',
            //   icon: React.createElement(SearchOutlined),
            //   category: 'advanced',
            //   command: ({ editor, range }) => {
            //     editor.chain().focus().deleteRange(range).insertLookup().run();
            //   },
            // },
            // {
            //   title: 'Section',
            //   icon: React.createElement(FolderOutlined),
            //   category: 'layout',
            //   command: ({ editor, range }) => {
            //     editor.chain().focus().deleteRange(range).insertSection().run();
            //   },
            // },
            // {
            //   title: 'Static Content',
            //   icon: React.createElement(InfoCircleOutlined),
            //   category: 'layout',
            //   command: ({ editor, range }) => {
            //     editor.chain().focus().deleteRange(range).insertStaticContent().run();
            //   },
            // },
            // {
            //   title: 'Hidden',
            //   icon: React.createElement(EyeInvisibleOutlined),
            //   category: 'advanced',
            //   command: ({ editor, range }) => {
            //     editor.chain().focus().deleteRange(range).insertHidden().run();
            //   },
            // },
              // ── LAYOUT ───────────────────────────────────
              {
                title: 'Divider',
                icon: React.createElement(MinusOutlined),
                category: 'layout' as const,
                command: ({ editor, range }: { editor: Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).setHorizontalRule().run();
                },
              },
            ] as CommandItem[]),
          ];

          // Attach shortcuts
          return all.map((item) => ({
            ...item,
            shortcuts: generateShortcuts(item.title),
          }));
        },

        // Filter by **shortcut** or **title**
        // itemFilter: ({ query, item }: { query: string; item: CommandItem }) => {
        //   if (!query) return true;
        //   const q = query.toLowerCase().trim();
        //   const matchesTitle = item.title.toLowerCase().includes(q);
        //   const matchesShortcut = item.shortcuts?.some((s) => s.startsWith(q));
        //   return matchesTitle || matchesShortcut;
        // },

        render: () => {
          let component: ReactRenderer<CommandListRef>;
          let popup: TippyInstance;

          return {
            onStart: (props) => {
              component = new ReactRenderer(CommandList, {
                props: {
                  items: props.items,
                  query: props.query || '',
                  command: (item: CommandItem) => {
                    item.command({ editor: props.editor, range: props.range });
                    popup?.hide();
                  },
                },
                editor: props.editor,
              });

              const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

              popup = tippy(document.body, {
                getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(0, 0, 0, 0),
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                arrow: false,
                theme: isDark ? 'dark' : 'light-border',
                animation: 'shift-away',
                maxWidth: 380,
                zIndex: 9999,
              });
            },

            onUpdate: (props) => {
              component.updateProps({
                items: props.items,
                query: props.query || '',
                command: (item: CommandItem) => {
                  item.command({ editor: props.editor, range: props.range });
                  popup?.hide();
                },
              });

              popup?.setProps({
                getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(0, 0, 0, 0),
              });
            },

            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                popup?.hide();
                return true;
              }
              return component.ref?.onKeyDown(props) ?? false;
            },

            onExit: () => {
              popup?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});