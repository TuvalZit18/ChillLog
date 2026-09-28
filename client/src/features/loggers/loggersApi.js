// GET /api/loggers: every logger with the fridge it is in now. Used by the upload screen (which
// fridge a file belongs to, "Which logger is this file from?"); the Loggers screen adds more.

import { api } from '../../app/api.js';

const loggersApi = api.enhanceEndpoints({ addTagTypes: ['Loggers'] }).injectEndpoints({
  endpoints: (build) => ({
    getLoggers: build.query({
      query: () => 'loggers',
      providesTags: ['Loggers'],
    }),
  }),
});

export const { useGetLoggersQuery } = loggersApi;
