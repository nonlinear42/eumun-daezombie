function doPost(e) {
  try {
    const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName('스코어보드');

    if (!sheet) {
      throw new Error('스코어보드 시트를 찾을 수 없습니다.');
    }

    const data = JSON.parse(e.postData.contents || '{}');

    // TEST 모드 제출 차단
    if (data.testMode === true) {
      return jsonResponse({
        ok: false,
        error: 'TEST_MODE_NOT_ALLOWED'
      });
    }

    const name = String(data.name || '').trim();
    const score = Number(data.score);
    const result = String(data.result || '');
    const wave = Number(data.wave);
    const kills = Number(data.kills);
    const bossEntered = data.bossEntered === true;
    const bossDamage = Number(data.bossDamage);
    const bossRemainingHp = Number(data.bossRemainingHp);
    const playTime = Number(data.playTime);

    // 기본 검증
    if (!name) {
      throw new Error('이름이 비어 있습니다.');
    }

    if (!Number.isFinite(score) || score < 0) {
      throw new Error('잘못된 점수입니다.');
    }

    if (!Number.isInteger(wave) || wave < 1 || wave > 9) {
      throw new Error('잘못된 Wave 값입니다.');
    }

    if (!Number.isInteger(kills) || kills < 0) {
      throw new Error('잘못된 처치 수입니다.');
    }

    if (
      !Number.isFinite(bossDamage) ||
      bossDamage < 0 ||
      bossDamage > 32000
    ) {
      throw new Error('잘못된 보스 피해량입니다.');
    }

    if (
      !Number.isFinite(bossRemainingHp) ||
      bossRemainingHp < 0 ||
      bossRemainingHp > 32000
    ) {
      throw new Error('잘못된 보스 남은 HP입니다.');
    }

    if (!bossEntered && bossDamage > 0) {
      throw new Error(
        '보스 미진입 상태에서 피해량이 기록되었습니다.'
      );
    }

    if (wave < 9 && bossDamage > 0) {
      throw new Error(
        'Wave 9 이전에 보스 피해량이 기록되었습니다.'
      );
    }

    // 허용되는 결과 값
    const allowedResults = [
      'clear',
      'gameover',
      'quit'
    ];

    if (!allowedResults.includes(result)) {
      throw new Error('잘못된 결과 값입니다.');
    }

    if (!Number.isFinite(playTime) || playTime < 0) {
      throw new Error('잘못된 플레이 시간입니다.');
    }

    // 보스 미진입이면 남은 HP는 0으로 저장
    const savedBossRemainingHp = bossEntered
      ? Math.round(bossRemainingHp)
      : 0;

    // 스프레드시트 저장
    sheet.appendRow([
      new Date(),
      name,
      Math.round(score),
      result,
      wave,
      kills,
      bossEntered,
      Math.round(bossDamage),
      savedBossRemainingHp,
      Math.round(playTime),
      false
    ]);

    return jsonResponse({
      ok: true
    });

  } catch (error) {
    return jsonResponse({
      ok: false,
      error: String(error)
    });
  }
}


function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


function getRankingData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('순위표');

  if (!sheet) {
    throw new Error('순위표 시트를 찾을 수 없습니다.');
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  // 순위표 B열 = 학번+이름
  // 순위표 C열 = 최고점수
  const values = sheet
    .getRange(2, 2, lastRow - 1, 2)
    .getValues();

  return values
    .filter(row => row[0] && row[1] !== '')
    .map(row => {
      const originalName = String(row[0]).trim();
      const score = Number(row[1]) || 0;

      // 맨 앞 3자리만 학급 코드로 사용
      // 30915 홍길동 → 309
      // 30915홍길동 → 309
      const classMatch =
        originalName.match(/^(\d{3})/);

      const classCode =
        classMatch ? classMatch[1] : '';

      return {
        classCode,
        name: originalName,
        score
      };
    });
}


function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setTitle('음운대좀비 순위표');
}
