// One RTK Query API for the whole app. Each feature adds its endpoints with api.injectEndpoints,
// and a successful upload invalidates the tags that depend on readings (architecture §9).

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  refetchOnReconnect: true,
  endpoints: () => ({}),
});
