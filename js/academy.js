/* =====================================================================
   SPORTS GROW — academy & federation dashboard
   ===================================================================== */
(function () {
  "use strict";

  if (window.SportsGrowApi && window.SportsGrowApi.enabled) return;

  var Store = window.AppShell || {
    readStore: function (key, fallback) {
      return fallback;
    },
    writeStore: function () {
      return false;
    },
    toast: function () {}
  };

  var TEAM_KEY = "sportsgrow.academy.teams.v1";
  var TONES = ["green", "blue", "clay", "violet"];
  var DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
  var AGE_GROUPS = ["U12", "U15", "U18"];
  var SPORT_COLORS = ["#0e6b4e", "#b7d93f", "#2f5fe0", "#c25a34", "#7b61c9", "#c9a227"];

  var PERIODS = {
    month: { key: "month", label: "이번 달", part: 0, goal: 0, months: 1 },
    quarter: { key: "quarter", label: "최근 3개월", part: 1.2, goal: 2.4, months: 3 },
    half: { key: "half", label: "최근 6개월", part: 2.1, goal: 4.2, months: 6 },
    year: { key: "year", label: "올해", part: 2.8, goal: 5.8, months: 10 }
  };

  var REPORT_PERIODS = {
    month: { label: "2026년 10월", range: "2026.10.01 ~ 2026.10.28" },
    quarter: { label: "2026년 3분기", range: "2026.07.01 ~ 2026.09.30" },
    half: { label: "2026년 상반기", range: "2026.01.01 ~ 2026.06.30" },
    year: { label: "2026년 연간", range: "2026.01.01 ~ 2026.10.28" }
  };

  var REPORT_TYPES = {
    monthly: {
      name: "기관 운영 보고서",
      icon: "i-file",
      tone: "green",
      note: "기관 전체 운영 지표와 팀별 현황을 요약합니다."
    },
    participation: {
      name: "훈련 참여 분석",
      icon: "i-check-circle",
      tone: "blue",
      note: "팀별 훈련 참여율과 기록 입력률을 비교합니다."
    },
    age: {
      name: "연령대별 성장 리포트",
      icon: "i-users",
      tone: "violet",
      note: "연령대별 훈련량과 목표 달성 수준을 분석합니다."
    },
    goal: {
      name: "목표 달성 요약",
      icon: "i-target",
      tone: "clay",
      note: "단기·장기 목표 달성률과 지원 필요 선수를 정리합니다."
    }
  };

  var SEED_TEAMS = [
    {
      id: "t1", name: "한빛중 야구부", sport: "야구", age: "U15", coach: "박정우",
      players: 12, weekly: 230, participation: 86, goal: 68,
      venue: "한빛중 운동장", since: "2023.03", tone: "green"
    },
    {
      id: "t2", name: "한빛고 축구부", sport: "축구", age: "U18", coach: "이지훈",
      players: 22, weekly: 250, participation: 91, goal: 74,
      venue: "한빛고 인조구장", since: "2022.09", tone: "blue"
    },
    {
      id: "t3", name: "한빛중 농구부", sport: "농구", age: "U15", coach: "최수빈",
      players: 14, weekly: 210, participation: 78, goal: 66,
      venue: "한빛체육관", since: "2024.01", tone: "clay"
    },
    {
      id: "t4", name: "한빛고 배구부", sport: "배구", age: "U18", coach: "정다은",
      players: 16, weekly: 245, participation: 88, goal: 72,
      venue: "한빛체육관", since: "2023.06", tone: "violet"
    },
    {
      id: "t5", name: "한빛 육상클럽", sport: "육상", age: "U12", coach: "김태윤",
      players: 18, weekly: 195, participation: 81, goal: 63,
      venue: "한빛종합운동장", since: "2024.08", tone: "green"
    }
  ];

  var SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"];
  var GIVEN_NAMES = [
    "하람", "서준", "도윤", "유진", "민재", "태오", "지호", "도현", "세훈", "지안",
    "하준", "준서", "예준", "시우", "주원", "건우", "우진", "선우", "연우", "유준",
    "정우", "승현", "지훈", "민성", "재윤", "현우", "수빈", "다은", "지민", "서연",
    "하은", "윤서", "채원", "지우", "민서", "예린", "수아", "다인", "유나", "가은"
  ];

  var POSITIONS = {
    야구: ["투수", "포수", "내야수", "외야수", "유격수"],
    축구: ["GK", "DF", "MF", "FW"],
    농구: ["가드", "포워드", "센터"],
    배구: ["세터", "리베로", "아웃사이드", "미들블로커"],
    육상: ["단거리", "중거리", "도약", "투척"],
    기타: ["선수"]
  };

  var TEAM_WEEKLY = { 야구: 230, 축구: 240, 농구: 210, 배구: 235, 육상: 200, 기타: 210 };

  /* ---------------------------------------------------------------
     Helpers
     --------------------------------------------------------------- */
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function sum(list, getter) {
    return list.reduce(function (total, item) {
      return total + (getter ? getter(item) : item);
    }, 0);
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function ledgerNumber(method, player) {
    var api = window.SportsGrowDemo;
    if (!player || !api || typeof api[method] !== "function") return null;
    try {
      var value = api[method](player);
      return typeof value === "number" && isFinite(value) ? value : null;
    } catch (err) {
      return null;
    }
  }

  function fileStamp() {
    var d = new Date();
    return (
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function periodOf(key) {
    return PERIODS[key] || PERIODS.month;
  }

  function normalizeTeam(team, index) {
    return {
      id: String(team.id || "team-" + index),
      name: String(team.name || "이름 없는 팀"),
      sport: POSITIONS[team.sport] ? team.sport : "기타",
      age: AGE_GROUPS.indexOf(team.age) >= 0 ? team.age : "U15",
      coach: String(team.coach || "미지정"),
      players: clamp(Number(team.players) || 12, 1, 60),
      weekly: clamp(Number(team.weekly) || TEAM_WEEKLY[team.sport] || 210, 60, 480),
      participation: clamp(Number(team.participation) || 80, 0, 100),
      goal: clamp(Number(team.goal) || 65, 0, 100),
      venue: String(team.venue || "미등록"),
      since: String(team.since || "2026.01"),
      tone: team.tone || TONES[index % TONES.length]
    };
  }

  var customTeams = Store.readStore(TEAM_KEY, []);
  if (!Array.isArray(customTeams)) customTeams = [];
  customTeams = customTeams.filter(function (team) {
    return team && team.name;
  }).map(normalizeTeam);

  var teams = SEED_TEAMS.map(normalizeTeam).concat(customTeams);
  var players = [];
  var teamById = {};
  var currentPeriod = "month";
  var playerPage = 1;
  var PER_PAGE = 10;

  teams.forEach(function (team) {
    teamById[team.id] = team;
  });

  /* ---------------------------------------------------------------
     Player generation
     --------------------------------------------------------------- */
  function gradeFor(age, index) {
    var map = {
      U12: ["초5", "초6", "중1"],
      U15: ["중1", "중2", "중3"],
      U18: ["고1", "고2", "고3"]
    };
    var list = map[age] || map.U15;
    return list[index % list.length];
  }

  function haramTeam() {
    var baseball = teams.filter(function (team) {
      return team.sport === "야구";
    });
    var u15 = baseball.filter(function (team) {
      return team.age === "U15";
    })[0];
    return u15 || baseball[0] || teams[0] || null;
  }

  function haramRecord(team, slot) {
    var player = ledgerPlayer(readLedger());
    var weekly = ledgerNumber("weekMinutes", player);
    var goal = ledgerNumber("goalAverage", player);
    var positions = POSITIONS[team.sport] || POSITIONS.기타;
    return {
      id: "p-haram",
      name: "김하람",
      teamId: team.id,
      team: team.name,
      sport: team.sport,
      age: team.age,
      grade: gradeFor(team.age, 1),
      position: slot && slot.position ? slot.position : positions[0],
      weekly: weekly == null ? 320 : Math.max(0, Math.round(weekly)),
      participation: slot ? slot.participation : 82,
      goal: goal == null ? 0 : clamp(goal, 0, 100),
      tone: slot && slot.tone ? slot.tone : "green"
    };
  }

  function ensureHaram() {
    var team = haramTeam();
    if (!team) return;

    var slotIndex = -1;
    players.forEach(function (player, index) {
      if (player.name === "김하람" || player.id === "p-haram") slotIndex = index;
    });
    if (slotIndex < 0) {
      players.forEach(function (player, index) {
        if (slotIndex < 0 && player.teamId === team.id) slotIndex = index;
      });
    }

    var slot = slotIndex >= 0 ? players[slotIndex] : null;
    var record = haramRecord(team, slot);
    if (slotIndex >= 0) players[slotIndex] = record;
    else players.push(record);
  }

  function buildPlayers() {
    players = [];
    teamById = {};
    var usedNames = {};

    teams.forEach(function (team, teamIndex) {
      teamById[team.id] = team;
      var count = team.players;
      var positions = POSITIONS[team.sport] || POSITIONS.기타;

      for (var i = 0; i < count; i++) {
        var seed = teamIndex * 17 + i * 7;
        var name = SURNAMES[seed % SURNAMES.length] + GIVEN_NAMES[(seed * 3 + i) % GIVEN_NAMES.length];
        var attempt = 0;
        while (usedNames[name] && attempt < 40) {
          name =
            SURNAMES[(seed + attempt + 1) % SURNAMES.length] +
            GIVEN_NAMES[(seed * 3 + i + attempt * 5 + 3) % GIVEN_NAMES.length];
          attempt++;
        }
        usedNames[name] = true;

        var weekly = clamp(team.weekly + (((i * 37 + teamIndex * 11) % 9) - 4) * 5, 80, 440);
        var participation = clamp(team.participation + (((i * 13 + teamIndex * 5) % 17) - 8), 52, 99);
        var goal = clamp(team.goal + (((i * 19 + teamIndex * 7) % 31) - 15), 18, 98);

        players.push({
          id: team.id + "-p" + (i + 1),
          name: name,
          teamId: team.id,
          team: team.name,
          sport: team.sport,
          age: team.age,
          grade: gradeFor(team.age, i + teamIndex),
          position: positions[i % positions.length],
          weekly: weekly,
          participation: participation,
          goal: goal,
          tone: TONES[(teamIndex + i) % TONES.length]
        });
      }
    });

    ensureHaram();
  }

  function effectivePart(value, period) {
    return clamp(value + period.part, 0, 100);
  }

  function effectiveGoal(value, period) {
    return clamp(value + period.goal, 0, 100);
  }

  function playerPart(player, period) {
    return effectivePart(player.participation, period || periodOf(currentPeriod));
  }

  function playerGoal(player, period) {
    return effectiveGoal(player.goal, period || periodOf(currentPeriod));
  }

  function playerStatus(player, period) {
    var part = playerPart(player, period);
    var goal = playerGoal(player, period);
    if (part < 72) return { cls: "status--risk", label: "지원 필요", weight: 0 };
    if (goal >= 78) return { cls: "status--good", label: "순항", weight: 3 };
    if (goal >= 58) return { cls: "status--info", label: "진행", weight: 2 };
    return { cls: "status--warn", label: "관찰", weight: 1 };
  }

  function teamStatus(team, period) {
    var part = effectivePart(team.participation, period);
    var goal = effectiveGoal(team.goal, period);
    if (part < 76) return { cls: "status--risk", label: "지원 필요" };
    if (goal >= 72) return { cls: "status--good", label: "순항" };
    if (goal >= 66) return { cls: "status--info", label: "진행" };
    return { cls: "status--warn", label: "관찰" };
  }

  function playersOfTeam(teamId) {
    return players.filter(function (player) {
      return player.teamId === teamId;
    });
  }

  function totalsFor(list, period) {
    var result = { teams: list.length, players: 0, part: 0, goal: 0 };
    list.forEach(function (team) {
      var count = team.players;
      result.players += count;
      result.part += effectivePart(team.participation, period) * count;
      result.goal += effectiveGoal(team.goal, period) * count;
    });
    result.part = result.players ? result.part / result.players : 0;
    result.goal = result.players ? result.goal / result.players : 0;
    return result;
  }

  function playerTotals(list, period) {
    if (!list.length) return { players: 0, part: 0, goal: 0 };
    return {
      players: list.length,
      part: sum(list, function (player) { return playerPart(player, period); }) / list.length,
      goal: sum(list, function (player) { return playerGoal(player, period); }) / list.length
    };
  }

  function uniqueSports() {
    var seen = {};
    var list = [];
    teams.forEach(function (team) {
      if (!seen[team.sport]) {
        seen[team.sport] = true;
        list.push(team.sport);
      }
    });
    return list;
  }

  /* ---------------------------------------------------------------
     Overview
     --------------------------------------------------------------- */
  function renderOverview() {
    var period = periodOf(currentPeriod);
    var totals = totalsFor(teams, period);
    var sports = uniqueSports();
    var ageCounts = { U12: 0, U15: 0, U18: 0 };
    teams.forEach(function (team) {
      ageCounts[team.age] = (ageCounts[team.age] || 0) + team.players;
    });

    setText("kpiPlayers", "");
    document.getElementById("kpiPlayers").innerHTML = totals.players + "<small>명</small>";
    document.getElementById("kpiTeams").innerHTML = totals.teams + "<small>팀</small>";
    document.getElementById("kpiParticipation").innerHTML =
      Math.round(totals.part) + "<small>%</small>";
    document.getElementById("kpiGoal").innerHTML = Math.round(totals.goal) + "<small>%</small>";

    setText("kpiPlayersFoot", totals.teams + "개 팀 · " + period.label + " 기준");
    setText("kpiTeamsFoot", sports.length + "개 종목 · 평균 " + round1(totals.players / (totals.teams || 1)) + "명");
    document.getElementById("kpiParticipationFoot").innerHTML =
      '<span class="delta' +
      (totals.part >= 85 ? "" : " delta--neutral") +
      '"><svg class="icon" aria-hidden="true"><use href="#i-trend" /></svg>' +
      (totals.part >= 85 ? "목표 이상" : round1(85 - totals.part) + "%p 부족") +
      "</span> 기관 목표 85%";
    setText(
      "kpiGoalFoot",
      "단기 " + Math.round(clamp(totals.goal + 4, 0, 100)) + "% · 장기 " +
        Math.round(clamp(totals.goal - 9, 0, 100)) + "%"
    );

    renderTrend(totals.part, period);
    renderDonut();
    renderTeamOverview(period);
    renderInsights(period, totals);
    renderGoalDistribution(period);
    renderTeamSummaries(period, totals, ageCounts);
    updateStaticCounts();
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function updateStaticCounts() {
    var navCount = document.querySelector('.sidebar__link[href="#teams"] em');
    if (navCount) navCount.textContent = teams.length;
    var tag = document.querySelector("#overview .page-head__eyebrow .tag");
    if (tag) tag.textContent = teams.length + "개 팀 · " + players.length + "명";
  }

  function monthLabels(count) {
    var labels = [];
    var now = new Date();
    for (var i = count - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.getMonth() + 1 + "월");
    }
    return labels;
  }

  function renderTrend(part, period) {
    var el = document.getElementById("trendChart");
    if (!el) return;
    var labels = monthLabels(6);
    var offsets = [-4.4, -2.9, -1.5, 0.3, 1.4, 2.6];
    var values = offsets.map(function (offset) {
      return clamp(part + offset, 45, 99);
    });

    var W = 640;
    var H = 218;
    var left = 38;
    var right = 14;
    var top = 16;
    var bottom = 30;
    var target = 85;
    var minV = Math.floor((Math.min.apply(null, values.concat([target])) - 3) / 5) * 5;
    var maxV = Math.ceil((Math.max.apply(null, values.concat([target])) + 3) / 5) * 5;
    var plotW = W - left - right;
    var plotH = H - top - bottom;

    function x(i) {
      return left + (plotW * i) / (values.length - 1);
    }

    function y(value) {
      return top + plotH - ((value - minV) / (maxV - minV || 1)) * plotH;
    }

    var grid = "";
    var axis = "";
    for (var g = 0; g <= 4; g++) {
      var value = minV + ((maxV - minV) * g) / 4;
      var gy = y(value);
      grid +=
        '<line x1="' + left + '" y1="' + gy.toFixed(1) + '" x2="' + (W - right) +
        '" y2="' + gy.toFixed(1) + '" />';
      axis +=
        '<text x="' + (left - 7) + '" y="' + (gy + 3).toFixed(1) +
        '" text-anchor="end">' + Math.round(value) + "</text>";
    }

    labels.forEach(function (label, index) {
      axis +=
        '<text x="' + x(index).toFixed(1) + '" y="' + (H - 8) +
        '" text-anchor="middle">' + label + "</text>";
    });

    var points = values.map(function (value, index) {
      return [x(index), y(value)];
    });
    var line = points
      .map(function (point, index) {
        return (index ? "L" : "M") + point[0].toFixed(1) + " " + point[1].toFixed(1);
      })
      .join(" ");
    var area =
      line +
      " L" + points[points.length - 1][0].toFixed(1) + " " + (top + plotH) +
      " L" + points[0][0].toFixed(1) + " " + (top + plotH) + " Z";

    var dots = points
      .map(function (point, index) {
        return (
          '<circle class="line-chart__dot' +
          (index === points.length - 1 ? " line-chart__dot--peak" : "") +
          '" cx="' + point[0].toFixed(1) + '" cy="' + point[1].toFixed(1) +
          '" r="3.1"><title>' + labels[index] + " · " + round1(values[index]) +
          "%</title></circle>"
        );
      })
      .join("");

    el.innerHTML =
      '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="최근 6개월 훈련 참여율 추이">' +
      '<defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#0e6b4e" stop-opacity=".2" />' +
      '<stop offset="100%" stop-color="#0e6b4e" stop-opacity="0" />' +
      "</linearGradient></defs>" +
      '<g class="line-chart__grid">' + grid + "</g>" +
      '<g class="line-chart__axis">' + axis + "</g>" +
      '<line x1="' + left + '" y1="' + y(target).toFixed(1) + '" x2="' + (W - right) +
      '" y2="' + y(target).toFixed(1) +
      '" stroke="#c25a34" stroke-width="1.2" stroke-dasharray="5 4" opacity=".7" />' +
      '<path class="line-chart__area" d="' + area + '" />' +
      '<path class="line-chart__line" d="' + line + '" />' +
      dots +
      "</svg>";

    var delta = values[values.length - 1] - values[0];
    var deltaEl = document.getElementById("trendDelta");
    if (deltaEl) {
      deltaEl.textContent = (delta >= 0 ? "+" : "") + round1(delta) + "%";
      deltaEl.className = "tag " + (delta >= 0 ? "tag--green" : "tag--clay");
    }
    setText("trendSub", "최근 6개월 · 전체 종목");
    setText(
      "trendSummary",
      "6개월 평균 참여율 " +
        Math.round(sum(values, function (v) { return v; }) / values.length) +
        "% · 기관 목표 85%"
    );
  }

  function renderDonut() {
    var donut = document.getElementById("sportDonut");
    var legend = document.getElementById("sportLegend");
    if (!donut || !legend) return;

    var counts = {};
    teams.forEach(function (team) {
      counts[team.sport] = (counts[team.sport] || 0) + team.players;
    });
    var entries = Object.keys(counts)
      .map(function (sport) {
        return { sport: sport, count: counts[sport] };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });
    var total = sum(entries, function (entry) { return entry.count; });

    var cursor = 0;
    var stops = entries.map(function (entry, index) {
      var start = cursor;
      cursor += (entry.count / total) * 100;
      return SPORT_COLORS[index % SPORT_COLORS.length] + " " + start.toFixed(1) + "% " + cursor.toFixed(1) + "%";
    });
    donut.style.background = "conic-gradient(" + stops.join(", ") + ")";
    setText("donutTotal", total);
    setText("donutSub", "전체 " + total + "명 · " + entries.length + "개 종목");

    legend.innerHTML = entries
      .map(function (entry, index) {
        return (
          '<div><i style="background:' + SPORT_COLORS[index % SPORT_COLORS.length] +
          '"></i>' + esc(entry.sport) + " <b>" + entry.count + "명</b></div>"
        );
      })
      .join("");

    var largest = entries[0];
    if (largest) setText("largestTeam", largest.sport + " · " + largest.count + "명");
    setText("avgTeamSize", round1(total / (teams.length || 1)) + "명");
  }

  function renderTeamOverview(period) {
    var body = document.getElementById("teamOverviewBody");
    if (!body) return;
    body.innerHTML = teams
      .map(function (team) {
        var status = teamStatus(team, period);
        var part = Math.round(effectivePart(team.participation, period));
        var goal = Math.round(effectiveGoal(team.goal, period));
        return (
          "<tr>" +
          '<td><div class="table-person"><span class="table-avatar table-avatar--' +
          team.tone + '">' + esc(team.name.charAt(0)) + "</span><div><strong>" +
          esc(team.name) + "</strong><span>" + esc(team.coach) + " 코치</span></div></div></td>" +
          "<td>" + esc(team.sport) + "</td>" +
          "<td>" + esc(team.age) + "</td>" +
          '<td class="num">' + team.players + "명</td>" +
          '<td class="num">' + team.weekly + "분</td>" +
          '<td class="num"><strong>' + part + '%</strong></td>' +
          '<td class="num">' + goal + "%</td>" +
          '<td><span class="status ' + status.cls + '">' + status.label + "</span></td>" +
          '<td><div class="table-actions"><button type="button" data-team="' + team.id +
          '" aria-label="' + esc(team.name) + ' 상세 보기"><svg class="icon" aria-hidden="true"><use href="#i-arrow" /></svg></button></div></td>' +
          "</tr>"
        );
      })
      .join("");
  }

  function renderInsights(period, totals) {
    var list = document.getElementById("insightList");
    if (!list) return;
    var sortedPart = teams.slice().sort(function (a, b) {
      return effectivePart(a.participation, period) - effectivePart(b.participation, period);
    });
    var sortedGoal = teams.slice().sort(function (a, b) {
      return effectiveGoal(b.goal, period) - effectiveGoal(a.goal, period);
    });
    var lowest = sortedPart[0];
    var highest = sortedGoal[0];
    if (!lowest) {
      list.innerHTML =
        '<div class="empty-state"><strong>분석할 팀이 없습니다.</strong><p>팀을 먼저 등록해 주세요.</p></div>';
      return;
    }

    var missing = Math.round(totals.players * (1 - totals.part / 100));
    var partGap = round1(totals.part - effectivePart(lowest.participation, period));
    var items = [
      {
        tone: "risk",
        icon: "i-clock",
        title: esc(lowest.name) + " 참여율 " + Math.round(effectivePart(lowest.participation, period)) + "%",
        desc: "기관 평균보다 " + partGap + "%p 낮습니다. 훈련 일정과 결석 사유를 확인해 보세요.",
        team: lowest.id,
        action: "팀 보기"
      },
      {
        tone: "good",
        icon: "i-trophy",
        title: esc(highest.name) + " 목표 달성 " + Math.round(effectiveGoal(highest.goal, period)) + "%",
        desc: "이번 기간 가장 높은 달성률입니다. 우수 사례를 다른 팀과 공유해 보세요.",
        team: highest.id,
        action: "사례 보기"
      },
      {
        tone: "gold",
        icon: "i-bell",
        title: "기록 미입력 " + missing + "명",
        desc: "참여율 " + Math.round(totals.part) + "% 기준 추정치입니다. 코치에게 기록 입력을 요청하세요.",
        team: null,
        action: "선수 보기"
      }
    ];

    list.innerHTML = items
      .map(function (item) {
        var style =
          item.tone === "good"
            ? "background:var(--green-soft);color:var(--green)"
            : item.tone === "gold"
            ? "background:var(--gold-soft);color:var(--gold)"
            : "";
        return (
          '<div class="alert-item">' +
          '<span class="alert-item__ico alert-item__ico--risk" style="' + style +
          '"><svg class="icon" aria-hidden="true"><use href="#' + item.icon + '" /></svg></span>' +
          "<div><strong>" + item.title + "</strong><span>" + item.desc + "</span></div>" +
          '<button class="btn btn--outline btn--sm" type="button" ' +
          (item.team ? 'data-team="' + item.team + '"' : 'data-goto-players="1"') +
          ">" + item.action + "</button></div>"
        );
      })
      .join("");
  }

  function renderGoalDistribution(period) {
    var buckets = [0, 0, 0, 0];
    players.forEach(function (player) {
      var goal = playerGoal(player, period);
      if (goal >= 80) buckets[0]++;
      else if (goal >= 60) buckets[1]++;
      else if (goal >= 40) buckets[2]++;
      else buckets[3]++;
    });
    var total = players.length || 1;
    var ids = ["distAchieved", "distOnTrack", "distProgress", "distRisk"];
    var bars = ["distAchievedBar", "distOnTrackBar", "distProgressBar", "distRiskBar"];
    ids.forEach(function (id, index) {
      setText(id, buckets[index] + "명");
      var bar = document.getElementById(bars[index]);
      if (bar) bar.style.setProperty("--w", Math.round((buckets[index] / total) * 100) + "%");
    });
    setText(
      "goalDistSub",
      "전체 " + players.length + "명 · " + period.label + " 단기 목표 기준"
    );
  }

  function renderTeamSummaries(period, totals, ageCounts) {
    var weeklyTotal = sum(teams, function (team) { return team.weekly * team.players; });
    var recorded = sum(teams, function (team) {
      var part = effectivePart(team.participation, period);
      return team.players - Math.round(team.players * (1 - part / 100));
    });
    var missing = Math.max(0, totals.players - recorded);
    var rate = totals.players ? Math.round((recorded / totals.players) * 100) : 0;

    setText("sumWeekly", weeklyTotal.toLocaleString("ko-KR") + "분");
    setText("sumAvgWeekly", Math.round(weeklyTotal / (totals.players || 1)) + "분");
    setText(
      "sumGoalTeams",
      teams.filter(function (team) { return effectiveGoal(team.goal, period) >= 70; }).length + "개 팀"
    );
    setText("sumRecorded", recorded + " / " + totals.players + "명");
    setText("sumRecordRate", rate + "%");
    setText("sumMissing", missing + "명");
    setText(
      "sumU12",
      ageCounts.U12 + "명 · " + Math.round((ageCounts.U12 / (totals.players || 1)) * 100) + "%"
    );
    setText(
      "sumU15",
      ageCounts.U15 + "명 · " + Math.round((ageCounts.U15 / (totals.players || 1)) * 100) + "%"
    );
    setText(
      "sumU18",
      ageCounts.U18 + "명 · " + Math.round((ageCounts.U18 / (totals.players || 1)) * 100) + "%"
    );
  }

  /* ---------------------------------------------------------------
     Teams
     --------------------------------------------------------------- */
  function renderTeams() {
    var body = document.getElementById("teamTableBody");
    if (!body) return;
    var query = (val("teamSearch") || "").trim().toLowerCase();
    var sport = val("teamSport") || "all";
    var age = val("teamAge") || "all";
    var period = periodOf(currentPeriod);

    var list = teams.filter(function (team) {
      var haystack = (team.name + " " + team.coach).toLowerCase();
      return (
        (sport === "all" || team.sport === sport) &&
        (age === "all" || team.age === age) &&
        (!query || haystack.indexOf(query) !== -1)
      );
    });

    body.innerHTML = list.length
      ? list
          .map(function (team) {
            var status = teamStatus(team, period);
            return (
              "<tr>" +
              '<td><div class="table-person"><span class="table-avatar table-avatar--' +
              team.tone + '">' + esc(team.name.charAt(0)) + "</span><div><strong>" +
              esc(team.name) + "</strong><span>" + esc(team.venue) + "</span></div></div></td>" +
              "<td><span class=\"tag tag--outline\">" + esc(team.sport) + "</span> " + esc(team.age) + "</td>" +
              "<td>" + esc(team.coach) + "</td>" +
              '<td class="num">' + team.players + "명</td>" +
              '<td class="num">' + team.weekly + "분</td>" +
              '<td class="num"><strong>' + Math.round(effectivePart(team.participation, period)) + "%</strong></td>" +
              '<td class="num">' + Math.round(effectiveGoal(team.goal, period)) + "%</td>" +
              '<td><span class="status ' + status.cls + '">' + status.label + "</span></td>" +
              '<td><div class="table-actions"><button type="button" data-team="' + team.id +
              '" aria-label="' + esc(team.name) + ' 상세 보기"><svg class="icon" aria-hidden="true"><use href="#i-arrow" /></svg></button></div></td>' +
              "</tr>"
            );
          })
          .join("")
      : '<tr><td colspan="9"><div class="empty-state"><svg class="icon" aria-hidden="true"><use href="#i-search" /></svg><strong>조건에 맞는 팀이 없습니다.</strong><p>검색어나 필터를 변경해 보세요.</p></div></td></tr>';

    setText("teamCount", list.length + "개 팀");
    setText("teamFoot", "표시 " + list.length + "개 팀 · 전체 " + teams.length + "개 팀 · " + players.length + "명");
  }

  function openTeam(id) {
    var team = teamById[id];
    if (!team) return;
    var period = periodOf(currentPeriod);
    var status = teamStatus(team, period);
    var roster = playersOfTeam(team.id);
    var part = Math.round(effectivePart(team.participation, period));
    var goal = Math.round(effectiveGoal(team.goal, period));

    var title = document.getElementById("teamDrawerTitle");
    var sub = document.getElementById("teamDrawerSub");
    if (title) title.textContent = team.name;
    if (sub) sub.textContent = team.sport + " · " + team.age + " · " + team.coach + " 코치";

    var body = document.getElementById("teamDrawerBody");
    if (!body) return;
    body.innerHTML =
      '<div class="drawer-profile">' +
      '<span class="drawer-profile__avatar" style="background:var(--' + team.tone +
      '-soft);color:var(--' + team.tone + ')">' + esc(team.name.charAt(0)) + "</span>" +
      '<div class="drawer-profile__id"><strong>' + esc(team.name) + "</strong><span>" +
      esc(team.venue) + " · " + esc(team.since) + " 창단</span></div>" +
      '<span class="status ' + status.cls + '">' + status.label + "</span></div>" +
      '<div class="mini-kpi"><span>소속 선수</span><strong>' + team.players + "명</strong></div>" +
      '<div class="mini-kpi"><span>주간 평균 훈련</span><strong>' + team.weekly + "분</strong></div>" +
      '<div class="mini-kpi"><span>훈련 참여율</span><strong>' + part + "%</strong></div>" +
      '<div class="mini-kpi"><span>목표 달성률</span><strong>' + goal + "%</strong></div>" +
      '<div class="drawer-block"><div class="drawer-block__title"><span>지표 요약</span><span>' +
      period.label + "</span></div>" +
      '<div class="progress-row"><div class="progress-row__head"><span>훈련 참여율</span><b>' +
      part + '%</b></div><div class="progress"><i style="--w:' + part + '%"></i></div></div>' +
      '<div class="progress-row"><div class="progress-row__head"><span>목표 달성률</span><b>' +
      goal + '%</b></div><div class="progress progress--blue"><i style="--w:' + goal +
      '%"></i></div></div></div>' +
      '<div class="drawer-block"><div class="drawer-block__title"><span>소속 선수</span><span>' +
      roster.length + "명</span></div>" +
      '<div class="table-wrap"><table class="data-table" style="min-width:0">' +
      "<thead><tr><th>선수</th><th>포지션</th><th>주간</th><th>참여</th><th>상태</th></tr></thead><tbody>" +
      roster
        .slice(0, 10)
        .map(function (player) {
          var playerState = playerStatus(player, period);
          return (
            "<tr><td>" + esc(player.name) + "</td><td>" + esc(player.position) +
            '</td><td class="num">' + player.weekly + '분</td><td class="num">' +
            Math.round(playerPart(player, period)) + '%</td><td><span class="status ' +
            playerState.cls + '">' + playerState.label + "</span></td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>" +
      (roster.length > 10
        ? '<p class="chart-note">외 ' + (roster.length - 10) + "명은 선수 통합 관리에서 확인할 수 있습니다.</p>"
        : "") +
      "</div>" +
      '<button class="btn btn--dark btn--block btn--sm" type="button" data-team-players="' +
      team.id + '">선수 통합 관리에서 보기</button>' +
      '<div class="note-callout" style="margin-top:12px"><svg class="icon" aria-hidden="true"><use href="#i-info" /></svg>' +
      "<span>팀 지표는 소속 선수의 최근 4주 기록을 바탕으로 계산됩니다. 개별 선수 기록은 코치 화면에서 수정할 수 있습니다.</span></div>";

    var drawer = document.getElementById("teamDrawer");
    if (!drawer) return;
    drawer.hidden = false;
    document.body.classList.add("is-locked");
    var close = drawer.querySelector("[data-drawer-close]");
    if (close) window.setTimeout(function () { close.focus(); }, 60);
  }

  function closeTeamDrawer() {
    var drawer = document.getElementById("teamDrawer");
    if (!drawer) return;
    drawer.hidden = true;
    document.body.classList.remove("is-locked");
  }

  /* ---------------------------------------------------------------
     Players
     --------------------------------------------------------------- */
  function filteredPlayers() {
    var query = (val("playerSearch") || "").trim().toLowerCase();
    var sport = val("playerSport") || "all";
    var age = val("playerAge") || "all";
    var teamId = val("playerTeam") || "all";
    var sort = val("playerSort") || "goal";
    var period = periodOf(currentPeriod);

    var list = players.filter(function (player) {
      var haystack = (player.name + " " + player.position).toLowerCase();
      return (
        (sport === "all" || player.sport === sport) &&
        (age === "all" || player.age === age) &&
        (teamId === "all" || player.teamId === teamId) &&
        (!query || haystack.indexOf(query) !== -1)
      );
    });

    list.sort(function (a, b) {
      if (sort === "minutes") return b.weekly - a.weekly;
      if (sort === "name") return a.name.localeCompare(b.name, "ko");
      if (sort === "risk") return playerStatus(a, period).weight - playerStatus(b, period).weight;
      return playerGoal(b, period) - playerGoal(a, period);
    });
    return list;
  }

  function pageNumbers(current, total) {
    var pages = [];
    var start = Math.max(1, current - 3);
    var end = Math.min(total, start + 6);
    start = Math.max(1, end - 6);
    for (var i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  function renderPlayers(reset) {
    var body = document.getElementById("playerTableBody");
    if (!body) return;
    if (reset) playerPage = 1;
    var list = filteredPlayers();
    var totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    if (playerPage > totalPages) playerPage = totalPages;
    var start = (playerPage - 1) * PER_PAGE;
    var pageList = list.slice(start, start + PER_PAGE);
    var period = periodOf(currentPeriod);

    body.innerHTML = pageList.length
      ? pageList
          .map(function (player) {
            var status = playerStatus(player, period);
            return (
              "<tr>" +
              '<td><div class="table-person"><span class="table-avatar table-avatar--' +
              player.tone + '">' + esc(player.name.charAt(0)) + "</span><div><strong>" +
              esc(player.name) + "</strong><span>" + esc(player.grade) + "</span></div></div></td>" +
              "<td>" + esc(player.team) + "</td>" +
              '<td><span class="tag tag--outline">' + esc(player.sport) + "</span></td>" +
              "<td>" + esc(player.age) + "</td>" +
              "<td>" + esc(player.position) + "</td>" +
              '<td class="num">' + player.weekly + "분</td>" +
              '<td class="num">' + Math.round(playerPart(player, period)) + "%</td>" +
              '<td class="num"><strong>' + Math.round(playerGoal(player, period)) + "%</strong></td>" +
              '<td><span class="status ' + status.cls + '">' + status.label + "</span></td>" +
              "</tr>"
            );
          })
          .join("")
      : '<tr><td colspan="9"><div class="empty-state"><svg class="icon" aria-hidden="true"><use href="#i-search" /></svg><strong>조건에 맞는 선수가 없습니다.</strong><p>검색어나 필터를 변경해 보세요.</p></div></td></tr>';

    setText("playerCount", list.length + "명");
    var end = Math.min(start + PER_PAGE, list.length);
    setText(
      "playerFoot",
      list.length
        ? "전체 " + list.length + "명 중 " + (start + 1) + "~" + end + "명 표시 · " + period.label + " 기준"
        : "표시할 선수가 없습니다."
    );

    var pager = document.getElementById("playerPager");
    if (!pager) return;
    if (!list.length) {
      pager.innerHTML = "";
      return;
    }
    var html =
      '<button class="pager__btn" type="button" data-page="prev"' +
      (playerPage === 1 ? " disabled" : "") + ">이전</button>";
    pageNumbers(playerPage, totalPages).forEach(function (page) {
      html +=
        '<button class="pager__btn' + (page === playerPage ? " is-active" : "") +
        '" type="button" data-page="' + page + '"' +
        (page === playerPage ? ' aria-current="page"' : "") + ">" + page + "</button>";
    });
    html +=
      '<button class="pager__btn" type="button" data-page="next"' +
      (playerPage === totalPages ? " disabled" : "") + ">다음</button>" +
      '<span class="pager__info">' + playerPage + " / " + totalPages + "</span>";
    pager.innerHTML = html;
  }

  function exportPlayersCsv() {
    var list = filteredPlayers();
    if (!list.length) {
      Store.toast("내보낼 선수가 없습니다. 필터를 확인해 주세요.", "warn");
      return;
    }
    var period = periodOf(currentPeriod);
    var rows = [
      ["Sports Grow — 선수 통합 목록"],
      ["기준", period.label, "생성", todayLabel()],
      [],
      ["선수", "소속 팀", "종목", "연령대", "학년", "포지션", "주간 훈련(분)", "참여율(%)", "목표 달성률(%)", "상태"]
    ];
    list.forEach(function (player) {
      rows.push([
        player.name,
        player.team,
        player.sport,
        player.age,
        player.grade,
        player.position,
        player.weekly,
        Math.round(playerPart(player, period)),
        Math.round(playerGoal(player, period)),
        playerStatus(player, period).label
      ]);
    });
    downloadCsv("sportsgrow-players-" + fileStamp() + ".csv", rows);
    Store.toast(list.length + "명의 선수 목록을 CSV로 내보냈습니다.");
  }

  /* ---------------------------------------------------------------
     Analytics
     --------------------------------------------------------------- */
  function analyticsTeams() {
    var sport = val("anaSport") || "all";
    var age = val("anaAge") || "all";
    return teams.filter(function (team) {
      return (sport === "all" || team.sport === sport) && (age === "all" || team.age === age);
    });
  }

  function analyticsPlayers(list) {
    var ids = {};
    list.forEach(function (team) { ids[team.id] = true; });
    return players.filter(function (player) { return ids[player.teamId]; });
  }

  function renderBarChart(id, items, suffix, maxValue) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<div class="empty-state"><strong>데이터가 없습니다.</strong><p>필터를 변경해 보세요.</p></div>';
      return;
    }
    el.innerHTML = items
      .map(function (item) {
        var pct = Math.max(6, Math.round((item.value / (maxValue || 100)) * 100));
        return (
          '<div class="bar-chart__col">' +
          '<div class="bar-chart__bar" style="--h:' + pct + '%"><b>' + item.display +
          "</b><i" + (item.color ? ' style="background:' + item.color + '"' : "") + "></i></div>" +
          "<em>" + esc(item.label) + "</em></div>"
        );
      })
      .join("");
    el.setAttribute("aria-label", items.map(function (item) {
      return item.label + " " + item.display + (suffix || "");
    }).join(", "));
  }

  function renderAnalytics() {
    var period = periodOf(val("anaPeriod") || "month");
    var list = analyticsTeams();
    var sample = analyticsPlayers(list);
    var totals = playerTotals(sample, period);
    var teamTotals = totalsFor(list, period);

    setText("anaSample", "표본 " + sample.length + "명");
    setText("anaPeriodLabel", period.label);

    var ageItems = AGE_GROUPS.map(function (age) {
      var group = sample.filter(function (player) { return player.age === age; });
      var value = group.length ? playerTotals(group, period).part : 0;
      return {
        label: age,
        value: value,
        display: Math.round(value) + "%",
        color: age === "U12" ? "#0e6b4e" : age === "U15" ? "#b7d93f" : "#2f5fe0"
      };
    }).filter(function (item) { return item.value > 0; });
    renderBarChart("ageChart", ageItems, " 참여율", 100);

    var sports = [];
    var sportMap = {};
    list.forEach(function (team) {
      if (!sportMap[team.sport]) {
        sportMap[team.sport] = { players: 0, part: 0, goal: 0 };
        sports.push(team.sport);
      }
      sportMap[team.sport].players += team.players;
      sportMap[team.sport].part += effectivePart(team.participation, period) * team.players;
      sportMap[team.sport].goal += effectiveGoal(team.goal, period) * team.players;
    });
    var sportItems = sports.map(function (sport) {
      var entry = sportMap[sport];
      var goal = entry.players ? entry.goal / entry.players : 0;
      return {
        label: sport,
        value: goal,
        display: Math.round(goal) + "%",
        color: goal >= 72 ? "#0e6b4e" : goal >= 60 ? "#b7d93f" : "#c25a34"
      };
    });
    renderBarChart("goalChart", sportItems, " 목표 달성률", 100);

    renderHeatmap(totals.part);
    renderSportTable(list, period);
    renderAnalysisCards(list, sample, period, totals, teamTotals);
  }

  function renderHeatmap(basePart) {
    var el = document.getElementById("heatmap");
    if (!el) return;
    var days = ["월", "화", "수", "목", "금", "토", "일"];
    var offsets = [1.6, 0.7, 1.1, 0.3, -0.8, -7.4, -9.1];
    var values = [];
    var html = days
      .map(function (day) {
        return '<div class="heatmap__day">' + day + "</div>";
      })
      .join("");

    for (var week = 0; week < 4; week++) {
      for (var dayIndex = 0; dayIndex < 7; dayIndex++) {
        var value = clamp(
          basePart + offsets[dayIndex] + (((week * 3 + dayIndex) % 5) - 2) * 0.7,
          45,
          99
        );
        values.push(value);
        var alpha = 0.08 + ((value - 45) / 54) * 0.82;
        var textColor = alpha > 0.5 ? "#fff" : "#0b1a1e";
        html +=
          '<div class="heatmap__cell" style="background:rgba(14,107,78,' +
          alpha.toFixed(2) + ");color:" + textColor + '" title="' +
          (week + 1) + "주차 " + days[dayIndex] + "요일 · " + Math.round(value) +
          '%">' + Math.round(value) + "</div>";
      }
    }
    el.innerHTML = html;
    setText("heatAvg", Math.round(sum(values, function (v) { return v; }) / values.length) + "%");
  }

  function renderSportTable(list, period) {
    var body = document.getElementById("sportTableBody");
    if (!body) return;
    var grouped = {};
    list.forEach(function (team) {
      if (!grouped[team.sport]) grouped[team.sport] = [];
      grouped[team.sport].push(team);
    });
    var rows = Object.keys(grouped).map(function (sport) {
      var group = grouped[sport];
      var totals = totalsFor(group, period);
      return {
        sport: sport,
        players: totals.players,
        part: totals.part,
        goal: totals.goal,
        teams: group.length
      };
    }).sort(function (a, b) { return b.goal - a.goal; });

    body.innerHTML = rows.length
      ? rows
          .map(function (row) {
            var trend = row.goal >= 70 ? "상승" : row.goal >= 60 ? "유지" : "관리";
            var tone = row.goal >= 70 ? "" : row.goal >= 60 ? " delta--neutral" : " delta--down";
            return (
              "<tr><td><strong>" + esc(row.sport) + "</strong> <span class=\"muted\">" +
              row.teams + "팀</span></td>" +
              '<td class="num">' + row.players + "명</td>" +
              '<td class="num">' + Math.round(row.part) + "%</td>" +
              '<td class="num">' + Math.round(row.goal) + "%</td>" +
              '<td><span class="delta' + tone + '"><svg class="icon" aria-hidden="true"><use href="#i-trend" /></svg>' +
              trend + "</span></td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="5"><div class="empty-state"><strong>분석할 데이터가 없습니다.</strong><p>종목이나 연령대 필터를 변경해 보세요.</p></div></td></tr>';
  }

  function renderAnalysisCards(list, sample, period, totals, teamTotals) {
    var grid = document.getElementById("analysisGrid");
    if (!grid) return;
    if (!list.length || !sample.length) {
      grid.innerHTML =
        '<div class="empty-state" style="grid-column:1/-1"><strong>선택한 조건에 데이터가 없습니다.</strong><p>종목·연령대 필터를 조정해 주세요.</p></div>';
      return;
    }

    var ageStats = AGE_GROUPS.map(function (age) {
      var group = sample.filter(function (player) { return player.age === age; });
      return { age: age, part: group.length ? playerTotals(group, period).part : 0, count: group.length };
    }).filter(function (item) { return item.count > 0; })
      .sort(function (a, b) { return b.part - a.part; });

    var teamStats = list.slice().sort(function (a, b) {
      return effectivePart(b.participation, period) - effectivePart(a.participation, period);
    });

    var best = ageStats[0];
    var worst = ageStats[ageStats.length - 1];
    var gap = best && worst ? best.part - worst.part : 0;

    var cards = [
      {
        icon: "i-users",
        label: "연령대 참여율 1위",
        value: best ? best.age : "-",
        unit: best ? Math.round(best.part) + "%" : "",
        desc: best
          ? "표본 " + best.count + "명 · 전체 평균 " + Math.round(totals.part) + "%"
          : "데이터 없음",
        delta: best && best.part >= totals.part ? "+" + round1(best.part - totals.part) + "%p" : null
      },
      {
        icon: "i-chart",
        label: "연령대 격차",
        value: round1(gap),
        unit: "%p",
        desc: best && worst
          ? best.age + " " + Math.round(best.part) + "% · " + worst.age + " " + Math.round(worst.part) + "%"
          : "데이터 없음",
        delta: null
      },
      {
        icon: "i-target",
        label: "목표 달성 상위 팀",
        value: teamStats[0].name,
        unit: "",
        desc: Math.round(effectiveGoal(teamStats[0].goal, period)) + "% · " +
          Math.round(effectivePart(teamStats[0].participation, period)) + "% 참여",
        delta: "+" + round1(
          effectiveGoal(teamStats[0].goal, period) - teamTotals.goal
        ) + "%p"
      }
    ];

    grid.innerHTML = cards
      .map(function (card) {
        return (
          '<div class="analysis-card"><div class="analysis-card__head"><span>' +
          '<svg class="icon" aria-hidden="true"><use href="#' + card.icon + '" /></svg>' +
          card.label + "</span></div><strong>" + esc(card.value) +
          (card.unit ? "<small>" + esc(card.unit) + "</small>" : "") +
          "</strong><p>" + esc(card.desc) + "</p>" +
          (card.delta ? '<span class="delta"><svg class="icon" aria-hidden="true"><use href="#i-trend" /></svg>' +
            esc(card.delta) + "</span>" : "") +
          "</div>"
        );
      })
      .join("");
  }

  /* ---------------------------------------------------------------
     Reports
     --------------------------------------------------------------- */
  var reportState = { type: "monthly", period: "month", sport: "all" };

  function reportTeams() {
    return teams.filter(function (team) {
      return reportState.sport === "all" || team.sport === reportState.sport;
    });
  }

  function renderReportList() {
    var list = document.getElementById("reportList");
    if (!list) return;
    list.innerHTML = Object.keys(REPORT_TYPES)
      .map(function (key) {
        var type = REPORT_TYPES[key];
        return (
          '<div class="report-item">' +
          '<span class="report-item__ico report-item__ico--' + type.tone +
          '"><svg class="icon" aria-hidden="true"><use href="#' + type.icon + '" /></svg></span>' +
          '<div class="report-item__body"><strong>' + esc(type.name) + "</strong><span>" +
          esc(type.note) + "</span></div>" +
          '<div class="report-item__actions">' +
          '<button class="btn btn--ghost btn--sm" type="button" data-report-preview="' + key + '">보기</button>' +
          '<button class="icon-action" type="button" data-report-csv="' + key +
          '" aria-label="' + esc(type.name) + ' CSV 다운로드">' +
          '<svg class="icon" aria-hidden="true"><use href="#i-download" /></svg></button>' +
          "</div></div>"
        );
      })
      .join("");
  }

  function renderReport() {
    var type = REPORT_TYPES[reportState.type] || REPORT_TYPES.monthly;
    var periodKey = REPORT_PERIODS[reportState.period] ? reportState.period : "month";
    var periodLabel = REPORT_PERIODS[periodKey].label;
    var period = periodOf(periodKey);
    var list = reportTeams();
    var totals = totalsFor(list, period);
    var scope = reportState.sport === "all" ? "전체 종목" : reportState.sport;
    var meta = "한빛 스포츠아카데미 · " + scope + " · " + REPORT_PERIODS[periodKey].range;

    setText("reportTitle", periodLabel + " " + type.name);
    setText("reportMeta", meta);

    var summary = document.getElementById("reportSummary");
    if (summary) {
      summary.innerHTML =
        "<div><span>총 선수</span><strong>" + totals.players + "명</strong></div>" +
        "<div><span>평균 훈련 참여율</span><strong>" + Math.round(totals.part) + "%</strong></div>" +
        "<div><span>평균 목표 달성률</span><strong>" + Math.round(totals.goal) + "%</strong></div>";
    }

    var body = document.getElementById("reportTableBody");
    if (body) {
      body.innerHTML = list.length
        ? list
            .map(function (team) {
              return (
                "<tr><td><strong>" + esc(team.name) + "</strong></td>" +
                '<td class="num">' + team.players + "명</td>" +
                '<td class="num">' + Math.round(effectivePart(team.participation, period)) + "%</td>" +
                '<td class="num">' + Math.round(effectiveGoal(team.goal, period)) + "%</td></tr>"
              );
            })
            .join("")
        : '<tr><td colspan="4"><div class="empty-state"><strong>대상 팀이 없습니다.</strong><p>다른 종목을 선택해 주세요.</p></div></td></tr>';
    }

    setText("reportNote", type.note + " 선택한 기간의 마지막 기록을 기준으로 생성됩니다.");
    setText("reportStamp", todayLabel() + " " + timeLabel());

    var typeSelect = document.getElementById("reportType");
    var periodSelect = document.getElementById("reportPeriod");
    var sportSelect = document.getElementById("reportSport");
    if (typeSelect) typeSelect.value = reportState.type;
    if (periodSelect) periodSelect.value = reportState.period;
    if (sportSelect) sportSelect.value = reportState.sport;
  }

  function timeLabel() {
    var d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function exportReportCsv(forceType) {
    if (forceType) reportState.type = forceType;
    var type = REPORT_TYPES[reportState.type] || REPORT_TYPES.monthly;
    var list = reportTeams();
    if (!list.length) {
      Store.toast("내보낼 팀 데이터가 없습니다.", "warn");
      return;
    }
    var periodKey = REPORT_PERIODS[reportState.period] ? reportState.period : "month";
    var period = periodOf(periodKey);
    var totals = totalsFor(list, period);
    var scope = reportState.sport === "all" ? "전체 종목" : reportState.sport;
    var rows = [
      ["Sports Grow — " + REPORT_PERIODS[periodKey].label + " " + type.name],
      ["기관", "한빛 스포츠아카데미", "대상", scope],
      ["기간", REPORT_PERIODS[periodKey].range, "생성", todayLabel() + " " + timeLabel()],
      [],
      ["팀", "종목", "연령대", "담당 코치", "선수", "주간 평균 훈련(분)", "참여율(%)", "목표 달성률(%)", "상태"]
    ];
    list.forEach(function (team) {
      rows.push([
        team.name,
        team.sport,
        team.age,
        team.coach,
        team.players,
        team.weekly,
        Math.round(effectivePart(team.participation, period)),
        Math.round(effectiveGoal(team.goal, period)),
        teamStatus(team, period).label
      ]);
    });
    rows.push([]);
    rows.push(["총 선수", totals.players + "명", "평균 참여율", Math.round(totals.part) + "%", "평균 목표 달성률", Math.round(totals.goal) + "%"]);
    rows.push(["열람 권한", "기관 관리자 · 연맹 담당자", "내보낸 사람", "기관 관리자"]);
    downloadCsv(
      "sportsgrow-report-" + reportState.type + "-" + fileStamp() + ".csv",
      rows
    );
    Store.toast("관리자 권한으로 통계 보고서를 내보냈습니다. 다운로드 이력이 기록됩니다.");
  }

  /* ---------------------------------------------------------------
     CSV
     --------------------------------------------------------------- */
  function downloadCsv(filename, rows) {
    var csv = rows
      .map(function (row) {
        return row
          .map(function (cell) {
            var value = String(cell == null ? "" : cell);
            if (/[",\n\r]/.test(value)) {
              value = '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
          })
          .join(",");
      })
      .join("\r\n");
    try {
      var blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1500);
    } catch (err) {
      Store.toast("파일을 생성하지 못했습니다. 브라우저 설정을 확인해 주세요.", "warn");
    }
  }

  /* ---------------------------------------------------------------
     Filters and events
     --------------------------------------------------------------- */
  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  function fillFilters() {
    var sports = uniqueSports();
    ["teamSport", "playerSport", "anaSport"].forEach(function (id) {
      var select = document.getElementById(id);
      if (!select) return;
      var current = select.value || "all";
      select.innerHTML =
        '<option value="all">전체 종목</option>' +
        sports.map(function (sport) {
          return '<option value="' + esc(sport) + '">' + esc(sport) + "</option>";
        }).join("");
      select.value = current === "all" || sports.indexOf(current) >= 0 ? current : "all";
    });

    var reportSport = document.getElementById("reportSport");
    if (reportSport) {
      var currentSport = reportSport.value || "all";
      reportSport.innerHTML =
        '<option value="all">전체 종목 · ' + teams.length + "개 팀</option>" +
        sports.map(function (sport) {
          var count = teams.filter(function (team) { return team.sport === sport; }).length;
          return '<option value="' + esc(sport) + '">' + esc(sport) + " · " + count + "개 팀</option>";
        }).join("");
      reportSport.value = currentSport === "all" || sports.indexOf(currentSport) >= 0 ? currentSport : "all";
    }

    var playerTeam = document.getElementById("playerTeam");
    if (playerTeam) {
      var currentTeam = playerTeam.value || "all";
      playerTeam.innerHTML =
        '<option value="all">전체 팀</option>' +
        teams.map(function (team) {
          return '<option value="' + esc(team.id) + '">' + esc(team.name) + "</option>";
        }).join("");
      playerTeam.value = currentTeam === "all" || teamById[currentTeam] ? currentTeam : "all";
    }
  }

  function bindEvents() {
    var periodButtons = Array.prototype.slice.call(document.querySelectorAll("[data-period]"));
    periodButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentPeriod = btn.getAttribute("data-period");
        periodButtons.forEach(function (item) {
          var on = item === btn;
          item.classList.toggle("is-active", on);
          item.setAttribute("aria-pressed", on ? "true" : "false");
        });
        renderOverview();
        renderPlayers(false);
      });
    });

    ["teamSearch", "playerSearch"].forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.addEventListener("input", function () {
        if (id === "teamSearch") renderTeams();
        else renderPlayers(true);
      });
    });

    ["teamSport", "teamAge"].forEach(function (id) {
      var select = document.getElementById(id);
      if (select) select.addEventListener("change", renderTeams);
    });

    ["playerSport", "playerAge", "playerTeam", "playerSort"].forEach(function (id) {
      var select = document.getElementById(id);
      if (select) select.addEventListener("change", function () { renderPlayers(true); });
    });

    ["anaSport", "anaAge", "anaPeriod"].forEach(function (id) {
      var select = document.getElementById(id);
      if (select) select.addEventListener("change", renderAnalytics);
    });

    ["reportType", "reportPeriod", "reportSport"].forEach(function (id) {
      var select = document.getElementById(id);
      if (!select) return;
      select.addEventListener("change", function () {
        if (id === "reportType") reportState.type = select.value;
        if (id === "reportPeriod") reportState.period = select.value;
        if (id === "reportSport") reportState.sport = select.value;
        renderReport();
      });
    });

    var generate = document.getElementById("reportGenerate");
    if (generate) {
      generate.addEventListener("click", function () {
        renderReport();
        Store.toast("보고서 미리보기를 새로 생성했습니다.");
      });
    }

    var reportCsv = document.getElementById("reportCsv");
    if (reportCsv) reportCsv.addEventListener("click", function () { exportReportCsv(); });

    var playerCsv = document.getElementById("playerCsv");
    if (playerCsv) playerCsv.addEventListener("click", exportPlayersCsv);

    var bell = document.getElementById("notificationsBtn");
    if (bell) {
      bell.addEventListener("click", function () {
        Store.toast("기관 알림 3건 · 기록 미입력 팀과 목표 지연 선수를 확인하세요.");
      });
    }

    var teamForm = document.getElementById("teamForm");
    if (teamForm) {
      teamForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var name = (document.getElementById("teamName").value || "").trim();
        var sport = document.getElementById("teamSportInput").value;
        var age = document.getElementById("teamAgeInput").value;
        var coach = (document.getElementById("teamCoach").value || "").trim();
        var count = clamp(Number(document.getElementById("teamPlayers").value) || 12, 1, 60);

        if (!name || !coach) {
          Store.toast("팀 이름과 담당 코치를 입력해 주세요.", "warn");
          return;
        }
        var duplicate = teams.some(function (team) {
          return team.name.replace(/\s/g, "") === name.replace(/\s/g, "");
        });
        if (duplicate) {
          Store.toast("이미 등록된 팀 이름입니다.", "warn");
          return;
        }

        var team = normalizeTeam({
          id: "custom-" + Date.now(),
          name: name,
          sport: sport,
          age: age,
          coach: coach,
          players: count,
          weekly: TEAM_WEEKLY[sport] || 220,
          participation: 82,
          goal: 62,
          venue: "미등록",
          since: todayLabel(),
          tone: TONES[teams.length % TONES.length]
        }, teams.length);

        customTeams.push(team);
        Store.writeStore(TEAM_KEY, customTeams);
        teams.push(team);

        buildPlayers();
        fillFilters();
        renderOverview();
        renderTeams();
        renderPlayers(true);
        renderAnalytics();
        renderReport();
        if (window.AppShell && window.AppShell.closeModal) window.AppShell.closeModal("teamModal");
        teamForm.reset();
        Store.toast(name + " 팀을 등록했습니다. 소속 선수 " + count + "명이 생성되었습니다.");
      });
    }

    document.addEventListener("click", function (event) {
      var teamButton = event.target.closest("[data-team]");
      if (teamButton) {
        event.preventDefault();
        openTeam(teamButton.getAttribute("data-team"));
        return;
      }

      var close = event.target.closest("[data-drawer-close]");
      if (close) {
        event.preventDefault();
        closeTeamDrawer();
        return;
      }

      var goPlayers = event.target.closest("[data-team-players]");
      if (goPlayers) {
        event.preventDefault();
        var teamId = goPlayers.getAttribute("data-team-players");
        var filter = document.getElementById("playerTeam");
        if (filter) filter.value = teamId;
        closeTeamDrawer();
        renderPlayers(true);
        if (window.AppShell) window.AppShell.showView("players", { alwaysScroll: true });
        return;
      }

      var gotoPlayers = event.target.closest("[data-goto-players]");
      if (gotoPlayers) {
        event.preventDefault();
        if (window.AppShell) window.AppShell.showView("players", { alwaysScroll: true });
        return;
      }

      var pageButton = event.target.closest("[data-page]");
      if (pageButton && !pageButton.disabled) {
        event.preventDefault();
        var page = pageButton.getAttribute("data-page");
        var list = filteredPlayers();
        var totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
        if (page === "prev") playerPage = Math.max(1, playerPage - 1);
        else if (page === "next") playerPage = Math.min(totalPages, playerPage + 1);
        else playerPage = Number(page) || 1;
        renderPlayers(false);
        return;
      }

      var preview = event.target.closest("[data-report-preview]");
      if (preview) {
        event.preventDefault();
        reportState.type = preview.getAttribute("data-report-preview");
        renderReport();
        if (window.AppShell) window.AppShell.showView("reports", { alwaysScroll: true });
        Store.toast(REPORT_TYPES[reportState.type].name + " 미리보기를 표시했습니다.");
        return;
      }

      var reportDownload = event.target.closest("[data-report-csv]");
      if (reportDownload) {
        event.preventDefault();
        exportReportCsv(reportDownload.getAttribute("data-report-csv"));
        return;
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeTeamDrawer();
    });
  }

  /* ---------------------------------------------------------------
     Boot
     --------------------------------------------------------------- */
  buildPlayers();
  fillFilters();
  renderOverview();
  renderTeams();
  renderPlayers(true);
  renderAnalytics();
  renderReportList();
  renderReport();
  bindEvents();
})();
