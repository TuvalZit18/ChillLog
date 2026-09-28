// GET /api/fridges/:id?from=&to=: one fridge over a range (chart data, time above 5°C, gaps).
// The cache key is the stable { id, range }; a preset's dates are worked out when it's fetched.
// Tagged 'Fridge' so a successful upload can invalidate it (architecture §9).

import { api } from '../../app/api.js';
import { rangeQuery } from './rangeModel.js';

const fridgeApi = api.enhanceEndpoints({ addTagTypes: ['Fridge'] }).injectEndpoints({
  endpoints: (build) => ({
    getFridge: build.query({
      query: ({ id, range }) => ({
        url: `fridges/${id}`,
        params: rangeQuery(range, new Date()).query,
      }),
      providesTags: (result, error, { id }) => [{ type: 'Fridge', id }],
    }),
  }),
});

export const { useGetFridgeQuery } = fridgeApi;
