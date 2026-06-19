import React, { useMemo } from 'react';
import { Select, Tag as AntTag } from 'antd';
import { useGetTagsQuery } from '../../../../services/tagsApi';

const { Option } = Select;

interface TagSelectorProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  value = [],
  onChange,
  placeholder = 'Select tags',
}) => {
  // Fetch all tags with pagination - get a reasonable number
  const { data: tagsResponse, isLoading } = useGetTagsQuery({
    page: 1,
    perPage: 1000, // Get a large number of tags
    sortBy: 'name',
    order: 'asc',
  });

  const tags = useMemo(() => {
    return tagsResponse?.data?.tags?.records || [];
  }, [tagsResponse]);

  const handleChange = (selectedTagIds: string[]) => {
    onChange?.(selectedTagIds || []);
  };

  return (
    <Select
      mode="multiple"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      loading={isLoading}
      allowClear
      showSearch
      filterOption={(input, option) => {
        const tag = tags.find((t) => t._id === option?.value);
        return tag?.name?.toLowerCase().includes(input.toLowerCase()) || false;
      }}
      style={{ width: '100%' }}
      tagRender={(props) => {
        const { label, value: tagId, closable, onClose } = props;
        const tag = tags.find((t) => t._id === tagId);
        return (
          <AntTag
            color="blue"
            closable={closable}
            onClose={onClose}
            style={{ marginRight: 3 }}
          >
            {tag?.name || label}
          </AntTag>
        );
      }}
    >
      {tags.map((tag) => (
        <Option key={tag._id} value={tag._id}>
          {tag.name}
        </Option>
      ))}
    </Select>
  );
};

export default TagSelector;

