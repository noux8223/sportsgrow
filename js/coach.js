/* =====================================================================
   SPORTS GROW — coach dashboard
   ===================================================================== */
(function () {
  "use strict";

  if (window.SportsGrowApi && window.SportsGrowApi.enabled) return;

  var Store = window.AppShell || { readStore: function () {}, writeStore: function () {} };
  var NOTES_KEY = "sportsgrow.coach.notes.v1";
  var GOALS_KEY = "sportsgrow.coach.goals.v1";
  var CUSTOM_KEY = "sportsgrow.coach.customPlayers.v1";
  var REQUESTS_KEY = "sportsgrow.parent.requests.v1";

  var DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
  var TONES = ["green", "blue", "clay", "violet"];

  function daysAgo(n) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function parseDate(key) {
    var p = key.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2], 12, 0, 0, 0);
  }

  function shortDate(key) {
    var d = parseDate(key);
    return (
      String(d.getMonth() + 1).padStart(2, "0") +
      "." +
      String(d.getDate()).padStart(2, "0") +
      " (" +
      DAY_NAMES[d.getDay()] +
      ")"
    );
  }

  function todayLabel() {
    var d = new Date();
    return (
      d.getFullYear() +
      "." +
      String(d.getMonth() + 1).padStart(2, "0") +
      "." +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------------------------------------------------------------
     Demo ledger (학생·코치·아카데미·관리자가 공유)
     --------------------------------------------------------------- */
  var LEDGER_KEY = "sportsgrow.demo.v1";

  function readLedger() {
    if (window.SportsGrowDemo && window.SportsGrowDemo.load) {
      try {
        return window.SportsGrowDemo.load();
      } catch (err) {
        return null;
      }
    }
    try {
      var raw = window.localStorage.getItem(LEDGER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function ledgerPlayer(state) {
    if (!state) return null;
    if (window.SportsGrowDemo && window.SportsGrowDemo.player) {
      try {
        var viaApi = window.SportsGrowDemo.player(state);
        if (viaApi) return viaApi;
      } catch (err) {
        /* 아래 탐색으로 넘어간다 */
      }
    }
    var lists = [state.players, state.students, state.roster, state.members];
    for (var i = 0; i < lists.length; i += 1) {
      if (!Array.isArray(lists[i])) continue;
      for (var j = 0; j < lists[i].length; j += 1) {
        var player = lists[i][j];
        if (player && (player.id === "p-haram" || player.name === "김하람")) return player;
      }
    }
    if (state.player && (state.player.id === "p-haram" || state.player.name === "김하람")) {
      return state.player;
    }
    return null;
  }

  function ledgerValue(method, player, fallback) {
    var api = window.SportsGrowDemo;
    if (!player || !api || typeof api[method] !== "function") return fallback;
    try {
      var value = api[method](player);
      return value == null ? fallback : value;
    } catch (err) {
      return fallback;
    }
  }

  function monthEndLabel(offset) {
    var now = new Date();
    var end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return (
      end.getFullYear() +
      "." +
      String(end.getMonth() + 1).padStart(2, "0") +
      "." +
      String(end.getDate()).padStart(2, "0")
    );
  }

  function isPastDue(due) {
    var parts = String(due || "").split(".").map(Number);
    if (parts.length !== 3 || !parts[0]) return false;
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(date.getTime())) return false;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  function clampPct(value) {
    var numeric = Number(value);
    if (!isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  function trainingLabel(record) {
    if (!record) return "";
    var minutes = Number(record.minutes);
    var type = String(record.type || record.kind || record.category || "").trim();
    var detail = (type ? type + " " : "") + (isFinite(minutes) ? minutes + "분" : "");
    detail = detail.trim() || "훈련 기록";
    var date = String(record.date || "");
    if (!date || date === daysAgo(0)) return "오늘 · " + detail;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return shortDate(date) + " · " + detail;
    return detail;
  }

  function ledgerGoals(player) {
    var raw = ledgerValue("goalsFor", player, null);
    if (!Array.isArray(raw) || !raw.length) return null;
    return raw.map(function (goal, index) {
      var item = goal || {};
      var type = item.type === "장기" || item.type === "단기" ? item.type : index ? "장기" : "단기";
      var value = item.pct != null ? item.pct : item.progress != null ? item.progress : item.value;
      return {
        type: type,
        title: String(item.title || item.name || item.label || "목표"),
        pct: clampPct(value),
        due: item.due || item.dueDate || item.deadline || monthEndLabel(type === "장기" ? 1 : 0)
      };
    });
  }

  /* ---------------------------------------------------------------
     Seed players
     --------------------------------------------------------------- */
  function makeGoals(shortTitle, longTitle, shortPct, longPct) {
    return [
      { type: "단기", title: shortTitle, pct: shortPct, due: "2026.10.31" },
      { type: "장기", title: longTitle, pct: longPct, due: "2026.11.30" }
    ];
  }

  var SEED = [
    {
      id: "p1", name: "김하람", position: "내야수 · 2루수", grade: "중2", team: "1군",
      minutes: 350, goal: 78, last: "오늘 · 타격 35분", tone: "green",
      goals: makeGoals("10월 타율 .320 달성", "시즌 30안타 · 출루율 .400", 88, 72),
      note: "하체 회전이 좋아졌습니다. 공을 끝까지 보는 연습에 집중하세요."
    },
    {
      id: "p2", name: "이서준", position: "투수", grade: "중3", team: "1군",
      minutes: 300, goal: 72, last: "어제 · 투구 60구", tone: "blue",
      goals: makeGoals("10월 방어율 3.00 이하", "시즌 40탈삼진", 76, 68),
      note: "직구 구위가 안정적입니다. 변화구 제구 비율을 높여 봅시다."
    },
    {
      id: "p3", name: "박도윤", position: "외야수", grade: "중2", team: "1군",
      minutes: 0, goal: 45, last: "5일 전 · 수비 40분", tone: "clay",
      goals: makeGoals("주 3회 이상 훈련 기록", "시즌 타율 .280", 30, 60),
      note: "이번 주 기록이 없습니다. 훈련 참여 상황을 먼저 확인해 주세요."
    },
    {
      id: "p4", name: "최유진", position: "포수", grade: "중3", team: "1군",
      minutes: 380, goal: 84, last: "오늘 · 블로킹 45분", tone: "violet",
      goals: makeGoals("도루 저지율 40%", "시즌 100이닝 포수 출전", 90, 78),
      note: "블로킹과 송구 연결이 좋아졌습니다. 투수 리드도 안정적입니다."
    },
    {
      id: "p5", name: "정민재", position: "1루수", grade: "중1", team: "2군",
      minutes: 190, goal: 58, last: "2일 전 · 타격 50분", tone: "green",
      goals: makeGoals("10월 타격 폼 교정", "체력 테스트 통과", 60, 55),
      note: "타격 시 상체가 먼저 나옵니다. 하체 중심 이동을 반복 연습하세요."
    },
    {
      id: "p6", name: "강태오", position: "유격수", grade: "중2", team: "1군",
      minutes: 260, goal: 66, last: "어제 · 수비 55분", tone: "blue",
      goals: makeGoals("수비 실책 2개 이하", "시즌 20도루", 70, 62),
      note: "더블플레이 판단이 빨라졌습니다. 송구 정확도를 계속 유지하세요."
    },
    {
      id: "p7", name: "윤지호", position: "투수", grade: "중1", team: "2군",
      minutes: 210, goal: 61, last: "2일 전 · 웨이트 40분", tone: "clay",
      goals: makeGoals("주 3회 투구 밸런스 훈련", "구속 5km/h 향상", 64, 58),
      note: "밸런스 훈련 참여가 꾸준합니다. 어깨 컨디션을 매일 기록하세요."
    },
    {
      id: "p8", name: "한도현", position: "외야수", grade: "중3", team: "1군",
      minutes: 340, goal: 76, last: "오늘 · 타격 60분", tone: "violet",
      goals: makeGoals("10월 출루율 .380", "시즌 25타점", 82, 70),
      note: "볼넷 선택이 좋아졌습니다. 주자 있을 때 타격 접근도 안정적입니다."
    },
    {
      id: "p9", name: "오세훈", position: "3루수", grade: "중2", team: "2군",
      minutes: 150, goal: 49, last: "4일 전 · 수비 30분", tone: "green",
      goals: makeGoals("주 4회 훈련 참여", "수비 성공률 85%", 40, 48),
      note: "훈련 참여가 줄었습니다. 보호자와 일정을 확인해 주세요."
    },
    {
      id: "p10", name: "서지안", position: "포수", grade: "중1", team: "1군",
      minutes: 260, goal: 70, last: "어제 · 블로킹 40분", tone: "blue",
      goals: makeGoals("도루 저지율 30%", "시즌 60경기 출전", 74, 66),
      note: "기본기 훈련을 성실히 수행합니다. 송구 동작을 조금 더 빠르게."
    },
    {
      id: "p11", name: "임하준", position: "내야수 · 3루수", grade: "중3", team: "1군",
      minutes: 300, goal: 74, last: "오늘 · 타격 45분", tone: "violet",
      goals: makeGoals("10월 타율 .300", "시즌 40안타", 80, 68),
      note: "타격 타이밍이 좋습니다. 주간 훈련량을 유지해 주세요."
    },
    {
      id: "p12", name: "문준서", position: "외야수", grade: "중1", team: "2군",
      minutes: 0, goal: 40, last: "6일 전 · 러닝 30분", tone: "clay",
      goals: makeGoals("주 2회 이상 기록", "기초 체력 테스트 통과", 25, 42),
      note: "기록이 6일째 없습니다. 컨디션과 참여 의사를 확인해 주세요."
    }
  ];

  var custom = Store.readStore(CUSTOM_KEY, []);
  if (!Array.isArray(custom)) custom = [];
  var players = SEED.concat(custom);

  var goalOverrides = Store.readStore(GOALS_KEY, {});
  if (!goalOverrides || typeof goalOverrides !== "object") goalOverrides = {};
  players.forEach(function (player) {
    if (goalOverrides[player.id]) player.goals = goalOverrides[player.id];
  });

  /* 원장의 김하람이 있으면 p1 숫자만 원장 계산값으로 덮어쓴다 */
  var ledgerState = readLedger();
  var ledgerHaram = ledgerPlayer(ledgerState);
  var haramFromLedger = false;

  if (ledgerHaram) {
    var haramSeed = players.filter(function (player) {
      return player.id === "p1";
    })[0];

    if (haramSeed) {
      var weekMinutes = ledgerValue("weekMinutes", ledgerHaram, null);
      var goalAverage = ledgerValue("goalAverage", ledgerHaram, null);
      var latestLabel = trainingLabel(ledgerValue("latestTraining", ledgerHaram, null));
      var ledgerGoalList = ledgerGoals(ledgerHaram);

      if (typeof weekMinutes === "number" && isFinite(weekMinutes)) {
        haramSeed.minutes = Math.max(0, Math.round(weekMinutes));
      }
      if (typeof goalAverage === "number" && isFinite(goalAverage)) {
        haramSeed.goal = clampPct(goalAverage);
      }
      if (latestLabel) haramSeed.last = latestLabel;
      if (ledgerGoalList) {
        haramSeed.goals = ledgerGoalList;
        haramFromLedger = true;
      }
    }
  }

  /* 원장에 연결되지 않은 선수의 지난 절대 마감일은 이번 달·다음 달 말로 옮긴다 */
  players.forEach(function (player) {
    if (player.id === "p1" && haramFromLedger) return;
    (player.goals || []).forEach(function (goal) {
      if (!isPastDue(goal.due)) return;
      goal.due = monthEndLabel(goal.type === "장기" ? 1 : 0);
    });
  });

  /* ---------------------------------------------------------------
     Status helpers
     --------------------------------------------------------------- */
  function statusOf(player) {
    if (!player.minutes) return { cls: "status--warn", label: "기록 미입력", weight: 0 };
    if (player.goal >= 75) return { cls: "status--good", label: "순항", weight: 3 };
    if (player.goal >= 55) return { cls: "status--info", label: "진행", weight: 2 };
    return { cls: "status--risk", label: "관리 필요", weight: 1 };
  }

  function toneOf(player, index) {
    return player.tone || TONES[index % TONES.length];
  }

  function initials(name) {
    return name.charAt(0);
  }

  function goalPct(player) {
    return Math.max(0, Math.min(100, Number(player.goal) || 0));
  }

  /* ---------------------------------------------------------------
     Overview
     --------------------------------------------------------------- */
  function renderWeeklyTop() {
    var container = document.getElementById("weeklyTop");
    if (!container) return;
    var top = players
      .slice()
      .sort(function (a, b) {
        return b.minutes - a.minutes;
      })
      .slice(0, 5);
    var max = top[0] ? top[0].minutes || 1 : 1;

    container.innerHTML = top
      .map(function (player) {
        var pct = Math.round((player.minutes / max) * 100);
        var under = player.minutes < 240;
        return (
          '<div class="progress-row">' +
          '<div class="progress-row__head"><span>' +
          esc(player.name) +
          " · " +
          esc(player.position.split(" ")[0]) +
          "</span><b>" +
          player.minutes +
          "분</b></div>" +
          '<div class="progress' +
          (under ? " progress--clay" : "") +
          '"><i style="--w:' +
          pct +
          '%"></i></div>' +
          "</div>"
        );
      })
      .join("");
  }

  function renderAlerts() {
    var container = document.getElementById("alertList");
    if (!container) return;
    var alerts = players.filter(function (player) {
      return !player.minutes || player.goal < 50;
    }).slice(0, 3);

    container.innerHTML = alerts
      .map(function (player) {
        var pct = goalPct(player);
        return (
          '<div class="alert-item">' +
          '<span class="alert-item__ico' +
          (player.minutes ? "" : " alert-item__ico--risk") +
          '"><svg class="icon" aria-hidden="true"><use href="#' +
          (player.minutes ? "i-trend" : "i-clock") +
          '" /></svg></span>' +
          "<div><strong>" +
          esc(player.name) +
          " · " +
          (player.minutes ? "목표 달성률 " + pct + "%" : "기록 미입력") +
          "</strong><span>" +
          esc(player.last) +
          "</span></div>" +
          '<button class="btn btn--white btn--sm" type="button" data-player="' +
          player.id +
          '">프로필</button>' +
          "</div>"
        );
      })
      .join("");
  }

  function renderOverviewTable() {
    var body = document.getElementById("overviewTableBody");
    if (!body) return;
    var sorted = players
      .slice()
      .sort(function (a, b) {
        return goalPct(b) - goalPct(a);
      });

    body.innerHTML = sorted
      .map(function (player, index) {
        var status = statusOf(player);
        var tone = toneOf(player, index);
        return (
          "<tr>" +
          '<td><div class="table-person"><span class="table-avatar table-avatar--' +
          tone +
          '">' +
          initials(player.name) +
          "</span><div><strong>" +
          esc(player.name) +
          "</strong><span>" +
          esc(player.position) +
          "</span></div></div></td>" +
          "<td>" +
          esc(player.team) +
          " · " +
          esc(player.grade) +
          "</td>" +
          '<td class="num">' +
          player.minutes +
          "분</td>" +
          '<td class="muted">' +
          esc(player.last) +
          "</td>" +
          '<td><div class="progress-row__head" style="margin-bottom:3px"><span>' +
          goalPct(player) +
          '%</span></div><div class="progress"><i style="--w:' +
          goalPct(player) +
          '%"></i></div></td>' +
          '<td><span class="status ' +
          status.cls +
          '">' +
          status.label +
          "</span></td>" +
          '<td><div class="table-actions"><button type="button" data-player="' +
          player.id +
          '" aria-label="' +
          esc(player.name) +
          ' 프로필 보기"><svg class="icon" aria-hidden="true"><use href="#i-arrow" /></svg></button></div></td>' +
          "</tr>"
        );
      })
      .join("");
  }

  /* ---------------------------------------------------------------
     Roster
     --------------------------------------------------------------- */
  function filteredPlayers() {
    var query = (document.getElementById("rosterSearch") || {}).value || "";
    query = query.trim().toLowerCase();
    var team = (document.getElementById("rosterTeam") || {}).value || "all";
    var sort = (document.getElementById("rosterSort") || {}).value || "goal";

    var list = players.filter(function (player) {
      var haystack = (player.name + " " + player.position).toLowerCase();
      return (team === "all" || player.team === team) && (!query || haystack.indexOf(query) !== -1);
    });

    list.sort(function (a, b) {
      if (sort === "minutes") return b.minutes - a.minutes;
      if (sort === "name") return a.name.localeCompare(b.name, "ko");
      if (sort === "risk") return statusOf(a).weight - statusOf(b).weight;
      return goalPct(b) - goalPct(a);
    });
    return list;
  }

  function renderRoster() {
    var grid = document.getElementById("rosterGrid");
    if (!grid) return;
    var list = filteredPlayers();

    grid.innerHTML = list.length
      ? list
          .map(function (player, index) {
            var status = statusOf(player);
            var tone = toneOf(player, index);
            return (
              '<button class="roster-card" type="button" data-player="' +
              player.id +
              '">' +
              '<div class="roster-card__head">' +
              '<span class="roster-card__avatar roster-card__avatar--' +
              tone +
              '">' +
              initials(player.name) +
              "</span>" +
              '<div class="roster-card__id"><strong>' +
              esc(player.name) +
              "</strong><span>" +
              esc(player.position) +
              " · " +
              esc(player.grade) +
              "</span></div>" +
              '<span class="status ' +
              status.cls +
              '">' +
              status.label +
              "</span>" +
              "</div>" +
              '<div class="roster-card__stats">' +
              "<div><span>이번 주 훈련</span><strong>" +
              player.minutes +
              "분</strong></div>" +
              "<div><span>최근 기록</span><strong>" +
              esc(player.last.replace(/ ·.*$/, "")) +
              "</strong></div>" +
              "<div><span>목표 달성</span><strong>" +
              goalPct(player) +
              "%</strong></div>" +
              "</div>" +
              '<div class="roster-card__goal"><span>목표 진행률 <b>' +
              goalPct(player) +
              '%</b></span><div class="progress"><i style="--w:' +
              goalPct(player) +
              '%"></i></div></div>' +
              "</button>"
            );
          })
          .join("")
      : '<div class="empty-state" style="grid-column:1/-1"><svg class="icon" aria-hidden="true"><use href="#i-search" /></svg><strong>검색 결과가 없습니다.</strong><p>다른 이름이나 포지션으로 검색해 보세요.</p></div>';

    var count = document.getElementById("rosterCount");
    if (count) count.textContent = list.length + "명";
    var foot = document.getElementById("rosterFoot");
    if (foot) foot.textContent = "표시 " + list.length + "명 · 전체 " + players.length + "명";
    var total = document.querySelectorAll("[data-total-players]");
    total.forEach(function (el) {
      el.textContent = players.length;
    });
  }

  /* ---------------------------------------------------------------
     Drawer
     --------------------------------------------------------------- */
  var currentPlayer = null;
  var currentTab = "summary";

  function trainingFor(player) {
    var types = ["타격", "수비", "웨이트", "러닝"];
    var icons = { 타격: "i-target", 수비: "i-shield", 웨이트: "i-bars", 러닝: "i-activity" };
    var list = [];
    for (var i = 0; i < 4; i++) {
      var type = types[(i + players.indexOf(player)) % types.length];
      list.push({
        date: daysAgo(i),
        type: type,
        minutes: Math.max(20, Math.round(player.minutes / 8) + (i === 0 ? 15 : 0)),
        intensity: i === 0 ? "high" : i === 3 ? "low" : "mid",
        icon: icons[type]
      });
    }
    return list;
  }

  function gamesFor(player) {
    var opponents = ["○○중학교", "△△중학교", "□□중학교"];
    var results = ["승", "승", "패"];
    return opponents.map(function (opponent, index) {
      return {
        date: daysAgo(index * 3 + 2),
        opponent: opponent,
        result: results[index],
        score: index === 2 ? "2 : 5" : index === 0 ? "6 : 3" : "4 : 2",
        performance: index === 0 ? "3타수 2안타 1타점" : index === 1 ? "4타수 1안타" : "3타수 1안타"
      };
    });
  }

  function renderDrawer(player) {
    currentPlayer = player;
    var tone = player.tone || "green";
    var status = statusOf(player);
    var goals = player.goals || [];
    var notes = allNotes.filter(function (note) {
      return note.playerId === player.id;
    });

    document.getElementById("drawerTitle").textContent = player.name + " 선수";
    document.getElementById("drawerSub").textContent =
      player.team + " · " + player.position + " · " + player.grade;

    var summary =
      '<div class="drawer-profile">' +
      '<span class="drawer-profile__avatar" style="background:var(--' +
      tone +
      '-soft);color:var(--' +
      tone +
      ')">' +
      initials(player.name) +
      "</span>" +
      '<div class="drawer-profile__id"><strong>' +
      esc(player.name) +
      "</strong><span>" +
      esc(player.position) +
      " · " +
      esc(player.grade) +
      "</span></div>" +
      '<span class="status ' +
      status.cls +
      '">' +
      status.label +
      "</span>" +
      "</div>" +
      '<div class="drawer-block">' +
      '<div class="drawer-block__title"><span>이번 주 요약</span><span>2026.10</span></div>' +
      '<div class="mini-kpi"><span>주간 훈련량</span><strong>' +
      player.minutes +
      "분</strong></div>" +
      '<div class="mini-kpi"><span>목표 달성률</span><strong>' +
      goalPct(player) +
      "%</strong></div>" +
      '<div class="mini-kpi"><span>최근 기록</span><strong style="font-size:10px">' +
      esc(player.last) +
      "</strong></div>" +
      "</div>" +
      '<div class="drawer-block">' +
      '<div class="drawer-block__title"><span>목표</span><button class="panel__link" type="button" data-add-goal-player="' +
      player.id +
      '">목표 추가</button></div>' +
      goals
        .map(function (goal) {
          return (
            '<div class="progress-row">' +
            '<div class="progress-row__head"><span>' +
            esc(goal.type) +
            " · " +
            esc(goal.title) +
            "</span><b>" +
            goal.pct +
            "%</b></div>" +
            '<div class="progress' +
            (goal.type === "장기" ? " progress--blue" : "") +
            '"><i style="--w:' +
            goal.pct +
            '%"></i></div>' +
            "</div>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="drawer-block">' +
      '<div class="drawer-block__title"><span>최근 피드백</span><span>' +
      notes.length +
      "건</span></div>" +
      (notes.length
        ? '<p style="font-size:10.5px;line-height:1.65;color:#45575b">' +
          esc(notes[0].text) +
          "</p>"
        : '<p style="font-size:10px;color:var(--muted-2)">아직 등록된 메모가 없습니다.</p>') +
      "</div>";

    var training =
      '<div class="drawer-block">' +
      '<div class="drawer-block__title"><span>최근 훈련</span><span>' +
      player.minutes +
      '분 / 주</span></div>' +
      '<div class="training-list">' +
      trainingFor(player)
        .map(function (item) {
          return (
            '<div class="training-item">' +
            '<span class="training-item__ico"><svg class="icon" aria-hidden="true"><use href="#' +
            item.icon +
            '" /></svg></span>' +
            '<div class="training-item__main"><strong>' +
            item.type +
            " · " +
            item.minutes +
            "분</strong><span>" +
            shortDate(item.date) +
            "</span></div>" +
            '<div class="training-item__meta"><span class="intensity intensity--' +
            item.intensity +
            '">강도 ' +
            (item.intensity === "high" ? "상" : item.intensity === "mid" ? "중" : "하") +
            "</span></div></div>"
          );
        })
        .join("") +
      "</div></div>" +
      '<button class="btn btn--outline btn--block btn--sm" type="button" data-note-player="' +
      player.id +
      '">이 선수에게 피드백 남기기</button>';

    var games =
      '<div class="drawer-block">' +
      '<div class="drawer-block__title"><span>최근 경기</span><span>2026 시즌</span></div>' +
      '<div class="table-wrap"><table class="data-table" style="min-width:0">' +
      "<thead><tr><th>날짜</th><th>상대</th><th>결과</th><th>성과</th></tr></thead><tbody>" +
      gamesFor(player)
        .map(function (game) {
          return (
            "<tr><td>" +
            shortDate(game.date) +
            "</td><td>" +
            game.opponent +
            "</td><td>" +
            game.result +
            " " +
            game.score +
            "</td><td>" +
            game.performance +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div></div>";

    var goalPanel =
      '<div class="goal-grid">' +
      goals
        .map(function (goal) {
          return (
            '<div class="goal-card">' +
            '<div class="goal-card__head">' +
            '<span class="goal-card__badge' +
            (goal.type === "장기" ? " goal-card__badge--long" : "") +
            '"><svg class="icon" aria-hidden="true"><use href="#i-' +
            (goal.type === "장기" ? "flag" : "target") +
            '" /></svg></span>' +
            '<div class="goal-card__title"><span>' +
            esc(goal.type) +
            " 목표 · " +
            esc(goal.due) +
            "</span><strong>" +
            esc(goal.title) +
            "</strong></div>" +
            '<span class="goal-card__pct' +
            (goal.type === "장기" ? " goal-card__pct--blue" : "") +
            '">' +
            goal.pct +
            "%</span>" +
            "</div>" +
            '<div class="progress"><i style="--w:' +
            goal.pct +
            '%"></i></div>' +
            "</div>"
          );
        })
        .join("") +
      "</div>" +
      '<button class="btn btn--dark btn--block btn--sm" type="button" data-add-goal-player="' +
      player.id +
      '" style="margin-top:10px">목표 추가</button>';

    var notePanel =
      '<div class="drawer-block">' +
      '<div class="drawer-block__title"><span>피드백 · 코칭 메모</span><span>' +
      notes.length +
      "건</span></div>" +
      '<div class="note-list">' +
      (notes.length
        ? notes
            .map(function (note) {
              var tagClass =
                note.type === "경기"
                  ? " note-item__tag--game"
                  : note.type === "태도"
                  ? " note-item__tag--attitude"
                  : "";
              return (
                '<div class="note-item"><span class="note-item__avatar">박</span><div class="note-item__body">' +
                '<div class="note-item__head"><strong>박정우 코치</strong><span>' +
                shortDate(note.date) +
                '</span><span class="note-item__tag' +
                tagClass +
                '">' +
                esc(note.type) +
                "</span></div><p>" +
                esc(note.text) +
                "</p></div></div>"
              );
            })
            .join("")
        : '<div class="empty-state"><strong>아직 메모가 없습니다.</strong><p>첫 피드백을 남겨 보세요.</p></div>') +
      "</div></div>" +
      '<button class="btn btn--dark btn--block btn--sm" type="button" data-note-player="' +
      player.id +
      '">새 메모 작성</button>';

    var content = document.getElementById("drawerContent");
    content.innerHTML =
      summary +
      '<div class="drawer__tabs" role="tablist" aria-label="선수 상세 탭">' +
      '<button class="drawer__tab is-active" type="button" data-drawer-tab="summary" role="tab" aria-selected="true">요약</button>' +
      '<button class="drawer__tab" type="button" data-drawer-tab="training" role="tab" aria-selected="false">훈련</button>' +
      '<button class="drawer__tab" type="button" data-drawer-tab="games" role="tab" aria-selected="false">경기</button>' +
      '<button class="drawer__tab" type="button" data-drawer-tab="goals" role="tab" aria-selected="false">목표</button>' +
      '<button class="drawer__tab" type="button" data-drawer-tab="notes" role="tab" aria-selected="false">메모</button>' +
      "</div>" +
      '<div data-drawer-panel="summary">' +
      training +
      "</div>" +
      '<div data-drawer-panel="training" hidden>' +
      training +
      "</div>" +
      '<div data-drawer-panel="games" hidden>' +
      games +
      "</div>" +
      '<div data-drawer-panel="goals" hidden>' +
      goalPanel +
      "</div>" +
      '<div data-drawer-panel="notes" hidden>' +
      notePanel +
      "</div>";

    /* summary panel already includes training; keep it but hide duplicated heading via order */
    currentTab = "summary";
  }

  function openDrawer(id) {
    var player = players.filter(function (item) {
      return item.id === id;
    })[0];
    if (!player) return;
    renderDrawer(player);
    var drawer = document.getElementById("playerDrawer");
    drawer.hidden = false;
    document.body.classList.add("is-locked");
    var close = drawer.querySelector("[data-drawer-close]");
    if (close) window.setTimeout(function () { close.focus(); }, 60);
  }

  function closeDrawer() {
    var drawer = document.getElementById("playerDrawer");
    if (!drawer) return;
    drawer.hidden = true;
    document.body.classList.remove("is-locked");
  }

  /* ---------------------------------------------------------------
     Goals
     --------------------------------------------------------------- */
  function fillPlayerSelects() {
    var selects = [
      document.getElementById("goalPlayer"),
      document.getElementById("goalPlayerInput"),
      document.getElementById("notePlayer"),
      document.getElementById("noteFilter")
    ];
    selects.forEach(function (select) {
      if (!select) return;
      var isFilter = select.id === "noteFilter";
      var current = select.value;
      select.innerHTML =
        (isFilter ? '<option value="all">전체 선수</option>' : "") +
        players
          .map(function (player) {
            return '<option value="' + player.id + '">' + esc(player.name) + "</option>";
          })
          .join("");
      if (current && select.querySelector('option[value="' + current + '"]')) {
        select.value = current;
      }
    });
  }

  function renderGoalCards() {
    var select = document.getElementById("goalPlayer");
    var container = document.getElementById("goalCards");
    if (!select || !container) return;
    var player = players.filter(function (item) {
      return item.id === select.value;
    })[0] || players[0];
    var goals = player.goals || [];

    container.innerHTML = goals.length
      ? goals
          .map(function (goal) {
            return (
              '<article class="goal-card">' +
              '<div class="goal-card__head">' +
              '<span class="goal-card__badge' +
              (goal.type === "장기" ? " goal-card__badge--long" : "") +
              '"><svg class="icon" aria-hidden="true"><use href="#i-' +
              (goal.type === "장기" ? "flag" : "target") +
              '" /></svg></span>' +
              '<div class="goal-card__title"><span>' +
              esc(goal.type) +
              " 목표 · " +
              esc(goal.due) +
              "</span><strong>" +
              esc(goal.title) +
              "</strong></div>" +
              '<span class="goal-card__pct' +
              (goal.type === "장기" ? " goal-card__pct--blue" : "") +
              '">' +
              goal.pct +
              "%</span>" +
              "</div>" +
              '<div class="progress"><i style="--w:' +
              goal.pct +
              '%"></i></div>' +
              '<div class="goal-card__foot"><span>' +
              esc(player.name) +
              "</span><b>" +
              (goal.pct >= 100 ? "달성" : "진행 중") +
              "</b></div>" +
              "</article>"
            );
          })
          .join("")
      : '<div class="empty-state" style="grid-column:1/-1"><strong>등록된 목표가 없습니다.</strong><p>목표 추가 버튼으로 단기·장기 목표를 설정하세요.</p></div>';
  }

  function renderTeamGoals() {
    var body = document.getElementById("teamGoalBody");
    if (!body) return;
    var sorted = players.slice().sort(function (a, b) {
      return goalPct(b) - goalPct(a);
    });
    body.innerHTML = sorted
      .map(function (player, index) {
        var goals = player.goals || [];
        var short = goals[0] || { title: "—", pct: 0 };
        var long = goals[1] || { title: "—", pct: 0 };
        return (
          "<tr>" +
          '<td><div class="table-person"><span class="table-avatar table-avatar--' +
          toneOf(player, index) +
          '">' +
          initials(player.name) +
          "</span><div><strong>" +
          esc(player.name) +
          "</strong><span>" +
          esc(player.team) +
          "</span></div></div></td>" +
          "<td>" +
          esc(short.title) +
          ' <span class="muted">' +
          short.pct +
          "%</span></td>" +
          "<td>" +
          esc(long.title) +
          ' <span class="muted">' +
          long.pct +
          "%</span></td>" +
          '<td><div class="progress-row__head" style="margin-bottom:3px"><span><b>' +
          goalPct(player) +
          '%</b></span></div><div class="progress"><i style="--w:' +
          goalPct(player) +
          '%"></i></div></td>' +
          "</tr>"
        );
      })
      .join("");
  }

  /* ---------------------------------------------------------------
     Notes
     --------------------------------------------------------------- */
  var seedNotes = [
    { id: "n1", playerId: "p1", playerName: "김하람", type: "훈련", date: daysAgo(1), text: "타격 시 하체 회전이 좋아졌습니다. 공을 끝까지 보는 연습에 집중해 주세요." },
    { id: "n2", playerId: "p2", playerName: "이서준", type: "경기", date: daysAgo(2), text: "직구 구위가 안정적이었습니다. 변화구 제구 비율을 조금 더 높여 봅시다." },
    { id: "n3", playerId: "p4", playerName: "최유진", type: "훈련", date: daysAgo(3), text: "블로킹과 송구 연결이 좋아졌습니다. 투수 리드도 안정적입니다." },
    { id: "n4", playerId: "p3", playerName: "박도윤", type: "태도", date: daysAgo(4), text: "이번 주 훈련 기록이 없습니다. 보호자와 일정을 확인한 뒤 다음 훈련 계획을 세워 주세요." }
  ];

  var storedNotes = Store.readStore(NOTES_KEY, null);
  var allNotes = Array.isArray(storedNotes) && storedNotes.length ? storedNotes : seedNotes.slice();
  if (!Array.isArray(storedNotes)) Store.writeStore(NOTES_KEY, allNotes);

  function noteItem(note) {
    var tagClass =
      note.type === "경기"
        ? " note-item__tag--game"
        : note.type === "태도"
        ? " note-item__tag--attitude"
        : "";
    return (
      '<div class="note-item"><span class="note-item__avatar">박</span><div class="note-item__body">' +
      '<div class="note-item__head"><strong>박정우 코치</strong><span>' +
      shortDate(note.date) +
      " · " +
      esc(note.playerName) +
      '</span><span class="note-item__tag' +
      tagClass +
      '">' +
      esc(note.type) +
      "</span></div><p>" +
      esc(note.text) +
      "</p></div></div>"
    );
  }

  function renderNotes() {
    var filter = document.getElementById("noteFilter");
    var playerId = filter ? filter.value : "all";
    var list = allNotes
      .slice()
      .sort(function (a, b) {
        return a.date < b.date ? 1 : -1;
      })
      .filter(function (note) {
        return playerId === "all" || note.playerId === playerId;
      });

    var container = document.getElementById("noteList");
    if (container) {
      container.innerHTML = list.length
        ? list.map(noteItem).join("")
        : '<div class="empty-state"><strong>해당 선수의 메모가 없습니다.</strong><p>첫 피드백을 남겨 보세요.</p></div>';
    }

    var recent = document.getElementById("recentNotes");
    if (recent) {
      recent.innerHTML = allNotes
        .slice()
        .sort(function (a, b) {
          return a.date < b.date ? 1 : -1;
        })
        .slice(0, 3)
        .map(noteItem)
        .join("");
    }

    var count = document.getElementById("noteCount");
    if (count) count.textContent = allNotes.length + "건";
  }

  /* ---------------------------------------------------------------
     Parent requests
     --------------------------------------------------------------- */
  function loadParentRequests() {
    var state = readLedger();
    if (state && Array.isArray(state.requests)) return state.requests;
    var stored = Store.readStore(REQUESTS_KEY, null);
    return Array.isArray(stored) ? stored : [];
  }

  function saveLedger(state) {
    if (window.SportsGrowDemo && window.SportsGrowDemo.save) {
      try {
        window.SportsGrowDemo.save(state);
        return true;
      } catch (err) {
        return false;
      }
    }
    try {
      window.localStorage.setItem(LEDGER_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      return false;
    }
  }

  function renderParentRequests() {
    var list = loadParentRequests();
    var pending = list.filter(function (req) {
      return req.status !== "done";
    }).length;

    var nav = document.getElementById("requestPendingNav");
    if (nav) nav.textContent = pending;
    var tag = document.getElementById("requestPendingTag");
    if (tag) tag.textContent = "대기 " + pending + "건";

    var container = document.getElementById("parentRequestList");
    if (!container) return;

    var sorted = list.slice().sort(function (a, b) {
      var left = String(a.createdAt || "");
      var right = String(b.createdAt || "");
      return left === right ? 0 : left < right ? 1 : -1;
    });

    if (!sorted.length) {
      container.innerHTML =
        '<div class="empty-state"><svg class="icon" aria-hidden="true"><use href="#i-mail" /></svg><strong>아직 도착한 보호자 요청이 없습니다.</strong><p>학부모 계정에서 요청을 보내면 이곳에 표시됩니다.</p></div>';
      return;
    }

    container.innerHTML = sorted
      .map(function (req) {
        var done = req.status === "done";
        return (
          '<article class="request-card">' +
          '<div class="request-card__head">' +
          '<span class="request-card__ico"><svg class="icon" aria-hidden="true"><use href="#i-mail" /></svg></span>' +
          '<div class="request-card__title"><strong>' +
          esc(req.title) +
          "</strong><span>" +
          esc(req.type) +
          " · " +
          esc(req.createdLabel || "") +
          " · " +
          esc(req.parent || "학부모") +
          "</span></div>" +
          '<span class="tag ' +
          (done ? "tag--green" : "tag--gold") +
          '">' +
          (done ? "확인 완료" : "답변 대기") +
          "</span></div>" +
          "<p>" +
          esc(req.body) +
          "</p>" +
          '<div class="request-card__foot"><span>대상 · ' +
          esc(req.player || "김하람") +
          " 선수</span>" +
          (done
            ? '<button class="btn btn--outline btn--sm" type="button" data-request-reopen="' +
              esc(req.id) +
              '">대기로 되돌리기</button>'
            : '<button class="btn btn--dark btn--sm" type="button" data-request-done="' +
              esc(req.id) +
              '"><svg class="icon" aria-hidden="true"><use href="#i-check" /></svg>확인 완료</button>') +
          "</div></article>"
        );
      })
      .join("");
  }

  function updateRequestStatus(id, status) {
    var state = readLedger();
    var list = state && Array.isArray(state.requests) ? state.requests : null;
    var onLedger = !!list;

    if (!list) list = loadParentRequests();

    var target = null;
    list.forEach(function (req) {
      if (req.id === id) {
        req.status = status;
        req.updatedAt = new Date().toISOString();
        target = req;
      }
    });
    if (!target) return;

    if (onLedger) {
      if (!saveLedger(state)) {
        Store.toast("데모 원장을 저장하지 못했습니다.", "warn");
        return;
      }
    } else {
      Store.writeStore(REQUESTS_KEY, list);
    }

    renderParentRequests();
    Store.toast(
      status === "done" ? "요청을 확인 완료로 표시했습니다." : "요청을 대기 상태로 되돌렸습니다."
    );
  }

  document.addEventListener("click", function (event) {
    var done = event.target.closest("[data-request-done]");
    if (done) {
      updateRequestStatus(done.getAttribute("data-request-done"), "done");
      return;
    }
    var reopen = event.target.closest("[data-request-reopen]");
    if (reopen) {
      updateRequestStatus(reopen.getAttribute("data-request-reopen"), "pending");
    }
  });

  var requestRefresh = document.getElementById("requestRefresh");
  if (requestRefresh) {
    requestRefresh.addEventListener("click", function () {
      renderParentRequests();
      Store.toast("보호자 요청을 새로 불러왔습니다.");
    });
  }

  /* ---------------------------------------------------------------
     Init
     --------------------------------------------------------------- */
  renderWeeklyTop();
  renderAlerts();
  renderOverviewTable();
  renderRoster();
  fillPlayerSelects();
  renderGoalCards();
  renderTeamGoals();
  renderNotes();
  renderParentRequests();

  var search = document.getElementById("rosterSearch");
  if (search) search.addEventListener("input", renderRoster);
  ["rosterTeam", "rosterSort"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("change", renderRoster);
  });

  var goalSelect = document.getElementById("goalPlayer");
  if (goalSelect) {
    goalSelect.addEventListener("change", function () {
      renderGoalCards();
      var input = document.getElementById("goalPlayerInput");
      if (input) input.value = goalSelect.value;
    });
  }

  var noteFilter = document.getElementById("noteFilter");
  if (noteFilter) noteFilter.addEventListener("change", renderNotes);

  document.addEventListener("click", function (event) {
    var playerBtn = event.target.closest("[data-player]");
    if (playerBtn) {
      openDrawer(playerBtn.getAttribute("data-player"));
      return;
    }

    var close = event.target.closest("[data-drawer-close]");
    if (close) {
      closeDrawer();
      return;
    }

    var tab = event.target.closest("[data-drawer-tab]");
    if (tab) {
      var key = tab.getAttribute("data-drawer-tab");
      document.querySelectorAll("[data-drawer-tab]").forEach(function (btn) {
        var on = btn === tab;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      document.querySelectorAll("[data-drawer-panel]").forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-drawer-panel") !== key;
      });
      return;
    }

    var addGoal = event.target.closest("[data-add-goal-player]");
    if (addGoal) {
      var playerId = addGoal.getAttribute("data-add-goal-player");
      closeDrawer();
      var input = document.getElementById("goalPlayerInput");
      if (input) input.value = playerId;
      if (window.AppShell) window.AppShell.openModal("goalModal");
      return;
    }

    var noteBtn = event.target.closest("[data-note-player]");
    if (noteBtn) {
      var id = noteBtn.getAttribute("data-note-player");
      closeDrawer();
      var select = document.getElementById("notePlayer");
      if (select) select.value = id;
      if (window.AppShell) window.AppShell.showView("feedback", { alwaysScroll: true });
      var text = document.getElementById("noteText");
      if (text) window.setTimeout(function () { text.focus(); }, 450);
      return;
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      var drawer = document.getElementById("playerDrawer");
      if (drawer && !drawer.hidden) closeDrawer();
    }
  });

  /* goal form */
  var goalForm = document.getElementById("goalForm");
  if (goalForm) {
    goalForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var playerId = document.getElementById("goalPlayerInput").value;
      var type = document.getElementById("goalType").value;
      var title = document.getElementById("goalTitle").value.trim();
      var pct = Math.max(0, Math.min(100, Number(document.getElementById("goalPct").value) || 0));
      var dueValue = document.getElementById("goalDue").value;
      var due = dueValue ? dueValue.replace(/-/g, ".") : "—";

      if (!playerId || !title) {
        Store.toast("선수와 목표 내용을 입력해 주세요.", "warn");
        return;
      }

      var player = players.filter(function (item) {
        return item.id === playerId;
      })[0];
      if (!player) return;
      if (!player.goals) player.goals = [];
      player.goals.push({ type: type, title: title, pct: pct, due: due });
      goalOverrides[player.id] = player.goals;
      Store.writeStore(GOALS_KEY, goalOverrides);

      var selected = document.getElementById("goalPlayer");
      if (selected) selected.value = player.id;
      renderGoalCards();
      renderTeamGoals();

      goalForm.reset();
      document.getElementById("goalModal").hidden = true;
      document.body.classList.remove("is-locked");
      var dateInput = document.getElementById("goalDue");
      if (dateInput) dateInput.value = "";
      Store.toast(player.name + " 선수의 " + type + " 목표를 추가했습니다.");
    });
  }

  /* note form */
  var noteForm = document.getElementById("noteForm");
  if (noteForm) {
    noteForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var playerId = document.getElementById("notePlayer").value;
      var type = document.getElementById("noteType").value;
      var text = document.getElementById("noteText").value.trim();
      if (!text) {
        Store.toast("메모 내용을 입력해 주세요.", "warn");
        return;
      }
      var player = players.filter(function (item) {
        return item.id === playerId;
      })[0];
      if (!player) return;

      allNotes.push({
        id: "n-" + Date.now(),
        playerId: player.id,
        playerName: player.name,
        type: type,
        date: daysAgo(0),
        text: text
      });
      Store.writeStore(NOTES_KEY, allNotes);
      renderNotes();
      var filter = document.getElementById("noteFilter");
      if (filter) filter.value = "all";
      noteForm.reset();
      Store.toast(player.name + " 선수에게 피드백을 남겼습니다.");
    });
  }

  var template = document.getElementById("noteTemplate");
  if (template) {
    template.addEventListener("click", function () {
      var text = document.getElementById("noteText");
      if (text) {
        text.value =
          "이번 주 훈련 참여가 꾸준했습니다. 다음 주에는 " +
          "하체 중심 이동과 공을 끝까지 보는 연습에 집중해 주세요.";
        text.focus();
      }
    });
  }

  var jump = document.getElementById("jumpFeedback");
  if (jump) {
    jump.addEventListener("click", function () {
      if (window.AppShell) window.AppShell.showView("feedback", { alwaysScroll: true });
      var text = document.getElementById("noteText");
      if (text) window.setTimeout(function () { text.focus(); }, 400);
    });
  }

  var review = document.getElementById("alertReview");
  if (review) {
    review.addEventListener("click", function () {
      if (window.AppShell) window.AppShell.showView("overview");
      var table = document.getElementById("overviewTableBody");
      if (table) {
        var panel = table.closest(".panel");
        if (panel) {
          window.setTimeout(function () {
            panel.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 80);
        }
      }
      Store.toast("통합 현황에서 상태와 최근 기록을 확인하세요.");
    });
  }

  var bell = document.getElementById("notificationsBtn");
  if (bell) {
    bell.addEventListener("click", function () {
      Store.toast("알림 3건 · 기록 미입력 3명, 목표 지연 2명, 새 메모 1건");
    });
  }

  /* add player */
  var playerForm = document.getElementById("playerForm");
  if (playerForm) {
    playerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = document.getElementById("playerName").value.trim();
      var position = document.getElementById("playerPosition").value.trim();
      var grade = document.getElementById("playerGrade").value.trim();
      var team = document.getElementById("playerTeam").value;
      var goal = Number(document.getElementById("playerGoal").value) || 50;
      if (!name || !position || !grade) {
        Store.toast("선수 이름, 포지션, 학년을 입력해 주세요.", "warn");
        return;
      }

      var newPlayer = {
        id: "p-" + Date.now(),
        name: name,
        position: position,
        grade: grade,
        team: team,
        minutes: 0,
        goal: goal,
        last: "신규 등록 · 기록 없음",
        tone: TONES[players.length % TONES.length],
        goals: makeGoals("첫 주 훈련 기록 3회", "시즌 기본 목표 달성", 0, 0),
        note: "신규 등록 선수입니다."
      };
      players.push(newPlayer);
      custom.push(newPlayer);
      Store.writeStore(CUSTOM_KEY, custom);
      Store.writeStore(GOALS_KEY, goalOverrides);

      renderWeeklyTop();
      renderAlerts();
      renderOverviewTable();
      renderRoster();
      fillPlayerSelects();
      renderGoalCards();
      renderTeamGoals();
      renderNotes();

      playerForm.reset();
      document.getElementById("playerModal").hidden = true;
      document.body.classList.remove("is-locked");
      Store.toast(name + " 선수를 등록했습니다.");
    });
  }
})();
