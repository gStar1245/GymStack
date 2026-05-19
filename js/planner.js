// ── 플래너 모듈 ───────────────────────────────────────
const Planner = (() => {
  let editRoutine = null; // 현재 편집 중인 루틴
  let dragSrcIdx = null;
  let touchSrcIdx = null;

  // ── 터치 드래그 (문서 레벨, 1회만 등록) ──────────────
  document.addEventListener('touchmove', e => {
    if (touchSrcIdx === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    const list = document.getElementById('editorExList');
    if (!list) return;
    list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    const els = document.elementsFromPoint(touch.clientX, touch.clientY);
    const target = els.find(el => el.classList?.contains('editor-ex-item') && parseInt(el.dataset.idx) !== touchSrcIdx);
    if (target) target.classList.add('drag-over');
  }, { passive: false });

  document.addEventListener('touchend', () => {
    if (touchSrcIdx === null) return;
    const list = document.getElementById('editorExList');
    if (!list) return;
    list.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    const overEl = list.querySelector('.drag-over');
    if (overEl) {
      const dstIdx = parseInt(overEl.dataset.idx);
      if (dstIdx !== touchSrcIdx) {
        const moved = editRoutine.exercises.splice(touchSrcIdx, 1)[0];
        editRoutine.exercises.splice(dstIdx, 0, moved);
      }
    }
    touchSrcIdx = null;
    renderEditorExList();
  });

  // ── 루틴 목록 렌더링 ────────────────────────────────
  function renderRoutineList() {
    const list = document.getElementById('routineList');
    list.innerHTML = '';
    const routines = Routines.getAll();
    if (!routines.length) {
      list.innerHTML = '<div class="empty-state">저장된 루틴이 없습니다.<br>템플릿을 선택하거나 새로 만들어보세요.</div>';
      return;
    }
    routines.forEach(r => {
      const item = document.createElement('div');
      item.className = 'routine-item';
      const exCount = r.exercises.length;
      const setCount = r.exercises.reduce((s, e) => s + e.sets, 0);
      item.innerHTML =
        '<div class="routine-info">' +
          '<div class="routine-name">' + r.name + '</div>' +
          '<div class="routine-meta">' + exCount + '종목 · ' + setCount + '세트</div>' +
        '</div>' +
        '<div class="routine-actions">' +
          '<button class="routine-start-btn" data-id="' + r.id + '">시작</button>' +
          '<button class="routine-edit-btn" data-id="' + r.id + '"><svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354z"/></svg></button>' +
          '<button class="routine-del-btn" data-id="' + r.id + '">×</button>' +
        '</div>';
      item.querySelector('.routine-start-btn').onclick = () => startRoutine(r.id);
      item.querySelector('.routine-edit-btn').onclick = () => openRoutineEditor(r.id);
      item.querySelector('.routine-del-btn').onclick = () => {
        if (confirm('"' + r.name + '" 루틴을 삭제할까요?')) {
          Routines.delete(r.id); renderRoutineList();
        }
      };
      list.appendChild(item);
    });
  }

  // ── 템플릿 목록 렌더링 ──────────────────────────────
  function renderTemplateList() {
    const list = document.getElementById('tplPickList');
    list.innerHTML = '';
    TEMPLATES.forEach(t => {
      const item = document.createElement('div');
      item.className = 'tpl-pick-item';
      item.innerHTML =
        '<div><div class="tpl-name">' + t.name + '</div><div class="tpl-desc">' + t.desc + '</div></div>' +
        '<button class="tpl-use-btn">사용</button>';
      item.querySelector('.tpl-use-btn').onclick = () => {
        openRoutineEditor(null, {
          name: t.name, exercises: t.exercises.map(e => ({ ...e }))
        });
      };
      list.appendChild(item);
    });
  }

  // ── 루틴 시작 ──────────────────────────────────────
  function startRoutine(id) {
    const r = Routines.getAll().find(r => r.id === id);
    if (!r) return;
    Timer.startSession(r.exercises, r.name);
    App.switchTab('timer');
  }

  let isSessionEdit = false; // 타이머 탭에서 열었는지 여부

  // ── 루틴 에디터 열기 ────────────────────────────────
  function openRoutineEditor(id = null, preset = null, fromTimer = false) {
    isSessionEdit = fromTimer;
    if (id) {
      editRoutine = JSON.parse(JSON.stringify(Routines.getAll().find(r => r.id === id)));
    } else if (preset) {
      editRoutine = { id: Routines.genId(), name: preset.name, exercises: preset.exercises.map(e => ({ name: e.name, sets: e.sets || 3 })) };
    } else {
      editRoutine = { id: Routines.genId(), name: '', exercises: [] };
    }
    document.getElementById('editorRoutineName').value = editRoutine.name;
    document.getElementById('applyToSessionBtn').style.display = fromTimer ? 'block' : 'none';
    document.querySelector('#routineEditorSheet .sheet-title').textContent = fromTimer ? '현재 운동 편집' : '루틴 편집';
    renderEditorExList();
    openSheet('routineEditorSheet');
  }

  function renderEditorExList() {
    const list = document.getElementById('editorExList');
    list.innerHTML = '';
    editRoutine.exercises.forEach((ex, i) => {
      const item = document.createElement('div');
      item.className = 'editor-ex-item';
      item.draggable = true;
      item.dataset.idx = String(i);
      item.innerHTML =
        '<span class="drag-handle" title="드래그하여 순서 변경">⠿</span>' +
        '<span class="editor-ex-num">' + (i+1) + '</span>' +
        '<input class="editor-ex-name" type="text" value="' + ex.name + '" placeholder="종목명">' +
        '<div class="sets-stepper">' +
          '<button class="sets-step-btn" data-dir="-1">▼</button>' +
          '<span class="sets-step-val">' + ex.sets + '</span>' +
          '<button class="sets-step-btn" data-dir="1">▲</button>' +
        '</div>' +
        '<button class="sheet-del-btn">×</button>';

      const nameInput = item.querySelector('.editor-ex-name');
      nameInput.oninput = () => { editRoutine.exercises[i].name = nameInput.value; };
      item.querySelectorAll('.sets-step-btn').forEach(btn => {
        btn.onclick = () => {
          const dir = parseInt(btn.dataset.dir);
          editRoutine.exercises[i].sets = Math.max(1, Math.min(10, editRoutine.exercises[i].sets + dir));
          item.querySelector('.sets-step-val').textContent = editRoutine.exercises[i].sets;
        };
      });
      item.querySelector('.sheet-del-btn').onclick = () => { editRoutine.exercises.splice(i, 1); renderEditorExList(); };

      // ── 데스크탑 드래그 ──
      item.addEventListener('dragstart', e => {
        dragSrcIdx = i;
        e.dataTransfer.effectAllowed = 'move';
        requestAnimationFrame(() => item.classList.add('dragging'));
      });
      item.addEventListener('dragend', () => {
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
        if (dragSrcIdx === null || dragSrcIdx === i) return;
        const moved = editRoutine.exercises.splice(dragSrcIdx, 1)[0];
        editRoutine.exercises.splice(i, 0, moved);
        dragSrcIdx = null;
        renderEditorExList();
      });

      // ── 모바일 터치 드래그 핸들 ──
      item.querySelector('.drag-handle').addEventListener('touchstart', e => {
        touchSrcIdx = i;
        item.classList.add('dragging');
        e.preventDefault();
      }, { passive: false });

      list.appendChild(item);
    });
  }

  function saveEditRoutine() {
    const name = document.getElementById('editorRoutineName').value.trim();
    if (!name) { alert('루틴 이름을 입력해주세요.'); return; }
    const exs = editRoutine.exercises.filter(e => e.name.trim() !== '');
    if (!exs.length) { alert('종목을 1개 이상 입력해주세요.'); return; }
    editRoutine.name = name;
    editRoutine.exercises = exs;
    editRoutine.updatedAt = new Date().toISOString().slice(0,10);
    Routines.save(editRoutine);
    closeSheet('routineEditorSheet');
    renderRoutineList();
  }

  function addEditorEx() {
    editRoutine.exercises.push({ name: '', sets: 3 });
    renderEditorExList();
    const inputs = document.querySelectorAll('.editor-ex-name');
    if (inputs.length) inputs[inputs.length-1].focus();
  }

  // ── JSON 플래너 불러오기 ────────────────────────────
  function loadPlannerJSON() {
    const raw = document.getElementById('plannerInput').value.trim();
    const msg = document.getElementById('plannerMsg');
    msg.textContent = ''; msg.className = 'planner-msg';
    if (!raw) { msg.textContent = 'JSON을 붙여넣어 주세요.'; msg.className = 'planner-msg err'; return; }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { msg.textContent = '올바른 JSON 형식이 아닙니다.'; msg.className = 'planner-msg err'; return; }
    if (!Array.isArray(parsed.exercises) || !parsed.exercises.length) {
      msg.textContent = 'exercises 항목이 없거나 비어 있습니다.'; msg.className = 'planner-msg err'; return;
    }
    const exs = parsed.exercises
      .map(e => ({ name: (e.name || '').trim(), sets: parseInt(e.sets) || 3 }))
      .filter(e => e.name !== '');
    if (!exs.length) { msg.textContent = '유효한 종목명이 없습니다.'; msg.className = 'planner-msg err'; return; }
    openRoutineEditor(null, { name: parsed.label || '플래너', exercises: exs });
    document.getElementById('plannerInput').value = '';
    msg.textContent = '✓ ' + exs.length + '개 종목 불러오기 완료. 에디터에서 확인 후 저장하세요.';
    msg.className = 'planner-msg ok';
  }

  // ── 바텀시트 헬퍼 ──────────────────────────────────
  function openSheet(id) {
    document.getElementById(id + 'Overlay').classList.add('open');
    document.getElementById(id).classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeSheet(id) {
    document.getElementById(id + 'Overlay').classList.remove('open');
    document.getElementById(id).classList.remove('open');
    document.body.style.overflow = '';
  }

  function applyToSession() {
    const name = document.getElementById('editorRoutineName').value.trim() || Session.routineName;
    const exs = editRoutine.exercises.filter(e => e.name.trim() !== '');
    if (!exs.length) { alert('종목을 1개 이상 입력해주세요.'); return; }
    Timer.startSession(exs, name);
    closeSheet('routineEditorSheet');
  }

  return {
    renderRoutineList, renderTemplateList,
    openRoutineEditor, saveEditRoutine, addEditorEx, applyToSession,
    loadPlannerJSON,
    openSheet, closeSheet,
  };
})();
