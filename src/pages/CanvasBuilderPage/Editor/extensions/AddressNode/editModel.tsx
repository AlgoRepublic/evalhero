/* eslint-disable @typescript-eslint/no-explicit-any */
import { Attributes } from '@tiptap/core';
import { Form, Input, Modal, Typography, Space, Checkbox, Select, Button, Divider } from 'antd';
import React, { Suspense, useEffect, useState } from 'react';
// import TagSelector from '../../components/TagSelector';

// Lazy-load MapLeaflet only in browser (avoids bundling Leaflet for server-side)
const MapLeafletLazy = typeof window !== 'undefined' 
  ? React.lazy(() => import('./MapPicker'))
  : null;

// Wrapper component to safely render the lazy-loaded map
const MapLeafletWrapper = React.memo(({ initialLat, initialLng, onSelect }: {
  initialLat?: number | null;
  initialLng?: number | null;
  onSelect?: (p: { lat: number; lng: number }) => void;
}) => {
  if (typeof window === 'undefined' || !MapLeafletLazy) {
    return (
      <div style={{ padding: 16, textAlign: 'center', fontSize: 12, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Map not available
      </div>
    );
  }
  
  return (
    <Suspense fallback={<div style={{ padding: 16, textAlign: 'center', fontSize: 12, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading map…</div>}>
      <MapLeafletLazy
        key={`map-${initialLat}-${initialLng}`}
        initialLat={initialLat ?? null}
        initialLng={initialLng ?? null}
        onSelect={onSelect}
      />
    </Suspense>
  );
});

const { Text } = Typography;
const { Option } = Select;

const AddressEditModal = ({
  open,
  onClose,
  nodeAttrs,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  nodeAttrs: Attributes;
  onSave: (values: Attributes) => void;
}) => {
  const [form] = Form.useForm();
  const mapEnabled = Form.useWatch('mapEnabled', form);
  const lat = Form.useWatch('lat', form);
  const lng = Form.useWatch('lng', form);
  const [mapReady, setMapReady] = useState(false);

  // Reset form values when modal opens or nodeAttrs change
  useEffect(() => {
    if (open) {
      const attrs = nodeAttrs as any;
      
      // Normalize required to boolean (handle both true and "true" string)
      const requiredValue = typeof attrs.required === 'string'
        ? attrs.required === 'true'
        : !!attrs.required;
      
      // Normalize individual enabled attributes (handle both boolean and string "true"/"false")
      const normalizeBool = (value: any, defaultValue: boolean = true): boolean => {
        if (value === undefined || value === null) return defaultValue;
        if (typeof value === 'string') return value === 'true';
        return !!value;
      };
      
      form.setFieldsValue({
        ...nodeAttrs,
        required: requiredValue,
        streetEnabled: normalizeBool(attrs.streetEnabled, true),
        apartmentEnabled: normalizeBool(attrs.apartmentEnabled, true),
        cityEnabled: normalizeBool(attrs.cityEnabled, true),
        stateEnabled: normalizeBool(attrs.stateEnabled, true),
        postalCodeEnabled: normalizeBool(attrs.postalCodeEnabled, true),
        countryEnabled: normalizeBool(attrs.countryEnabled, true),
      });
    } else {
      setMapReady(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, (nodeAttrs as any).required, (nodeAttrs as any).streetEnabled, (nodeAttrs as any).apartmentEnabled, (nodeAttrs as any).cityEnabled, (nodeAttrs as any).stateEnabled, (nodeAttrs as any).postalCodeEnabled, (nodeAttrs as any).countryEnabled]);

  return (
    <Modal
      open={open}
      title="Edit Field"
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden={false}
      maskClosable={false}
      // width={600}
      afterOpenChange={(isOpen) => {
        // Only render map after modal animation completes
        if (isOpen) {
          setTimeout(() => setMapReady(true), 200);
        } else {
          setMapReady(false);
        }
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          ...nodeAttrs,
          // Normalize required to boolean (handle both true and "true" string)
          required: typeof (nodeAttrs as any).required === 'string'
            ? (nodeAttrs as any).required === 'true'
            : !!(nodeAttrs as any).required,
          // Normalize individual enabled attributes (handle both boolean and string "true"/"false")
          streetEnabled: (() => {
            const val = (nodeAttrs as any).streetEnabled;
            if (val === undefined || val === null) return true;
            return typeof val === 'string' ? val === 'true' : !!val;
          })(),
          apartmentEnabled: (() => {
            const val = (nodeAttrs as any).apartmentEnabled;
            if (val === undefined || val === null) return true;
            return typeof val === 'string' ? val === 'true' : !!val;
          })(),
          cityEnabled: (() => {
            const val = (nodeAttrs as any).cityEnabled;
            if (val === undefined || val === null) return true;
            return typeof val === 'string' ? val === 'true' : !!val;
          })(),
          stateEnabled: (() => {
            const val = (nodeAttrs as any).stateEnabled;
            if (val === undefined || val === null) return true;
            return typeof val === 'string' ? val === 'true' : !!val;
          })(),
          postalCodeEnabled: (() => {
            const val = (nodeAttrs as any).postalCodeEnabled;
            if (val === undefined || val === null) return true;
            return typeof val === 'string' ? val === 'true' : !!val;
          })(),
          countryEnabled: (() => {
            const val = (nodeAttrs as any).countryEnabled;
            if (val === undefined || val === null) return true;
            return typeof val === 'string' ? val === 'true' : !!val;
          })(),
        }}
        onFinish={(values) => {
          // Ensure required is a boolean (not undefined)
          const requiredValue = values.required !== undefined 
            ? (typeof values.required === 'string' ? values.required === 'true' : !!values.required)
            : false;
          
          // Ensure all enabled attributes are booleans
          const normalizeBool = (value: any, defaultValue: boolean = true): boolean => {
            if (value === undefined || value === null) return defaultValue;
            if (typeof value === 'string') return value === 'true';
            return !!value;
          };
          
          onSave({
            ...values,
            required: requiredValue,
            streetEnabled: normalizeBool(values.streetEnabled, true),
            apartmentEnabled: normalizeBool(values.apartmentEnabled, true),
            cityEnabled: normalizeBool(values.cityEnabled, true),
            stateEnabled: normalizeBool(values.stateEnabled, true),
            postalCodeEnabled: normalizeBool(values.postalCodeEnabled, true),
            countryEnabled: normalizeBool(values.countryEnabled, true),
          });
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* Basic Settings */}
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Form.Item name="required" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Checkbox>Field is required</Checkbox>
            </Form.Item>

            <Form.Item
              name="approvalRequired"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
              label=""
            >
              <Checkbox>Approval required before this value is accepted</Checkbox>
            </Form.Item>

            {/* <Form.Item name="mapEnabled" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Checkbox>Enable map picker</Checkbox>
            </Form.Item> */}
          </Space>

          <Divider style={{ margin: '8px 0' }} />

          {/* Enable/Disable Address Fields */}
          <Form.Item 
            label={<Text strong style={{ fontSize: 13 }}>Enable/Disable Address Fields</Text>}
            style={{ marginBottom: 0 }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Form.Item name="streetEnabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Checkbox>Street Address</Checkbox>
              </Form.Item>
              <Form.Item name="apartmentEnabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Checkbox>Apartment, suite, etc.</Checkbox>
              </Form.Item>
              <Form.Item name="cityEnabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Checkbox>City</Checkbox>
              </Form.Item>
              <Form.Item name="stateEnabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Checkbox>State / Province</Checkbox>
              </Form.Item>
              <Form.Item name="postalCodeEnabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Checkbox>ZIP / Postal code</Checkbox>
              </Form.Item>
              <Form.Item name="countryEnabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Checkbox>Country</Checkbox>
              </Form.Item>
            </Space>
          </Form.Item>

          <Divider style={{ margin: '8px 0' }} />

          {/* Query Parameter */}
          <Form.Item
            name="queryParam"
            label={<Text strong style={{ fontSize: 13 }}>Query Parameter (optional)</Text>}
            tooltip="Pre-populate this field from URL query parameter. Can be JSON object or formatted string. Example: ?address={&quot;street&quot;:&quot;123 Main&quot;,&quot;city&quot;:&quot;NYC&quot;}"
            style={{ marginBottom: 0 }}
          >
            <Input placeholder="e.g. address, location" size="small" />
          </Form.Item>

          {/* Field Visibility */}
          <Form.Item 
            label={<Text strong style={{ fontSize: 13 }}>Field Visibility</Text>}
            style={{ marginBottom: 0 }}
          >
            <Space.Compact style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12, lineHeight: '32px' }}>Show/Hide this field if</Text>
              <Form.Item name={['visibility', 'match']} noStyle initialValue="all" style={{ margin: 0 }}>
                <Select size="small" style={{ width: 100, marginLeft: 8, marginRight: 8 }}>
                  <Option value="all">All</Option>
                  <Option value="any">Any</Option>
                </Select>
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12, lineHeight: '32px' }}>of the following rules match:</Text>
            </Space.Compact>
            <Form.List name={['visibility', 'rules']}>
              {(fields, { add, remove }) => (
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {fields.map((field) => (
                    <Space.Compact key={field.key} style={{ width: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 12, lineHeight: '32px', marginRight: 8 }}>if</Text>
                      <Form.Item
                        {...field}
                        name={[field.name, 'field']}
                        rules={[{ required: true, message: 'Field name required' }]}
                        style={{ margin: 0, flex: 1 }}
                      >
                        <Input placeholder="Form Field (name)" size="small" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'operator']}
                        rules={[{ required: true, message: 'Operator required' }]}
                        initialValue="is"
                        style={{ margin: 0, width: 150 }}
                      >
                        <Select size="small">
                          <Option value="is">is</Option>
                          <Option value="is_not">is not</Option>
                          <Option value="contains">Contains</Option>
                          <Option value="does_not_contain">Does not Contain</Option>
                          <Option value="starts_with">starts with</Option>
                          <Option value="ends_with">ends with</Option>
                          <Option value="regex">regex</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'value']} style={{ margin: 0, flex: 1 }}>
                        <Input placeholder="Value (empty for null/empty check)" size="small" />
                      </Form.Item>
                      <Button 
                        danger 
                        size="small" 
                        onClick={() => remove(field.name)}
                        style={{ minWidth: 60 }}
                      >
                        Remove
                      </Button>
                    </Space.Compact>
                  ))}
                  <Button
                    type="dashed"
                    size="small"
                    onClick={() => add({ field: '', operator: 'is', value: '' })}
                    block
                  >
                    Add Rule
                  </Button>
                </Space>
              )}
            </Form.List>
          </Form.Item>

          {/* Map Preview */}
          {mapEnabled && (
            <div 
              id="map-container-wrapper"
              style={{ height: 200, borderRadius: 6, overflow: 'hidden', border: '1px solid #d9d9d9', position: 'relative', minHeight: 200 }}
            >
              {open && mapReady ? (
                <MapLeafletWrapper
                  key={`map-${lat ?? nodeAttrs.lat ?? 'null'}-${lng ?? nodeAttrs.lng ?? 'null'}`}
                  initialLat={lat ?? nodeAttrs.lat ?? null}
                  initialLng={lng ?? nodeAttrs.lng ?? null}
                  onSelect={(p: { lat: number; lng: number }) => {
                    form.setFieldsValue({ lat: p.lat, lng: p.lng });
                  }}
                />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
                  <div style={{ fontSize: 12, color: '#666' }}>Loading map…</div>
                </div>
              )}
            </div>
          )}

          {/* <Form.Item name="tags" label="Tags">
            <TagSelector placeholder="Select tags for this field" />
          </Form.Item> */}
        </Space>
      </Form>
    </Modal>
  );
};

export default AddressEditModal;
