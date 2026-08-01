/* DRAPE — Supabase auth layer (client).
   Loads the Supabase JS SDK on demand and exposes window.DRAPE_AUTH.
   No-op (configured()===false) until supabase-config.js holds real values,
   so the site keeps working in open mode until you wire Supabase. */
window.DRAPE_AUTH = (function () {
  var cfg = window.DRAPE_SUPABASE || {};
  var client = null, ready = null, listeners = [];
  var state = { user: null, token: null };

  function configured() {
    return !!(cfg.url && cfg.anonKey && cfg.url.indexOf('YOUR-') === -1 && cfg.anonKey.indexOf('YOUR-') === -1);
  }
  function emit() { listeners.forEach(function (f) { try { f(state); } catch (e) {} }); }
  function setSession(session) {
    var u = (session && session.user) || null;
    if (u) {
      var md = u.user_metadata || {};
      var named = !!(md.display_name || md.full_name || md.name);
      var name = md.display_name || md.full_name || md.name || (u.email ? u.email.split('@')[0] : 'you');
      state.user = { id: u.id, email: u.email, name: name, named: named };
    } else { state.user = null; }
    state.token = session ? session.access_token : null;
    emit();
  }
  async function getClient() {
    if (client) return client;
    if (!configured()) return null;
    if (!ready) {
      ready = import('https://esm.sh/@supabase/supabase-js@2').then(function (m) {
        // implicit flow: magic links return #access_token and don't need the PKCE code
        // verifier, so they work when the email opens the link in a different browser/tab.
        client = m.createClient(cfg.url, cfg.anonKey, {
          auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
        });
        client.auth.onAuthStateChange(function (_e, session) { setSession(session); });
        return client.auth.getSession().then(function (r) { setSession(r.data.session); return client; });
      }).catch(function (e) { console.warn('Supabase SDK load failed', e); return null; });
    }
    return ready;
  }

  return {
    configured: configured,
    init: getClient,
    user: function () { return state.user; },
    token: function () { return state.token; },
    onChange: function (f) { listeners.push(f); f(state); },
    signInEmail: async function (email) {
      var c = await getClient(); if (!c) throw new Error('auth not configured');
      return c.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + location.pathname } });
    },
    // Cross-device sign-in: the emailed 6-digit code is typed back into THIS page, so the
    // session is created here (the computer) even when the email is read on a phone.
    verifyEmailCode: async function (email, code) {
      var c = await getClient(); if (!c) throw new Error('auth not configured');
      var r = await c.auth.verifyOtp({ email: email, token: code, type: 'email' });
      if (r && r.error) throw r.error;
      return r;
    },
    signInGoogle: async function () {
      var c = await getClient(); if (!c) throw new Error('auth not configured');
      return c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    },
    setName: async function (name) {
      var c = await getClient(); if (!c) throw new Error('auth not configured');
      var r = await c.auth.updateUser({ data: { display_name: name } });
      try { var s = await c.auth.getSession(); setSession(s.data.session); } catch (e) {}
      return r;
    },
    signOut: async function () { var c = await getClient(); if (c) await c.auth.signOut(); }
  };
})();
