import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  CodeOutlined,
  ClearOutlined,
  FileTextOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  CodepenCircleOutlined,
  BlockOutlined,
  MinusOutlined,
  EnterOutlined,
  HighlightOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  PicCenterOutlined,
  FontSizeOutlined,
  AppstoreOutlined,
  RadiusSettingOutlined,
  CheckSquareOutlined,
  FieldNumberOutlined,
  SlidersOutlined,
  StarOutlined,
  CalendarOutlined,
  FieldTimeOutlined,
  EnvironmentOutlined,
  TrophyOutlined,
  UploadOutlined,
  FormOutlined,
  FolderOutlined,
  InfoCircleOutlined,
  TableOutlined,
} from '@ant-design/icons';
import type { Attributes, Editor } from '@tiptap/react';
import type { Level } from '@tiptap/extension-heading';
import { useEditorState } from '@tiptap/react';
import {
  Button,
  Drawer,
  Divider,
  Space,
  theme,
  Tooltip,
  ColorPicker,
  GlobalToken,
  Typography,
  Input,
  Row,
  Col,
} from 'antd';
import { cyan, red, green, generate } from '@ant-design/colors';
import { useMemo, useState } from 'react';
import { isInsideCustomNode } from './utils';

const { Text } = Typography;

const getPalettePresets = (token: GlobalToken) => [
  { label: 'Primary', colors: generate(token.colorPrimary), key: 'primary' },
  { label: 'Red', colors: red, key: 'red' },
  { label: 'Green', colors: green, key: 'green' },
  { label: 'Cyan', colors: cyan, key: 'cyan' },
];

/** Insert node definition for the drawer grid */
const INSERT_NODES: {
  key: string;
  label: string;
  icon: React.ReactNode;
  command: string;
  category: 'text' | 'choice' | 'numeric' | 'date' | 'file' | 'layout' | 'advanced';
}[] = [
  { key: 'shortText', label: 'Short Text', icon: <FontSizeOutlined />, command: 'insertShortText', category: 'text' },
  { key: 'longText', label: 'Long Text', icon: <FileTextOutlined />, command: 'insertLongText', category: 'text' },
  { key: 'richText', label: 'Rich Text', icon: <FileTextOutlined />, command: 'insertRichText', category: 'text' },
  { key: 'singleChoice', label: 'Single Choice', icon: <RadiusSettingOutlined />, command: 'insertSingleChoice', category: 'choice' },
  { key: 'multipleChoice', label: 'Multiple Choice', icon: <CheckSquareOutlined />, command: 'insertMultipleChoice', category: 'choice' },
  { key: 'numberField', label: 'Number', icon: <FieldNumberOutlined />, command: 'insertNumberField', category: 'numeric' },
  { key: 'sliderField', label: 'Slider', icon: <SlidersOutlined />, command: 'insertSliderField', category: 'numeric' },
  { key: 'ratingField', label: 'Rating', icon: <StarOutlined />, command: 'insertRatingField', category: 'numeric' },
  { key: 'dateField', label: 'Date', icon: <CalendarOutlined />, command: 'insertDateField', category: 'date' },
  { key: 'dateTimeField', label: 'Date & Time', icon: <FieldTimeOutlined />, command: 'insertDateTimeField', category: 'date' },
  { key: 'addressField', label: 'Address', icon: <EnvironmentOutlined />, command: 'insertAddress', category: 'advanced' },
  { key: 'ranking', label: 'Ranking', icon: <TrophyOutlined />, command: 'insertRanking', category: 'advanced' },
  { key: 'matrixField', label: 'Matrix', icon: <TableOutlined />, command: 'insertMatrix', category: 'advanced' },
  { key: 'fileField', label: 'File Upload', icon: <UploadOutlined />, command: 'insertFileField', category: 'file' },
  { key: 'signatureField', label: 'Signature', icon: <FormOutlined />, command: 'insertSignature', category: 'file' },
  // { key: 'computedField', label: 'Computed', icon: <CalculatorOutlined />, command: 'insertComputed', category: 'advanced' },
  // { key: 'lookupField', label: 'Lookup', icon: <SearchOutlined />, command: 'insertLookup', category: 'advanced' },
  // { key: 'repeater', label: 'Repeater', icon: <AppstoreOutlined />, command: 'insertRepeater', category: 'layout' },
  { key: 'section', label: 'Section', icon: <FolderOutlined />, command: 'insertSection', category: 'layout' },
  { key: 'staticContent', label: 'Static Content', icon: <InfoCircleOutlined />, command: 'insertStaticContent', category: 'layout' },
  // { key: 'hiddenField', label: 'Hidden Field', icon: <EyeInvisibleOutlined />, command: 'insertHidden', category: 'advanced' },
];

