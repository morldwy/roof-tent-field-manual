(function initializeRoofTentBackend() {
  let client;
  let sessionPromise;

  function getClient() {
    if (client) return client;
    if (!window.supabase || !window.SUPABASE_CONFIG) {
      throw new Error("Supabase client configuration is unavailable");
    }
    client = window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.publishableKey
    );
    return client;
  }

  async function ensureAnonymousSession() {
    if (sessionPromise) return sessionPromise;
    sessionPromise = (async () => {
      const backend = getClient();
      const { data: sessionData, error: sessionError } = await backend.auth.getSession();
      if (sessionError) throw sessionError;
      if (sessionData.session) return sessionData.session;
      const { data, error } = await backend.auth.signInAnonymously();
      if (error) throw error;
      return data.session;
    })().catch(error => {
      sessionPromise = undefined;
      throw error;
    });
    return sessionPromise;
  }

  window.ROOF_TENT_BACKEND = {
    get client() {
      return getClient();
    },
    ensureAnonymousSession
  };
})();
