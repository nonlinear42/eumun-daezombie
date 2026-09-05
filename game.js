// ============================================
// 음운 디펜스 - game.js
// v30: 좀비/식물 퇴장 모션 + 좀비 카드 배경 제거 대응
// v29: 양순음 투사체 고정 속도(220px/s) + 실제 도착 시 데미지
// 특수 적 4종 + Wave 9 Final + RAID 통합 버전 / v23 전투 리액션 강화
// ============================================

const GAME_VERSION = "v0.9.0";
const GAME_AUTHOR = "정희재";

const CELL_SIZE = 90;
const BOARD_COLUMNS = 11;
const BOARD_ROWS = 5;
const BOARD_WIDTH = CELL_SIZE * BOARD_COLUMNS;
const ZOMBIE_WIDTH = 58;
// 투사체 발사점 (셀 좌상단 기준 px) — translate(-50%,-50%) 중심
const PROJECTILE_START_OFFSET_X = 54;
const PROJECTILE_START_OFFSET_Y = 12;

const ZOMBIE_APPROACH_DISTANCE = 180;
const MAX_APPROACH_BLUR = 4;
const ZOMBIE_BASE_SPEED = CELL_SIZE / 2.8;
const TUTORIAL_ZOMBIE_SPEED = CELL_SIZE / 5;
const ZOMBIE_BITE_DAMAGE = 25;
const ZOMBIE_BITE_INTERVAL = 1000;
const MAX_ENERGY = 600;
const KILL_ENERGY_REWARD = 0;
const PLANT_REFUND_RATE = 0.30;

// ============================================
// SFX (sounds/*.wav)
// ============================================

const SFX_FILES = {
  plant_place: "sounds/plant_place.wav",
  click_ui: "sounds/click_ui.wav",
  energy_gain: "sounds/energy_gain.wav",
  zombie_defeat: "sounds/zombie_defeat.wav",
  zombie_bite: "sounds/zombie_bite.wav",
  wave_start: "sounds/wave_start.wav",
  boss_start: "sounds/boss_start.wav",
  boss_shockwave: "sounds/boss_shockwave.wav",
  plant_attack: "sounds/plant_attack.wav"
};

const SFX_DEFAULTS = {
  // UI/배치: 매번 재생. 이전 재생 종료를 기다리지 않고 짧게 겹칠 수 있음.
  plant_place: { volume: 0.35, cooldownMs: 0, maxConcurrent: 4 },
  click_ui: { volume: 0.25, cooldownMs: 0, maxConcurrent: 4 },
  energy_gain: { volume: 0.18, cooldownMs: 220, maxConcurrent: 1 },
  zombie_defeat: { volume: 0.28, cooldownMs: 60, maxConcurrent: 2 },
  // 빈도 제한 SFX (기존 유지)
  zombie_bite: { volume: 0.14, cooldownMs: 400, maxConcurrent: 1 },
  wave_start: { volume: 0.18, cooldownMs: 0, maxConcurrent: 1 },
  boss_start: { volume: 0.55, cooldownMs: 0, maxConcurrent: 1 },
  boss_shockwave: { volume: 0.29, cooldownMs: 0, maxConcurrent: 1 },
  plant_attack: { volume: 0.7, cooldownMs: 140, maxConcurrent: 2 }
};

const sfxRuntime = {
  lastPlayedAt: Object.create(null),
  activeCounts: Object.create(null),
  pool: Object.create(null)
};

function playPlantAttackSfx(){
  try{
    const playChance=0.65+Math.random()*0.15;
    if(Math.random()>=playChance) return;

    const delayMs=Math.random()*70;
    const baseVolume=SFX_DEFAULTS.plant_attack.volume;
    const volume=baseVolume*(0.9+Math.random()*0.2);
    const playbackRate=0.94+Math.random()*0.12;

    setTimeout(()=>{
      playSfx("plant_attack",{volume,playbackRate});
    },delayMs);
  }catch(err){
    // 오디오 실패는 게임 로직에 영향 없음
  }
}

function playZombieBiteSfx(){
  try{
    const playChance=0.35+Math.random()*0.10;
    if(Math.random()>=playChance) return;
    playSfx("zombie_bite");
  }catch(err){
    // 오디오 실패는 게임 로직에 영향 없음
  }
}

function playSfx(name, options = {}){
  try{
    const defaults=SFX_DEFAULTS[name];
    if(!defaults) return;

    const src=SFX_FILES[name];
    if(!src) return;

    const volume=options.volume??defaults.volume;
    const cooldownMs=options.cooldownMs??defaults.cooldownMs??0;
    const maxConcurrent=options.maxConcurrent??defaults.maxConcurrent??1;
    const now=performance.now();

    // per-name cooldown only (SFX끼리 lastPlayed 공유 없음)
    if(cooldownMs>0){
      const last=sfxRuntime.lastPlayedAt[name]||0;
      if(now-last<cooldownMs) return;
    }

    // per-name concurrent only
    const active=sfxRuntime.activeCounts[name]||0;
    if(active>=maxConcurrent) return;

    if(!sfxRuntime.pool[name]){
      sfxRuntime.pool[name]=[];
    }

    // 재생 중인 인스턴스는 재사용하지 않고, 유휴 인스턴스 또는 새 Audio로 즉시 재생
    let audio=sfxRuntime.pool[name].find(entry=>entry.paused||entry.ended);
    if(!audio){
      audio=new Audio(src);
      audio.preload="auto";
      sfxRuntime.pool[name].push(audio);
    }

    sfxRuntime.lastPlayedAt[name]=now;
    sfxRuntime.activeCounts[name]=active+1;

    let released=false;
    const release=()=>{
      if(released) return;
      released=true;
      sfxRuntime.activeCounts[name]=Math.max(0,(sfxRuntime.activeCounts[name]||1)-1);
    };

    audio.onended=release;
    audio.onerror=release;
    audio.volume=Math.max(0,Math.min(1,volume));
    audio.playbackRate=Math.max(0.5,Math.min(2,options.playbackRate??1));

    try{ audio.currentTime=0; }catch(_e){}

    const playPromise=audio.play();
    if(playPromise&&typeof playPromise.catch==="function"){
      playPromise.catch(()=>release());
    }
  }catch(err){
    // 오디오 실패는 게임 로직에 영향 없음
  }
}

function preloadSfx(){
  Object.keys(SFX_FILES).forEach(name=>{
    try{
      const audio=new Audio(SFX_FILES[name]);
      audio.preload="auto";
      if(!sfxRuntime.pool[name]){
        sfxRuntime.pool[name]=[];
      }
      sfxRuntime.pool[name].push(audio);
    }catch(err){
      // ignore
    }
  });
}

// ============================================
// BGM (sounds/battle_bgm.mp3, sounds/boss_bgm.mp3)
// ============================================

const BGM_CONFIG = {
  battleSrc: "sounds/battle_bgm.mp3",
  battleVolume: 0.18,
  raidDuckVolume: 0.06,
  battleFadeOutMs: 280,
  bossSrc: "sounds/boss_bgm.mp3",
  bossVolume: 0.35,
  bossPlaybackRate: 1.08,
  bossStartDelayMs: 400
};

const BGM_RAID_MODE = {
  pause: "pause",
  duck: "duck",
  stop: "stop"
};

const bgmRuntime = {
  audio: null,
  bossAudio: null,
  unlocked: false,
  pendingBattle: false,
  pendingBoss: false,
  restartOnPlay: false,
  battleEverPlayed: false,
  activeTrack: null,
  raidDucked: false,
  raidMode: null,
  battleFadeTimer: null,
  bossStartTimer: null
};

function clearBgmTimer(key){
  if(bgmRuntime[key]!=null){
    clearTimeout(bgmRuntime[key]);
    bgmRuntime[key]=null;
  }
}

function ensureBattleBgmAudio(){
  if(!bgmRuntime.audio){
    bgmRuntime.audio=new Audio(BGM_CONFIG.battleSrc);
    bgmRuntime.audio.loop=true;
    bgmRuntime.audio.preload="auto";
  }
  return bgmRuntime.audio;
}

function ensureBossBgmAudio(){
  if(!bgmRuntime.bossAudio){
    bgmRuntime.bossAudio=new Audio(BGM_CONFIG.bossSrc);
    bgmRuntime.bossAudio.loop=true;
    bgmRuntime.bossAudio.preload="auto";
  }
  return bgmRuntime.bossAudio;
}

function getBattleBgmTargetVolume(){
  return bgmRuntime.raidDucked
    ? BGM_CONFIG.raidDuckVolume
    : BGM_CONFIG.battleVolume;
}

function hardStopBattleBgmAudio(){
  clearBgmTimer("battleFadeTimer");
  bgmRuntime.pendingBattle=false;
  bgmRuntime.restartOnPlay=false;
  bgmRuntime.raidDucked=false;
  bgmRuntime.raidMode=null;

  if(!bgmRuntime.audio) return;

  bgmRuntime.audio.pause();
  bgmRuntime.audio.currentTime=0;
  bgmRuntime.audio.volume=BGM_CONFIG.battleVolume;
  if(bgmRuntime.activeTrack==="battle") bgmRuntime.activeTrack=null;
}

function fadeOutBattleBgm(){
  const audio=bgmRuntime.audio;
  if(!audio||audio.paused){
    hardStopBattleBgmAudio();
    return;
  }

  clearBgmTimer("battleFadeTimer");
  bgmRuntime.pendingBattle=false;
  bgmRuntime.restartOnPlay=false;

  const startVolume=audio.volume;
  const startedAt=performance.now();
  const duration=Math.max(80,BGM_CONFIG.battleFadeOutMs);

  const step=()=>{
    const t=Math.min(1,(performance.now()-startedAt)/duration);
    audio.volume=Math.max(0,startVolume*(1-t));
    if(t<1){
      bgmRuntime.battleFadeTimer=setTimeout(step,16);
      return;
    }
    hardStopBattleBgmAudio();
  };

  step();
}

function tryPlayBattleBgm(){
  try{
    stopBossBgm({keepPending:false});

    const audio=ensureBattleBgmAudio();

    if(bgmRuntime.restartOnPlay){
      audio.currentTime=0;
      bgmRuntime.restartOnPlay=false;
    }

    if(bgmRuntime.activeTrack==="battle"&&!audio.paused){
      bgmRuntime.pendingBattle=false;
      return true;
    }

    clearBgmTimer("battleFadeTimer");
    audio.volume=getBattleBgmTargetVolume();
    audio.playbackRate=1;
    const playPromise=audio.play();
    bgmRuntime.activeTrack="battle";
    bgmRuntime.pendingBattle=false;
    bgmRuntime.battleEverPlayed=true;

    if(playPromise&&typeof playPromise.then==="function"){
      playPromise.then(()=>{
        bgmRuntime.unlocked=true;
        bgmRuntime.battleEverPlayed=true;
      }).catch(()=>{
        bgmRuntime.pendingBattle=true;
      });
      return true;
    }

    bgmRuntime.unlocked=true;
    bgmRuntime.battleEverPlayed=true;
    return true;
  }catch(err){
    bgmRuntime.pendingBattle=true;
    return false;
  }
}

function requestBattleBgm({restart=false}={}){
  clearBgmTimer("bossStartTimer");
  bgmRuntime.pendingBoss=false;
  bgmRuntime.pendingBattle=true;
  bgmRuntime.raidDucked=false;
  bgmRuntime.raidMode=null;
  if(restart) bgmRuntime.restartOnPlay=true;
  tryPlayBattleBgm();
}

function setBattleBgmRaidMode(mode=BGM_RAID_MODE.pause){
  if(bgmRuntime.activeTrack!=="battle") return;

  const audio=bgmRuntime.audio;
  if(!audio) return;

  bgmRuntime.raidMode=mode;
  bgmRuntime.raidDucked=true;

  if(mode===BGM_RAID_MODE.duck){
    clearBgmTimer("battleFadeTimer");
    audio.volume=BGM_CONFIG.raidDuckVolume;
    return;
  }

  if(mode===BGM_RAID_MODE.stop){
    hardStopBattleBgmAudio();
    return;
  }

  fadeOutBattleBgm();
}

function stopBossBgm({keepPending=false}={}){
  clearBgmTimer("bossStartTimer");
  if(!keepPending) bgmRuntime.pendingBoss=false;

  if(!bgmRuntime.bossAudio){
    if(bgmRuntime.activeTrack==="boss") bgmRuntime.activeTrack=null;
    return;
  }

  bgmRuntime.bossAudio.pause();
  bgmRuntime.bossAudio.currentTime=0;
  bgmRuntime.bossAudio.playbackRate=BGM_CONFIG.bossPlaybackRate;
  bgmRuntime.bossAudio.volume=BGM_CONFIG.bossVolume;
  if(bgmRuntime.activeTrack==="boss") bgmRuntime.activeTrack=null;
}

function tryPlayBossBgm(){
  try{
    hardStopBattleBgmAudio();

    const audio=ensureBossBgmAudio();
    audio.loop=true;
    audio.volume=BGM_CONFIG.bossVolume;
    audio.playbackRate=BGM_CONFIG.bossPlaybackRate;

    if(bgmRuntime.activeTrack==="boss"&&!audio.paused){
      bgmRuntime.pendingBoss=false;
      return true;
    }

    if(audio.paused||audio.currentTime>0){
      audio.currentTime=0;
    }

    const playPromise=audio.play();
    bgmRuntime.activeTrack="boss";
    bgmRuntime.pendingBoss=false;

    if(playPromise&&typeof playPromise.then==="function"){
      playPromise.then(()=>{
        bgmRuntime.unlocked=true;
      }).catch(()=>{
        bgmRuntime.pendingBoss=true;
      });
      return true;
    }

    bgmRuntime.unlocked=true;
    return true;
  }catch(err){
    bgmRuntime.pendingBoss=true;
    return false;
  }
}

function requestBossBgm({delayMs=BGM_CONFIG.bossStartDelayMs}={}){
  clearBgmTimer("bossStartTimer");
  bgmRuntime.pendingBattle=false;
  bgmRuntime.pendingBoss=true;
  fadeOutBattleBgm();

  const wait=Math.max(0,delayMs);
  bgmRuntime.bossStartTimer=setTimeout(()=>{
    bgmRuntime.bossStartTimer=null;
    tryPlayBossBgm();
  },wait);
}

function stopBattleBgm(){
  clearBgmTimer("bossStartTimer");
  bgmRuntime.pendingBoss=false;
  hardStopBattleBgmAudio();
  stopBossBgm();
}

function initBgmAutoplayUnlock(){
  const unlock=()=>{
    bgmRuntime.unlocked=true;
    if(bgmRuntime.pendingBoss) tryPlayBossBgm();
    else if(bgmRuntime.pendingBattle) tryPlayBattleBgm();
    document.removeEventListener("pointerdown",unlock,true);
    document.removeEventListener("keydown",unlock,true);
  };

  document.addEventListener("pointerdown",unlock,true);
  document.addEventListener("keydown",unlock,true);
}

function preloadBattleBgm(){
  try{
    ensureBattleBgmAudio();
    ensureBossBgmAudio();
  }catch(err){
    // ignore
  }
}

const FINAL_SCORE_CONFIG = {
  targetClearSeconds: 18 * 60,
  maxTimeBonus: 4000,
  energyPointMultiplier: 5
};

let gameStartTime = Date.now();
let finalScoreCalculated = false;

const RAID_CONFIG = {
  maxHp: 32000,

  // 보스 단어 변경 주기
  wordChangeInterval: 20000,

  // 충격파 주기
  attackInterval: 6000,
  shockwaveDamage: 100,

  // 레이드 시작 시 기존 식물 제거 비율
  openingPlantRemovalRatio: 0.60,

  // 운이 너무 나빠 시작부터 사실상 패배하는 상황 방지
  minimumPlantsAfterOpening: 5,

  // 레이드 전용 삽 환불
  refundRate: 0.70,

  // 보스 이동 / 근접 공격
  startX: BOARD_WIDTH - 120,
  defeatX: 0,
  moveSpeed: 3.2,
  biteDamage: 70,
  biteInterval: 1000,
  pathRow: 2
};

// 보스 단어 변경 3초 전 경고 (실제 nextWordChangeAt 기준)
const RAID_WORD_WARN_AHEAD_MS = 3000;
const RAID_WORD_ALERT_POS = { x: BOARD_WIDTH - 230, y: 40 };
let raidBossWordWarnTimer = null;

// RAID 보스의 실제 판정 중심보다 큰 일러스트가 먼저 식물에 닿는 점을 보정한다.
// 보스는 왼쪽으로 이동하므로, 식물 중심보다 이 거리만큼 오른쪽에 있을 때부터
// "막힘"으로 판정하여 일러스트가 식물을 깊게 덮기 전에 정지한다.
const RAID_BOSS_VISUAL_CONTACT_DISTANCE = 165;
const RAID_BOSS_CONTACT_OVERSHOOT = 30;

const ENEMY_TYPES = {
  normal: { name:"일반", icon:"🧟", hpMultiplier:1, speedMultiplier:1, biteDamage:25, statusDurationMultiplier:1 },
  runner: { name:"돌진형", icon:"🏃", hpMultiplier:0.95, speedMultiplier:1.50, biteDamage:25, statusDurationMultiplier:1 },
  breaker:{ name:"파괴형", icon:"💢", hpMultiplier:1.45, speedMultiplier:0.90, biteDamage:50, statusDurationMultiplier:1 },
  resilient:{ name:"불굴형", icon:"🛡", hpMultiplier:1.55, speedMultiplier:1, biteDamage:25, statusDurationMultiplier:0.35 },
  bomber:{
    name:"폭발형", icon:"💣", hpMultiplier:1.35, speedMultiplier:0.80,
    biteDamage:25, statusDurationMultiplier:1,
    explosionRadius:135, explosionInnerRadius:75,
    explosionInnerDamage:280, explosionOuterDamage:180
  }
};

// ============================================
// 그래픽 자산 경로
// ============================================
// 자음 식물은 기존 images/plants 폴더 구조 유지
// 모음/에너지/좀비/보스는 새로 정리한 폴더 구조 사용
const PLANT_IMAGES = {
  "양순음": "images/plants/consonants/labial.png",
  "치조음": "images/plants/consonants/alveolar.png",
  "비음": "images/plants/consonants/nasal.png",
  "파열음": "images/plants/consonants/plosive.png",
  "유음": "images/plants/consonants/liquid.png",
  "마찰음": "images/plants/consonants/fricative.png",
  "연구개음": "images/plants/consonants/velar.png",
  "파찰음": "images/plants/consonants/affricate.png",
  "경구개음": "images/plants/consonants/palatal.png",
  "후음": "images/plants/consonants/glottal.png",

  "전설모음": "images/plants/vowels/front_vowel.png",
  "후설모음": "images/plants/vowels/back_vowel.png",
  "고모음": "images/plants/vowels/high_vowel.png",
  "중모음": "images/plants/vowels/mid_vowel.png",
  "저모음": "images/plants/vowels/low_vowel.png",
  "평순모음": "images/plants/vowels/unrounded_vowel.png",
  "원순모음": "images/plants/vowels/rounded_vowel.png",

  "에너지식물": "images/plants/energy/energy.png"
};

const ZOMBIE_IMAGES = {
  normal: "images/zombies/normal.png",
  runner: "images/zombies/runner.png",
  breaker: "images/zombies/breaker.png",
  resilient: "images/zombies/resilient.png",
  bomber: "images/zombies/bomber.png"
};

const BOSS_IMAGE = "images/boss/raid_boss.png";

// ============================================
// 자음 식물 투사체 그래픽 / 비행 설정
// 식물 이미지와 동일한 영어 파일명 체계를 사용한다.
// images/projectiles/ 폴더 안에 아래 10개 PNG가 있어야 한다.
// ============================================
const PROJECTILE_CONFIG = {
  "양순음":   { path:"images/projectiles/labial.png",    speed:220, size:34, hitDistance:18, glow:"drop-shadow(0 0 5px rgba(255,120,190,.85))" },
  "치조음":   { path:"images/projectiles/alveolar.png",  speed:300, size:34, hitDistance:18, glow:"drop-shadow(0 0 5px rgba(120,235,95,.80))" },
  "비음":     { path:"images/projectiles/nasal.png",     speed:420, size:30, hitDistance:17, glow:"drop-shadow(0 0 5px rgba(120,255,135,.85))" },
  "파열음":   { path:"images/projectiles/plosive.png",   speed:190, size:48, hitDistance:23, glow:"drop-shadow(0 0 6px rgba(235,155,75,.75))" },
  "유음":     { path:"images/projectiles/liquid.png",    speed:360, size:38, hitDistance:20, glow:"drop-shadow(0 0 6px rgba(165,255,80,.80))" },
  "마찰음":   { path:"images/projectiles/fricative.png", speed:320, size:42, hitDistance:21, glow:"drop-shadow(0 0 7px rgba(255,70,70,.88))" },
  "연구개음": { path:"images/projectiles/velar.png",     speed:520, size:44, hitDistance:22, glow:"drop-shadow(0 0 6px rgba(150,100,255,.85))" },
  "파찰음":   { path:"images/projectiles/affricate.png", speed:400, size:40, hitDistance:21, glow:"drop-shadow(0 0 6px rgba(255,205,55,.90))" },
  "경구개음": { path:"images/projectiles/palatal.png",   speed:650, size:30, hitDistance:17, glow:"drop-shadow(0 0 5px rgba(185,135,255,.90))" },
  "후음":     { path:"images/projectiles/glottal.png",   speed:850, size:42, hitDistance:20, glow:"drop-shadow(0 0 7px rgba(135,90,255,.90))" }
};

const PROJECTILE_IMAGES = Object.fromEntries(
  Object.entries(PROJECTILE_CONFIG).map(([type,config])=>[type,config.path])
);

function getPlantImage(type){
  return PLANT_IMAGES[type] || null;
}

function getZombieImage(type){
  return ZOMBIE_IMAGES[type] || ZOMBIE_IMAGES.normal;
}

function preloadGameImages(){
  const paths=[
    ...Object.values(PLANT_IMAGES),
    ...Object.values(ZOMBIE_IMAGES),
    ...Object.values(PROJECTILE_IMAGES),
    BOSS_IMAGE
  ];

  [...new Set(paths)].forEach(src=>{
    const img=new Image();
    img.src=src;
  });
}


const board = document.querySelector(".game-board");
const plantButtons = document.querySelectorAll(".plant-button");
const removeButton = document.querySelector("#remove-button");
const energyDisplay = document.querySelector("#energy");
const waveDisplay = document.querySelector("#wave");
const lifeDisplay = document.querySelector("#life");
const scoreDisplay = document.querySelector("#score");
const restartButton = document.querySelector("#restart-button");
const unlockOverlay = document.querySelector("#unlock-overlay");
const unlockTitle = document.querySelector("#unlock-title");
const unlockContent = document.querySelector("#unlock-content");
const unlockNextButton = document.querySelector("#unlock-next-button");
const plantInfoContent = document.querySelector("#plant-info-content");
const startOverlay = document.querySelector("#start-overlay");
const tutorialStartButton = document.querySelector("#tutorial-start-button");
const directStartButton = document.querySelector("#direct-start-button");
const raidTestButton = document.querySelector("#raid-test-button");
const tutorialGuide = document.querySelector("#tutorial-guide");
const tutorialGuideText = document.querySelector("#tutorial-guide-text");

const startCredit = document.querySelector("#start-credit");
if(startCredit){
  startCredit.textContent = `${GAME_VERSION} · 만든 이 ${GAME_AUTHOR}`;
}

let selectedPlant = null;
let selectedCost = 0;
let removeMode = false;
let energy = 350;
let life = 5;
let score = 0;
let currentWave = 1;
let zombies = [];
let waveZombieCount = 0;
let resolvedZombies = 0;
let waveInProgress = false;
let gameOver = false;
let currentSpawnTimer = null;

let missedWords = [];
let missedFeatureCounts = {};
let plantPlacementCounts = {};

let raidMode = false;
let raidBoss = null;
let raidWordBag = [];
let raidLastWordId = null;
let raidLiquidResonance = 0;
let raidDamageSerial = 0;

let tutorialMode = false;
let tutorialSpawnIndex = 0;
let tutorialEnergyBonusGiven = false;
const TUTORIAL_WORDS = [
  { id:"T-01", word:"바다", phonemes:["ㅂ","ㅏ","ㄷ","ㅏ"] },
  { id:"T-02", word:"도시", phonemes:["ㄷ","ㅗ","ㅅ","ㅣ"] },
  { id:"T-03", word:"고무", phonemes:["ㄱ","ㅗ","ㅁ","ㅜ"] },
  { id:"T-04", word:"나무", phonemes:["ㄴ","ㅏ","ㅁ","ㅜ"] }
];
const TUTORIAL_CONFIG = { zombieCount:4, zombieHP:100, spawnInterval:10000 };

// ============================================
// 개발/연습 테스트 모드
// ============================================
let practiceMode = false;
let practicePanel = null;
let practiceToolbar = null;

const ALL_PLANT_TYPES = [
  "에너지식물",
  "양순음","치조음","비음","파열음","유음","마찰음","연구개음","파찰음","경구개음","후음",
  "평순모음","고모음","중모음","원순모음","저모음","후설모음","전설모음"
];

