/* =====================================================================
   SPORTS GROW — single demo ledger
   학생·학부모·코치 화면이 함께 읽는 데모 원장과 파생 수치
   ===================================================================== */
(function (root) {
  "use strict";

  var KEY = "sportsgrow.demo.v1";
  var VERSION = 1;
  var WEEKLY_GOAL_DAYS = 5;
  var MONTH_GOAL_AVG = 0.32;
  var SEASON_HIT_GOAL = 30;

  var LEGACY_KEYS = {
    training: "sportsgrow.player.training.v1",
    games: "sportsgrow.player.games.v1",
    profile: "sportsgrow.player.profile.v1",
    visibility: "sportsgrow.player.visibility.v1",
    media: "sportsgrow.player.media.v1",
    gallery: "sportsgrow.player.gallery.v1",
    cheers: "sportsgrow.player.cheers.v1",
    requests: "sportsgrow.parent.requests.v1",
    notes: "sportsgrow.coach.notes.v1",
    goals: "sportsgrow.coach.goals.v1"
  };

  var DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

  /* ---------------------------------------------------------------
     Date / string helpers
     --------------------------------------------------------------- */
  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function dateKey(date) {
    return (
      date.getFullYear() +
      "-" +
      pad2(date.getMonth() + 1) +
      "-" +
      pad2(date.getDate())
    );
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function daysAgo(n) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return dateKey(d);
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

  function shortDate(key) {
    var d = parseDate(key);
    if (!d) return String(key == null ? "" : key);
    return pad2(d.getMonth() + 1) + "." + pad2(d.getDate()) + " (" + DAY_NAMES[d.getDay()] + ")";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function storageGet(key) {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      if (typeof localStorage === "undefined") return false;
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  /* ---------------------------------------------------------------
     Seed
     --------------------------------------------------------------- */
  var SEED_TRAINING = [
    { offset: 0, type: "타격", minutes: 35, intensity: "high", memo: "타격 35분 · 코스 교정" },
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

  var SEED_GAMES = [
    {
      offset: 3,
      competition: "서울시 중학교 야구 리그",
      opponent: "○○중학교",
      result: "승",
      score: "5 : 3",
      performance: "4타수 3안타 2타점",
      achieved: true,
      atBats: 4,
      hits: 3,
      walks: 0
    },
    {
      offset: 6,
      competition: "서울시 중학교 야구 리그",
      opponent: "△△중학교",
      result: "승",
      score: "7 : 4",
      performance: "3타수 1안타 1볼넷",
      achieved: false,
      atBats: 3,
      hits: 1,
      walks: 1
    },
    {
      offset: 12,
      competition: "주말 리그",
      opponent: "□□중학교",
      result: "패",
      score: "2 : 6",
      performance: "4타수 1안타",
      achieved: false,
      atBats: 4,
      hits: 1,
      walks: 0
    },
    {
      offset: 18,
      competition: "서울시 유소년 야구대회",
      opponent: "◇◇중학교",
      result: "무",
      score: "4 : 4",
      performance: "3타수 2안타 1타점",
      achieved: true,
      atBats: 3,
      hits: 2,
      walks: 0
    },
    {
      offset: 24,
      competition: "주말 리그",
      opponent: "◎◎중학교",
      result: "승",
      score: "9 : 1",
      performance: "4타수 2안타 2득점",
      achieved: true,
      atBats: 4,
      hits: 2,
      walks: 0
    }
  ];

  var SEED_HISTORY = [
    { monthOffset: 5, atBats: 18, hits: 4, walks: 2 },
    { monthOffset: 4, atBats: 16, hits: 4, walks: 3 },
    { monthOffset: 3, atBats: 20, hits: 6, walks: 2 },
    { monthOffset: 2, atBats: 17, hits: 5, walks: 4 },
    { monthOffset: 1, atBats: 19, hits: 6, walks: 3 }
  ];

  function seedGallery() {
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

  function seed() {
    var player = {
      id: "p-haram",
      name: "김하람",
      email: "player@sportsgrow.kr",
      sport: "야구",
      teamId: "team-hanbit",
      team: "한빛중학교 야구부",
      position: "내야수 · 2루수",
      grade: "중학교 2학년",
      age: "14",
      region: "서울",
      bats: "우투우타",
      coachId: "c-park",
      parentId: "pa-lee",
      visibility: { profile: "team", training: "team", games: "team", goals: "private" },
      training: SEED_TRAINING.map(function (item) {
        return {
          id: "seed-t-" + item.offset,
          date: daysAgo(item.offset),
          type: item.type,
          minutes: item.minutes,
          intensity: item.intensity,
          memo: item.memo
        };
      }),
      games: SEED_GAMES.map(function (item) {
        return {
          id: "seed-g-" + item.offset,
          date: daysAgo(item.offset),
          competition: item.competition,
          opponent: item.opponent,
          result: item.result,
          score: item.score,
          performance: item.performance,
          achieved: item.achieved,
          atBats: item.atBats,
          hits: item.hits,
          walks: item.walks
        };
      }),
      history: SEED_HISTORY.map(function (item) {
        return {
          monthOffset: item.monthOffset,
          atBats: item.atBats,
          hits: item.hits,
          walks: item.walks
        };
      }),
      goalsMeta: []
    };

    return {
      version: VERSION,
      players: [player],
      cheers: {},
      requests: [],
      gallery: seedGallery(),
      heroMedia: null,
      notes: [],
      goalOverrides: {}
    };
  }

  /* ---------------------------------------------------------------
     Legacy migration (one time, originals are kept)
     --------------------------------------------------------------- */
  function readLegacy(key) {
    var raw = storageGet(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function parsePerformance(text) {
    var s = String(text == null ? "" : text);
    var ab = /(\d+)\s*타수/.exec(s);
    var hits = /(\d+)\s*안타/.exec(s);
    var walks = /(\d+)\s*볼넷/.exec(s);
    return {
      atBats: ab ? Number(ab[1]) : hits ? Number(hits[1]) : 0,
      hits: hits ? Number(hits[1]) : 0,
      walks: walks ? Number(walks[1]) : 0
    };
  }

  function migrate(state) {
    var target = player(state);
    if (!target) return state;

    var training = readLegacy(LEGACY_KEYS.training);
    if (Array.isArray(training) && training.length) {
      target.training = training
        .filter(function (item) {
          return item && item.date;
        })
        .map(function (item, index) {
          return {
            id: item.id || "legacy-t-" + index,
            date: String(item.date),
            type: item.type || "훈련",
            minutes: Number(item.minutes) || 0,
            intensity: item.intensity || "mid",
            memo: item.memo || ""
          };
        });
    }

    var games = readLegacy(LEGACY_KEYS.games);
    if (Array.isArray(games) && games.length) {
      target.games = games
        .filter(function (item) {
          return item && item.date;
        })
        .map(function (item, index) {
          var parsed = parsePerformance(item.performance);
          return {
            id: item.id || "legacy-g-" + index,
            date: String(item.date),
            competition: item.competition || "",
            opponent: item.opponent || "",
            result: item.result || "무",
            score: item.score || "",
            performance: item.performance || "",
            achieved: !!item.achieved,
            atBats: item.atBats != null ? Number(item.atBats) : parsed.atBats,
            hits: item.hits != null ? Number(item.hits) : parsed.hits,
            walks: item.walks != null ? Number(item.walks) : parsed.walks
          };
        });
    }

    var profile = readLegacy(LEGACY_KEYS.profile);
    if (profile && typeof profile === "object" && !Array.isArray(profile)) {
      ["sport", "team", "position", "grade", "age", "region", "bats"].forEach(function (key) {
        if (profile[key]) target[key] = profile[key];
      });
    }

    var visibility = readLegacy(LEGACY_KEYS.visibility);
    if (visibility && typeof visibility === "object" && !Array.isArray(visibility)) {
      ["profile", "training", "games", "goals"].forEach(function (key) {
        if (visibility[key]) target.visibility[key] = visibility[key];
      });
    }

    var media = readLegacy(LEGACY_KEYS.media);
    if (media && typeof media === "object" && media.src && media.type !== "none") {
      state.heroMedia = media;
    }

    var gallery = readLegacy(LEGACY_KEYS.gallery);
    if (Array.isArray(gallery)) state.gallery = gallery;

    var cheers = readLegacy(LEGACY_KEYS.cheers);
    if (cheers && typeof cheers === "object" && !Array.isArray(cheers)) state.cheers = cheers;

    var requests = readLegacy(LEGACY_KEYS.requests);
    if (Array.isArray(requests)) state.requests = requests;

    var notes = readLegacy(LEGACY_KEYS.notes);
    if (Array.isArray(notes)) state.notes = notes;

    var goals = readLegacy(LEGACY_KEYS.goals);
    if (goals && typeof goals === "object" && !Array.isArray(goals)) state.goalOverrides = goals;

    return state;
  }

  /* ---------------------------------------------------------------
     Load / save
     --------------------------------------------------------------- */
  function load() {
    var raw = storageGet(KEY);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.players)) {
          return parsed;
        }
      } catch (err) {
        /* fall through to a fresh seed */
      }
    }
    var state = seed();
    migrate(state);
    save(state);
    return state;
  }

  function save(state) {
    if (!state) return false;
    try {
      return storageSet(KEY, JSON.stringify(state));
    } catch (err) {
      return false;
    }
  }

  function player(state) {
    var list = state && Array.isArray(state.players) ? state.players : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && (list[i].id === "p-haram" || list[i].name === "김하람")) return list[i];
    }
    return list[0] || null;
  }

  /* ---------------------------------------------------------------
     Derived training numbers
     --------------------------------------------------------------- */
  function trainingList(player) {
    return player && Array.isArray(player.training) ? player.training : [];
  }

  function inWindow(player, days) {
    var keys = [];
    for (var i = 0; i < days; i++) keys.push(daysAgo(i));
    return trainingList(player).filter(function (item) {
      return item && keys.indexOf(item.date) !== -1;
    });
  }

  function sumMinutes(list) {
    return list.reduce(function (total, item) {
      return total + Number(item.minutes || 0);
    }, 0);
  }

  function weekMinutes(player) {
    return sumMinutes(inWindow(player, 7));
  }

  function weekDays(player) {
    var seen = {};
    inWindow(player, 7).forEach(function (item) {
      if (item.date) seen[item.date] = true;
    });
    return Object.keys(seen).length;
  }

  function monthMinutes(player) {
    var now = new Date();
    return trainingList(player).reduce(function (total, item) {
      var d = parseDate(item.date);
      if (!d || d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) {
        return total;
      }
      return total + Number(item.minutes || 0);
    }, 0);
  }

  function latestTraining(player) {
    var latest = null;
    trainingList(player).forEach(function (item) {
      if (!item || !item.date) return;
      if (!latest || String(item.date) >= String(latest.date)) latest = item;
    });
    return latest;
  }

  /* ---------------------------------------------------------------
     Goals
     --------------------------------------------------------------- */
  function monthGameTotals(player) {
    var now = new Date();
    var totals = { atBats: 0, hits: 0, walks: 0, games: 0 };
    var list = player && Array.isArray(player.games) ? player.games : [];
    list.forEach(function (game) {
      var d = parseDate(game.date);
      if (!d || d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
      totals.games += 1;
      totals.atBats += Number(game.atBats || 0);
      totals.hits += Number(game.hits || 0);
      totals.walks += Number(game.walks || 0);
    });
    return totals;
  }

  function goalsFor(player) {
    var days = weekDays(player);
    var weekPct = Math.min(100, Math.round((days / WEEKLY_GOAL_DAYS) * 100));

    var month = monthGameTotals(player);
    var atBats = month.atBats;
    var hits = month.hits;
    if (!month.games) {
      var history = player && Array.isArray(player.history) ? player.history : [];
      var entry = history.filter(function (row) {
        return row.monthOffset === 0;
      })[0];
      if (entry) {
        atBats = Number(entry.atBats || 0);
        hits = Number(entry.hits || 0);
      }
    }
    var monthAvg = atBats > 0 ? hits / atBats : 0;
    var monthPct = Math.min(100, Math.round((monthAvg / MONTH_GOAL_AVG) * 100));

    var seasonHits = (player && Array.isArray(player.games) ? player.games : []).reduce(function (
      total,
      game
    ) {
      return total + Number(game.hits || 0);
    }, 0);
    var seasonPct = Math.min(100, Math.round((seasonHits / SEASON_HIT_GOAL) * 100));

    return [
      { horizon: "short", title: "주 5회 이상 훈련", pct: weekPct },
      { horizon: "short", title: "이번 달 타율 .320", pct: monthPct },
      { horizon: "long", title: "시즌 30안타", pct: seasonPct }
    ];
  }

  function goalAverage(player) {
    var goals = goalsFor(player);
    var total = goals.reduce(function (sum, goal) {
      return sum + Number(goal.pct || 0);
    }, 0);
    return Math.round(total / goals.length);
  }

  /* ---------------------------------------------------------------
     Growth series (this month + previous 5)
     --------------------------------------------------------------- */
  function monthTotals(player, year, month, monthOffset) {
    if (monthOffset === 0) {
      var totals = { atBats: 0, hits: 0, walks: 0 };
      var list = player && Array.isArray(player.games) ? player.games : [];
      list.forEach(function (game) {
        var d = parseDate(game.date);
        if (!d || d.getFullYear() !== year || d.getMonth() !== month) return;
        totals.atBats += Number(game.atBats || 0);
        totals.hits += Number(game.hits || 0);
        totals.walks += Number(game.walks || 0);
      });
      return totals;
    }
    var history = player && Array.isArray(player.history) ? player.history : [];
    var entry = history.filter(function (row) {
      return row.monthOffset === monthOffset;
    })[0];
    return {
      atBats: entry ? Number(entry.atBats || 0) : 0,
      hits: entry ? Number(entry.hits || 0) : 0,
      walks: entry ? Number(entry.walks || 0) : 0
    };
  }

  function formatRate(value) {
    return (Number(value) || 0).toFixed(3).replace(/^0/, "");
  }

  function growthSeries(player, metric) {
    var isObp = metric === "obp";
    var now = new Date();
    var labels = [];
    var values = [];

    for (var back = 5; back >= 0; back--) {
      var d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      var totals = monthTotals(player, d.getFullYear(), d.getMonth(), back);
      var value = 0;
      if (isObp) {
        var denom = totals.atBats + totals.walks;
        value = denom > 0 ? (totals.hits + totals.walks) / denom : 0;
      } else {
        value = totals.atBats > 0 ? totals.hits / totals.atBats : 0;
      }
      labels.push(d.getMonth() + 1 + "월");
      values.push(value);
    }

    var best = 0;
    values.forEach(function (value, index) {
      if (value > values[best]) best = index;
    });

    var first = values[0];
    var last = values[values.length - 1];
    var delta = last - first;
    var sign = delta < -0.0005 ? "-" : "+";
    var foot =
      labels[0] +
      " " +
      formatRate(first) +
      " → " +
      labels[labels.length - 1] +
      " " +
      formatRate(last) +
      " (" +
      sign +
      formatRate(Math.abs(delta)) +
      ")";

    return { labels: labels, values: values, foot: foot, best: best };
  }

  /* ---------------------------------------------------------------
     Public API
     --------------------------------------------------------------- */
  var api = {
    KEY: KEY,
    VERSION: VERSION,
    WEEKLY_GOAL_DAYS: WEEKLY_GOAL_DAYS,
    load: load,
    save: save,
    player: player,
    todayKey: todayKey,
    daysAgo: daysAgo,
    shortDate: shortDate,
    escapeHtml: escapeHtml,
    weekMinutes: weekMinutes,
    weekDays: weekDays,
    monthMinutes: monthMinutes,
    latestTraining: latestTraining,
    goalsFor: goalsFor,
    goalAverage: goalAverage,
    growthSeries: growthSeries
  };

  root.SportsGrowDemo = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
