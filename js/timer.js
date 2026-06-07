// ── 타이머 모듈 ───────────────────────────────────────
const Timer = (() => {
  let restTimer = null;
  let elapsedTimer = null;
  let wakeLock = null;

  // ── Wake Lock ──────────────────────────────────────
  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      TimerUI.updateWakeIndicator(true);
      wakeLock.addEventListener('release', () => TimerUI.updateWakeIndicator(false));
    } catch { TimerUI.updateWakeIndicator(false); }
  }

  document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') await requestWakeLock();
  });

  // ── 오디오 ────────────────────────────────────────
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }
  function playTones(tones) {
    if (!Settings.soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      tones.forEach(([freq, start, dur]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = freq; o.type = 'sine';
        const t = ctx.currentTime + start;
        g.gain.setValueAtTime(0.4, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.1);
        o.start(t); o.stop(t + dur + 0.15);
      });
    } catch {}
  }
  function playSetComplete() { playTones([[440,0,0.08],[660,0.12,0.08]]); }
  function playExComplete()  { playTones([[330,0,0.08],[440,0.1,0.08],[550,0.2,0.08],[660,0.3,0.15]]); }
  function playRestEnd()     { playTones([[880,0,0.06],[660,0.1,0.1]]); }
  function vibrateLong()     { if (navigator.vibrate) navigator.vibrate(500); }

  // ── 응원 메시지 ────────────────────────────────────
  const CHEER_FIRST = ['탭해서 시작!','준비되면 탭!','자, 가보자!','시작해볼까요?','오늘도 화이팅!'];
  const CHEER_NEXT  = ['잘했어요! 탭!','한 세트 더!','그 기세 그대로!','멈추지 마요!','좋아, 다음!',
    '몸이 기억해요!','포기는 없다!','한 번 더 가자!','지금이 딱!','최고예요, 탭!',
    '이미 절반!','힘내요!','탭하면 끝!','조금만 더!','오늘 후회 없게!'];
  let lastCheerIdx = -1;
  function getCheer(isFirst) {
    const arr = isFirst ? CHEER_FIRST : CHEER_NEXT;
    let idx;
    do { idx = Math.floor(Math.random() * arr.length); } while (arr.length > 1 && idx === lastCheerIdx);
    lastCheerIdx = idx;
    return arr[idx];
  }

  // ── 루틴 선택 화면 ────────────────────────────────
  function showSelectView() {
    document.getElementById('selectView').style.display = 'block';
    document.getElementById('mainView').style.display = 'none';
    document.getElementById('doneView').style.display = 'none';
    _renderSelectRoutines();
    _renderSelectTemplates();
  }

  function _openPreviewSheet(name, exercises, onStart) {
    document.getElementById('previewSheetTitle').textContent = name;
    const exList = document.getElementById('previewExList');
    exList.innerHTML = '';
    exercises.forEach(ex => {
      const item = document.createElement('div');
      item.className = 'preview-ex-item';
      item.innerHTML =
        '<span class="preview-ex-name">' + ex.name + '</span>' +
        '<span class="preview-ex-sets">' + ex.sets + '세트</span>';
      exList.appendChild(item);
    });
    const startBtn = document.getElementById('previewStartBtn');
    startBtn.onclick = () => { closePreviewSheet(); onStart(); };
    document.getElementById('previewSheetOverlay').classList.add('open');
    document.getElementById('previewSheet').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function _renderSelectRoutines() {
    const list = document.getElementById('selectRoutineList');
    const routines = Routines.getAll();
    const lastId = Settings.lastRoutineId;
    list.innerHTML = '';
    routines.forEach(r => {
      const item = document.createElement('div');
      item.className = 'select-routine-item' + (r.id === lastId ? ' last-used' : '');
      const meta = r.exercises.length + '종목 · ' + r.exercises.reduce((s,e) => s+e.sets, 0) + '세트';
      item.innerHTML =
        '<div class="select-routine-info">' +
          (r.id === lastId ? '<span class="last-used-badge">최근</span>' : '') +
          '<div class="select-routine-name">' + r.name + '</div>' +
          '<div class="select-routine-meta">' + meta + '</div>' +
        '</div>' +
        '<button class="select-start-btn">시작</button>';
      item.querySelector('.select-start-btn').addEventListener('click', e => {
        e.stopPropagation();
        startSession(r.exercises, r.name, r.id);
      });
      item.onclick = () => _openPreviewSheet(r.name, r.exercises, () => startSession(r.exercises, r.name, r.id));
      list.appendChild(item);
    });
  }

  function _renderSelectTemplates() {
    const list = document.getElementById('selectTemplateList');
    const templates = Templates.list();
    list.innerHTML = '';
    templates.forEach(t => {
      const item = document.createElement('div');
      item.className = 'select-routine-item';
      item.innerHTML =
        '<div class="select-routine-info">' +
          '<div class="select-routine-name">' + t.name + '</div>' +
          '<div class="select-routine-meta">' + t.desc + '</div>' +
        '</div>' +
        '<button class="select-start-btn">시작</button>';
      item.querySelector('.select-start-btn').addEventListener('click', e => {
        e.stopPropagation();
        startSession(t.exercises, t.name);
      });
      item.onclick = () => _openPreviewSheet(t.name, t.exercises, () => startSession(t.exercises, t.name));
      list.appendChild(item);
    });
  }

  // ── 세션 시작 ──────────────────────────────────────
  function startSession(exercises, routineName, routineId = null) {
    clearInterval(restTimer);
    Session.init(exercises, routineName);
    if (routineId) Settings.lastRoutineId = routineId;
    document.getElementById('selectView').style.display = 'none';
    document.getElementById('mainView').style.display = 'block';
    document.getElementById('doneView').style.display = 'none';
    startElapsedTimer();
    requestWakeLock();
    TimerUI.render();
  }

  // ── 카드 탭 처리 ───────────────────────────────────
  function handleCardTap() {
    if (Session.resting) { skipRest(); return; }
    const ex = Session.exercises[Session.exIdx];
    if (ex && ex.setsCompleted >= ex.sets) return;
    completeSet();
  }

  function completeSet() {
    const ex = Session.exercises[Session.exIdx];
    ex.setsCompleted++;
    if (ex.setsCompleted < ex.sets) {
      playSetComplete(); vibrateLong(); startRest(false);
    } else {
      playExComplete(); vibrateLong();
      if (Session.isAllDone()) {
        TimerUI.render();
        setTimeout(() => { TimerUI.showDone(); saveRecord(); }, 400);
      } else {
        const next = Session.exercises.findIndex((e, i) => i > Session.exIdx && e.setsCompleted < e.sets);
        if (next !== -1) startRest(true, next);
        else { TimerUI.render(); setTimeout(() => { TimerUI.showDone(); saveRecord(); }, 400); }
      }
    }
  }

  function startRest(isExerciseDone, nextIdx = -1) {
    Session.resting = true;
    Session.restRemaining = Settings.restDuration;
    Session.pendingNext = nextIdx;
    TimerUI.render();
    TimerUI.startProgressBar(Settings.restDuration);
    restTimer = setInterval(() => {
      Session.restRemaining--;
      if (Session.restRemaining <= 0) {
        clearInterval(restTimer);
        Session.resting = false;
        if (Session.pendingNext !== -1) { Session.exIdx = Session.pendingNext; Session.pendingNext = -1; }
        playRestEnd(); vibrateLong(); TimerUI.render();
      } else {
        TimerUI.updateRestDisplay(Session.restRemaining);
      }
    }, 1000);
  }

  function skipRest() {
    clearInterval(restTimer);
    Session.resting = false;
    if (Session.pendingNext !== -1) { Session.exIdx = Session.pendingNext; Session.pendingNext = -1; }
    TimerUI.stopProgressBar();
    TimerUI.render();
  }

  function saveRecord() {
    const record = Session.buildRecord();
    Session._lastRecord = record; // 복사 버튼용 캐시
    History.add(record);
  }

  // ── 경과 시간 타이머 ────────────────────────────────
  function startElapsedTimer() {
    if (elapsedTimer) clearInterval(elapsedTimer);
    TimerUI.updateClock();
    elapsedTimer = setInterval(TimerUI.updateClock, 60000);
  }

  // ── 공개 API ──────────────────────────────────────
  return { startSession, showSelectView, handleCardTap, skipRest, getCheer, requestWakeLock };
})();