const WAVE_CONFIG = {
  1:{zombieCount:10,zombieHP:200,spawnInterval:3000},
  2:{zombieCount:13,zombieHP:230,spawnInterval:2800},
  3:{zombieCount:16,zombieHP:270,spawnInterval:2500},
  4:{zombieCount:18,zombieHP:330,spawnInterval:2300},
  5:{zombieCount:20,zombieHP:400,spawnInterval:2200},
  6:{zombieCount:22,zombieHP:480,spawnInterval:2100},
  7:{zombieCount:26,zombieHP:560,spawnInterval:2000},
  8:{zombieCount:28,zombieHP:650,spawnInterval:1900},
  9:{zombieCount:44,zombieHP:620,spawnInterval:1200}
};

const WAVE_ENEMY_MIX = {
  1:{normal:10}, 2:{normal:13}, 3:{normal:16}, 4:{normal:18}, 5:{normal:20}, 6:{normal:22},
  7:{normal:16,runner:3,breaker:2,resilient:2,bomber:3},
  8:{normal:14,runner:4,breaker:3,resilient:3,bomber:4},
  9:{normal:20,runner:7,breaker:5,resilient:5,bomber:7}
};
let waveEnemyTypeBag = [];

const INITIAL_PLANTS = ["에너지식물","양순음","치조음"];
const WAVE_UNLOCKS = {
  2:["비음","평순모음"],
  3:["파열음","고모음"],
  4:["유음","중모음"],
  5:["마찰음","원순모음"],
  6:["연구개음","저모음"],
  7:["파찰음","후설모음"],
  8:["경구개음","후음","전설모음"],
  9:[]
};
let unlockedPlants = new Set(INITIAL_PLANTS);

const CONSONANT_PLANTS = new Set(["양순음","치조음","비음","파열음","유음","마찰음","연구개음","파찰음","경구개음","후음"]);
const VOWEL_PLANTS = new Set(["평순모음","고모음","중모음","원순모음","저모음","후설모음","전설모음"]);

// WORD_DB의 debutWave를 기준으로 Wave 풀을 자동 구성한다.
// 각 Wave에서는 이전 단어가 누적되고,
// 해당 Wave에서 처음 등장한 단어는 2번 넣어 새 학습 요소의 출현 확률을 높인다.
const WAVE_WORD_POOLS = {};

for(let wave=1;wave<=9;wave++){
  const cumulative=
    WORD_DB
      .filter(word=>word.debutWave<=wave)
      .map(word=>word.id);

  const currentWaveNew=
    WORD_DB
      .filter(word=>word.debutWave===wave)
      .map(word=>word.id);

  WAVE_WORD_POOLS[wave]=[
    ...cumulative,
    ...currentWaveNew
  ];
}
let waveWordBag = [];
let lastSpawnedWordId = null;

function shuffleArray(array){
  const result=[...array];
  for(let i=result.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}

function getCurrentWordPool(){
  const ids=WAVE_WORD_POOLS[currentWave]||[];
  return ids.map(id=>WORD_DB.find(word=>word.id===id)).filter(Boolean);
}
function refillWordBag(){
  waveWordBag=shuffleArray(getCurrentWordPool());
  if(waveWordBag.length>1&&lastSpawnedWordId&&waveWordBag[0].id===lastSpawnedWordId){
    [waveWordBag[0],waveWordBag[1]]=[waveWordBag[1],waveWordBag[0]];
  }
}
function getNextWordData(){
  if(waveWordBag.length===0) refillWordBag();
  if(waveWordBag.length===0) return null;
  const wordData=waveWordBag.shift();
  lastSpawnedWordId=wordData.id;
  return wordData;
}

function getRaidWordPool(){
  return WORD_DB.filter(
    word=>
      word.debutWave>=7 &&
      word.debutWave<=9
  );
}
function refillRaidWordBag(){
  raidWordBag=shuffleArray(getRaidWordPool());
  if(raidWordBag.length>1&&raidLastWordId&&raidWordBag[0].id===raidLastWordId){
    [raidWordBag[0],raidWordBag[1]]=[raidWordBag[1],raidWordBag[0]];
  }
}
function getNextRaidWord(){
  if(raidWordBag.length===0) refillRaidWordBag();
  if(raidWordBag.length===0) return null;
  const wordData=raidWordBag.shift();
  raidLastWordId=wordData.id;
  return wordData;
}

function buildEnemyTypeBag(){
  const mix=WAVE_ENEMY_MIX[currentWave]||{normal:WAVE_CONFIG[currentWave]?.zombieCount||0};
  const bag=[];
  Object.entries(mix).forEach(([type,count])=>{for(let i=0;i<count;i++) bag.push(type);});
  waveEnemyTypeBag=shuffleArray(bag);
}
function getNextEnemyType(){return waveEnemyTypeBag.length?waveEnemyTypeBag.shift()||"normal":"normal";}

function changeEnergy(amount){
  energy=Math.max(0,Math.min(MAX_ENERGY,energy+amount));
  energyDisplay.textContent=energy;
  updatePlantButtons();
}
function updatePlantButtons(){
  plantButtons.forEach(button=>{
    const type=button.dataset.plant;
    const cost=Number(button.dataset.cost);
    if(!unlockedPlants.has(type)){
      button.classList.add("hidden-plant");
      button.disabled=true;
      return;
    }
    button.classList.remove("hidden-plant");

    // 연습/테스트 모드에서는 배치 비용이 0이므로
    // 에너지와 무관하게 해금된 식물을 항상 사용할 수 있다.
    if(practiceMode){
      button.classList.remove("no-energy");
      button.disabled=false;
      return;
    }

    if(energy<cost){button.classList.add("no-energy");button.disabled=true;}
    else{button.classList.remove("no-energy");button.disabled=false;}
  });
}
function showPlantInfo(type){
  const data=PLANT_DB[type];
  if(!data||!plantInfoContent) return;
  const imagePath=PLANT_IMAGES[type]||"";
  const thumb=imagePath
    ? `<img class="plant-info-thumb" src="${imagePath}" alt="" draggable="false">`
    : `<div class="plant-info-thumb plant-info-thumb-fallback" aria-hidden="true">🌱</div>`;
  plantInfoContent.innerHTML=`
    <div class="plant-info-layout">
      ${thumb}
      <div class="plant-info-details">
        <div class="plant-info-name">${data.name}</div>
        <div class="plant-info-meta">
          <span class="plant-info-role">역할: ${data.role}</span>
          <span class="plant-info-cost">비용: ${data.cost}</span>
        </div>
        <p class="plant-info-desc">${data.description}</p>
      </div>
    </div>`;
}
function ensureBattleMainColumn(){
  const layout=document.querySelector(".battle-layout");
  const center=document.querySelector(".battle-center");
  if(!layout||!center) return null;

  let main=layout.querySelector(".battle-main");
  if(!main){
    main=document.createElement("div");
    main.className="battle-main";
    if(center.parentElement===layout){
      layout.replaceChild(main,center);
      main.appendChild(center);
    }
  }else if(center.parentElement!==main){
    main.appendChild(center);
  }

  return main;
}

function ensureRaidHudDock(){
  const main=ensureBattleMainColumn();
  if(!main) return null;

  let dock=main.querySelector("#raid-hud-dock");
  if(!dock){
    dock=document.createElement("div");
    dock.id="raid-hud-dock";
    const center=main.querySelector(".battle-center");
    if(center) main.insertBefore(dock,center);
    else main.prepend(dock);
  }

  return dock;
}

function hideRaidHudDock(){
  document.querySelector("#raid-hud-dock")?.classList.remove("is-active");
}

function detachRaidBossHud(){
  clearRaidBossWordChangeFx();
  if(raidBoss?.hud?.parentElement) raidBoss.hud.remove();
  hideRaidHudDock();
}

function placePlantInfoBelowBoard(){
  const main=ensureBattleMainColumn();
  const center=document.querySelector(".battle-center");
  const plantInfo=document.getElementById("plant-info");
  if(!main||!center||!plantInfo) return;

  if(plantInfo.parentElement!==main){
    main.appendChild(plantInfo);
  }else if(plantInfo.previousElementSibling!==center){
    center.insertAdjacentElement("afterend",plantInfo);
  }

  scheduleGameFitScale();
}

/* =========================================================
   Viewport fit scale — 디자인 기준 크기를 유지한 채 전체 축소
   ========================================================= */

const GAME_FIT={
  baseWidth:0,
  baseHeight:0,
  scale:1,
  raf:0,
  resizeBound:false
};

function scheduleGameFitScale(){
  if(GAME_FIT.raf) cancelAnimationFrame(GAME_FIT.raf);
  GAME_FIT.raf=requestAnimationFrame(()=>{
    GAME_FIT.raf=0;
    updateGameFitScale();
  });
}

function updateGameFitScale(){
  const shell=document.getElementById("game-viewport-shell");
  const root=document.getElementById("game-scale-root");
  if(!shell||!root) return;

  // 측정 전 transform 제거 (레이아웃 박스에 scale 잔여 공간 방지)
  root.style.transform="none";
  root.style.width="auto";
  root.style.height="auto";
  shell.style.width="auto";
  shell.style.height="auto";
  shell.style.left="0px";
  shell.style.top="0px";

  void root.offsetWidth;

  const rect=root.getBoundingClientRect();
  const baseWidth=Math.max(
    1,
    Math.ceil(Math.max(root.scrollWidth, root.offsetWidth, rect.width))
  );
  const baseHeight=Math.max(
    1,
    Math.ceil(Math.max(root.scrollHeight, root.offsetHeight, rect.height))
  );

  GAME_FIT.baseWidth=baseWidth;
  GAME_FIT.baseHeight=baseHeight;

  const availW=Math.max(1, window.innerWidth);
  const availH=Math.max(1, window.innerHeight);
  const scale=Math.min(availW / baseWidth, availH / baseHeight, 1);
  GAME_FIT.scale=scale;

  root.style.width=baseWidth+"px";
  root.style.height=baseHeight+"px";
  root.style.transformOrigin="top left";
  root.style.transform=`scale(${scale})`;

  const fittedW=Math.max(1, Math.round(baseWidth * scale));
  const fittedH=Math.max(1, Math.round(baseHeight * scale));
  shell.style.width=fittedW+"px";
  shell.style.height=fittedH+"px";
  shell.style.left=Math.max(0, Math.round((availW - fittedW) / 2))+"px";
  shell.style.top=Math.max(0, Math.round((availH - fittedH) / 2))+"px";
}

function initGameFitScale(){
  scheduleGameFitScale();
  requestAnimationFrame(scheduleGameFitScale);

  if(!GAME_FIT.resizeBound){
    GAME_FIT.resizeBound=true;
    window.addEventListener("resize", scheduleGameFitScale);
  }

  // HUD/배경 이미지 로드 후 높이 재측정
  const root=document.getElementById("game-scale-root");
  if(root){
    root.querySelectorAll("img").forEach(img=>{
      if(!img.complete){
        img.addEventListener("load", scheduleGameFitScale, {once:true});
      }
    });
  }
}

function buildUnlockPlantHTML(type){
  const data=PLANT_DB[type];
  if(!data) return "";

  const imagePath=PLANT_IMAGES[type]||"";
  const thumb=imagePath
    ? `<img class="unlock-plant-thumb" src="${imagePath}" alt="" draggable="false">`
    : `<div class="unlock-plant-thumb unlock-plant-thumb-fallback">🌱</div>`;

  return `<div class="unlock-plant"><div class="unlock-plant-card">${thumb}<div class="unlock-plant-text"><strong>${data.name}</strong><div>역할: ${data.role}</div><div>${data.description}</div></div></div></div>`;
}
plantButtons.forEach(button=>button.addEventListener("click",function(){
  playSfx("click_ui");
  if(gameOver||button.disabled) return;
  if(isTutorialGuideBlockingPlant(button.dataset.plant)) return;
  removeMode=false; removeButton.classList.remove("selected");
  selectedPlant=button.dataset.plant; selectedCost=Number(button.dataset.cost);
  plantButtons.forEach(other=>other.classList.remove("selected"));
  button.classList.add("selected"); showPlantInfo(selectedPlant);
  onTutorialGuidePlantSelected(selectedPlant);
}));
function updateRaidRefundUI(){
  if(!removeButton)return;

  formatRemovePlantButton();

  const refundLabel=removeButton.querySelector(".remove-refund-label");
  if(refundLabel){
    refundLabel.textContent=raidMode
      ? "구매가의 70% 반환"
      : "구매가의 30% 반환";
  }

  const refundText=
    raidMode
      ? "RAID 식물 제거: 구매 비용의 70% 환불"
      : "식물 제거: 구매 비용의 30% 환불";

  removeButton.title=
    refundText;

  removeButton.setAttribute(
    "aria-label",
    refundText
  );
}

removeButton.addEventListener("click",function(){
  playSfx("click_ui");
  if(gameOver) return;
  removeMode=true; selectedPlant=null; selectedCost=0;
  plantButtons.forEach(button=>button.classList.remove("selected"));
  removeButton.classList.add("selected");
  if(plantInfoContent) plantInfoContent.innerHTML=`<strong>🪏 식물 제거</strong><br>제거할 식물을 선택하세요. ${raidMode ? "RAID에서는 구매 비용의 70%가 환불됩니다." : "구매 비용의 30%가 환불됩니다."}`;
});

function createEffect(text,x,y,className,duration=500){
  const effect=document.createElement("div");
  effect.classList.add("attack-effect");
  if(className){
    String(className).trim().split(/\s+/).forEach((name)=>{
      if(name) effect.classList.add(name);
    });
  }
  effect.textContent=text;
  effect.style.left=x+"px"; effect.style.top=y+"px";
  board.appendChild(effect); setTimeout(()=>effect.remove(),duration);
}

/** 소리꽃 +25 생성 순간에만 plant-visual 위에 표시 (자연 회복과 무관) */
function createSoundSeedGainVfx(plant){
  if(!plant || !plant.isConnected) return;
  const host = plant.querySelector(".plant-visual") || plant;
  const vfx = document.createElement("div");
  vfx.className = "sound-seed-gain-vfx";
  vfx.setAttribute("aria-hidden", "true");
  vfx.innerHTML =
    '<img class="sound-seed-gain-icon" src="images/ui/sori_seed.png" alt="" draggable="false">' +
    '<span class="sound-seed-gain-spark sound-seed-gain-spark-a"></span>' +
    '<span class="sound-seed-gain-spark sound-seed-gain-spark-b"></span>';
  host.appendChild(vfx);
  setTimeout(() => {
    if(vfx.parentElement) vfx.remove();
  }, 700);
}

function getZombieHitVfxPosition(zombie){
  if(!zombie) return {x:0,y:0};
  return {
    x:zombie.x+29,
    y:zombie.row*CELL_SIZE+50
  };
}

function getRaidHitVfxPosition(row){
  return {
    x:(raidBoss?raidBoss.x:0)-18,
    y:row*CELL_SIZE+45
  };
}

const PROJECTILE_HIT_VFX_CLASS={
  "양순음":"proj-hit-labial",
  "치조음":"proj-hit-alveolar",
  "비음":"proj-hit-nasal",
  "파열음":"proj-hit-plosive",
  "유음":"proj-hit-liquid",
  "마찰음":"proj-hit-fricative",
  "연구개음":"proj-hit-velar",
  "파찰음":"proj-hit-affricate",
  "경구개음":"proj-hit-palatal",
  "후음":"proj-hit-glottal"
};

function createProjectileHitVfx(plantType,x,y,options={}){
  const effect=document.createElement("div");
  const typeClass=PROJECTILE_HIT_VFX_CLASS[plantType]||"proj-hit-default";
  effect.classList.add("projectile-hit-vfx",typeClass);
  if(options.isFinal) effect.classList.add("proj-hit-final");
  if(options.isChain) effect.classList.add("proj-hit-chain");
  if(options.shotIndex!==undefined){
    effect.dataset.shotIndex=String(options.shotIndex);
  }
  effect.style.left=x+"px";
  effect.style.top=y+"px";
  board.appendChild(effect);
  const duration=options.duration??420;
  setTimeout(()=>{
    if(effect.parentElement) effect.remove();
  },duration);
}

function createProjectileElement(plantType,config,extraClass=""){
  const projectile=document.createElement("div");
  projectile.classList.add("flying-projectile");
  if(extraClass) projectile.classList.add(extraClass);
  projectile.dataset.projectileType=plantType;

  const sprite=document.createElement("img");
  sprite.className="flying-projectile-sprite";
  sprite.src=config.path;
  sprite.alt="";
  sprite.draggable=false;
  if(config.scale) sprite.style.scale=String(config.scale);

  sprite.addEventListener("error",()=>{
    if(projectile.parentElement) projectile.remove();
    console.warn(`투사체 이미지 파일을 찾지 못했습니다: ${config.path}`);
  },{once:true});

  projectile.appendChild(sprite);
  return projectile;
}

// 실제 명중 판정을 담당하는 비행 투사체.
// 식물 종류별로 속도/크기를 다르게 하고, 움직이는 좀비를 일정 속도로 추적한다.
// 목표에 실제로 닿은 순간에만 onHit 콜백을 실행한다.
function createFlyingProjectile(row,column,target,plantType,onHit,options={}){
  const baseConfig=PROJECTILE_CONFIG[plantType];
  if(!baseConfig||!target||!target.alive)return;

  const config={...baseConfig,...options};
  const projectile=createProjectileElement(plantType,config);

  const startX=column*CELL_SIZE+(config.startOffsetX??PROJECTILE_START_OFFSET_X);
  const startY=row*CELL_SIZE+(config.startOffsetY??PROJECTILE_START_OFFSET_Y);
  const projectileSpeed=config.speed;
  const hitDistance=config.hitDistance;

  let currentX=startX;
  let currentY=startY;
  let lastFrameTime=null;

  projectile.style.left=currentX+"px";
  projectile.style.top=currentY+"px";
  projectile.style.width=config.size+"px";
  projectile.style.height=config.size+"px";
  projectile.style.transform="translate(-50%,-50%)";
  projectile.style.filter=config.glow||"none";

  board.appendChild(projectile);

  function moveProjectile(currentTime){
    if(
      !target||
      !target.alive||
      !target.element||
      !target.element.parentElement
    ){
      if(projectile.parentElement)projectile.remove();
      return;
    }

    if(lastFrameTime===null){
      lastFrameTime=currentTime;
      requestAnimationFrame(moveProjectile);
      return;
    }

    const delta=Math.min((currentTime-lastFrameTime)/1000,0.05);
    lastFrameTime=currentTime;

    const targetX=target.x+(config.targetOffsetX??14);
    const targetY=target.row*CELL_SIZE+(config.targetOffsetY??25);
    const dx=targetX-currentX;
    const dy=targetY-currentY;
    const distance=Math.hypot(dx,dy);
    const step=projectileSpeed*delta;

    if(distance<=Math.max(hitDistance,step)){
      projectile.style.left=targetX+"px";
      projectile.style.top=targetY+"px";

      if(projectile.parentElement)projectile.remove();
      if(target.alive&&typeof onHit==="function")onHit(target);
      return;
    }

    if(distance>0){
      currentX+=(dx/distance)*step;
      currentY+=(dy/distance)*step;
    }

    projectile.style.left=currentX+"px";
    projectile.style.top=currentY+"px";

    requestAnimationFrame(moveProjectile);
  }

  requestAnimationFrame(moveProjectile);
}

// RAID 보스 전용 비행 투사체.
// 일반 좀비와 달리 보스는 5레인 전체를 차지하므로,
// 발사한 식물의 레인 높이를 향해 일정 속도로 날아간다.
function createRaidFlyingProjectile(row,column,plantType,onHit,options={}){
  const baseConfig=PROJECTILE_CONFIG[plantType];
  if(!baseConfig||!raidMode||!raidBoss||!raidBoss.alive)return;

  const config={...baseConfig,...options};
  const projectile=createProjectileElement(plantType,config,"raid-flying-projectile");

  const startX=column*CELL_SIZE+(config.startOffsetX??PROJECTILE_START_OFFSET_X);
  const startY=row*CELL_SIZE+(config.startOffsetY??PROJECTILE_START_OFFSET_Y);
  const projectileSpeed=config.speed;
  const hitDistance=config.hitDistance;

  let currentX=startX;
  let currentY=startY;
  let lastFrameTime=null;

  projectile.style.left=currentX+"px";
  projectile.style.top=currentY+"px";
  projectile.style.width=config.size+"px";
  projectile.style.height=config.size+"px";
  projectile.style.transform="translate(-50%,-50%)";
  projectile.style.filter=config.glow||"none";

  board.appendChild(projectile);

  function moveRaidProjectile(currentTime){
    if(!raidMode||!raidBoss||!raidBoss.alive){
      if(projectile.parentElement)projectile.remove();
      return;
    }

    if(lastFrameTime===null){
      lastFrameTime=currentTime;
      requestAnimationFrame(moveRaidProjectile);
      return;
    }

    const delta=Math.min((currentTime-lastFrameTime)/1000,0.05);
    lastFrameTime=currentTime;

    const targetX=raidBoss.x+(config.raidTargetOffsetX??-6);
    const targetY=row*CELL_SIZE+(config.raidTargetOffsetY??CELL_SIZE/2);
    const dx=targetX-currentX;
    const dy=targetY-currentY;
    const distance=Math.hypot(dx,dy);
    const step=projectileSpeed*delta;

    if(distance<=Math.max(hitDistance,step)){
      projectile.style.left=targetX+"px";
      projectile.style.top=targetY+"px";
      if(projectile.parentElement)projectile.remove();
      if(raidBoss&&raidBoss.alive&&typeof onHit==="function")onHit();
      return;
    }

    if(distance>0){
      currentX+=(dx/distance)*step;
      currentY+=(dy/distance)*step;
    }

    projectile.style.left=currentX+"px";
    projectile.style.top=currentY+"px";

    requestAnimationFrame(moveRaidProjectile);
  }

  requestAnimationFrame(moveRaidProjectile);
}

function createDamageNumber(zombie,damage,extraClass=""){
  if(!zombie||!zombie.element) return;
  const number=document.createElement("div"); number.classList.add("damage-number");
  if(extraClass) number.classList.add(extraClass);
  number.textContent="-"+Math.round(damage);
  number.style.left=(zombie.x+25+Math.random()*12)+"px";
  number.style.top=(zombie.row*CELL_SIZE+5)+"px";
  board.appendChild(number); setTimeout(()=>number.remove(),750);
}
function createPlantDamageNumber(index,damage){
  const row=Math.floor(index/BOARD_COLUMNS), column=index%BOARD_COLUMNS;
  const effect=document.createElement("div"); effect.classList.add("damage-number","heavy-number");
  effect.textContent="-"+Math.round(damage);
  effect.style.left=(column*CELL_SIZE+35)+"px"; effect.style.top=(row*CELL_SIZE+10)+"px";
  board.appendChild(effect); setTimeout(()=>effect.remove(),750);
}
function createHealNumber(index,amount){
  const row=Math.floor(index/BOARD_COLUMNS), column=index%BOARD_COLUMNS;
  const effect=document.createElement("div"); effect.classList.add("heal-number"); effect.textContent="+"+amount+" HP";
  effect.style.left=(column*CELL_SIZE+22)+"px"; effect.style.top=(row*CELL_SIZE+10)+"px";
  board.appendChild(effect); setTimeout(()=>effect.remove(),800);
}
function createPierceTrail(row,column,targets){
  if(!targets.length) return;
  const startX=column*CELL_SIZE+60, endX=targets[targets.length-1].x+35;
  const trail=document.createElement("div"); trail.classList.add("pierce-trail");
  trail.style.left=startX+"px"; trail.style.top=(row*CELL_SIZE+45)+"px"; trail.style.width=Math.max(30,endX-startX)+"px";
  board.appendChild(trail); setTimeout(()=>trail.remove(),400);
}
function createGlobalFreezeScreen(){const e=document.createElement("div");e.classList.add("global-freeze-screen");e.textContent="❄ 전설모음 발동! ❄";board.appendChild(e);setTimeout(()=>e.remove(),950);}
function createGlobalSlowScreen(){const e=document.createElement("div");e.classList.add("global-slow-screen");e.textContent="🐌 후설모음 발동! 🐌";board.appendChild(e);setTimeout(()=>e.remove(),950);}

function applyPlantCellColor(cell,type){
  cell.classList.remove("consonant-cell","vowel-cell","energy-cell");
  if(type==="에너지식물"){cell.classList.add("energy-cell");return;}
  if(CONSONANT_PLANTS.has(type)){cell.classList.add("consonant-cell");return;}
  if(VOWEL_PLANTS.has(type)) cell.classList.add("vowel-cell");
}
function createPlantExitGhost(cell,plant,refund=false,exitClass=""){
  if(!cell||!plant)return;

  const index=Number(cell.dataset.index);
  if(!Number.isFinite(index))return;

  const row=Math.floor(index/BOARD_COLUMNS);
  const column=index%BOARD_COLUMNS;
  const ghost=plant.cloneNode(true);

  ghost.classList.remove(
    "plant-hp-medium",
    "plant-hp-low",
    "plant-hp-critical",
    "speed-buffed",
    "shielded",
    "support-active",
    "plant-hit",
    "plant-hit-heavy",
    "raid-boss-hit",
    "energy-producing",
    "raid-opening-shake",
    "raid-shockwave-hop"
  );

  const exitMode=refund
    ? "plant-removed-by-shovel"
    : (exitClass||"plant-destroyed");

  ghost.classList.add(
    "plant-exit-ghost",
    exitMode
  );

  ghost.style.left=(column*CELL_SIZE)+"px";
  ghost.style.top=(row*CELL_SIZE)+"px";

  board.appendChild(ghost);

  const duration=refund
    ? 280
    : exitClass==="plant-raid-opening-exit"
      ? 320
      : 440;

  setTimeout(()=>{
    if(ghost.parentElement)ghost.remove();
  },duration);
}

function removePlantFromCell(cell,refund=false,options={}){
  const type=cell.dataset.plantType;
  if(!type)return;

  if(refund){
    const data=PLANT_DB[type];
    changeEnergy(
      Math.floor(
        data.cost*(raidMode?RAID_CONFIG.refundRate:PLANT_REFUND_RATE)
      )
    );
  }

  const plant=cell.querySelector(".plant");

  if(plant){
    createPlantExitGhost(
      cell,
      plant,
      refund,
      options.exitClass||""
    );
    plant.remove();
  }

  /* 판정상으로는 즉시 빈 칸으로 만든다.
     퇴장 애니메이션은 board 위의 복제본만 담당한다. */
  delete cell.dataset.plant;
  delete cell.dataset.plantType;
  delete cell.dataset.plantHp;
  delete cell.dataset.lastAttack;
  delete cell.dataset.lastEnergyTime;
  delete cell.dataset.lastSupportTime;

  cell.classList.remove(
    "consonant-cell",
    "vowel-cell",
    "energy-cell",
    "heal-flash"
  );
}
function recordPlantPlacement(type){if(!tutorialMode) plantPlacementCounts[type]=(plantPlacementCounts[type]||0)+1;}
const PLANT_IDLE_MOTION_CLASS = {
  "파열음":"plant-idle-heavy",
  "후음":"plant-idle-heavy",
  "평순모음":"plant-idle-heavy",
  "경구개음":"plant-idle-light",
  "비음":"plant-idle-light",
  "치조음":"plant-idle-light",
  "유음":"plant-idle-flex",
  "마찰음":"plant-idle-flex",
  "연구개음":"plant-idle-flex",
  "에너지식물":"plant-idle-energy",
  "고모음":"plant-idle-soft",
  "중모음":"plant-idle-soft",
  "원순모음":"plant-idle-soft",
  "저모음":"plant-idle-soft",
  "후설모음":"plant-idle-soft",
  "전설모음":"plant-idle-soft"
};

function placePlant(cell,type){
  const data=PLANT_DB[type]; if(!data) return;
  cell.dataset.plant="true"; cell.dataset.plantType=type; cell.dataset.plantHp=data.hp;
  cell.dataset.lastAttack="0"; cell.dataset.lastEnergyTime=Date.now(); cell.dataset.lastSupportTime=Date.now();
  applyPlantCellColor(cell,type);

  const plant=document.createElement("div");
  plant.classList.add("plant", PLANT_IDLE_MOTION_CLASS[type] || "plant-idle-default");

  const imagePath=getPlantImage(type);
  plant.innerHTML=`
  <div class="plant-visual">
    <div class="plant-idle">
      ${imagePath ? `
        <img src="${imagePath}" alt="${getPlantDisplayName(type)}" class="plant-image" draggable="false">
        <div class="plant-image-fallback" aria-hidden="true">🌱</div>
      ` : `<div class="plant-image-fallback visible" aria-hidden="true">🌱</div>`}
    </div>
  </div>
  <div class="plant-name">${getPlantDisplayName(type)}</div>
`;

  const plantImage=plant.querySelector(".plant-image");
  if(plantImage){
    plantImage.addEventListener("error",()=>{
      plantImage.style.display="none";
      const fallback=plant.querySelector(".plant-image-fallback");
      if(fallback) fallback.classList.add("visible");
      console.warn(`식물 이미지 파일을 찾지 못했습니다: ${imagePath}`);
    },{once:true});
  }

  cell.appendChild(plant); recordPlantPlacement(type);
  if(tutorialMode&&type==="에너지식물"&&!tutorialEnergyBonusGiven){
    tutorialEnergyBonusGiven=true;
    setTimeout(()=>{if(!tutorialMode)return;changeEnergy(75);createEffect("소리씨앗 +75",75,25,"heal-effect",900);
      if(tutorialGuideText) tutorialGuideText.innerHTML=`잘했습니다!<br><br>⚡ <strong>소리꽃</strong>이 소리씨앗을 만들기 시작했습니다.<br><br>연습을 이어갈 수 있도록 <strong>소리씨앗 +75</strong>를 추가로 드립니다.<br><br>이제 필요한 공격 식물을 다시 배치해 보세요.`;
    },300);
  }
}
function refreshStartMarkers(){
  const scene=document.querySelector(".battle-scene");
  if(scene)ensureStartMarkers(scene);
}

function createBoard(){
  const keepBossBody=
    raidMode&&raidBoss?.body?.isConnected
      ? raidBoss.body
      : null;

  board.innerHTML="";
  for(let i=0;i<BOARD_ROWS*BOARD_COLUMNS;i++){
    const cell=document.createElement("div"); cell.classList.add("cell"); cell.dataset.index=i;
    cell.addEventListener("click",function(){
      if(gameOver)return;
      if(removeMode){if(cell.dataset.plant==="true") removePlantFromCell(cell,true);return;}
      if(!selectedPlant||cell.dataset.plant==="true")return;
      if(isTutorialGuideBlockingCell(cell))return;
      if(!practiceMode&&energy<selectedCost)return;

      placePlant(cell,selectedPlant);
      playSfx("plant_place");
      onTutorialGuidePlantPlaced(cell,selectedPlant);

      // 연습/테스트 모드에서는 모든 식물의 배치 비용이 0.
      if(!practiceMode){
        changeEnergy(-selectedCost);
      }
    });
    board.appendChild(cell);
  }
  refreshStartMarkers();
  if(keepBossBody){
    board.appendChild(keepBossBody);
    updateRaidBossBodyPosition();
  }
  if(raidMode&&raidBoss?.hud?.isConnected){
    mountRaidBossHud(raidBoss.hud);
  }
}

function getWordFeatures(wordData){
  const features=new Set();
  wordData.phonemes.forEach(phoneme=>{const data=PHONEMES[phoneme];if(data)data.features.forEach(feature=>features.add(feature));});
  return [...features];
}
function getCurrentlyAvailableFeedbackFeatures(){
  const features=new Set();
  unlockedPlants.forEach(type=>{if(type==="에너지식물")return;const data=PLANT_DB[type];if(data&&data.feature)features.add(data.feature);});
  return features;
}
function recordMissedZombie(zombie){
  if(tutorialMode||!zombie||!zombie.wordData)return;
  missedWords.push(zombie.wordData.word);
  const availableFeatures=getCurrentlyAvailableFeedbackFeatures();
  zombie.features.forEach(feature=>{if(availableFeatures.has(feature))missedFeatureCounts[feature]=(missedFeatureCounts[feature]||0)+1;});
}

function createZombie(wordData,baseZombieHP,baseSpeed,enemyType="normal"){
  const row=Math.floor(Math.random()*BOARD_ROWS);
  const enemyData=ENEMY_TYPES[enemyType]||ENEMY_TYPES.normal;
  const actualHP=Math.round(baseZombieHP*enemyData.hpMultiplier);
  const actualSpeed=baseSpeed*enemyData.speedMultiplier;
  const imagePath=getZombieImage(enemyType);

  const element=document.createElement("div");
  element.classList.add("zombie",`zombie-${enemyType}`);
  element.innerHTML=`
    <div class="zombie-word-label">
      <span class="zombie-type-badge">${enemyData.icon}</span>
      <span class="zombie-word-text">${wordData.word}</span>
    </div>
    <div class="zombie-visual">
      <div class="zombie-walk">
        <img src="${imagePath}" alt="${enemyData.name} 좀비" class="zombie-image" draggable="false">
        <div class="zombie-image-fallback" aria-hidden="true">${enemyData.icon}</div>
      </div>
    </div>
    <div class="hp-bar">
      <div class="hp-fill zombie-hp-fill" style="width:100%;"></div>
    </div>
  `;

  const zombieImage=element.querySelector(".zombie-image");
  if(zombieImage){
    zombieImage.addEventListener("error",()=>{
      zombieImage.style.display="none";
      const fallback=element.querySelector(".zombie-image-fallback");
      if(fallback) fallback.classList.add("visible");
      console.warn(`좀비 이미지 파일을 찾지 못했습니다: ${imagePath}`);
    },{once:true});
  }

  const wordText=element.querySelector(".zombie-word-text");
  if(wordText)wordText.style.transition="filter 0.12s linear, opacity 0.12s linear";

  const zombie={wordData,enemyType,enemyName:enemyData.name,features:getWordFeatures(wordData),hp:actualHP,maxHp:actualHP,alive:true,exploded:false,row,x:BOARD_WIDTH+ZOMBIE_APPROACH_DISTANCE,baseSpeed:actualSpeed,biteDamage:enemyData.biteDamage,statusDurationMultiplier:enemyData.statusDurationMultiplier,lastBiteTime:0,lastUpdateTime:Date.now(),frozenUntil:0,slowedUntil:0,slowMultiplier:1,dotEndTime:0,dotNextTick:0,dotTickInterval:0,dotDamage:0,element};
  zombies.push(zombie);board.appendChild(element);updateZombiePosition(zombie);updateZombieApproachAppearance(zombie);
}
function updateZombieApproachAppearance(zombie){
  if(!zombie||!zombie.element)return;const text=zombie.element.querySelector(".zombie-word-text");if(!text)return;
  if(zombie.x<=BOARD_WIDTH){text.style.filter="blur(0px)";text.style.opacity="1";return;}
  const outsideDistance=Math.max(0,zombie.x-BOARD_WIDTH),ratio=Math.min(1,outsideDistance/ZOMBIE_APPROACH_DISTANCE);
  text.style.filter=`blur(${(MAX_APPROACH_BLUR*ratio).toFixed(2)}px)`;text.style.opacity=(1-0.35*ratio).toFixed(2);
}
function spawnZombie(){
  if(gameOver)return;const config=WAVE_CONFIG[currentWave],wordData=getNextWordData(),enemyType=getNextEnemyType();
  if(config&&wordData)createZombie(wordData,config.zombieHP,ZOMBIE_BASE_SPEED,enemyType);
}
function spawnTutorialZombie(){
  if(!tutorialMode||tutorialSpawnIndex>=TUTORIAL_WORDS.length)return;
  const wordData=TUTORIAL_WORDS[tutorialSpawnIndex];
  if(!wordData){console.error("튜토리얼 단어 없음:",tutorialSpawnIndex);return;}
  const currentIndex=tutorialSpawnIndex;
  showTutorialMessage(currentIndex,wordData);
  tutorialSpawnIndex++;
  setTimeout(()=>{
    if(!tutorialMode)return;
    createZombie(wordData,TUTORIAL_CONFIG.zombieHP,TUTORIAL_ZOMBIE_SPEED,"normal");
    const spawned=zombies[zombies.length-1];
    if(spawned&&spawned.alive){
      onTutorialGuideZombieSpawned(currentIndex,spawned.row);
    }
  },3000);
}
function showTutorialMessage(index,wordData){
  tutorialGuide.classList.remove("hidden");
  if(index===0){
    tutorialGuideText.innerHTML=`첫 번째 적은 <strong>${wordData.word}</strong>입니다.<br><br><strong>ㅂ</strong>은 입술을 사용해 소리 내는 <strong>양순음</strong>입니다.<br><br>👉 <strong>양순음 식물</strong>을 적이 오는 레인에 배치해 보세요.`;
    beginTutorialGuideWave(index);
    return;
  }
  if(index===1){
    tutorialGuideText.innerHTML=`이번 단어는 <strong>${wordData.word}</strong>입니다.<br><br>ㄷ과 ㅅ은 <strong>치조음</strong>입니다.<br><br>👉 <strong>치조음 식물</strong>을 활용해 방어해 보세요.`;
    beginTutorialGuideWave(index);
    return;
  }
  if(index===2){
    unlockedPlants.add("에너지식물");if(energy<40){energy=40;energyDisplay.textContent=energy;}updatePlantButtons();
    tutorialGuideText.innerHTML=`앞에서 식물을 배치하면서 <strong>소리씨앗</strong>을 많이 사용했습니다.<br><br>소리씨앗이 부족하면 새로운 식물을 심을 수 없습니다.<br><br>⚡ <strong>소리꽃</strong>은 일정 시간마다 소리씨앗을 만들어냅니다.<br><br>👉 새로 나타난 <strong>소리꽃</strong>을 안전한 뒤쪽에 심어 보세요.`;
    beginTutorialGuideWave(index);
    return;
  }
  tutorialGuideText.innerHTML=`이제 마지막 연습입니다.<br><br>이번에는 정답을 알려주지 않습니다.<br><br><strong>${wordData.word}</strong>에 포함된 음운을 살펴보고 어떤 식물이 공격할 수 있을지 직접 판단해 보세요.<br><br>튜토리얼에서는 적을 놓쳐도 생명이 줄지 않습니다.`;
  beginTutorialGuideWave(index);
}

/* =========================================================
   튜토리얼 유도 화살표 / 강조
   - updateTutorialGuide()가 현재 waveIndex + phase 기준으로 타깃 재계산
   - 배치 타깃은 하드코딩 cell이 아니라 실제 좀비 lane / 요구 구역으로 계산
   ========================================================= */
const TUTORIAL_GUIDE_HIGHLIGHT_CLASS="tutorial-guide-highlight";

/** waveIndex별 유도 설정 (확장 시 여기만 추가) */
const TUTORIAL_GUIDE_STEPS={
  0:{
    plantType:"양순음",
    placeMode:"zombie-lane",
    preferredColumns:[3,4,5,2,1,0]
  },
  1:{
    plantType:"치조음",
    placeMode:"zombie-lane",
    preferredColumns:[3,4,5,2,1,0]
  },
  2:{
    plantType:"에너지식물",
    placeMode:"back-columns",
    preferredColumns:[0,1,2],
    preferredRows:[2,1,3,0,4]
  }
  // 3: 자유 연습 — 유도 없음
};

const tutorialGuideState={
  active:false,
  waveIndex:null,
  phase:"none",       // "select-plant" | "place-plant" | "none"
  plantType:null,
  zombieRow:null,
  cellIndex:null,
  placeRow:null,
  targetEl:null,
  arrowEl:null,
  trackRaf:null,
  onScroll:null,
  onResize:null
};

function ensureTutorialGuideArrow(){
  if(tutorialGuideState.arrowEl&&tutorialGuideState.arrowEl.isConnected){
    return tutorialGuideState.arrowEl;
  }
  const arrow=document.createElement("div");
  arrow.id="tutorial-guide-arrow";
  arrow.className="tutorial-guide-arrow";
  arrow.setAttribute("aria-hidden","true");
  arrow.innerHTML=`<span class="tutorial-guide-arrow-icon">▼</span>`;
  document.body.appendChild(arrow);
  tutorialGuideState.arrowEl=arrow;
  return arrow;
}

function clearTutorialGuideHighlight(){
  document.querySelectorAll("."+TUTORIAL_GUIDE_HIGHLIGHT_CLASS).forEach(el=>{
    el.classList.remove(TUTORIAL_GUIDE_HIGHLIGHT_CLASS);
  });
  tutorialGuideState.targetEl=null;
}

function stopTutorialGuideTracking(){
  if(tutorialGuideState.trackRaf){
    cancelAnimationFrame(tutorialGuideState.trackRaf);
    tutorialGuideState.trackRaf=null;
  }
  if(tutorialGuideState.onScroll){
    window.removeEventListener("scroll",tutorialGuideState.onScroll,true);
    tutorialGuideState.onScroll=null;
  }
  if(tutorialGuideState.onResize){
    window.removeEventListener("resize",tutorialGuideState.onResize);
    tutorialGuideState.onResize=null;
  }
}

function hideTutorialGuideVisual(){
  stopTutorialGuideTracking();
  clearTutorialGuideHighlight();
  if(tutorialGuideState.arrowEl){
    tutorialGuideState.arrowEl.classList.remove("is-visible");
  }
  tutorialGuideState.active=false;
}

function clearTutorialGuide(){
  hideTutorialGuideVisual();
  tutorialGuideState.waveIndex=null;
  tutorialGuideState.phase="none";
  tutorialGuideState.plantType=null;
  tutorialGuideState.zombieRow=null;
  tutorialGuideState.cellIndex=null;
  tutorialGuideState.placeRow=null;
}

function positionTutorialGuideArrow(targetEl){
  const arrow=ensureTutorialGuideArrow();
  if(!targetEl||!targetEl.isConnected||!tutorialMode||!tutorialGuideState.active){
    arrow.classList.remove("is-visible");
    return;
  }
  const rect=targetEl.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0){
    arrow.classList.remove("is-visible");
    return;
  }
  arrow.style.left=(rect.left+rect.width/2)+"px";
  arrow.style.top=(rect.top-6)+"px";
  arrow.classList.add("is-visible");
}

