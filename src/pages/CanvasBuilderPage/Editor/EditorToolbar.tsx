// src/components/EditorToolbar.tsx
import React, { useCallback } from 'react';
import { Button, Space, Tooltip, Dropdown, Modal } from 'antd';
import {
  LayoutOutlined,
  BarsOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  DownOutlined,
} from '@ant-design/icons';
import type { Editor } from '@tiptap/react';

type Props = { editor: Editor | null | undefined };

function logIfNoEditor(action: string, editor?: Editor | null) {
  if (!editor)
    console.warn(`[EditorToolbar] editor is null — cannot ${action}`);
}

export default function EditorToolbar({ editor }: Props) {
  const [modal, contextHolder] = Modal.useModal();
  // compute availability of commands (safe)
  // const available = useMemo(() => {
  //   return {
  //     insertSection: !!(
  //       editor &&
  //       (editor as Editor).commands &&
  //       (editor as Editor).commands.insertSection
  //     ),
  //     insertRepeater: !!(
  //       editor &&
  //       (editor as Editor).commands &&
  //       (editor as Editor).commands.insertRepeater
  //     ),
  //     insertStatic: !!(
  //       editor &&
  //       (editor as Editor).commands &&
  //       (editor as Editor).commands.insertStaticContent
  //     ),
  //     addRepeaterInstanceAt: !!(
  //       editor &&
  //       (editor as Editor).commands &&
  //       (editor as Editor).commands.addRepeaterInstanceAt
  //     ),
  //   };
  // }, [editor]);

  // useEffect(() => {
  //   console.debug(
  //     '[EditorToolbar] mounted. editor present?',
  //     !!editor,
  //     'available:',
  //     available
  //   );
  // }, [editor, available]);

  const insertSection = useCallback(() => {
    if (!editor) return logIfNoEditor('insertSection', editor);
    // editor.commands.focus();
    // if (editor.commands.insertSection)
    //   editor.commands.insertSection({ label: 'Section' });
    // else console.warn('insertSection command not registered');
  }, [editor]);

  const insertRepeater = useCallback(() => {
    if (!editor) return logIfNoEditor('insertRepeater', editor);
    editor.commands.focus();
    // if (editor.commands.insertRepeater)
    //   editor.commands.insertRepeater({ label: 'Repeater' });
    // else console.warn('insertRepeater command not registered');
  }, [editor]);

  const insertStatic = useCallback(() => {
    if (!editor) return logIfNoEditor('insertStaticContent', editor);
    editor.commands.focus();
    // if (editor.commands.insertStaticContent)
    //   editor.commands.insertStaticContent({
    //     type: 'info',
    //     title: 'Note',
    //     body: '',
    //   });
    // else console.warn('insertStaticContent command not registered');
  }, [editor]);

  const captureTemplate = useCallback(() => {
    if (!editor) return logIfNoEditor('captureTemplate', editor);
    // try to find repeater ancestor position safely
    const doc = editor.state.doc;
    const selFrom = editor.state.selection.from;
    let foundPos: number | null = null;
    doc.descendants((node, pos) => {
      if (foundPos !== null) return;
      if (
        node.type.name === 'repeater' &&
        pos <= selFrom &&
        selFrom <= pos + node.nodeSize
      ) {
        foundPos = pos;
      }
    });
    if (foundPos == null) {
      modal.info({
        title: 'No repeater',
        content: 'Place caret inside a repeater to capture template.',
      });
      return;
    }
    // if (editor.commands.setRepeaterTemplateFromSelection) {
    //   const ok = editor.commands.setRepeaterTemplateFromSelection(foundPos);
    //   if (!ok)
    //     modal.error({
    //       title: 'Capture failed',
    //       content: 'Selection invalid or command failed.',
    //     });
    //   else modal.success({ title: 'Template captured' });
    // } else {
    //   console.warn('setRepeaterTemplateFromSelection not registered');
    // }
  }, [editor]);

  // simple repeater dropdown menu
  const repeaterMenuItems = [
    {
      key: 'add',
      label: 'Add instance',
      onClick: () => {
        if (!editor) return logIfNoEditor('add instance', editor);
        // find nearest repeater pos
        const doc = editor.state.doc;
        const selFrom = editor.state.selection.from;
        let foundPos: number | null = null;
        doc.descendants((node, pos) => {
          if (foundPos !== null) return;
          if (
            node.type.name === 'repeater' &&
            pos <= selFrom &&
            selFrom <= pos + node.nodeSize
          )
            foundPos = pos;
        });
        if (foundPos == null)
          return modal.info({
            title: 'No repeater',
            content: 'Place caret inside a repeater to add instance.',
          });
        // if (editor.commands.addRepeaterInstanceAt)
        //   editor.commands.addRepeaterInstanceAt(foundPos);
      },
    },
    {
      key: 'dup',
      label: 'Duplicate instance',
      onClick: () => {
        if (!editor) return logIfNoEditor('duplicate', editor);
        // duplicate current instance (simple approach using nearest repeater and child index)
        const doc = editor.state.doc;
        const selFrom = editor.state.selection.from;
        let foundPos: number | null = null;
        let foundIndex: number | null = null;
        doc.descendants((node, pos) => {
          if (foundPos !== null) return;
          if (
            node.type.name === 'repeater' &&
            pos <= selFrom &&
            selFrom <= pos + node.nodeSize
          ) {
            foundPos = pos;
            // compute child index
            let offset = pos + 1;
            for (let i = 0; i < node.childCount; i++) {
              const child = node.child(i);
              if (selFrom >= offset && selFrom < offset + child.nodeSize) {
                foundIndex = i;
                break;
              }
              offset += child.nodeSize;
            }
          }
        });
        if (foundPos == null || foundIndex == null)
          return modal.info({
            title: 'No instance',
            content: 'Place caret inside an instance to duplicate.',
          });
        // if (editor.commands.duplicateRepeaterInstance)
        //   editor.commands.duplicateRepeaterInstance(foundPos, foundIndex);
      },
    },
    {
      key: 'remove',
      label: 'Remove instance',
      onClick: () => {
        if (!editor) return logIfNoEditor('remove instance', editor);
        const doc = editor.state.doc;
        const selFrom = editor.state.selection.from;
        let foundPos: number | null = null;
        let foundIndex: number | null = null;
        doc.descendants((node, pos) => {
          if (foundPos !== null) return;
          if (
            node.type.name === 'repeater' &&
            pos <= selFrom &&
            selFrom <= pos + node.nodeSize
          ) {
            foundPos = pos;
            let offset = pos + 1;
            for (let i = 0; i < node.childCount; i++) {
              const child = node.child(i);
              if (selFrom >= offset && selFrom < offset + child.nodeSize) {
                foundIndex = i;
                break;
              }
              offset += child.nodeSize;
            }
          }
        });
        if (foundPos == null || foundIndex == null)
          return modal.info({
            title: 'No instance',
            content: 'Place caret inside an instance to remove.',
          });
        modal.confirm({
          title: 'Remove instance?',
          onOk: () => {
            // const cmds = (editor?.commands as any);
            // if (cmds?.removeRepeaterInstance)
            //   cmds.removeRepeaterInstance(foundPos!, foundIndex!);
          },
        });
      },
    },
  ];

  // inline styles to ensure toolbar visible
  const toolbarStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    padding: '8px',
    background: '#fff',
    borderBottom: '1px solid #e8e8e8',
    zIndex: 9999,
    position: 'relative',
  };

  return (
    <div style={toolbarStyle}>
      {contextHolder}
      <Space>
        <Tooltip title="Insert section">
          <Button icon={<LayoutOutlined />} onClick={insertSection} />
        </Tooltip>
        <Tooltip title="Insert repeater">
          <Button icon={<BarsOutlined />} onClick={insertRepeater} />
        </Tooltip>
        <Dropdown menu={{ items: repeaterMenuItems }}>
          <Button>
            Repeater <DownOutlined />
          </Button>
        </Dropdown>
        <Tooltip title="Capture selection as template">
          <Button icon={<SaveOutlined />} onClick={captureTemplate} />
        </Tooltip>
        <Tooltip title="Insert static content">
          <Button icon={<InfoCircleOutlined />} onClick={insertStatic} />
        </Tooltip>
      </Space>
    </div>
  );
}
