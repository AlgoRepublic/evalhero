import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  CodeOutlined,
  HighlightOutlined,
  FileTextOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  CodepenCircleOutlined,
  BlockOutlined,
  MinusOutlined,
  EnterOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  PicCenterOutlined,
  FontSizeOutlined,
  UndoOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { Button, Divider, Space, Tooltip, theme, ColorPicker } from 'antd';
import type { GlobalToken } from 'antd';
import { cyan, red, green, generate } from '@ant-design/colors';
import type { Level } from '@tiptap/extension-heading';

const getPalettePresets = (token: GlobalToken) => [
  { label: 'Primary', colors: generate(token.colorPrimary), key: 'primary' },
  { label: 'Red', colors: red, key: 'red' },
  { label: 'Green', colors: green, key: 'green' },
  { label: 'Cyan', colors: cyan, key: 'cyan' },
];

export function RichTextMenuBar({ editor }: { editor: Editor }) {
  const { token } = theme.useToken();

  const isActive = (nameOrAttrs: string | Record<string, unknown>, attrs?: Record<string, unknown>) =>
    typeof nameOrAttrs === 'string' ? editor.isActive(nameOrAttrs, attrs) : editor.isActive(nameOrAttrs);

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      return {
        isBold: ctx.editor.isActive('bold') ?? false,
        isItalic: ctx.editor.isActive('italic') ?? false,
        isStrike: ctx.editor.isActive('strike') ?? false,
        isCode: ctx.editor.isActive('code') ?? false,
        isHighlight: ctx.editor.isActive('highlight') ?? false,
        isParagraph: ctx.editor.isActive('paragraph') ?? false,
        isHeading1: ctx.editor.isActive('heading', { level: 1 }) ?? false,
        isHeading2: ctx.editor.isActive('heading', { level: 2 }) ?? false,
        isHeading3: ctx.editor.isActive('heading', { level: 3 }) ?? false,
        isHeading4: ctx.editor.isActive('heading', { level: 4 }) ?? false,
        isHeading5: ctx.editor.isActive('heading', { level: 5 }) ?? false,
        isHeading6: ctx.editor.isActive('heading', { level: 6 }) ?? false,
        isBulletList: ctx.editor.isActive('bulletList') ?? false,
        isOrderedList: ctx.editor.isActive('orderedList') ?? false,
        isCodeBlock: ctx.editor.isActive('codeBlock') ?? false,
        isBlockquote: ctx.editor.isActive('blockquote') ?? false,
        isAlignLeft: ctx.editor.isActive({ textAlign: 'left' }) ?? false,
        isAlignCenter: ctx.editor.isActive({ textAlign: 'center' }) ?? false,
        isAlignRight: ctx.editor.isActive({ textAlign: 'right' }) ?? false,
        isAlignJustify: ctx.editor.isActive({ textAlign: 'justify' }) ?? false,
        canUndo: ctx.editor.can().chain().undo().run() ?? false,
        canRedo: ctx.editor.can().chain().redo().run() ?? false,
      };
    },
  });

  return (
    <div className="control-group">
      <div
        className="button-group"
        style={{
          padding: '8px 12px',
          background: token.colorBgElevated,
          borderBottom: `1px solid ${token.colorBorder}`,
          borderRadius: 8,
          marginBottom: 8,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        <Space size={4} wrap={false}>
          {/* Marks */}
          <Tooltip title="Bold">
            <Button
              type={isActive('bold') ? 'primary' : 'default'}
              size="small"
              icon={<BoldOutlined />}
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={!editor.can().chain().toggleBold().run()}
            />
          </Tooltip>

          <Tooltip title="Italic">
            <Button
              type={isActive('italic') ? 'primary' : 'default'}
              size="small"
              icon={<ItalicOutlined />}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              disabled={!editor.can().chain().toggleItalic().run()}
            />
          </Tooltip>

          <Tooltip title="Strike">
            <Button
              type={isActive('strike') ? 'primary' : 'default'}
              size="small"
              icon={<StrikethroughOutlined />}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              disabled={!editor.can().chain().toggleStrike().run()}
            />
          </Tooltip>

          <Tooltip title="Code">
            <Button
              type={isActive('code') ? 'primary' : 'default'}
              size="small"
              icon={<CodeOutlined />}
              onClick={() => editor.chain().focus().toggleCode().run()}
              disabled={!editor.can().chain().toggleCode().run()}
            />
          </Tooltip>

          <Tooltip title="Highlight">
            <Button
              type={editorState.isHighlight ? 'primary' : 'default'}
              size="small"
              icon={<HighlightOutlined />}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
            />
          </Tooltip>

          <Tooltip title="Text color">
            <ColorPicker
              value={editor.getAttributes('textStyle').color}
              presets={getPalettePresets(token)}
              onChange={(v) => editor.chain().focus().setColor(v.toHexString()).run()}
              size="small"
              allowClear
            />
          </Tooltip>
          <Tooltip title="Background color">
            <ColorPicker
              value={editor.getAttributes('textStyle').backgroundColor}
              presets={getPalettePresets(token)}
              onChange={(v) => editor.chain().focus().setBackgroundColor(v.toHexString()).run()}
              size="small"
              allowClear
            />
          </Tooltip>

          <Divider type="vertical" style={{ margin: '0 8px' }} />

          {/* Paragraph & Headings */}
          <Tooltip title="Paragraph">
            <Button
              type={editorState.isParagraph ? 'primary' : 'default'}
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => editor.chain().focus().setParagraph().run()}
            />
          </Tooltip>
          {([1, 2, 3, 4, 5, 6] as Level[]).map((level: Level) => (
            <Tooltip key={level} title={`Heading ${level}`}>
              <Button
                type={editorState[`isHeading${level}` as keyof typeof editorState] ? 'primary' : 'default'}
                size="small"
                icon={<FontSizeOutlined style={{ fontSize: `${20 - level * 1.5}px` }} />}
                onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
              />
            </Tooltip>
          ))}

          <Divider type="vertical" style={{ margin: '0 8px' }} />

          {/* Lists */}
          <Tooltip title="Bullet List">
            <Button
              type={editorState.isBulletList ? 'primary' : 'default'}
              size="small"
              icon={<UnorderedListOutlined />}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
          </Tooltip>

          <Tooltip title="Ordered List">
            <Button
              type={editorState.isOrderedList ? 'primary' : 'default'}
              size="small"
              icon={<OrderedListOutlined />}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
          </Tooltip>

          <Divider type="vertical" style={{ margin: '0 8px' }} />

          {/* Blocks */}
          <Tooltip title="Code Block">
            <Button
              type={editorState.isCodeBlock ? 'primary' : 'default'}
              size="small"
              icon={<CodepenCircleOutlined />}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            />
          </Tooltip>

          <Tooltip title="Blockquote">
            <Button
              type={editorState.isBlockquote ? 'primary' : 'default'}
              size="small"
              icon={<BlockOutlined />}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            />
          </Tooltip>

          <Tooltip title="Divider">
            <Button
              size="small"
              icon={<MinusOutlined />}
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
            />
          </Tooltip>

          <Tooltip title="Line Break">
            <Button
              size="small"
              icon={<EnterOutlined />}
              onClick={() => editor.chain().focus().setHardBreak().run()}
            />
          </Tooltip>

          <Divider type="vertical" style={{ margin: '0 8px' }} />

          {/* Alignment */}
          <Tooltip title="Align Left">
            <Button
              type={editorState.isAlignLeft ? 'primary' : 'default'}
              size="small"
              icon={<AlignLeftOutlined />}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
            />
          </Tooltip>

          <Tooltip title="Align Center">
            <Button
              type={editorState.isAlignCenter ? 'primary' : 'default'}
              size="small"
              icon={<AlignCenterOutlined />}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
            />
          </Tooltip>

          <Tooltip title="Align Right">
            <Button
              type={editorState.isAlignRight ? 'primary' : 'default'}
              size="small"
              icon={<AlignRightOutlined />}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
            />
          </Tooltip>

          <Tooltip title="Justify">
            <Button
              type={editorState.isAlignJustify ? 'primary' : 'default'}
              size="small"
              icon={<PicCenterOutlined />}
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            />
          </Tooltip>

          {/* History */}
          <Tooltip title="Undo">
            <Button
              size="small"
              icon={<UndoOutlined />}
              disabled={!editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
            />
          </Tooltip>

          <Tooltip title="Redo">
            <Button
              size="small"
              icon={<RedoOutlined />}
              disabled={!editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
            />
          </Tooltip>
        </Space>
      </div>
    </div>
  );
}

export default RichTextMenuBar;