function startTutorialGuideTracking(targetEl){
  stopTutorialGuideTracking();
  tutorialGuideState.targetEl=targetEl;
  const tick=()=>{
    if(!tutorialMode||!tutorialGuideState.active||!tutorialGuideState.targetEl){
      tutorialGuideState.trackRaf=null;
      return;
    }
    positionTutorialGuideArrow(tutorialGuideState.targetEl);
    tutorialGuideState.trackRaf=requestAnimationFrame(tick);
  };
  tutorialGuideState.onScroll=()=>positionTutorialGuideArrow(tutorialGuideState.targetEl);
  tutorialGuideState.onResize=()=>positionTutorialGuideArrow(tutorialGuideState.targetEl);
  window.addEventListener("scroll",tutorialGuideState.onScroll,true);
  window.addEventListener("resize",tutorialGuideState.onResize);
  tutorialGuideState.trackRaf=requestAnimationFrame(tick);
}

function showTutorialGuideForElement(element){
  clearTutorialGuideHighlight();
  stopTutorialGuideTracking();
  if(!element||!tutorialMode){
    if(tutorialGuideState.arrowEl){
      tutorialGuideState.arrowEl.classList.remove("is-visible");
    }
    tutorialGuideState.active=false;
    return;
  }
  element.classList.add(TUTORIAL_GUIDE_HIGHLIGHT_CLASS);
  tutorialGuideState.active=true;
  startTutorialGuideTracking(element);
}

function showTutorialGuideForCell(row,col){
  if(!board) return;
  const index=row*BOARD_COLUMNS+col;
  const cell=board.querySelector(`.cell[data-index="${index}"]`);
  tutorialGuideState.cellIndex=index;
  tutorialGuideState.placeRow=row;
  showTutorialGuideForElement(cell);
}

function getTutorialPlantButton(plantType){
  return document.querySelector(`.plant-button[data-plant="${plantType}"]`);
}

function getTutorialGuideStepConfig(waveIndex=tutorialGuideState.waveIndex){
  if(waveIndex==null) return null;
  return TUTORIAL_GUIDE_STEPS[waveIndex]||null;
}

function resolveTutorialPlaceTarget(step){
  if(!board||!step) return null;

  if(step.placeMode==="zombie-lane"){
    if(tutorialGuideState.zombieRow==null) return null;
    const row=tutorialGuideState.zombieRow;
    const columns=step.preferredColumns||[3,4,5,2,1,0];
    for(const col of columns){
      if(col<0||col>=BOARD_COLUMNS) continue;
      const index=row*BOARD_COLUMNS+col;
      const cell=board.querySelector(`.cell[data-index="${index}"]`);
      if(cell&&cell.dataset.plant!=="true"){
        return {row,col,index,el:cell};
      }
    }
    return null;
  }

  if(step.placeMode==="back-columns"){
    const columns=step.preferredColumns||[0,1,2];
    const rows=step.preferredRows||[2,1,3,0,4];
    for(const row of rows){
      if(row<0||row>=BOARD_ROWS) continue;
      for(const col of columns){
        if(col<0||col>=BOARD_COLUMNS) continue;
        const index=row*BOARD_COLUMNS+col;
        const cell=board.querySelector(`.cell[data-index="${index}"]`);
        if(cell&&cell.dataset.plant!=="true"){
          return {row,col,index,el:cell};
        }
      }
    }
  }

  return null;
}

function updateTutorialGuide(){
  if(!tutorialMode){
    clearTutorialGuide();
    return;
  }

  const step=getTutorialGuideStepConfig();
  if(!step||tutorialGuideState.phase==="none"){
    hideTutorialGuideVisual();
    return;
  }

  if(tutorialGuideState.phase==="select-plant"){
    const button=getTutorialPlantButton(step.plantType);
    showTutorialGuideForElement(button);
    return;
  }

  if(tutorialGuideState.phase==="place-plant"){
    const target=resolveTutorialPlaceTarget(step);
    if(!target){
      // 좀비 lane 미확정 등으로 아직 배치 칸을 못 정함 → 잠시 숨김
      hideTutorialGuideVisual();
      return;
    }
    tutorialGuideState.cellIndex=target.index;
    tutorialGuideState.placeRow=target.row;
    showTutorialGuideForElement(target.el);
  }
}

function beginTutorialGuideWave(waveIndex){
  if(!tutorialMode) return;
  const step=TUTORIAL_GUIDE_STEPS[waveIndex]||null;
  tutorialGuideState.waveIndex=waveIndex;
  tutorialGuideState.zombieRow=null;
  tutorialGuideState.cellIndex=null;
  tutorialGuideState.placeRow=null;
  if(!step){
    tutorialGuideState.phase="none";
    tutorialGuideState.plantType=null;
  }else{
    tutorialGuideState.phase="select-plant";
    tutorialGuideState.plantType=step.plantType;
  }
  updateTutorialGuide();
}

function onTutorialGuideZombieSpawned(waveIndex,row){
  if(!tutorialMode) return;
  if(tutorialGuideState.waveIndex!==waveIndex) return;
  tutorialGuideState.zombieRow=row;
  // 이미 배치 단계면 실제 좀비 lane으로 화살표 재계산
  updateTutorialGuide();
}

function onTutorialGuidePlantSelected(plantType){
  if(!tutorialMode) return;
  if(tutorialGuideState.phase!=="select-plant") return;
  if(plantType!==tutorialGuideState.plantType) return;
  tutorialGuideState.phase="place-plant";
  updateTutorialGuide();
}

function isValidTutorialGuidePlacement(cell,plantType){
  if(tutorialGuideState.phase!=="place-plant") return false;
  if(plantType!==tutorialGuideState.plantType) return false;
  if(isTutorialGuideBlockingCell(cell)) return false;
  return true;
}

function onTutorialGuidePlantPlaced(cell,plantType){
  if(!tutorialMode) return;
  if(!isValidTutorialGuidePlacement(cell,plantType)) return;
  tutorialGuideState.phase="none";
  updateTutorialGuide();
}

function isTutorialGuideBlockingPlant(plantType){
  if(!tutorialMode||tutorialGuideState.phase==="none") return false;
  if(tutorialGuideState.phase==="select-plant"||tutorialGuideState.phase==="place-plant"){
    return plantType!==tutorialGuideState.plantType;
  }
  return false;
}

function isTutorialGuideBlockingCell(cell){
  if(!tutorialMode||tutorialGuideState.phase==="none") return false;
  if(tutorialGuideState.phase==="select-plant") return true;
  if(tutorialGuideState.phase!=="place-plant") return false;

  const step=getTutorialGuideStepConfig();
  if(!step) return false;

  const index=Number(cell.dataset.index);
  const row=Math.floor(index/BOARD_COLUMNS);
  const col=index%BOARD_COLUMNS;

  if(step.placeMode==="zombie-lane"){
    if(tutorialGuideState.zombieRow==null) return true;
    // 같은 레인만 허용 (권장 칸은 화살표로만 표시)
    return row!==tutorialGuideState.zombieRow;
  }

  if(step.placeMode==="back-columns"){
    const allowed=step.preferredColumns||[0,1,2];
    return !allowed.includes(col);
  }

  return false;
}

const ZOMBIE_ATTACK_VISUAL_OFFSET = 24;

function updateZombiePosition(zombie, visualOffsetX=0){
  if(!zombie||!zombie.element)return;
  zombie.element.style.left=(zombie.x+visualOffsetX)+"px";
  zombie.element.style.top=(zombie.row*CELL_SIZE+12)+"px";
}

