# GymStack V2

홈 덤벨 운동을 위한 모바일 웹 타이머.
외부 의존성 없음.

🔗 https://gstar1245.github.io/GymStack

---

## 기능

**타이머**
- 세트 완료 탭(또는 Enter) → 자동 휴식 카운트다운
- 종목별 세트 수 개별 설정
- 무게 / 반복 수 입력
- 휴식 시간 조절 (슬라이더)
- Wake Lock 화면 꺼짐 방지
- 완료음 / 진동 알림 (소리 ON/OFF)
- 응원 메시지 랜덤 출력

**플래너**
- 루틴 저장 / 불러오기 / 삭제
- 종목 순서 변경 / 추가 / 삭제
- 템플릿 5종: 전신 덤벨 / 상체 덤벨 / 하체 덤벨 / 어깨·팔 / 맨몸 전신
- Claude AI 루틴 생성 (API 키 필요)
- JSON 불러오기
- YouTube 검색 연동 (종목명 옆 버튼 → 새 탭)

**기록**
- 운동 완료 이력 자동 저장 (localStorage)
- 주간 / 월간 차트 (SVG)
- 연속 운동일 / 통계 카드
- 기록 상세 조회

**설정**
- 휴식 시간 조절
- 소리 ON/OFF
- 다크 / 라이트 테마
- Claude API 키 입력

---

## 구조

```
GymStack/
├── index.html
├── style.css
└── js/
    ├── state.js    — 상태, 설정, 루틴, 기록 저장
    ├── timer.js    — 타이머 로직 + UI
    ├── planner.js  — 플래너 + AI 루틴 생성
    ├── history.js  — 기록 탭 + 차트
    └── app.js      — 앱 진입점
```

- 배포: GitHub Pages