// ── 타이머 UI ─────────────────────────────────────────
const TimerUI = (() => {
  function render() {
    if (Session.isAllDone()) return; // done view is shown separately

    const s = Session;
    const ex = s.exercises[s.exIdx];
    if (!ex) return;

    // 종목명
    const displayEx = (s.resting && s.pendingNext !== -1) ? s.exercises[s.pendingNext] : ex;
    document.getElementById('exName').textContent = displayEx.name;

    // 경과 시간
    const elapsed = Math.round((Date.now() - s.startTime) / 60000);
    document.getElementById('exCounterElapsed').textContent = '경과 ' + elapsed + '분';

    // 진행 카운터
    const doneCount = s.exercises.filter(e => e.setsCompleted >= e.sets).length;
    document.getElementById('listProgress').textContent = doneCount + ' / ' + s.exercises.length;

    renderDots(ex);
    renderTimerCard(ex);
    renderExList();
  }

  function renderDots(ex) {
    const row = document.getElementById('setsRow');
    row.innerHTML = '';
    for (let i = 0; i < ex.sets; i++) {
      const d = document.createElement('div');
      d.className = 'set-dot' + (i < ex.setsCompleted ? ' done' : (i === ex.setsCompleted ? ' active' : ''));
      row.appendChild(d);
    }
  }

  function renderTimerCard(ex) {
    const card = document.getElementById('timerCard');
    const label = document.getElementById('timerLabel');
    const display = document.getElementById('timerDisplay');
    const prog = document.getElementById('progressWrap');
    const s = Session;

    if (s.resting) {
      card.className = 'current-ex-card';
      label.textContent = s.pendingNext !== -1 ? '종목 완료 · 탭하면 스킵' : '탭하면 스킵';
      display.textContent = s.restRemaining + '초';
      display.className = 'timer-display resting';
      prog.style.display = 'block';
    } else if (ex.setsCompleted >= ex.sets) {
      card.className = 'current-ex-card completed-card';
      label.textContent = '종목 완료';
      display.textContent = '다음 종목으로 →';
      display.className = 'timer-display completed';
      prog.style.display = 'none';
    } else {
      card.className = 'current-ex-card';
      label.textContent = Timer.getCheer(ex.setsCompleted === 0);
      display.textContent = (ex.setsCompleted + 1) + ' / ' + ex.sets;
      display.className = 'timer-display';
      prog.style.display = 'none';
    }
  }

  let exDragSrcIdx = null;
  let exTouchSrcIdx = null;
  let exDragFromHandle = false; // 핸들에서 시작된 드래그인지 여부

  document.addEventListener('touchmove', e => {
    if (exTouchSrcIdx === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    const list = document.getElementById('exList');
    if (!list) return;
    list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    const els = document.elementsFromPoint(touch.clientX, touch.clientY);
    const target = els.find(el => el.classList?.contains('ex-item') && parseInt(el.dataset.idx) !== exTouchSrcIdx);
    if (target) target.classList.add('drag-over');
  }, { passive: false });

  document.addEventListener('touchend', () => {
    if (exTouchSrcIdx === null) return;
    const list = document.getElementById('exList');
    if (!list) return;
    list.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    const overEl = list.querySelector('.drag-over');
    if (overEl) {
      const dstIdx = parseInt(overEl.dataset.idx);
      if (dstIdx !== exTouchSrcIdx) {
        const moved = Session.exercises.splice(exTouchSrcIdx, 1)[0];
        Session.exercises.splice(dstIdx, 0, moved);
        if (Session.exIdx === exTouchSrcIdx) Session.exIdx = dstIdx;
      }
    }
    exTouchSrcIdx = null;
    render();
  });

  function renderExList() {
    const list = document.getElementById('exList');
    list.innerHTML = '';
    Session.exercises.forEach((ex, i) => {
      const isDone = ex.setsCompleted >= ex.sets;
      const item = document.createElement('div');
      item.className = 'ex-item' + (i === Session.exIdx ? ' current' : '') + (isDone ? ' completed' : '');
      item.draggable = true;
      item.dataset.idx = String(i);
      item.innerHTML =
        '<span class="drag-handle ex-drag-handle">⠿</span>' +
        '<span class="ex-num">' + (i+1) + '</span>' +
        '<span class="ex-name-item">' + ex.name + '</span>' +
        '<span class="ex-prog">' + (isDone ? '✓' : (ex.setsCompleted + 1) + ' / ' + ex.sets) + '</span>' +
        '<button class="yt-btn" title="YouTube에서 검색">' +
        '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000"/>' +
        '<polygon points="10,8.5 16,12 10,15.5" fill="#fff"/>' +
        '</svg></button>';

      item.querySelector('.yt-btn').addEventListener('click', e => {
        e.stopPropagation();
        window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(ex.name), '_blank');
      });
      item.onclick = () => { Session.exIdx = i; render(); };

      const handle = item.querySelector('.ex-drag-handle');
      // 핸들 mousedown → 플래그 ON, 그 외 mousedown → 플래그 OFF
      handle.addEventListener('mousedown', () => { exDragFromHandle = true; });
      item.addEventListener('mousedown', e => { if (!e.target.closest('.ex-drag-handle')) exDragFromHandle = false; });

      item.addEventListener('dragstart', e => {
        if (!exDragFromHandle) { e.preventDefault(); return; }
        exDragFromHandle = false;
        exDragSrcIdx = i; e.dataTransfer.effectAllowed = 'move';
        requestAnimationFrame(() => item.classList.add('dragging'));
      });
      item.addEventListener('dragend', () => {
        exDragFromHandle = false;
        item.classList.remove('dragging');
        list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        item.classList.add('drag-over');
      });
      item.addEventListener('drop', e => {
        e.preventDefault();
        if (exDragSrcIdx === null || exDragSrcIdx === i) return;
        const moved = Session.exercises.splice(exDragSrcIdx, 1)[0];
        Session.exercises.splice(i, 0, moved);
        if (Session.exIdx === exDragSrcIdx) Session.exIdx = i;
        exDragSrcIdx = null; render();
      });

      // 모바일: 핸들 touchstart → 터치 드래그 활성
      handle.addEventListener('touchstart', e => {
        exTouchSrcIdx = i; item.classList.add('dragging'); e.preventDefault();
      }, { passive: false });

      list.appendChild(item);
    });
  }

  function showDone() {
    document.getElementById('mainView').style.display = 'none';
    document.getElementById('doneView').style.display = 'block';
    const s = Session;
    const elapsed = Math.round((Date.now() - s.startTime) / 60000);
    const totalSets = s.exercises.reduce((sum, e) => sum + e.sets, 0);
    document.getElementById('doneSub').textContent =
      s.exercises.length + '종목 ' + totalSets + '세트 · ' + elapsed + '분';
    // 스트릭 업데이트
    const streak = History.getStreak();
    const streakEl = document.getElementById('doneStreak');
    if (streakEl) streakEl.textContent = streak > 0 ? '🔥 ' + streak + '일 연속 운동!' : '';
  }

  function startProgressBar(duration) {
    const bar = document.getElementById('progressBar');
    if (!bar) return;
    bar.style.transition = 'none'; bar.style.width = '100%';
    setTimeout(() => { bar.style.transition = 'width ' + duration + 's linear'; bar.style.width = '0%'; }, 60);
  }

  function stopProgressBar() {
    const bar = document.getElementById('progressBar');
    if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; }
  }

  function updateRestDisplay(remaining) {
    const el = document.getElementById('timerDisplay');
    if (el) el.textContent = remaining + '초';
  }

  function updateClock() {
    const nowEl = document.getElementById('wakeNow');
    if (!nowEl) return;
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const days = ['일','월','화','수','목','금','토'];
    nowEl.textContent = pad(now.getMonth()+1)+'/'+pad(now.getDate())+'('+days[now.getDay()]+') '+pad(now.getHours())+':'+pad(now.getMinutes());
  }

  function updateWakeIndicator(active) {
    document.getElementById('wakeDot').className = 'wake-dot' + (active ? ' active' : '');
    document.getElementById('wakeLabel').textContent = active ? '화면 유지 중' : '화면 유지 비활성';
  }

  function restoreProgressBar() {
    const bar = document.getElementById('progressBar');
    if (!bar || !Session.resting) return;
    const ratio = Session.restRemaining / Settings.restDuration;
    bar.style.transition = 'none';
    bar.style.width = (ratio * 100) + '%';
    setTimeout(() => {
      bar.style.transition = 'width ' + Session.restRemaining + 's linear';
      bar.style.width = '0%';
    }, 60);
  }

  return { render, showDone, startProgressBar, stopProgressBar, updateRestDisplay, updateClock, updateWakeIndicator, restoreProgressBar };
})();