function playZombieBiteAnimation(zombie,targetCell){
  if(!zombie||!zombie.element||!targetCell)return;

  // 공격 모션: 뒤로 힘을 모았다가 식물 쪽으로 들이치고 다시 반동한다.
  zombie.element.classList.remove("zombie-bite");
  void zombie.element.offsetWidth;
  zombie.element.classList.add("zombie-bite");

  const plant=targetCell.querySelector(".plant");
  if(plant){
    const hitClass=
      zombie.enemyType==="breaker"
        ? "plant-hit-heavy"
        : "plant-hit";

    plant.classList.remove("plant-hit","plant-hit-heavy");
    void plant.offsetWidth;
    plant.classList.add(hitClass);

    setTimeout(()=>{
      if(plant&&plant.isConnected){
        plant.classList.remove("plant-hit","plant-hit-heavy");
      }
    },520);
  }

  setTimeout(()=>{
    if(zombie.element&&zombie.element.isConnected){
      zombie.element.classList.remove("zombie-bite");
    }
  },560);
}
function updateZombieLabelOffsets(){
  const aliveZombies=zombies.filter(z=>z.alive&&z.element);
  aliveZombies.forEach(z=>{const l=z.element.querySelector(":scope > div:first-child");if(l)l.style.top="-14px";});
  for(let row=0;row<BOARD_ROWS;row++){
    const laneZombies=aliveZombies.filter(z=>z.row===row).sort((a,b)=>a.x-b.x);let group=[];
    function applyGroupOffsets(){if(group.length<=1){group=[];return;}const offsets=[-26,-14,-2,-38,10];group.forEach((z,i)=>{const l=z.element.querySelector(":scope > div:first-child");if(l)l.style.top=offsets[i%offsets.length]+"px";});group=[];}
    for(const z of laneZombies){if(!group.length){group.push(z);continue;}const prev=group[group.length-1];if(Math.abs(z.x-prev.x)<=72)group.push(z);else{applyGroupOffsets();group.push(z);}}
    applyGroupOffsets();
  }
}
function getZombieCellIndex(zombie){
  if(zombie.x<0||zombie.x>=BOARD_WIDTH)return -1;const column=Math.floor(zombie.x/CELL_SIZE);if(column<0||column>=BOARD_COLUMNS)return -1;return zombie.row*BOARD_COLUMNS+column;
}
function updateZombieHPBar(zombie){const bar=zombie.element.querySelector(".zombie-hp-fill");if(bar)bar.style.width=Math.max(0,zombie.hp/zombie.maxHp*100)+"%";}
function updatePlantHPBar(cell){
  const type = cell.dataset.plantType;
  if(!type) return;

  const data = PLANT_DB[type];
  const plant = cell.querySelector(".plant");

  if(!data || !plant) return;

  const currentHp = Number(cell.dataset.plantHp);
  const hpRatio = currentHp / data.hp;

  plant.classList.remove(
    "plant-hp-medium",
    "plant-hp-low",
    "plant-hp-critical"
  );

  if(hpRatio <= 0.15){
    plant.classList.add("plant-hp-critical");
  }
  else if(hpRatio <= 0.40){
    plant.classList.add("plant-hp-low");
  }
  else if(hpRatio <= 0.70){
    plant.classList.add("plant-hp-medium");
  }
}

function createHitImpactParticle(zombie,heavy=false){
  if(!zombie||!board) return;
  const pos=getZombieHitVfxPosition(zombie);
  const spark=document.createElement("div");
  spark.className=heavy
    ? "hit-impact-spark hit-impact-heavy"
    : "hit-impact-spark";
  spark.style.left=pos.x+"px";
  spark.style.top=pos.y+"px";
  board.appendChild(spark);
  setTimeout(()=>{
    if(spark.parentElement) spark.remove();
  },heavy?240:180);
}

function triggerZombieHitVisual(zombie,extraClass=""){
  if(!zombie||!zombie.alive||!zombie.element)return;

  const heavy=
    extraClass==="heavy-number" ||
    extraClass==="sniper-number";

  const dot=extraClass==="dot-number";

  zombie.element.classList.remove(
    "zombie-hit",
    "zombie-hit-heavy",
    "zombie-hit-dot"
  );

  void zombie.element.offsetWidth;

  zombie.element.classList.add(
    heavy
      ? "zombie-hit-heavy"
      : dot
        ? "zombie-hit-dot"
        : "zombie-hit"
  );

  if(zombie.hitVisualTimer){
    clearTimeout(zombie.hitVisualTimer);
  }

  // flash/knockback만 짧게 — zombie.x / 이동 로직은 변경하지 않음
  zombie.hitVisualTimer=setTimeout(()=>{
    if(!zombie.element)return;
    zombie.element.classList.remove(
      "zombie-hit",
      "zombie-hit-heavy",
      "zombie-hit-dot"
    );
  },heavy?280:dot?140:160);
}

function damageZombie(zombie,damage,extraClass=""){
  if(!zombie||!zombie.alive)return false;

  const heavy=
    extraClass==="heavy-number" ||
    extraClass==="sniper-number";

  triggerZombieHitVisual(zombie,extraClass);
  if(extraClass!=="dot-number"){
    createHitImpactParticle(zombie,heavy);
  }
  createDamageNumber(zombie,damage,extraClass);
  zombie.hp-=damage;
  updateZombieHPBar(zombie);

  if(zombie.hp<=0){
    killZombie(zombie);
    return true;
  }

  return false;
}
function triggerBomberExplosion(zombie){
  if(!zombie||zombie.exploded||zombie.enemyType!=="bomber")return;zombie.exploded=true;const data=ENEMY_TYPES.bomber;
  const explosionX=zombie.x+ZOMBIE_WIDTH/2,explosionY=zombie.row*CELL_SIZE+CELL_SIZE/2;
  createEffect("💣💥",zombie.x+5,zombie.row*CELL_SIZE+5,"heavy-effect",800);createEffect("💥",zombie.x-20,zombie.row*CELL_SIZE-10,"explosion-effect",850);
  const cells=board.querySelectorAll(".cell");
  cells.forEach((cell,index)=>{if(cell.dataset.plant!=="true")return;const row=Math.floor(index/BOARD_COLUMNS),column=index%BOARD_COLUMNS;const px=column*CELL_SIZE+CELL_SIZE/2,py=row*CELL_SIZE+CELL_SIZE/2;const distance=Math.hypot(px-explosionX,py-explosionY);if(distance>data.explosionRadius)return;let damage=distance<=data.explosionInnerRadius?data.explosionInnerDamage:data.explosionOuterDamage;damage*=1-getShieldReduction(index,cells);let hp=Number(cell.dataset.plantHp)-damage;cell.dataset.plantHp=hp;updatePlantHPBar(cell);createPlantDamageNumber(index,damage);createEffect("🔥",column*CELL_SIZE+25,row*CELL_SIZE+20,"explosion-effect",550);if(hp<=0)removePlantFromCell(cell,false);});
}
function killZombie(zombie){
  if(!zombie||!zombie.alive)return;

  playSfx("zombie_defeat");

  if(zombie.enemyType==="bomber"){
    triggerBomberExplosion(zombie);
  }

  /* 게임 판정에서는 즉시 사망 처리하되,
     화면에서는 짧은 퇴장 모션 후 제거한다. */
  zombie.alive=false;

  if(zombie.element&&zombie.element.parentElement){
    zombie.element.classList.remove(
      "zombie-attacking",
      "zombie-biting",
      "zombie-hit",
      "zombie-hit-heavy"
    );

    zombie.element.classList.add(
      "zombie-dying",
      zombie.enemyType==="bomber"
        ? "zombie-dying-bomber"
        : "zombie-dying-normal"
    );

    setTimeout(()=>{
      if(zombie.element&&zombie.element.parentElement){
        zombie.element.remove();
      }
    },zombie.enemyType==="bomber" ? 300 : 430);
  }

  resolvedZombies++;

  if(!tutorialMode){
    score+=100;
    scoreDisplay.textContent=score;

    if(KILL_ENERGY_REWARD>0){
      changeEnergy(KILL_ENERGY_REWARD);
    }
  }

  checkRoundEnd();
}

function getCompatibleTargets(row,feature,column){const plantX=column*CELL_SIZE;return zombies.filter(z=>z.alive&&z.row===row&&z.x<BOARD_WIDTH&&z.x>=plantX&&z.features.includes(feature)).sort((a,b)=>a.x-b.x);}
function getAllLaneTargetsAhead(row,column){const plantX=column*CELL_SIZE;return zombies.filter(z=>z.alive&&z.row===row&&z.x<BOARD_WIDTH&&z.x>=plantX).sort((a,b)=>a.x-b.x);}
function isSupportActive(index,feature){
  if(raidMode&&raidBoss&&raidBoss.alive)return raidBoss.features.includes(feature);
  const row=Math.floor(index/BOARD_COLUMNS),column=index%BOARD_COLUMNS;return getCompatibleTargets(row,feature,column).length>0;
}
function getNearbyCellIndices(index,radius=1){
  const row=Math.floor(index/BOARD_COLUMNS),column=index%BOARD_COLUMNS,result=[];
  for(let r=row-radius;r<=row+radius;r++)for(let c=column-radius;c<=column+radius;c++){if(r>=0&&r<BOARD_ROWS&&c>=0&&c<BOARD_COLUMNS)result.push(r*BOARD_COLUMNS+c);}return result;
}
function updateSupportVisuals(cells){
  cells.forEach(cell=>{const plant=cell.querySelector(".plant");if(plant){plant.classList.remove("speed-buffed");plant.classList.remove("shielded");}});
  cells.forEach((supportCell,supportIndex)=>{const type=supportCell.dataset.plantType;if(type!=="고모음"&&type!=="원순모음")return;const data=PLANT_DB[type];if(!isSupportActive(supportIndex,data.feature))return;getNearbyCellIndices(supportIndex,data.special.radius).forEach(targetIndex=>{const targetPlant=cells[targetIndex].querySelector(".plant");if(!targetPlant)return;if(type==="고모음")targetPlant.classList.add("speed-buffed");if(type==="원순모음")targetPlant.classList.add("shielded");});});
}
function getAttackSpeedMultiplier(targetIndex,cells){let multiplier=1;cells.forEach((supportCell,supportIndex)=>{if(supportCell.dataset.plantType!=="고모음")return;const data=PLANT_DB["고모음"];if(!isSupportActive(supportIndex,data.feature))return;if(getNearbyCellIndices(supportIndex,data.special.radius).includes(targetIndex))multiplier=Math.min(multiplier,data.special.multiplier);});return multiplier;}
function getShieldReduction(targetIndex,cells){let reduction=0;cells.forEach((supportCell,supportIndex)=>{if(supportCell.dataset.plantType!=="원순모음")return;const data=PLANT_DB["원순모음"];if(!isSupportActive(supportIndex,data.feature))return;if(getNearbyCellIndices(supportIndex,data.special.radius).includes(targetIndex))reduction=Math.max(reduction,data.special.damageReduction);});return reduction;}

function getGlobalChainTargets(primary,feature,maxTargets){
  const others=zombies.filter(z=>z.alive&&z!==primary&&z.x<BOARD_WIDTH&&z.features.includes(feature)).sort((a,b)=>Math.hypot(a.x-primary.x,(a.row-primary.row)*CELL_SIZE)-Math.hypot(b.x-primary.x,(b.row-primary.row)*CELL_SIZE));
  return [primary,...others.slice(0,maxTargets-1)];
}


// ============================================
// 식물 발사 반동 모션
// ============================================
const PLANT_FIRE_MOTION_CLASS = {
  "양순음":"plant-fire-light",
  "치조음":"plant-fire-light",
  "비음":"plant-fire-burst",
  "파열음":"plant-fire-heavy",
  "유음":"plant-fire-chain",
  "마찰음":"plant-fire-dot",
  "연구개음":"plant-fire-pierce",
  "파찰음":"plant-fire-heavy",
  "경구개음":"plant-fire-volley",
  "후음":"plant-fire-sniper"
};

function triggerPlantFireMotion(row,column,plantType){
  const index=row*BOARD_COLUMNS+column;
  const cells=board.querySelectorAll(".cell");
  const cell=cells[index];
  if(!cell || cell.dataset.plantType!==plantType)return;

  const plant=cell.querySelector(".plant");
  if(!plant)return;

  const motionClass=PLANT_FIRE_MOTION_CLASS[plantType]||"plant-fire-light";
  const allClasses=[
    "plant-firing",
    "plant-fire-light",
    "plant-fire-burst",
    "plant-fire-heavy",
    "plant-fire-chain",
    "plant-fire-dot",
    "plant-fire-pierce",
    "plant-fire-volley",
    "plant-fire-sniper"
  ];

  plant.classList.remove(...allClasses);
  void plant.offsetWidth;
  plant.classList.add("plant-firing",motionClass);

  const duration=
    motionClass==="plant-fire-heavy" ? 380 :
    motionClass==="plant-fire-sniper" ? 340 :
    motionClass==="plant-fire-chain" ? 300 :
    motionClass==="plant-fire-dot" ? 300 :
    motionClass==="plant-fire-pierce" ? 300 :
    motionClass==="plant-fire-light" ? 260 :
    220;

  setTimeout(()=>{
    if(!plant.isConnected)return;
    plant.classList.remove("plant-firing",motionClass);
  },duration);
}

function performNormalAttack(row,column,target,data){
  const type=data.feature;

  triggerPlantFireMotion(row,column,type);

  createFlyingProjectile(
    row,
    column,
    target,
    type,
    hitTarget=>{
      if(!hitTarget.alive)return;

      damageZombie(
        hitTarget,
        data.damage,
        data.attackType==="heavy"?"heavy-number":""
      );

      const pos=getZombieHitVfxPosition(hitTarget);
      createProjectileHitVfx(
        type,
        pos.x,
        pos.y,
        {duration:data.attackType==="heavy"?380:280}
      );
    }
  );
}

function performBurstAttack(row,column,target,data){
  for(let i=0;i<data.special.shots;i++){
    setTimeout(()=>{
      if(!target.alive)return;

      const final=i===data.special.shots-1;
      const damage=final
        ? (data.special.finalShotDamage??data.damage*2.5)
        : data.damage;

      triggerPlantFireMotion(row,column,data.feature);

      createFlyingProjectile(
        row,
        column,
        target,
        data.feature,
        hitTarget=>{
          if(!hitTarget.alive)return;

          const impactX=hitTarget.x;
          const impactRow=hitTarget.row;

          damageZombie(
            hitTarget,
            damage,
            final?"heavy-number":""
          );

          const pos=getZombieHitVfxPosition(hitTarget);
          createProjectileHitVfx(
            data.feature,
            pos.x,
            pos.y,
            {
              shotIndex:i,
              isFinal:final,
              duration:final?420:240
            }
          );

          if(final&&data.special.splashDamage&&data.special.splashRadius){
            createEffect("💫",impactX+15,impactRow*CELL_SIZE+20,"explosion-effect",500);
            zombies.forEach(z=>{
              if(!z.alive||z===hitTarget||z.x>=BOARD_WIDTH)return;
              const distance=Math.hypot(z.x-impactX,(z.row-impactRow)*CELL_SIZE);
              if(distance<=data.special.splashRadius){
                damageZombie(z,data.special.splashDamage);
                createEffect("✹",z.x+20,z.row*CELL_SIZE+25,"explosion-effect",350);
              }
            });
          }
        },
        final?{size:36,scale:1.08}:{size:28,scale:.94}
      );
    },i*data.special.spacing);
  }
}

function performChainAttack(row,column,targets,data){
  const primary=targets[0];
  if(!primary)return;

  triggerPlantFireMotion(row,column,data.feature);

  createFlyingProjectile(
    row,
    column,
    primary,
    data.feature,
    hitTarget=>{
      if(!hitTarget.alive)return;

      getGlobalChainTargets(
        hitTarget,
        data.feature,
        data.special.maxTargets
      ).forEach((chainTarget,index)=>{
        if(!chainTarget.alive)return;
        const chainPos=getZombieHitVfxPosition(chainTarget);
        createProjectileHitVfx(
          data.feature,
          chainPos.x,
          chainPos.y,
          {isChain:index>0,duration:index===0?320:360}
        );
        damageZombie(
          chainTarget,
          data.damage*(data.special.damageRatios[index]??0.4)
        );
      });
    }
  );
}

function performDotAttack(row,column,target,data){
  triggerPlantFireMotion(row,column,data.feature);

  createFlyingProjectile(
    row,
    column,
    target,
    data.feature,
    hitTarget=>{
      if(!hitTarget.alive)return;

      damageZombie(hitTarget,data.damage);
      if(!hitTarget.alive)return;

      hitTarget.dotEndTime=Date.now()+data.special.duration*1000;
      hitTarget.dotNextTick=Date.now()+data.special.tickInterval*1000;
      hitTarget.dotTickInterval=data.special.tickInterval*1000;
      hitTarget.dotDamage=data.special.tickDamage;

      const pos=getZombieHitVfxPosition(hitTarget);
      createProjectileHitVfx(data.feature,pos.x,pos.y,{duration:340});
    }
  );
}

function performPierceAttack(row,column,data){
  const triggerTargets=getCompatibleTargets(row,data.feature,column);
  if(!triggerTargets.length)return;

  const primary=triggerTargets[0];

  triggerPlantFireMotion(row,column,data.feature);

  createFlyingProjectile(
    row,
    column,
    primary,
    data.feature,
    hitTarget=>{
      if(!hitTarget.alive)return;

      const targets=getAllLaneTargetsAhead(row,column);
      if(!targets.length)return;

      createPierceTrail(row,column,targets);

      targets.forEach((target,index)=>{
        if(!target.alive)return;
        const ratio=index<data.special.damageRatios.length
          ? data.special.damageRatios[index]
          : (data.special.extraTargetRatio??0.3);

        const pos=getZombieHitVfxPosition(target);
        createProjectileHitVfx(data.feature,pos.x,pos.y,{duration:300});
        damageZombie(target,data.damage*ratio);
      });
    }
  );
}

function performDeathBurstAttack(row,column,target,data){
  triggerPlantFireMotion(row,column,data.feature);

  createFlyingProjectile(
    row,
    column,
    target,
    data.feature,
    hitTarget=>{
      if(!hitTarget.alive)return;

      const targetX=hitTarget.x;
      const targetRow=hitTarget.row;
      const killed=damageZombie(hitTarget,data.damage);

      if(!killed){
        const pos=getZombieHitVfxPosition(hitTarget);
        createProjectileHitVfx(data.feature,pos.x,pos.y,{duration:280});
        return;
      }

      const killPos=getZombieHitVfxPosition(hitTarget);
      createProjectileHitVfx(
        data.feature,
        killPos.x,
        killPos.y,
        {isFinal:true,duration:420}
      );

      zombies.forEach(z=>{
        if(!z.alive||z.x>=BOARD_WIDTH||!z.features.includes(data.feature))return;
        if(Math.hypot(z.x-targetX,(z.row-targetRow)*CELL_SIZE)<=data.special.radius){
          damageZombie(z,data.special.explosionDamage);
        }
      });
    }
  );
}

function performVolleyAttack(row,column,data){
  let previousTarget=null;

  for(let i=0;i<data.special.shots;i++){
    setTimeout(()=>{
      if(gameOver||raidMode)return;

      const targets=getCompatibleTargets(row,data.feature,column);
      if(!targets.length)return;

      const target=targets[0];

      if(previousTarget&&previousTarget!==target){
        createEffect("🎯",target.x+20,target.row*CELL_SIZE+15,"retarget-effect",350);
      }
      previousTarget=target;

      triggerPlantFireMotion(row,column,data.feature);

      createFlyingProjectile(
        row,
        column,
        target,
        data.feature,
        hitTarget=>{
          if(!hitTarget.alive)return;
          const pos=getZombieHitVfxPosition(hitTarget);
          createProjectileHitVfx(
            data.feature,
            pos.x,
            pos.y,
            {duration:180}
          );
          damageZombie(hitTarget,data.damage);
        },
        {size:27,scale:.9}
      );
    },i*data.special.spacing);
  }
}

function performSniperAttack(row,column,targets,data){
  if(!targets.length)return;

  const target=[...targets].sort((a,b)=>
    b.hp!==a.hp?b.hp-a.hp:a.x-b.x
  )[0];

  createEffect("🎯",target.x+25,target.row*CELL_SIZE+20,"sniper-target-effect",350);

  setTimeout(()=>{
    if(!target.alive||gameOver||raidMode)return;

    triggerPlantFireMotion(row,column,data.feature);

    createFlyingProjectile(
      row,
      column,
      target,
      data.feature,
      hitTarget=>{
        if(!hitTarget.alive)return;
        const pos=getZombieHitVfxPosition(hitTarget);
        createProjectileHitVfx(data.feature,pos.x,pos.y,{duration:400});
        damageZombie(hitTarget,data.damage,"heavy-number");
      },
      {size:44,scale:1.03}
    );
  },300);
}

function mountRaidBossHud(hud){
  if(!hud) return;

  const dock=ensureRaidHudDock();
  if(dock){
    if(hud.parentElement!==dock) dock.appendChild(hud);
    dock.classList.add("is-active");
  }

  hud.classList.add("raid-boss-hud-compact");
  hud.style.removeProperty("position");
  hud.style.removeProperty("top");
  hud.style.removeProperty("left");
  hud.style.removeProperty("right");
  hud.style.removeProperty("transform");
  hud.style.removeProperty("margin");
  hud.style.removeProperty("margin-bottom");
  hud.style.removeProperty("z-index");
  hud.style.removeProperty("width");
  hud.style.removeProperty("max-width");
  hud.style.removeProperty("padding");
  hud.style.removeProperty("border");
  hud.style.removeProperty("border-radius");
  hud.style.removeProperty("background");
  hud.style.removeProperty("box-shadow");
  hud.style.removeProperty("text-align");
  hud.style.pointerEvents="auto";
}

function wireRaidBossImage(body){
  const bossImage=body.querySelector(".raid-boss-image");
  const fallback=body.querySelector(".raid-boss-image-fallback");
  const showFallback=()=>{
    if(bossImage) bossImage.style.display="none";
    if(fallback) fallback.classList.add("visible");
  };

  if(!bossImage){
    showFallback();
    return;
  }

  const verifyLoaded=()=>{
    if(!bossImage.naturalWidth){
      showFallback();
      console.warn(`보스 이미지 파일을 찾지 못했습니다: ${BOSS_IMAGE}`);
    }
  };

  bossImage.addEventListener("error",verifyLoaded,{once:true});
  bossImage.addEventListener("load",verifyLoaded,{once:true});
  if(bossImage.complete){
    verifyLoaded();
  }
}

function createRaidBossBodyElement(){
  const body=document.createElement("div");
  body.id="raid-boss-body";

  body.style.position="absolute";
  body.style.width=(CELL_SIZE-10)+"px";
  body.style.height=(BOARD_ROWS*CELL_SIZE-8)+"px";
  body.style.display="flex";
  body.style.alignItems="center";
  body.style.justifyContent="center";
  body.style.zIndex="16";
  body.style.pointerEvents="none";
  body.style.overflow="visible";

  body.innerHTML=`
    <div class="raid-boss-visual">
      <img
        src="${BOSS_IMAGE}"
        alt="FINAL BOSS"
        class="raid-boss-image"
        draggable="false"
      >
      <div class="raid-boss-image-fallback" aria-hidden="true">👹</div>
    </div>
  `;

  wireRaidBossImage(body);
  return body;
}

function ensureRaidBossVisual(){
  if(!raidMode||!raidBoss||!board) return;

  if(!raidBoss.hud||!raidBoss.hud.isConnected){
    const hud=document.createElement("div");
    hud.id="raid-boss-hud";
    hud.className="raid-boss-hud-compact";
    hud.style.pointerEvents="none";

    hud.innerHTML=`
      <div class="raid-hud-meta">
        <span class="raid-hud-title">👑 FINAL BOSS</span>
        <span class="raid-hud-sep">·</span>
        <span class="raid-word">-</span>
        <span class="raid-hud-sep">·</span>
        <span class="raid-countdown">단어 변경까지 20초</span>
      </div>
      <div class="raid-hud-hp-row">
        <div class="raid-hp-track">
          <div class="raid-hp-trail"></div>
          <div class="raid-hp-fill"></div>
        </div>
        <span class="raid-hp-text">${RAID_CONFIG.maxHp} / ${RAID_CONFIG.maxHp}</span>
      </div>
      <div class="raid-status"></div>
    `;

    mountRaidBossHud(hud);
    raidBoss.hud=hud;
  }

  mountRaidBossHud(raidBoss.hud);

  if(!raidBoss.body||!raidBoss.body.isConnected){
    raidBoss.body=createRaidBossBodyElement();
    board.appendChild(raidBoss.body);
  }

  updateRaidBossBodyPosition();
  updateRaidBossUI();
}

function createRaidBossElement(){
  ensureRaidBossVisual();
  return {
    hud:raidBoss?.hud||null,
    body:raidBoss?.body||null
  };
}

function updateRaidBossBodyPosition(){
  if(!raidBoss||!raidBoss.body)return;

  // 실제 충돌 판정 위치는 그대로 두고
  // 보스 그림만 왼쪽으로 24px 이동
  const visualOffsetX = -24;

  raidBoss.body.style.left =
    (raidBoss.x - CELL_SIZE / 2 + visualOffsetX) + "px";

  raidBoss.body.style.top = "4px";
}