const CATEGORY_LABELS: Record<string, string> = {
  text: 'Text fields',
  choice: 'Choice fields',
  numeric: 'Numeric',
  date: 'Date & time',
  file: 'File & signature',
  layout: 'Layout',
  advanced: 'Advanced',
};

export function MenuBar({ editor }: { editor: Editor }) {
  const { token } = theme.useToken();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nodeSearch, setNodeSearch] = useState('');

  const palettePresets = useMemo(() => getPalettePresets(token), [token]);
  const topOffset = 65;

  const isActive = (nameOrAttrs: string | Attributes, attrs?: Attributes) =>
    typeof nameOrAttrs === 'string'
      ? editor.isActive(nameOrAttrs, attrs)
      : editor.isActive(nameOrAttrs);
  const can = (cmd: keyof ReturnType<Editor['can']>) => {
    const value = (editor.can() as unknown as Record<string, unknown>)[
      cmd as string
    ];
    if (typeof value === 'function') {
      return (value as () => boolean)();
    }
    return !!value;
  };

  const insideCustomNode = useEditorState({
    editor,
    selector: (ctx) => isInsideCustomNode(ctx.editor),
  });

  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor.isActive('bold') ?? false,
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
    }),
  });

  const setColor = (value: { toHexString: () => string }) =>
    editor.chain().focus().setColor(value.toHexString()).run();
  const setBgColor = (value: { toHexString: () => string }) =>
    editor.chain().focus().setBackgroundColor(value.toHexString()).run();

  const runInsert = (command: string) => {
    const chain = editor.chain().focus();
    const fn = (chain as unknown as Record<string, () => typeof chain>)[command];
    if (typeof fn === 'function') {
      fn.call(chain).run();
      setDrawerOpen(false);
    }
  };

  const filteredNodes = useMemo(() => {
    if (!nodeSearch.trim()) return INSERT_NODES;
    const q = nodeSearch.toLowerCase().trim();
    return INSERT_NODES.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.key.toLowerCase().includes(q) ||
        CATEGORY_LABELS[n.category]?.toLowerCase().includes(q)
    );
  }, [nodeSearch]);

  const nodesByCategory = useMemo(() => {
    const map: Record<string, typeof INSERT_NODES> = {};
    filteredNodes.forEach((n) => {
      if (!map[n.category]) map[n.category] = [];
      map[n.category].push(n);
    });
    return map;
  }, [filteredNodes]);

  return (
    <div className="control-group" style={{ marginTop: topOffset }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: token.colorBgElevated,
          borderBottom: `1px solid ${token.colorBorder}`,
          borderRadius: 8,
          marginBottom: 16,
          width: '100%',
        }}
      >
        <Space size="small">
          <Button
            type="primary"
            icon={<AppstoreOutlined />}
            onClick={() => setDrawerOpen(true)}
          >
            Format & insert blocks
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            or type <kbd style={{ padding: '1px 4px', background: token.colorFillSecondary, borderRadius: 4 }}>/</kbd> to insert
          </Text>
        </Space>
      </div>

      <Drawer
        title="Format & insert blocks"
        placement="right"
        width={400}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { paddingTop: 8 } }}
      >
        {/* ── Formatting (marks) ───────────────────────── */}
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
          Text formatting
        </Typography.Title>
        <Space size={4} wrap style={{ marginBottom: 16 }}>
          <Tooltip title="Bold">
            <Button
              type={isActive('bold') ? 'primary' : 'default'}
              size="small"
              icon={<BoldOutlined />}
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={!can('toggleBold')}
            />
          </Tooltip>
          <Tooltip title="Italic">
            <Button
              type={isActive('italic') ? 'primary' : 'default'}
              size="small"
              icon={<ItalicOutlined />}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              disabled={!can('toggleItalic')}
            />
          </Tooltip>
          <Tooltip title="Strike">
            <Button
              type={isActive('strike') ? 'primary' : 'default'}
              size="small"
              icon={<StrikethroughOutlined />}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              disabled={!can('toggleStrike')}
            />
          </Tooltip>
          <Tooltip title="Code">
            <Button
              type={isActive('code') ? 'primary' : 'default'}
              size="small"
              icon={<CodeOutlined />}
              onClick={() => editor.chain().focus().toggleCode().run()}
              disabled={!can('toggleCode')}
            />
          </Tooltip>
          <Tooltip title="Highlight">
            <Button
              type={isActive('highlight') ? 'primary' : 'default'}
              size="small"
              icon={<HighlightOutlined />}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
            />
          </Tooltip>
          <Tooltip title="Clear marks">
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={() => editor.chain().focus().unsetAllMarks().run()}
            />
          </Tooltip>
          <div style={{ width: '100%', marginTop: 4 }}>
            <Space>
              <Tooltip title="Text color">
                <ColorPicker
                  value={editor.getAttributes('textStyle').color}
                  presets={palettePresets}
                  onChange={setColor}
                  size="small"
                  allowClear
                />
              </Tooltip>
              <Tooltip title="Background color">
                <ColorPicker
                  value={editor.getAttributes('textStyle').backgroundColor}
                  presets={palettePresets}
                  onChange={setBgColor}
                  size="small"
                  allowClear
                />
              </Tooltip>
            </Space>
          </div>
        </Space>

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Block type (paragraph / headings) ───────── */}
        <Typography.Title level={5} style={{ marginBottom: 8 }}>
          Block type
        </Typography.Title>
        <Space size={4} wrap style={{ marginBottom: 16 }}>
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
                type={
                  editorState[`isHeading${level}` as keyof typeof editorState]
                    ? 'primary'
                    : 'default'
                }
                size="small"
                icon={
                  <FontSizeOutlined
                    style={{ fontSize: `${20 - level * 1.5}px` }}
                  />
                }
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level }).run()
                }
              />
            </Tooltip>
          ))}
        </Space>

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Lists & blocks ───────────────────────────── */}
        <Typography.Title level={5} style={{ marginBottom: 8 }}>
          Lists & blocks
        </Typography.Title>
        <Space size={4} wrap style={{ marginBottom: 16 }}>
          <Tooltip title="Bullet List">
            <Button
              type={editorState.isBulletList ? 'primary' : 'default'}
              size="small"
              icon={<UnorderedListOutlined />}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              disabled={insideCustomNode}
            />
          </Tooltip>
          <Tooltip title="Ordered List">
            <Button
              type={editorState.isOrderedList ? 'primary' : 'default'}
              size="small"
              icon={<OrderedListOutlined />}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              disabled={insideCustomNode}
            />
          </Tooltip>
          <Tooltip title="Code Block">
            <Button
              type={editorState.isCodeBlock ? 'primary' : 'default'}
              size="small"
              icon={<CodepenCircleOutlined />}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              disabled={insideCustomNode}
            />
          </Tooltip>
          <Tooltip title="Blockquote">
            <Button
              type={editorState.isBlockquote ? 'primary' : 'default'}
              size="small"
              icon={<BlockOutlined />}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              disabled={insideCustomNode}
            />
          </Tooltip>
          <Tooltip title="Divider">
            <Button
              size="small"
              icon={<MinusOutlined />}
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              disabled={insideCustomNode}
            />
          </Tooltip>
          <Tooltip title="Line break">
            <Button
              size="small"
              icon={<EnterOutlined />}
              onClick={() => editor.chain().focus().setHardBreak().run()}
              disabled={insideCustomNode}
            />
          </Tooltip>
        </Space>

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Alignment ────────────────────────────────── */}
        <Typography.Title level={5} style={{ marginBottom: 8 }}>
          Alignment
        </Typography.Title>
        <Space size={4} wrap style={{ marginBottom: 16 }}>
          <Tooltip title="Align left">
            <Button
              type={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'}
              size="small"
              icon={<AlignLeftOutlined />}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
            />
          </Tooltip>
          <Tooltip title="Align center">
            <Button
              type={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'}
              size="small"
              icon={<AlignCenterOutlined />}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
            />
          </Tooltip>
          <Tooltip title="Align right">
            <Button
              type={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'}
              size="small"
              icon={<AlignRightOutlined />}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
            />
          </Tooltip>
          <Tooltip title="Justify">
            <Button
              type={editor.isActive({ textAlign: 'justify' }) ? 'primary' : 'default'}
              size="small"
              icon={<PicCenterOutlined />}
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            />
          </Tooltip>
        </Space>

        <Divider style={{ margin: '12px 0' }} />

        {/* ── Insert nodes ─────────────────────────────── */}
        <Typography.Title level={5} style={{ marginBottom: 8 }}>
          Insert blocks
        </Typography.Title>
        <Input
          placeholder="Search blocks..."
          value={nodeSearch}
          onChange={(e) => setNodeSearch(e.target.value)}
          allowClear
          style={{ marginBottom: 12 }}
        />
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {Object.entries(nodesByCategory).map(([category, nodes]) => (
            <div key={category} style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 12, color: token.colorTextSecondary }}>
                {CATEGORY_LABELS[category] ?? category}
              </Text>
              <Row style={{ marginTop: 6 }} gutter={[8, 8]}>
                {nodes.map((node) => (
                  <Col key={node.key} span={12}>
                    <Button
                      block
                      size="small"
                      icon={node.icon}
                      onClick={() => runInsert(node.command)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 6,
                        height: 36,
                        textAlign: 'left',
                      }}
                    >
                      {node.label}
                    </Button>
                  </Col>
                ))}
              </Row>
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
}
