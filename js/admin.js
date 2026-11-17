/* =====================================================================
   SPORTS GROW — operations admin console
   회원 · 훈련/성장 데이터 · 요금 · 운영 관리
   ===================================================================== */
(function () {
  "use strict";

  if (window.SportsGrowApi && window.SportsGrowApi.enabled) return;

  var Store = window.AppShell || {
    readStore: function () { return null; },
    writeStore: function () { return false; },
    openModal: function () {},
    closeModal: function () {}
  };
  var SportsGrow = window.SportsGrow || {};

  var KEYS = {
    members: "sportsgrow.admin.members.v1",
    payments: "sportsgrow.admin.payments.v1",
    notices: "sportsgrow.admin.notices.v1",
    inquiries: "sportsgrow.admin.inquiries.v1",
    logs: "sportsgrow.admin.logs.v1",
    settings: "sportsgrow.admin.settings.v1"
  };

  var DEMO_KEYS = [
    "sportsgrow.demo.v1",
    "sportsgrow.player.training.v1",
    "sportsgrow.player.games.v1",
    "sportsgrow.player.visibility.v1",
    "sportsgrow.player.profile.v1",
    "sportsgrow.player.media.v1",
    "sportsgrow.player.gallery.v1",
    "sportsgrow.player.cheers.v1",
    "sportsgrow.parent.requests.v1",
    "sportsgrow.coach.notes.v1",
    "sportsgrow.coach.goals.v1",
    "sportsgrow.coach.customPlayers.v1",
    "sportsgrow.academy.teams.v1"
  ];

  var TYPE_LABEL = {
    students: "학생",
    parents: "학부모",
    coaches: "코치",
    academies: "아카데미"
  };
  var TYPE_TONE = {
    students: "green",
    parents: "blue",
    coaches: "violet",
    academies: "clay"
  };
  var VIEW_LABEL = {
    overview: "대시보드",
    members: "회원관리",
    data: "데이터 관리",
    billing: "요금 관리",
    operations: "공지 · 문의",
    settings: "사이트 설정"
  };
  var MEMBER_PAGE_SIZE = 8;
  var BILLING_PAGE_SIZE = 9;

  var state = {
    memberTab: "students",
    memberPage: 1,
    memberSearch: "",
    memberStatus: "all",
    memberPlan: "all",
    billingPlan: "all",
    billingMonth: "all",
    billingStatus: "all",
    billingSearch: "",
    billingPage: 1,
    dataStudent: "all",
    dataPeriod: 3,
    opsTab: "notices"
  };

  var members;
  var payments;
  var notices;
  var inquiries;
  var logs;
  var settings;
  var trainingRecords = [];

  /* ---------------------------------------------------------------
     Helpers
     --------------------------------------------------------------- */
  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function isoDate(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function todayISO() {
    return isoDate(new Date());
  }

  function isoDaysAgo(days) {
    var date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - days);
    return isoDate(date);
  }

  function monthDate(offset, day) {
    var date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(1);
    date.setMonth(date.getMonth() - offset);
    var last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day || 1, last));
    return date;
  }

  function monthKey(offset) {
    var date = monthDate(offset, 1);
    return date.getFullYear() + "-" + pad(date.getMonth() + 1);
  }

  function monthLabel(offset) {
    return monthDate(offset, 1).getMonth() + 1 + "월";
  }

  function prettyDate(value) {
    if (!value) return "-";
    return String(value).replace(/-/g, ".");
  }

  function hash(value) {
    var h = 2166136261;
    var text = String(value);
    for (var i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function number(value) {
    return Number(value || 0).toLocaleString("ko-KR");
  }

  function won(value) {
    return number(value) + "원";
  }

  function shortWon(value) {
    if (value >= 100000000) return round1(value / 100000000) + "억";
    if (value >= 10000) return Math.round(value / 10000) + "만";
    return number(value);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function daysAgo(value) {
    var date = new Date(value + "T12:00:00");
    if (isNaN(date.getTime())) return 999;
    return Math.max(0, Math.round((Date.now() - date.getTime()) / 86400000));
  }

  function nowStamp() {
    var date = new Date();
    return (
      date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate()) +
      " " + pad(date.getHours()) + ":" + pad(date.getMinutes())
    );
  }

  function stampDaysAgo(days, hour, minute) {
    var date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(hour || 9, minute || 0, 0, 0);
    return (
      date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate()) +
      " " + pad(date.getHours()) + ":" + pad(date.getMinutes())
    );
  }

  function toneOf(type) {
    return TYPE_TONE[type] || "green";
  }

  function persistMembers() {
    return Store.writeStore(KEYS.members, members);
  }

  function persistPayments() {
    return Store.writeStore(KEYS.payments, payments);
  }

  function persistNotices() {
    return Store.writeStore(KEYS.notices, notices);
  }

  function persistInquiries() {
    return Store.writeStore(KEYS.inquiries, inquiries);
  }

  function toast(message, tone) {
    if (SportsGrow.toast) SportsGrow.toast(message, tone);
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

  function applyLedgerToMembers() {
    var player = ledgerPlayer(readLedger());
    if (!player) return;
    var target = members.students.filter(function (item) {
      return item.id === "ST-1001";
    })[0];
    if (!target) return;
    var days = ledgerNumber("weekDays", player);
    var goal = ledgerNumber("goalAverage", player);
    if (days != null) target.sessions = Math.max(0, Math.round(days));
    if (goal != null) target.growth = Math.max(0, Math.min(100, Math.round(goal)));
  }

  /* ---------------------------------------------------------------
     Seed data — students
     --------------------------------------------------------------- */
  function student(id, name, age, position, org, guardian, phone, email, joinedDays, status, plan, sessions, attendance, growth, coach) {
    return {
      id: id, type: "students", name: name, age: age, position: position, org: org,
      guardian: guardian, phone: phone, email: email, joined: isoDaysAgo(joinedDays),
      status: status, plan: plan, sessions: sessions, attendance: attendance,
      growth: growth, coach: coach
    };
  }

  function seedStudents() {
    return [
      student("ST-1001", "김하람", 14, "내야수 · 2루수", "한빛중학교 야구부", "이정은", "", "player@sportsgrow.kr", 268, "활성", "월간", 42, 94, 87, "박정우"),
      student("ST-1002", "이준서", 15, "투수", "한빛중학교 야구부", "박미영", "", "junseo@sportsgrow.kr", 241, "활성", "연간", 38, 91, 84, "박정우"),
      student("ST-1003", "박서준", 13, "포수", "대명중학교 야구부", "최수진", "", "seojun@sportsgrow.kr", 214, "활성", "월간", 35, 88, 79, "김성훈"),
      student("ST-1004", "최민준", 14, "외야수", "한빛중학교 야구부", "정은영", "", "minjun@sportsgrow.kr", 198, "활성", "월간", 33, 86, 76, "박정우"),
      student("ST-1005", "정하준", 15, "유격수", "신정고등학교 야구부", "강혜진", "", "hajun@sportsgrow.kr", 176, "활성", "연간", 40, 96, 91, "이재현"),
      student("ST-1006", "강도윤", 13, "3루수", "한빛중학교 야구부", "윤미라", "", "doyun@sportsgrow.kr", 161, "활성", "월간", 29, 82, 71, "박정우"),
      student("ST-1007", "조은우", 14, "1루수", "대명중학교 야구부", "장선영", "", "eunwoo@sportsgrow.kr", 143, "대기", "월간", 12, 74, 64, "김성훈"),
      student("ST-1008", "윤시우", 15, "투수", "신정고등학교 야구부", "서정민", "", "siwoo@sportsgrow.kr", 128, "활성", "연간", 37, 90, 86, "이재현"),
      student("ST-1009", "장지호", 12, "내야수", "한빛초등학교 야구부", "김소연", "", "jiho@sportsgrow.kr", 112, "활성", "월간", 26, 89, 73, "최윤재"),
      student("ST-1010", "임하윤", 14, "외야수", "한빛중학교 야구부", "임재호", "", "hayun@sportsgrow.kr", 97, "활성", "월간", 31, 87, 78, "박정우"),
      student("ST-1011", "한지민", 13, "투수", "대명중학교 야구부", "한상우", "", "jimin@sportsgrow.kr", 82, "활성", "월간", 24, 80, 69, "김성훈"),
      student("ST-1012", "오세훈", 16, "포수", "신정고등학교 야구부", "오미경", "", "sehun@sportsgrow.kr", 64, "휴면", "연간", 8, 58, 61, "이재현"),
      student("ST-1013", "서지훈", 14, "내야수", "한빛중학교 야구부", "서미란", "", "jihoon@sportsgrow.kr", 41, "활성", "월간", 19, 92, 82, "박정우"),
      student("ST-1014", "문예준", 12, "외야수", "한빛초등학교 야구부", "문경수", "", "yejun@sportsgrow.kr", 23, "대기", "월간", 5, 70, 58, "최윤재")
    ];
  }

  /* ---------------------------------------------------------------
     Seed data — parents / coaches / academies
     --------------------------------------------------------------- */
  function parent(id, name, relation, child, phone, email, joinedDays, status, plan) {
    return {
      id: id, type: "parents", name: name, relation: relation, child: child,
      org: child + " 보호자", phone: phone, email: email,
      joined: isoDaysAgo(joinedDays), status: status, plan: plan
    };
  }

  function coach(id, name, team, role, phone, email, joinedDays, status, plan, players) {
    return {
      id: id, type: "coaches", name: name, team: team, position: role,
      org: team, phone: phone, email: email, joined: isoDaysAgo(joinedDays),
      status: status, plan: plan, players: players
    };
  }

  function academy(id, name, orgType, teams, players, manager, phone, email, joinedDays, status, plan) {
    return {
      id: id, type: "academies", name: name, orgType: orgType, teams: teams,
      players: players, manager: manager, org: orgType + " · " + teams + "개 팀",
      phone: phone, email: email, joined: isoDaysAgo(joinedDays),
      status: status, plan: plan
    };
  }

  function seedMembers() {
    return {
      students: seedStudents(),
      parents: [
        parent("PA-2001", "이정은", "모", "김하람", "", "parent@sportsgrow.kr", 266, "활성", "무료"),
        parent("PA-2002", "박미영", "모", "이준서", "", "miyoung@sportsgrow.kr", 239, "활성", "무료"),
        parent("PA-2003", "최수진", "모", "박서준", "", "sujin@sportsgrow.kr", 212, "활성", "무료"),
        parent("PA-2004", "정은영", "모", "최민준", "", "eunyoung@sportsgrow.kr", 196, "활성", "무료"),
        parent("PA-2005", "강혜진", "모", "정하준", "", "hyejin@sportsgrow.kr", 174, "활성", "무료"),
        parent("PA-2006", "윤미라", "모", "강도윤", "", "mira@sportsgrow.kr", 159, "휴면", "무료"),
        parent("PA-2007", "장선영", "모", "조은우", "", "sunyoung@sportsgrow.kr", 141, "대기", "무료")
      ],
      coaches: [
        coach("CO-3001", "박정우", "한빛중학교 야구부", "감독", "", "coach@sportsgrow.kr", 302, "활성", "월간", 4),
        coach("CO-3002", "김성훈", "대명중학교 야구부", "코치", "", "sunghoon@sportsgrow.kr", 245, "활성", "월간", 3),
        coach("CO-3003", "이재현", "신정고등학교 야구부", "감독", "", "jaehyun@sportsgrow.kr", 188, "활성", "연간", 3),
        coach("CO-3004", "최윤재", "한빛초등학교 야구부", "코치", "", "yoonjae@sportsgrow.kr", 132, "활성", "월간", 2),
        coach("CO-3005", "한지훈", "한빛 베이스볼랩", "타격 코치", "", "jihoon.coach@sportsgrow.kr", 76, "대기", "연간", 0)
      ],
      academies: [
        academy("AC-4001", "한빛 스포츠아카데미", "아카데미", 5, 82, "정민호", "", "admin@sportsgrow.kr", 356, "활성", "연간"),
        academy("AC-4002", "대명 스포츠클럽", "클럽", 3, 41, "최지훈", "02-2345-6789", "daemyeong@sportsgrow.kr", 231, "활성", "연간"),
        academy("AC-4003", "신정 야구교실", "교실", 2, 24, "김태윤", "02-3456-7890", "sinjeong@sportsgrow.kr", 118, "활성", "월간"),
        academy("AC-4004", "한빛 베이스볼랩", "센터", 1, 12, "서지원", "02-4567-8901", "baseballab@sportsgrow.kr", 47, "대기", "월간")
      ]
    };
  }

  function amountFor(member) {
    if (member.type === "academies") return member.plan === "연간" ? 1200000 : 100000;
    if (member.type === "coaches") return member.plan === "연간" ? 360000 : 30000;
    return member.plan === "연간" ? 36000 : 3000;
  }

  function seedPayments(data) {
    var list = [];
    var all = data.students.concat(data.coaches, data.academies);
    var methods = ["카드", "계좌이체", "간편결제"];

    for (var offset = 0; offset < 6; offset += 1) {
      var pool = all;
      if (offset >= 2) {
        pool = data.students.slice(0, 8).concat(data.academies, data.coaches.slice(0, 3));
      }
      pool.forEach(function (member, index) {
        if (member.plan === "무료") return;
        var period = monthKey(offset);
        var seed = hash(member.id + "-" + period);
        var plan = member.plan === "연간" ? "annual" : "monthly";
        var amount = amountFor(member);
        var dueDay = 5 + (seed % 20);
        var status;
        if (offset === 0) {
          if (seed % 10 < 2) status = "입금대기";
          else if (seed % 10 === 2 || seed % 29 === 0) status = "연체";
          else status = "입금완료";
        } else {
          status = seed % 19 === 0 ? "환불" : "입금완료";
        }
        var paidDay = Math.max(1, dueDay - 1 - (seed % 3));
        list.push({
          id: "INV-" + period.replace("-", "") + "-" + pad(index + 1),
          memberId: member.id,
          member: member.name,
          type: TYPE_LABEL[member.type],
          plan: plan,
          amount: amount,
          period: period,
          due: isoDate(monthDate(offset, dueDay)),
          paid: status === "입금완료" || status === "환불" ? isoDate(monthDate(offset, paidDay)) : "",
          method: methods[seed % methods.length],
          status: status,
          memo: ""
        });
      });
    }

    list.sort(function (a, b) {
      if (a.period === b.period) return a.member < b.member ? -1 : 1;
      return a.period < b.period ? 1 : -1;
    });
    return list;
  }

  /* ---------------------------------------------------------------
     Training data (generated from member seeds)
     --------------------------------------------------------------- */
  function buildTraining(students) {
    var types = ["배팅", "수비", "주루", "체력", "투구"];
    var intensities = ["보통", "높음", "낮음"];
    var list = [];

    students.forEach(function (item) {
      var count = clamp(item.sessions, 6, 42);
      for (var index = 0; index < count; index += 1) {
        var seed = hash(item.id + "-training-" + index);
        var attendance = "참석";
        if (seed % 13 === 0) attendance = "결석";
        else if (seed % 7 === 0) attendance = "지각";
        list.push({
          id: "TR-" + item.id.slice(-4) + "-" + pad(index + 1),
          studentId: item.id,
          student: item.name,
          date: isoDaysAgo(index * 4 + (seed % 3)),
          type: types[seed % types.length],
          minutes: 60 + (seed % 5) * 15,
          intensity: intensities[seed % intensities.length],
          attendance: attendance
        });
      }
    });

    list.sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });
    return list;
  }

  function growthHistory(item) {
    var end = item.growth;
    var seed = hash(item.id);
    var start = clamp(end - 8 - (seed % 6), 35, 98);
    var values = [];
    for (var index = 0; index < 6; index += 1) {
      var value = start + ((end - start) * index) / 5;
      value += (hash(item.id + "-growth-" + index) % 5) - 2;
      if (index === 5) value = end;
      values.push(clamp(round1(value), 0, 100));
    }
    return values;
  }

  /* ---------------------------------------------------------------
     Seed data — notices / inquiries / logs / settings
     --------------------------------------------------------------- */
  function seedNotices() {
    return [
      {
        id: "N-" + (100 + hash("notice1") % 30),
        title: "11월 정기 서비스 점검 안내",
        category: "점검",
        status: "게시중",
        date: isoDaysAgo(5),
        views: 482,
        pinned: true,
        body: "매월 첫째 주 화요일 02:00~04:00 동안 정기 점검이 진행됩니다."
      },
      {
        id: "N-" + (100 + hash("notice2") % 30),
        title: "학부모 계정 응원 기능 업데이트",
        category: "업데이트",
        status: "게시중",
        date: isoDaysAgo(9),
        views: 318,
        pinned: false,
        body: "성장 피드에서 응원글을 남길 수 있는 기능이 개선되었습니다."
      },
      {
        id: "N-" + (100 + hash("notice3") % 30),
        title: "12월 연간 구독 얼리버드 안내",
        category: "이벤트",
        status: "예약",
        date: isoDaysAgo(1),
        views: 0,
        pinned: false,
        body: "12월 1일부터 연간 구독 신규 가입 시 2개월 이용권을 추가로 제공합니다."
      },
      {
        id: "N-" + (100 + hash("notice4") % 30),
        title: "개인정보 처리방침 개정 사전 안내",
        category: "공지",
        status: "게시중",
        date: isoDaysAgo(17),
        views: 604,
        pinned: false,
        body: "보호자 동의 절차와 보관 기간 조항이 일부 정비됩니다."
      },
      {
        id: "N-" + (100 + hash("notice5") % 30),
        title: "9월 훈련 리포트 배포 완료",
        category: "공지",
        status: "종료",
        date: isoDaysAgo(46),
        views: 771,
        pinned: false,
        body: "9월 월간 훈련 리포트가 기관 관리자에게 배포되었습니다."
      }
    ];
  }

  function seedInquiries() {
    return [
      {
        id: "Q-" + (1000 + hash("q1") % 300),
        title: "훈련 기록이 저장되지 않아요",
        from: "이정은",
        email: "parent@sportsgrow.kr",
        category: "기술 지원",
        date: isoDaysAgo(1),
        priority: "높음",
        status: "답변 대기"
      },
      {
        id: "Q-" + (1000 + hash("q2") % 300),
        title: "연간 구독 결제 영수증 발행 문의",
        from: "정민호",
        email: "admin@sportsgrow.kr",
        category: "결제",
        date: isoDaysAgo(2),
        priority: "보통",
        status: "처리 중"
      },
      {
        id: "Q-" + (1000 + hash("q3") % 300),
        title: "선수 프로필 사진 업로드 용량",
        from: "박정우",
        email: "coach@sportsgrow.kr",
        category: "이용 문의",
        date: isoDaysAgo(4),
        priority: "낮음",
        status: "답변 완료"
      },
      {
        id: "Q-" + (1000 + hash("q4") % 300),
        title: "아카데미 팀 추가 후 통계가 안 보입니다",
        from: "최지훈",
        email: "daemyeong@sportsgrow.kr",
        category: "기술 지원",
        date: isoDaysAgo(5),
        priority: "높음",
        status: "답변 대기"
      },
      {
        id: "Q-" + (1000 + hash("q5") % 300),
        title: "학부모 계정 연결을 해제하고 싶어요",
        from: "윤미라",
        email: "mira@sportsgrow.kr",
        category: "계정",
        date: isoDaysAgo(8),
        priority: "보통",
        status: "답변 완료"
      },
      {
        id: "Q-" + (1000 + hash("q6") % 300),
        title: "CSV 보고서 항목을 변경할 수 있나요?",
        from: "김성훈",
        email: "sunghoon@sportsgrow.kr",
        category: "이용 문의",
        date: isoDaysAgo(11),
        priority: "낮음",
        status: "처리 중"
      }
    ];
  }

  function seedLogs() {
    return [
      { time: stampDaysAgo(0, 9, 12), actor: "운영팀", action: "입금 상태 변경", target: "INV-202611-0003 · 입금완료" },
      { time: stampDaysAgo(0, 8, 41), actor: "운영팀", action: "공지사항 게시", target: "11월 정기 서비스 점검 안내" },
      { time: stampDaysAgo(1, 17, 26), actor: "운영팀", action: "1:1 문의 상태 변경", target: "Q-1042 · 처리 중" },
      { time: stampDaysAgo(1, 11, 5), actor: "운영팀", action: "회원 상세 조회", target: "AC-4001 한빛 스포츠아카데미" },
      { time: stampDaysAgo(2, 15, 48), actor: "운영팀", action: "사이트 설정 저장", target: "입금 마감일 · 자동 갱신 안내" },
      { time: stampDaysAgo(3, 10, 19), actor: "운영팀", action: "CSV 내보내기", target: "2026년 10월 입금 내역" },
      { time: stampDaysAgo(4, 16, 32), actor: "운영팀", action: "회원 추가", target: "서지훈 · 학생" }
    ];
  }

  function defaultSettings() {
    return {
      siteName: "Sports Grow",
      supportEmail: "hello@sportsgrow.kr",
      supportPhone: "",
      adminEmail: "ops@sportsgrow.kr",
      dueDay: "10",
      autoRenew: "on",
      approval: true,
      maintenance: false
    };
  }

  /* ---------------------------------------------------------------
     Logging
     --------------------------------------------------------------- */
  function addLog(action, target) {
    logs.unshift({
      time: nowStamp(),
      actor: "운영팀",
      action: action,
      target: target || "-"
    });
    if (logs.length > 60) logs.length = 60;
    Store.writeStore(KEYS.logs, logs);
  }

  function findMember(id) {
    var found = null;
    Object.keys(members).forEach(function (type) {
      members[type].forEach(function (item) {
        if (item.id === id) found = item;
      });
    });
    return found;
  }

  function allMembers() {
    return members.students.concat(members.parents, members.coaches, members.academies);
  }

  function currentMonthPayments() {
    return payments.filter(function (item) {
      return item.period === monthKey(0);
    });
  }

  function unpaidPayments() {
    return payments.filter(function (item) {
      return item.status === "입금대기" || item.status === "연체";
    });
  }

  /* ---------------------------------------------------------------
     Shared render helpers
     --------------------------------------------------------------- */
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHTML(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function sum(list, getter) {
    return list.reduce(function (total, item) {
      return total + Number(getter ? getter(item) : item);
    }, 0);
  }

  function statusClass(status) {
    if (status === "활성" || status === "입금완료" || status === "게시중" || status === "답변 완료") return "good";
    if (status === "휴면" || status === "연체") return "risk";
    if (status === "환불" || status === "종료") return "info";
    return "warn";
  }

  function statusTag(status) {
    return '<span class="status status--' + statusClass(status) + '">' + esc(status) + "</span>";
  }

  function planTag(plan) {
    var cls = plan === "연간" ? "tag--blue" : plan === "무료" ? "tag--outline" : "tag--green";
    return '<span class="tag ' + cls + '">' + esc(plan) + "</span>";
  }

  function personCell(item) {
    var initial = String(item.name || "?").charAt(0);
    return (
      '<div class="table-person"><span class="table-avatar table-avatar--' + toneOf(item.type) + '">' +
      esc(initial) + '</span><div><strong>' + esc(item.name) + "</strong><span>" +
      esc(item.id) + "</span></div></div>"
    );
  }

  function actionButton(item) {
    return (
      '<div class="table-actions"><button type="button" data-member-detail="' + esc(item.id) +
      '" aria-label="' + esc(item.name) + ' 상세 보기"><svg class="icon" aria-hidden="true">' +
      '<use href="#i-eye" /></svg></button></div>'
    );
  }

  function renderPagination(container, page, totalPages, totalItems, attr) {
    if (!container) return;
    var current = Math.min(Math.max(1, page), totalPages);
    var start = Math.max(1, current - 2);
    var end = Math.min(totalPages, start + 4);
    start = Math.max(1, end - 4);
    var buttons = "";

    buttons +=
      '<button class="admin-page-btn" type="button" data-' + attr + '="' + (current - 1) +
      '" aria-label="이전 페이지"' + (current <= 1 ? " disabled" : "") + ">‹</button>";

    for (var index = start; index <= end; index += 1) {
      buttons +=
        '<button class="admin-page-btn' + (index === current ? " is-active" : "") +
        '" type="button" data-' + attr + '="' + index + '"' +
        (index === current ? ' aria-current="page"' : "") + ">" + index + "</button>";
    }

    buttons +=
      '<button class="admin-page-btn" type="button" data-' + attr + '="' + (current + 1) +
      '" aria-label="다음 페이지"' + (current >= totalPages ? " disabled" : "") + ">›</button>";

    container.innerHTML =
      '<span class="admin-pagination__info">전체 ' + number(totalItems) + "건 · " + current + " / " +
      totalPages + " 페이지</span>" +
      '<div class="admin-pagination__pages">' + buttons + "</div>";
  }

  function renderBars(id, items, labelSuffix) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<div class="admin-empty"><strong>표시할 데이터가 없습니다.</strong>필터를 조정해 보세요.</div>';
      return;
    }
    var max = Math.max.apply(null, items.map(function (item) { return item.value; }).concat([1]));
    el.innerHTML = items.map(function (item) {
      var pct = Math.max(5, Math.round((item.value / max) * 100));
      return (
        '<div class="bar-chart__col" title="' + esc(item.label + " " + (item.display || "")) + '">' +
        '<div class="bar-chart__bar" style="--h:' + pct + '%"><b>' + esc(item.display || "") + "</b>" +
        '<i style="background:' + (item.color || "#0e6b4e") + '"></i></div>' +
        "<em>" + esc(item.label) + "</em></div>"
      );
    }).join("");
    el.setAttribute(
      "aria-label",
      items.map(function (item) { return item.label + " " + (item.display || "") + (labelSuffix || ""); }).join(", ")
    );
  }

  /* ---------------------------------------------------------------
     Overview
     --------------------------------------------------------------- */
  function renderOverview() {
    var counts = {
      students: members.students.length,
      parents: members.parents.length,
      coaches: members.coaches.length,
      academies: members.academies.length
    };
    var total = counts.students + counts.parents + counts.coaches + counts.academies;

    setHTML("adminKpiMembers", number(total) + "<small>명</small>");
    setText(
      "adminKpiMembersFoot",
      "학생 " + counts.students + " · 학부모 " + counts.parents + " · 코치 " + counts.coaches + " · 기관 " + counts.academies
    );

    var monthPaid = currentMonthPayments().filter(function (item) { return item.status === "입금완료"; });
    var revenue = sum(monthPaid, function (item) { return item.amount; });
    var monthUnpaid = currentMonthPayments().filter(function (item) {
      return item.status === "입금대기" || item.status === "연체";
    });
    var monthUnpaidAmount = sum(monthUnpaid, function (item) { return item.amount; });

    setHTML("adminKpiRevenue", number(revenue) + "<small>원</small>");
    setText("adminKpiRevenueFoot", monthKey(0).replace("-", "년 ") + "월 기준 · " + monthPaid.length + "건");

    setHTML("adminKpiUnpaid", number(monthUnpaid.length) + "<small>건</small>");
    setText("adminKpiUnpaidFoot", "미수 금액 " + won(monthUnpaidAmount));

    var monthTraining = trainingRecords.filter(function (item) {
      return item.date.slice(0, 7) === monthKey(0);
    });
    setHTML("adminKpiActivity", number(monthTraining.length) + "<small>건</small>");
    setText("adminKpiActivityFoot", "참석 " + monthTraining.filter(function (item) { return item.attendance === "참석"; }).length + "건 · 이번 달 누적");

    var paidMonths = [];
    var totalPaid = 0;
    var annualPaid = 0;
    for (var offset = 5; offset >= 0; offset -= 1) {
      var period = monthKey(offset);
      var monthItems = payments.filter(function (item) {
        return item.period === period && item.status === "입금완료";
      });
      var value = sum(monthItems, function (item) { return item.amount; });
      totalPaid += value;
      annualPaid += sum(monthItems.filter(function (item) { return item.plan === "annual"; }), function (item) {
        return item.amount;
      });
      paidMonths.push({
        label: monthLabel(offset),
        value: value,
        display: shortWon(value),
        color: offset % 2 === 0 ? "#0e6b4e" : "#8aa61c"
      });
    }
    renderBars("overviewRevenueChart", paidMonths, "원");
    setText("overviewRevenueTotal", "합계 " + won(totalPaid));
    setText("overviewAnnualShare", (totalPaid ? Math.round((annualPaid / totalPaid) * 100) : 0) + "%");

    var mix = [
      { key: "students", label: "학생", value: counts.students, cls: "progress--lime" },
      { key: "parents", label: "학부모", value: counts.parents, cls: "progress--blue" },
      { key: "coaches", label: "코치", value: counts.coaches, cls: "" },
      { key: "academies", label: "아카데미", value: counts.academies, cls: "progress--clay" }
    ];
    setHTML("memberMix", mix.map(function (item) {
      var pct = total ? Math.round((item.value / total) * 100) : 0;
      return (
        '<div class="admin-mix__row"><div class="progress-row__head"><span>' + item.label +
        "</span><b>" + item.value + "명 · " + pct + '%</b></div><div class="progress ' + item.cls +
        '"><i style="--w:' + pct + '%"></i></div></div>'
      );
    }).join(""));

    var newMembers = allMembers().filter(function (item) {
      return item.joined.slice(0, 7) === monthKey(0);
    });
    var idleMembers = allMembers().filter(function (item) { return item.status !== "활성"; });
    setText("overviewNewMembers", newMembers.length + "명");
    setText("overviewIdleMembers", idleMembers.length + "명");

    var recent = allMembers().slice().sort(function (a, b) {
      return a.joined < b.joined ? 1 : -1;
    }).slice(0, 5);

    setHTML("recentMembersBody", recent.map(function (item) {
      return (
        "<tr><td>" + personCell(item) + "</td><td>" + esc(TYPE_LABEL[item.type]) +
        "</td><td>" + esc(item.org) + "</td><td>" + prettyDate(item.joined) +
        "</td><td>" + statusTag(item.status) + "</td></tr>"
      );
    }).join(""));

    var pendingInquiries = inquiries.filter(function (item) { return item.status === "답변 대기"; });
    var scheduledNotices = notices.filter(function (item) { return item.status === "예약"; });
    var pendingMembers = allMembers().filter(function (item) { return item.status === "대기"; });
    var allUnpaid = unpaidPayments();
    var unpaidAmount = sum(allUnpaid, function (item) { return item.amount; });

    var alerts = [
      {
        icon: "i-clock", tone: "clay", title: "미납 · 연체 청구서",
        desc: "입금 확인이 필요한 청구서", count: allUnpaid.length + "건", amount: won(unpaidAmount),
        view: "billing"
      },
      {
        icon: "i-mail", tone: "blue", title: "답변 대기 문의",
        desc: "1:1 문의 답변을 기다리는 회원", count: pendingInquiries.length + "건", amount: "",
        view: "operations"
      },
      {
        icon: "i-user", tone: "gold", title: "승인 대기 회원",
        desc: "가입 승인 또는 정보 확인 필요", count: pendingMembers.length + "명", amount: "",
        view: "members"
      },
      {
        icon: "i-note", tone: "green", title: "예약된 공지",
        desc: "게시 예정인 공지사항", count: scheduledNotices.length + "건", amount: "",
        view: "operations"
      }
    ];

    setHTML("overviewAlerts", alerts.map(function (item) {
      return (
        '<button class="admin-alert" type="button" data-admin-view="' + item.view + '">' +
        '<span class="admin-alert__ico admin-alert__ico--' + item.tone + '"><svg class="icon" aria-hidden="true"><use href="#' +
        item.icon + '" /></svg></span><div><strong>' + item.title + "</strong><span>" + item.desc +
        "</span></div><b>" + item.count + "</b></button>"
      );
    }).join(""));
  }

  /* ---------------------------------------------------------------
     Members
     --------------------------------------------------------------- */
  function memberColumns(type) {
    if (type === "parents") return ["학부모", "연결 자녀", "연락처", "가입일", "상태", "요금제", ""];
    if (type === "coaches") return ["코치", "소속 팀", "담당", "연락처", "가입일", "상태", ""];
    if (type === "academies") return ["아카데미", "기관 유형", "팀 / 선수", "담당자", "가입일", "상태", "요금제", ""];
    return ["학생", "소속", "포지션", "보호자", "가입일", "상태", "요금제", ""];
  }

  function memberCells(item) {
    if (item.type === "parents") {
      return [personCell(item), esc(item.child), esc(item.phone || "—"), prettyDate(item.joined), statusTag(item.status), planTag(item.plan), actionButton(item)];
    }
    if (item.type === "coaches") {
      return [personCell(item), esc(item.team), esc(item.position), esc(item.phone || "—"), prettyDate(item.joined), statusTag(item.status), actionButton(item)];
    }
    if (item.type === "academies") {
      return [personCell(item), esc(item.orgType), item.teams + "팀 · " + item.players + "명", esc(item.manager), prettyDate(item.joined), statusTag(item.status), planTag(item.plan), actionButton(item)];
    }
    return [personCell(item), esc(item.org), esc(item.position), esc(item.guardian), prettyDate(item.joined), statusTag(item.status), planTag(item.plan), actionButton(item)];
  }

  function filteredMembers() {
    var query = state.memberSearch.trim().toLowerCase();
    return members[state.memberTab].filter(function (item) {
      if (state.memberStatus !== "all" && item.status !== state.memberStatus) return false;
      if (state.memberPlan !== "all" && item.plan !== state.memberPlan) return false;
      if (!query) return true;
      return [item.name, item.email, item.phone, item.org, item.team, item.manager].some(function (value) {
        return String(value || "").toLowerCase().indexOf(query) !== -1;
      });
    });
  }

  function renderMembers() {
    var type = state.memberTab;
    var list = filteredMembers();
    var totalPages = Math.max(1, Math.ceil(list.length / MEMBER_PAGE_SIZE));
    state.memberPage = Math.min(Math.max(1, state.memberPage), totalPages);
    var start = (state.memberPage - 1) * MEMBER_PAGE_SIZE;
    var pageItems = list.slice(start, start + MEMBER_PAGE_SIZE);

    document.querySelectorAll("[data-member-tab]").forEach(function (button) {
      var on = button.getAttribute("data-member-tab") === type;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-selected", on ? "true" : "false");
    });

    setText("memberTabStudents", members.students.length);
    setText("memberTabParents", members.parents.length);
    setText("memberTabCoaches", members.coaches.length);
    setText("memberTabAcademies", members.academies.length);
    setText("memberCount", list.length + "명");

    setHTML("memberTableHead", "<tr>" + memberColumns(type).map(function (label) { return "<th>" + label + "</th>"; }).join("") + "</tr>");

    if (!pageItems.length) {
      setHTML("memberBody", '<tr><td colspan="' + memberColumns(type).length + '"><div class="admin-empty"><strong>조건에 맞는 회원이 없습니다.</strong>검색어나 필터를 변경해 보세요.</div></td></tr>');
    } else {
      setHTML("memberBody", pageItems.map(function (item) {
        return "<tr>" + memberCells(item).map(function (cell) { return "<td>" + cell + "</td>"; }).join("") + "</tr>";
      }).join(""));
    }

    renderPagination(document.getElementById("memberPagination"), state.memberPage, totalPages, list.length, "member-page");
    renderChrome();
  }

  function latestPaymentFor(id) {
    return payments.filter(function (item) { return item.memberId === id; }).sort(function (a, b) {
      return a.period < b.period ? 1 : -1;
    })[0];
  }

  function openMemberDetail(id) {
    var item = findMember(id);
    if (!item) return;
    var invoice = latestPaymentFor(item.id);
    var tone = toneOf(item.type);
    var stats = [];

    if (item.type === "students") {
      stats = [
        ["훈련 세션", item.sessions + "회"],
        ["출석률", item.attendance + "%"],
        ["성장 지수", item.growth + "점"]
      ];
    } else if (item.type === "parents") {
      stats = [
        ["연결 자녀", item.child],
        ["문의", "2건"],
        ["이용 상태", item.status]
      ];
    } else if (item.type === "coaches") {
      stats = [
        ["담당 선수", item.players + "명"],
        ["소속 팀", item.team],
        ["이용 상태", item.status]
      ];
    } else {
      stats = [
        ["운영 팀", item.teams + "팀"],
        ["소속 선수", item.players + "명"],
        ["이용 상태", item.status]
      ];
    }

    var rows = [
      ["이메일", item.email],
      ["연락처", item.phone || "—"],
      ["가입일", prettyDate(item.joined)],
      ["요금제", item.plan],
      ["최근 로그인", prettyDate(isoDaysAgo(hash(item.id) % 18))]
    ];

    if (item.type === "students") {
      rows.splice(2, 0, ["나이 · 성별", item.age + "세 · " + (hash(item.id) % 2 ? "남" : "여")]);
      rows.push(["소속", item.org], ["포지션", item.position], ["보호자", item.guardian], ["담당 코치", item.coach]);
    } else if (item.type === "parents") {
      rows.push(["관계", item.relation], ["연결 자녀", item.child + " 선수"]);
    } else if (item.type === "coaches") {
      rows.push(["소속 팀", item.team], ["담당 역할", item.position], ["관리 선수", item.players + "명"]);
    } else {
      rows.push(["기관 유형", item.orgType], ["운영 팀", item.teams + "팀"], ["소속 선수", item.players + "명"], ["담당자", item.manager]);
    }

    var growthBlock = "";
    if (item.type === "students") {
      growthBlock =
        '<div class="admin-detail__section"><h3>성장 지표</h3>' +
        growthMetricsFor(item, true) + "</div>";
    }

    var paymentBlock =
      '<div class="admin-detail__section"><h3>요금 · 결제</h3>' +
      (invoice
        ? '<div class="info-list"><div><span>최근 청구</span><span>' + invoice.id + " · " + won(invoice.amount) +
          '</span></div><div><span>청구 월</span><span>' + invoice.period + '</span></div><div><span>입금 상태</span><span>' +
          invoice.status + '</span></div><div><span>입금일</span><span>' + prettyDate(invoice.paid) + "</span></div></div>"
        : '<div class="admin-empty"><strong>등록된 청구서가 없습니다.</strong>요금 관리에서 청구를 확인하세요.</div>') +
      "</div>";

    var activity = [
      ["훈련 기록 " + (item.sessions || 0) + "건 동기화", prettyDate(isoDaysAgo(1))],
      ["코치 피드백 확인", prettyDate(isoDaysAgo(3))],
      ["프로필 정보 변경", prettyDate(isoDaysAgo(12))]
    ];
    if (item.type === "parents") {
      activity = [["응원글 3건 작성", prettyDate(isoDaysAgo(1))], ["코치 요청 확인", prettyDate(isoDaysAgo(4))], ["알림 설정 변경", prettyDate(isoDaysAgo(9))]];
    } else if (item.type === "coaches") {
      activity = [["선수 " + item.players + "명 훈련 피드백", prettyDate(isoDaysAgo(1))], ["목표 평가 업데이트", prettyDate(isoDaysAgo(5))], ["소속 선수 초대", prettyDate(isoDaysAgo(14))]];
    } else if (item.type === "academies") {
      activity = [["월간 기관 리포트 생성", prettyDate(isoDaysAgo(2))], ["팀 " + item.teams + "개 통계 동기화", prettyDate(isoDaysAgo(6))], ["관리자 권한 변경", prettyDate(isoDaysAgo(21))]];
    }

    setHTML("memberDetailContent",
      '<div class="admin-detail__top">' +
        '<span class="admin-detail__avatar admin-detail__avatar--' + tone + '">' + esc(item.name.charAt(0)) + "</span>" +
        '<div class="admin-detail__id"><h2 id="memberDetailTitle">' + esc(item.name) + "</h2>" +
        "<p><span>" + TYPE_LABEL[item.type] + "</span>" + statusTag(item.status) + '<span class="tag tag--outline">' + esc(item.id) + "</span></p></div>" +
      "</div>" +
      '<div class="admin-detail__stats">' + stats.map(function (stat) {
        return '<div class="admin-detail__stat"><span>' + esc(stat[0]) + "</span><strong>" + esc(stat[1]) + "</strong></div>";
      }).join("") + "</div>" +
      '<div class="admin-detail__section"><h3>기본 정보</h3><div class="info-list">' +
        rows.map(function (row) {
          return "<div><span>" + esc(row[0]) + "</span><span>" + esc(row[1]) + "</span></div>";
        }).join("") +
      "</div></div>" +
      growthBlock +
      paymentBlock +
      '<div class="admin-detail__section"><h3>최근 활동</h3><ul class="admin-timeline">' +
        activity.map(function (row) {
          return "<li><strong>" + esc(row[0]) + "</strong><time>" + esc(row[1]) + "</time></li>";
        }).join("") +
      "</ul></div>" +
      '<div class="admin-detail__foot"><a class="btn btn--dark btn--sm" href="mailto:' + esc(item.email) + '">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-mail" /></svg>이메일 보내기</a>' +
        '<button class="btn btn--outline btn--sm" type="button" data-modal-close>닫기</button></div>'
    );

    Store.openModal("memberDetailModal");
    addLog("회원 상세 조회", item.id + " " + item.name);
  }

  /* ---------------------------------------------------------------
     Training & growth
     --------------------------------------------------------------- */
  function growthMetricsFor(item, compact) {
    var base = Number(item.growth || 0);
    var seed = hash(item.id);
    var metrics = [
      ["타격 정확도", clamp(base + 3 - (seed % 3), 0, 100), ""],
      ["수비 안정성", clamp(base - 2 + (seed % 4), 0, 100), "progress--blue"],
      ["주루 스피드", clamp(base + 1 - (seed % 2), 0, 100), "progress--lime"],
      ["체력 지수", clamp(base - 4 + (seed % 5), 0, 100), "progress--clay"],
      ["경기 이해도", clamp(base + 5 - (seed % 4), 0, 100), "progress--gold"]
    ];

    return (
      '<div class="' + (compact ? "admin-detail__metrics" : "") + '">' +
      metrics.map(function (metric) {
        return (
          '<div class="progress-row"><div class="progress-row__head"><span>' + metric[0] +
          "</span><b>" + metric[1] + "</b></div><div class=\"progress " + metric[2] +
          '"><i style="--w:' + metric[1] + '%"></i></div></div>'
        );
      }).join("") +
      "</div>"
    );
  }

  function selectedDataStudent() {
    if (state.dataStudent === "all") return null;
    var found = null;
    members.students.forEach(function (item) {
      if (item.id === state.dataStudent) found = item;
    });
    return found;
  }

  function recordsInPeriod(period) {
    var limit = period * 30;
    var selected = selectedDataStudent();
    return trainingRecords.filter(function (item) {
      if (selected && item.studentId !== selected.id) return false;
      return daysAgo(item.date) <= limit;
    });
  }

  function attendanceRate(records) {
    if (!records.length) return 0;
    var attended = records.filter(function (item) {
      return item.attendance === "참석" || item.attendance === "지각";
    }).length;
    return Math.round((attended / records.length) * 100);
  }

  function renderGrowthChart(values, labels, target, label) {
    var el = document.getElementById("growthChart");
    if (!el || !values.length) return;

    var W = 560;
    var H = 208;
    var left = 34;
    var right = 14;
    var top = 16;
    var bottom = 30;
    var min = Math.min.apply(null, values.concat([target])) - 8;
    var max = Math.max.apply(null, values.concat([target])) + 8;
    if (max - min < 12) {
      min -= 6;
      max += 6;
    }
    min = Math.max(0, min);
    max = Math.min(100, max);

    function x(index) {
      return left + ((W - left - right) * index) / Math.max(1, values.length - 1);
    }

    function y(value) {
      return top + (H - top - bottom) * (1 - (value - min) / (max - min));
    }

    var grid = "";
    var axis = "";
    for (var step = 0; step <= 4; step += 1) {
      var value = min + ((max - min) * step) / 4;
      var gy = y(value);
      grid += '<line x1="' + left + '" y1="' + gy.toFixed(1) + '" x2="' + (W - right) + '" y2="' + gy.toFixed(1) + '" />';
      axis += '<text x="' + (left - 6) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end">' + Math.round(value) + "</text>";
    }

    var points = values.map(function (value, index) {
      return [x(index), y(value)];
    });

    var line = points.map(function (point, index) {
      return (index ? "L" : "M") + point[0].toFixed(1) + " " + point[1].toFixed(1);
    }).join(" ");

    var area = line + " L " + points[points.length - 1][0].toFixed(1) + " " + (H - bottom) +
      " L " + points[0][0].toFixed(1) + " " + (H - bottom) + " Z";

    var dots = points.map(function (point, index) {
      return (
        '<circle class="line-chart__dot' + (index === points.length - 1 ? " line-chart__dot--peak" : "") +
        '" cx="' + point[0].toFixed(1) + '" cy="' + point[1].toFixed(1) + '" r="3.1"><title>' +
        esc(labels[index] + " " + values[index] + "점") + "</title></circle>"
      );
    }).join("");

    el.innerHTML =
      '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(label) + ' 성장 추이">' +
      '<defs><linearGradient id="adminGrowthGradient" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#0e6b4e" stop-opacity=".22" />' +
      '<stop offset="100%" stop-color="#0e6b4e" stop-opacity="0" />' +
      "</linearGradient></defs>" +
      '<g class="line-chart__grid">' + grid + "</g>" +
      '<g class="line-chart__axis">' + axis +
        labels.map(function (item, index) {
          return '<text x="' + x(index).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(item) + "</text>";
        }).join("") +
      "</g>" +
      '<line x1="' + left + '" y1="' + y(target).toFixed(1) + '" x2="' + (W - right) + '" y2="' + y(target).toFixed(1) +
        '" stroke="#c25a34" stroke-width="1.2" stroke-dasharray="5 4" opacity=".7" />' +
      '<path class="line-chart__area" d="' + area + '" fill="url(#adminGrowthGradient)" />' +
      '<path class="line-chart__line" d="' + line + '" />' + dots + "</svg>";

    var delta = round1(values[values.length - 1] - values[0]);
    var deltaEl = document.getElementById("growthDelta");
    if (deltaEl) {
      deltaEl.textContent = (delta >= 0 ? "+" : "") + delta.toFixed(1);
      deltaEl.className = "tag " + (delta >= 0 ? "tag--green" : "tag--clay");
    }

    setText("growthSummary", "최근 6개월 평균 " + Math.round(sum(values) / values.length) + "점 · 목표 80점");
  }

  function renderTrainingChart(records) {
    var counts = [0, 0, 0, 0, 0, 0];
    records.forEach(function (item) {
      var week = Math.floor(daysAgo(item.date) / 7);
      if (week >= 0 && week < 6) counts[5 - week] += 1;
    });

    var labels = ["6주 전", "5주 전", "4주 전", "3주 전", "2주 전", "이번 주"];
    var items = counts.map(function (value, index) {
      return {
        label: labels[index],
        value: value,
        display: value + "회",
        color: index === 5 ? "#b7d93f" : "#0e6b4e"
      };
    });
    renderBars("trainingChart", items, "회");

    var total = sum(counts);
    var selected = selectedDataStudent();
    setText("trainingSub", (selected ? selected.name : "전체 학생") + " · 최근 6주 · 주간 세션");
    setText("trainingTotal", total + "회");
    setText("trainingSummary", "주당 평균 " + round1(total / 6) + "회");
    setText("trainingHigh", records.filter(function (item) { return item.intensity === "높음"; }).length + "회");
  }

  function attendanceTag(value) {
    var cls = value === "참석" ? "good" : value === "지각" ? "warn" : "risk";
    return '<span class="status status--' + cls + '">' + esc(value) + "</span>";
  }

  function intensityTag(value) {
    var cls = value === "높음" ? "tag--clay" : value === "낮음" ? "tag--green" : "tag--outline";
    return '<span class="tag ' + cls + '">' + esc(value) + "</span>";
  }

  function latestTrainingDate(records) {
    if (!records.length) return "-";
    return prettyDate(records[0].date);
  }

  function renderData() {
    var select = document.getElementById("dataStudent");
    if (select) {
      var optionHTML = '<option value="all">전체 학생</option>' + members.students.map(function (item) {
        return '<option value="' + esc(item.id) + '">' + esc(item.name) + " · " + esc(item.org) + "</option>";
      }).join("");
      select.innerHTML = optionHTML;
      var exists = members.students.some(function (item) { return item.id === state.dataStudent; });
      if (!exists) state.dataStudent = "all";
      select.value = state.dataStudent;
    }

    var selected = selectedDataStudent();
    var period = state.dataPeriod;
    var records = recordsInPeriod(period);
    var minutes = sum(records, function (item) { return item.minutes; });
    var attended = records.filter(function (item) { return item.attendance === "참석" || item.attendance === "지각"; }).length;
    var growth = selected
      ? selected.growth
      : Math.round(sum(members.students, function (item) { return item.growth; }) / Math.max(1, members.students.length));

    setHTML("dataKpiSessions", number(records.length) + "<small>회</small>");
    setText("dataKpiSessionsFoot", (selected ? selected.name : "전체 학생") + " · 최근 " + period + "개월");

    setHTML("dataKpiMinutes", round1(minutes / 60) + "<small>시간</small>");
    setText("dataKpiMinutesFoot", "세션당 평균 " + Math.round(minutes / Math.max(1, records.length)) + "분");

    setHTML("dataKpiAttendance", attendanceRate(records) + "<small>%</small>");
    setText("dataKpiAttendanceFoot", "참석 " + attended + " · 결석 " + (records.length - attended) + "건");

    setHTML("dataKpiGrowth", growth + "<small>점</small>");
    setText("dataKpiGrowthFoot", "최근 6개월 기준 · 목표 80점");

    var histories = [];
    if (selected) {
      histories = growthHistory(selected);
    } else {
      for (var index = 0; index < 6; index += 1) {
        histories.push(round1(sum(members.students, function (item) { return growthHistory(item)[index]; }) / Math.max(1, members.students.length)));
      }
    }
    var labels = [5, 4, 3, 2, 1, 0].map(monthLabel);
    setText("growthSub", (selected ? selected.name : "전체 학생 평균") + " · 최근 6개월 추이");
    renderGrowthChart(histories, labels, 80, selected ? selected.name : "전체 학생");

    var chartRecords = trainingRecords.filter(function (item) {
      if (selected && item.studentId !== selected.id) return false;
      return daysAgo(item.date) <= 41;
    });
    renderTrainingChart(chartRecords);

    setText("growthMetricSub", selected ? selected.name + " · 최근 측정값" : "전체 학생 평균");
    setText("growthUpdated", latestTrainingDate(records));
    var metricItem = selected || { id: "average-student", growth: growth };
    setHTML("growthMetrics", growthMetricsFor(metricItem, false));

    var recordItems = records.slice(0, 8);
    if (!recordItems.length) {
      setHTML("trainingRecordBody", '<tr><td colspan="5"><div class="admin-empty"><strong>훈련 기록이 없습니다.</strong>기간을 변경해 보세요.</div></td></tr>');
    } else {
      setHTML("trainingRecordBody", recordItems.map(function (item) {
        return (
          "<tr><td>" + prettyDate(item.date) + "</td><td><strong>" + esc(item.type) + "</strong>" +
          (selected ? "" : '<br><span class="muted">' + esc(item.student) + "</span>") +
          '</td><td class="num">' + item.minutes + "분</td><td>" + intensityTag(item.intensity) +
          "</td><td>" + attendanceTag(item.attendance) + "</td></tr>"
        );
      }).join(""));
    }
    setText("recordSub", (selected ? selected.name : "전체 학생") + " · 최근 " + period + "개월 최신순");
    setText("recordCount", records.length + "건");

    var rows = members.students.map(function (item) {
      var own = trainingRecords.filter(function (record) {
        return record.studentId === item.id && daysAgo(record.date) <= period * 30;
      });
      var ownMinutes = sum(own, function (record) { return record.minutes; });
      var ownAttendance = attendanceRate(own);
      var stateLabel = item.growth >= 82 ? "우수" : item.growth >= 68 ? "안정" : "지원 필요";
      var stateCls = item.growth >= 82 ? "good" : item.growth >= 68 ? "info" : "warn";
      return (
        "<tr><td>" + personCell(item) + "</td><td>" + esc(item.org) + '</td><td class="num">' + own.length +
        '회</td><td class="num">' + round1(ownMinutes / 60) + '시간</td><td class="num">' + ownAttendance +
        '%</td><td><div class="progress progress--lime" style="min-width:74px"><i style="--w:' + item.growth +
        '%"></i></div><span class="muted">' + item.growth + '점</span></td><td><span class="status status--' +
        stateCls + '">' + stateLabel + '</span></td><td><div class="table-actions"><button type="button" data-data-student="' +
        esc(item.id) + '" aria-label="' + esc(item.name) + ' 기록 보기"><svg class="icon" aria-hidden="true"><use href="#i-eye" /></svg></button></div></td></tr>'
      );
    });

    setHTML("dataStudentBody", rows.join(""));
    setText("dataSummaryCount", members.students.length + "명");
  }

  /* ---------------------------------------------------------------
     Billing
     --------------------------------------------------------------- */
  function billingBase() {
    var query = state.billingSearch.trim().toLowerCase();
    return payments.filter(function (item) {
      if (state.billingPlan !== "all" && item.plan !== state.billingPlan) return false;
      if (state.billingMonth !== "all" && item.period !== state.billingMonth) return false;
      if (query && (item.member + " " + item.id).toLowerCase().indexOf(query) === -1) return false;
      return true;
    });
  }

  function billingFiltered(base) {
    return base.filter(function (item) {
      if (state.billingStatus !== "all" && item.status !== state.billingStatus) return false;
      return true;
    });
  }

  function renderBilling() {
    var base = billingBase();
    var list = billingFiltered(base);
    var billed = sum(base, function (item) { return item.amount; });
    var paid = sum(base.filter(function (item) { return item.status === "입금완료"; }), function (item) { return item.amount; });
    var unpaid = base.filter(function (item) { return item.status === "입금대기" || item.status === "연체"; });
    var unpaidAmount = sum(unpaid, function (item) { return item.amount; });
    var annual = sum(base.filter(function (item) { return item.plan === "annual"; }), function (item) { return item.amount; });

    setHTML("billingKpiBilled", number(billed) + "<small>원</small>");
    setText("billingKpiBilledFoot", base.length + "건 기준 · 환불 포함");

    setHTML("billingKpiPaid", number(paid) + "<small>원</small>");
    setText("billingKpiPaidFoot", "입금률 " + (billed ? Math.round((paid / billed) * 100) : 0) + "% · " +
      base.filter(function (item) { return item.status === "입금완료"; }).length + "건");

    setHTML("billingKpiUnpaid", number(unpaid.length) + "<small>건</small>");
    setText("billingKpiUnpaidFoot", "금액 " + won(unpaidAmount));

    setHTML("billingKpiAnnual", (billed ? Math.round((annual / billed) * 100) : 0) + "<small>%</small>");
    setText("billingKpiAnnualFoot", "연간 결제 " + base.filter(function (item) { return item.plan === "annual"; }).length + "건");

    setText("billingCount", list.length + "건");
    setText("planStudentMonthly", members.students.filter(function (item) { return item.plan === "월간"; }).length + "명");
    setText("planStudentAnnual", members.students.filter(function (item) { return item.plan === "연간"; }).length + "명");
    setText("planOrg", members.coaches.length + members.academies.length + "곳");

    var paidMonths = [];
    var totalPaid = 0;
    var totalUnpaid = 0;
    for (var offset = 5; offset >= 0; offset -= 1) {
      var period = monthKey(offset);
      var monthPaid = payments.filter(function (item) {
        return item.period === period && item.status === "입금완료";
      });
      var monthUnpaid = payments.filter(function (item) {
        return item.period === period && (item.status === "입금대기" || item.status === "연체");
      });
      var value = sum(monthPaid, function (item) { return item.amount; });
      totalPaid += value;
      totalUnpaid += sum(monthUnpaid, function (item) { return item.amount; });
      paidMonths.push({
        label: monthLabel(offset),
        value: value,
        display: shortWon(value),
        color: monthUnpaid.length ? "#c25a34" : "#0e6b4e"
      });
    }
    renderBars("billingChart", paidMonths, "원");
    setText("billingChartTotal", won(totalPaid));
    setText("billingChartSummary", "최근 6개월 입금 합계 " + won(totalPaid) + " · 미납 " + won(totalUnpaid));

    var totalPages = Math.max(1, Math.ceil(list.length / BILLING_PAGE_SIZE));
    state.billingPage = Math.min(Math.max(1, state.billingPage), totalPages);
    var start = (state.billingPage - 1) * BILLING_PAGE_SIZE;
    var pageItems = list.slice(start, start + BILLING_PAGE_SIZE);
    var statuses = ["입금완료", "입금대기", "연체", "환불"];

    if (!pageItems.length) {
      setHTML("billingBody", '<tr><td colspan="10"><div class="admin-empty"><strong>조건에 맞는 청구서가 없습니다.</strong>필터를 변경해 보세요.</div></td></tr>');
    } else {
      setHTML("billingBody", pageItems.map(function (item) {
        return (
          "<tr><td><strong>" + esc(item.id) + "</strong></td><td>" + esc(item.member) +
          '<br><span class="muted">' + esc(item.memberId) + "</span></td><td>" + esc(item.type) +
          "</td><td>" + planTag(item.plan === "annual" ? "연간" : "월간") +
          '</td><td class="num">' + won(item.amount) + "</td><td>" + prettyDate(item.period) +
          "</td><td>" + prettyDate(item.paid) + "</td><td>" + esc(item.method) + "</td><td>" +
          statusTag(item.status) + '</td><td><select class="admin-status-select" data-payment-id="' +
          esc(item.id) + '" aria-label="' + esc(item.member) + ' 입금 상태 변경">' +
          statuses.map(function (status) {
            return '<option value="' + status + '"' + (status === item.status ? " selected" : "") + ">" + status + "</option>";
          }).join("") + "</select></td></tr>"
        );
      }).join(""));
    }

    renderPagination(document.getElementById("billingPagination"), state.billingPage, totalPages, list.length, "billing-page");
    renderChrome();
  }

  function updatePaymentStatus(id, status) {
    var target = null;
    payments.forEach(function (item) {
      if (item.id === id) target = item;
    });
    if (!target) return;
    target.status = status;
    if (status === "입금완료" || status === "환불") {
      if (!target.paid) target.paid = todayISO();
    } else {
      target.paid = "";
    }
    persistPayments();
    addLog("입금 상태 변경", target.id + " · " + status);
    toast(target.member + "님 청구서를 " + status + "(으)로 변경했습니다.");
    renderBilling();
    renderOverview();
  }

  /* ---------------------------------------------------------------
     Operations — notices / inquiries / logs
     --------------------------------------------------------------- */
  function renderChrome() {
    var total = allMembers().length;
    setText("navMemberCount", total);
    setText("navUnpaidCount", unpaidPayments().length);
    setText("opsTabNotices", notices.length);
    setText("opsTabInquiries", inquiries.length);
    setText("opsTabLogs", logs.length);
    setText("logCount", logs.length + "건");

    var session = SportsGrow.getSession ? SportsGrow.getSession() : null;
    if (session && session.loggedAt) {
      var date = new Date(session.loggedAt);
      if (!isNaN(date.getTime())) {
        setText("adminLastLogin", prettyDate(isoDate(date)) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()));
      }
    }
  }

  function showOpsTab(key) {
    state.opsTab = key;
    document.querySelectorAll("[data-ops-tab]").forEach(function (button) {
      var on = button.getAttribute("data-ops-tab") === key;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll("[data-ops-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-ops-panel") !== key;
    });
  }

  function renderNotices() {
    var filter = document.getElementById("noticeFilter");
    var value = filter ? filter.value : "all";
    var list = notices.filter(function (item) {
      return value === "all" || item.status === value;
    }).slice().sort(function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.date < b.date ? 1 : -1;
    });

    if (!list.length) {
      setHTML("noticeBody", '<tr><td colspan="6"><div class="admin-empty"><strong>조건에 맞는 공지가 없습니다.</strong>새 공지를 작성해 보세요.</div></td></tr>');
      return;
    }

    setHTML("noticeBody", list.map(function (item) {
      return (
        "<tr><td><strong>" + (item.pinned ? "📌 " : "") + esc(item.title) + "</strong><br><span class=\"muted\">" +
        esc(String(item.body || "").slice(0, 34)) + (String(item.body || "").length > 34 ? "…" : "") +
        '</span></td><td><span class="tag tag--outline">' + esc(item.category) + "</span></td><td>" +
        statusTag(item.status) + "</td><td>" + prettyDate(item.date) + '</td><td class="num">' + number(item.views) +
        '</td><td><div class="table-actions"><select class="admin-status-select" data-notice-status="' + esc(item.id) +
        '" aria-label="' + esc(item.title) + ' 상태 변경">' +
        ["게시중", "예약", "종료"].map(function (status) {
          return '<option value="' + status + '"' + (status === item.status ? " selected" : "") + ">" + status + "</option>";
        }).join("") +
        '</select><button type="button" data-notice-remove="' + esc(item.id) + '" aria-label="' + esc(item.title) +
        ' 삭제"><svg class="icon" aria-hidden="true"><use href="#i-trash" /></svg></button></div></td></tr>'
      );
    }).join(""));
  }

  function renderInquiries() {
    var filter = document.getElementById("inquiryFilter");
    var value = filter ? filter.value : "all";
    var list = inquiries.filter(function (item) {
      return value === "all" || item.status === value;
    });

    if (!list.length) {
      setHTML("inquiryBody", '<tr><td colspan="6"><div class="admin-empty"><strong>조건에 맞는 문의가 없습니다.</strong>필터를 변경해 보세요.</div></td></tr>');
      return;
    }

    setHTML("inquiryBody", list.map(function (item) {
      var priorityCls = item.priority === "높음" ? "tag--clay" : item.priority === "낮음" ? "tag--outline" : "tag--gold";
      return (
        "<tr><td><strong>" + esc(item.title) + '</strong><br><span class="muted">' + esc(item.id) + " · " +
        esc(item.category) + '</span></td><td><div class="table-person"><span class="table-avatar table-avatar--blue">' +
        esc(item.from.charAt(0)) + '</span><div><strong>' + esc(item.from) + "</strong><span>" + esc(item.email) +
        "</span></div></div></td><td>" + esc(item.category) + "</td><td>" + prettyDate(item.date) +
        '</td><td><span class="tag ' + priorityCls + '">' + esc(item.priority) + "</span></td><td>" +
        '<select class="admin-status-select" data-inquiry-status="' + esc(item.id) + '" aria-label="' +
        esc(item.title) + ' 상태 변경">' +
        ["답변 대기", "처리 중", "답변 완료"].map(function (status) {
          return '<option value="' + status + '"' + (status === item.status ? " selected" : "") + ">" + status + "</option>";
        }).join("") + "</select></td></tr>"
      );
    }).join(""));
  }

  function renderLogs() {
    var list = logs.slice(0, 30);
    if (!list.length) {
      setHTML("logBody", '<tr><td colspan="4"><div class="admin-empty"><strong>활동 로그가 없습니다.</strong>운영 작업을 진행하면 자동 기록됩니다.</div></td></tr>');
      return;
    }
    setHTML("logBody", list.map(function (item) {
      return (
        "<tr><td>" + esc(item.time) + "</td><td>" + esc(item.actor) + "</td><td><strong>" +
        esc(item.action) + "</strong></td><td>" + esc(item.target) + "</td></tr>"
      );
    }).join(""));
  }

  function renderOperations() {
    renderChrome();
    renderNotices();
    renderInquiries();
    renderLogs();
    showOpsTab(state.opsTab);
  }

  /* ---------------------------------------------------------------
     Settings
     --------------------------------------------------------------- */
  function applySettings() {
    var map = {
      settingSiteName: settings.siteName,
      settingSupportEmail: settings.supportEmail,
      settingSupportPhone: settings.supportPhone,
      settingAdminEmail: settings.adminEmail,
      settingDueDay: settings.dueDay,
      settingAutoRenew: settings.autoRenew
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = map[id];
    });
    var approval = document.getElementById("settingApproval");
    var maintenance = document.getElementById("settingMaintenance");
    if (approval) approval.checked = !!settings.approval;
    if (maintenance) maintenance.checked = !!settings.maintenance;
  }

  function saveSettings() {
    settings = {
      siteName: (document.getElementById("settingSiteName") || {}).value || "Sports Grow",
      supportEmail: (document.getElementById("settingSupportEmail") || {}).value || "",
      supportPhone: (document.getElementById("settingSupportPhone") || {}).value || "",
      adminEmail: (document.getElementById("settingAdminEmail") || {}).value || "",
      dueDay: (document.getElementById("settingDueDay") || {}).value || "10",
      autoRenew: (document.getElementById("settingAutoRenew") || {}).value || "on",
      approval: !!(document.getElementById("settingApproval") || {}).checked,
      maintenance: !!(document.getElementById("settingMaintenance") || {}).checked
    };
    if (!Store.writeStore(KEYS.settings, settings)) {
      toast("저장 공간이 부족해 설정을 저장하지 못했습니다.", "warn");
      return;
    }
    addLog("사이트 설정 저장", settings.siteName + " · 입금 마감일 " + settings.dueDay + "일");
    toast("사이트 설정을 저장했습니다.");
    renderOperations();
  }

  function resetDemoData() {
    var ok = window.confirm(
      "데모 데이터를 모두 초기화할까요?\n" +
        "회원 추가, 입금 상태, 공지, 문의, 로그, 설정 변경 내용과 함께 " +
        "학생 기록(훈련·경기·프로필·갤러리), 학부모 요청, 코치 메모·목표, 아카데미 팀 기록이 모두 삭제됩니다."
    );
    if (!ok) return;
    var keys = Object.keys(KEYS).map(function (key) {
      return KEYS[key];
    }).concat(DEMO_KEYS);
    keys.forEach(function (key) {
      try {
        window.localStorage.removeItem(key);
      } catch (err) {
        /* noop */
      }
    });
    window.location.reload();
  }

  /* ---------------------------------------------------------------
     CSV export
     --------------------------------------------------------------- */
  function downloadCsv(filename, rows) {
    var text = rows.map(function (row) {
      return row.map(function (cell) {
        return '"' + String(cell == null ? "" : cell).replace(/"/g, '""') + '"';
      }).join(",");
    }).join("\r\n");

    var blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }

  function exportMembers() {
    var list = filteredMembers();
    var rows = [["유형", "이름", "이메일", "연락처", "소속", "가입일", "상태", "요금제", "회원번호"]];
    list.forEach(function (item) {
      rows.push([
        TYPE_LABEL[item.type], item.name, item.email, item.phone, item.org,
        item.joined, item.status, item.plan, item.id
      ]);
    });
    downloadCsv("sportsgrow-members-" + todayISO() + ".csv", rows);
    addLog("CSV 내보내기", TYPE_LABEL[state.memberTab] + " 회원 " + list.length + "명");
    toast(TYPE_LABEL[state.memberTab] + " 회원 " + list.length + "명을 CSV로 내보냈습니다.");
    renderOperations();
  }

  function exportBilling() {
    var list = billingFiltered(billingBase());
    var rows = [["청구번호", "회원", "회원번호", "유형", "플랜", "금액", "청구월", "마감일", "입금일", "수단", "상태"]];
    list.forEach(function (item) {
      rows.push([
        item.id, item.member, item.memberId, item.type,
        item.plan === "annual" ? "연간" : "월간", item.amount, item.period,
        item.due, item.paid, item.method, item.status
      ]);
    });
    downloadCsv("sportsgrow-billing-" + todayISO() + ".csv", rows);
    addLog("CSV 내보내기", "입금 내역 " + list.length + "건");
    toast("입금 내역 " + list.length + "건을 CSV로 내보냈습니다.");
    renderOperations();
  }

  function exportTraining() {
    var list = recordsInPeriod(state.dataPeriod);
    var rows = [["날짜", "학생", "훈련", "시간(분)", "강도", "출석", "기록번호"]];
    list.forEach(function (item) {
      rows.push([item.date, item.student, item.type, item.minutes, item.intensity, item.attendance, item.id]);
    });
    downloadCsv("sportsgrow-training-" + todayISO() + ".csv", rows);
    addLog("CSV 내보내기", "훈련 기록 " + list.length + "건");
    toast("훈련 기록 " + list.length + "건을 CSV로 내보냈습니다.");
    renderOperations();
  }

  /* ---------------------------------------------------------------
     View navigation
     --------------------------------------------------------------- */
  function showView(name) {
    if (!VIEW_LABEL[name]) name = "overview";

    document.querySelectorAll("[data-admin-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-admin-panel") !== name;
    });
    document.querySelectorAll(".sidebar__nav [data-admin-view]").forEach(function (link) {
      var on = link.getAttribute("data-admin-view") === name;
      link.classList.toggle("is-active", on);
      if (on) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });

    setText("adminCrumb", VIEW_LABEL[name]);
    try {
      window.history.replaceState(null, "", "#" + name);
    } catch (err) {
      /* file:// 환경에서는 해시만 유지 */
    }
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------
     Events
     --------------------------------------------------------------- */
  function showMemberFormError(message) {
    var box = document.getElementById("memberFormError");
    if (!box) return;
    box.hidden = !message;
    var label = box.querySelector("span");
    if (label) label.textContent = message || "";
  }

  function addMemberFromForm(event) {
    event.preventDefault();
    var type = document.getElementById("newMemberType").value;
    var name = (document.getElementById("newMemberName").value || "").trim();
    var email = (document.getElementById("newMemberEmail").value || "").trim();
    var phone = (document.getElementById("newMemberPhone").value || "").trim();
    var org = (document.getElementById("newMemberOrg").value || "").trim();

    if (!name || !email) {
      showMemberFormError("이름과 이메일을 모두 입력해 주세요.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMemberFormError("올바른 이메일 형식을 입력해 주세요.");
      return;
    }

    var prefix = { students: "ST", parents: "PA", coaches: "CO", academies: "AC" }[type];
    var item = {
      id: prefix + "-" + Date.now().toString().slice(-5),
      type: type,
      name: name,
      email: email,
      phone: phone || "미등록",
      org: org || "미등록",
      joined: todayISO(),
      status: "대기",
      plan: type === "parents" ? "무료" : "월간"
    };

    if (type === "students") {
      item.age = 14;
      item.position = "미정";
      item.guardian = "미등록";
      item.coach = "미배정";
      item.sessions = 0;
      item.attendance = 0;
      item.growth = 0;
    } else if (type === "parents") {
      item.relation = "보호자";
      item.child = "미연결";
    } else if (type === "coaches") {
      item.team = org || "미배정";
      item.position = "코치";
      item.players = 0;
    } else {
      item.orgType = "아카데미";
      item.teams = 0;
      item.players = 0;
      item.manager = name;
    }

    members[type].unshift(item);
    if (!persistMembers()) {
      toast("저장 공간이 부족해 회원을 추가하지 못했습니다.", "warn");
      return;
    }

    state.memberTab = type;
    state.memberPage = 1;
    state.memberSearch = "";
    state.memberStatus = "all";
    state.memberPlan = "all";
    var search = document.getElementById("memberSearch");
    if (search) search.value = "";
    var status = document.getElementById("memberStatus");
    if (status) status.value = "all";
    var plan = document.getElementById("memberPlan");
    if (plan) plan.value = "all";

    addLog("회원 추가", item.name + " · " + TYPE_LABEL[type]);
    showMemberFormError("");
    event.target.reset();
    Store.closeModal("memberFormModal");
    renderMembers();
    renderOverview();
    renderOperations();
    showView("members");
    toast(item.name + "님을 " + TYPE_LABEL[type] + " 회원으로 등록했습니다.");
  }

  function addNoticeFromForm(event) {
    event.preventDefault();
    var title = (document.getElementById("noticeTitle").value || "").trim();
    var body = (document.getElementById("noticeContent").value || "").trim();
    if (!title || !body) {
      toast("공지 제목과 내용을 모두 입력해 주세요.", "warn");
      return;
    }

    var item = {
      id: "N-" + Date.now().toString().slice(-4),
      title: title,
      category: document.getElementById("noticeCategory").value,
      status: document.getElementById("noticeStatus").value,
      date: todayISO(),
      views: 0,
      pinned: document.getElementById("noticePinned").checked,
      body: body
    };

    notices.unshift(item);
    persistNotices();
    addLog("공지사항 게시", item.title);
    event.target.reset();
    Store.closeModal("noticeModal");
    renderOperations();
    toast("공지사항을 게시했습니다.");
  }

  function bindEvents() {
    document.addEventListener("click", function (event) {
      var viewLink = event.target.closest("[data-admin-view]");
      if (viewLink) {
        event.preventDefault();
        showView(viewLink.getAttribute("data-admin-view"));
        return;
      }

      var detailButton = event.target.closest("[data-member-detail]");
      if (detailButton) {
        event.preventDefault();
        openMemberDetail(detailButton.getAttribute("data-member-detail"));
        return;
      }

      var memberPage = event.target.closest("[data-member-page]");
      if (memberPage) {
        event.preventDefault();
        state.memberPage = Number(memberPage.getAttribute("data-member-page")) || 1;
        renderMembers();
        return;
      }

      var billingPage = event.target.closest("[data-billing-page]");
      if (billingPage) {
        event.preventDefault();
        state.billingPage = Number(billingPage.getAttribute("data-billing-page")) || 1;
        renderBilling();
        return;
      }

      var dataButton = event.target.closest("[data-data-student]");
      if (dataButton) {
        event.preventDefault();
        state.dataStudent = dataButton.getAttribute("data-data-student");
        var select = document.getElementById("dataStudent");
        if (select) select.value = state.dataStudent;
        renderData();
        return;
      }

      var noticeRemove = event.target.closest("[data-notice-remove]");
      if (noticeRemove) {
        event.preventDefault();
        var noticeId = noticeRemove.getAttribute("data-notice-remove");
        var target = notices.filter(function (item) { return item.id === noticeId; })[0];
        if (!target) return;
        if (!window.confirm("'" + target.title + "' 공지를 삭제할까요?")) return;
        notices = notices.filter(function (item) { return item.id !== noticeId; });
        persistNotices();
        addLog("공지사항 삭제", target.title);
        renderOperations();
        toast("공지사항을 삭제했습니다.");
      }
    });

    document.addEventListener("change", function (event) {
      var payment = event.target.closest("[data-payment-id]");
      if (payment) {
        updatePaymentStatus(payment.getAttribute("data-payment-id"), payment.value);
        return;
      }

      var noticeStatus = event.target.closest("[data-notice-status]");
      if (noticeStatus) {
        var noticeId = noticeStatus.getAttribute("data-notice-status");
        notices.forEach(function (item) {
          if (item.id === noticeId) item.status = noticeStatus.value;
        });
        persistNotices();
        addLog("공지 상태 변경", noticeId + " · " + noticeStatus.value);
        renderOperations();
        toast("공지 상태를 " + noticeStatus.value + "(으)로 변경했습니다.");
        return;
      }

      var inquiryStatus = event.target.closest("[data-inquiry-status]");
      if (inquiryStatus) {
        var inquiryId = inquiryStatus.getAttribute("data-inquiry-status");
        inquiries.forEach(function (item) {
          if (item.id === inquiryId) item.status = inquiryStatus.value;
        });
        persistInquiries();
        addLog("1:1 문의 상태 변경", inquiryId + " · " + inquiryStatus.value);
        renderOperations();
        renderOverview();
        toast("문의 상태를 " + inquiryStatus.value + "(으)로 변경했습니다.");
      }
    });

    document.querySelectorAll("[data-member-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.memberTab = button.getAttribute("data-member-tab");
        state.memberPage = 1;
        renderMembers();
      });
    });

    var memberSearch = document.getElementById("memberSearch");
    if (memberSearch) {
      memberSearch.addEventListener("input", function () {
        state.memberSearch = memberSearch.value;
        state.memberPage = 1;
        renderMembers();
      });
    }

    var memberStatus = document.getElementById("memberStatus");
    if (memberStatus) {
      memberStatus.addEventListener("change", function () {
        state.memberStatus = memberStatus.value;
        state.memberPage = 1;
        renderMembers();
      });
    }

    var memberPlan = document.getElementById("memberPlan");
    if (memberPlan) {
      memberPlan.addEventListener("change", function () {
        state.memberPlan = memberPlan.value;
        state.memberPage = 1;
        renderMembers();
      });
    }

    var memberForm = document.getElementById("memberForm");
    if (memberForm) memberForm.addEventListener("submit", addMemberFromForm);

    var noticeForm = document.getElementById("noticeForm");
    if (noticeForm) noticeForm.addEventListener("submit", addNoticeFromForm);

    var dataStudent = document.getElementById("dataStudent");
    if (dataStudent) {
      dataStudent.addEventListener("change", function () {
        state.dataStudent = dataStudent.value;
        renderData();
      });
    }

    document.querySelectorAll("[data-data-period]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.dataPeriod = Number(button.getAttribute("data-data-period")) || 3;
        document.querySelectorAll("[data-data-period]").forEach(function (item) {
          var on = item === button;
          item.classList.toggle("is-active", on);
          item.setAttribute("aria-pressed", on ? "true" : "false");
        });
        renderData();
      });
    });

    document.querySelectorAll("[data-billing-plan]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.billingPlan = button.getAttribute("data-billing-plan");
        state.billingPage = 1;
        document.querySelectorAll("[data-billing-plan]").forEach(function (item) {
          var on = item === button;
          item.classList.toggle("is-active", on);
          item.setAttribute("aria-pressed", on ? "true" : "false");
        });
        renderBilling();
      });
    });

    var billingMonth = document.getElementById("billingMonth");
    if (billingMonth) {
      billingMonth.addEventListener("change", function () {
        state.billingMonth = billingMonth.value;
        state.billingPage = 1;
        renderBilling();
      });
    }

    var billingStatus = document.getElementById("billingStatus");
    if (billingStatus) {
      billingStatus.addEventListener("change", function () {
        state.billingStatus = billingStatus.value;
        state.billingPage = 1;
        renderBilling();
      });
    }

    var billingSearch = document.getElementById("billingSearch");
    if (billingSearch) {
      billingSearch.addEventListener("input", function () {
        state.billingSearch = billingSearch.value;
        state.billingPage = 1;
        renderBilling();
      });
    }

    document.querySelectorAll("[data-ops-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        showOpsTab(button.getAttribute("data-ops-tab"));
      });
    });

    var noticeFilter = document.getElementById("noticeFilter");
    if (noticeFilter) noticeFilter.addEventListener("change", renderNotices);

    var inquiryFilter = document.getElementById("inquiryFilter");
    if (inquiryFilter) inquiryFilter.addEventListener("change", renderInquiries);

    var memberExport = document.getElementById("memberExport");
    if (memberExport) memberExport.addEventListener("click", exportMembers);

    var billingExport = document.getElementById("billingExport");
    if (billingExport) billingExport.addEventListener("click", exportBilling);

    var dataExport = document.getElementById("dataExport");
    if (dataExport) dataExport.addEventListener("click", exportTraining);

    var settingsForm = document.getElementById("settingsForm");
    if (settingsForm) {
      settingsForm.addEventListener("submit", function (event) {
        event.preventDefault();
        saveSettings();
      });
    }

    var settingsReset = document.getElementById("settingsReset");
    if (settingsReset) settingsReset.addEventListener("click", resetDemoData);

    var refresh = document.getElementById("overviewRefresh");
    if (refresh) {
      refresh.addEventListener("click", function () {
        trainingRecords = buildTraining(members.students);
        renderOverview();
        renderMembers();
        renderData();
        renderBilling();
        renderOperations();
        toast("최신 데모 데이터로 갱신했습니다.");
      });
    }

    var notifications = document.getElementById("adminNotifications");
    if (notifications) {
      notifications.addEventListener("click", function () {
        var unpaid = unpaidPayments().length;
        var pending = inquiries.filter(function (item) { return item.status === "답변 대기"; }).length;
        if (!unpaid && !pending) {
          toast("처리할 운영 알림이 없습니다.");
          return;
        }
        toast("미납 " + unpaid + "건, 답변 대기 문의 " + pending + "건이 있습니다.", "warn");
      });
    }

    window.addEventListener("hashchange", function () {
      var name = window.location.hash.replace("#", "");
      if (VIEW_LABEL[name]) showView(name);
    });
  }

  /* ---------------------------------------------------------------
     Boot
     --------------------------------------------------------------- */
  function init() {
    members = Store.readStore(KEYS.members, null) || seedMembers();
    ["students", "parents", "coaches", "academies"].forEach(function (type) {
      if (!Array.isArray(members[type])) members[type] = [];
      members[type].forEach(function (item) {
        if (/^01\d-/.test(String(item.phone || ""))) item.phone = "";
      });
    });

    applyLedgerToMembers();

    payments = Store.readStore(KEYS.payments, null);
    if (!Array.isArray(payments)) payments = seedPayments(members);

    notices = Store.readStore(KEYS.notices, null);
    if (!Array.isArray(notices)) notices = seedNotices();

    inquiries = Store.readStore(KEYS.inquiries, null);
    if (!Array.isArray(inquiries)) inquiries = seedInquiries();

    logs = Store.readStore(KEYS.logs, null);
    if (!Array.isArray(logs)) logs = seedLogs();

    var storedSettings = Store.readStore(KEYS.settings, null);
    settings = Object.assign(defaultSettings(), storedSettings || {});

    trainingRecords = buildTraining(members.students);
    applySettings();
    bindEvents();
    showView((window.location.hash || "#overview").slice(1));
    showOpsTab("notices");
    renderOverview();
    renderMembers();
    renderData();
    renderBilling();
    renderOperations();

    window.SportsGrowAdmin = {
      refresh: function () {
        trainingRecords = buildTraining(members.students);
        renderOverview();
        renderMembers();
        renderData();
        renderBilling();
        renderOperations();
      },
      state: state,
      getMembers: function () { return members; },
      getPayments: function () { return payments; },
      getNotices: function () { return notices; },
      getInquiries: function () { return inquiries; },
      getLogs: function () { return logs; }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