function triggerRaidBossBite(blockingCells){
  if(!raidBoss || !raidBoss.body) return;

  // 보스는 일반 좀비보다 긴 예비동작과 큰 전진 반동을 사용한다.
  raidBoss.body.classList.remove("raid-boss-bite");
  void raidBoss.body.offsetWidth;
  raidBoss.body.classList.add("raid-boss-bite");

  setTimeout(() => {
    if(raidBoss && raidBoss.body && raidBoss.body.isConnected){
      raidBoss.body.classList.remove("raid-boss-bite");
    }
  }, 720);

  blockingCells.forEach(target => {
    const plant = target.cell.querySelector(".plant");
    if(!plant) return;

    plant.classList.remove("plant-hit","plant-hit-heavy","plant-hit-boss","raid-boss-hit");
    void plant.offsetWidth;
    plant.classList.add("plant-hit-boss");

    setTimeout(() => {
      if(plant && plant.isConnected){
        plant.classList.remove("plant-hit-boss");
      }
    }, 620);
  });
}

function triggerRaidBossShockwaveMotion(){
  if(!raidBoss || !raidBoss.body) return;

  raidBoss.body.classList.remove("raid-boss-shockwave");
  void raidBoss.body.offsetWidth;
  raidBoss.body.classList.add("raid-boss-shockwave");

  setTimeout(() => {
    if(raidBoss && raidBoss.body && raidBoss.body.isConnected){
      raidBoss.body.classList.remove("raid-boss-shockwave");
    }
  }, 650);
}

function setRaidBossWalking(isWalking){
  if(!raidBoss || !raidBoss.body) return;

  raidBoss.body.classList.toggle(
    "raid-boss-walking",
    isWalking
  );
}

function setRaidBossMotionPaused(isPaused){
  if(!raidBoss || !raidBoss.body) return;

  // walking 클래스를 제거하지 않고 현재 애니메이션 프레임 자체를 멈춘다.
  // CC 종료 시 같은 위치/자세에서 자연스럽게 이어지므로 순간 위치 점프를 막는다.
  raidBoss.body.classList.toggle(
    "raid-boss-motion-paused",
    isPaused
  );
}

function updateRaidBossStatusVisuals(now=Date.now()){
  if(!raidBoss || !raidBoss.body) return;

  raidBoss.body.classList.toggle(
    "raid-boss-slowed-visual",
    raidBoss.slowedUntil > now
  );

  raidBoss.body.classList.toggle(
    "raid-boss-frozen-visual",
    raidBoss.frozenUntil > now
  );
}

function triggerRaidBossStatusBurst(type){
  if(!raidBoss || !raidBoss.alive) return;

  const bossX = raidBoss.x - 55;
  const bossY = 55 + Math.random() * 80;

  if(type === "후설모음"){
    createEffect(
      "🐌",
      bossX,
      bossY,
      "raid-status-slow-effect",
      900
    );
  }

  if(type === "저모음" || type === "전설모음"){
    createEffect(
      type === "전설모음" ? "❄❄" : "🧊",
      bossX,
      bossY,
      "raid-status-freeze-effect",
      900
    );
  }
}

function updateRaidBossUI(now=Date.now()){
  if(!raidBoss||!raidBoss.hud)return;

  const hpFill=raidBoss.hud.querySelector(".raid-hp-fill");
  const hpTrail=raidBoss.hud.querySelector(".raid-hp-trail");
  const hpText=raidBoss.hud.querySelector(".raid-hp-text");
  const word=raidBoss.hud.querySelector(".raid-word");
  const countdown=raidBoss.hud.querySelector(".raid-countdown");
  const status=raidBoss.hud.querySelector(".raid-status");

  const hpPct=Math.max(0,raidBoss.hp/raidBoss.maxHp*100);

  if(hpFill){
    hpFill.style.width=hpPct+"%";
  }

  // 현재 HP는 즉시 줄고, trail만 0.2초 늦게 따라옴 (매 프레임 transition 리셋 금지)
  if(hpTrail){
    const prevHpPct=raidBoss.uiHpPct;
    if(prevHpPct===undefined){
      hpTrail.style.transition="none";
      hpTrail.style.width=hpPct+"%";
    }else if(hpPct<prevHpPct){
      hpTrail.style.transition="width 0.2s linear";
      hpTrail.style.width=hpPct+"%";
    }else if(hpPct>prevHpPct){
      hpTrail.style.transition="none";
      hpTrail.style.width=hpPct+"%";
    }
    raidBoss.uiHpPct=hpPct;
  }

  if(hpText){
    hpText.textContent=`${Math.max(0,Math.ceil(raidBoss.hp))} / ${raidBoss.maxHp}`;
  }

  if(word&&raidBoss.wordData){
    word.textContent=raidBoss.wordData.word;
  }

  if(countdown){
    const remaining=Math.max(0,raidBoss.nextWordChangeAt-now);
    countdown.textContent=`단어 변경까지 ${Math.ceil(remaining/1000)}초`;
  }

  if(status){
    const statuses=[];
    if(raidBoss.frozenUntil>now)statuses.push("❄ 행동 정지");
    if(raidBoss.slowedUntil>now)statuses.push("🐌 이동 둔화");
    if(raidBoss.attackingPlant){
      statuses.push("💢 진로 방해 식물 공격 중");

      if(raidBoss.wallCount>0){
        statuses.push(
          `🧱 평순 방벽 ${raidBoss.wallCount}개 · 공격 간격 ${(raidBoss.currentBiteInterval/1000).toFixed(2)}초`
        );
      }
    }
    // 빈 문자열이면 :empty로 높이가 접히므로 nbsp로 슬롯 유지
    status.textContent=statuses.length?statuses.join(" · "):"\u00A0";
  }

  updateRaidBossStatusVisuals(now);
  updateRaidBossBodyPosition();
}

function changeRaidBossWord(now=Date.now()){
  if(!raidMode||!raidBoss||!raidBoss.alive)return;
  const wordData=getNextRaidWord();
  if(!wordData)return;

  const isWordSwitch=!!raidBoss.wordData;

  raidBoss.wordData=wordData;
  raidBoss.features=getWordFeatures(wordData);
  raidLiquidResonance=0;
  raidBoss.nextWordChangeAt=now+RAID_CONFIG.wordChangeInterval;
  raidBoss.wordWarnForChangeAt=null;

  // 전환 시 경고 문구가 남아 있으면 즉시 제거
  clearBossWordWarningElements();

  createEffect(
    "단어 변경!",
    RAID_WORD_ALERT_POS.x,
    RAID_WORD_ALERT_POS.y,
    "raid-alert-text raid-collapse-effect",
    850
  );
  updateRaidBossUI(now);

  // 첫 단어 세팅이 아닌 실제 전환 순간에만 강조/전환음
  if(isWordSwitch){
    playBossWordSwitchEffect();
  }
}

/** 실제 nextWordChangeAt 기준 3초 전 경고 1회 */
function processRaidWordChangeWarning(now=Date.now()){
  if(!raidMode||!raidBoss||!raidBoss.alive) return;
  if(!raidBoss.wordData||!raidBoss.nextWordChangeAt) return;

  const changeAt=raidBoss.nextWordChangeAt;
  const remaining=changeAt-now;
  if(remaining>RAID_WORD_WARN_AHEAD_MS||remaining<=0) return;
  if(raidBoss.wordWarnForChangeAt===changeAt) return;

  raidBoss.wordWarnForChangeAt=changeAt;
  showBossWordWarning();
}

function clearBossWordWarningElements(){
  if(raidBossWordWarnTimer){
    clearTimeout(raidBossWordWarnTimer);
    raidBossWordWarnTimer=null;
  }
  document.querySelectorAll(".raid-word-warn").forEach((el)=>el.remove());
}

function clearRaidBossWordChangeFx(){
  clearBossWordWarningElements();
  document.querySelectorAll(".raid-word.raid-word-switch-pulse").forEach((el)=>{
    el.classList.remove("raid-word-switch-pulse");
  });
  if(raidBoss){
    raidBoss.wordWarnForChangeAt=null;
  }
}

function showBossWordWarning(){
  if(!board) return;

  clearBossWordWarningElements();

  // 단어 변경! 과 동일 좌표 / attack-effect transform 기준
  const warn=document.createElement("div");
  warn.className="attack-effect raid-word-warn raid-alert-text";
  warn.textContent="단어 변경 임박!";
  warn.setAttribute("aria-hidden","true");
  warn.style.left=RAID_WORD_ALERT_POS.x+"px";
  warn.style.top=RAID_WORD_ALERT_POS.y+"px";
  board.appendChild(warn);

  // SFX: sounds/boss_word_warn.wav 추가 후 SFX_FILES에 등록하면 재생됨
  playSfx("boss_word_warn");

  // 3초 동안 유지 (실제 변경 시 clearBossWordWarningElements로 즉시 제거)
  raidBossWordWarnTimer=setTimeout(()=>{
    if(warn.parentElement) warn.remove();
    raidBossWordWarnTimer=null;
  },RAID_WORD_WARN_AHEAD_MS);
}

function playBossWordSwitchEffect(){
  const word=raidBoss?.hud?.querySelector(".raid-word");
  if(word){
    word.classList.remove("raid-word-switch-pulse");
    void word.offsetWidth;
    word.classList.add("raid-word-switch-pulse");
    setTimeout(()=>{
      if(word.isConnected) word.classList.remove("raid-word-switch-pulse");
    },380);
  }

  // SFX: sounds/boss_word_switch.wav 추가 후 SFX_FILES에 등록하면 재생됨
  playSfx("boss_word_switch");
}

function createRaidDamageNumber(damage,extraClass=""){
  if(!raidBoss||!raidBoss.alive||!board)return;

  // 연속 타격 시 과도한 숫자 겹침 방지 (데미지 합산 없음)
  const activeNumbers=board.querySelectorAll(".raid-damage-number");
  if(activeNumbers.length>=8){
    activeNumbers[0].remove();
  }

  raidDamageSerial++;

  const number=document.createElement("div");
  number.classList.add("damage-number","raid-damage-number");
  if(extraClass)number.classList.add(extraClass);

  const displayDamage=Math.max(1,Math.round(damage));
  number.textContent=`-${displayDamage}`;

  const isHeavy=
    extraClass==="heavy-number" ||
    extraClass==="sniper-number";
  const isDot=extraClass==="dot-number";
  // Boss visual spawn — X ±20~35, Y ±8~15; slot stagger reduces overlap
  const bossVisualCenterX=raidBoss.x-29;
  const bossVisualCenterY=92;
  const xSlots=[-32,-24,-18,18,24,32];
  const ySlots=[-12,-6,2,8,14,-10];
  const phase=raidDamageSerial%xSlots.length;
  const offsetX=xSlots[phase]+((Math.random()*8)-4);
  const offsetY=ySlots[phase]+((Math.random()*6)-3);
  const risePx=-(35+Math.random()*20);
  const driftPx=(Math.random()*12)-6;
  const duration=isDot
    ? 0.48+Math.random()*0.08
    : isHeavy
      ? 0.58+Math.random()*0.1
      : 0.52+Math.random()*0.12;

  number.style.left=(bossVisualCenterX+offsetX)+"px";
  number.style.top=(bossVisualCenterY+offsetY)+"px";
  number.style.setProperty("--raid-damage-drift",driftPx+"px");
  number.style.setProperty("--raid-damage-rise",risePx+"px");
  number.style.animationDuration=duration+"s";
  number.style.zIndex="58";

  if(isHeavy) number.classList.add("raid-damage-heavy");
  if(isDot) number.classList.add("raid-damage-dot");

  board.appendChild(number);
  setTimeout(()=>number.remove(),Math.ceil(duration*1000)+40);
}
function createRaidBossHitImpact(heavy=false){
  if(!raidMode||!raidBoss||!raidBoss.alive||!board)return;

  const now=Date.now();
  const activeCount=board.querySelectorAll(".raid-boss-hit-impact").length;

  // 동시 파티클 과다 겹침 방지
  if(activeCount>=(heavy?4:3))return;
  if(!heavy&&now<(raidBoss.hitImpactCooldownUntil||0))return;
  if(heavy&&now<(raidBoss.hitImpactHeavyCooldownUntil||0))return;

  raidBoss.hitImpactCooldownUntil=now+(heavy?45:70);
  if(heavy) raidBoss.hitImpactHeavyCooldownUntil=now+55;

  const spark=document.createElement("div");
  spark.className=heavy
    ? "raid-boss-hit-impact raid-boss-hit-impact-heavy"
    : "raid-boss-hit-impact";

  // 보스 본체 left는 그대로 두고, 피격 지점만 보드 좌표로 표시
  const jitterX=(Math.random()*12)-6;
  const row=Math.floor(Math.random()*BOARD_ROWS);
  const pos=getRaidHitVfxPosition(row);
  spark.style.left=(pos.x+jitterX)+"px";
  spark.style.top=(pos.y+(Math.random()*10)-5)+"px";

  board.appendChild(spark);
  setTimeout(()=>{
    if(spark.parentElement)spark.remove();
  },heavy?240:180);
}

function triggerRaidBossHitVisual(extraClass=""){
  if(!raidMode||!raidBoss||!raidBoss.alive||!raidBoss.body)return;
  if(raidBoss.entering)return;

  const heavy=
    extraClass==="heavy-number" ||
    extraClass==="sniper-number";
  const now=Date.now();

  // flash 없음 — recoil만, 짧은 쿨다운으로 과도한 반복 방지
  if(now<(raidBoss.hitVisualCooldownUntil||0))return;
  raidBoss.hitVisualCooldownUntil=now+(heavy?70:90);

  const body=raidBoss.body;
  body.classList.remove("raid-boss-hit","raid-boss-hit-heavy");
  void body.offsetWidth;
  body.classList.add(heavy?"raid-boss-hit-heavy":"raid-boss-hit");

  if(raidBoss.hitVisualTimer){
    clearTimeout(raidBoss.hitVisualTimer);
  }

  // #raid-boss-body left/top·raidBoss.x는 불변 — .raid-boss-visual만 연출
  raidBoss.hitVisualTimer=setTimeout(()=>{
    if(!raidBoss||!raidBoss.body)return;
    raidBoss.body.classList.remove("raid-boss-hit","raid-boss-hit-heavy");
  },heavy?150:120);
}

function damageRaidBoss(damage,extraClass=""){
  if(!raidMode||!raidBoss||!raidBoss.alive)return false;

  const heavy=
    extraClass==="heavy-number" ||
    extraClass==="sniper-number";

  triggerRaidBossHitVisual(extraClass);
  if(extraClass!=="dot-number"){
    createRaidBossHitImpact(heavy);
  }

  createRaidDamageNumber(damage,extraClass);
  raidBoss.hp-=damage;
  updateRaidBossUI();
  if(raidBoss.hp<=0){
    finishRaid();
    return true;
  }
  return false;
}
function performRaidPlantAttack(row,column,data){
  if(
    !raidBoss ||
    !raidBoss.alive ||
    !raidBoss.features.includes(data.feature)
  ){
    return;
  }

  const plantType=data.feature;

  // 비음: 3점사 + 마지막 탄 강화. 실제 투사체가 보스에 닿을 때 피해.
  if(data.feature==="비음"){
    for(let i=0;i<data.special.shots;i++){
      setTimeout(()=>{
        if(!raidMode||!raidBoss||!raidBoss.alive)return;

        const isFinalShot=i===data.special.shots-1;
        const damage=isFinalShot
          ? Math.max(data.special.finalShotDamage??40,55)
          : data.damage;

        triggerPlantFireMotion(row,column,plantType);

        createRaidFlyingProjectile(
          row,
          column,
          plantType,
          ()=>{
            if(!raidBoss||!raidBoss.alive)return;

            const pos=getRaidHitVfxPosition(row);
            createProjectileHitVfx(
              plantType,
              pos.x,
              pos.y,
              {
                shotIndex:i,
                isFinal:isFinalShot,
                duration:isFinalShot?420:240
              }
            );

            damageRaidBoss(
              damage,
              isFinalShot?"heavy-number":""
            );
          },
          isFinalShot?{size:36,scale:1.08}:{size:28,scale:.94}
        );
      },i*data.special.spacing);
    }
    return;
  }

  // 유음: 투사체 명중 시 기본 피해 + 공유 공명 스택.
  if(data.feature==="유음"){
    triggerPlantFireMotion(row,column,plantType);
    createRaidFlyingProjectile(row,column,plantType,()=>{
      if(!raidBoss||!raidBoss.alive)return;

      const pos=getRaidHitVfxPosition(row);
      createProjectileHitVfx(plantType,pos.x,pos.y,{duration:340});

      damageRaidBoss(data.damage);
      raidLiquidResonance++;

      if(raidLiquidResonance>=3){
        raidLiquidResonance=0;
        createEffect(
          "⚡ 공명!",
          raidBoss.x-20,
          BOARD_ROWS*CELL_SIZE/2-20,
          "chain-effect",
          700
        );
        damageRaidBoss(60,"heavy-number");
      }else{
        createEffect(
          `⚡ 공명 ${raidLiquidResonance}/3`,
          raidBoss.x-20,
          BOARD_ROWS*CELL_SIZE/2-20,
          "chain-effect",
          500
        );
      }
    });
    return;
  }

  // 연구개음: 관통 투사체가 명중한 순간 보스에게 집중 관통 피해.
  if(data.feature==="연구개음"){
    triggerPlantFireMotion(row,column,plantType);
    createRaidFlyingProjectile(row,column,plantType,()=>{
      if(!raidBoss||!raidBoss.alive)return;
      const pos=getRaidHitVfxPosition(row);
      createProjectileHitVfx(plantType,pos.x,pos.y,{duration:320});
      damageRaidBoss(Math.round(data.damage*1.6));
    });
    return;
  }

  // 파찰음: 보스전에서는 매 타격 작은 추가 폭발.
  if(data.feature==="파찰음"){
    triggerPlantFireMotion(row,column,plantType);
    createRaidFlyingProjectile(row,column,plantType,()=>{
      if(!raidBoss||!raidBoss.alive)return;
      const pos=getRaidHitVfxPosition(row);
      createProjectileHitVfx(plantType,pos.x,pos.y,{duration:360});
      damageRaidBoss(data.damage);
      if(raidBoss&&raidBoss.alive)damageRaidBoss(18);
    });
    return;
  }

  switch(data.attackType){
    case "dot":
      triggerPlantFireMotion(row,column,plantType);
      createRaidFlyingProjectile(row,column,plantType,()=>{
        if(!raidBoss||!raidBoss.alive)return;

        const pos=getRaidHitVfxPosition(row);
        createProjectileHitVfx(plantType,pos.x,pos.y,{duration:340});

        damageRaidBoss(data.damage);

        if(raidBoss&&raidBoss.alive){
          raidBoss.dotEndTime=Date.now()+data.special.duration*1000;
          raidBoss.dotNextTick=Date.now()+data.special.tickInterval*1000;
          raidBoss.dotTickInterval=data.special.tickInterval*1000;
          raidBoss.dotDamage=data.special.tickDamage;
        }
      });
      break;

    case "volley":
      for(let i=0;i<data.special.shots;i++){
        setTimeout(()=>{
          if(!raidMode||!raidBoss||!raidBoss.alive)return;

          triggerPlantFireMotion(row,column,plantType);

          createRaidFlyingProjectile(
            row,
            column,
            plantType,
            ()=>{
              if(!raidBoss||!raidBoss.alive)return;
              const pos=getRaidHitVfxPosition(row);
              createProjectileHitVfx(plantType,pos.x,pos.y,{duration:180});
              damageRaidBoss(data.damage);
            },
            {size:27,scale:.9}
          );
        },i*data.special.spacing);
      }
      break;

    case "sniper":
      createEffect(
        "🎯",
        raidBoss.x,
        row*CELL_SIZE+CELL_SIZE/2-15,
        "sniper-target-effect",
        300
      );

      setTimeout(()=>{
        if(!raidMode||!raidBoss||!raidBoss.alive)return;

        triggerPlantFireMotion(row,column,plantType);

        createRaidFlyingProjectile(
          row,
          column,
          plantType,
          ()=>{
            if(!raidBoss||!raidBoss.alive)return;
            const pos=getRaidHitVfxPosition(row);
            createProjectileHitVfx(plantType,pos.x,pos.y,{duration:400});
            damageRaidBoss(data.damage,"heavy-number");
          },
          {size:44,scale:1.03}
        );
      },300);
      break;

    default:
      triggerPlantFireMotion(row,column,plantType);
      createRaidFlyingProjectile(row,column,plantType,()=>{
        if(!raidBoss||!raidBoss.alive)return;

        const pos=getRaidHitVfxPosition(row);
        createProjectileHitVfx(
          plantType,
          pos.x,
          pos.y,
          {duration:data.attackType==="heavy"?380:280}
        );

        damageRaidBoss(
          data.damage,
          data.attackType==="heavy"?"heavy-number":""
        );
      });
      break;
  }
}

function processRaidDot(now){
  if(!raidMode||!raidBoss||!raidBoss.alive||raidBoss.dotEndTime<=now||now<raidBoss.dotNextTick)return;raidBoss.dotNextTick=now+raidBoss.dotTickInterval;createEffect("🔥",raidBoss.x,BOARD_ROWS*CELL_SIZE/2,"dot-effect",350);damageRaidBoss(raidBoss.dotDamage,"dot-number");
}
function processRaidControlPlants(cells,now){
  if(!raidMode||!raidBoss||!raidBoss.alive)return;

  cells.forEach((cell,index)=>{
    const type=cell.dataset.plantType;
    if(type!=="저모음"&&type!=="후설모음"&&type!=="전설모음")return;

    const data=PLANT_DB[type];
    if(!raidBoss.features.includes(data.feature))return;

    const last=Number(cell.dataset.lastSupportTime);
    if(now-last<data.special.interval*1000)return;

    cell.dataset.lastSupportTime=now;

    const row=Math.floor(index/BOARD_COLUMNS);
    const column=index%BOARD_COLUMNS;

    if(type==="저모음"){
      const durationMs=data.special.duration*1000;
      raidBoss.frozenUntil=Math.max(raidBoss.frozenUntil,now+durationMs);
      raidBoss.nextAttackAt+=durationMs;

      triggerRaidBossStatusBurst(type);
      updateRaidBossStatusVisuals(now);

      createEffect(
        "🧊 보스 정지!",
        column*CELL_SIZE+5,
        row*CELL_SIZE+10,
        "freeze-effect",
        800
      );
    }

    if(type==="후설모음"){
      const durationMs=data.special.duration*1000;
      raidBoss.slowedUntil=Math.max(raidBoss.slowedUntil,now+durationMs);

      triggerRaidBossStatusBurst(type);
      updateRaidBossStatusVisuals(now);

      createGlobalSlowScreen();
      createEffect(
        "🐌 보스 이동 둔화!",
        column*CELL_SIZE+5,
        row*CELL_SIZE+10,
        "slow-effect",
        800
      );
    }

    if(type==="전설모음"){
      const durationMs=data.special.duration*1000;
      raidBoss.frozenUntil=Math.max(raidBoss.frozenUntil,now+durationMs);
      raidBoss.nextAttackAt+=durationMs;

      triggerRaidBossStatusBurst(type);
      updateRaidBossStatusVisuals(now);

      createGlobalFreezeScreen();
      createEffect(
        "❄ 보스 완전 정지!",
        column*CELL_SIZE+5,
        row*CELL_SIZE+10,
        "global-freeze-cast-effect",
        900
      );
    }
  });
}

