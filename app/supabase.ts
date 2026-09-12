export const supabase = {
  from: () => ({
    select: async () => ({ data: [], error: null })
  }),
  auth: {
    getUser: async () => ({ data: { user: null }, error: null })
  }
};
