// ── 앱 메인 ───────────────────────────────────────────
const App = (() => {
  let currentTab = 'timer';

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach((el, i) => {
      const tabs = ['timer', 'planner', 'history'];
      el.classList.toggle('active', tabs[i] === tab);
    });
    document.getElementById('timerTab').style.display   = tab === 'timer'   ? 'block' : 'none';
    document.getElementById('plannerTab').style.display = tab === 'planner' ? 'block' : 'none';
    document.getElementById('historyTab').style.display = tab === 'history' ? 'block' : 'none';

    if (tab === 'planner') { Planner.renderRoutineList(); Planner.renderTemplateList(); }
    if (tab === 'history') HistoryUI.render();
    if (tab === 'timer' && Session.resting) TimerUI.restoreProgressBar();
  }

  function init() {
    // 테마 적용
    applyTheme(Settings.theme);

    // 설정 슬라이더
    const restSlider = document.getElementById('restSlider');
    restSlider.value = Settings.restDuration;
    document.getElementById('restVal').textContent = Settings.restDuration + '초';
    restSlider.addEventListener('input', () => {
      Settings.restDuration = parseInt(restSlider.value);
      document.getElementById('restVal').textContent = Settings.restDuration + '초';
    });

    const soundToggle = document.getElementById('soundToggle');
    soundToggle.checked = Settings.soundEnabled;
    soundToggle.addEventListener('change', () => { Settings.soundEnabled = soundToggle.checked; });

    // 테마 버튼
    document.getElementById('themeDark').addEventListener('click', () => applyTheme('dark'));
    document.getElementById('themeLight').addEventListener('click', () => applyTheme('light'));

    // 세트 수 버튼
    document.querySelectorAll('.sets-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.n) === 3);
      b.addEventListener('click', () => {
        document.querySelectorAll('.sets-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });

    // 타이머 카드 탭
    document.getElementById('timerCard').addEventListener('click', Timer.handleCardTap);

    // Enter 키
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && currentTab === 'timer') Timer.handleCardTap();
    });

    // 기록 복사
    document.getElementById('midCopyBtn')?.addEventListener('click', () => copyRecord(false));
    document.getElementById('doneCopyBtn')?.addEventListener('click', () => copyRecord(true));

    // 다시 시작
    document.getElementById('resetBtn')?.addEventListener('click', resetAll);

    // 플래너 JSON 불러오기
    document.getElementById('plannerLoadBtn')?.addEventListener('click', Planner.loadPlannerJSON);

    // 루틴 에디터
    document.getElementById('saveRoutineBtn')?.addEventListener('click', Planner.saveEditRoutine);
    document.getElementById('addEditorExBtn')?.addEventListener('click', Planner.addEditorEx);
    document.getElementById('applyToSessionBtn')?.addEventListener('click', Planner.applyToSession);

    // 기록 상세 닫기
    document.getElementById('closeDetailBtn')?.addEventListener('click', HistoryUI.closeRecordDetail);
    document.getElementById('recordDetailSheetOverlay')?.addEventListener('click', HistoryUI.closeRecordDetail);

    // 루틴 에디터 닫기
    document.getElementById('closeEditorBtn')?.addEventListener('click', () => Planner.closeSheet('routineEditorSheet'));
    document.getElementById('routineEditorSheetOverlay')?.addEventListener('click', () => Planner.closeSheet('routineEditorSheet'));

    // 차트 탭 전환
    document.querySelectorAll('.chart-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        HistoryUI.renderChart();
      });
    });

    // 기본 루틴으로 세션 초기화
    const defaultTemplate = TEMPLATES[0];
    Session.init(defaultTemplate.exercises.map(e => ({...e})), defaultTemplate.name);

    // 초기 렌더
    TimerUI.render();
    TimerUI.updateClock();
    Timer.requestWakeLock();

    switchTab('timer');
  }

  function applyTheme(t) {
    Settings.theme = t;
    document.documentElement.classList.toggle('light', t === 'light');
    document.getElementById('themeDark').classList.toggle('active', t === 'dark');
    document.getElementById('themeLight').classList.toggle('active', t === 'light');
  }

  function copyRecord(isDone) {
    const record = Session.buildRecord();
    const text = JSON.stringify(record, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById(isDone ? 'doneCopyBtn' : 'midCopyBtn');
      const orig = btn.textContent;
      btn.textContent = '✓ 복사 완료';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  function resetAll() {
    const defaultTemplate = TEMPLATES[0];
    Timer.startSession(defaultTemplate.exercises.map(e => ({...e})), defaultTemplate.name);
  }

  return { switchTab, init };
})();

document.addEventListener('DOMContentLoaded', App.init);