function processHealing(cells, now){
  cells.forEach((cell, index) => {
    if(cell.dataset.plantType !== "중모음") return;

    const data = PLANT_DB["중모음"];

    if(!isSupportActive(index, data.feature)) return;

    const last = Number(cell.dataset.lastSupportTime);

    if(now - last < data.special.interval * 1000) return;

    cell.dataset.lastSupportTime = now;

    getNearbyCellIndices(index, data.special.radius).forEach(targetIndex => {
      const targetCell = cells[targetIndex];
      const targetType = targetCell.dataset.plantType;

      if(!targetType) return;

      const targetData = PLANT_DB[targetType];
      const oldHp = Number(targetCell.dataset.plantHp);

      const newHp = Math.min(
        targetData.hp,
        oldHp + data.special.amount
      );

      targetCell.dataset.plantHp = newHp;

      updatePlantHPBar(targetCell);

      if(newHp > oldHp){
        targetCell.classList.remove("heal-flash");
        void targetCell.offsetWidth;
        targetCell.classList.add("heal-flash");

        setTimeout(() => {
          targetCell.classList.remove("heal-flash");
        }, 750);
      }
    });
  });
}
function processFreezePlants(cells,now){
  if(raidMode)return;cells.forEach((cell,index)=>{if(cell.dataset.plantType!=="저모음")return;const data=PLANT_DB["저모음"],last=Number(cell.dataset.lastSupportTime);if(now-last<data.special.interval*1000)return;const row=Math.floor(index/BOARD_COLUMNS),column=index%BOARD_COLUMNS,triggerTargets=getCompatibleTargets(row,data.feature,column);if(!triggerTargets.length)return;const targets=zombies.filter(z=>z.alive&&z.x<BOARD_WIDTH&&z.row===row);if(!targets.length)return;cell.dataset.lastSupportTime=now;targets.forEach(target=>{const duration=data.special.duration*target.statusDurationMultiplier;target.frozenUntil=Math.max(target.frozenUntil,now+duration*1000);createEffect(target.enemyType==="resilient"?"🛡❄":"🧊",target.x+25,target.row*CELL_SIZE+30,"freeze-effect",700);});createEffect("❄ 레인 정지!",column*CELL_SIZE+10,row*CELL_SIZE+10,"freeze-effect",700);});
}
function processGlobalSlowPlants(cells,now){
  if(raidMode)return;cells.forEach((cell,index)=>{if(cell.dataset.plantType!=="후설모음")return;const data=PLANT_DB["후설모음"],last=Number(cell.dataset.lastSupportTime);if(now-last<data.special.interval*1000)return;const triggerTargets=zombies.filter(z=>z.alive&&z.x<BOARD_WIDTH&&z.features.includes(data.feature));if(!triggerTargets.length)return;const targets=zombies.filter(z=>z.alive&&z.x<BOARD_WIDTH);if(!targets.length)return;cell.dataset.lastSupportTime=now;createGlobalSlowScreen();targets.forEach(target=>{const duration=data.special.duration*target.statusDurationMultiplier;target.slowedUntil=Math.max(target.slowedUntil,now+duration*1000);target.slowMultiplier=Math.min(target.slowMultiplier,data.special.multiplier);createEffect(target.enemyType==="resilient"?"🛡🐌":"🐌",target.x+20,target.row*CELL_SIZE+25,"slow-effect",650);});const row=Math.floor(index/BOARD_COLUMNS),column=index%BOARD_COLUMNS;createEffect("🐌 전장 둔화!",column*CELL_SIZE+5,row*CELL_SIZE+10,"slow-effect",800);});
}
function processGlobalFreezePlants(cells,now){
  if(raidMode)return;cells.forEach((cell,index)=>{if(cell.dataset.plantType!=="전설모음")return;const data=PLANT_DB["전설모음"],last=Number(cell.dataset.lastSupportTime);if(now-last<data.special.interval*1000)return;const triggerTargets=zombies.filter(z=>z.alive&&z.x<BOARD_WIDTH&&z.features.includes(data.feature));if(!triggerTargets.length)return;const targets=zombies.filter(z=>z.alive&&z.x<BOARD_WIDTH);if(!targets.length)return;cell.dataset.lastSupportTime=now;createGlobalFreezeScreen();targets.forEach(target=>{const duration=data.special.duration*target.statusDurationMultiplier;target.frozenUntil=Math.max(target.frozenUntil,now+duration*1000);createEffect(target.enemyType==="resilient"?"🛡❄":"❄",target.x+25,target.row*CELL_SIZE+25,"global-freeze-effect",700);});const row=Math.floor(index/BOARD_COLUMNS),column=index%BOARD_COLUMNS;createEffect("❄❄",column*CELL_SIZE+25,row*CELL_SIZE+20,"global-freeze-cast-effect",900);});
}
function processDots(now){zombies.forEach(z=>{if(!z.alive||z.dotEndTime<=now||now<z.dotNextTick)return;z.dotNextTick=now+z.dotTickInterval;createEffect("🔥",z.x+20,z.row*CELL_SIZE+25,"dot-effect",350);damageZombie(z,z.dotDamage,"dot-number");});}


function getRaidAttackLane(cells){
  const occupiedRows=[];

  for(let row=0;row<BOARD_ROWS;row++){
    const hasPlant=[...cells].some((cell,index)=>{
      if(cell.dataset.plant!=="true")return false;
      return Math.floor(index/BOARD_COLUMNS)===row;
    });

    if(hasPlant){
      occupiedRows.push(row);
    }
  }

  if(occupiedRows.length===0)return null;

  return occupiedRows[
    Math.floor(Math.random()*occupiedRows.length)
  ];
}

function createRaidLaneShockwaveEffect(row){
  if(!board)return;

  // 보스 발밑(해당 레인)에서 퍼지는 원형 충격 — DOM 사각형 레인 하이라이트 제거
  const originX=(raidBoss?raidBoss.x:BOARD_WIDTH)-36;
  const originY=row*CELL_SIZE+CELL_SIZE*0.58;

  const root=document.createElement("div");
  root.className="raid-shockwave-fx";
  root.style.left=originX+"px";
  root.style.top=originY+"px";
  board.appendChild(root);

  const impact=document.createElement("div");
  impact.className="raid-shockwave-impact";
  root.appendChild(impact);

  const ringA=document.createElement("div");
  ringA.className="raid-shockwave-ring";
  root.appendChild(ringA);

  const ringB=document.createElement("div");
  ringB.className="raid-shockwave-ring raid-shockwave-ring-late";
  root.appendChild(ringB);

  const ground=document.createElement("div");
  ground.className="raid-shockwave-ground";
  root.appendChild(ground);

  const dust=document.createElement("div");
  dust.className="raid-shockwave-dust";
  root.appendChild(dust);

  for(let i=0;i<7;i++){
    const debris=document.createElement("div");
    const angle=(-150+i*22)*(Math.PI/180);
    const dist=28+Math.random()*36;
    debris.className=
      i%2===0
        ? "raid-shockwave-debris raid-shockwave-debris-grass"
        : "raid-shockwave-debris raid-shockwave-debris-dust";
    debris.style.setProperty("--dx",Math.cos(angle)*dist+"px");
    debris.style.setProperty("--dy",(Math.sin(angle)*dist*0.45-8-Math.random()*10)+"px");
    debris.style.animationDelay=(i*18)+"ms";
    root.appendChild(debris);
  }

  setTimeout(()=>{
    if(root.parentElement)root.remove();
  },620);
}

function performRaidBossAttack(cells,now){
  if(
    !raidMode||
    !raidBoss||
    !raidBoss.alive||
    raidBoss.entering||
    now<raidBoss.nextAttackAt||
    raidBoss.frozenUntil>now
  ){
    return;
  }

  const targetRow=
    getRaidAttackLane(cells);

  raidBoss.nextAttackAt=
    now+RAID_CONFIG.attackInterval;

  if(targetRow===null)return;

  playSfx("boss_shockwave");

  triggerRaidBossShockwaveMotion();

  createRaidLaneShockwaveEffect(targetRow);

  // 피해/제거 로직과 분리 — 해당 레인 식물 visual만 1회 들썩임
  triggerRaidShockwaveLanePlantHop(cells,targetRow);

  [...cells].forEach((cell,index)=>{
    if(cell.dataset.plant!=="true")return;

    const row=
      Math.floor(index/BOARD_COLUMNS);

    if(row!==targetRow)return;

    let damage=
      RAID_CONFIG.shockwaveDamage;

    damage*=
      1-getShieldReduction(
        index,
        cells
      );

    let hp=
      Number(cell.dataset.plantHp)-damage;

    cell.dataset.plantHp=
      hp;

    updatePlantHPBar(cell);

    createPlantDamageNumber(
      index,
      damage
    );

    const column=
      index%BOARD_COLUMNS;

    createEffect(
      "⚡",
      column*CELL_SIZE+30,
      row*CELL_SIZE+22,
      "heavy-effect",
      650
    );

    if(hp<=0){
      removePlantFromCell(
        cell,
        false
      );
    }
  });

  createEffect(
    "👑⚡",
    BOARD_WIDTH-150,
    185,
    "sniper-shot-effect",
    650
  );
}

function triggerRaidShockwaveLanePlantHop(cells,targetRow){
  const targets=[];

  [...cells].forEach((cell,index)=>{
    if(cell.dataset.plant!=="true")return;
    if(Math.floor(index/BOARD_COLUMNS)!==targetRow)return;
    targets.push({
      cell,
      column:index%BOARD_COLUMNS
    });
  });

  // 보스(오른쪽) 쪽부터 미세 시차 — 충격이 전달되는 느낌
  targets
    .sort((a,b)=>b.column-a.column)
    .forEach((item,i)=>{
      triggerRaidShockwavePlantHop(item.cell,i*18);
    });
}

function triggerRaidShockwavePlantHop(cell,delayMs=0){
  if(!cell)return;
  const plant=cell.querySelector(".plant");
  if(!plant)return;

  const apply=()=>{
    if(!plant.isConnected)return;
    // 한 번만: 진행 중이면 재시작하지 않음
    if(plant.classList.contains("raid-shockwave-hop"))return;
    plant.classList.add("raid-shockwave-hop");
    setTimeout(()=>{
      if(plant.isConnected){
        plant.classList.remove("raid-shockwave-hop");
      }
    },170);
  };

  if(delayMs>0) setTimeout(apply,delayMs);
  else apply();
}

function destroyPlantsForRaidOpening(){
  const cells=[...board.querySelectorAll(".cell")];
  const planted=cells.filter(cell=>cell.dataset.plant==="true"&&cell.dataset.plantType!=="에너지식물");
  if(!planted.length)return;

  const shuffled=shuffleArray(planted);
  const desired=Math.floor(planted.length*RAID_CONFIG.openingPlantRemovalRatio);
  const maxRemovable=Math.max(0,planted.length-RAID_CONFIG.minimumPlantsAfterOpening);
  const removeCount=Math.min(desired,maxRemovable);

  shuffled.slice(0,removeCount).forEach(cell=>{
    const index=Number(cell.dataset.index);
    const row=Math.floor(index/BOARD_COLUMNS);
    const column=index%BOARD_COLUMNS;

    createEffect(
      "💥",
      column*CELL_SIZE+28,
      row*CELL_SIZE+22,
      "explosion-effect",
      700
    );

    // 선정/비율/소리꽃 보호 로직은 동일 — 퇴장 visual만 착지 충격용
    removePlantFromCell(cell,false,{exitClass:"plant-raid-opening-exit"});
  });

  createEffect(
    `⚠ 진형 붕괴! ${removeCount}개 파괴`,
    BOARD_WIDTH/2-120,
    52,
    "raid-alert-text raid-collapse-effect",
    1600
  );
}

// RAID 평순모음 방벽 보너스
// 같은 방어열에 평순모음이 여러 개 있을수록 보스의 근접 공격 간격이 느려진다.
// 1개는 기존과 동일한 1.00배, 이후 1개마다 +15% (최대 5개 = 1.60배).
function getRaidBossBiteInterval(blockingCells){
  const unroundedCount=blockingCells.filter(
    target=>target.cell.dataset.plantType==="평순모음"
  ).length;

  const extraWalls=Math.max(0,unroundedCount-1);
  const multiplier=1+extraWalls*0.15;

  return {
    interval:RAID_CONFIG.biteInterval*multiplier,
    unroundedCount,
    multiplier
  };
}

function getRaidBossBlockingCells(cells){
  const candidates=[];

  [...cells].forEach((cell,index)=>{
    if(cell.dataset.plant!=="true")return;

    const row=
      Math.floor(index/BOARD_COLUMNS);

    const column=
      index%BOARD_COLUMNS;

    const centerX=
      column*CELL_SIZE+
      CELL_SIZE/2;

    const distance=
      raidBoss.x-centerX;

    // 실제 판정 몸체보다 보스 PNG가 훨씬 크므로,
    // 일러스트의 왼쪽 전면이 식물에 닿는 시점에 미리 정지시킨다.
    // raidBoss.x 자체는 건드리지 않아 이동/패배 판정은 그대로 유지한다.
    if(
      distance>=-RAID_BOSS_CONTACT_OVERSHOOT &&
      distance<=RAID_BOSS_VISUAL_CONTACT_DISTANCE
    ){
      candidates.push({
        cell,
        index,
        row,
        column,
        centerX
      });
    }
  });

  if(candidates.length===0){
    return [];
  }

  // 여러 열이 애매하게 겹치는 순간에는
  // 보스 진행 방향에서 가장 먼저 만난 '한 열'만 선택.
  const frontCenterX=
    Math.max(
      ...candidates.map(item=>item.centerX)
    );

  return candidates.filter(
    item =>
      Math.abs(
        item.centerX-frontCenterX
      )<1
  );
}

function updateRaidBossMovement(now,cells){
  if(
    !raidMode||
    !raidBoss||
    !raidBoss.alive
  ){
    return;
  }

  // 등장 낙하 중: 실제 x/판정은 최종 위치 고정, visual만 CSS로 이동
  if(raidBoss.entering){
    raidBoss.lastUpdateTime=now;
    updateRaidBossBodyPosition();
    return;
  }

  let delta=
    (now-raidBoss.lastUpdateTime)/1000;

  delta=
    Math.min(
      delta,
      0.1
    );

  raidBoss.lastUpdateTime=now;

  if(
    raidBoss.frozenUntil>now
  ){
    raidBoss.attackingPlant=false;

    // 걷기 클래스를 제거하면 transform 애니메이션이 기준 자세로 돌아가며
    // 보스가 순간적으로 뒤로 튀어 보일 수 있다. 현재 프레임을 그대로 정지한다.
    setRaidBossMotionPaused(true);

    updateRaidBossBodyPosition();
    return;
  }

  // CC가 끝났으면 현재 자리에서 애니메이션을 다시 이어간다.
  setRaidBossMotionPaused(false);

  const blockingCells=
    getRaidBossBlockingCells(cells);

  if(blockingCells.length>0){
    raidBoss.attackingPlant=true;
    setRaidBossWalking(false);

    const wallDefense=
      getRaidBossBiteInterval(blockingCells);

    raidBoss.wallCount=
      wallDefense.unroundedCount;

    raidBoss.currentBiteInterval=
      wallDefense.interval;

    if(
      now-raidBoss.lastBiteTime>=
      wallDefense.interval
    ){
      raidBoss.lastBiteTime=now;

      triggerRaidBossBite(blockingCells);

      // 같은 열에서 보스를 막는 식물만,
      // 최대 5레인 동시에 공격.
      blockingCells.forEach(target=>{
        let damage=
          RAID_CONFIG.biteDamage;

        damage*=
          1-getShieldReduction(
            target.index,
            cells
          );

        let hp=
          Number(
            target.cell.dataset.plantHp
          )-damage;

        target.cell.dataset.plantHp=
          hp;

        updatePlantHPBar(
          target.cell
        );

        createPlantDamageNumber(
          target.index,
          damage
        );

        createEffect(
          "👹💢",
          target.column*CELL_SIZE+25,
          target.row*CELL_SIZE+22,
          "heavy-effect",
          550
        );

        if(hp<=0){
          removePlantFromCell(
            target.cell,
            false
          );
        }
      });

      // 이 열의 식물이 모두 제거되었는지 다음 프레임에 다시 판정.
    }

    updateRaidBossBodyPosition();
    return;
  }

  raidBoss.attackingPlant=false;
  raidBoss.wallCount=0;
  raidBoss.currentBiteInterval=RAID_CONFIG.biteInterval;
  setRaidBossWalking(true);

  let speed=
    RAID_CONFIG.moveSpeed;

  if(
    raidBoss.slowedUntil>now
  ){
    speed*=0.5;
  }

  raidBoss.x-=
    speed*delta;

  updateRaidBossBodyPosition();

  if(
    raidBoss.x<=
    RAID_CONFIG.defeatX
  ){
    raidBoss.alive=false;

    if(
      raidBoss.body &&
      raidBoss.body.parentElement
    ){
      raidBoss.body.remove();
    }

    if(
      raidBoss.hud &&
      raidBoss.hud.parentElement
    ){
      detachRaidBossHud();
    }

    endGame();
  }
}


function startRaidBossEntrance(){
  if(!raidBoss||!raidBoss.body)return;

  const DROP_MS=650;
  const LAND_MS=280;
  const BGM_GAP_MS=300;

  raidBoss.entering=true;

  const body=raidBoss.body;
  body.classList.remove(
    "raid-boss-entering",
    "raid-boss-landing",
    "raid-boss-walking",
    "raid-boss-bite",
    "raid-boss-shockwave"
  );
  void body.offsetWidth;
  body.classList.add("raid-boss-entering");

  // 낙하 시작 순간 1회 — 안내창에서는 재생하지 않음
  playSfx("boss_start");

  // 착지 후 여백을 포함해 BGM 예약 (중복 방지: requestBossBgm가 기존 타이머 clear)
  requestBossBgm({
    delayMs:DROP_MS+LAND_MS+BGM_GAP_MS
  });

  if(raidBoss.entranceTimer){
    clearTimeout(raidBoss.entranceTimer);
  }

  raidBoss.entranceTimer=setTimeout(()=>{
    if(!raidBoss||!raidBoss.body||!raidBoss.alive)return;

    const bossBody=raidBoss.body;
    bossBody.classList.remove("raid-boss-entering");
    void bossBody.offsetWidth;
    bossBody.classList.add("raid-boss-landing");

    // 기존 shockwave VFX 재사용 (디자인/함수 본문 미수정). 착지 충격만 — boss_shockwave SFX는 재생하지 않음
    createRaidLaneShockwaveEffect(RAID_CONFIG.pathRow);
    if(BOARD_ROWS>2){
      createRaidLaneShockwaveEffect(Math.max(0,RAID_CONFIG.pathRow-1));
      createRaidLaneShockwaveEffect(Math.min(BOARD_ROWS-1,RAID_CONFIG.pathRow+1));
    }

    // 착지 순간에 기존 60% 제거 로직 실행
    destroyPlantsForRaidOpening();

    if(raidBoss.entranceLandTimer){
      clearTimeout(raidBoss.entranceLandTimer);
    }

    raidBoss.entranceLandTimer=setTimeout(()=>{
      if(!raidBoss||!raidBoss.body)return;
      raidBoss.body.classList.remove("raid-boss-landing");
      // transform 복구 후 이동/피격/공격 모션과 충돌하지 않게 진입 종료
      raidBoss.entering=false;
      raidBoss.lastUpdateTime=Date.now();
      raidBoss.entranceTimer=null;
      raidBoss.entranceLandTimer=null;
    },LAND_MS);
  },DROP_MS);
}

function startRaid(){
  unlockOverlay.classList.add("hidden");

  raidMode=true;
  tutorialMode=false;

  updateRaidRefundUI();
  gameOver=false;
  waveInProgress=true;

  zombies=[];
  waveZombieCount=0;
  resolvedZombies=0;
  raidWordBag=[];
  raidLastWordId=null;
  raidDamageSerial=0;

  const now=Date.now();

  raidBoss={
    alive:true,
    hp:RAID_CONFIG.maxHp,
    maxHp:RAID_CONFIG.maxHp,
    wordData:null,
    features:[],

    nextWordChangeAt:now+RAID_CONFIG.wordChangeInterval,
    nextAttackAt:now+RAID_CONFIG.attackInterval,

    frozenUntil:0,
    slowedUntil:0,

    // 보스 이동용 상태 — 낙하 중에도 실제 x는 최종 시작 위치 유지
    x:RAID_CONFIG.startX,
    lastUpdateTime:now,

    dotEndTime:0,
    dotNextTick:0,
    dotTickInterval:0,
    dotDamage:0,

    hud:null,body:null,lastBiteTime:0,attackingPlant:false,
    wallCount:0,currentBiteInterval:RAID_CONFIG.biteInterval,
    hitVisualCooldownUntil:0,hitVisualTimer:null,
    hitImpactCooldownUntil:0,hitImpactHeavyCooldownUntil:0,
    uiHpPct:undefined,
    wordWarnForChangeAt:null,
    entering:true,
    entranceTimer:null,
    entranceLandTimer:null
  };

  ensureRaidBossVisual();
  startRaidBossEntrance();

  waveDisplay.textContent="BOSS";

  changeRaidBossWord(now);

  if(plantInfoContent){
    plantInfoContent.innerHTML=
      `<strong>👑 FINAL BOSS</strong><br>`+
      `모든 레인의 공격 식물이 보스를 공격할 수 있습니다. `+
      `보스 단어는 <strong>20초마다 변경</strong>되며, `+
      `현재 단어에 포함된 특징을 가진 식물만 공격합니다. `+
      `<strong>보스가 왼쪽 끝에 도달하기 전에 격파하세요.</strong>`;
  }
}
function showRaidIntro(){
  waveInProgress=false;unlockTitle.textContent="👑 FINAL BOSS 등장";unlockContent.innerHTML=`<h2>아직 끝나지 않았습니다.</h2><p>Final Wave를 막아냈지만 마지막 적이 등장했습니다.</p><p><strong>모든 레인의 공격 식물이 하나의 보스를 공격합니다.</strong></p><p>보스의 단어는 <strong>20초마다 변경</strong>됩니다. 단어가 바뀌면 공격 가능한 음운 특징도 함께 바뀝니다.</p><p>🧊 저모음은 보스 행동을 잠시 멈추고, 🐌 후설모음은 보스의 이동 속도를 늦추며, ❄ 전설모음은 보스를 완전히 정지시킵니다.</p><p>보스 등장과 동시에 <strong>공격·지원 식물의 약 60%</strong>가 파괴됩니다. 소리꽃은 파괴되지 않습니다. 남은 소리씨앗으로 빠르게 진형을 다시 구축하세요.</p><p>🪏 <strong>RAID에서는 식물을 제거하면 구매 비용의 70%를 환불</strong>합니다. 보스 단어에 맞춰 진형을 적극적으로 재배치하세요.</p><p>⚡ <strong>RAID 유음 공명:</strong> 유음 식물들이 보스를 총 3번 공격하면 공명 추가타가 발생합니다. 연구개음·파찰음·비음도 보스전에서는 각자의 특성이 단일 대상에 맞게 강화됩니다.</p><p>보스는 약 <strong>6초마다</strong> 한 레인의 가장 앞쪽 식물에 충격파를 사용합니다.</p><p>보스는 <strong>세로 5레인 × 가로 1칸 크기</strong>로 천천히 전진합니다. 현재 보스와 맞닿은 한 열의 식물만 공격하며, 그 열을 뚫으면 다시 전진합니다. <strong>왼쪽 끝에 도달하면 즉시 패배합니다.</strong></p>`;unlockNextButton.style.display="inline-block";unlockNextButton.textContent="RAID 시작";unlockNextButton.dataset.action="start-raid";delete unlockNextButton.dataset.wave;
  unlockOverlay.classList.remove("hidden");
}

function formatClearTime(totalSeconds){
  const minutes=
    Math.floor(totalSeconds/60);

  const seconds=
    totalSeconds%60;

  return `${minutes}:${String(seconds).padStart(2,"0")}`;
}

function calculateFinalScoreBreakdown(){
  const clearSeconds=
    Math.max(
      1,
      Math.floor(
        (Date.now()-gameStartTime)/1000
      )
    );

  // 18분보다 빠른 만큼 보너스.
  // 지나치게 빠른 기록이 점수를 압도하지 않도록 최대 4,000점 제한.
  const secondsSaved=
    Math.max(
      0,
      FINAL_SCORE_CONFIG.targetClearSeconds-
      clearSeconds
    );

  const timeBonus=
    Math.min(
      FINAL_SCORE_CONFIG.maxTimeBonus,
      Math.round(
        secondsSaved *
        (
          FINAL_SCORE_CONFIG.maxTimeBonus /
          FINAL_SCORE_CONFIG.targetClearSeconds
        )
      )
    );

  const energyBonus=
    Math.max(
      0,
      Math.round(
        energy *
        FINAL_SCORE_CONFIG.energyPointMultiplier
      )
    );

  const baseScore=
    score;

  const finalScore=
    baseScore+
    timeBonus+
    energyBonus;

  return {
    baseScore,
    clearSeconds,
    timeBonus,
    energyBonus,
    finalScore
  };
}

function getFinalScoreBreakdownHTML(result){
  return `
    <div
      id="final-score-breakdown"
      style="
        margin:14px auto;
        padding:14px 18px;
        max-width:420px;
        border:2px solid rgba(60,60,60,.65);
        border-radius:12px;
        background:rgba(255,255,255,.94);
        box-shadow:0 4px 12px rgba(0,0,0,.16);
        color:#111;
        font-weight:800;
        line-height:1.7;
      "
    >
      <div style="font-size:18px;margin-bottom:6px;color:#111;">
        🏆 최종 점수
      </div>

      <div style="color:#111;">
        기본 점수
        <strong style="color:#111;">${result.baseScore.toLocaleString()}</strong>
      </div>

      <div style="color:#111;">
        클리어 타임
        <strong style="color:#111;">${formatClearTime(result.clearSeconds)}</strong>
      </div>

      <div style="color:#111;">
        시간 보너스
        <strong style="color:#111;">+${result.timeBonus.toLocaleString()}</strong>
      </div>

      <div style="color:#111;">
        남은 소리씨앗
        <strong style="color:#111;">${energy}</strong>
      </div>

      <div style="color:#111;">
        소리씨앗 보너스
        <strong style="color:#111;">+${result.energyBonus.toLocaleString()}</strong>
      </div>

      <div class="final-score-total" style="margin-top:7px;font-size:22px;color:#111;">
        최종
        <strong class="final-score-value">${result.finalScore.toLocaleString()}</strong>점
      </div>
    </div>
  `;
}

