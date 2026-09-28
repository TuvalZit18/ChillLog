// GET /api/overview: every fridge's status for the last full week, worst first.
// Tagged 'Overview' so a successful upload can invalidate it (architecture §9).

import { api } from '../../app/api.js';

const overviewApi = api.enhanceEndpoints({ addTagTypes: ['Overview'] }).injectEndpoints({
  endpoints: (build) => ({
    getOverview: build.query({
      query: () => 'overview',
      providesTags: ['Overview'],
    }),
  }),
});

export const { useGetOverviewQuery } = overviewApi;
