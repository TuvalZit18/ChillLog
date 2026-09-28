// The registry: loggers (GET /api/loggers, every logger with the fridge it is in now) and
// branches (GET /api/branches, A–Z with their fridges), and the forms that change them.
// Used by the Loggers screens, the upload screen ("Which logger is this file from?") and the
// inspector's filters. Each change invalidates the screens built from it (architecture §9).

import { api } from '../../app/api.js';

// A new or changed logger can process files that were waiting for it, so readings change too.
const AFTER_LOGGER_CHANGE = ['Loggers', 'Uploads', 'Overview', 'Fridge', 'Inspector'];
// A new branch or fridge appears on the overview (as "No file") and in every branch list.
const AFTER_BRANCH_CHANGE = ['Branches', 'Overview', 'Inspector'];

const loggersApi = api
  .enhanceEndpoints({
    addTagTypes: ['Loggers', 'Branches', 'Uploads', 'Overview', 'Fridge', 'Inspector'],
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getLoggers: build.query({
        query: () => 'loggers',
        providesTags: ['Loggers'],
      }),
      getBranches: build.query({
        query: () => 'branches',
        providesTags: ['Branches'],
      }),
      addLogger: build.mutation({
        query: (body) => ({ url: 'loggers', method: 'POST', body }),
        invalidatesTags: AFTER_LOGGER_CHANGE,
      }),
      addBranch: build.mutation({
        query: (body) => ({ url: 'branches', method: 'POST', body }),
        invalidatesTags: AFTER_BRANCH_CHANGE,
      }),
      addFridge: build.mutation({
        query: (body) => ({ url: 'fridges', method: 'POST', body }),
        invalidatesTags: AFTER_BRANCH_CHANGE,
      }),
    }),
  });

export const {
  useGetLoggersQuery,
  useGetBranchesQuery,
  useAddLoggerMutation,
  useAddBranchMutation,
  useAddFridgeMutation,
} = loggersApi;
