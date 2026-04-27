import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseQuery = fetchBaseQuery({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
});

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Documents', 'ChatHistory'],
  endpoints: (builder) => ({
    // Document endpoints
    uploadPDF: builder.mutation({
      query: (formData) => ({
        url: '/upload',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Documents'],
    }),

    getDocuments: builder.query({
      query: () => '/documents',
      providesTags: ['Documents'],
    }),

    getDocument: builder.query({
      query: (id) => `/documents/${id}`,
      providesTags: (result, error, id) => [{ type: 'Documents', id }],
    }),

    deleteDocument: builder.mutation({
      query: (id) => ({
        url: `/documents/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Documents', 'ChatHistory'],
    }),

    // Chat endpoints
    askQuestion: builder.mutation({
      query: ({ documentId, query }) => ({
        url: `/documents/${documentId}/ask`,
        method: 'POST',
        body: { query },
      }),
      invalidatesTags: (result, error, { documentId }) => [
        { type: 'ChatHistory', id: documentId },
      ],
    }),

    getChatHistory: builder.query({
      query: (documentId) => `/documents/${documentId}/chat-history`,
      providesTags: (result, error, documentId) => [
        { type: 'ChatHistory', id: documentId },
      ],
    }),

    // Tracing endpoints
    getTraces: builder.query({
      query: () => '/traces',
    }),

    getTraceByRequestId: builder.query({
      query: (requestId) => `/traces/${requestId}`,
    }),
  }),
});

export const {
  useUploadPDFMutation,
  useGetDocumentsQuery,
  useGetDocumentQuery,
  useDeleteDocumentMutation,
  useAskQuestionMutation,
  useGetChatHistoryQuery,
  useGetTracesQuery,
  useGetTraceByRequestIdQuery,
} = apiSlice;
