// Upload endpoints: send files, list earlier uploads, try a held-back file again.
// Anything that adds readings invalidates the screens built from them (architecture §9), so the
// overview and fridge pages are never stale after an upload.

import { api } from '../../app/api.js';

const READING_TAGS = ['Uploads', 'Overview', 'Fridge', 'Inspector'];

const uploadApi = api.enhanceEndpoints({ addTagTypes: READING_TAGS }).injectEndpoints({
  endpoints: (build) => ({
    getUploads: build.query({
      query: () => 'uploads',
      providesTags: ['Uploads'],
    }),
    uploadFiles: build.mutation({
      query: (files) => {
        const body = new FormData();
        for (const file of files) body.append('files', file);
        return { url: 'uploads', method: 'POST', body };
      },
      invalidatesTags: READING_TAGS,
    }),
    getUploadPreview: build.query({
      query: (uploadId) => `uploads/${uploadId}/preview`,
    }),
    assignUpload: build.mutation({
      query: ({ uploadId, loggerId }) => ({
        url: `uploads/${uploadId}/assign`,
        method: 'POST',
        body: { loggerId },
      }),
      invalidatesTags: READING_TAGS,
    }),
    retryUpload: build.mutation({
      query: (uploadId) => ({ url: `uploads/${uploadId}/retry`, method: 'POST' }),
      invalidatesTags: READING_TAGS,
    }),
  }),
});

export const {
  useGetUploadsQuery,
  useUploadFilesMutation,
  useRetryUploadMutation,
  useGetUploadPreviewQuery,
  useAssignUploadMutation,
} = uploadApi;
