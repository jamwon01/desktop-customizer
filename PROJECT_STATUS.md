# 프로젝트 상태 문서 (PROJECT_STATUS)

> **마지막 업데이트: 2026-11-24 (macOS 테마 + Fluent Emoji 반영)**
> 이 문서는 대화 컨텍스트가 끊겨도 작업을 이어갈 수 있도록 프로젝트 전체 상태를 기록한다.
> 새 기능 작업/커밋 시 이 문서도 함께 최신화할 것.

## 1. 프로젝트 목적

내가 좋아하는 캐릭터들로 바탕화면을 꾸미는 **인터랙티브 데스크탑 커스터마이저**.
자주 쓰는 바로가기/폴더를 커스텀 캐릭터 아이콘으로 바꾸고, hover하면 캐릭터가
반응(애니메이션·표정 변화)하는 것이 핵심 가치.

- 사용 대상: 개인용 → 완성 후 친구/지인 배포
- 플랫폼: Windows 10/11
- 철학: 첫 실행하면 곧바로 꾸며진 데스크탑을 경험하게 (진입장벽 0)

## 2. 핵심 아키텍처 (꼭 기억할 것)

**커스텀 레이어 방식**: Windows 실제 바탕화면 아이콘을 건드리지 않고,
Electron 투명 프레임리스 풀스크린 윈도우가 바탕화면 위에 얹혀서
배경 + 커스텀 아이콘을 렌더링.

- 빈 영역 클릭 통과: `setIgnoreMouseEvents(true, {forward:true})` +
  렌더러에서 `elementFromPoint`로 interactive 요소 판정 ([renderer.js](src/renderer/renderer.js) 하단)
- Win+Tab/Alt+Tab 제외: `BrowserWindow({ type: 'toolbar' })` (WS_EX_TOOLWINDOW)
- hover 애니메이션: CSS (`body:not(.edit-mode) .icon:hover` — 편집 모드에선 꺼짐)

## 3. 기술 스택

- **Electron 45** + 순수 HTML/CSS/JS (프레임워크 없음, 필요 시 Vue 검토)
- 설정: `%APPDATA%/desktop-customizer/config.json` (userData)
- 빌드/실행: `npm start` (electron .)
- 배포(예정): electron-builder (NSIS)

## 4. 파일 구조

```
src/
├── main/main.js       # 윈도우 생성, 트레이, IPC 전부 (단일 파일)
├── preload.js         # contextBridge (customizer.* API)
└── renderer/
    ├── index.html     # 레이어 + 모달들 + 온보딩 + 드로어 + Dock
    ├── renderer.js    # 아이콘 렌더링/이벤트 전부 (단일 파일, ~1200줄)
    ├── style.css      # 기본 + body.theme-macos 테마 스타일
    └── assets/emoji/  # Fluent Emoji 3D PNG 19종 (MIT, 앱 내장)
docs/
└── MACOS_THEME_SPEC.md  # macOS 테마 정밀 분석 스펙
PLANNING.md            # 기획서 (로드맵, 기능 명세)
PROJECT_STATUS.md      # 이 문서
```

config.json 아이콘 스키마:
```json
{ "id", "type": "icon"|"group", "name", "image"(파일경로)|"iconData"(dataURL)|"emoji",
  "target", "targetType": "exe"|"folder"|"url", "x", "y", "size", "rotation",
  "items": []  // group일 때만, 내부 아이콘 배열
}
```

## 5. 완료된 기능 (v0.4 + 편집 보강, 커밋 e95ae5d)

### 기본 런처
- [x] 투명 레이어 + 클릭 통과 + Win+Tab 제외
- [x] 아이콘 등록: 트레이/메뉴 다이얼로그, **드래그앤드롭** (.lnk/.exe/폴더 →
      시스템 아이콘 자동 추출 `app.getFileIcon`, 이미지 파일 → 이미지 아이콘)
- [x] 클릭 실행 (exe/폴더/URL), hover bounce 애니메이션
- [x] 폴더 그룹(드로어): 클릭 펼침, 드래그 흡수, ↩ 꺼내기, 삭제 시 아이콘 복원

### 편집
- [x] 편집 모드: F2 전역 단축키(설정에서 F1~F12 변경 가능) + 우클릭 컨텍스트 메뉴
- [x] 드래그 배치, 다중 선택(Ctrl+클릭) + 일괄 이동, Delete 삭제, Esc 해제
- [x] 리사이즈 핸들(초록), 회전 핸들(노랑, 증분 방식 + 15° 스냅 + 회전 커서)
- [x] 우클릭 편집 모달 (이름/이미지/대상/크기/회전/삭제)
- [x] 그리드 정렬, 아이콘 전체 삭제(확인창), 이미지 256px 자동 리사이즈

