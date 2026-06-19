import React from 'react';
import { Space, Typography, theme } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface AddressData {
  street?: string;
  apartment?: string;
  city?: string;
  state?: string;
  postalCode?: string | number;
  country?: string;
  formatted?: string;
  lat?: number;
  lng?: number;
}

interface AddressAnswerRendererProps {
  addressData: AddressData | string | null | undefined;
  className?: string;
}

/**
 * AddressAnswerRenderer - Displays address answers in a user-friendly format
 */
export const AddressAnswerRenderer: React.FC<AddressAnswerRendererProps> = ({
  addressData,
  className = '',
}) => {
  const { token } = theme.useToken();

  if (!addressData) {
    return (
      <Text type="secondary" italic style={{ fontSize: '14px' }}>
        No address provided
      </Text>
    );
  }

  // Parse addressData if it's a string
  let address: AddressData;
  if (typeof addressData === 'string') {
    try {
      address = JSON.parse(addressData);
    } catch {
      // If parsing fails, treat as formatted string
      return (
        <div className={`address-answer-renderer ${className}`}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text style={{ fontSize: '14px' }}>{addressData}</Text>
          </Space>
        </div>
      );
    }
  } else {
    address = addressData;
  }

  // Extract address components
  const street = address.street?.trim();
  const apartment = address.apartment?.trim();
  const city = address.city?.trim();
  const state = address.state?.trim();
  const postalCode = address.postalCode ? String(address.postalCode).trim() : '';
  const country = address.country?.trim();
  const formatted = address.formatted?.trim();
  const hasCoordinates = address.lat != null && address.lng != null;

  // Build address lines
  const addressLines: string[] = [];
  
  // Line 1: Street address
  if (street) {
    addressLines.push(street);
  }
  
  // Line 2: City, State PostalCode
  const cityStateLine: string[] = [];
  if (city) cityStateLine.push(city);
  if (state) cityStateLine.push(state);
  if (postalCode) cityStateLine.push(postalCode);
  
  if (cityStateLine.length > 0) {
    addressLines.push(cityStateLine.join(', '));
  }
  
  // Line 3: Country
  if (country) {
    addressLines.push(country);
  }

  // If we have a formatted address and no individual components, use formatted
  if (formatted && addressLines.length === 0) {
    addressLines.push(formatted);
  }

  if (addressLines.length === 0) {
    return (
      <Text type="secondary" italic style={{ fontSize: '14px' }}>
        No address provided
      </Text>
    );
  }

  return (
    <div className={`address-answer-renderer ${className}`}>
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        {/* Main address lines */}
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          {addressLines.map((line, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {index === 0 && (
                <EnvironmentOutlined 
                  style={{ 
                    color: token.colorPrimary, 
                    fontSize: '14px',
                    marginTop: '2px',
                    flexShrink: 0
                  }} 
                />
              )}
              {index > 0 && <div style={{ width: '22px', flexShrink: 0 }} />}
              <Text style={{ fontSize: '14px', lineHeight: '1.5' }}>{line}</Text>
            </div>
          ))}
        </Space>

        {/* Apartment/Unit info (if exists, show as secondary) */}
        {apartment && (
          <Text type="secondary" style={{ fontSize: '12px', marginLeft: '22px' }}>
            Unit: {apartment}
          </Text>
        )}

        {/* Coordinates (if available) */}
        {hasCoordinates && (
          <Text type="secondary" style={{ fontSize: '11px', marginLeft: '22px' }}>
            Coordinates: {address.lat?.toFixed(6)}, {address.lng?.toFixed(6)}
          </Text>
        )}
      </Space>
    </div>
  );
};
