# Apps Script 순위표 웹앱 (보관용)

이 폴더는 **Google Apps Script 순위표 웹앱** 소스 백업·디자인 작업용입니다.  
음운대좀비 **게임 본체**(루트의 `index.html` / `game.js` / `style.css` / `data.js`)와는 분리되어 있습니다.

## 포함 파일

| 파일 | Apps Script 에디터 대응 |
|------|-------------------------|
| `Code.gs` | 프로젝트의 `.gs` 스크립트 (doPost / doGet / getRankingData 등) |
| `index.html` | 웹앱 HTML (HtmlService로 서빙하는 파일) |

## GitHub Pages와의 관계

- 본 게임 배포는 **저장소 루트**의 `index.html`을 사용합니다.
- 이 폴더는 Pages에서 게임을 열 때 **로드되지 않습니다**.
- `…/apps-script-ranking/` 경로를 직접 열면 HTML이 보일 수 있으나, `google.script.run`은 **Apps Script 웹앱에서만** 동작합니다. 순위표 확인은 GAS 배포 URL을 사용하세요.

## 동기화 방법

1. [script.google.com](https://script.google.com)에서 현재 정상 작동 중인 프로젝트 열기
2. `Code.gs` / HTML 파일 내용을 이 폴더의 동명 파일에 붙여넣기 (또는 clasp pull)
3. 이후 순위표 **디자인 작업**은 이 폴더의 `index.html`을 기준으로 수정한 뒤, GAS 에디터에 다시 반영

## 주의

- **doPost(점수 제출·시트 저장)** 로직은 실제 게임이 사용 중이므로, 보관·디자인 작업 시 함부로 바꾸지 마세요.
- 게임 본체 파일은 이 폴더 작업과 무관하게 수정하지 않는 것을 권장합니다.
