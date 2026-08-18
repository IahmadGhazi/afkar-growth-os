/* The Supabase free tier pauses a project after 7 days of low activity.
   A paused project takes down the whole app with no error message
   anywhere - the only symptom is that nothing works. This scheduled Worker
   pings the project every 15 minutes, which counts as activity, so the
   pause never triggers. ~96 requests/day, well inside every free tier. */
export default {
  async scheduled(_controller: unknown, env: { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string }, _ctx: unknown) {
    const base = env.SUPABASE_URL;
    if (!base) {
      console.warn("keeper: SUPABASE_URL unset - nothing to ping");
      return;
    }
    /* The anon key (public by design) turns the pings into real 200s;
       without it they are 401s - still activity, but ugly. */
    const headers = env.SUPABASE_ANON_KEY ? { apikey: env.SUPABASE_ANON_KEY } : {};
    const results: string[] = [];
    for (const path of ["/auth/v1/health", "/rest/v1/"]) {
      try {
        const res = await fetch(base + path, { headers });
        results.push(`${path} -> ${res.status}`);
      } catch (err) {
        results.push(`${path} -> FAILED ${(err as Error).message}`);
      }
    }
    console.log(`keeper: ${results.join(", ")}`);
  },
};