function applyFinalClearScore(){
  if(finalScoreCalculated){
    return null;
  }

  finalScoreCalculated=true;

  const result=
    calculateFinalScoreBreakdown();

  score=
    result.finalScore;

  scoreDisplay.textContent=
    score;

  return result;
}


function finishRaid(){
  if(!raidMode||!raidBoss)return;

  if(raidBoss.entranceTimer)clearTimeout(raidBoss.entranceTimer);
  if(raidBoss.entranceLandTimer)clearTimeout(raidBoss.entranceLandTimer);

  raidBoss.alive=false;
  raidMode=false;
  waveInProgress=false;
  stopBossBgm();

  if(raidBoss.body&&raidBoss.body.parentElement)raidBoss.body.remove();
  detachRaidBossHud();
  raidBoss=null;

  if(practiceMode){
    finishPracticeSession("RAID 테스트 완료");
    return;
  }

  score+=3000;
  scoreDisplay.textContent=score;
  finishGame();
}

function gameLoop(){
  const now=Date.now();
  if(!gameOver){
    const cells=board.querySelectorAll(".cell");
    cells.forEach((cell,index)=>{const type=cell.dataset.plantType,plant=cell.querySelector(".plant");if(!type||!plant)return;const data=PLANT_DB[type];if(data.attackType!=="support"&&data.attackType!=="control"){plant.classList.remove("support-active");return;}let active=false;if(raidMode)active=!!(raidBoss&&raidBoss.alive&&raidBoss.features.includes(data.feature));else if(type==="전설모음"||type==="후설모음")active=zombies.some(z=>z.alive&&z.x<BOARD_WIDTH&&z.features.includes(data.feature));else active=isSupportActive(index,data.feature);plant.classList.toggle("support-active",active);});
    updateSupportVisuals(cells);
    cells.forEach((cell, index) => {
      if(cell.dataset.plantType !== "에너지식물") return;

      const data = PLANT_DB["에너지식물"];
      const last = Number(cell.dataset.lastEnergyTime);

      if(now - last < data.special.interval * 1000) return;

      const beforeEnergy = energy;
      changeEnergy(data.special.amount);
      const gainedEnergy = energy - beforeEnergy;

      cell.dataset.lastEnergyTime = now;

      if(gainedEnergy <= 0) return;

      // 소리꽃 실제 생산 순간에만 SFX (자연 회복 setInterval과는 분리)
      playSfx("energy_gain");

      const plant = cell.querySelector(".plant");

      if(plant){
        plant.classList.remove("energy-producing");
        void plant.offsetWidth;
        plant.classList.add("energy-producing");

        setTimeout(() => {
          if(plant && plant.isConnected){
            plant.classList.remove("energy-producing");
          }
        }, 700);

        createSoundSeedGainVfx(plant);
      }
    });
    processHealing(cells,now);
    if(raidMode){processRaidControlPlants(cells,now);processRaidDot(now);if(raidBoss&&raidBoss.alive){processRaidWordChangeWarning(now);if(now>=raidBoss.nextWordChangeAt)changeRaidBossWord(now);updateRaidBossMovement(now,cells);if(raidMode&&raidBoss&&raidBoss.alive){performRaidBossAttack(cells,now);updateRaidBossUI(now);}}}
    else{processFreezePlants(cells,now);processGlobalSlowPlants(cells,now);processGlobalFreezePlants(cells,now);processDots(now);}

    if(!raidMode){
      zombies.forEach(zombie=>{
        if(!zombie.alive)return;let delta=(now-zombie.lastUpdateTime)/1000;delta=Math.min(delta,0.1);zombie.lastUpdateTime=now;
        zombie.element.classList.toggle("frozen",zombie.frozenUntil>now);
        if(zombie.slowedUntil>now)zombie.element.classList.add("slowed");else{zombie.element.classList.remove("slowed");zombie.slowMultiplier=1;}
        const cellIndex=getZombieCellIndex(zombie);
        let currentCell=cellIndex>=0?cells[cellIndex]:null;

        if(currentCell&&currentCell.dataset.plant==="true"){
          // 실제 충돌 좌표(zombie.x)는 그대로 유지하고,
          // 공격 중인 좀비 그림만 오른쪽으로 조금 물려서 식물과 겹치지 않게 한다.
          zombie.element.classList.add("attacking-plant");
          updateZombiePosition(zombie,ZOMBIE_ATTACK_VISUAL_OFFSET);
          updateZombieApproachAppearance(zombie);

          if(now-zombie.lastBiteTime>=ZOMBIE_BITE_INTERVAL){
            zombie.lastBiteTime=now;

            const targetPlantType=currentCell.dataset.plantType;
            const targetPlantData=PLANT_DB[targetPlantType];
            let damage=zombie.biteDamage;

            if(
              targetPlantData&&
              targetPlantData.special&&
              typeof targetPlantData.special.biteDamageTaken==="number"
            ){
              damage=targetPlantData.special.biteDamageTaken;
              if(zombie.enemyType==="breaker")damage*=50/25;
            }

            const reduction=getShieldReduction(cellIndex,cells);
            damage*=1-reduction;

            let hp=Number(currentCell.dataset.plantHp)-damage;
            currentCell.dataset.plantHp=hp;
            updatePlantHPBar(currentCell);
            playZombieBiteSfx();

            // 공격 순간: 좀비는 왼쪽으로 짧게 들이치고, 식물은 피격 반동.
            playZombieBiteAnimation(zombie,currentCell);

            if(targetPlantType==="평순모음"){
              createEffect(
                "🧱",
                (cellIndex%BOARD_COLUMNS)*CELL_SIZE+35,
                Math.floor(cellIndex/BOARD_COLUMNS)*CELL_SIZE+20,
                "shield-effect",
                350
              );
            }

            if(zombie.enemyType==="breaker"){
              createEffect(
                "💢",
                (cellIndex%BOARD_COLUMNS)*CELL_SIZE+40,
                Math.floor(cellIndex/BOARD_COLUMNS)*CELL_SIZE+34,
                "heavy-effect",
                300
              );
            }

            if(reduction>0){
              createEffect(
                "🛡 -"+Math.round(reduction*100)+"%",
                (cellIndex%BOARD_COLUMNS)*CELL_SIZE+15,
                Math.floor(cellIndex/BOARD_COLUMNS)*CELL_SIZE+20,
                "shield-effect",
                450
              );
            }

            if(hp<=0){
              removePlantFromCell(currentCell,false);
            }
          }
        }else{
          zombie.element.classList.remove("attacking-plant","zombie-bite");

          if(zombie.frozenUntil<=now){
            let moveSpeed=zombie.baseSpeed;
            if(zombie.slowedUntil>now)moveSpeed*=zombie.slowMultiplier;
            zombie.x-=moveSpeed*delta;
          }

          updateZombiePosition(zombie);
          updateZombieApproachAppearance(zombie);

          if(zombie.x<-ZOMBIE_WIDTH){
            recordMissedZombie(zombie);
            zombie.alive=false;
            if(zombie.element.parentElement)zombie.element.remove();
            resolvedZombies++;

            if(!tutorialMode){
              life--;
              lifeDisplay.textContent=life;
              if(life<=0){
                endGame();
                return;
              }
            }

            checkRoundEnd();
          }
        }
      });
      updateZombieLabelOffsets();
    }

    cells.forEach((cell,index)=>{
      const type=cell.dataset.plantType;if(!type)return;const data=PLANT_DB[type];if(!data)return;
      if(["generator","support","control","tank"].includes(data.attackType))return;
      const row=Math.floor(index/BOARD_COLUMNS),column=index%BOARD_COLUMNS,speedMultiplier=getAttackSpeedMultiplier(index,cells),interval=data.attackInterval*1000*speedMultiplier,lastAttack=Number(cell.dataset.lastAttack);
      if(now-lastAttack<interval)return;
      if(raidMode){if(!raidBoss||!raidBoss.alive||!raidBoss.features.includes(data.feature))return;playPlantAttackSfx();cell.dataset.lastAttack=now;performRaidPlantAttack(row,column,data);return;}
      const targets=getCompatibleTargets(row,data.feature,column);if(!targets.length)return;playPlantAttackSfx();cell.dataset.lastAttack=now;
      switch(data.attackType){case "burst":performBurstAttack(row,column,targets[0],data);break;case "chain":performChainAttack(row,column,targets,data);break;case "dot":performDotAttack(row,column,targets[0],data);break;case "pierce":performPierceAttack(row,column,data);break;case "deathBurst":performDeathBurstAttack(row,column,targets[0],data);break;case "volley":performVolleyAttack(row,column,data);break;case "sniper":performSniperAttack(row,column,targets,data);break;default:performNormalAttack(row,column,targets[0],data);}
    });
  }
  requestAnimationFrame(gameLoop);
}

function checkRoundEnd(){
  if(gameOver||!waveInProgress||raidMode)return;
  if(resolvedZombies<waveZombieCount)return;

  waveInProgress=false;

  if(tutorialMode){
    finishTutorial();
    return;
  }

  if(practiceMode){
    finishPracticeSession(`Wave ${currentWave} 테스트 완료`);
    return;
  }

  checkWaveEnd();
}
function checkWaveEnd(){score+=500;scoreDisplay.textContent=score;if(currentWave===9){showRaidIntro();return;}showNextWavePopup(currentWave+1);}

function getMissedWordSummary(){const counts={};missedWords.forEach(word=>counts[word]=(counts[word]||0)+1);return Object.entries(counts).sort((a,b)=>b[1]-a[1]);}
function getMissedFeatureRanking(){return Object.entries(missedFeatureCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);}
function getMostUsedPlant(){const entries=Object.entries(plantPlacementCounts);if(!entries.length)return null;entries.sort((a,b)=>b[1]-a[1]);return entries[0];}
function buildGameFeedbackHTML(cleared=false){
  const missedWordSummary=getMissedWordSummary(),featureRanking=getMissedFeatureRanking(),mostUsedPlant=getMostUsedPlant();
  const missedWordsHTML=!missedWordSummary.length?`<p><strong>없음</strong></p><p>🎯 이번 판에서는 방어선을 통과한 단어가 없습니다.</p>`:`<p>${missedWordSummary.map(([word,count])=>count>1?`${word} ×${count}`:word).join(" · ")}</p>`;
  const featuresHTML=!featureRanking.length?`<p>분석할 수 있는 놓친 특징이 없습니다.</p>`:featureRanking.map(([feature,count],index)=>`<div>${index+1}. <strong>${feature}</strong> — ${count}회</div>`).join("");
  const plantHTML=mostUsedPlant?`<p><strong>${getPlantDisplayName(mostUsedPlant[0])}</strong> — ${mostUsedPlant[1]}회 배치</p>`:`<p>배치 기록 없음</p>`;
  const reviewHTML=featureRanking.length?`<p>이번 판에서는 <strong>${featureRanking[0][0]}</strong>이 포함된 단어를 상대적으로 자주 놓쳤습니다.</p><p>당시 사용할 수 있었던 식물 중에서 해당 특징을 다시 한 번 확인해 보세요.</p>`:`<p>이번 판에서는 방어선을 통과한 단어가 없거나, 당시 해금된 식물로 분석할 특징이 없었습니다.</p>`;
  return `<div style="text-align:left;line-height:1.7;"><h3>📊 플레이 결과</h3><p>Wave: <strong>${currentWave}</strong> &nbsp;&nbsp; 점수: <strong>${score}</strong> &nbsp;&nbsp; ${cleared?`남은 생명: <strong>${life}</strong>`:`생명: <strong>${life}</strong>`}</p><hr><h3>📖 놓친 단어</h3>${missedWordsHTML}<hr><h3>🔎 놓친 단어에서 자주 나타난 특징</h3>${featuresHTML}<hr><h3>🌱 가장 많이 사용한 식물</h3>${plantHTML}<hr><h3>💡 복습 포인트</h3>${reviewHTML}</div>`;
}

function startTutorial(){
  practiceMode=false;if(practiceToolbar)practiceToolbar.classList.add("hidden");if(practicePanel)practicePanel.classList.add("hidden");
  clearTutorialGuide();
  startOverlay.classList.add("hidden");tutorialMode=true;raidMode=false;gameOver=false;waveInProgress=true;tutorialSpawnIndex=0;tutorialEnergyBonusGiven=false;resolvedZombies=0;waveZombieCount=TUTORIAL_CONFIG.zombieCount;energy=130;life=5;score=0;energyDisplay.textContent=energy;lifeDisplay.textContent=life;scoreDisplay.textContent=score;waveDisplay.textContent="T";unlockedPlants=new Set(["양순음","치조음"]);updatePlantButtons();createBoard();tutorialGuide.classList.remove("hidden");tutorialGuideText.innerHTML=`튜토리얼을 시작합니다.<br><br>식물 버튼을 선택한 뒤 게임판의 원하는 칸을 클릭하면 식물을 배치할 수 있습니다.<br><br>잠시 후 첫 번째 단어가 등장합니다.`;
  setTimeout(()=>{if(!tutorialMode)return;spawnTutorialZombie();currentSpawnTimer=setInterval(()=>{if(!tutorialMode){clearInterval(currentSpawnTimer);currentSpawnTimer=null;return;}if(tutorialSpawnIndex>=TUTORIAL_CONFIG.zombieCount){clearInterval(currentSpawnTimer);currentSpawnTimer=null;return;}spawnTutorialZombie();},TUTORIAL_CONFIG.spawnInterval);},3000);
}
function finishTutorial(){
  clearTutorialGuide();
  if(currentSpawnTimer){clearInterval(currentSpawnTimer);currentSpawnTimer=null;}tutorialGuide.classList.add("hidden");unlockTitle.textContent="🎓 튜토리얼 완료!";unlockContent.innerHTML=`<p>기본적인 방어 방법을 익혔습니다.</p><p>본게임에서는 단어에 포함된 음운의 특징을 직접 판단해 식물을 선택해야 합니다.</p>`;unlockNextButton.style.display="inline-block";unlockNextButton.textContent="Wave 1 시작";unlockNextButton.dataset.action="start-main";delete unlockNextButton.dataset.wave;unlockOverlay.classList.remove("hidden");
}
function resetForMainGame(){gameStartTime=Date.now();finalScoreCalculated=false;
  practiceMode=false;
  clearTutorialGuide();
  if(practiceToolbar) practiceToolbar.classList.add("hidden");
  if(practicePanel) practicePanel.classList.add("hidden");
  if(currentSpawnTimer){clearInterval(currentSpawnTimer);currentSpawnTimer=null;}zombies.forEach(z=>{z.alive=false;if(z.element.parentElement)z.element.remove();});zombies=[];if(raidBoss){if(raidBoss.body&&raidBoss.body.parentElement)raidBoss.body.remove();detachRaidBossHud();}raidBoss=null;raidMode=false;updateRaidRefundUI();raidWordBag=[];raidLastWordId=null;raidLiquidResonance=0;tutorialMode=false;tutorialSpawnIndex=0;tutorialEnergyBonusGiven=false;tutorialGuide.classList.add("hidden");selectedPlant=null;selectedCost=0;removeMode=false;energy=350;life=5;score=0;currentWave=1;waveZombieCount=0;resolvedZombies=0;waveInProgress=false;gameOver=false;waveWordBag=[];waveEnemyTypeBag=[];lastSpawnedWordId=null;missedWords=[];missedFeatureCounts={};plantPlacementCounts={};unlockedPlants=new Set(INITIAL_PLANTS);energyDisplay.textContent=energy;lifeDisplay.textContent=life;scoreDisplay.textContent=score;waveDisplay.textContent=currentWave;restartButton.style.display="none";removeButton.disabled=false;removeButton.classList.remove("selected");plantButtons.forEach(button=>button.classList.remove("selected"));if(plantInfoContent)plantInfoContent.innerHTML=`식물을 선택하면 역할과 효과가 표시됩니다.`;updatePlantButtons();createBoard();
}

function ensurePracticeModeUI(){
  if(practicePanel && practiceToolbar) return;

  // 시작 화면의 진입 버튼
  if(startOverlay && !document.querySelector("#practice-mode-button")){
    const openButton=document.createElement("button");
    openButton.id="practice-mode-button";
    openButton.type="button";
    openButton.textContent="🧪 테스트";
    openButton.title="연습 / 테스트 모드";
    openButton.classList.add("hidden");
    openButton.hidden=true;
    openButton.setAttribute("aria-hidden","true");
    openButton.addEventListener("click",()=>{
      playSfx("click_ui");
      if(practicePanel) practicePanel.classList.remove("hidden");
    });
    startOverlay.appendChild(openButton);
  }

  // 웨이브 선택 모달
  practicePanel=document.createElement("div");
  practicePanel.id="practice-panel";
  practicePanel.classList.add("hidden");

  const waveButtons=Array.from({length:9},(_,i)=>{
    const wave=i+1;
    const label=wave===9?"FINAL":"Wave "+wave;
    return `<button type="button" class="practice-wave-button" data-practice-wave="${wave}">${label}</button>`;
  }).join("");

  practicePanel.innerHTML=`
    <div class="practice-panel-card">
      <div class="practice-panel-header">
        <div>
          <strong>🧪 연습 / 테스트 모드</strong>
          <div class="practice-panel-subtitle">원하는 구간으로 바로 이동합니다. 모든 식물 해금 · 배치 비용 0 · 생명 99</div>
        </div>
        <button type="button" id="practice-panel-close" aria-label="닫기">×</button>
      </div>

      <div class="practice-wave-grid">${waveButtons}</div>

      <button type="button" id="practice-raid-button" class="practice-raid-button">👑 RAID 바로 시작</button>

      <p class="practice-panel-note">
        테스트 모드의 결과는 본게임 기록용이 아닙니다. 플레이 중 우측 테스트 도구로 특정 좀비도 바로 소환할 수 있습니다.
      </p>
    </div>
  `;

  document.body.appendChild(practicePanel);

  practicePanel.querySelectorAll("[data-practice-wave]").forEach(button=>{
    button.addEventListener("click",()=>{
      playSfx("click_ui");
      startPracticeWave(Number(button.dataset.practiceWave));
    });
  });

  practicePanel.querySelector("#practice-raid-button").addEventListener("click",()=>{
    playSfx("click_ui");
    startPracticeRaid();
  });
  practicePanel.querySelector("#practice-panel-close").addEventListener("click",()=>{
    playSfx("click_ui");
    practicePanel.classList.add("hidden");
  });

  // 전투 중 빠른 테스트 도구
  practiceToolbar=document.createElement("div");
  practiceToolbar.id="practice-toolbar";
  practiceToolbar.classList.add("hidden");
  practiceToolbar.innerHTML=`
    <div class="practice-toolbar-title">🧪 TEST</div>
    <button type="button" data-practice-action="select">구간 선택</button>
    <button type="button" data-practice-action="energy">⚡ 소리씨앗 600</button>
    <button type="button" data-practice-enemy="normal">일반</button>
    <button type="button" data-practice-enemy="runner">돌진</button>
    <button type="button" data-practice-enemy="breaker">파괴</button>
    <button type="button" data-practice-enemy="resilient">불굴</button>
    <button type="button" data-practice-enemy="bomber">폭발</button>
    <button type="button" data-practice-action="clear">적 정리</button>
  `;
  document.body.appendChild(practiceToolbar);

  practiceToolbar.querySelector('[data-practice-action="select"]').addEventListener("click",()=>{
    playSfx("click_ui");
    stopPracticeCombat();
    practicePanel.classList.remove("hidden");
  });

  practiceToolbar.querySelector('[data-practice-action="energy"]').addEventListener("click",()=>{
    playSfx("click_ui");
    if(!practiceMode)return;
    energy=MAX_ENERGY;
    energyDisplay.textContent=energy;
    updatePlantButtons();
  });

  practiceToolbar.querySelector('[data-practice-action="clear"]').addEventListener("click",()=>{
    playSfx("click_ui");
    if(!practiceMode)return;
    clearPracticeEnemies();
  });

  practiceToolbar.querySelectorAll("[data-practice-enemy]").forEach(button=>{
    button.addEventListener("click",()=>{
      playSfx("click_ui");
      spawnPracticeEnemy(button.dataset.practiceEnemy);
    });
  });
}

function applyPracticeSetup(){
  practiceMode=true;
  tutorialMode=false;
  gameOver=false;

  unlockedPlants=new Set(ALL_PLANT_TYPES);
  energy=MAX_ENERGY;
  life=99;
  score=0;

  energyDisplay.textContent=energy;
  lifeDisplay.textContent=life;
  scoreDisplay.textContent=score;

  removeButton.disabled=false;
  plantButtons.forEach(button=>button.disabled=false);
  updatePlantButtons();

  if(practiceToolbar) practiceToolbar.classList.remove("hidden");
  if(practicePanel) practicePanel.classList.add("hidden");

  if(plantInfoContent){
    plantInfoContent.innerHTML=`<strong>🧪 테스트 모드</strong><br>모든 식물 해금 · 배치 비용 0 · 생명 99 · 특정 적 즉시 소환 가능`;
  }
}

function startPracticeWave(wave){
  if(!WAVE_CONFIG[wave])return;

  startOverlay.classList.add("hidden");
  unlockOverlay.classList.add("hidden");

  resetForMainGame();
  applyPracticeSetup();

  currentWave=wave;
  waveDisplay.textContent=wave===9?"FINAL":wave;

  startWave();
}

function startPracticeRaid(){
  startOverlay.classList.add("hidden");
  unlockOverlay.classList.add("hidden");

  resetForMainGame();
  applyPracticeSetup();

  currentWave=9;
  waveDisplay.textContent="BOSS";

  // 빈 보드에서 원하는 진형을 직접 만들 수 있도록 시작한다.
  // RAID 시작 시 진형 60% 붕괴 규칙 자체는 기존 startRaid()가 그대로 처리한다.
  startRaid();
}

function spawnPracticeEnemy(enemyType){
  if(!practiceMode || raidMode || gameOver)return;

  const config=WAVE_CONFIG[currentWave] || WAVE_CONFIG[9];
  const wordData=getNextWordData();
  if(!config || !wordData)return;

  // 수동 소환 적도 라운드 해결 수에 포함시켜 조기 종료를 방지한다.
  if(!waveInProgress){
    waveInProgress=true;
    resolvedZombies=0;
    waveZombieCount=0;
  }

  waveZombieCount++;
  createZombie(wordData,config.zombieHP,ZOMBIE_BASE_SPEED,enemyType);
}

function clearPracticeEnemies(){
  if(currentSpawnTimer){
    clearInterval(currentSpawnTimer);
    currentSpawnTimer=null;
  }

  zombies.forEach(zombie=>{
    zombie.alive=false;
    if(zombie.element && zombie.element.parentElement) zombie.element.remove();
  });

  zombies=[];
  waveZombieCount=0;
  resolvedZombies=0;
  waveInProgress=!!(raidMode && raidBoss && raidBoss.alive);
}

function stopPracticeCombat(){
  if(!practiceMode)return;

  if(currentSpawnTimer){
    clearInterval(currentSpawnTimer);
    currentSpawnTimer=null;
  }

  zombies.forEach(zombie=>{
    zombie.alive=false;
    if(zombie.element && zombie.element.parentElement) zombie.element.remove();
  });
  zombies=[];

  if(raidBoss){
    raidBoss.alive=false;
    if(raidBoss.body && raidBoss.body.parentElement) raidBoss.body.remove();
    detachRaidBossHud();
    raidBoss=null;
  }

  raidMode=false;
  waveInProgress=false;
  waveZombieCount=0;
  resolvedZombies=0;
  stopBossBgm();
  updateRaidRefundUI();
}

function finishPracticeSession(message="테스트 완료"){
  if(!practiceMode)return;

  stopPracticeCombat();
  gameOver=false;

  if(practiceToolbar) practiceToolbar.classList.remove("hidden");
  if(practicePanel){
    const note=practicePanel.querySelector(".practice-panel-note");
    if(note) note.innerHTML=`<strong>${message}</strong><br>다른 Wave나 RAID를 바로 선택할 수 있습니다.`;
    practicePanel.classList.remove("hidden");
  }
}

function buildRaidTestFormation(){
  const cells=[...board.querySelectorAll(".cell")];

  unlockedPlants=new Set([
    "에너지식물",
    "양순음",
    "치조음",
    "비음",
    "파열음",
    "유음",
    "마찰음",
    "연구개음",
    "파찰음",
    "경구개음",
    "후음",
    "평순모음",
    "고모음",
    "중모음",
    "원순모음",
    "저모음",
    "후설모음",
    "전설모음"
  ]);

  updatePlantButtons();

  const formation=[
    // 1레인 - 9칸
    [0,"에너지식물"],[1,"고모음"],[2,"양순음"],[3,"비음"],[4,"파열음"],
    [5,"중모음"],[6,"마찰음"],[7,"평순모음"],[8,"원순모음"],

    // 2레인 - 9칸
    [11,"에너지식물"],[12,"중모음"],[13,"치조음"],[14,"유음"],[15,"마찰음"],
    [16,"연구개음"],[17,"파찰음"],[18,"평순모음"],[19,"고모음"],

    // 3레인 - 9칸
    [22,"에너지식물"],[23,"후설모음"],[24,"연구개음"],[25,"파찰음"],[26,"경구개음"],
    [27,"후음"],[28,"원순모음"],[29,"저모음"],[30,"평순모음"],

    // 4레인 - 9칸
    [33,"에너지식물"],[34,"저모음"],[35,"후음"],[36,"양순음"],[37,"비음"],
    [38,"파열음"],[39,"중모음"],[40,"고모음"],[41,"평순모음"],

    // 5레인 - 9칸
    [44,"에너지식물"],[45,"전설모음"],[46,"치조음"],[47,"파열음"],[48,"유음"],
    [49,"경구개음"],[50,"마찰음"],[51,"원순모음"],[52,"평순모음"]
  ];

  formation.forEach(([index,type])=>{
    const cell=cells[index];
    if(cell&&cell.dataset.plant!=="true"&&PLANT_DB[type]){
      placePlant(cell,type);
    }
  });

  energy=MAX_ENERGY;
  energyDisplay.textContent=energy;
  updatePlantButtons();
}

