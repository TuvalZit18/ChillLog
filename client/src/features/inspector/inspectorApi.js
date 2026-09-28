// GET /api/inspector: time above 5°C for all fridges, a branch or one fridge, over a range.
// Tagged 'Inspector' so a successful upload refreshes it (architecture §9).

import { api } from '../../app/api.js';

const inspectorApi = api.enhanceEndpoints({ addTagTypes: ['Inspector'] }).injectEndpoints({
  endpoints: (build) => ({
    getInspector: build.query({
      query: (params) => ({ url: 'inspector', params }),
      providesTags: ['Inspector'],
    }),
  }),
});

export const { useGetInspectorQuery } = inspectorApi;
