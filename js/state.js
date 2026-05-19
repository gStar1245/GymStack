// ── 상수 ──────────────────────────────────────────────
const TEMPLATES = [
  { name: "전신 덤벨", desc: "7종목 · 하체→가슴→등→어깨→팔",
    exercises: [
      { name: "덤벨 스쿼트", sets: 3 }, { name: "덤벨 런지", sets: 3 },
      { name: "덤벨 데드리프트", sets: 3 }, { name: "플로어 프레스", sets: 3 },
      { name: "원암 덤벨 로우", sets: 3 }, { name: "숄더 프레스", sets: 3 },
      { name: "레터럴 레이즈", sets: 3 }
    ]},
  { name: "상체 덤벨", desc: "6종목 · 가슴→등→어깨→팔",
    exercises: [
      { name: "플로어 프레스", sets: 3 }, { name: "플로어 프레스 (모아서)", sets: 3 },
      { name: "원암 덤벨 로우", sets: 3 }, { name: "숄더 프레스", sets: 3 },
      { name: "레터럴 레이즈", sets: 3 }, { name: "이두 컬", sets: 3 }
    ]},
  { name: "하체 덤벨", desc: "5종목 · 대퇴→둔근→햄스트링",
    exercises: [
      { name: "덤벨 스쿼트", sets: 3 }, { name: "덤벨 런지", sets: 3 },
      { name: "덤벨 데드리프트", sets: 3 }, { name: "덤벨 힙 쓰러스트", sets: 3 },
      { name: "덤벨 카프 레이즈", sets: 3 }
    ]},
  { name: "어깨·팔", desc: "5종목 · 어깨→이두→삼두",
    exercises: [
      { name: "숄더 프레스", sets: 3 }, { name: "레터럴 레이즈", sets: 3 },
      { name: "프론트 레이즈", sets: 3 }, { name: "이두 컬", sets: 3 },
      { name: "해머 컬", sets: 3 }
    ]},
  { name: "맨몸 전신", desc: "6종목 · 도구 없이",
    exercises: [
      { name: "푸시업", sets: 3 }, { name: "와이드 푸시업", sets: 3 },
      { name: "딥스", sets: 3 }, { name: "스쿼트", sets: 3 },
      { name: "런지", sets: 3 }, { name: "플랭크", sets: 2 }
    ]},
];

// ── LocalStorage 헬퍼 ──────────────────────────────────
function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── 설정 ──────────────────────────────────────────────
const Settings = {
  get theme() { return lsGet('v2_theme', 'dark'); },
  set theme(v) { lsSet('v2_theme', v); },
  get restDuration() { return lsGet('v2_rest', 60); },
  set restDuration(v) { lsSet('v2_rest', v); },
  get soundEnabled() { return lsGet('v2_sound', true); },
  set soundEnabled(v) { lsSet('v2_sound', v); },
};

// ── 루틴 저장소 ───────────────────────────────────────
const Routines = {
  _key: 'v2_routines',
  getAll() { return lsGet(this._key, []); },
  save(routine) {
    // routine: { id, name, exercises: [{name, sets}], updatedAt }
    const list = this.getAll();
    const idx = list.findIndex(r => r.id === routine.id);
    if (idx >= 0) list[idx] = routine; else list.unshift(routine);
    lsSet(this._key, list);
  },
  delete(id) {
    const list = this.getAll().filter(r => r.id !== id);
    lsSet(this._key, list);
  },
  genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
};

// ── 운동 기록 저장소 ───────────────────────────────────
const History = {
  _key: 'v2_history',
  getAll() { return lsGet(this._key, []); },
  add(record) {
    // record: { id, date, routineName, exercises:[{name,sets,setsCompleted,weight,reps}], durationMin, totalSets, completedSets }
    const list = this.getAll();
    list.unshift(record);
    if (list.length > 365) list.length = 365; // 최대 1년치
    lsSet(this._key, list);
  },
  delete(id) {
    lsSet(this._key, this.getAll().filter(r => r.id !== id));
  },
  getStreak() {
    const list = this.getAll();
    if (!list.length) return 0;
    const today = new Date(); today.setHours(0,0,0,0);
    let streak = 0, d = new Date(today);
    const dates = new Set(list.map(r => r.date));
    while (true) {
      const key = d.toISOString().slice(0,10);
      if (!dates.has(key)) {
        // 오늘이 없으면 어제부터 세기
        if (streak === 0 && d.getTime() === today.getTime()) { d.setDate(d.getDate()-1); continue; }
        break;
      }
      streak++;
      d.setDate(d.getDate()-1);
    }
    return streak;
  },
};

// ── 현재 세션 상태 ─────────────────────────────────────
const Session = {
  exercises: [],       // [{name, sets, setsCompleted, weight, reps}]
  routineName: '',
  exIdx: 0,
  resting: false,
  restRemaining: 0,
  pendingNext: -1,
  startTime: 0,
  startDateTime: '',

  init(exercises, routineName) {
    this.exercises = exercises.map(e => ({
      name: e.name,
      sets: e.sets,
      setsCompleted: 0,
      weight: e.weight || 0,
      reps: e.reps || 0,
    }));
    this.routineName = routineName;
    this.exIdx = 0;
    this.resting = false;
    this.restRemaining = 0;
    this.pendingNext = -1;
    this.startTime = Date.now();
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    this.startDateTime = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())
      +' '+pad(now.getHours())+':'+pad(now.getMinutes())+':'+pad(now.getSeconds());
  },

  isAllDone() {
    return this.exercises.length > 0 && this.exercises.every(e => e.setsCompleted >= e.sets);
  },

  buildRecord() {
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const date = now.toISOString().slice(0,10);
    const durationMin = Math.round((Date.now() - this.startTime) / 60000);
    const totalSets = this.exercises.reduce((s, e) => s + e.sets, 0);
    const completedSets = this.exercises.reduce((s, e) => s + Math.min(e.setsCompleted, e.sets), 0);
    return {
      id: Date.now().toString(36),
      date,
      routineName: this.routineName,
      exercises: this.exercises.map(e => ({
        name: e.name, sets: e.sets,
        setsCompleted: e.setsCompleted,
        weight: e.weight, reps: e.reps,
        volume: e.weight > 0 ? e.weight * e.reps * Math.min(e.setsCompleted, e.sets) : 0,
      })),
      durationMin,
      totalSets,
      completedSets,
    };
  },
};
