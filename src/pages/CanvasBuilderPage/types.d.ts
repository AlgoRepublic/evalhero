import '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    shortText: {
      /**
       * Insert a ShortText node into the editor
       */
      insertShortText: (attrs?: Record<string, unknown>) => ReturnType;
      insertLongText: (attrs?: Record<string, unknown>) => ReturnType;
      insertRichText: (attrs?: Record<string, unknown>) => ReturnType;
      insertSingleChoice: (attrs?: Record<string, unknown>) => ReturnType;
      insertMultipleChoice: (attrs?: Record<string, unknown>) => ReturnType;
      insertYesNo: (attrs?: Record<string, unknown>) => ReturnType;
      insertDropdown: (attrs?: Record<string, unknown>) => ReturnType;
      insertEmail: (attrs?: Record<string, unknown>) => ReturnType;
      insertPhone: (attrs?: Record<string, unknown>) => ReturnType;
      insertDate: (attrs?: Record<string, unknown>) => ReturnType;
      insertNumber: (attrs?: Record<string, unknown>) => ReturnType;
      insertRating: (attrs?: Record<string, unknown>) => ReturnType;
      insertFileUpload: (attrs?: Record<string, unknown>) => ReturnType; 
      setImage: (attrs?: Record<string, unknown>) => ReturnType;
      insertRanking: (attrs?: Record<string, unknown>) => ReturnType;
      insertNumberField: (attrs?: Record<string, unknown>) => ReturnType;
      insertSliderField: (attrs?: Record<string, unknown>) => ReturnType;
      insertRatingField: (attrs?: Record<string, unknown>) => ReturnType;
      insertDateField: (attrs?: Record<string, unknown>) => ReturnType;
      insertDateTimeField: (attrs?: Record<string, unknown>) => ReturnType;
      insertFileField: (attrs?: Record<string, unknown>) => ReturnType;
      insertSignature: (attrs?: Record<string, unknown>) => ReturnType;
      insertComputed: (attrs?: Record<string, unknown>) => ReturnType;
      // insertHidden: (attrs?: Record<string, unknown>) => ReturnType;
      insertAddress: (attrs?: Record<string, unknown>) => ReturnType;
      insertLookup: (attrs?: Record<string, unknown>) => ReturnType;
      insertMatrix: (attrs?: Record<string, unknown>) => ReturnType;
    };
  }
}
