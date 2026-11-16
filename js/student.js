/* =====================================================================
   SPORTS GROW — student / parent dashboard
   ===================================================================== */
(function () {
  "use strict";

  var Demo = window.SportsGrowDemo;
  var SESSION =
    window.SportsGrow && window.SportsGrow.getSession ? window.SportsGrow.getSession() : null;
  var ROLE = SESSION ? SESSION.role : null;

  /* No session (or an unsupported role): do not seed, render, or write storage. */
  if (!Demo) return;
  if (!SESSION || ["player", "parent", "coach"].indexOf(ROLE) === -1) return;

  var Store = window.AppShell || {
    toast: function () {},
    openModal: function () {},
    closeModal: function () {},
    showView: function () {}
  };
  var IS_STUDENT = ROLE === "player";
  var IS_PARENT = ROLE === "parent";
  var IS_COACH = ROLE === "coach";
  var CAN_MEDIA = IS_STUDENT || IS_PARENT || IS_COACH;

  if (IS_PARENT) {
    document.body.classList.add("is-parent");
    document.body.classList.add("is-readonly");
  }

  if (IS_COACH) {
    document.body.classList.add("is-coach");
    document.body.classList.add("is-readonly");
    document.querySelectorAll("[data-view-label]").forEach(function (el) {
      el.textContent = "Coach view";
    });
  }

  /* ---------------------------------------------------------------
     Single demo ledger
     --------------------------------------------------------------- */
  var state = Demo.load();
  var player = Demo.player(state);
  if (!player) return;

  if (!Array.isArray(player.training)) player.training = [];
  if (!Array.isArray(player.games)) player.games = [];
  if (!Array.isArray(player.history)) player.history = [];
  if (!player.visibility || typeof player.visibility !== "object") {
    player.visibility = { profile: "team", training: "team", games: "team", goals: "private" };
  }
  if (!state.cheers || typeof state.cheers !== "object" || Array.isArray(state.cheers)) {
    state.cheers = {};
  }
  if (!Array.isArray(state.requests)) state.requests = [];
  if (!Array.isArray(state.gallery)) state.gallery = [];

  var training = player.training;
  var games = player.games;
  var cheers = state.cheers;
  var requests = state.requests;
  var gallery = normalizeGallery(state.gallery);
  var heroMedia = normalizeHero(state.heroMedia);
  var growthMetric = "avg";

  function commitTraining(next) {
    var previous = player.training;
    player.training = next;
    if (!Demo.save(state)) {
      player.training = previous;
      return false;
    }
    training = next;
    return true;
  }

  function commitGames(next) {
    var previous = player.games;
    player.games = next;
    if (!Demo.save(state)) {
      player.games = previous;
      return false;
    }
    games = next;
    return true;
  }

  function commitCheers(next) {
    var previous = state.cheers;
    state.cheers = next;
    if (!Demo.save(state)) {
      state.cheers = previous;
      return false;
    }
    cheers = next;
    return true;
  }

  function commitRequests(next) {
    var previous = state.requests;
    state.requests = next;
    if (!Demo.save(state)) {
      state.requests = previous;
      return false;
    }
    requests = next;
    return true;
  }

  function commitGallery(next) {
    var previous = state.gallery;
    state.gallery = next;
    if (!Demo.save(state)) {
      state.gallery = previous;
      return false;
    }
    gallery = next;
    return true;
  }

  function commitHero(item) {
    var previous = state.heroMedia;
    state.heroMedia = item;
    if (!Demo.save(state)) {
      state.heroMedia = previous;
      return false;
    }
    heroMedia = item;
    return true;
  }

  var PROFILE_KEYS = ["sport", "team", "position", "grade", "age", "region", "bats"];

  function commitProfile(data) {
    var previous = {};
    PROFILE_KEYS.forEach(function (key) {
      previous[key] = player[key];
    });
    Object.assign(player, data);
    if (!Demo.save(state)) {
      PROFILE_KEYS.forEach(function (key) {
        player[key] = previous[key];
      });
      return false;
    }
    return true;
  }

  function commitVisibility(next) {
    var previous = player.visibility;
    player.visibility = next;
    if (!Demo.save(state)) {
      player.visibility = previous;
      return false;
    }
    return true;
  }

  /* ---------------------------------------------------------------
     Date helpers
     --------------------------------------------------------------- */
  var DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function parseDate(key) {
    var parts = String(key == null ? "" : key).split("-");
    if (parts.length < 3) return null;
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function todayKey() {
    return Demo.todayKey();
  }

  function daysAgo(n) {
    return Demo.daysAgo(n);
  }

  function shortDate(key) {
    return Demo.shortDate(key);
  }

  function escapeHtml(value) {
    return Demo.escapeHtml(value);
  }

  /* ---------------------------------------------------------------
     Static helpers
     --------------------------------------------------------------- */
  var INTENSITY = {
    low: { label: "하", cls: "low" },
    mid: { label: "중", cls: "mid" },
    high: { label: "상", cls: "high" }
  };

  var TYPE_ICON = {
    타격: { icon: "i-target", cls: "" },
    수비: { icon: "i-shield", cls: "blue" },
    웨이트: { icon: "i-bars", cls: "gold" },
    러닝: { icon: "i-activity", cls: "clay" },
    컨디셔닝: { icon: "i-flame", cls: "clay" },
    회복: { icon: "i-refresh", cls: "" }
  };

  function sortTraining(list) {
    return list.slice().sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });
  }

  function sum(list) {
    return list.reduce(function (total, item) {
      return total + Number(item.minutes || 0);
    }, 0);
  }

  function sumWindow(from, to) {
    var keys = [];
    for (var i = from; i <= to; i++) keys.push(daysAgo(i));
    return training.reduce(function (total, item) {
      return keys.indexOf(item.date) !== -1 ? total + Number(item.minutes || 0) : total;
    }, 0);
  }

  function weekTraining() {
    var keys = [];
    for (var i = 6; i >= 0; i--) keys.push(daysAgo(i));
    return training.filter(function (item) {
      return keys.indexOf(item.date) !== -1;
    });
  }

  function monthTraining() {
    var now = new Date();
    return training.filter(function (item) {
      var d = parseDate(item.date);
      return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }

  function latestGame() {
    var sorted = games.slice().sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });
    return sorted[0] || null;
  }

  function seasonStats() {
    var totals = { atBats: 0, hits: 0, walks: 0, games: games.length };
    games.forEach(function (game) {
      totals.atBats += Number(game.atBats || 0);
      totals.hits += Number(game.hits || 0);
      totals.walks += Number(game.walks || 0);
    });
    totals.avg = totals.atBats > 0 ? totals.hits / totals.atBats : 0;
    return totals;
  }

  function monthStats() {
    var now = new Date();
    var totals = { atBats: 0, hits: 0, walks: 0, games: 0 };
    games.forEach(function (game) {
      var d = parseDate(game.date);
      if (!d || d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
      totals.games += 1;
      totals.atBats += Number(game.atBats || 0);
      totals.hits += Number(game.hits || 0);
      totals.walks += Number(game.walks || 0);
    });
    totals.avg = totals.atBats > 0 ? totals.hits / totals.atBats : 0;
    return totals;
  }

  function formatAvg(value) {
    return (Number(value) || 0).toFixed(3).replace(/^0/, "");
  }

  function streakDays() {
    var streak = 0;
    for (var i = 0; i < 366; i++) {
      var key = daysAgo(i);
      var has = training.some(function (item) {
        return item.date === key;
      });
      if (!has) break;
      streak += 1;
    }
    return streak;
  }

  /* ---------------------------------------------------------------
     Visibility
     --------------------------------------------------------------- */
  var VIS_LABEL = { public: "전체 공개", team: "팀 공개", private: "비공개" };

  function visibilityOf(section) {
    return (player.visibility && player.visibility[section]) || "private";
  }

  function canSee(section) {
    return IS_STUDENT || visibilityOf(section) !== "private";
  }

  function privateBlock(what) {
    return (
      '<div class="empty-state"><svg class="icon" aria-hidden="true"><use href="#i-lock" /></svg>' +
      "<strong>비공개</strong><p>" +
      escapeHtml(what) +
      "은 비공개로 설정되어 있습니다.</p></div>"
    );
  }

  function setPrivateArea(container, isPrivate, what) {
    if (!container) return;
    var content = Array.prototype.slice.call(container.children).filter(function (el) {
      return !el.hasAttribute("data-private-note");
    });
    var note = container.querySelector("[data-private-note]");
    if (isPrivate) {
      content.forEach(function (el) {
        el.hidden = true;
      });
      if (!note) {
        note = document.createElement("div");
        note.setAttribute("data-private-note", "");
        container.appendChild(note);
      }
      note.innerHTML = privateBlock(what);
      note.hidden = false;
    } else {
      content.forEach(function (el) {
        el.hidden = false;
      });
      if (note) note.hidden = true;
    }
  }

  /* ---------------------------------------------------------------
     Home KPI
     --------------------------------------------------------------- */
  function renderStats() {
    var weekMinutes = Demo.weekMinutes(player);
    var weekDays = Demo.weekDays(player);
    var monthMinutes = Demo.monthMinutes(player);
    var previousWeek = sumWindow(7, 13);
    var change = previousWeek > 0 ? Math.round(((weekMinutes - previousWeek) / previousWeek) * 100) : 0;

    document.querySelectorAll("[data-stat-week]").forEach(function (el) {
      el.textContent = weekMinutes;
    });
    document.querySelectorAll("[data-stat-week-count]").forEach(function (el) {
      el.textContent = weekDays;
    });
    document.querySelectorAll("[data-stat-month]").forEach(function (el) {
      el.textContent = monthMinutes;
    });

    var weekDelta = document.getElementById("weekDelta");
    if (weekDelta) {
      weekDelta.innerHTML =
        '<svg class="icon" aria-hidden="true"><use href="#i-trend" /></svg>' +
        (change > 0 ? "+" : "") +
        change +
        "%";
    }
    var weekPrev = document.getElementById("weekPrev");
    if (weekPrev) weekPrev.textContent = "지난주 " + previousWeek + "분";

    var weekGoalFoot = document.getElementById("weekGoalFoot");
    if (weekGoalFoot) {
      var left = Math.max(0, Demo.WEEKLY_GOAL_DAYS - weekDays);
      weekGoalFoot.innerHTML =
        left === 0
          ? "이번 주 목표를 달성했습니다."
          : '목표 달성까지 <b style="color:var(--ink)">' + left + "회</b> 남음";
    }

    var sidebarWeekGoal = document.getElementById("sidebarWeekGoal");
    if (sidebarWeekGoal) {
      sidebarWeekGoal.textContent =
        "이번 주 " + weekDays + " / " + Demo.WEEKLY_GOAL_DAYS + "회 훈련";
    }
    var sidebarWeekGoalNote = document.getElementById("sidebarWeekGoalNote");
    if (sidebarWeekGoalNote) {
      sidebarWeekGoalNote.textContent =
        weekDays >= Demo.WEEKLY_GOAL_DAYS
          ? "이번 주 훈련 목표를 달성했습니다."
          : Math.max(0, Demo.WEEKLY_GOAL_DAYS - weekDays) +
            "회만 더 기록하면 주간 목표를 달성합니다.";
    }

    var goalValue = document.querySelector("[data-stat-goal]");
    if (goalValue) goalValue.textContent = Demo.goalAverage(player);

    var season = seasonStats();
    var seasonAvg = document.getElementById("seasonAvg");
    if (seasonAvg) seasonAvg.textContent = formatAvg(season.avg);

    var seasonDelta = document.getElementById("seasonDelta");
    if (seasonDelta) {
      var series = Demo.growthSeries(player, "avg");
      var values = series.values || [];
      var diff = values.length > 1 ? values[values.length - 1] - values[values.length - 2] : 0;
      seasonDelta.textContent =
        (diff > 0.0005 ? "▲ " : diff < -0.0005 ? "▼ " : "— ") + formatAvg(Math.abs(diff));
    }

    var streak = document.getElementById("streakDays");
    if (streak) streak.textContent = streakDays();

    var monthTag = document.getElementById("monthTag");
    if (monthTag) monthTag.textContent = "이번 달 " + monthMinutes + "분";
  }

  /* ---------------------------------------------------------------
     Charts
     --------------------------------------------------------------- */
  function renderBars(container, items, mode) {
    if (!container) return;
    var max = Math.max.apply(
      null,
      items.map(function (item) {
        return item.value;
      })
    );
    max = max || 1;
    container.innerHTML = items
      .map(function (item) {
        var pct = item.value === 0 ? 3 : Math.max(5, Math.round((item.value / max) * 100));
        var classes = "bar-chart__col";
        if (item.today) classes += " is-active";
        if (item.value === max && !item.today && item.value > 0) classes += " is-peak";
        return (
          '<div class="' +
          classes +
          '">' +
          '<div class="bar-chart__bar" style="--h:' +
          pct +
          '%"><b>' +
          (mode === "month" ? "주" : "") +
          item.value +
          "분</b><i></i></div>" +
          "<em>" +
          item.label +
          "</em>" +
          "</div>"
        );
      })
      .join("");
  }

  function weeklySeries() {
    var items = [];
    for (var i = 6; i >= 0; i--) {
      var key = daysAgo(i);
      var total = training
        .filter(function (item) {
          return item.date === key;
        })
        .reduce(function (acc, item) {
          return acc + Number(item.minutes || 0);
        }, 0);
      var parsed = parseDate(key);
      items.push({
        label: parsed ? DAY_NAMES[parsed.getDay()] : "",
        value: total,
        today: key === todayKey()
      });
    }
    return items;
  }

  function monthlySeries() {
    var buckets = [];
    for (var w = 3; w >= 0; w--) {
      var start = w * 7 + 6;
      var end = w * 7;
      var value = 0;
      for (var d = end; d <= start; d++) {
        var key = daysAgo(d);
        value += training
          .filter(function (item) {
            return item.date === key;
          })
          .reduce(function (acc, item) {
            return acc + Number(item.minutes || 0);
          }, 0);
      }
      buckets.push({ label: w === 0 ? "이번 주" : w + "주 전", value: value });
    }
    return buckets;
  }

  var overviewRange = "week";
  var trainingRange = "week";

  function renderOverviewChart() {
    var container = document.getElementById("overviewChart");
    var total = document.getElementById("overviewChartTotal");
    var isWeek = overviewRange === "week";
    var series = isWeek ? weeklySeries() : monthlySeries();
    renderBars(container, series, isWeek ? "week" : "month");
    if (total) {
      var sumValue = series.reduce(function (acc, item) {
        return acc + item.value;
      }, 0);
      total.textContent = isWeek
        ? "이번 주 총 " + sumValue + "분 · 일 평균 " + Math.round(sumValue / 7) + "분"
        : "최근 4주 총 " + sumValue + "분 · 주 평균 " + Math.round(sumValue / 4) + "분";
    }
  }

  function renderTrainingChart() {
    var container = document.getElementById("trainingChart");
    var total = document.getElementById("trainingChartTotal");
    var sub = document.getElementById("trainingChartSub");
    var isWeek = trainingRange === "week";
    var series = isWeek ? weeklySeries() : monthlySeries();
    renderBars(container, series, isWeek ? "week" : "month");
    if (sub) {
      sub.textContent = isWeek ? "최근 7일 훈련 시간" : "최근 4주 훈련 시간";
    }
    if (total) {
      var sumValue = series.reduce(function (acc, item) {
        return acc + item.value;
      }, 0);
      total.textContent = isWeek
        ? "총 " + sumValue + "분 · 일 평균 " + Math.round(sumValue / 7) + "분"
        : "4주 총 " + sumValue + "분 · 주 평균 " + Math.round(sumValue / 4) + "분";
    }
  }

  /* ---------------------------------------------------------------
     Training list
     --------------------------------------------------------------- */
  function trainingRow(item, withDelete) {
    var info = TYPE_ICON[item.type] || { icon: "i-activity", cls: "" };
    var intensity = INTENSITY[item.intensity] || INTENSITY.mid;
    return (
      '<div class="training-item">' +
      '<span class="training-item__ico' +
      (info.cls ? " training-item__ico--" + info.cls : "") +
      '"><svg class="icon" aria-hidden="true"><use href="#' +
      info.icon +
      '" /></svg></span>' +
      '<div class="training-item__main"><strong>' +
      escapeHtml(item.type) +
      " · " +
      Number(item.minutes || 0) +
      "분" +
      "</strong><span>" +
      shortDate(item.date) +
      (item.memo ? " · " + escapeHtml(item.memo) : "") +
      "</span></div>" +
      '<div class="training-item__meta"><span class="intensity intensity--' +
      intensity.cls +
      '">강도 ' +
      intensity.label +
      "</span>" +
      (withDelete
        ? '<button class="icon-action" type="button" data-delete-training="' +
          escapeHtml(item.id) +
          '" aria-label="' +
          escapeHtml(item.type) +
          ' 기록 삭제"><svg class="icon" aria-hidden="true"><use href="#i-trash" /></svg></button>'
        : "") +
      "</div></div>"
    );
  }

  function renderTraining() {
    var visible = canSee("training");
    var sorted = sortTraining(training);
    var recent = document.getElementById("recentTraining");
    if (recent) {
      recent.innerHTML = visible
        ? sorted
            .slice(0, 4)
            .map(function (item) {
              return trainingRow(item, false);
            })
            .join("")
        : privateBlock("훈련 기록");
    }

    var list = document.getElementById("trainingList");
    var filter = document.getElementById("trainingFilter");
    var type = filter ? filter.value : "all";
    var filtered = sorted.filter(function (item) {
      return type === "all" || item.type === type;
    });
    if (list) {
      if (!visible) {
        list.innerHTML = privateBlock("훈련 기록");
      } else {
        list.innerHTML = filtered.length
          ? filtered
              .map(function (item) {
                return trainingRow(item, IS_STUDENT);
              })
              .join("")
          : '<div class="empty-state"><svg class="icon" aria-hidden="true"><use href="#i-activity" /></svg><strong>해당 종류의 기록이 없습니다.</strong><p>훈련을 기록하면 이곳에 표시됩니다.</p></div>';
      }
    }

    var count = document.getElementById("trainingCount");
    if (count) count.textContent = visible ? "총 " + filtered.length + "건의 기록" : "비공개";
  }

  function renderIntensity() {
    var month = monthTraining();
    var counts = { high: 0, mid: 0, low: 0 };
    month.forEach(function (item) {
      if (counts[item.intensity] !== undefined) counts[item.intensity]++;
    });
    var total = month.length || 1;
    var p1 = Math.round((counts.high / total) * 100);
    var p2 = Math.round(((counts.high + counts.mid) / total) * 100);
    var donut = document.getElementById("intensityDonut");
    if (donut) {
      donut.style.setProperty("--p1", p1 + "%");
      donut.style.setProperty("--p2", p2 + "%");
      var center = donut.querySelector("strong");
      if (center) center.textContent = month.length;
    }
    var legend = document.getElementById("intensityLegend");
    if (legend) {
      legend.innerHTML =
        "<div><i></i>상 <b>" + counts.high + "회</b></div>" +
        "<div><i></i>중 <b>" + counts.mid + "회</b></div>" +
        "<div><i></i>하 <b>" + counts.low + "회</b></div>";
    }
  }

  /* ---------------------------------------------------------------
     Games
     --------------------------------------------------------------- */
  function gameDeleteButton(game) {
    if (!IS_STUDENT) return "";
    return (
      '<button class="icon-action" type="button" data-delete-game="' +
      escapeHtml(game.id) +
      '" aria-label="경기 기록 삭제"><svg class="icon" aria-hidden="true"><use href="#i-trash" /></svg></button>'
    );
  }

  function gameRow(game) {
    var statusClass =
      game.result === "승" ? "status--good" : game.result === "패" ? "status--risk" : "status--info";
    return (
      "<tr>" +
      "<td class='num'>" +
      shortDate(game.date) +
      "</td>" +
      "<td><strong>" +
      escapeHtml(game.opponent) +
      '</strong><div class="muted">' +
      escapeHtml(game.competition) +
      (game.score ? " · " + escapeHtml(game.score) : "") +
      "</div></td>" +
      '<td><span class="status ' +
      statusClass +
      '">' +
      escapeHtml(game.result) +
      "</span></td>" +
      "<td>" +
      escapeHtml(game.performance) +
      "</td>" +
      "<td>" +
      (game.achieved
        ? '<span class="status status--good">달성</span>'
        : '<span class="muted">—</span>') +
      gameDeleteButton(game) +
      "</td>" +
      "</tr>"
    );
  }

  function renderGames() {
    var visible = canSee("games");
    var sorted = games.slice().sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });
    var body = document.getElementById("gameTableBody");
    var filter = document.getElementById("gameFilter");
    var result = filter ? filter.value : "all";
    var filtered = sorted.filter(function (game) {
      return result === "all" || game.result === result;
    });
    if (body) {
      if (!visible) {
        body.innerHTML =
          '<tr><td colspan="5">' + privateBlock("경기 기록") + "</td></tr>";
      } else {
        body.innerHTML = filtered.length
          ? filtered.map(gameRow).join("")
          : '<tr><td colspan="5"><div class="empty-state"><strong>해당 조건의 경기 기록이 없습니다.</strong><p>경기 기록을 추가해 보세요.</p></div></td></tr>';
      }
    }

    var recent = document.getElementById("recentGames");
    if (recent) {
      if (!visible) {
        recent.innerHTML = privateBlock("경기 기록");
      } else {
        recent.innerHTML = sorted
          .slice(0, 3)
          .map(function (game) {
            var scorePart = game.score ? " · " + escapeHtml(game.score) : "";
            return (
              '<div class="training-item">' +
              '<span class="training-item__ico training-item__ico--clay"><svg class="icon" aria-hidden="true"><use href="#i-trophy" /></svg></span>' +
              '<div class="training-item__main"><strong>vs ' +
              escapeHtml(game.opponent) +
              scorePart +
              " " +
              escapeHtml(game.result) +
              "</strong><span>" +
              shortDate(game.date) +
              " · " +
              escapeHtml(game.competition) +
              "</span></div>" +
              '<div class="training-item__meta"><span class="intensity intensity--low">' +
              escapeHtml(game.performance) +
              "</span>" +
              gameDeleteButton(game) +
              "</div></div>"
            );
          })
          .join("");
      }
    }
  }

  /* ---------------------------------------------------------------
     Goals
     --------------------------------------------------------------- */
  function goalDetail(goal) {
    if (goal.horizon === "long") return "시즌 " + seasonStats().hits + "안타";
    if (goal.title.indexOf("타율") !== -1) return "이번 달 " + formatAvg(monthStats().avg);
    return "이번 주 " + Demo.weekDays(player) + " / " + Demo.WEEKLY_GOAL_DAYS + "일";
  }

  function renderGoals() {
    var goals = Demo.goalsFor(player);
    var visible = canSee("goals");

    var home = document.getElementById("homeGoals");
    if (home) {
      home.innerHTML = visible
        ? goals
            .map(function (goal) {
              var barClass = goal.horizon === "long" ? "progress--blue" : "progress--lime";
              return (
                '<div class="progress-row">' +
                '<div class="progress-row__head"><span>' +
                escapeHtml(goal.title) +
                "</span><b>" +
                goal.pct +
                "%</b></div>" +
                '<div class="progress"><i class="' +
                barClass +
                '" style="--w:' +
                goal.pct +
                '%"></i></div>' +
                "</div>"
              );
            })
            .join("")
        : privateBlock("목표");
    }

    var cards = document.getElementById("goalCards");
    if (cards) {
      cards.innerHTML = visible
        ? goals
            .map(function (goal) {
              var long = goal.horizon === "long";
              return (
                '<article class="goal-card"' +
                (long ? ' style="grid-column:1/-1"' : "") +
                ">" +
                '<div class="goal-card__head">' +
                '<span class="goal-card__badge' +
                (long ? " goal-card__badge--long" : "") +
                '"><svg class="icon" aria-hidden="true"><use href="#' +
                (long ? "i-flag" : "i-target") +
                '" /></svg></span>' +
                '<div class="goal-card__title"><span>' +
                (long ? "장기 목표 · 2026 시즌" : "단기 목표") +
                "</span><strong>" +
                escapeHtml(goal.title) +
                "</strong></div>" +
                '<span class="goal-card__pct' +
                (long ? " goal-card__pct--blue" : "") +
                '">' +
                goal.pct +
                "%</span>" +
                "</div>" +
                '<div class="progress"><i class="' +
                (long ? "progress--blue" : "progress--lime") +
                '" style="--w:' +
                goal.pct +
                '%"></i></div>' +
                '<div class="goal-card__foot"><span>' +
                escapeHtml(goalDetail(goal)) +
                "</span><b>" +
                (goal.pct >= 100 ? "달성" : "진행 중") +
                "</b></div>" +
                "</article>"
              );
            })
            .join("")
        : '<div class="empty-state" style="grid-column:1/-1">' + privateBlock("목표") + "</div>";
    }

    var note = document.getElementById("goalNote");
    if (note) {
      if (!visible) {
        note.textContent = "목표는 비공개로 설정되어 있습니다.";
      } else {
        var days = Demo.weekDays(player);
        note.textContent =
          days >= Demo.WEEKLY_GOAL_DAYS
            ? "이번 주 " + days + "일 훈련으로 주간 목표를 달성했습니다. 다음 목표는 이번 달 타율 .320입니다."
            : "이번 주 " + days + "일 훈련했습니다. " + Math.max(0, Demo.WEEKLY_GOAL_DAYS - days) + "일 더 기록하면 주간 목표를 달성합니다.";
      }
    }
  }

  /* ---------------------------------------------------------------
     Growth line chart
     --------------------------------------------------------------- */
  function renderGrowth(metric) {
    growthMetric = metric || growthMetric;
    var data = Demo.growthSeries(player, growthMetric);
    var container = document.getElementById("growthChart");
    var foot = document.getElementById("growthFoot");
    if (!container) return;

    if (!canSee("games")) {
      container.innerHTML = '<p class="muted" style="padding:24px">비공개</p>';
      if (foot) foot.textContent = "비공개";
      return;
    }

    var width = 440;
    var height = 190;
    var padding = { top: 16, right: 12, bottom: 26, left: 38 };
    var plotW = width - padding.left - padding.right;
    var plotH = height - padding.top - padding.bottom;
    var min = Math.min.apply(null, data.values);
    var max = Math.max.apply(null, data.values);
    var low = min - 0.012;
    var high = max + 0.012;
    var range = high - low || 1;

    var points = data.values.map(function (value, index) {
      var x = padding.left + (plotW / (data.values.length - 1)) * index;
      var y = padding.top + plotH - ((value - low) / range) * plotH;
      return { x: x, y: y, value: value };
    });

    var line = points
      .map(function (point, index) {
        return (index === 0 ? "M" : "L") + point.x.toFixed(1) + " " + point.y.toFixed(1);
      })
      .join(" ");

    var area =
      "M" +
      points[0].x.toFixed(1) +
      " " +
      (padding.top + plotH) +
      " " +
      points
        .map(function (point) {
          return "L" + point.x.toFixed(1) + " " + point.y.toFixed(1);
        })
        .join(" ") +
      " L" +
      points[points.length - 1].x.toFixed(1) +
      " " +
      (padding.top + plotH) +
      " Z";

    var grid = "";
    var ticks = 4;
    for (var i = 0; i <= ticks; i++) {
      var y = padding.top + (plotH / ticks) * i;
      var value = high - ((high - low) / ticks) * i;
      grid +=
        '<line x1="' +
        padding.left +
        '" y1="' +
        y +
        '" x2="' +
        (width - padding.right) +
        '" y2="' +
        y +
        '" />';
      grid +=
        '<text x="' +
        (padding.left - 7) +
        '" y="' +
        (y + 3) +
        '" text-anchor="end">' +
        value.toFixed(3).replace(/^0/, "") +
        "</text>";
    }

    var labels = points
      .map(function (point, index) {
        return (
          '<text x="' +
          point.x +
          '" y="' +
          (height - 7) +
          '" text-anchor="middle">' +
          data.labels[index] +
          "</text>"
        );
      })
      .join("");

    var dots = points
      .map(function (point, index) {
        var peak = index === data.best;
        return (
          '<circle class="line-chart__dot' +
          (peak ? " line-chart__dot--peak" : "") +
          '" cx="' +
          point.x +
          '" cy="' +
          point.y +
          '" r="' +
          (peak ? 4.4 : 3.2) +
          '"><title>' +
          data.labels[index] +
          " " +
          point.value.toFixed(3) +
          "</title></circle>"
        );
      })
      .join("");

    container.innerHTML =
      '<svg viewBox="0 0 ' +
      width +
      " " +
      height +
      '" role="img" aria-label="' +
      (growthMetric === "avg" ? "타율" : "출루율") +
      ' 성장 추이">' +
      "<defs><linearGradient id='areaGradient' x1='0' y1='0' x2='0' y2='1'>" +
      "<stop offset='0%' stop-color='#14805d' stop-opacity='.22'/>" +
      "<stop offset='100%' stop-color='#14805d' stop-opacity='0'/>" +
      "</linearGradient></defs>" +
      '<g class="line-chart__grid">' +
      grid +
      "</g>" +
      '<path class="line-chart__area" d="' +
      area +
      '" />' +
      '<path class="line-chart__line" d="' +
      line +
      '" />' +
      dots +
      '<g class="line-chart__axis">' +
      labels +
      "</g>" +
      "</svg>";

    if (foot) foot.textContent = data.foot;
  }

  /* ---------------------------------------------------------------
     Visibility & profile
     --------------------------------------------------------------- */
  function applyVisibility(values) {
    document.querySelectorAll("[data-visibility]").forEach(function (select) {
      var key = select.getAttribute("data-visibility");
      select.value = values[key] || "private";
    });
    var badge = document.getElementById("publicBadge");
    if (badge) badge.textContent = VIS_LABEL[values.profile] || "비공개";
  }

  function applyProfile() {
    document.querySelectorAll("[data-profile-field]").forEach(function (el) {
      var key = el.getAttribute("data-profile-field");
      if (player[key]) el.textContent = player[key];
    });
    var line =
      (player.sport || "야구") +
      " · " +
      (player.position || "") +
      " · " +
      (player.bats || "") +
      " · " +
      (player.team || "");
    document.querySelectorAll("[data-profile-line]").forEach(function (el) {
      el.textContent = line;
    });
  }

  function renderProfile() {
    applyProfile();
    setPrivateArea(document.getElementById("profileCardBody"), !canSee("profile"), "프로필 정보");
  }

  function initVisibility() {
    applyVisibility(player.visibility);

    if (!IS_STUDENT) {
      document.querySelectorAll("[data-visibility]").forEach(function (select) {
        select.disabled = true;
        select.setAttribute("aria-disabled", "true");
      });
      return;
    }

    var saveBtn = document.getElementById("saveVisibility");
    if (!saveBtn) return;
    saveBtn.addEventListener("click", function () {
      var next = {};
      document.querySelectorAll("[data-visibility]").forEach(function (select) {
        next[select.getAttribute("data-visibility")] = select.value;
      });
      if (!commitVisibility(next)) {
        applyVisibility(player.visibility);
        Store.toast("저장 공간이 부족해 공개 범위를 저장하지 못했습니다.", "warn");
        return;
      }
      applyVisibility(next);
      renderAll();
      var saved = document.getElementById("visibilitySaved");
      if (saved) {
        var d = new Date();
        saved.textContent =
          "마지막 저장 · " +
          d.getFullYear() +
          "." +
          pad2(d.getMonth() + 1) +
          "." +
          pad2(d.getDate());
      }
      Store.toast("공개 범위를 저장했습니다.");
    });
  }

  function initProfile() {
    renderProfile();

    var form = document.getElementById("profileForm");
    if (!form || !IS_STUDENT) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = {};
      form.querySelectorAll("[data-profile-input]").forEach(function (input) {
        data[input.getAttribute("data-profile-input")] = input.value.trim();
      });
      if (!commitProfile(data)) {
        Store.toast("저장 공간이 부족해 프로필을 저장하지 못했습니다.", "warn");
        return;
      }

      renderProfile();

      document.getElementById("profileModal").hidden = true;
      document.body.classList.remove("is-locked");
      Store.toast("프로필 정보를 저장했습니다.");
    });
  }

  /* ---------------------------------------------------------------
     Profile cover media (hero background photo / video)
     --------------------------------------------------------------- */
  var IMAGE_MAX_SIDE = 1280;
  var VIDEO_MAX_BYTES = 2 * 1024 * 1024;

  function normalizeHero(item) {
    if (!item || item.type === "none") return null;
    if (typeof item !== "object" || !item.src) return null;
    if (!/^(data:(image|video)\/|images\/)/.test(String(item.src))) return null;
    return item;
  }

  function mediaNode(item) {
    var el;
    if (item.type === "video") {
      el = document.createElement("video");
      el.src = item.src;
      el.autoplay = true;
      el.loop = true;
      el.muted = true;
      el.playsInline = true;
      el.setAttribute("preload", "auto");
    } else {
      el = document.createElement("img");
      el.src = item.src;
      el.alt = "";
    }
    el.className = "player-hero__cover-item";
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("data-media-item", "");
    return el;
  }

  function applyMedia() {
    var cover = document.getElementById("playerCover");
    if (!cover) return;

    var top = document.getElementById("playerHeroTop") || cover.parentNode;
    var old = cover.querySelector("[data-media-item]");
    if (old) old.parentNode.removeChild(old);

    var label = document.getElementById("mediaUploadLabel");
    var removeBtn = document.getElementById("mediaRemoveBtn");
    var valid = !!(heroMedia && heroMedia.src && heroMedia.type);

    if (top) top.classList.toggle("has-cover", valid);

    if (valid) {
      cover.appendChild(mediaNode(heroMedia));
      if (label) label.textContent = "배경 사진 · 영상 변경";
      if (removeBtn) removeBtn.hidden = false;
    } else {
      if (label) label.textContent = "배경 사진 · 영상 올리기";
      if (removeBtn) removeBtn.hidden = true;
    }
  }

  function saveMedia(item) {
    if (!commitHero(item)) {
      applyMedia();
      Store.toast("저장 공간이 부족합니다. 더 작은 사진이나 영상을 선택해 주세요.", "warn");
      return;
    }
    applyMedia();
    Store.toast(
      item && item.type === "video" ? "배경 영상을 저장했습니다." : "배경 사진을 저장했습니다."
    );
  }

  function readImageFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var width = img.naturalWidth;
        var height = img.naturalHeight;
        if (!width || !height) {
          Store.toast("이미지를 읽지 못했습니다. 다른 파일을 선택해 주세요.", "warn");
          return;
        }
        var scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(width, height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveMedia({
          type: "image",
          src: canvas.toDataURL("image/jpeg", 0.82),
          name: file.name
        });
      };
      img.onerror = function () {
        Store.toast("이미지를 읽지 못했습니다. 다른 파일을 선택해 주세요.", "warn");
      };
      img.src = reader.result;
    };
    reader.onerror = function () {
      Store.toast("파일을 읽지 못했습니다. 다시 시도해 주세요.", "warn");
    };
    reader.readAsDataURL(file);
  }

  function readVideoFile(file) {
    if (file.size > VIDEO_MAX_BYTES) {
      Store.toast("영상은 2MB 이하만 올릴 수 있습니다. 더 짧은 영상을 선택해 주세요.", "warn");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      saveMedia({ type: "video", src: reader.result, name: file.name });
    };
    reader.onerror = function () {
      Store.toast("파일을 읽지 못했습니다. 다시 시도해 주세요.", "warn");
    };
    reader.readAsDataURL(file);
  }

  function handleMediaFile(file) {
    if (!file) return;
    if (file.type.indexOf("image/") === 0) {
      if (file.size > 12 * 1024 * 1024) {
        Store.toast("사진은 12MB 이하 파일을 선택해 주세요.", "warn");
        return;
      }
      readImageFile(file);
    } else if (file.type.indexOf("video/") === 0) {
      readVideoFile(file);
    } else {
      Store.toast("사진 또는 영상 파일만 올릴 수 있습니다.", "warn");
    }
  }

  function initMedia() {
    var cover = document.getElementById("playerCover");
    var input = document.getElementById("profileMediaInput");
    var uploadBtn = document.getElementById("mediaUploadBtn");
    var removeBtn = document.getElementById("mediaRemoveBtn");
    if (!cover) return;

    applyMedia();
    if (!IS_STUDENT || !input || !uploadBtn) return;

    uploadBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      input.value = "";
      input.click();
    });

    input.addEventListener("change", function () {
      if (input.files && input.files[0]) handleMediaFile(input.files[0]);
    });

    if (removeBtn) {
      removeBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        if (!commitHero(null)) {
          Store.toast("저장 공간이 부족해 삭제하지 못했습니다.", "warn");
          return;
        }
        applyMedia();
        Store.toast("배경 사진·영상을 삭제했습니다.");
      });
    }
  }

  /* ---------------------------------------------------------------
     Growth feed & parent cheers
     --------------------------------------------------------------- */
  var FEED_TAG = { 훈련: "tag--green", 경기: "tag--blue", 목표: "tag--lime" };

  function buildFeed() {
    var posts = [];
    var latest = Demo.latestTraining(player);
    if (latest) {
      var intensity = INTENSITY[latest.intensity] || INTENSITY.mid;
      posts.push({
        id: "training-" + latest.id,
        type: "훈련",
        date: latest.date,
        title: latest.type + " " + Number(latest.minutes || 0) + "분 훈련을 마쳤습니다",
        body:
          (latest.memo ? latest.memo + " — " : "") +
          "오늘의 기록이 주간 훈련 현황에 바로 반영됩니다.",
        meta: latest.type + " " + Number(latest.minutes || 0) + "분 · 강도 " + intensity.label
      });
    }

    var game = latestGame();
    if (game) {
      posts.push({
        id: "game-" + game.id,
        type: "경기",
        date: game.date,
        title: "vs " + game.opponent + " · " + game.performance,
        body:
          (game.score ? game.score + " " + game.result + " 경기에서 " : "") +
          game.performance +
          "을 기록했습니다. 다음 경기에서도 같은 흐름을 이어갑니다.",
        meta:
          game.competition + (game.score ? " · " + game.score + " " + game.result : " · " + game.result)
      });
    }

    var days = Demo.weekDays(player);
    posts.push({
      id: "goal-week",
      type: "목표",
      date: todayKey(),
      title:
        days >= Demo.WEEKLY_GOAL_DAYS
          ? "주 5회 훈련 목표를 달성했습니다"
          : "주 5회 훈련 목표 · " + days + "/" + Demo.WEEKLY_GOAL_DAYS + "일",
      body:
        days >= Demo.WEEKLY_GOAL_DAYS
          ? "이번 주 " + days + "일 훈련으로 주간 목표를 채웠습니다. 다음 목표는 이번 달 타율 .320입니다."
          : "이번 주 " + days + "일 훈련했습니다. " + Math.max(0, Demo.WEEKLY_GOAL_DAYS - days) + "일 더 기록하면 목표를 달성합니다.",
      meta: "주간 목표 · " + days + "/" + Demo.WEEKLY_GOAL_DAYS + "일"
    });

    return posts;
  }

  function stamp(date) {
    var d = date || new Date();
    return (
      d.getFullYear() +
      "." +
      pad2(d.getMonth() + 1) +
      "." +
      pad2(d.getDate()) +
      " " +
      pad2(d.getHours()) +
      ":" +
      pad2(d.getMinutes())
    );
  }

  function cheerBlock(post, list) {
    if (!list.length) {
      return (
        '<p class="cheer-empty">' +
        (IS_PARENT
          ? "아직 응원글이 없습니다. 첫 응원을 남겨보세요."
          : "아직 응원글이 없습니다.") +
        "</p>"
      );
    }
    return (
      '<div class="cheer-list">' +
      list
        .map(function (cheer) {
          var mine = IS_PARENT && SESSION && cheer.authorEmail === SESSION.email;
          return (
            '<div class="cheer-item">' +
            '<span class="cheer-item__avatar" aria-hidden="true">' +
            escapeHtml(String(cheer.author || "학부모").charAt(0)) +
            "</span>" +
            '<div class="cheer-item__body">' +
            '<div class="cheer-item__head"><strong>' +
            escapeHtml(cheer.author || "학부모") +
            "</strong><span>학부모 · " +
            escapeHtml(cheer.createdLabel || "") +
            "</span></div>" +
            "<p>" +
            escapeHtml(cheer.text) +
            "</p></div>" +
            (mine
              ? '<button class="icon-action" type="button" data-delete-cheer="' +
                escapeHtml(post.id) +
                '" data-cheer-id="' +
                escapeHtml(cheer.id) +
                '" aria-label="내 응원글 삭제"><svg class="icon" aria-hidden="true"><use href="#i-trash" /></svg></button>'
              : "") +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function feedCard(post, list) {
    var tagClass = FEED_TAG[post.type] || "tag--green";
    var formHtml = "";
    if (IS_PARENT) {
      formHtml =
        '<form class="cheer-form" data-cheer-form="' +
        escapeHtml(post.id) +
        '">' +
        '<textarea class="textarea textarea--sm" name="cheer" rows="2" maxlength="200" aria-label="' +
        escapeHtml(post.title) +
        ' 게시물에 응원글 작성" placeholder="' +
        escapeHtml(player.name) +
        ' 선수에게 응원의 한마디를 남겨주세요." required></textarea>' +
        '<div class="cheer-form__foot"><span>학부모 계정으로 작성 · 최대 200자</span>' +
        '<button class="btn btn--dark btn--sm" type="submit"><svg class="icon" aria-hidden="true"><use href="#i-send" /></svg>응원 남기기</button></div>' +
        "</form>";
    }

    return (
      '<article class="feed-card">' +
      '<div class="feed-card__head">' +
      '<span class="feed-card__avatar" aria-hidden="true">' +
      escapeHtml(String(player.name || "하").charAt(0)) +
      "</span>" +
      '<div class="feed-card__who"><strong>' +
      escapeHtml(player.name) +
      "</strong><span>학생 · " +
      shortDate(post.date) +
      "</span></div>" +
      '<span class="tag ' +
      tagClass +
      '">' +
      escapeHtml(post.type) +
      "</span>" +
      "</div>" +
      "<h3>" +
      escapeHtml(post.title) +
      "</h3>" +
      "<p>" +
      escapeHtml(post.body) +
      "</p>" +
      '<div class="feed-card__meta"><span>' +
      escapeHtml(post.meta) +
      '</span><span><svg class="icon" aria-hidden="true"><use href="#i-spark" /></svg>응원 ' +
      list.length +
      "</span></div>" +
      cheerBlock(post, list) +
      formHtml +
      "</article>"
    );
  }

  function renderFeed() {
    var container = document.getElementById("feedList");
    if (!container) return;

    var posts = buildFeed();
    var total = 0;
    container.innerHTML = posts
      .map(function (post) {
        var list = Array.isArray(cheers[post.id]) ? cheers[post.id] : [];
        total += list.length;
        return feedCard(post, list);
      })
      .join("");

    var count = document.getElementById("feedCheerCount");
    if (count) count.textContent = "응원 " + total;
    var foot = document.getElementById("feedCheerFoot");
    if (foot) foot.textContent = "전체 응원 " + total + "개";

    container.querySelectorAll("[data-cheer-form]").forEach(function (form) {
      form.addEventListener("submit", function (event) {
        handleCheerSubmit(event, form);
      });
    });
    container.querySelectorAll("[data-delete-cheer]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        handleCheerDelete(btn);
      });
    });
  }

  function handleCheerSubmit(event, form) {
    event.preventDefault();
    if (!IS_PARENT || !SESSION) {
      Store.toast("응원글은 학부모 계정에서만 작성할 수 있습니다.", "warn");
      return;
    }
    var postId = form.getAttribute("data-cheer-form");
    var field = form.querySelector("textarea");
    var text = (field.value || "").trim();
    if (text.length < 2) {
      Store.toast("응원글을 두 글자 이상 입력해 주세요.", "warn");
      field.focus();
      return;
    }
    if (text.length > 200) {
      Store.toast("응원글은 200자까지 작성할 수 있습니다.", "warn");
      field.focus();
      return;
    }

    var list = (cheers[postId] || []).slice();
    list.push({
      id: "c-" + Date.now(),
      author: SESSION.name,
      authorEmail: SESSION.email,
      text: text,
      createdAt: new Date().toISOString(),
      createdLabel: stamp()
    });
    var next = Object.assign({}, cheers);
    next[postId] = list;
    if (!commitCheers(next)) {
      Store.toast("저장 공간이 부족해 응원글을 저장하지 못했습니다.", "warn");
      return;
    }
    renderFeed();
    Store.toast("응원글을 남겼습니다. " + player.name + " 선수에게 전달됩니다.");
  }

  function handleCheerDelete(btn) {
    if (!IS_PARENT || !SESSION) return;
    var postId = btn.getAttribute("data-delete-cheer");
    var cheerId = btn.getAttribute("data-cheer-id");
    var next = Object.assign({}, cheers);
    next[postId] = (cheers[postId] || []).filter(function (cheer) {
      return !(cheer.id === cheerId && cheer.authorEmail === SESSION.email);
    });
    if (!commitCheers(next)) {
      Store.toast("저장 공간이 부족해 응원글을 삭제하지 못했습니다.", "warn");
      return;
    }
    renderFeed();
    Store.toast("응원글을 삭제했습니다.");
  }

  /* ---------------------------------------------------------------
     Media gallery (photo / video + comments)
     --------------------------------------------------------------- */
  var COMMENT_MAX = 300;

  var ROLE_LABEL = { player: "학생", parent: "학부모", coach: "코치" };

  function roleLabel(role) {
    return ROLE_LABEL[role] || "학생";
  }

  function avatarTone(role) {
    if (role === "coach") return " is-coach";
    if (role === "parent") return " is-parent";
    return "";
  }

  function normalizeGallery(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (item) {
      return item && item.src && typeof item.src === "string";
    });
  }

  function saveGallery(next) {
    if (!commitGallery(next)) {
      Store.toast("저장 공간이 부족합니다. 더 작은 사진이나 동영상을 올려 주세요.", "warn");
      return false;
    }
    renderGallery();
    return true;
  }

  function galleryDateLabel(item) {
    var date = new Date(item.createdAt || Date.now());
    if (isNaN(date.getTime())) date = new Date();
    return stamp(date);
  }

  function commentItem(comment, mediaId) {
    var mine = !!SESSION && comment.authorEmail === SESSION.email;
    return (
      '<div class="gallery-comment">' +
      '<span class="gallery-comment__avatar' +
      avatarTone(comment.authorRole) +
      '" aria-hidden="true">' +
      escapeHtml(String(comment.author || roleLabel(comment.authorRole)).charAt(0)) +
      "</span>" +
      '<div class="gallery-comment__body">' +
      '<div class="gallery-comment__head"><strong>' +
      escapeHtml(comment.author || roleLabel(comment.authorRole)) +
      "</strong><span>" +
      escapeHtml(roleLabel(comment.authorRole)) +
      " · " +
      escapeHtml(galleryDateLabel(comment)) +
      "</span></div>" +
      "<p>" +
      escapeHtml(comment.text) +
      "</p></div>" +
      (mine
        ? '<button class="icon-action gallery-comment__delete" type="button" data-gallery-comment-delete="' +
          escapeHtml(mediaId) +
          '" data-comment-id="' +
          escapeHtml(comment.id) +
          '" aria-label="내 댓글 삭제"><svg class="icon" aria-hidden="true"><use href="#i-trash" /></svg></button>'
        : "") +
      "</div>"
    );
  }

  function galleryComments(item) {
    var list = Array.isArray(item.comments) ? item.comments : [];
    var inner = list.length
      ? list
          .map(function (comment) {
            return commentItem(comment, item.id);
          })
          .join("")
      : '<p class="gallery-comments__empty">아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</p>';

    return (
      '<div class="gallery-comments">' +
      '<p class="gallery-comments__title"><svg class="icon" aria-hidden="true"><use href="#i-note" /></svg>댓글 ' +
      list.length +
      "</p>" +
      inner +
      "</div>"
    );
  }

  function galleryMedia(item) {
    if (item.type === "video") {
      return (
        '<video class="gallery-card__video" src="' +
        escapeHtml(item.src) +
        '" controls playsinline preload="metadata"></video>'
      );
    }
    return (
      '<img class="gallery-card__img" src="' +
      escapeHtml(item.src) +
      '" alt="' +
      escapeHtml(item.caption || player.name + " 선수 활동 사진") +
      '" loading="lazy" />'
    );
  }

  function galleryCard(item) {
    var mine = !!SESSION && item.authorEmail === SESSION.email;
    var comments = Array.isArray(item.comments) ? item.comments : [];
    return (
      '<article class="gallery-card" data-gallery-card="' +
      escapeHtml(item.id) +
      '">' +
      '<div class="gallery-card__media">' +
      galleryMedia(item) +
      '<span class="gallery-card__badge">' +
      (item.type === "video" ? "동영상" : "사진") +
      "</span>" +
      (mine
        ? '<button class="gallery-card__delete" type="button" data-gallery-delete="' +
          escapeHtml(item.id) +
          '" aria-label="내 미디어 삭제"><svg class="icon" aria-hidden="true"><use href="#i-trash" /></svg></button>'
        : "") +
      "</div>" +
      '<div class="gallery-card__body">' +
      '<div class="gallery-card__head">' +
      '<span class="gallery-card__avatar' +
      avatarTone(item.authorRole) +
      '" aria-hidden="true">' +
      escapeHtml(String(item.author || roleLabel(item.authorRole)).charAt(0)) +
      "</span>" +
      '<div class="gallery-card__who"><strong>' +
      escapeHtml(item.author || roleLabel(item.authorRole)) +
      "</strong><span>" +
      escapeHtml(roleLabel(item.authorRole)) +
      " · " +
      escapeHtml(galleryDateLabel(item)) +
      "</span></div>" +
      "</div>" +
      (item.caption
        ? '<p class="gallery-card__caption">' + escapeHtml(item.caption) + "</p>"
        : "") +
      galleryComments(item) +
      '<form class="gallery-comment-form" data-gallery-comment-form="' +
      escapeHtml(item.id) +
      '">' +
      '<label class="sr-only" for="galleryComment-' +
      escapeHtml(item.id) +
      '">댓글 작성</label>' +
      '<textarea class="textarea textarea--sm" id="galleryComment-' +
      escapeHtml(item.id) +
      '" name="comment" rows="2" maxlength="' +
      COMMENT_MAX +
      '" placeholder="' +
      escapeHtml(roleLabel(ROLE) + "로 댓글을 남겨보세요.") +
      '" required></textarea>' +
      '<div class="gallery-comment-form__foot"><span>' +
      escapeHtml(roleLabel(ROLE)) +
      " 계정 · 최대 " +
      COMMENT_MAX +
      '자</span><button class="btn btn--dark btn--sm" type="submit"><svg class="icon" aria-hidden="true"><use href="#i-send" /></svg>댓글 등록</button></div>' +
      "</form>" +
      "</div>" +
      "</article>"
    );
  }

  function renderGallery() {
    var grid = document.getElementById("galleryGrid");
    if (!grid) return;

    grid.innerHTML = gallery.length
      ? gallery
          .map(function (item) {
            return galleryCard(item);
          })
          .join("")
      : '<div class="empty-state gallery-empty"><svg class="icon" aria-hidden="true"><use href="#i-camera" /></svg><strong>아직 올린 사진이나 동영상이 없습니다</strong><p>훈련 · 경기 순간을 첫 미디어로 남겨보세요.</p></div>';

    var photos = 0;
    var videos = 0;
    var comments = 0;
    gallery.forEach(function (item) {
      if (item.type === "video") videos += 1;
      else photos += 1;
      comments += Array.isArray(item.comments) ? item.comments.length : 0;
    });

    var total = gallery.length;
    var count = document.getElementById("galleryCount");
    if (count) count.textContent = total + "개";
    var nav = document.getElementById("galleryNavCount");
    if (nav) nav.textContent = total;
    var foot = document.getElementById("galleryFoot");
    if (foot) {
      foot.textContent = "사진 " + photos + " · 동영상 " + videos + " · 댓글 " + comments;
    }

    grid.querySelectorAll("[data-gallery-comment-form]").forEach(function (form) {
      form.addEventListener("submit", function (event) {
        handleGalleryComment(event, form);
      });
    });
    grid.querySelectorAll("[data-gallery-comment-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        handleGalleryCommentDelete(btn);
      });
    });
    grid.querySelectorAll("[data-gallery-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        handleGalleryDelete(btn);
      });
    });
  }

  function handleGalleryComment(event, form) {
    event.preventDefault();
    if (!CAN_MEDIA || !SESSION) {
      Store.toast("댓글은 학생 · 학부모 · 코치 계정에서만 작성할 수 있습니다.", "warn");
      return;
    }
    var mediaId = form.getAttribute("data-gallery-comment-form");
    var field = form.querySelector("textarea");
    var text = (field.value || "").trim();
    if (text.length < 2) {
      Store.toast("댓글을 두 글자 이상 입력해 주세요.", "warn");
      field.focus();
      return;
    }
    if (text.length > COMMENT_MAX) {
      Store.toast("댓글은 " + COMMENT_MAX + "자까지 작성할 수 있습니다.", "warn");
      field.focus();
      return;
    }

    var next = gallery.map(function (item) {
      if (item.id !== mediaId) return item;
      var comments = Array.isArray(item.comments) ? item.comments.slice() : [];
      comments.push({
        id: "gc-" + Date.now(),
        author: SESSION.name,
        authorEmail: SESSION.email,
        authorRole: SESSION.role,
        text: text,
        createdAt: new Date().toISOString()
      });
      return Object.assign({}, item, { comments: comments });
    });

    if (!saveGallery(next)) return;
    Store.toast("댓글을 남겼습니다.");
    var card = document.querySelector('[data-gallery-card="' + mediaId + '"]');
    if (card) {
      var box = card.querySelector(".gallery-comments");
      if (box) box.scrollIntoView({ block: "nearest" });
    }
  }

  function handleGalleryCommentDelete(btn) {
    if (!SESSION) return;
    var mediaId = btn.getAttribute("data-gallery-comment-delete");
    var commentId = btn.getAttribute("data-comment-id");
    var removed = false;
    var next = gallery.map(function (item) {
      if (item.id !== mediaId) return item;
      var comments = (Array.isArray(item.comments) ? item.comments : []).filter(function (comment) {
        var keep = !(comment.id === commentId && comment.authorEmail === SESSION.email);
        if (!keep) removed = true;
        return keep;
      });
      return Object.assign({}, item, { comments: comments });
    });
    if (!removed) return;
    if (!saveGallery(next)) return;
    Store.toast("댓글을 삭제했습니다.");
  }

  function handleGalleryDelete(btn) {
    if (!SESSION) return;
    var mediaId = btn.getAttribute("data-gallery-delete");
    var target = gallery.filter(function (item) {
      return item.id === mediaId;
    })[0];
    if (!target || target.authorEmail !== SESSION.email) {
      Store.toast("내가 올린 미디어만 삭제할 수 있습니다.", "warn");
      return;
    }
    var next = gallery.filter(function (item) {
      return item.id !== mediaId;
    });
    if (!saveGallery(next)) return;
    Store.toast("미디어를 삭제했습니다.");
  }

  /* gallery upload modal */
  var galleryPending = null;

  function resetGalleryUpload() {
    galleryPending = null;
    var preview = document.getElementById("galleryUploadPreview");
    if (preview) {
      preview.innerHTML =
        '<button class="gallery-upload__pick" type="button" id="galleryPickBtn">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-camera" /></svg>' +
        "<strong>사진 또는 동영상 선택</strong>" +
        "<span>사진은 자동 압축 · 동영상은 2MB 이하</span></button>";
      var pick = document.getElementById("galleryPickBtn");
      if (pick) pick.addEventListener("click", pickGalleryFile);
    }
    var caption = document.getElementById("galleryCaption");
    if (caption) caption.value = "";
    var meta = document.getElementById("galleryUploadMeta");
    if (meta) {
      meta.textContent =
        "사진은 최대 1280px로 자동 압축됩니다. 동영상은 2MB 이하만 올릴 수 있습니다.";
    }
    var submit = document.getElementById("galleryUploadSubmit");
    if (submit) submit.disabled = false;
  }

  function pickGalleryFile() {
    var input = document.getElementById("galleryFileInput");
    if (input) input.click();
  }

  function showGalleryPreview(item) {
    var preview = document.getElementById("galleryUploadPreview");
    if (!preview) return;
    var media =
      item.type === "video"
        ? '<video src="' + escapeHtml(item.src) + '" controls playsinline preload="metadata"></video>'
        : '<img src="' + escapeHtml(item.src) + '" alt="업로드 미리보기" />';
    preview.innerHTML =
      media +
      '<button class="gallery-upload__change" type="button" id="galleryPickBtn">다른 파일 선택</button>';
    var pick = document.getElementById("galleryPickBtn");
    if (pick) pick.addEventListener("click", pickGalleryFile);
    var meta = document.getElementById("galleryUploadMeta");
    if (meta) {
      meta.textContent =
        (item.type === "video" ? "동영상" : "사진") +
        " 준비 완료 · 설명을 입력하고 올리기를 눌러 주세요.";
    }
  }

  function compressGalleryImage(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var width = img.naturalWidth;
        var height = img.naturalHeight;
        if (!width || !height) {
          Store.toast("이미지를 읽지 못했습니다. 다른 파일을 선택해 주세요.", "warn");
          return;
        }
        var scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(width, height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        galleryPending = {
          type: "image",
          src: canvas.toDataURL("image/jpeg", 0.82),
          name: file.name
        };
        showGalleryPreview(galleryPending);
      };
      img.onerror = function () {
        Store.toast("이미지를 읽지 못했습니다. 다른 파일을 선택해 주세요.", "warn");
      };
      img.src = reader.result;
    };
    reader.onerror = function () {
      Store.toast("파일을 읽지 못했습니다. 다시 시도해 주세요.", "warn");
    };
    reader.readAsDataURL(file);
  }

  function readGalleryFile(file) {
    if (!file) return;
    if (file.type.indexOf("image/") === 0) {
      if (file.size > 12 * 1024 * 1024) {
        Store.toast("사진은 12MB 이하 파일을 선택해 주세요.", "warn");
        return;
      }
      compressGalleryImage(file);
    } else if (file.type.indexOf("video/") === 0) {
      if (file.size > VIDEO_MAX_BYTES) {
        Store.toast("동영상은 2MB 이하만 올릴 수 있습니다. 더 짧은 영상을 선택해 주세요.", "warn");
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        galleryPending = { type: "video", src: reader.result, name: file.name };
        showGalleryPreview(galleryPending);
      };
      reader.onerror = function () {
        Store.toast("파일을 읽지 못했습니다. 다시 시도해 주세요.", "warn");
      };
      reader.readAsDataURL(file);
    } else {
      Store.toast("사진 또는 동영상 파일만 올릴 수 있습니다.", "warn");
    }
  }

  function initGallery() {
    var uploadBtn = document.getElementById("galleryUploadBtn");
    var input = document.getElementById("galleryFileInput");
    if (!uploadBtn || !input) return;

    renderGallery();

    uploadBtn.addEventListener("click", function () {
      if (!CAN_MEDIA || !SESSION) {
        Store.toast("업로드는 학생 · 학부모 · 코치 계정에서만 가능합니다.", "warn");
        return;
      }
      resetGalleryUpload();
      if (Store.openModal) Store.openModal("galleryUploadModal");
    });

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      input.value = "";
      readGalleryFile(file);
    });

    var form = document.getElementById("galleryUploadForm");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!CAN_MEDIA || !SESSION) {
        Store.toast("업로드는 학생 · 학부모 · 코치 계정에서만 가능합니다.", "warn");
        return;
      }
      if (!galleryPending) {
        Store.toast("먼저 사진 또는 동영상을 선택해 주세요.", "warn");
        return;
      }
      var captionField = document.getElementById("galleryCaption");
      var caption = captionField ? captionField.value.trim() : "";
      if (caption.length > COMMENT_MAX) {
        Store.toast("설명은 " + COMMENT_MAX + "자까지 입력할 수 있습니다.", "warn");
        if (captionField) captionField.focus();
        return;
      }

      var item = {
        id: "g-" + Date.now(),
        type: galleryPending.type,
        src: galleryPending.src,
        caption: caption,
        author: SESSION.name,
        authorEmail: SESSION.email,
        authorRole: SESSION.role,
        createdAt: new Date().toISOString(),
        comments: []
      };
      var next = [item].concat(gallery);

      if (!saveGallery(next)) return;
      if (Store.closeModal) Store.closeModal("galleryUploadModal");
      resetGalleryUpload();
      Store.toast(item.type === "video" ? "동영상을 올렸습니다." : "사진을 올렸습니다.");
      if (window.AppShell) window.AppShell.showView("media", { alwaysScroll: true });
    });
  }

  /* ---------------------------------------------------------------
     Parent → coach requests
     --------------------------------------------------------------- */
  function requestCard(req) {
    var done = req.status === "done";
    return (
      '<article class="request-card">' +
      '<div class="request-card__head">' +
      '<span class="request-card__ico"><svg class="icon" aria-hidden="true"><use href="#i-mail" /></svg></span>' +
      '<div class="request-card__title"><strong>' +
      escapeHtml(req.title) +
      "</strong><span>" +
      escapeHtml(req.type) +
      " · " +
      escapeHtml(req.createdLabel || "") +
      "</span></div>" +
      '<span class="tag ' +
      (done ? "tag--green" : "tag--gold") +
      '">' +
      (done ? "확인 완료" : "답변 대기") +
      "</span>" +
      "</div>" +
      "<p>" +
      escapeHtml(req.body) +
      "</p>" +
      '<div class="request-card__foot"><span>대상 · ' +
      escapeHtml(player.name) +
      " 선수</span><span>" +
      (done ? "코치 확인 완료" : "코치 확인 전") +
      "</span>" +
      (done
        ? ""
        : '<button class="request-cancel" type="button" data-cancel-request="' +
          escapeHtml(req.id) +
          '">요청 취소</button>') +
      "</div></article>"
    );
  }

  function renderRequests() {
    var container = document.getElementById("requestList");
    var pending = requests.filter(function (req) {
      return req.status !== "done";
    }).length;

    var summary = document.getElementById("requestSummary");
    if (summary) summary.textContent = "대기 " + pending + "건";
    var sidebarCount = document.getElementById("sidebarRequestCount");
    if (sidebarCount) sidebarCount.textContent = pending;

    if (!container) return;
    var sorted = requests.slice().sort(function (a, b) {
      var left = String(a.createdAt || "");
      var right = String(b.createdAt || "");
      return left === right ? 0 : left < right ? 1 : -1;
    });
    container.innerHTML = sorted.length
      ? sorted.map(requestCard).join("")
      : '<div class="empty-state"><svg class="icon" aria-hidden="true"><use href="#i-mail" /></svg><strong>아직 보낸 요청이 없습니다.</strong><p>훈련 일정, 컨디션, 상담 등 코치에게 전달할 내용을 보내보세요.</p><button class="btn btn--dark btn--sm" type="button" data-modal-open="requestModal" style="margin-top:10px"><svg class="icon" aria-hidden="true"><use href="#i-send" /></svg>첫 요청 보내기</button></div>';
  }

  function initRequestForm() {
    var form = document.getElementById("requestForm");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!IS_PARENT || !SESSION) {
        Store.toast("요청은 학부모 계정에서만 보낼 수 있습니다.", "warn");
        return;
      }
      var type = document.getElementById("requestType").value;
      var title = document.getElementById("requestTitle").value.trim();
      var body = document.getElementById("requestBody").value.trim();

      if (!title || !body) {
        Store.toast("요청 제목과 내용을 입력해 주세요.", "warn");
        return;
      }

      var next = requests.concat([
        {
          id: "r-" + Date.now(),
          type: type,
          title: title,
          body: body,
          player: player.name,
          parent: SESSION.name,
          parentEmail: SESSION.email,
          status: "pending",
          createdAt: new Date().toISOString(),
          createdLabel: stamp()
        }
      ]);
      if (!commitRequests(next)) {
        Store.toast("저장 공간이 부족해 요청을 보내지 못했습니다.", "warn");
        return;
      }

      form.reset();
      var playerField = document.getElementById("requestPlayer");
      if (playerField) playerField.value = player.name;
      renderRequests();
      if (Store.closeModal) Store.closeModal("requestModal");
      Store.toast("코치에게 요청을 보냈습니다.");
    });
  }

  document.addEventListener("click", function (event) {
    var cancel = event.target.closest("[data-cancel-request]");
    if (!cancel) return;
    if (!IS_PARENT) return;
    var id = cancel.getAttribute("data-cancel-request");
    var next = requests.filter(function (req) {
      return req.id !== id;
    });
    if (!commitRequests(next)) {
      Store.toast("저장 공간이 부족해 요청을 취소하지 못했습니다.", "warn");
      return;
    }
    renderRequests();
    Store.toast("요청을 취소했습니다.");
  });

  /* ---------------------------------------------------------------
     Forms & bindings
     --------------------------------------------------------------- */
  function bindRangeButtons(selector, onChange) {
    document.querySelectorAll(selector).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var group = btn.parentElement;
        group.querySelectorAll("button").forEach(function (item) {
          item.classList.toggle("is-active", item === btn);
          item.setAttribute("aria-pressed", item === btn ? "true" : "false");
        });
        onChange(btn);
      });
    });
  }

  function initTrainingForm() {
    var form = document.getElementById("trainingForm");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!IS_STUDENT) {
        Store.toast("훈련 기록은 학생 계정에서만 수정할 수 있습니다.", "warn");
        return;
      }
      var date = document.getElementById("trainingDate").value;
      var type = document.getElementById("trainingType").value;
      var minutes = Number(document.getElementById("trainingMinutes").value);
      var memo = document.getElementById("trainingMemo").value.trim();
      var checked = form.querySelector('input[name="intensity"]:checked');
      var intensity = checked ? checked.value : "mid";

      if (!date || !minutes || minutes < 5) {
        Store.toast("날짜와 훈련 시간을 확인해 주세요.", "warn");
        return;
      }

      var next = training.concat([
        {
          id: "t-" + Date.now(),
          date: date,
          type: type,
          minutes: Math.min(360, minutes),
          intensity: intensity,
          memo: memo
        }
      ]);
      if (!commitTraining(next)) {
        Store.toast("저장 공간이 부족해 훈련 기록을 저장하지 못했습니다.", "warn");
        return;
      }

      renderAll();
      renderFeed();

      form.reset();
      var dateInput = document.getElementById("trainingDate");
      if (dateInput) dateInput.value = todayKey();
      var mid = form.querySelector('input[name="intensity"][value="mid"]');
      if (mid) mid.checked = true;

      document.getElementById("trainingModal").hidden = true;
      document.body.classList.remove("is-locked");
      Store.toast(minutes + "분 훈련을 기록했습니다. 주간 현황에 반영됐어요.");
    });
  }

  function initGameForm() {
    var form = document.getElementById("gameForm");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!IS_STUDENT) {
        Store.toast("경기 기록은 학생 계정에서만 수정할 수 있습니다.", "warn");
        return;
      }
      var scoreField = document.getElementById("gameScore");
      var atBatsField = document.getElementById("gameAtBats");
      var hitsField = document.getElementById("gameHits");
      var walksField = document.getElementById("gameWalks");

      var game = {
        id: "gm-" + Date.now(),
        date: document.getElementById("gameDate").value,
        competition: document.getElementById("gameCompetition").value.trim(),
        opponent: document.getElementById("gameOpponent").value.trim(),
        result: document.getElementById("gameResult").value,
        score: scoreField ? scoreField.value.trim() : "",
        performance: document.getElementById("gamePerformance").value.trim(),
        achieved: false,
        atBats: Math.max(0, Number(atBatsField ? atBatsField.value : 0) || 0),
        hits: Math.max(0, Number(hitsField ? hitsField.value : 0) || 0),
        walks: Math.max(0, Number(walksField ? walksField.value : 0) || 0)
      };
      if (!game.date || !game.competition || !game.opponent || !game.performance) {
        Store.toast("모든 항목을 입력해 주세요.", "warn");
        return;
      }
      if (game.hits > game.atBats) {
        Store.toast("안타 수는 타수보다 클 수 없습니다.", "warn");
        return;
      }

      if (!commitGames(games.concat([game]))) {
        Store.toast("저장 공간이 부족해 경기 기록을 저장하지 못했습니다.", "warn");
        return;
      }

      renderAll();
      renderFeed();

      form.reset();
      var dateInput = document.getElementById("gameDate");
      if (dateInput) dateInput.value = todayKey();
      document.getElementById("gameModal").hidden = true;
      document.body.classList.remove("is-locked");
      Store.toast("경기 기록을 추가했습니다.");
    });
  }

  /* ---------------------------------------------------------------
     Init
     --------------------------------------------------------------- */
  function renderAll() {
    renderStats();
    renderOverviewChart();
    renderTrainingChart();
    renderTraining();
    renderIntensity();
    renderGames();
    renderGoals();
    renderProfile();
    renderGrowth(growthMetric);
  }

  renderAll();
  initVisibility();
  initProfile();
  initMedia();
  initTrainingForm();
  initGameForm();
  renderFeed();
  initGallery();
  renderRequests();
  initRequestForm();

  bindRangeButtons("[data-chart-range]", function (btn) {
    overviewRange = btn.getAttribute("data-chart-range");
    renderOverviewChart();
  });

  bindRangeButtons("[data-training-range]", function (btn) {
    trainingRange = btn.getAttribute("data-training-range");
    renderTrainingChart();
  });

  bindRangeButtons("[data-growth-metric]", function (btn) {
    renderGrowth(btn.getAttribute("data-growth-metric"));
  });

  var filter = document.getElementById("trainingFilter");
  if (filter) {
    filter.addEventListener("change", renderTraining);
  }

  var gameFilter = document.getElementById("gameFilter");
  if (gameFilter) {
    gameFilter.addEventListener("change", renderGames);
  }

  document.addEventListener("click", function (event) {
    var del = event.target.closest("[data-delete-training]");
    if (!del) return;
    if (!IS_STUDENT) {
      Store.toast("기록은 학생 계정에서만 삭제할 수 있습니다.", "warn");
      return;
    }
    var id = del.getAttribute("data-delete-training");
    var next = training.filter(function (item) {
      return item.id !== id;
    });
    if (!commitTraining(next)) {
      Store.toast("저장 공간이 부족해 훈련 기록을 삭제하지 못했습니다.", "warn");
      return;
    }
    renderAll();
    renderFeed();
    Store.toast("훈련 기록을 삭제했습니다.");
  });

  document.addEventListener("click", function (event) {
    var del = event.target.closest("[data-delete-game]");
    if (!del) return;
    if (!IS_STUDENT) {
      Store.toast("경기 기록은 학생 계정에서만 삭제할 수 있습니다.", "warn");
      return;
    }
    var id = del.getAttribute("data-delete-game");
    var next = games.filter(function (game) {
      return game.id !== id;
    });
    if (!commitGames(next)) {
      Store.toast("저장 공간이 부족해 경기 기록을 삭제하지 못했습니다.", "warn");
      return;
    }
    renderAll();
    renderFeed();
    Store.toast("경기 기록을 삭제했습니다.");
  });

  var bell = document.getElementById("notificationsBtn");
  if (bell) {
    bell.addEventListener("click", function () {
      Store.toast("새 알림 2건 · 코치 피드백 1건, 주간 목표 달성 1건");
    });
  }

  document.querySelectorAll("[data-profile-edit]").forEach(function (editProfile) {
    editProfile.addEventListener("click", function () {
      if (!IS_STUDENT) {
        Store.toast("프로필 수정은 학생 계정에서만 가능합니다.", "warn");
        return;
      }
      var modal = document.getElementById("profileModal");
      if (!modal) {
        Store.toast("프로필 수정 기능을 준비 중입니다.", "warn");
        return;
      }
      modal.hidden = false;
      document.body.classList.add("is-locked");
      var map = {
        sport: player.sport || "야구",
        age: player.age || "14",
        team: player.team || "한빛중학교 야구부",
        position: player.position || "내야수 · 2루수",
        grade: player.grade || "중학교 2학년",
        bats: player.bats || "우투우타",
        region: player.region || "서울"
      };
      Object.keys(map).forEach(function (key) {
        var input = modal.querySelector('[data-profile-input="' + key + '"]');
        if (input) input.value = map[key];
      });
    });
  });
})();
