// Data layer for the ALLXAI beta pages.
// Uses Supabase when beta/config.js is filled in, otherwise a local preview
// mode that keeps everything in this browser's localStorage.
(function () {
  "use strict";

  var cfg = window.ALLXAI_CONFIG || {};
  var live = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  var sb = live ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  var FREE_LIMIT = 1;

  function friendly(err) {
    var msg = (err && err.message) || String(err);
    if (/Invalid login credentials/i.test(msg)) return "Email or password is incorrect.";
    if (/Email not confirmed/i.test(msg)) return "Confirm your email first. Check your inbox for the link.";
    if (/already registered|already exists/i.test(msg)) return "An account with this email already exists. Sign in instead.";
    if (/Password should be/i.test(msg)) return "Use a password with at least 8 characters.";
    if (/row-level security|violates row level/i.test(msg)) return "FREE_LIMIT";
    return msg;
  }

  function wrap(p) {
    return p.catch(function (e) { throw new Error(friendly(e)); });
  }

  // ---------- local preview mode ----------
  function lsGet(k, d) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ }
  }
  function uid() {
    return "local-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function localUser() {
    var s = lsGet("ax_session", null);
    if (!s) return null;
    var users = lsGet("ax_users", {});
    return users[s.email] || null;
  }

  var local = {
    signUp: function (email, password, meta) {
      var users = lsGet("ax_users", {});
      if (users[email]) return Promise.reject(new Error(friendly("already exists")));
      if (password.length < 8) return Promise.reject(new Error(friendly("Password should be")));
      users[email] = {
        id: uid(), email: email, password: password,
        profile: { account_type: meta.account_type, business_name: meta.business_name || null, plan: "free" }
      };
      lsSet("ax_users", users);
      lsSet("ax_session", { email: email });
      return Promise.resolve({ needsConfirm: false });
    },
    signIn: function (email, password) {
      var u = lsGet("ax_users", {})[email];
      if (!u || u.password !== password) return Promise.reject(new Error(friendly("Invalid login credentials")));
      lsSet("ax_session", { email: email });
      return Promise.resolve();
    },
    signOut: function () { localStorage.removeItem("ax_session"); return Promise.resolve(); },
    resetPassword: function () { return Promise.resolve(); },
    session: function () {
      var u = localUser();
      return Promise.resolve(u ? { user: { id: u.id, email: u.email }, profile: u.profile } : null);
    },
    countRequests: function () {
      var u = localUser();
      return Promise.resolve(lsGet("ax_requests", []).filter(function (r) { return r.user_id === u.id; }).length);
    },
    saveRequest: function (row) {
      var u = localUser();
      var all = lsGet("ax_requests", []);
      var mine = all.filter(function (r) { return r.user_id === u.id; });
      if (u.profile.plan === "free" && mine.length >= FREE_LIMIT) return Promise.reject(new Error("FREE_LIMIT"));
      var rec = Object.assign({ id: uid(), user_id: u.id, created_at: new Date().toISOString() }, row);
      all.push(rec);
      lsSet("ax_requests", all);
      return Promise.resolve(rec.id);
    },
    listRequests: function () {
      var u = localUser();
      return Promise.resolve(lsGet("ax_requests", [])
        .filter(function (r) { return r.user_id === u.id; })
        .sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }));
    },
    choosePlan: function (plan) {
      var users = lsGet("ax_users", {});
      var s = lsGet("ax_session", null);
      users[s.email].profile.chosen_plan = plan;
      lsSet("ax_users", users);
      return Promise.resolve();
    },
    lastPlanChoice: function () {
      var u = localUser();
      return Promise.resolve(u && u.profile.chosen_plan || null);
    },
    listListings: function () {
      return Promise.resolve(lsGet("ax_listings", []));
    },
    getRequest: function (id) {
      var u = localUser();
      var r = lsGet("ax_requests", []).find(function (x) { return x.id === id && x.user_id === u.id; });
      return Promise.resolve(r || null);
    }
  };

  // ---------- Supabase mode ----------
  var remote = {
    signUp: function (email, password, meta) {
      var base = location.href.replace(/[^/]*([?#].*)?$/, "");
      return wrap(sb.auth.signUp({
        email: email, password: password,
        options: { data: meta, emailRedirectTo: base + "login.html" }
      }).then(function (res) {
        if (res.error) throw res.error;
        // An existing, confirmed email comes back with no identities.
        if (res.data.user && res.data.user.identities && res.data.user.identities.length === 0) {
          throw new Error("already exists");
        }
        return { needsConfirm: !res.data.session };
      }));
    },
    signIn: function (email, password) {
      return wrap(sb.auth.signInWithPassword({ email: email, password: password })
        .then(function (res) { if (res.error) throw res.error; }));
    },
    signOut: function () { return sb.auth.signOut(); },
    resetPassword: function (email) {
      var base = location.href.replace(/[^/]*([?#].*)?$/, "");
      return wrap(sb.auth.resetPasswordForEmail(email, { redirectTo: base + "login.html" })
        .then(function (res) { if (res.error) throw res.error; }));
    },
    session: function () {
      return sb.auth.getSession().then(function (res) {
        var s = res.data && res.data.session;
        if (!s) return null;
        return sb.from("profiles").select("account_type,business_name,plan").eq("id", s.user.id).maybeSingle()
          .then(function (p) {
            return {
              user: { id: s.user.id, email: s.user.email },
              profile: p.data || { account_type: "user", business_name: null, plan: "free" }
            };
          });
      });
    },
    countRequests: function () {
      return sb.from("requests").select("id", { count: "exact", head: true })
        .then(function (res) { if (res.error) throw res.error; return res.count || 0; });
    },
    saveRequest: function (row) {
      return wrap(sb.from("requests").insert(row).select("id").single()
        .then(function (res) { if (res.error) throw res.error; return res.data.id; }));
    },
    listRequests: function () {
      return sb.from("requests").select("id,problem,category,created_at").order("created_at", { ascending: false }).limit(20)
        .then(function (res) { if (res.error) throw res.error; return res.data; });
    },
    choosePlan: function (plan) {
      return wrap(sb.from("plan_choices").insert({ plan: plan })
        .then(function (res) { if (res.error) throw res.error; }));
    },
    lastPlanChoice: function () {
      return sb.from("plan_choices").select("plan").order("created_at", { ascending: false }).limit(1)
        .then(function (res) { return res.data && res.data[0] ? res.data[0].plan : null; });
    },
    listListings: function () {
      return sb.from("listings").select("business_name,sector,ops_accuracy").order("sort_order").order("business_name")
        .then(function (res) { if (res.error) throw res.error; return res.data; });
    },
    getRequest: function (id) {
      return sb.from("requests").select("*").eq("id", id).maybeSingle()
        .then(function (res) { if (res.error) throw res.error; return res.data; });
    }
  };

  var api = live ? remote : local;
  api.live = live;
  api.FREE_LIMIT = FREE_LIMIT;

  // Redirects to login when there is no session. Resolves with the session.
  api.requireSession = function () {
    return api.session().then(function (s) {
      if (!s) {
        var next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
        location.replace("login.html?next=" + next);
        return new Promise(function () {});
      }
      return s;
    });
  };

  window.AX = api;
})();
