// ── 기록/통계 모듈 ────────────────────────────────────
const HistoryUI = (() => {
  // ── 메인 렌더링 ────────────────────────────────────
  function render() {
    renderSummaryCards();
    renderChart();
    renderHistoryList();
  }

  // ── 요약 카드 ──────────────────────────────────────
  function renderSummaryCards() {
    const all = History.getAll();
    const streak = History.getStreak();
    const today = new Date().toISOString().slice(0,10);
    const thisWeek = getThisWeekDates();
    const weekRecords = all.filter(r => thisWeek.includes(r.date));
    const totalDays = new Set(all.map(r => r.date)).size;
    const totalSets = all.reduce((s, r) => s + r.completedSets, 0);

    document.getElementById('statStreak').textContent = streak;
    document.getElementById('statWeekCount').textContent = weekRecords.length;
    document.getElementById('statTotalDays').textContent = totalDays;
    document.getElementById('statTotalSets').textContent = totalSets;
  }

  function getThisWeekDates() {
    const today = new Date(); today.setHours(0,0,0,0);
    const day = today.getDay(); // 0=일
    const monday = new Date(today); monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().slice(0,10));
    }
    return dates;
  }

  // ── 주간 차트 (SVG) ────────────────────────────────
  function renderChart() {
    const mode = document.querySelector('.chart-tab.active')?.dataset.mode || 'week';
    if (mode === 'week') renderWeekChart();
    else renderMonthChart();
  }

  function renderWeekChart() {
    const all = History.getAll();
    const dates = getThisWeekDates();
    const labels = ['월','화','수','목','금','토','일'];
    const values = dates.map(d => {
      const records = all.filter(r => r.date === d);
      return records.reduce((s, r) => s + r.completedSets, 0);
    });
    drawBarChart(labels, values, '이번 주 완료 세트');
  }

  function renderMonthChart() {
    const all = History.getAll();
    const today = new Date(); today.setHours(0,0,0,0);
    const labels = [], values = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0,10);
      const records = all.filter(r => r.date === key);
      // 7일마다 레이블 표시
      labels.push(i % 7 === 0 || i === 0 ? (d.getMonth()+1)+'/'+d.getDate() : '');
      values.push(records.reduce((s, r) => s + r.completedSets, 0));
    }
    drawBarChart(labels, values, '최근 30일 완료 세트');
  }

  function drawBarChart(labels, values, title) {
    const container = document.getElementById('chartContainer');
    const max = Math.max(...values, 1);
    const W = container.clientWidth || 340, H = 160;
    const padL = 28, padR = 8, padT = 24, padB = 28;
    const barW = Math.floor((W - padL - padR) / labels.length);
    const gap = Math.max(2, Math.floor(barW * 0.2));
    const bw = barW - gap;
    const chartH = H - padT - padB;

    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
    // 타이틀
    svg += `<text x="${W/2}" y="14" text-anchor="middle" font-size="11" fill="var(--muted)">${title}</text>`;
    // Y축 선
    for (let i = 0; i <= 3; i++) {
      const y = padT + chartH - (chartH * i / 3);
      const val = Math.round(max * i / 3);
      svg += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
      if (val > 0) svg += `<text x="${padL-4}" y="${y+4}" text-anchor="end" font-size="9" fill="var(--muted)">${val}</text>`;
    }
    // 바
    values.forEach((v, i) => {
      const x = padL + i * barW + gap/2;
      const bh = Math.max(0, (v / max) * chartH);
      const y = padT + chartH - bh;
      const fill = v > 0 ? 'var(--accent)' : 'var(--surface2)';
      svg += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3" fill="${fill}" opacity="0.85"/>`;
      if (v > 0) svg += `<text x="${x + bw/2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="var(--accent)">${v}</text>`;
      if (labels[i]) svg += `<text x="${x + bw/2}" y="${H - 4}" text-anchor="middle" font-size="9" fill="var(--muted)">${labels[i]}</text>`;
    });
    svg += '</svg>';
    container.innerHTML = svg;
  }

  // ── 히스토리 목록 ──────────────────────────────────
  function renderHistoryList() {
    const list = document.getElementById('historyList');
    const all = History.getAll();

    if (!all.length) {
      list.innerHTML = '<div class="empty-state">아직 완료된 운동이 없습니다.<br>첫 운동을 시작해보세요!</div>';
      return;
    }

    // 날짜 그룹핑
    const groups = {};
    all.forEach(r => {
      if (!groups[r.date]) groups[r.date] = [];
      groups[r.date].push(r);
    });

    list.innerHTML = '';
    Object.keys(groups).sort((a,b) => b.localeCompare(a)).slice(0, 30).forEach(date => {
      const dateEl = document.createElement('div');
      dateEl.className = 'history-date-header';
      dateEl.textContent = formatDate(date);
      list.appendChild(dateEl);

      groups[date].forEach(r => {
        const item = document.createElement('div');
        item.className = 'history-item';
        const completionPct = r.totalSets > 0 ? Math.round(r.completedSets / r.totalSets * 100) : 0;
        const totalVol = r.exercises.reduce((s, e) => s + (e.volume || 0), 0);
        item.innerHTML =
          '<div class="history-item-top">' +
            '<span class="history-routine-name">' + r.routineName + '</span>' +
            '<span class="history-duration">' + r.durationMin + '분</span>' +
            '<button class="history-del-btn" title="기록 삭제">×</button>' +
          '</div>' +
          '<div class="history-item-meta">' +
            '<span>' + r.completedSets + '/' + r.totalSets + '세트</span>' +
            (totalVol > 0 ? '<span>볼륨 ' + totalVol.toLocaleString() + 'kg</span>' : '') +
            '<span class="history-pct" style="color:' + (completionPct >= 100 ? 'var(--success)' : 'var(--muted)') + '">' + completionPct + '%</span>' +
          '</div>' +
          '<div class="history-progress-bar"><div style="width:' + completionPct + '%;background:' + (completionPct >= 100 ? 'var(--success)' : 'var(--accent)') + '"></div></div>';
        item.querySelector('.history-del-btn').addEventListener('click', e => {
          e.stopPropagation();
          History.delete(r.id);
          renderHistoryList();
          renderSummaryCards();
        });
        item.onclick = () => showRecordDetail(r);
        list.appendChild(item);
      });
    });
  }

  // ── 기록 상세 ──────────────────────────────────────
  function showRecordDetail(record) {
    const sheet = document.getElementById('recordDetailSheet');
    const overlay = document.getElementById('recordDetailSheetOverlay');
    document.getElementById('detailRoutineName').textContent = record.routineName;
    document.getElementById('detailDate').textContent = formatDate(record.date) + ' · ' + record.durationMin + '분';
    const exList = document.getElementById('detailExList');
    exList.innerHTML = '';
    record.exercises.forEach(ex => {
      const item = document.createElement('div');
      item.className = 'detail-ex-item';
      const vol = ex.volume > 0 ? ex.weight + 'kg × ' + ex.reps + '회 × ' + ex.setsCompleted + '세트 = ' + ex.volume + 'kg' : ex.setsCompleted + '/' + ex.sets + '세트';
      item.innerHTML =
        '<span class="detail-ex-name">' + ex.name + '</span>' +
        '<span class="detail-ex-vol ' + (ex.setsCompleted >= ex.sets ? 'done' : '') + '">' + vol + '</span>';
      exList.appendChild(item);
    });
    overlay.classList.add('open'); sheet.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeRecordDetail() {
    document.getElementById('recordDetailSheet').classList.remove('open');
    document.getElementById('recordDetailSheetOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['일','월','화','수','목','금','토'];
    return (d.getMonth()+1) + '월 ' + d.getDate() + '일 (' + days[d.getDay()] + ')';
  }

  return { render, renderChart, closeRecordDetail };
})();
