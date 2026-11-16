/* =====================================================================
   SPORTS GROW — student / parent dashboard
   ===================================================================== */
(function () {
  "use strict";

  var Store = window.AppShell || { readStore: function () {}, writeStore: function () {} };
  var TRAINING_KEY = "sportsgrow.player.training.v1";
  var GAMES_KEY = "sportsgrow.player.games.v1";
  var VISIBILITY_KEY = "sportsgrow.player.visibility.v1";
  var PROFILE_KEY = "sportsgrow.player.profile.v1";
  var MEDIA_KEY = "sportsgrow.player.media.v1";
  var CHEERS_KEY = "sportsgrow.player.cheers.v1";
  var REQUESTS_KEY = "sportsgrow.parent.requests.v1";

  var SESSION =
    window.SportsGrow && window.SportsGrow.getSession ? window.SportsGrow.getSession() : null;
  var ROLE = SESSION ? SESSION.role : "player";
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
     Date helpers
     --------------------------------------------------------------- */
  var DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

  function dateKey(date) {
    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0")
    );
  }

  function daysAgo(n) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return dateKey(d);
  }

  function parseDate(key) {
    var parts = key.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
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

  function todayKey() {
    return dateKey(new Date());
  }

  /* ---------------------------------------------------------------
     Seed data
     --------------------------------------------------------------- */
  var seedTraining = [
    { offset: 0, type: "타격", minutes: 35, intensity: "high", memo: "타격 120구 · 수비 40분" },
    { offset: 1, type: "웨이트", minutes: 35, intensity: "mid", memo: "하체 중심 코어 훈련" },
    { offset: 2, type: "러닝", minutes: 60, intensity: "low", memo: "베이스 러닝 5km" },
    { offset: 3, type: "수비", minutes: 30, intensity: "high", memo: "내야 땅볼 · 더블플레이" },
    { offset: 4, type: "타격", minutes: 70, intensity: "mid", memo: "티배팅 80구 · 라이브 40구" },
    { offset: 5, type: "컨디셔닝", minutes: 40, intensity: "mid", memo: "민첩성 · 순발력 훈련" },
    { offset: 6, type: "수비", minutes: 50, intensity: "high", memo: "송구 정확도 훈련" },
    { offset: 7, type: "웨이트", minutes: 60, intensity: "mid", memo: "상체 근력 보강" },
    { offset: 8, type: "타격", minutes: 90, intensity: "high", memo: "배팅 머신 120구" },
    { offset: 10, type: "수비", minutes: 75, intensity: "mid", memo: "외야 펑고 · 중계 플레이" },
    { offset: 13, type: "러닝", minutes: 60, intensity: "low", memo: "인터벌 러닝" },
    { offset: 16, type: "타격", minutes: 80, intensity: "high", memo: "타격 폼 교정" },
    { offset: 20, type: "웨이트", minutes: 45, intensity: "mid", memo: "하체 스쿼트" },
    { offset: 23, type: "회복", minutes: 70, intensity: "low", memo: "스트레칭 · 폼롤러" }
  ];

  var seedGames = [
    { date: "2026-10-26", competition: "서울시 중학교 야구 리그", opponent: "○○중학교", result: "승", score: "5 : 3", performance: "4타수 3안타 2타점", achieved: true },
    { date: "2026-10-24", competition: "서울시 중학교 야구 리그", opponent: "△△중학교", result: "승", score: "7 : 4", performance: "3타수 1안타 1볼넷", achieved: false },
    { date: "2026-10-21", competition: "주말 리그", opponent: "□□중학교", result: "패", score: "2 : 6", performance: "4타수 1안타", achieved: false },
    { date: "2026-10-18", competition: "서울시 유소년 야구대회", opponent: "◇◇중학교", result: "무", score: "4 : 4", performance: "3타수 2안타 1타점", achieved: true },
    { date: "2026-10-12", competition: "주말 리그", opponent: "◎◎중학교", result: "승", score: "9 : 1", performance: "4타수 2안타 2득점", achieved: true }
  ];

  function loadTraining() {
    var stored = Store.readStore(TRAINING_KEY, null);
    if (Array.isArray(stored) && stored.length) return stored;
    var seeded = seedTraining.map(function (item, index) {
      return {
        id: "seed-t-" + index,
        date: daysAgo(item.offset),
        type: item.type,
        minutes: item.minutes,
        intensity: item.intensity,
        memo: item.memo
      };
    });
    Store.writeStore(TRAINING_KEY, seeded);
    return seeded;
  }

  function loadGames() {
    var stored = Store.readStore(GAMES_KEY, null);
    if (Array.isArray(stored) && stored.length) return stored;
    var seeded = seedGames.slice();
    Store.writeStore(GAMES_KEY, seeded);
    return seeded;
  }

  var training = loadTraining();
  var games = loadGames();

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
    return list
      .slice()
      .sort(function (a, b) {
        return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      });
  }

  function sum(list) {
    return list.reduce(function (total, item) {
      return total + Number(item.minutes || 0);
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
    var year = now.getFullYear();
    var month = now.getMonth();
    return training.filter(function (item) {
      var d = parseDate(item.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }

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
      items.push({
        label: DAY_NAMES[parseDate(key).getDay()],
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

  /* ---------------------------------------------------------------
     Stats / charts
     --------------------------------------------------------------- */
  function renderStats() {
    var week = weekTraining();
    var month = monthTraining();
    var weekMinutes = sum(week);
    var monthMinutes = sum(month);

    document.querySelectorAll("[data-stat-week]").forEach(function (el) {
      el.textContent = weekMinutes;
    });
    document.querySelectorAll("[data-stat-week-count]").forEach(function (el) {
      el.textContent = week.length;
    });
    document.querySelectorAll("[data-stat-month]").forEach(function (el) {
      el.textContent = monthMinutes;
    });

    var monthTag = document.getElementById("monthTag");
    if (monthTag) monthTag.textContent = "이번 달 " + monthMinutes + "분";
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
      item.type +
      " · " +
      item.minutes +
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
          item.id +
          '" aria-label="' +
          item.type +
          ' 기록 삭제"><svg class="icon" aria-hidden="true"><use href="#i-trash" /></svg></button>'
        : "") +
      "</div></div>"
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderTraining() {
    var sorted = sortTraining(training);
    var recent = document.getElementById("recentTraining");
    if (recent) {
      recent.innerHTML = sorted.slice(0, 4).map(function (item) {
        return trainingRow(item, false);
      }).join("");
    }

    var list = document.getElementById("trainingList");
    var filter = document.getElementById("trainingFilter");
    var type = filter ? filter.value : "all";
    var filtered = sorted.filter(function (item) {
      return type === "all" || item.type === type;
    });
    if (list) {
      list.innerHTML = filtered.length
        ? filtered.map(function (item) {
            return trainingRow(item, true);
          }).join("")
        : '<div class="empty-state"><svg class="icon" aria-hidden="true"><use href="#i-activity" /></svg><strong>해당 종류의 기록이 없습니다.</strong><p>훈련을 기록하면 이곳에 표시됩니다.</p></div>';
    }

    var count = document.getElementById("trainingCount");
    if (count) count.textContent = "총 " + filtered.length + "건의 기록";
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
      (game.score ? " · " + game.score : "") +
      "</div></td>" +
      '<td><span class="status ' +
      statusClass +
      '">' +
      game.result +
      "</span></td>" +
      "<td>" +
      escapeHtml(game.performance) +
      "</td>" +
      "<td>" +
      (game.achieved
        ? '<span class="status status--good">달성</span>'
        : '<span class="muted">—</span>') +
      "</td>" +
      "</tr>"
    );
  }

  function renderGames() {
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
      body.innerHTML = filtered.length
        ? filtered.map(gameRow).join("")
        : '<tr><td colspan="5"><div class="empty-state"><strong>해당 조건의 경기 기록이 없습니다.</strong><p>경기 기록을 추가해 보세요.</p></div></td></tr>';
    }

    var recent = document.getElementById("recentGames");
    if (recent) {
      recent.innerHTML = sorted.slice(0, 3).map(function (game) {
        return (
          '<div class="training-item">' +
          '<span class="training-item__ico training-item__ico--clay"><svg class="icon" aria-hidden="true"><use href="#i-trophy" /></svg></span>' +
          '<div class="training-item__main"><strong>vs ' +
          escapeHtml(game.opponent) +
          " · " +
          game.score +
          " " +
          game.result +
          "</strong><span>" +
          shortDate(game.date) +
          " · " +
          escapeHtml(game.competition) +
          "</span></div>" +
          '<div class="training-item__meta"><span class="intensity intensity--low">' +
          escapeHtml(game.performance) +
          "</span></div></div>"
        );
      }).join("");
    }
  }

  /* ---------------------------------------------------------------
     Growth line chart
     --------------------------------------------------------------- */
  var GROWTH = {
    avg: {
      values: [0.268, 0.281, 0.277, 0.295, 0.301, 0.312],
      labels: ["5월", "6월", "7월", "8월", "9월", "10월"],
      foot: "5월 .268 → 10월 .312 (+.044)",
      best: 5
    },
    obp: {
      values: [0.352, 0.361, 0.358, 0.379, 0.392, 0.401],
      labels: ["5월", "6월", "7월", "8월", "9월", "10월"],
      foot: "5월 .352 → 10월 .401 (+.049)",
      best: 5
    }
  };

  function renderGrowth(metric) {
    var data = GROWTH[metric] || GROWTH.avg;
    var container = document.getElementById("growthChart");
    if (!container) return;

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
      (metric === "avg" ? "타율" : "출루율") +
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

    var foot = document.getElementById("growthFoot");
    if (foot) foot.textContent = data.foot;
  }

  /* ---------------------------------------------------------------
     Visibility & profile
     --------------------------------------------------------------- */
  var DEFAULT_VISIBILITY = {
    profile: "team",
    training: "team",
    games: "team",
    goals: "private"
  };

  var VIS_LABEL = { public: "전체 공개", team: "팀 공개", private: "비공개" };

  function applyVisibility(values) {
    document.querySelectorAll("[data-visibility]").forEach(function (select) {
      var key = select.getAttribute("data-visibility");
      select.value = values[key] || "private";
    });
    var badge = document.getElementById("publicBadge");
    if (badge) badge.textContent = VIS_LABEL[values.profile] || "비공개";
  }

  function initVisibility() {
    var stored = Store.readStore(VISIBILITY_KEY, null);
    var values = Object.assign({}, DEFAULT_VISIBILITY, stored || {});
    applyVisibility(values);

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
      Store.writeStore(VISIBILITY_KEY, next);
      applyVisibility(next);
      var saved = document.getElementById("visibilitySaved");
      if (saved) {
        var d = new Date();
        saved.textContent =
          "마지막 저장 · " +
          d.getFullYear() +
          "." +
          String(d.getMonth() + 1).padStart(2, "0") +
          "." +
          String(d.getDate()).padStart(2, "0");
      }
      Store.toast("공개 범위를 저장했습니다.");
    });
  }

  function initProfile() {
    var stored = Store.readStore(PROFILE_KEY, null);
    applyProfile(stored);

    var form = document.getElementById("profileForm");
    if (!form) return;
    if (!IS_STUDENT) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = {};
      form.querySelectorAll("[data-profile-input]").forEach(function (input) {
        data[input.getAttribute("data-profile-input")] = input.value.trim();
      });
      data.line =
        (data.sport || "야구") +
        " · " +
        data.team +
        " · " +
        data.position +
        " · " +
        data.grade +
        " · " +
        data.bats;
      if (!Store.writeStore(PROFILE_KEY, data)) {
        Store.toast("저장 공간이 부족해 프로필을 저장하지 못했습니다.", "warn");
        return;
      }

      applyProfile(data);

      document.getElementById("profileModal").hidden = true;
      document.body.classList.remove("is-locked");
      Store.toast("프로필 정보를 저장했습니다.");
    });
  }

  function applyProfile(stored) {
    if (!stored) return;

    document.querySelectorAll("[data-profile-field]").forEach(function (el) {
      var key = el.getAttribute("data-profile-field");
      if (stored[key]) el.textContent = stored[key];
    });
    document.querySelectorAll("[data-profile-line]").forEach(function (line) {
      if (stored.line) line.textContent = stored.line;
    });
  }

  /* ---------------------------------------------------------------
     Profile cover media (hero background photo / video)
     --------------------------------------------------------------- */
  var IMAGE_MAX_SIDE = 1280;
  var VIDEO_MAX_BYTES = 2 * 1024 * 1024;

  var media = (function () {
    var raw;
    try {
      raw = window.localStorage.getItem(MEDIA_KEY);
    } catch (err) {
      raw = null;
    }
    if (raw === null) return null;

    var stored = Store.readStore(MEDIA_KEY, null);
    if (!stored || stored.type === "none") return null;
    if (typeof stored !== "object" || !stored.src) return null;
    if (!/^(data:(image|video)\/|images\/)/.test(String(stored.src))) return null;
    return stored;
  })();

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
    var valid = !!(media && media.src && media.type);

    if (top) top.classList.toggle("has-cover", valid);

    if (valid) {
      cover.appendChild(mediaNode(media));
      if (label) label.textContent = "배경 사진 · 영상 변경";
      if (removeBtn) removeBtn.hidden = false;
    } else {
      if (label) label.textContent = "배경 사진 · 영상 올리기";
      if (removeBtn) removeBtn.hidden = true;
    }
  }

  function saveMedia(item) {
    var previous = media;
    media = item;
    if (!Store.writeStore(MEDIA_KEY, item)) {
      media = previous;
      applyMedia();
      Store.toast("저장 공간이 부족합니다. 더 작은 사진이나 영상을 선택해 주세요.", "warn");
      return;
    }
    applyMedia();
    Store.toast(
      item.type === "video" ? "배경 영상을 저장했습니다." : "배경 사진을 저장했습니다."
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
        media = null;
        Store.writeStore(MEDIA_KEY, { type: "none" });
        applyMedia();
        Store.toast("배경 사진·영상을 삭제했습니다.");
      });
    }
  }

  /* ---------------------------------------------------------------
     Growth feed & parent cheers
     --------------------------------------------------------------- */
  var FEED_POSTS = [
    {
      id: "feed-1",
      type: "훈련",
      date: daysAgo(0),
      title: "오늘 타격 훈련 90분을 마쳤습니다",
      body: "하체 회전을 유지하면서 공을 끝까지 보는 연습에 집중했습니다. 배팅 머신 120구와 수비 40분을 함께 했고, 마지막 30구는 라인 드라이브 타구가 나왔습니다.",
      meta: "타격 120구 · 수비 40분 · 강도 상"
    },
    {
      id: "feed-2",
      type: "경기",
      date: daysAgo(3),
      title: "vs ○○중학교 · 4타수 3안타 2타점",
      body: "주자 2·3루 상황에서 우전 적시타로 2타점을 기록했습니다. 수비에서는 6회 더블플레이로 이닝을 마무리했습니다.",
      meta: "서울시 중학교 야구 리그 · 5 : 3 승"
    },
    {
      id: "feed-3",
      type: "목표",
      date: daysAgo(5),
      title: "주 4회 이상 훈련 · 4주 연속 달성",
      body: "이번 주까지 네 주 연속으로 주간 훈련 목표를 채웠습니다. 다음 목표는 10월 타율 .320 달성입니다.",
      meta: "단기 목표 달성 · 4주 연속"
    }
  ];

  var FEED_TAG = { 훈련: "tag--green", 경기: "tag--blue", 목표: "tag--lime" };

  var cheers = (function () {
    var stored = Store.readStore(CHEERS_KEY, null);
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  })();

  function pad2(value) {
    return String(value).padStart(2, "0");
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
                post.id +
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
        post.id +
        '">' +
        '<textarea class="textarea textarea--sm" name="cheer" rows="2" maxlength="200" aria-label="' +
        escapeHtml(post.title) +
        ' 게시물에 응원글 작성" placeholder="김하람 선수에게 응원의 한마디를 남겨주세요." required></textarea>' +
        '<div class="cheer-form__foot"><span>학부모 계정으로 작성 · 최대 200자</span>' +
        '<button class="btn btn--dark btn--sm" type="submit"><svg class="icon" aria-hidden="true"><use href="#i-send" /></svg>응원 남기기</button></div>' +
        "</form>";
    }

    return (
      '<article class="feed-card">' +
      '<div class="feed-card__head">' +
      '<span class="feed-card__avatar" aria-hidden="true">하</span>' +
      '<div class="feed-card__who"><strong>김하람</strong><span>학생 · ' +
      shortDate(post.date) +
      "</span></div>" +
      '<span class="tag ' +
      tagClass +
      '">' +
      post.type +
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

    var total = 0;
    container.innerHTML = FEED_POSTS.map(function (post) {
      var list = Array.isArray(cheers[post.id]) ? cheers[post.id] : [];
      total += list.length;
      return feedCard(post, list);
    }).join("");

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
    if (!Array.isArray(cheers[postId])) cheers[postId] = [];
    cheers[postId].push({
      id: "c-" + Date.now(),
      author: SESSION.name,
      authorEmail: SESSION.email,
      text: text,
      createdAt: new Date().toISOString(),
      createdLabel: stamp()
    });
    Store.writeStore(CHEERS_KEY, cheers);
    renderFeed();
    Store.toast("응원글을 남겼습니다. 김하람 선수에게 전달됩니다.");
  }

  function handleCheerDelete(btn) {
    if (!IS_PARENT || !SESSION) return;
    var postId = btn.getAttribute("data-delete-cheer");
    var cheerId = btn.getAttribute("data-cheer-id");
    cheers[postId] = (cheers[postId] || []).filter(function (cheer) {
      return !(cheer.id === cheerId && cheer.authorEmail === SESSION.email);
    });
    Store.writeStore(CHEERS_KEY, cheers);
    renderFeed();
    Store.toast("응원글을 삭제했습니다.");
  }

  /* ---------------------------------------------------------------
     Media gallery (photo / video + comments)
     --------------------------------------------------------------- */
  var GALLERY_KEY = "sportsgrow.player.gallery.v1";
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

  function gallerySeed() {
    var created = new Date();
    created.setDate(created.getDate() - 2);
    created.setHours(18, 20, 0, 0);
    var coachAt = new Date(created.getTime() + 95 * 60 * 1000);
    var parentAt = new Date(created.getTime() + 200 * 60 * 1000);
    return [
      {
        id: "gallery-seed-1",
        type: "image",
        src: "images/player-haram-game.jpg",
        caption: "주말 리그 경기 전, 몸을 푸는 시간",
        author: "김하람",
        authorEmail: "player@sportsgrow.kr",
        authorRole: "player",
        createdAt: created.toISOString(),
        comments: [
          {
            id: "gallery-seed-1-c1",
            author: "박정우",
            authorEmail: "coach@sportsgrow.kr",
            authorRole: "coach",
            text: "경기 전 준비 자세가 좋습니다. 오늘은 하체 회전에 집중해서 타석에 들어가 보세요.",
            createdAt: coachAt.toISOString()
          },
          {
            id: "gallery-seed-1-c2",
            author: "이정은",
            authorEmail: "parent@sportsgrow.kr",
            authorRole: "parent",
            text: "오늘도 안전하게 경기하고 와요. 응원하고 있을게요!",
            createdAt: parentAt.toISOString()
          }
        ]
      }
    ];
  }

  function normalizeGallery(raw) {
    if (!Array.isArray(raw)) return gallerySeed();
    return raw.filter(function (item) {
      return item && item.src && typeof item.src === "string";
    });
  }

  var gallery = (function () {
    var raw;
    try {
      raw = window.localStorage.getItem(GALLERY_KEY);
    } catch (err) {
      raw = null;
    }
    if (raw === null) return gallerySeed();
    return normalizeGallery(Store.readStore(GALLERY_KEY, []));
  })();

  function saveGallery(next) {
    if (!Store.writeStore(GALLERY_KEY, next)) {
      Store.toast("저장 공간이 부족합니다. 더 작은 사진이나 동영상을 올려 주세요.", "warn");
      return false;
    }
    gallery = next;
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
      escapeHtml(item.caption || "김하람 선수 활동 사진") +
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
      foot.textContent =
        "사진 " + photos + " · 동영상 " + videos + " · 댓글 " + comments;
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
    if (meta) meta.textContent = "사진은 최대 1280px로 자동 압축됩니다. 동영상은 2MB 이하만 올릴 수 있습니다.";
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
  var requests = (function () {
    var stored = Store.readStore(REQUESTS_KEY, null);
    return Array.isArray(stored) ? stored : [];
  })();

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
      '<div class="request-card__foot"><span>대상 · 김하람 선수</span><span>' +
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

      requests.push({
        id: "r-" + Date.now(),
        type: type,
        title: title,
        body: body,
        player: "김하람",
        parent: SESSION.name,
        parentEmail: SESSION.email,
        status: "pending",
        createdAt: new Date().toISOString(),
        createdLabel: stamp()
      });
      Store.writeStore(REQUESTS_KEY, requests);

      form.reset();
      var player = document.getElementById("requestPlayer");
      if (player) player.value = "김하람";
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
    requests = requests.filter(function (req) {
      return req.id !== id;
    });
    Store.writeStore(REQUESTS_KEY, requests);
    renderRequests();
    Store.toast("요청을 취소했습니다.");
  });

  /* ---------------------------------------------------------------
     Bindings
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

      training.push({
        id: "t-" + Date.now(),
        date: date,
        type: type,
        minutes: Math.min(360, minutes),
        intensity: intensity,
        memo: memo
      });
      Store.writeStore(TRAINING_KEY, training);

      renderStats();
      renderOverviewChart();
      renderTrainingChart();
      renderTraining();
      renderIntensity();

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
      var game = {
        date: document.getElementById("gameDate").value,
        competition: document.getElementById("gameCompetition").value.trim(),
        opponent: document.getElementById("gameOpponent").value.trim(),
        result: document.getElementById("gameResult").value,
        score: "",
        performance: document.getElementById("gamePerformance").value.trim(),
        achieved: false
      };
      if (!game.date || !game.competition || !game.opponent || !game.performance) {
        Store.toast("모든 항목을 입력해 주세요.", "warn");
        return;
      }
      games.push(game);
      Store.writeStore(GAMES_KEY, games);
      renderGames();
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
  renderStats();
  renderOverviewChart();
  renderTrainingChart();
  renderTraining();
  renderIntensity();
  renderGames();
  renderGrowth("avg");
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
    training = training.filter(function (item) {
      return item.id !== id;
    });
    Store.writeStore(TRAINING_KEY, training);
    renderStats();
    renderOverviewChart();
    renderTrainingChart();
    renderTraining();
    renderIntensity();
    Store.toast("훈련 기록을 삭제했습니다.");
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
      var stored = Store.readStore(PROFILE_KEY, {});
      var modal = document.getElementById("profileModal");
      if (!modal) {
        Store.toast("프로필 수정 기능을 준비 중입니다.", "warn");
        return;
      }
      modal.hidden = false;
      document.body.classList.add("is-locked");
      var map = {
        sport: stored.sport || "야구",
        age: stored.age || "14",
        team: stored.team || "한빛중학교 야구부",
        position: stored.position || "내야수 · 2루수",
        grade: stored.grade || "중학교 2학년",
        bats: stored.bats || "우투우타",
        region: stored.region || "서울"
      };
      Object.keys(map).forEach(function (key) {
        var input = modal.querySelector('[data-profile-input="' + key + '"]');
        if (input) input.value = map[key];
      });
    });
  });
})();
