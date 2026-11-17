(function () {
  "use strict";
  var api = window.SportsGrowApi;
  if (!api || !api.enabled) return;

  var pageRole = document.body.getAttribute("data-role");
  var page = window.location.pathname.split("/").pop() || "student.html";
  var rolePage = { athlete: "student.html", guardian: "student.html", coach: "coach.html", org_admin: "academy.html" };
  var roleLabel = { athlete: "선수", guardian: "보호자", coach: "코치", org_admin: "기관 관리자" };
  var root = document.createElement("main");
  root.className = "sg-api-shell";
  root.innerHTML = '<style>.sg-api-shell{min-height:100vh;padding:clamp(18px,4vw,48px);background:#f3f5f4;color:#14282b;font-family:inherit}.sg-api-wrap{max-width:1120px;margin:auto}.sg-api-head,.sg-api-card,.sg-api-panel{background:#fff;border:1px solid #dfe7e4;border-radius:18px;box-shadow:0 8px 28px #14282b0a}.sg-api-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 26px;margin-bottom:18px}.sg-api-head h1{margin:2px 0;font-size:clamp(1.35rem,4vw,2rem)}.sg-api-eyebrow,.sg-api-muted{color:#657572}.sg-api-eyebrow{font-size:.78rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.sg-api-layout{display:grid;grid-template-columns:minmax(220px,.7fr) minmax(0,1.5fr);gap:18px}.sg-api-panel,.sg-api-card{padding:20px}.sg-api-panel h2,.sg-api-card h2{margin:0 0 14px;font-size:1.1rem}.sg-api-list{display:grid;gap:9px}.sg-api-choice,.sg-api-button{border:1px solid #d7e0dc;border-radius:11px;background:white;color:#172b2e;padding:11px 13px;text-align:left;cursor:pointer}.sg-api-choice[aria-current=true]{border-color:#738b19;background:#f6f9e9}.sg-api-choice small{display:block;margin-top:3px;color:#657572}.sg-api-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:12px 0}.sg-api-stat{padding:13px;background:#f4f7f5;border-radius:12px}.sg-api-stat strong{display:block;font-size:1.35rem}.sg-api-record{padding:12px 0;border-top:1px solid #e8edeb}.sg-api-record:first-child{border-top:0}.sg-api-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.sg-api-form label{display:grid;gap:5px;color:#52615e;font-size:.88rem}.sg-api-form input,.sg-api-form select,.sg-api-form textarea{width:100%;min-height:42px;padding:9px 10px;border:1px solid #cfd9d5;border-radius:9px;background:#fff;color:#172b2e;font:inherit}.sg-api-form textarea,.sg-api-form .wide,.sg-api-form button{grid-column:1/-1}.sg-api-button{background:#14282b;color:#fff;text-align:center;font-weight:700}.sg-api-button:disabled,.sg-api-choice:disabled{opacity:.55;cursor:wait}.sg-api-alert{padding:12px 14px;background:#fff4e6;color:#784c13;border-radius:10px}.sg-api-actions{display:flex;flex-wrap:wrap;gap:8px}.sg-api-danger{color:#9b3026}.sg-api-status{min-height:1.5em}.sg-api-shell [hidden]{display:none!important}@media(max-width:720px){.sg-api-layout{grid-template-columns:1fr}.sg-api-head{align-items:flex-start;flex-direction:column}.sg-api-form{grid-template-columns:1fr}}</style><div class="sg-api-wrap"><header class="sg-api-head"><div><p class="sg-api-eyebrow">Sports Grow · API</p><h1 data-api-title>계정 확인 중</h1><p class="sg-api-muted" data-api-subtitle>서버 권한과 소속을 확인하고 있습니다.</p></div><button type="button" class="sg-api-button" data-api-logout>로그아웃</button></header><div class="sg-api-status" data-api-status role="status" aria-live="polite"></div><div data-api-content></div></div>';
  document.body.appendChild(root);
  var statusEl = root.querySelector("[data-api-status]");
  var content = root.querySelector("[data-api-content]");
  var title = root.querySelector("[data-api-title]");
  var subtitle = root.querySelector("[data-api-subtitle]");

  function text(tag, value, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value == null ? "" : String(value);
    return node;
  }
  function button(label, action, className) {
    var node = text("button", label, className || "sg-api-button");
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  }
  function card(heading) {
    var node = document.createElement("section");
    node.className = "sg-api-card";
    node.appendChild(text("h2", heading));
    return node;
  }
  function stat(label, value) {
    var node = document.createElement("div");
    node.className = "sg-api-stat";
    node.append(text("span", label, "sg-api-muted"), text("strong", value));
    return node;
  }
  function field(form, label, name, type, options) {
    var wrap = document.createElement("label");
    wrap.appendChild(text("span", label));
    var input;
    if (options) {
      input = document.createElement("select");
      options.forEach(function (option) { var item = document.createElement("option"); item.value = option[0]; item.textContent = option[1]; input.appendChild(item); });
    } else if (type === "textarea") input = document.createElement("textarea");
    else { input = document.createElement("input"); input.type = type || "text"; }
    input.name = name;
    input.required = true;
    wrap.appendChild(input);
    form.appendChild(wrap);
    return input;
  }
  function showError(error) {
    statusEl.textContent = error && error.message || "요청을 처리하지 못했습니다.";
    statusEl.className = "sg-api-status sg-api-alert";
  }
  function clearStatus(message) {
    statusEl.textContent = message || "";
    statusEl.className = "sg-api-status";
  }
  function dateValue(value) { return String(value || "").slice(0, 10); }
  function formatAverage(value) { return value == null ? "—" : Number(value).toFixed(3).replace(/^0/, ""); }
  function setPage(role, requested) {
    var target = rolePage[role] || (role === "platform_staff" ? "admin.html" : "login.html");
    if (role === "coach" && requested === "student.html") target = requested;
    if (target !== page) window.location.replace(target);
  }

  async function loadOps(me) {
    content.replaceChildren();
    title.textContent = "운영 콘솔";
    subtitle.textContent = me.user.name + " · 사이트 운영자";
    var results = await Promise.all([api.request("/ops/orgs"), api.request("/ops/tickets"), api.request("/ops/notices"), api.request("/ops/audit?limit=30"), api.request("/status"), api.request("/ops/invoices?status=due"), api.request("/ops/invoices?status=paid")]);
    var orgs = results[0].orgs || [];
    var tickets = results[1].tickets || [];
    var notices = results[2].notices || [];
    var events = results[3].events || [];
    var status = results[4];
    var invoices = results[5].invoices || [];
    var paidInvoices = results[6].invoices || [];
    var grid = document.createElement("div"); grid.className = "sg-api-grid";
    grid.append(stat("기관", orgs.length), stat("열린 문의", tickets.filter(function (x) { return x.status === "open"; }).length), stat("공지", notices.length), stat("점검 모드", status.maintenance ? "켜짐" : "꺼짐"));
    var orgCard = card("기관");
    orgs.forEach(function (org) { var row = text("div", org.name + " · 선수 " + org.athletes_count + "명 · " + (org.subscription_status || "구독 없음"), "sg-api-record"); orgCard.appendChild(row); });
    var ticketCard = card("최근 문의");
    tickets.slice(0, 20).forEach(function (ticket) {
      var row = document.createElement("div"); row.className = "sg-api-record";
      row.append(text("strong", ticket.title), text("p", ticket.body), text("small", ticket.status + " · " + ticket.category, "sg-api-muted"));
      [ ["in_progress", "처리 중"], ["resolved", "완료"] ].forEach(function (choice) {
        if (ticket.status === choice[0]) return;
        row.appendChild(button(choice[1], async function (event) {
          var trigger = event.currentTarget; trigger.disabled = true;
          try { await api.request("/ops/tickets/" + encodeURIComponent(ticket.id), { method: "PATCH", body: { status: choice[0] } }); await loadOps(me); }
          catch (error) { showError(error); trigger.disabled = false; }
        }));
      });
      ticketCard.appendChild(row);
    });
    var noticeCard = card("공지");
    notices.slice(0, 10).forEach(function (notice) { noticeCard.appendChild(text("div", notice.title + " · " + notice.status, "sg-api-record")); });
    var auditCard = card("최근 감사 기록");
    events.forEach(function (event) { auditCard.appendChild(text("div", event.action + " · " + dateValue(event.at), "sg-api-record")); });
    var settings = card("사이트 설정");
    var form = document.createElement("form"); form.className = "sg-api-form";
    var maintenance = field(form, "점검 모드", "maintenance", "select", [["false", "꺼짐"], ["true", "켜짐"]]); maintenance.value = String(status.maintenance);
    field(form, "안내 문구", "message", "text").value = status.message || "";
    field(form, "지원 이메일", "supportEmail", "email").value = status.supportEmail || "";
    var submit = text("button", "설정 저장", "sg-api-button"); submit.type = "submit"; form.appendChild(submit);
    form.addEventListener("submit", async function (event) { event.preventDefault(); submit.disabled = true; try { await api.request("/ops/settings", { method: "PUT", body: { maintenance: maintenance.value === "true", message: form.elements.message.value, supportEmail: form.elements.supportEmail.value } }); clearStatus("설정을 저장했습니다."); } catch (error) { showError(error); } finally { submit.disabled = false; } });
    settings.appendChild(form);

    var createOrg = document.createElement("form"); createOrg.className = "sg-api-form";
    field(createOrg, "새 기관 이름", "name", "text");
    var createOrgButton = text("button", "기관 등록", "sg-api-button"); createOrgButton.type = "submit"; createOrg.appendChild(createOrgButton);
    createOrg.addEventListener("submit", async function (event) {
      event.preventDefault(); createOrgButton.disabled = true;
      try { await api.request("/ops/orgs", { method: "POST", body: { name: createOrg.elements.name.value } }); await loadOps(me); }
      catch (error) { showError(error); createOrgButton.disabled = false; }
    });
    orgCard.appendChild(createOrg);
    orgs.forEach(function (org) {
      var row = text("div", "구독 · " + org.name, "sg-api-record");
      var subscriptionForm = document.createElement("form"); subscriptionForm.className = "sg-api-form";
      field(subscriptionForm, "체험 기간", "trialDays", "number").value = "0";
      var createSubscription = text("button", "월간 구독 개설", "sg-api-button"); createSubscription.type = "submit"; subscriptionForm.appendChild(createSubscription);
      subscriptionForm.addEventListener("submit", async function (event) {
        event.preventDefault(); createSubscription.disabled = true;
        try { await api.request("/ops/orgs/" + encodeURIComponent(org.id) + "/subscription", { method: "POST", body: { planCode: "academy_monthly_v1", trialDays: Number(subscriptionForm.elements.trialDays.value) } }); await loadOps(me); }
        catch (error) { showError(error); createSubscription.disabled = false; }
      });
      row.appendChild(subscriptionForm); orgCard.appendChild(row);
    });

    var noticeForm = document.createElement("form"); noticeForm.className = "sg-api-form";
    field(noticeForm, "공지 제목", "title", "text"); field(noticeForm, "공지 내용", "body", "textarea");
    var publish = text("button", "공지 게시", "sg-api-button"); publish.type = "submit"; noticeForm.appendChild(publish);
    noticeForm.addEventListener("submit", async function (event) {
      event.preventDefault(); publish.disabled = true;
      try { await api.request("/ops/notices", { method: "POST", body: { title: noticeForm.elements.title.value, body: noticeForm.elements.body.value, status: "published" } }); await loadOps(me); }
      catch (error) { showError(error); publish.disabled = false; }
    });
    noticeCard.appendChild(noticeForm);

    var invoiceCard = card("미납 청구서 · 수기 입금");
    invoices.forEach(function (invoice) {
      var row = document.createElement("div"); row.className = "sg-api-record";
      row.append(text("strong", invoice.org_name + " · " + Number(invoice.total_krw).toLocaleString("ko-KR") + "원"), text("small", dateValue(invoice.due_on) + " 납부 기한 · " + invoice.id, "sg-api-muted"));
      row.appendChild(button("입금 확인", async function (event) {
        var trigger = event.currentTarget; trigger.disabled = true;
        try { await api.request("/ops/invoices/" + encodeURIComponent(invoice.id) + "/mark-paid", { method: "POST", body: { amountKrw: Number(invoice.total_krw), evidence: "운영자 수기 입금 확인" } }); await loadOps(me); }
        catch (error) { showError(error); trigger.disabled = false; }
      }));
      invoiceCard.appendChild(row);
    });
    if (!invoices.length) invoiceCard.appendChild(text("p", "미납 청구서가 없습니다.", "sg-api-muted"));
    var refunds = card("결제 환불");
    paidInvoices.filter(function (invoice) { return Number(invoice.refundable_krw) > 0; }).forEach(function (invoice) {
      var row = document.createElement("div"); row.className = "sg-api-record";
      row.append(text("strong", invoice.org_name + " · 환불 가능 " + Number(invoice.refundable_krw).toLocaleString("ko-KR") + "원"), text("small", invoice.id, "sg-api-muted"));
      row.appendChild(button("환불 처리", async function (event) {
        var trigger = event.currentTarget;
        var defaultAmount = String(invoice.refundable_krw);
        var amount = Number(window.prompt("환불 금액을 원 단위로 입력해 주세요.", defaultAmount));
        if (!Number.isInteger(amount) || amount < 1 || amount > Number(invoice.refundable_krw)) return;
        var reason = window.prompt("환불 사유를 입력해 주세요.", "운영자 수기 환불");
        if (!reason || !reason.trim()) return;
        trigger.disabled = true;
        try {
          await api.request("/ops/invoices/" + encodeURIComponent(invoice.id) + "/refund", { method: "POST", headers: { "idempotency-key": "manual-refund:" + invoice.id + ":" + Date.now() }, body: { amountKrw: amount, reason: reason.trim() } });
          await loadOps(me);
        } catch (error) { showError(error); trigger.disabled = false; }
      }));
      refunds.appendChild(row);
    });
    if (!refunds.querySelector(".sg-api-record")) refunds.appendChild(text("p", "환불 가능한 결제 내역이 없습니다.", "sg-api-muted"));
    content.append(grid, orgCard, ticketCard, noticeCard, invoiceCard, refunds, auditCard, settings);
  }

  async function loadTenant(me, membership) {
    var orgId = membership.orgId;
    title.textContent = membership.orgName;
    subtitle.textContent = me.user.name + " · " + roleLabel[membership.role];
    var rosterResult = await api.request("/orgs/" + encodeURIComponent(orgId) + "/athletes");
    var athletes = rosterResult.athletes || [];
    var layout = document.createElement("div"); layout.className = "sg-api-layout";
    var roster = card("선수 목록 (" + athletes.length + ")"); roster.classList.add("sg-api-panel");
    var list = document.createElement("div"); list.className = "sg-api-list";
    var details = card("선수를 선택해 주세요");
    roster.appendChild(list); layout.append(roster, details); content.appendChild(layout);

    if (membership.role === "org_admin" || membership.role === "coach") {
      var teamsResult = await api.request("/orgs/" + encodeURIComponent(orgId) + "/teams");
      if (membership.role === "org_admin") {
        var teamCard = card("야구 팀 등록"); var teamForm = document.createElement("form"); teamForm.className = "sg-api-form";
        field(teamForm, "팀 이름", "name", "text"); var teamSave = text("button", "팀 등록", "sg-api-button"); teamSave.type = "submit"; teamForm.appendChild(teamSave);
        teamForm.addEventListener("submit", async function (event) { event.preventDefault(); teamSave.disabled = true; try { await api.request("/orgs/" + encodeURIComponent(orgId) + "/teams", { method: "POST", body: { name: teamForm.elements.name.value, sport: "baseball" } }); window.location.reload(); } catch (error) { showError(error); teamSave.disabled = false; } });
        teamCard.appendChild(teamForm); content.appendChild(teamCard);
      }
      if (teamsResult.teams.length) {
        var athleteCard = card("선수 초안 등록"); var athleteForm = document.createElement("form"); athleteForm.className = "sg-api-form";
        field(athleteForm, "선수 이름", "displayName", "text"); field(athleteForm, "생년월일", "birthDate", "date");
        field(athleteForm, "팀", "teamId", "select", teamsResult.teams.map(function (team) { return [team.id, team.name]; }));
        var athleteSave = text("button", "동의 전 초안으로 등록", "sg-api-button"); athleteSave.type = "submit"; athleteForm.appendChild(athleteSave);
        athleteForm.addEventListener("submit", async function (event) { event.preventDefault(); athleteSave.disabled = true; try { await api.request("/orgs/" + encodeURIComponent(orgId) + "/athletes", { method: "POST", body: { displayName: athleteForm.elements.displayName.value, birthDate: athleteForm.elements.birthDate.value, teamId: athleteForm.elements.teamId.value } }); window.location.reload(); } catch (error) { showError(error); athleteSave.disabled = false; } });
        athleteCard.appendChild(athleteForm); content.appendChild(athleteCard);
      }
      if (membership.role === "org_admin") {
        var inviteCard = card("코치·보호자·선수 초대"); var inviteForm = document.createElement("form"); inviteForm.className = "sg-api-form";
        field(inviteForm, "이메일", "email", "email");
        var inviteRole = field(inviteForm, "역할", "role", "select", [["coach", "코치"], ["guardian", "보호자"], ["athlete", "만 14세 이상 선수"]]);
        var inviteAthlete = field(inviteForm, "연결할 선수", "athleteId", "select", [["", "선수 선택"], ...athletes.map(function (athlete) { return [athlete.id, athlete.displayName]; })]);
        inviteAthlete.required = false;
        inviteRole.addEventListener("change", function () {
          var needsAthlete = inviteRole.value === "guardian" || inviteRole.value === "athlete";
          inviteAthlete.required = needsAthlete;
          inviteAthlete.disabled = !needsAthlete;
        });
        inviteAthlete.disabled = true;
        var inviteSave = text("button", "초대 보내기", "sg-api-button"); inviteSave.type = "submit"; inviteForm.appendChild(inviteSave);
        inviteForm.addEventListener("submit", async function (event) { event.preventDefault(); inviteSave.disabled = true; try { var body = { email: inviteForm.elements.email.value, role: inviteRole.value }; if (inviteRole.value === "guardian" || inviteRole.value === "athlete") body.athleteId = inviteAthlete.value; await api.request("/orgs/" + encodeURIComponent(orgId) + "/invites", { method: "POST", body: body }); inviteForm.reset(); inviteRole.dispatchEvent(new Event("change")); clearStatus("초대를 만들었습니다. 이메일 발송 설정을 확인해 주세요."); } catch (error) { showError(error); } finally { inviteSave.disabled = false; } });
        inviteCard.appendChild(inviteForm); content.appendChild(inviteCard);
      }
    }

    function selectAthlete(athlete, activeButton) {
      list.querySelectorAll("button").forEach(function (item) { item.setAttribute("aria-current", item === activeButton ? "true" : "false"); });
      details.replaceChildren(text("h2", athlete.displayName));
      details.appendChild(text("p", (athlete.teamName || "팀 미지정") + " · " + (athlete.status === "active" ? "이용 중" : athlete.status === "draft" ? "보호자 동의 대기" : athlete.status), "sg-api-muted"));
      if (athlete.status !== "active") {
        if (athlete.status === "draft" && membership.role === "guardian") {
          details.appendChild(text("p", "선수 정보는 보호자 동의가 확인될 때까지 제품 기록에 사용되지 않습니다."));
          details.appendChild(button("아동 계정 이용 동의 후 활성화", async function (event) {
            var trigger = event.currentTarget; trigger.disabled = true;
            try {
              var policies = await api.request("/legal/policies/current");
              var privacy = (policies.policies || []).find(function (policy) { return policy.kind === "privacy"; });
              if (!privacy) throw new Error("현재 적용 중인 개인정보 처리방침을 찾을 수 없습니다.");
              await api.request("/athletes/" + athlete.id + "/consents", { method: "POST", body: { policyVersionId: privacy.id, purposes: ["child_account"], granted: true } });
              await api.request("/athletes/" + athlete.id + "/activate", { method: "POST", body: {} });
              window.location.reload();
            } catch (error) { showError(error); trigger.disabled = false; }
          }));
        } else details.appendChild(text("p", "현재 상태에서는 제품 기록을 열 수 없습니다.", "sg-api-alert"));
        return;
      }
      loadAthlete(athlete, details, membership.role, membership.role === "athlete" || membership.role === "coach" && !athlete.hasAthleteUser).catch(showError);
    }

    athletes.forEach(function (athlete, index) {
      var item = button(athlete.displayName + " · " + (athlete.status === "active" ? "이용 중" : "동의 대기"), function (event) { selectAthlete(athlete, event.currentTarget); }, "sg-api-choice");
      item.appendChild(text("small", athlete.teamName || athlete.status)); list.appendChild(item);
      if (index === 0) selectAthlete(athlete, item);
    });
    if (!athletes.length) details.appendChild(text("p", "현재 연결된 선수가 없습니다.", "sg-api-muted"));

    var billing = await api.request("/orgs/" + encodeURIComponent(orgId) + "/subscription").catch(function () { return null; });
    if (billing && billing.subscription) {
      var billingCard = card("구독 상태"); var sub = billing.subscription;
      billingCard.append(text("p", sub.status + " · " + (sub.supply_krw || 0).toLocaleString("ko-KR") + "원 + 부가세", "sg-api-record"));
      var invoices = await api.request("/orgs/" + encodeURIComponent(orgId) + "/invoices").catch(function () { return { invoices: [] }; });
      (invoices.invoices || []).forEach(function (invoice) { billingCard.appendChild(text("div", dateValue(invoice.period_start) + " · " + invoice.total_krw.toLocaleString("ko-KR") + "원 · " + invoice.status, "sg-api-record")); });
      content.appendChild(billingCard);
    }

    var support = card("운영팀에 문의");
    var supportForm = document.createElement("form"); supportForm.className = "sg-api-form";
    field(supportForm, "제목", "title", "text");
    field(supportForm, "분류", "category", "select", [["account", "계정"], ["privacy", "개인정보"], ["billing", "결제"], ["other", "기타"]]);
    field(supportForm, "문의 내용", "body", "textarea");
    var supportSubmit = text("button", "문의 등록", "sg-api-button"); supportSubmit.type = "submit"; supportForm.appendChild(supportSubmit);
    supportForm.addEventListener("submit", async function (event) {
      event.preventDefault(); supportSubmit.disabled = true;
      try {
        await api.request("/tickets", { method: "POST", body: { title: supportForm.elements.title.value, category: supportForm.elements.category.value, body: supportForm.elements.body.value } });
        supportForm.reset(); clearStatus("문의가 접수되었습니다.");
      } catch (error) { showError(error); }
      finally { supportSubmit.disabled = false; }
    });
    support.appendChild(supportForm); content.appendChild(support);
  }

  async function loadAthlete(athlete, panel, role, canWriteRecords) {
    clearStatus("선수 기록을 불러오고 있습니다…");
    var responses = await Promise.all([api.request("/athletes/" + athlete.id + "/summary"), api.request("/athletes/" + athlete.id + "/training"), api.request("/athletes/" + athlete.id + "/games")]);
    var summary = responses[0]; var training = responses[1].training || []; var games = responses[2].games || [];
    panel.replaceChildren(text("h2", athlete.displayName));
    var stats = document.createElement("div"); stats.className = "sg-api-grid";
    stats.append(stat("최근 7일 훈련", Number(summary.week_minutes || 0) + "분"), stat("훈련 일수", Number(summary.week_days || 0) + "일"), stat("연속 훈련", Number(summary.streak || 0) + "일"), stat("이번 달 타율", formatAverage(summary.month_batting_average)), stat("올해 안타", Number(summary.season_hits || 0) + "개"));
    panel.appendChild(stats);
    if (Array.isArray(summary.goals) && summary.goals.length) {
      var goals = card("목표");
      summary.goals.forEach(function (goal) {
        var row = document.createElement("div"); row.className = "sg-api-record";
        row.appendChild(text("strong", goal.title + " · " + goal.metric));
        if (role === "coach") {
          var goalForm = document.createElement("form"); goalForm.className = "sg-api-form";
          field(goalForm, "목표 이름", "title", "text").value = goal.title;
          field(goalForm, "목표 수치", "targetNumeric", "number").value = String(goal.targetNumeric);
          var saveGoal = text("button", "목표 저장", "sg-api-button"); saveGoal.type = "submit"; goalForm.appendChild(saveGoal);
          goalForm.addEventListener("submit", async function (event) {
            event.preventDefault(); saveGoal.disabled = true;
            try {
              await api.request("/athletes/" + athlete.id + "/goals/" + encodeURIComponent(goal.id), { method: "PUT", body: { title: goalForm.elements.title.value, targetNumeric: Number(goalForm.elements.targetNumeric.value) } });
              await loadAthlete(athlete, panel, role, canWriteRecords);
            } catch (error) { showError(error); saveGoal.disabled = false; }
          });
          row.appendChild(goalForm);
        }
        goals.appendChild(row);
      });
      panel.appendChild(goals);
    }
    var trainingCard = card("훈련 기록");
    training.slice(0, 20).forEach(function (row) { trainingCard.appendChild(text("div", dateValue(row.trained_on) + " · " + row.type + " · " + row.minutes + "분 · 강도 " + row.intensity, "sg-api-record")); });
    if (!training.length) trainingCard.appendChild(text("p", "훈련 기록이 없습니다.", "sg-api-muted")); panel.appendChild(trainingCard);
    var gameCard = card("경기 기록");
    games.slice(0, 20).forEach(function (row) { gameCard.appendChild(text("div", dateValue(row.played_on) + " · " + (row.opponent || "상대 미입력") + " · " + row.hits + "/" + row.at_bats + " · 볼넷 " + row.walks, "sg-api-record")); });
    if (!games.length) gameCard.appendChild(text("p", "경기 기록이 없습니다.", "sg-api-muted")); panel.appendChild(gameCard);

    var mediaCard = card("사진");
    try {
      var mediaResult = await api.request("/athletes/" + athlete.id + "/media");
      var mediaItems = mediaResult.media || [];
      mediaItems.forEach(function (item) {
        var figure = document.createElement("figure"); figure.className = "sg-api-record";
        var image = document.createElement("img"); image.src = item.url; image.alt = item.caption || "선수 사진"; image.loading = "lazy"; image.style.cssText = "display:block;max-width:100%;max-height:320px;border-radius:12px";
        figure.appendChild(image);
        if (item.caption) figure.appendChild(text("figcaption", item.caption, "sg-api-muted"));
        if (role === "athlete" || role === "guardian") figure.appendChild(button("사진 삭제", async function (event) {
          if (!window.confirm("이 사진을 삭제할까요?")) return;
          var trigger = event.currentTarget; trigger.disabled = true;
          try { await api.request("/media/" + encodeURIComponent(item.id), { method: "DELETE" }); await loadAthlete(athlete, panel, role, canWriteRecords); }
          catch (error) { showError(error); trigger.disabled = false; }
        }));
        mediaCard.appendChild(figure);
      });
      if (!mediaItems.length) mediaCard.appendChild(text("p", "등록된 사진이 없습니다.", "sg-api-muted"));
    } catch (error) { mediaCard.appendChild(text("p", error.message || "사진을 불러오지 못했습니다.", "sg-api-muted")); }
    if (role === "guardian" || role === "athlete") {
      if (role === "guardian") mediaCard.appendChild(button("사진 초상 동의", async function (event) {
        var trigger = event.currentTarget; trigger.disabled = true;
        try {
          var policies = await api.request("/legal/policies/current");
          var privacy = (policies.policies || []).find(function (policy) { return policy.kind === "privacy"; });
          if (!privacy) throw new Error("현재 적용 중인 개인정보 처리방침을 찾을 수 없습니다.");
          await api.request("/athletes/" + athlete.id + "/consents", { method: "POST", body: { policyVersionId: privacy.id, purposes: ["portrait"], granted: true } });
          clearStatus("사진 초상 동의를 기록했습니다.");
        } catch (error) { showError(error); }
        finally { trigger.disabled = false; }
      }));
      var uploadForm = document.createElement("form"); uploadForm.className = "sg-api-form";
      var imageInput = field(uploadForm, "사진 (JPEG, PNG, WebP · 8MB 이하)", "photo", "file"); imageInput.accept = "image/jpeg,image/png,image/webp";
      var caption = field(uploadForm, "사진 설명", "caption", "text"); caption.required = false;
      var upload = text("button", "사진 업로드", "sg-api-button"); upload.type = "submit"; uploadForm.appendChild(upload);
      uploadForm.addEventListener("submit", async function (event) {
        event.preventDefault(); var file = imageInput.files && imageInput.files[0];
        if (!file) { showError(new Error("업로드할 사진을 선택해 주세요.")); return; }
        upload.disabled = true;
        try {
          var signed = await api.request("/athletes/" + athlete.id + "/media/uploads", { method: "POST", body: { contentType: file.type, contentLength: file.size, kind: "gallery" } });
          var put = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
          if (!put.ok) throw new Error("사진 전송에 실패했습니다. 다시 시도해 주세요.");
          await api.request("/athletes/" + athlete.id + "/media/complete", { method: "POST", body: { uploadId: signed.uploadId, kind: "gallery", caption: caption.value } });
          await loadAthlete(athlete, panel, role, canWriteRecords);
        } catch (error) { showError(error); upload.disabled = false; }
      });
      mediaCard.appendChild(uploadForm);
    }
    panel.appendChild(mediaCard);

    if (role === "athlete" || role === "org_admin") {
      var visibilityCard = card("기록 공개 범위");
      var visibility = await api.request("/athletes/" + athlete.id + "/visibility");
      var visibilityForm = document.createElement("form"); visibilityForm.className = "sg-api-form";
      var visibilityOptions = [["private", "나만 보기"], ["team", "기관 팀에 공개"]];
      [ ["프로필", "profile"], ["훈련", "training"], ["경기", "games"], ["목표", "goals"] ].forEach(function (item) {
        field(visibilityForm, item[0], item[1], "select", visibilityOptions).value = visibility[item[1]] || "private";
      });
      var saveVisibility = text("button", "공개 범위 저장", "sg-api-button"); saveVisibility.type = "submit"; visibilityForm.appendChild(saveVisibility);
      visibilityForm.addEventListener("submit", async function (event) {
        event.preventDefault(); saveVisibility.disabled = true;
        try {
          await api.request("/athletes/" + athlete.id + "/visibility", { method: "PUT", body: { profile: visibilityForm.elements.profile.value, training: visibilityForm.elements.training.value, games: visibilityForm.elements.games.value, goals: visibilityForm.elements.goals.value } });
          clearStatus("기록 공개 범위를 저장했습니다.");
        } catch (error) { showError(error); }
        finally { saveVisibility.disabled = false; }
      });
      visibilityCard.appendChild(visibilityForm); panel.appendChild(visibilityCard);
    }

    if (role === "coach") {
      var coachData = await Promise.all([api.request("/athletes/" + athlete.id + "/notes"), api.request("/athletes/" + athlete.id + "/requests")]);
      var notesCard = card("코치 메모");
      (coachData[0].notes || []).forEach(function (note) {
        notesCard.appendChild(text("div", note.body + (note.visible_to_guardian ? " · 보호자에게 공개" : " · 비공개"), "sg-api-record"));
      });
      var noteForm = document.createElement("form"); noteForm.className = "sg-api-form";
      field(noteForm, "메모", "body", "textarea");
      var visible = field(noteForm, "보호자에게 공개", "visibleToGuardian", "checkbox"); visible.checked = false; visible.required = false; visible.style.width = "auto"; visible.style.minHeight = "auto";
      var saveNote = text("button", "메모 저장", "sg-api-button"); saveNote.type = "submit"; noteForm.appendChild(saveNote);
      noteForm.addEventListener("submit", async function (event) {
        event.preventDefault(); saveNote.disabled = true;
        try { await api.request("/athletes/" + athlete.id + "/notes", { method: "POST", body: { body: noteForm.elements.body.value, visibleToGuardian: visible.checked } }); await loadAthlete(athlete, panel, role, canWriteRecords); }
        catch (error) { showError(error); saveNote.disabled = false; }
      });
      notesCard.appendChild(noteForm); panel.appendChild(notesCard);

      var coachRequests = card("보호자 요청");
      (coachData[1].requests || []).forEach(function (request) {
        var row = document.createElement("div"); row.className = "sg-api-record";
        row.append(text("p", request.body), text("small", request.status, "sg-api-muted"));
        if (request.status === "pending") row.appendChild(button("완료 처리", async function (event) {
          var trigger = event.currentTarget; trigger.disabled = true;
          try { await api.request("/athletes/" + athlete.id + "/requests/" + encodeURIComponent(request.id), { method: "PATCH", body: { status: "done" } }); await loadAthlete(athlete, panel, role, canWriteRecords); }
          catch (error) { showError(error); trigger.disabled = false; }
        }));
        coachRequests.appendChild(row);
      });
      if (!(coachData[1].requests || []).length) coachRequests.appendChild(text("p", "접수된 요청이 없습니다.", "sg-api-muted"));
      panel.appendChild(coachRequests);
    }

    if (role === "guardian") {
      var cheersResult = await api.request("/athletes/" + athlete.id + "/cheers");
      var cheersCard = card("응원 기록");
      (cheersResult.cheers || []).forEach(function (cheer) { cheersCard.appendChild(text("div", cheer.body, "sg-api-record")); });
      if (!(cheersResult.cheers || []).length) cheersCard.appendChild(text("p", "응원 기록이 없습니다.", "sg-api-muted"));
      panel.appendChild(cheersCard);
      var requestResult = await api.request("/athletes/" + athlete.id + "/requests");
      var requestsCard = card("코치 요청 현황");
      (requestResult.requests || []).forEach(function (request) {
        var row = document.createElement("div"); row.className = "sg-api-record";
        row.append(text("p", request.body), text("small", request.status, "sg-api-muted"));
        if (request.status === "pending") row.appendChild(button("요청 취소", async function (event) {
          var trigger = event.currentTarget; trigger.disabled = true;
          try { await api.request("/athletes/" + athlete.id + "/requests/" + encodeURIComponent(request.id), { method: "DELETE" }); await loadAthlete(athlete, panel, role, canWriteRecords); }
          catch (error) { showError(error); trigger.disabled = false; }
        }));
        requestsCard.appendChild(row);
      });
      panel.appendChild(requestsCard);
      var reportCard = card("주간 리포트 이메일");
      reportCard.appendChild(text("p", "이메일로 주간 리포트를 받으려면 별도 동의가 필요합니다.", "sg-api-muted"));
      reportCard.appendChild(button("주간 리포트 이메일 동의", async function (event) {
        var trigger = event.currentTarget; trigger.disabled = true;
        try {
          var policies = await api.request("/legal/policies/current");
          var privacy = (policies.policies || []).find(function (policy) { return policy.kind === "privacy"; });
          if (!privacy) throw new Error("현재 적용 중인 개인정보 처리방침을 찾을 수 없습니다.");
          await api.request("/athletes/" + athlete.id + "/consents", { method: "POST", body: { policyVersionId: privacy.id, purposes: ["report_email"], granted: true } });
          clearStatus("주간 리포트 이메일 동의를 기록했습니다.");
        } catch (error) { showError(error); }
        finally { trigger.disabled = false; }
      }));
      reportCard.appendChild(button("이메일 동의 철회", async function (event) {
        var trigger = event.currentTarget; trigger.disabled = true;
        try {
          var policies = await api.request("/legal/policies/current");
          var privacy = (policies.policies || []).find(function (policy) { return policy.kind === "privacy"; });
          if (!privacy) throw new Error("현재 적용 중인 개인정보 처리방침을 찾을 수 없습니다.");
          await api.request("/athletes/" + athlete.id + "/consents", { method: "POST", body: { policyVersionId: privacy.id, purposes: ["report_email"], granted: false } });
          clearStatus("주간 리포트 이메일 동의를 철회했습니다.");
        } catch (error) { showError(error); }
        finally { trigger.disabled = false; }
      }));
      var reportResult = await api.request("/athletes/" + athlete.id + "/reports/weekly").catch(function () { return { reports: [] }; });
      (reportResult.reports || []).forEach(function (report) { reportCard.appendChild(text("div", dateValue(report.week_start) + " 주간 리포트", "sg-api-record")); });
      panel.appendChild(reportCard);
    }

    if (["guardian", "org_admin", "athlete"].includes(role)) {
      var privacyCard = card("내 정보 권리 요청");
      var exportMessage = text("p", "내려받기 요청은 만료 시간이 있는 비공개 ZIP으로 준비됩니다.", "sg-api-muted");
      privacyCard.appendChild(exportMessage);
      privacyCard.appendChild(button("내 정보 내려받기", async function (event) {
        var trigger = event.currentTarget; trigger.disabled = true;
        try {
          var job = await api.request("/me/export", { method: "POST", body: { athleteId: athlete.id } });
          exportMessage.textContent = "요청 접수 · " + job.status;
          for (var attempt = 0; attempt < 30 && job.status === "queued"; attempt += 1) {
            await new Promise(function (resolve) { window.setTimeout(resolve, 2000); });
            job = await api.request("/me/exports/" + encodeURIComponent(job.id));
            exportMessage.textContent = "내보내기 상태 · " + job.status;
          }
          if (job.status === "ready" && job.downloadUrl) {
            var link = document.createElement("a"); link.href = job.downloadUrl; link.target = "_blank"; link.rel = "noopener"; link.textContent = "내 정보 ZIP 다운로드"; privacyCard.appendChild(link);
          } else if (job.status === "queued") exportMessage.textContent = "요청이 대기 중입니다. 잠시 후 다시 확인해 주세요.";
          else if (job.status !== "ready") exportMessage.textContent = "내보내기 상태 · " + job.status;
        } catch (error) { showError(error); }
        finally { trigger.disabled = false; }
      }));
      privacyCard.appendChild(button("선수 정보 파기 요청", async function (event) {
        if (!window.confirm("선수의 기록과 사진을 파기합니다. 이 작업은 되돌릴 수 없습니다. 진행할까요?")) return;
        var trigger = event.currentTarget; trigger.disabled = true;
        try {
          await api.request("/athletes/" + athlete.id + "/erasure", { method: "POST", body: {} });
          panel.replaceChildren(text("h2", "파기 요청 처리 완료"), text("p", "선수 기록과 사진을 파기했습니다."));
        } catch (error) { showError(error); trigger.disabled = false; }
      }, "sg-api-button sg-api-danger"));
      panel.appendChild(privacyCard);
    }

    if (canWriteRecords) {
      var trainingFormCard = card("훈련 기록 추가"); var trainingForm = document.createElement("form"); trainingForm.className = "sg-api-form";
      field(trainingForm, "날짜", "trainedOn", "date"); field(trainingForm, "훈련 종류", "type", "text"); field(trainingForm, "분", "minutes", "number"); field(trainingForm, "강도", "intensity", null, [["low", "하"], ["mid", "중"], ["high", "상"]]);
      var trainingSave = text("button", "훈련 저장", "sg-api-button"); trainingSave.type = "submit"; trainingForm.appendChild(trainingSave);
      trainingForm.addEventListener("submit", async function (event) { event.preventDefault(); trainingSave.disabled = true; try { await api.request("/athletes/" + athlete.id + "/training", { method: "POST", body: { trainedOn: trainingForm.elements.trainedOn.value, type: trainingForm.elements.type.value, minutes: Number(trainingForm.elements.minutes.value), intensity: trainingForm.elements.intensity.value } }); await loadAthlete(athlete, panel, role, canWriteRecords); } catch (error) { showError(error); trainingSave.disabled = false; } });
      trainingFormCard.appendChild(trainingForm); panel.appendChild(trainingFormCard);

      var gameFormCard = card("경기 기록 추가"); var gameForm = document.createElement("form"); gameForm.className = "sg-api-form";
      field(gameForm, "경기 날짜", "playedOn", "date"); field(gameForm, "대회", "competition", "text"); field(gameForm, "상대", "opponent", "text"); field(gameForm, "타수", "atBats", "number"); field(gameForm, "안타", "hits", "number"); field(gameForm, "볼넷", "walks", "number");
      var gameSave = text("button", "경기 저장", "sg-api-button"); gameSave.type = "submit"; gameForm.appendChild(gameSave);
      gameForm.addEventListener("submit", async function (event) { event.preventDefault(); gameSave.disabled = true; try { await api.request("/athletes/" + athlete.id + "/games", { method: "POST", body: { playedOn: gameForm.elements.playedOn.value, competition: gameForm.elements.competition.value, opponent: gameForm.elements.opponent.value, atBats: Number(gameForm.elements.atBats.value), hits: Number(gameForm.elements.hits.value), walks: Number(gameForm.elements.walks.value) } }); await loadAthlete(athlete, panel, role, canWriteRecords); } catch (error) { showError(error); gameSave.disabled = false; } });
      gameFormCard.appendChild(gameForm); panel.appendChild(gameFormCard);
    }

    if (role === "guardian") {
      var parentCard = card("응원과 코치 요청");
      [["cheers", "응원", "응원을 남겼습니다."], ["requests", "코치 요청", "요청을 보냈습니다."]].forEach(function (config) {
        var form = document.createElement("form"); form.className = "sg-api-form"; field(form, config[1] + " 내용", "body", "textarea");
        var send = text("button", config[1] + " 보내기", "sg-api-button"); send.type = "submit"; form.appendChild(send);
        form.addEventListener("submit", async function (event) { event.preventDefault(); send.disabled = true; try { await api.request("/athletes/" + athlete.id + "/" + config[0], { method: "POST", body: { body: form.elements.body.value } }); form.reset(); clearStatus(config[2]); } catch (error) { showError(error); } finally { send.disabled = false; } });
        parentCard.appendChild(form);
      });
      panel.appendChild(parentCard);
    }
    clearStatus(athlete.displayName + " 기록을 불러왔습니다.");
  }

  async function start() {
    document.body.classList.add("sg-api-mode");
    var legacy = document.querySelector("body > .app"); if (legacy) legacy.hidden = true;
    root.querySelector("[data-api-logout]").addEventListener("click", function () { window.SportsGrowAuthApi.logout(); });
    try {
      var me = await api.request("/me", { redirectOn401: false });
      var memberships = me.memberships || [];
      if (pageRole === "admin") { if (!me.user.platformStaff) throw new Error("운영자 계정만 접근할 수 있습니다."); await loadOps(me); return; }
      var active = memberships.find(function (item) { return item.id === me.activeMembershipId; });
      if (!active) { window.location.replace("pick-role.html?next=" + encodeURIComponent(page)); return; }
      if (rolePage[active.role] !== page && !(active.role === "coach" && page === "student.html")) { setPage(active.role, page); return; }
      await loadTenant(me, active);
    } catch (error) {
      if (error.status === 401 || error.code === "unauthenticated") { window.location.replace((pageRole === "admin" ? "admin-login.html" : "login.html") + "?next=" + encodeURIComponent(page)); return; }
      showError(error);
    }
  }
  start();
})();