function startRaidTest(){gameStartTime=Date.now();finalScoreCalculated=false;
  practiceMode=false;if(practiceToolbar)practiceToolbar.classList.add("hidden");if(practicePanel)practicePanel.classList.add("hidden");
  startOverlay.classList.add("hidden");
  unlockOverlay.classList.add("hidden");

  resetForMainGame();

  currentWave=9;
  waveDisplay.textContent="FINAL";

  buildRaidTestFormation();

  if(plantInfoContent){
    plantInfoContent.innerHTML=
      `<strong>🧪 RAID TEST</strong><br>`+
      `파이널 직전 상황을 가정한 빽빽한 테스트 진형이 자동 배치되었습니다. `+
      `RAID 시작을 누르면 이 진형의 약 60%가 무작위로 파괴됩니다.`;
  }

  showRaidIntro();
}

function startMainGame(){startOverlay.classList.add("hidden");unlockOverlay.classList.add("hidden");resetForMainGame();requestBattleBgm({restart:true});setTimeout(startWave,1000);}
tutorialStartButton.addEventListener("click",()=>{playSfx("click_ui");startTutorial();});
directStartButton.addEventListener("click",()=>{playSfx("click_ui");startMainGame();});
if(raidTestButton){
  raidTestButton.addEventListener("click",()=>{playSfx("click_ui");startRaidTest();});
}

/* ============================================
   개발자 테스트 메뉴 (비밀 커맨드)
   ↑ ↑ ↓ ↓ ← → ← →  — 시작 화면에서만
   ============================================ */
const DEV_TEST_COMMAND = [
  "ArrowUp","ArrowUp","ArrowDown","ArrowDown",
  "ArrowLeft","ArrowRight","ArrowLeft","ArrowRight"
];
const DEV_TEST_COMMAND_TIMEOUT_MS = 2800;
let devTestCommandIndex = 0;
let devTestCommandTimer = null;
let devTestMenu = null;

function isStartScreenVisible(){
  return !!(startOverlay && !startOverlay.classList.contains("hidden"));
}

function resetDevTestCommand(){
  devTestCommandIndex = 0;
  if(devTestCommandTimer){
    clearTimeout(devTestCommandTimer);
    devTestCommandTimer = null;
  }
}

function ensureDevTestMenu(){
  if(devTestMenu) return;

  devTestMenu = document.createElement("div");
  devTestMenu.id = "dev-test-menu";
  devTestMenu.className = "hidden";
  devTestMenu.innerHTML = `
    <div class="dev-test-menu-card" role="dialog" aria-label="TEST MODE">
      <div class="dev-test-menu-title">TEST MODE</div>
      <button type="button" id="dev-test-practice" class="dev-test-menu-button">일반 테스트 시작</button>
      <button type="button" id="dev-test-raid" class="dev-test-menu-button">RAID 테스트 시작</button>
      <button type="button" id="dev-test-close" class="dev-test-menu-button dev-test-menu-close">닫기</button>
    </div>
  `;
  document.body.appendChild(devTestMenu);

  devTestMenu.querySelector("#dev-test-practice").addEventListener("click",()=>{
    playSfx("click_ui");
    ensurePracticeModeUI();
    if(practicePanel) practicePanel.classList.remove("hidden");
    closeDevTestMenu();
  });

  devTestMenu.querySelector("#dev-test-raid").addEventListener("click",()=>{
    playSfx("click_ui");
    closeDevTestMenu();
    startRaidTest();
  });

  devTestMenu.querySelector("#dev-test-close").addEventListener("click",()=>{
    playSfx("click_ui");
    closeDevTestMenu();
  });
}

function openDevTestMenu(){
  if(!isStartScreenVisible()) return;
  ensureDevTestMenu();
  ensurePracticeModeUI();
  playSfx("click_ui");
  devTestMenu.classList.remove("hidden");
  void devTestMenu.offsetWidth;
  devTestMenu.classList.add("dev-test-menu-show");
}

function closeDevTestMenu(){
  if(!devTestMenu) return;
  devTestMenu.classList.remove("dev-test-menu-show");
  devTestMenu.classList.add("hidden");
}

function onDevTestCommandKeydown(event){
  if(!isStartScreenVisible()){
    resetDevTestCommand();
    return;
  }
  if(devTestMenu && !devTestMenu.classList.contains("hidden")) return;

  const key = event.key;
  if(key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight"){
    return;
  }

  event.preventDefault();

  const expected = DEV_TEST_COMMAND[devTestCommandIndex];
  if(key === expected){
    devTestCommandIndex += 1;
    if(devTestCommandTimer) clearTimeout(devTestCommandTimer);
    devTestCommandTimer = setTimeout(resetDevTestCommand, DEV_TEST_COMMAND_TIMEOUT_MS);

    if(devTestCommandIndex >= DEV_TEST_COMMAND.length){
      resetDevTestCommand();
      openDevTestMenu();
    }
    return;
  }

  if(key === DEV_TEST_COMMAND[0]){
    devTestCommandIndex = 1;
    if(devTestCommandTimer) clearTimeout(devTestCommandTimer);
    devTestCommandTimer = setTimeout(resetDevTestCommand, DEV_TEST_COMMAND_TIMEOUT_MS);
  } else {
    resetDevTestCommand();
  }
}

if(!window.__phonemeDevTestCommandBound){
  window.__phonemeDevTestCommandBound = true;
  window.addEventListener("keydown", onDevTestCommandKeydown);
}

function showNextWavePopup(nextWave){
  const newPlants=WAVE_UNLOCKS[nextWave]||[];newPlants.forEach(type=>unlockedPlants.add(type));updatePlantButtons();unlockNextButton.style.display="inline-block";unlockNextButton.dataset.action="next-wave";let plantHTML="";
  if(newPlants.length)plantHTML=newPlants.map(buildUnlockPlantHTML).join("");
  if(nextWave===7){unlockTitle.textContent="⚠ 새로운 적 등장!";unlockContent.innerHTML=`${plantHTML}<hr><h3>⚠ 특수 단어 몬스터 등장</h3><p>이제부터 일부 적은 특별한 능력을 가지고 등장합니다.</p><p>🏃 <strong>돌진형</strong><br>빠른 속도로 방어선에 접근합니다.</p><p>💢 <strong>파괴형</strong><br>느리지만 매우 단단하고 식물에게 큰 피해를 줍니다.</p><p>🛡 <strong>불굴형</strong><br>높은 체력을 가지고 있으며 둔화와 빙결에서 매우 빠르게 회복합니다.</p><p>💣 <strong>폭발형</strong><br>쓰러질 때 주변 식물에 강력한 폭발 피해를 줍니다.<br><strong>가능한 한 방어선에서 멀리 처치하세요.</strong></p><p>이제부터는 단어의 음운뿐 아니라 <strong>적 종류와 처치 위치</strong>도 중요합니다.</p>`;}
  else if(nextWave===8){unlockTitle.textContent="🌱 마지막 식물 해금!";unlockContent.innerHTML=`${plantHTML}<hr><p>이제 모든 음운 식물을 사용할 수 있습니다.</p><p>특수 적이 더욱 자주 등장합니다.</p><p>특히 💣 폭발형을 방어선 가까이에서 처치하면 진형이 크게 손상될 수 있습니다.</p>`;}
  else if(nextWave===9){unlockTitle.textContent="🚨 FINAL WAVE";unlockContent.innerHTML=`<h2>FINAL WAVE</h2><p>새로운 식물은 없습니다.</p><p>지금까지 익힌 <strong>음운 체계와 모든 배치 전략</strong>을 활용하세요.</p><p>🏃 돌진형, 💢 파괴형, 🛡 불굴형, 💣 폭발형이 대규모로 함께 등장합니다.</p><p>무너진 진형은 소리씨앗을 활용해 빠르게 복구하세요.</p>`;}
  else if(newPlants.length){unlockTitle.textContent="🌱 새로운 식물 발견!";unlockContent.innerHTML=plantHTML;}
  else{unlockTitle.textContent="⚔ 다음 Wave";unlockContent.innerHTML=`<p>지금까지 해금한 식물을 조합해 방어하세요.</p>`;}
  unlockNextButton.textContent=nextWave===9?"FINAL WAVE 시작":`Wave ${nextWave} 시작`;unlockNextButton.dataset.wave=nextWave;unlockOverlay.classList.remove("hidden");playSfx("wave_start");
}
unlockNextButton.addEventListener("click",function(){playSfx("click_ui");const action=unlockNextButton.dataset.action;if(action==="start-main"){startMainGame();return;}if(action==="start-raid"){startRaid();return;}const nextWave=Number(unlockNextButton.dataset.wave);if(!nextWave)return;unlockOverlay.classList.add("hidden");currentWave=nextWave;startWave();});
function startWave(){
  if(gameOver)return;
  tutorialMode=false;raidMode=false;
  // RAID에서 웨이브로 돌아오는 경우 보스 BGM 정지 후 일반 BGM 재개(이미 재생 중이면 중복 없음)
  stopBossBgm();
  if(
    bgmRuntime.battleEverPlayed&&
    (!bgmRuntime.audio||bgmRuntime.audio.paused)
  ){
    requestBattleBgm({restart:false});
  }
  const config=WAVE_CONFIG[currentWave];if(!config)return;waveInProgress=true;resolvedZombies=0;waveZombieCount=config.zombieCount;waveWordBag=[];lastSpawnedWordId=null;buildEnemyTypeBag();waveDisplay.textContent=currentWave===9?"FINAL":currentWave;let spawned=0;spawnZombie();spawned++;currentSpawnTimer=setInterval(()=>{if(gameOver||spawned>=waveZombieCount){clearInterval(currentSpawnTimer);currentSpawnTimer=null;return;}spawnZombie();spawned++;},config.spawnInterval);
}
function removeEndIllustrationOverlay(){
  const existing=document.getElementById("end-illustration-overlay");
  if(existing) existing.remove();
}

function showClearIllustration(){
  removeEndIllustrationOverlay();

  const overlay=document.createElement("div");
  overlay.id="end-illustration-overlay";
  overlay.className="end-illustration-overlay";
  overlay.innerHTML=`
    <div class="end-illustration-stage">
      <p class="end-illustration-message">
        여러분과 식물들이 힘을 합친 결과,<br>
        학교를 좀비들로부터 지켜냈습니다! 좀비들은 오늘도 퇴근입니다!
      </p>
      <img
        src="images/screens/clear_illustration.png"
        alt=""
        class="end-illustration-image"
        draggable="false"
      >
      <button type="button" class="end-illustration-button" id="clear-result-button">
        결과 보기
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      overlay.classList.add("is-visible");
    });
  });

  overlay.querySelector("#clear-result-button").addEventListener("click",()=>{
    playSfx("click_ui");
    removeEndIllustrationOverlay();
    unlockOverlay.classList.remove("hidden");
  });
}

function showGameOverIllustration(){
  removeEndIllustrationOverlay();

  const overlay=document.createElement("div");
  overlay.id="end-illustration-overlay";
  overlay.className="end-illustration-overlay";
  overlay.innerHTML=`
    <div class="end-illustration-stage">
      <p class="end-illustration-message">
        결국 학교는 좀비들에게 함락되었습니다…<br>
        내일부터 등교는 조금 어려울지도 모르겠습니다...
      </p>
      <img
        src="images/screens/gameover_illustration.png"
        alt=""
        class="end-illustration-image"
        draggable="false"
      >
      <button type="button" class="end-illustration-button" id="gameover-retry-button">
        다시 하기
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      overlay.classList.add("is-visible");
    });
  });

  overlay.querySelector("#gameover-retry-button").addEventListener("click",()=>{
    playSfx("click_ui");
    location.reload();
  });
}

function endGame(){
  if(gameOver)return;

  if(practiceMode){
    finishPracticeSession("방어선 도달 — 테스트 종료");
    return;
  }

  gameOver=true;waveInProgress=false;raidMode=false;stopBattleBgm();life=0;lifeDisplay.textContent=life;if(currentSpawnTimer){clearInterval(currentSpawnTimer);currentSpawnTimer=null;}restartButton.style.display="inline-block";plantButtons.forEach(button=>button.disabled=true);removeButton.disabled=true;unlockTitle.textContent="💀 GAME OVER";unlockContent.innerHTML=`<p>방어선이 무너졌습니다.</p>${buildGameFeedbackHTML(false)}`;unlockNextButton.style.display="none";
  showGameOverIllustration();
}
function finishGame(){
  if(gameOver)return;

  gameOver=true;
  waveInProgress=false;
  raidMode=false;
  stopBattleBgm();

  // 기존 최종 클리어 보너스
  score+=1000;

  // RAID +3000과 최종 클리어 +1000이 반영된 뒤
  // 시간/에너지 보너스를 계산한다.
  const finalResult=
    applyFinalClearScore();

  scoreDisplay.textContent=score;

  restartButton.style.display="inline-block";

  plantButtons.forEach(
    button=>button.disabled=true
  );

  removeButton.disabled=true;

  unlockTitle.textContent=
    "🏆 RAID CLEAR!";

  const scoreBreakdown=
    finalResult
      ? getFinalScoreBreakdownHTML(finalResult)
      : "";

  unlockContent.innerHTML=`
    <p>
      Final Wave와 Raid Boss를 모두 격파했습니다!
    </p>

    <p>
      RAID 클리어 보너스 +3000<br>
      최종 클리어 보너스 +1000
    </p>

    ${scoreBreakdown}

    ${buildGameFeedbackHTML(true)}
  `;

  unlockNextButton.style.display=
    "none";

  showClearIllustration();
}


setInterval(()=>{if(!gameOver&&waveInProgress&&!tutorialMode)changeEnergy(10);},8000);
restartButton.addEventListener("click",()=>{playSfx("click_ui");location.reload();});



function formatRemovePlantButton(){
  if(!removeButton){
    return;
  }

  removeButton.innerHTML=
    `<span class="plant-card-copy">`+
      `<span class="plant-name-label">식물 제거</span>`+
    `</span>`+
    `<span class="plant-cost-label remove-refund-label">구매가의 30% 반환</span>`;

  removeButton.dataset.sidebarFormatted="true";
}

function getPlantDisplayName(type){
  return type==="에너지식물"?"소리꽃":(type||"");
}

function formatSidebarPlantButtons(){
  plantButtons.forEach(button=>{
    const type=button.dataset.plant||"";
    const cost=button.dataset.cost||"";
    const displayName=getPlantDisplayName(type);
    const nameLen=displayName.length;
    const lenClass=nameLen<=2?"name-len-2":nameLen===3?"name-len-3":"name-len-4";

    button.innerHTML=
      `<span class="plant-card-copy">`+
        `<span class="plant-name-label ${lenClass}">${displayName}</span>`+
      `</span>`+
      `<span class="plant-cost-label">${cost}</span>`;

    button.dataset.sidebarFormatted="true";
  });

  formatRemovePlantButton();
}

function ensureLaneOverlay(scene){
  if(!scene||scene.querySelector(".playfield-lane-overlay"))return;

  const overlay=document.createElement("div");
  overlay.className="playfield-lane-overlay";
  overlay.setAttribute("aria-hidden","true");

  const viewport=scene.querySelector(".game-board-viewport");
  if(viewport)scene.insertBefore(overlay,viewport);
  else scene.appendChild(overlay);
}

function ensureStartMarkers(scene){
  if(!scene)return;

  scene.querySelector(".playfield-start-zone")?.remove();

  const viewport=scene.querySelector(".game-board-viewport");
  const boardEl=viewport?.querySelector(".game-board");
  if(!viewport||!boardEl)return;

  for(const child of [...viewport.children]){
    if(child.classList.contains("playfield-start-markers")){
      child.remove();
    }
  }

  let container=boardEl.querySelector(".playfield-start-markers");
  if(!container){
    container=document.createElement("div");
    container.className="playfield-start-markers";
    container.setAttribute("aria-hidden","true");
    boardEl.insertBefore(container,boardEl.firstChild);

    for(let row=0;row<5;row++){
      const marker=document.createElement("div");
      marker.className="playfield-start-marker";
      marker.dataset.row=String(row);
      container.appendChild(marker);
    }
  }else if(container.parentElement!==boardEl){
    boardEl.insertBefore(container,boardEl.firstChild);
  }
}

function setupBattleScene(center){
  if(!center||center.querySelector(".battle-scene")){
    return center?center.querySelector(".battle-scene"):null;
  }

  const scene=document.createElement("div");
  scene.className="battle-scene";

  const bg=document.createElement("div");
  bg.className="battle-scene-bg";

  const img=document.createElement("img");
  img.className="battle-scene-image";
  img.src="./images/backgrounds/school_field.png";
  img.alt="";
  img.draggable=false;
  img.decoding="async";
  bg.appendChild(img);
  scene.appendChild(bg);
  center.appendChild(scene);

  ensureLaneOverlay(scene);
  ensureStartMarkers(scene);

  return scene;
}

function ensureGameBoardViewport(center){
  if(!center||!board)return null;

  let viewport=document.querySelector(".game-board-viewport");
  if(!viewport){
    viewport=document.createElement("div");
    viewport.className="game-board-viewport";
    center.appendChild(viewport);
  }

  if(board.parentElement!==viewport){
    viewport.appendChild(board);
  }

  const scene=setupBattleScene(center);
  if(scene&&viewport.parentElement!==scene){
    scene.appendChild(viewport);
  }
  ensureLaneOverlay(scene);
  ensureStartMarkers(scene);

  return viewport;
}

function setupBattleSideLayout(){
  const plantMenu=
    document.querySelector(".plant-menu");

  if(!plantMenu||!board)return;

  if(
    document.querySelector(".battle-layout")
  ){
    ensureBattleMainColumn();
    ensureRaidHudDock();
    const center=document.querySelector(".battle-center");
    ensureGameBoardViewport(center);
    placePlantInfoBelowBoard();
    return;
  }

  const originalParent=
    board.parentElement;

  const layout=
    document.createElement("div");

  layout.className=
    "battle-layout";

  const left=
    document.createElement("aside");

  left.className=
    "battle-sidebar battle-sidebar-left";

  const center=
    document.createElement("main");

  center.className=
    "battle-center";

  originalParent.insertBefore(
    layout,
    board
  );

  const main=
    document.createElement("div");

  main.className=
    "battle-main";

  layout.appendChild(left);
  layout.appendChild(main);
  ensureRaidHudDock();
  main.appendChild(center);

  const scene=setupBattleScene(center);
  const viewport=document.createElement("div");
  viewport.className="game-board-viewport";
  scene.appendChild(viewport);
  viewport.appendChild(board);

  ensureStartMarkers(scene);

  const energyGroup=
    plantMenu.querySelector(".energy-group");

  const consonantGroup=
    plantMenu.querySelector(".consonant-group");

  const vowelGroup=
    plantMenu.querySelector(".vowel-group");

  if(energyGroup){
    left.appendChild(
      energyGroup
    );
  }

  if(consonantGroup){
    left.appendChild(
      consonantGroup
    );
  }

  if(vowelGroup){
    left.appendChild(
      vowelGroup
    );
  }

  if(removeButton){
    const removeWrap=
      document.createElement("div");

    removeWrap.className=
      "sidebar-remove-wrap";

    removeWrap.appendChild(
      removeButton
    );

    left.appendChild(
      removeWrap
    );
  }

  plantMenu.style.display=
    "none";

  formatSidebarPlantButtons();
  placePlantInfoBelowBoard();
}




function injectVisualAssetStyles(){
  if(document.getElementById("phoneme-defense-asset-styles")) return;

  const style=document.createElement("style");
  style.id="phoneme-defense-asset-styles";
  style.textContent=`
    .cell,
    .plant,
    .plant-visual {
      overflow: visible;
    }

    .plant {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      overflow: visible;
      z-index: 5;
    }

    .plant-visual {
      position: relative;
      width: 100%;
      height: 74px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
      pointer-events: none;
    }

    .plant-image {
      width: 96px;
      height: 96px;
      object-fit: contain;
      object-position: center;
      position: relative;
      top: -3px;
      display: block;
      pointer-events: none;
      user-select: none;
      filter: drop-shadow(0 2px 2px rgba(0,0,0,.16));
    }

    .plant-image-fallback {
      display: none;
      font-size: 44px;
      line-height: 1;
    }

    .plant-image-fallback.visible {
      display: block;
    }

    .plant-name {
      position: absolute;
      left: 50%;
      bottom: -3px;
      transform: translateX(-50%);
      padding: 1px 5px;
      border-radius: 6px;
      background: rgba(255,255,255,.82);
      border: 1px solid rgba(0,0,0,.09);
      box-shadow: 0 1px 1px rgba(0,0,0,.10);
      font-size: 9px;
      font-weight: 900;
      line-height: 1.05;
      white-space: nowrap;
      z-index: 7;
      pointer-events: none;
    }

    .plant > .hp-bar {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: 1px;
      width: auto;
      height: 5px !important;
      min-height: 5px !important;
      border-width: 1px !important;
      border-radius: 4px !important;
      box-sizing: border-box;
      z-index: 8;
    }

    .plant > .hp-bar .hp-fill {
      height: 100% !important;
      border-radius: 3px !important;
    }

    .zombie {
      width: 76px !important;
      height: 76px !important;
      overflow: visible !important;
      position: absolute;
      z-index: 12;
    }

    .zombie-visual {
      position: absolute;
      left: -8px;
      top: -4px;
      width: 92px;
      height: 92px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      overflow: visible;
    }

    .zombie-image {
      width: 92px;
      height: 92px;
      object-fit: contain;
      object-position: center;
      display: block;
      user-select: none;
      pointer-events: none;
      filter: drop-shadow(0 3px 3px rgba(0,0,0,.22));
    }

    .zombie-runner .zombie-image {
      width: 96px;
      height: 96px;
    }

    .zombie-breaker .zombie-image,
    .zombie-resilient .zombie-image,
    .zombie-bomber .zombie-image {
      width: 98px;
      height: 98px;
    }

    .zombie-image-fallback {
      display: none;
      font-size: 46px;
      line-height: 1;
    }

    .zombie-image-fallback.visible {
      display: block;
    }

    .zombie-word-label {
      position: absolute;
      left: 50%;
      top: -14px;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 3px 7px;
      border-radius: 11px;
      background: rgba(255,255,255,.94);
      border: 1px solid rgba(0,0,0,.16);
      box-shadow: 0 2px 4px rgba(0,0,0,.17);
      white-space: nowrap;
      z-index: 25;
      pointer-events: none;
    }

    .zombie-type-badge {
      font-size: 12px;
      line-height: 1;
    }

    .zombie-word-text {
      font-size: 14px;
      line-height: 1;
      font-weight: 900;
      color: #222;
    }

    .zombie > .hp-bar {
      position: absolute;
      left: 6px;
      right: 6px;
      bottom: -7px;
      width: auto;
      z-index: 24;
    }

    #raid-boss-body {
      overflow: visible !important;
      border: none !important;
      background: transparent !important;
      box-shadow: none !important;
      filter: none !important;
    }

    .raid-boss-image {
      width: 315px;
      height: calc(${BOARD_ROWS * CELL_SIZE}px - 22px);
      object-fit: contain;
      object-position: center;
      display: block;
      pointer-events: none;
      user-select: none;
      transform: translateX(58px);
      transform-origin: center center;
      filter: drop-shadow(0 8px 8px rgba(0,0,0,.34));
    }

    .raid-boss-image-fallback {
      display: none;
      font-size: 74px;
      line-height: 1;
    }

    .raid-boss-image-fallback.visible {
      display: block;
    }

    .zombie.frozen .zombie-image {
      filter: drop-shadow(0 3px 3px rgba(0,0,0,.22)) saturate(.72) brightness(1.18);
    }

    .zombie.slowed .zombie-image {
      opacity: .88;
    }
  `;

  document.head.appendChild(style);
}

ensurePracticeModeUI();
preloadGameImages();
preloadSfx();
preloadBattleBgm();
initBgmAutoplayUnlock();
injectVisualAssetStyles();
energyDisplay.textContent=energy;waveDisplay.textContent=currentWave;lifeDisplay.textContent=life;scoreDisplay.textContent=score;updatePlantButtons();setupBattleSideLayout();createBoard();initGameFitScale();requestAnimationFrame(gameLoop);
