(function () {
  "use strict";
  var env = window.SportsGrowEnv || { api: false, redirectOn401: false };
  async function request(path, options) {
    var config = options || {};
    var response = await fetch("/api" + path, {
      method: config.method || "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: Object.assign({ "Content-Type": "application/json", "X-SportsGrow-Client": "1" }, config.headers || {}),
      body: config.body === undefined ? undefined : JSON.stringify(config.body)
    });
    var data = response.status === 204 ? null : await response.json().catch(function () { return null; });
    if (response.status === 401 && config.redirectOn401 !== false && env.redirectOn401 !== false && path !== "/auth/login") {
      window.location.href = "login.html";
      throw new Error("unauthenticated");
    }
    if (!response.ok) {
      var error = new Error(data && data.message || "요청을 처리하지 못했습니다.");
      error.status = response.status;
      error.code = data && data.error;
      throw error;
    }
    return data;
  }
  window.SportsGrowApi = { enabled: env.api === true, request: request };
})();
