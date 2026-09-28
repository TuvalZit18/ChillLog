// The registry: GET /api/loggers (every logger with the fridge it is in now) and GET
// /api/branches (branches A–Z with their fridges). Used by the upload screen ("Which logger is
// this file from?") and the inspector's filters.

import { api } from '../../app/api.js';

const loggersApi = api.enhanceEndpoints({ addTagTypes: ['Loggers', 'Branches'] }).injectEndpoints({
  endpoints: (build) => ({
    getLoggers: build.query({
      query: () => 'loggers',
      providesTags: ['Loggers'],
    }),
    getBranches: build.query({
      query: () => 'branches',
      providesTags: ['Branches'],
    }),
  }),
});

export const { useGetLoggersQuery, useGetBranchesQuery } = loggersApi;
