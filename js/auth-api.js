(function () {
  "use strict";
  var api = window.SportsGrowApi;
  var env = window.SportsGrowEnv || {};
  var current = null;
  var roles = { athlete: "student.html", guardian: "student.html", coach: "coach.html", org_admin: "academy.html" };
  var allowed = { athlete: ["student.html"], guardian: ["student.html"], coach: ["coach.html", "student.html"], org_admin: ["academy.html"] };
  function operationsPage() {
    if (env.operationsUrl) return String(env.operationsUrl).replace(/\/$/, "") + "/admin-login.html";
    return window.location.pathname.endsWith("/admin-login.html") ? "admin.html" : "";
  }
  function destination(role, requested) {
    return allowed[role] && allowed[role].indexOf(requested) !== -1 ? requested : roles[role] || "login.html";
  }
  async function me() {
    if (current) return current;
    current = await api.request("/me", { redirectOn401: false });
    return current;
  }
  async function selectMembership(membership, requested) {
    await api.request("/session/active-membership", { method: "POST", body: { membershipId: membership.id }, redirectOn401: false });
    if (current) current.activeMembershipId = membership.id;
    window.location.href = destination(membership.role, requested);
  }
  async function login(email, password, requested, adminOnly) {
    current = await api.request("/auth/login", { method: "POST", body: { email: email, password: password }, redirectOn401: false });
    var memberships = current.memberships || [];
    var isPlatformStaff = current.platformStaff === true || !!(current.user && current.user.platformStaff);
    if (adminOnly && !isPlatformStaff) {
      await api.request("/auth/logout", { method: "POST", redirectOn401: false });
      current = null;
      throw new Error("운영자 계정만 로그인할 수 있습니다.");
    }
    if (adminOnly && isPlatformStaff) {
      window.location.href = "admin.html";
      return;
    }
    if (memberships.length === 1) {
      await selectMembership(memberships[0], requested);
    } else if (memberships.length > 1) {
      var query = requested && /^[A-Za-z0-9._-]+\.html$/.test(requested) ? "?next=" + encodeURIComponent(requested) : "";
      window.location.href = "pick-role.html" + query;
    } else if (isPlatformStaff) {
      window.location.href = operationsPage() || "admin.html";
    } else {
      await api.request("/auth/logout", { method: "POST", redirectOn401: false });
      current = null;
      throw new Error("연결된 소속을 찾을 수 없습니다.");
    }
  }
  async function logout() {
    await api.request("/auth/logout", { method: "POST", redirectOn401: false });
    current = null;
    window.location.href = "login.html";
  }
  window.SportsGrowAuthApi = { enabled: api.enabled && env.api === true, me: me, login: login, selectMembership: selectMembership, logout: logout, destination: destination, operationsPage: operationsPage };
})();