### 온보딩/꾸미기
- [x] 온보딩: 바탕화면 스캔 → 체크리스트 선택 가져오기 → 자동 그리드 배치,
      미선택 아이콘은 '나머지 아이콘' 그룹 수거, 기본 그라데이션 배경
- [x] 배경: 레이어 내 렌더링 (이미지/그라데이션, Windows 원본 배경 무손상)

### macOS 테마 (v0.5 앞단계, 완료)
- [x] 테마 시스템: config.theme ('default'|'macos') + body.theme-macos 클래스
- [x] 리스킨: SVG 스퀘클(n=5) 마스크 타일, vibrancy 메뉴/모달(blur+saturate), 라벨 11px
- [x] 배경 프리셋 4종 (Horizon/Sequoia/Mojave/Dark Aurora, 흐름 애니메이션)
- [x] Dock: 하단 고정 유리 바, 가우시안 마그니피케이션(scale+translateX 전부 GPU
      transform — width 변경은 떨림 유발하므로 금지; 바는 고정, 아이콘이 위로 관통),
      도킹(하단 드래그)/꺼내기(위로 드래그), 툴팁, 휴지통(shell:RecycleBinFolder)
- [x] macOS 테마 아이콘 70% 표시 배율 + Dock 영역(하단 110px) 침입 방지
- [x] Fluent Emoji 3D (microsoft/fluentui-emoji, MIT) 19종 내장 — Segoe 이모지 대체,
      emojiNode() 헬퍼로 일괄 렌더링 (모든 이모지 표시 지점에서 사용할 것!)

### Dock 마그니피케이션 교훈 (중요)
- 아이콘 width를 매 프레임 바꾸면 reflow + backdrop-filter 재계산 + 위치 계산
  어긋남으로 떨림 발생 → **transform만 사용**할 것
- 바 크기는 고정(원본 macOS도 아이콘이 글래스를 관통함), 확대분 절반 보정으로
  커서 중심 대칭 퍼짐

## 6. 남은 작업

### macOS 테마 잔여 (선택)
- [ ] 상단 메뉴바(시계 포함) — 사용자 확인 대기 (실감 기여 큼, 추천)
- [ ] macOS식 우측 열 그리드 정렬 옵션

### v0.5 — 캐릭터가 살아 움직이는 느낌 (핵심 비전)
- [ ] idle/hover 이미지 분리 (`idleImage`/`hoverImage` 필드, 표정 변화)
      ※ 기존 `image` 필드와의 마이그레이션 설계 필요
- [ ] idle 주기적 움직임 (저부하), hover 말풍선/대사, 효과음
- [ ] 이미지 가이드라인 문서 (투명 PNG, idle/hover 세트 제작법)
- ※ 테스트용 준비물: 같은 캐릭터 표정 다른 이미지 2장 (투명 PNG)

### v1.0 — 배포 준비
- [ ] 테마(프로필) 저장/전환, Windows 자동 시작, 다중 모니터
- [ ] 전체화면 게임 감지 시 렌더링 일시정지, 앱 내 사용자 가이드 + README
- [ ] electron-builder 인스톨러

### 보류
- 위젯(시계/달력 — 메뉴바 시계와 별개), Windows 아이콘 숨김 원클릭 토글

## 7. 알려진 이슈 / 참고

- F2 전역 단축키가 탐색기 '이름바꾸기'와 겹침 → 설정 모달에서 변경 가능하게 해둠
- renderer.js/main.js가 단일 파일로 커짐 → v0.5 진입 전 모듈 분리 고려
- 첫 실행 온보딩은 config.json이 없을 때만 자동 실행 (우클릭 메뉴에서 재실행 가능)

## 8. 개발 환경 / 명령어

- Windows 10, Node 24, npm 11, Git Bash
- 실행: `npm start` / 종료: 트레이 메뉴 또는 `taskkill //IM electron.exe //F`
- 원격: https://github.com/jamwon01/desktop-customizer.git (main 브랜치)

## 9. 다음 세션 시작 방법

1. 이 문서 + PLANNING.md 읽기
2. `git log --oneline`으로 최근 커밋 확인
3. v0.5(idle/hover 이미지)부터 진행하는 게 기본 계획 — 사용자와 확인 후 시작
