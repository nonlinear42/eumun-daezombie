// ============================================
// 음운 디펜스 - data.js
// ============================================


// ============================================
// 음운 데이터
// ============================================

const PHONEMES = {

  // 자음

  "ㅁ":{
    type:"consonant",
    features:["양순음","비음"]
  },

  "ㅂ":{
    type:"consonant",
    features:["양순음","파열음","예사소리"]
  },

  "ㅃ":{
    type:"consonant",
    features:["양순음","파열음","된소리"]
  },

  "ㅍ":{
    type:"consonant",
    features:["양순음","파열음","거센소리"]
  },

  "ㄴ":{
    type:"consonant",
    features:["치조음","비음"]
  },

  "ㄷ":{
    type:"consonant",
    features:["치조음","파열음","예사소리"]
  },

  "ㄸ":{
    type:"consonant",
    features:["치조음","파열음","된소리"]
  },

  "ㄹ":{
    type:"consonant",
    features:["치조음","유음"]
  },

  "ㅅ":{
    type:"consonant",
    features:["치조음","마찰음","예사소리"]
  },

  "ㅆ":{
    type:"consonant",
    features:["치조음","마찰음","된소리"]
  },

  "ㅌ":{
    type:"consonant",
    features:["치조음","파열음","거센소리"]
  },

  "ㅈ":{
    type:"consonant",
    features:["경구개음","파찰음","예사소리"]
  },

  "ㅉ":{
    type:"consonant",
    features:["경구개음","파찰음","된소리"]
  },

  "ㅊ":{
    type:"consonant",
    features:["경구개음","파찰음","거센소리"]
  },

  "ㄱ":{
    type:"consonant",
    features:["연구개음","파열음","예사소리"]
  },

  "ㄲ":{
    type:"consonant",
    features:["연구개음","파열음","된소리"]
  },

  "ㅋ":{
    type:"consonant",
    features:["연구개음","파열음","거센소리"]
  },

  "ㅇ":{
    type:"consonant",
    features:["연구개음","비음"]
  },

  "ㅎ":{
    type:"consonant",
    features:["후음","마찰음","예사소리"]
  },


  // 모음

  "ㅣ":{
    type:"vowel",
    features:["전설모음","고모음","평순모음"]
  },

  "ㅔ":{
    type:"vowel",
    features:["전설모음","중모음","평순모음"]
  },

  "ㅐ":{
    type:"vowel",
    features:["전설모음","저모음","평순모음"]
  },

  "ㅚ":{
    type:"vowel",
    features:["전설모음","중모음","원순모음"]
  },

  "ㅟ":{
    type:"vowel",
    features:["전설모음","고모음","원순모음"]
  },

  "ㅡ":{
    type:"vowel",
    features:["후설모음","고모음","평순모음"]
  },

  "ㅜ":{
    type:"vowel",
    features:["후설모음","고모음","원순모음"]
  },

  "ㅗ":{
    type:"vowel",
    features:["후설모음","중모음","원순모음"]
  },

  "ㅓ":{
    type:"vowel",
    features:["후설모음","중모음","평순모음"]
  },

  "ㅏ":{
    type:"vowel",
    features:["후설모음","저모음","평순모음"]
  }

};


// ============================================
// 단어 DB
// ============================================

// =========================================================
// 음운 디펜스 WORD_DB - 100단어 최종 후보
// 기존 data.js의 "const WORD_DB = [...]" 부분만 이 블록으로 교체하세요.
// PHONEMES / PLANT_DB는 건드리지 않습니다.
// =========================================================

const WORD_DB = [
{ id:"DB-001", word:"나무", phonemes:["ㄴ","ㅏ","ㅁ","ㅜ"], debutWave:1 },
  { id:"DB-002", word:"나비", phonemes:["ㄴ","ㅏ","ㅂ","ㅣ"], debutWave:1 },
  { id:"DB-003", word:"메모", phonemes:["ㅁ","ㅔ","ㅁ","ㅗ"], debutWave:1 },
  { id:"DB-004", word:"다리", phonemes:["ㄷ","ㅏ","ㄹ","ㅣ"], debutWave:1 },
  { id:"DB-005", word:"도시", phonemes:["ㄷ","ㅗ","ㅅ","ㅣ"], debutWave:1 },
  { id:"DB-006", word:"마루", phonemes:["ㅁ","ㅏ","ㄹ","ㅜ"], debutWave:1 },
  { id:"DB-007", word:"머리", phonemes:["ㅁ","ㅓ","ㄹ","ㅣ"], debutWave:1 },
  { id:"DB-008", word:"모자", phonemes:["ㅁ","ㅗ","ㅈ","ㅏ"], debutWave:1 },
  { id:"DB-009", word:"바다", phonemes:["ㅂ","ㅏ","ㄷ","ㅏ"], debutWave:1 },
  { id:"DB-010", word:"두부", phonemes:["ㄷ","ㅜ","ㅂ","ㅜ"], debutWave:1 },
  { id:"DB-011", word:"소금", phonemes:["ㅅ","ㅗ","ㄱ","ㅡ","ㅁ"], debutWave:2 },
  { id:"DB-012", word:"사람", phonemes:["ㅅ","ㅏ","ㄹ","ㅏ","ㅁ"], debutWave:2 },
  { id:"DB-013", word:"바람", phonemes:["ㅂ","ㅏ","ㄹ","ㅏ","ㅁ"], debutWave:2 },
  { id:"DB-014", word:"구름", phonemes:["ㄱ","ㅜ","ㄹ","ㅡ","ㅁ"], debutWave:2 },
  { id:"DB-015", word:"공", phonemes:["ㄱ","ㅗ","ㅇ"], debutWave:2 },
  { id:"DB-016", word:"강", phonemes:["ㄱ","ㅏ","ㅇ"], debutWave:2 },
  { id:"DB-017", word:"산", phonemes:["ㅅ","ㅏ","ㄴ"], debutWave:2 },
  { id:"DB-018", word:"손", phonemes:["ㅅ","ㅗ","ㄴ"], debutWave:2 },
  { id:"DB-019", word:"제비", phonemes:["ㅈ","ㅔ","ㅂ","ㅣ"], debutWave:2 },
  { id:"DB-020", word:"눈", phonemes:["ㄴ","ㅜ","ㄴ"], debutWave:2 },
  { id:"DB-021", word:"가구", phonemes:["ㄱ","ㅏ","ㄱ","ㅜ"], debutWave:3 },
  { id:"DB-022", word:"고기", phonemes:["ㄱ","ㅗ","ㄱ","ㅣ"], debutWave:3 },
  { id:"DB-023", word:"외모", phonemes:["ㅚ","ㅁ","ㅗ"], debutWave:3 },
  { id:"DB-024", word:"국", phonemes:["ㄱ","ㅜ","ㄱ"], debutWave:3 },
  { id:"DB-025", word:"기차", phonemes:["ㄱ","ㅣ","ㅊ","ㅏ"], debutWave:3 },
  { id:"DB-026", word:"꽃", phonemes:["ㄲ","ㅗ","ㅊ"], debutWave:3 },
  { id:"DB-027", word:"책", phonemes:["ㅊ","ㅐ","ㄱ"], debutWave:3 },
  { id:"DB-028", word:"밖", phonemes:["ㅂ","ㅏ","ㄲ"], debutWave:3 },
  { id:"DB-029", word:"부엌", phonemes:["ㅂ","ㅜ","ㅓ","ㅋ"], debutWave:3 },
  { id:"DB-030", word:"끝", phonemes:["ㄲ","ㅡ","ㅌ"], debutWave:3 },
  { id:"DB-031", word:"물", phonemes:["ㅁ","ㅜ","ㄹ"], debutWave:4 },
  { id:"DB-032", word:"불", phonemes:["ㅂ","ㅜ","ㄹ"], debutWave:4 },
  { id:"DB-033", word:"달", phonemes:["ㄷ","ㅏ","ㄹ"], debutWave:4 },
  { id:"DB-034", word:"말", phonemes:["ㅁ","ㅏ","ㄹ"], debutWave:4 },
  { id:"DB-035", word:"발", phonemes:["ㅂ","ㅏ","ㄹ"], debutWave:4 },
  { id:"DB-036", word:"길", phonemes:["ㄱ","ㅣ","ㄹ"], debutWave:4 },
  { id:"DB-037", word:"얼굴", phonemes:["ㅓ","ㄹ","ㄱ","ㅜ","ㄹ"], debutWave:4 },
  { id:"DB-038", word:"이름", phonemes:["ㅣ","ㄹ","ㅡ","ㅁ"], debutWave:4 },
  { id:"DB-039", word:"소리", phonemes:["ㅅ","ㅗ","ㄹ","ㅣ"], debutWave:4 },
  { id:"DB-040", word:"회비", phonemes:["ㅎ","ㅚ","ㅂ","ㅣ"], debutWave:4 },
  { id:"DB-041", word:"옷", phonemes:["ㅗ","ㅅ"], debutWave:5 },
  { id:"DB-042", word:"숲", phonemes:["ㅅ","ㅜ","ㅍ"], debutWave:5 },
  { id:"DB-043", word:"낮", phonemes:["ㄴ","ㅏ","ㅈ"], debutWave:5 },
  { id:"DB-044", word:"신문", phonemes:["ㅅ","ㅣ","ㄴ","ㅁ","ㅜ","ㄴ"], debutWave:5 },
  { id:"DB-045", word:"사진", phonemes:["ㅅ","ㅏ","ㅈ","ㅣ","ㄴ"], debutWave:5 },
  { id:"DB-046", word:"소설", phonemes:["ㅅ","ㅗ","ㅅ","ㅓ","ㄹ"], debutWave:5 },
  { id:"DB-047", word:"시험", phonemes:["ㅅ","ㅣ","ㅎ","ㅓ","ㅁ"], debutWave:5 },
  { id:"DB-048", word:"성적", phonemes:["ㅅ","ㅓ","ㅇ","ㅈ","ㅓ","ㄱ"], debutWave:5 },
  { id:"DB-049", word:"세수", phonemes:["ㅅ","ㅔ","ㅅ","ㅜ"], debutWave:5 },
  { id:"DB-050", word:"호수", phonemes:["ㅎ","ㅗ","ㅅ","ㅜ"], debutWave:5 },
  { id:"DB-051", word:"한국", phonemes:["ㅎ","ㅏ","ㄴ","ㄱ","ㅜ","ㄱ"], debutWave:6 },
  { id:"DB-052", word:"학생", phonemes:["ㅎ","ㅏ","ㄱ","ㅅ","ㅐ","ㅇ"], debutWave:6 },
  { id:"DB-053", word:"국어", phonemes:["ㄱ","ㅜ","ㄱ","ㅓ"], debutWave:6 },
  { id:"DB-054", word:"수학", phonemes:["ㅅ","ㅜ","ㅎ","ㅏ","ㄱ"], debutWave:6 },
  { id:"DB-055", word:"음악", phonemes:["ㅡ","ㅁ","ㅏ","ㄱ"], debutWave:6 },
  { id:"DB-056", word:"운동", phonemes:["ㅜ","ㄴ","ㄷ","ㅗ","ㅇ"], debutWave:6 },
  { id:"DB-057", word:"학급", phonemes:["ㅎ","ㅏ","ㄱ","ㄱ","ㅡ","ㅂ"], debutWave:6 },
  { id:"DB-058", word:"문장", phonemes:["ㅁ","ㅜ","ㄴ","ㅈ","ㅏ","ㅇ"], debutWave:6 },
  { id:"DB-059", word:"단어", phonemes:["ㄷ","ㅏ","ㄴ","ㅓ"], debutWave:6 },
  { id:"DB-060", word:"세금", phonemes:["ㅅ","ㅔ","ㄱ","ㅡ","ㅁ"], debutWave:6 },
  { id:"DB-061", word:"발음", phonemes:["ㅂ","ㅏ","ㄹ","ㅡ","ㅁ"], debutWave:6 },
  { id:"DB-062", word:"자음", phonemes:["ㅈ","ㅏ","ㅡ","ㅁ"], debutWave:7 },
  { id:"DB-063", word:"모음", phonemes:["ㅁ","ㅗ","ㅡ","ㅁ"], debutWave:7 },
  { id:"DB-064", word:"음운", phonemes:["ㅡ","ㅁ","ㅜ","ㄴ"], debutWave:7 },
  { id:"DB-065", word:"언어", phonemes:["ㅓ","ㄴ","ㅓ"], debutWave:7 },
  { id:"DB-066", word:"친구", phonemes:["ㅊ","ㅣ","ㄴ","ㄱ","ㅜ"], debutWave:7 },
  { id:"DB-067", word:"작품", phonemes:["ㅈ","ㅏ","ㄱ","ㅍ","ㅜ","ㅁ"], debutWave:7 },
  { id:"DB-068", word:"작가", phonemes:["ㅈ","ㅏ","ㄱ","ㄱ","ㅏ"], debutWave:7 },
  { id:"DB-069", word:"감정", phonemes:["ㄱ","ㅏ","ㅁ","ㅈ","ㅓ","ㅇ"], debutWave:7 },
  { id:"DB-070", word:"주제", phonemes:["ㅈ","ㅜ","ㅈ","ㅔ"], debutWave:7 },
  { id:"DB-071", word:"토마토", phonemes:["ㅌ","ㅗ","ㅁ","ㅏ","ㅌ","ㅗ"], debutWave:7 },
  { id:"DB-072", word:"소나무", phonemes:["ㅅ","ㅗ","ㄴ","ㅏ","ㅁ","ㅜ"], debutWave:7 },
  { id:"DB-073", word:"위치", phonemes:["ㅟ","ㅊ","ㅣ"], debutWave:7 },
  { id:"DB-074", word:"선생님", phonemes:["ㅅ","ㅓ","ㄴ","ㅅ","ㅐ","ㅇ","ㄴ","ㅣ","ㅁ"], debutWave:8 },
  { id:"DB-075", word:"운동장", phonemes:["ㅜ","ㄴ","ㄷ","ㅗ","ㅇ","ㅈ","ㅏ","ㅇ"], debutWave:8 },
  { id:"DB-076", word:"책가방", phonemes:["ㅊ","ㅐ","ㄱ","ㄱ","ㅏ","ㅂ","ㅏ","ㅇ"], debutWave:8 },
  { id:"DB-077", word:"학생회", phonemes:["ㅎ","ㅏ","ㄱ","ㅅ","ㅐ","ㅇ","ㅎ","ㅚ"], debutWave:8 },
  { id:"DB-078", word:"도서실", phonemes:["ㄷ","ㅗ","ㅅ","ㅓ","ㅅ","ㅣ","ㄹ"], debutWave:8 },
  { id:"DB-079", word:"국어책", phonemes:["ㄱ","ㅜ","ㄱ","ㅓ","ㅊ","ㅐ","ㄱ"], debutWave:8 },
  { id:"DB-080", word:"음악실", phonemes:["ㅡ","ㅁ","ㅏ","ㄱ","ㅅ","ㅣ","ㄹ"], debutWave:8 },
  { id:"DB-081", word:"문학책", phonemes:["ㅁ","ㅜ","ㄴ","ㅎ","ㅏ","ㄱ","ㅊ","ㅐ","ㄱ"], debutWave:8 },
  { id:"DB-082", word:"사진첩", phonemes:["ㅅ","ㅏ","ㅈ","ㅣ","ㄴ","ㅊ","ㅓ","ㅂ"], debutWave:8 },
  { id:"DB-083", word:"독서실", phonemes:["ㄷ","ㅗ","ㄱ","ㅅ","ㅓ","ㅅ","ㅣ","ㄹ"], debutWave:8 },
  { id:"DB-084", word:"운동복", phonemes:["ㅜ","ㄴ","ㄷ","ㅗ","ㅇ","ㅂ","ㅗ","ㄱ"], debutWave:8 },
  { id:"DB-085", word:"회색", phonemes:["ㅎ","ㅚ","ㅅ","ㅐ","ㄱ"], debutWave:8 },
  { id:"DB-086", word:"위험", phonemes:["ㅟ","ㅎ","ㅓ","ㅁ"], debutWave:8 },
  { id:"DB-087", word:"친구들", phonemes:["ㅊ","ㅣ","ㄴ","ㄱ","ㅜ","ㄷ","ㅡ","ㄹ"], debutWave:9 },
  { id:"DB-088", word:"학생들", phonemes:["ㅎ","ㅏ","ㄱ","ㅅ","ㅐ","ㅇ","ㄷ","ㅡ","ㄹ"], debutWave:9 },
  { id:"DB-089", word:"고무신", phonemes:["ㄱ","ㅗ","ㅁ","ㅜ","ㅅ","ㅣ","ㄴ"], debutWave:9 },
  { id:"DB-090", word:"소금물", phonemes:["ㅅ","ㅗ","ㄱ","ㅡ","ㅁ","ㅁ","ㅜ","ㄹ"], debutWave:9 },
  { id:"DB-091", word:"손가락", phonemes:["ㅅ","ㅗ","ㄴ","ㄱ","ㅏ","ㄹ","ㅏ","ㄱ"], debutWave:9 },
  { id:"DB-092", word:"발가락", phonemes:["ㅂ","ㅏ","ㄹ","ㄱ","ㅏ","ㄹ","ㅏ","ㄱ"], debutWave:9 },
  { id:"DB-093", word:"수박씨", phonemes:["ㅅ","ㅜ","ㅂ","ㅏ","ㄱ","ㅆ","ㅣ"], debutWave:9 },
  { id:"DB-094", word:"신문지", phonemes:["ㅅ","ㅣ","ㄴ","ㅁ","ㅜ","ㄴ","ㅈ","ㅣ"], debutWave:9 },
  { id:"DB-095", word:"김칫국", phonemes:["ㄱ","ㅣ","ㅁ","ㅊ","ㅣ","ㅅ","ㄱ","ㅜ","ㄱ"], debutWave:9 },
  { id:"DB-096", word:"한국어", phonemes:["ㅎ","ㅏ","ㄴ","ㄱ","ㅜ","ㄱ","ㅓ"], debutWave:9 },
  { id:"DB-097", word:"문학가", phonemes:["ㅁ","ㅜ","ㄴ","ㅎ","ㅏ","ㄱ","ㄱ","ㅏ"], debutWave:9 },
  { id:"DB-098", word:"소설가", phonemes:["ㅅ","ㅗ","ㅅ","ㅓ","ㄹ","ㄱ","ㅏ"], debutWave:9 },
  { id:"DB-099", word:"메모지", phonemes:["ㅁ","ㅔ","ㅁ","ㅗ","ㅈ","ㅣ"], debutWave:9 },
  { id:"DB-100", word:"외국인", phonemes:["ㅚ","ㄱ","ㅜ","ㄱ","ㅣ","ㄴ"], debutWave:9 },
];



// ============================================
// 식물 DB
// ============================================

const PLANT_DB = {


  // ------------------------------------------
  // 경제
  // ------------------------------------------

  "에너지식물":{

    name:"소리꽃",

    feature:null,

    role:"경제",

    description:
      "8초마다 소리씨앗 25를 생산합니다.",

    cost:40,

    hp:120,

    attackType:"generator",

    special:{
      type:"energy",
      amount:25,
      interval:8
    }

  },


  // ------------------------------------------
  // 자음 공격
  // ------------------------------------------

  "양순음":{

    name:"양순음 식물",

    feature:"양순음",

    role:"속사",

    description:
      "낮은 피해를 매우 빠르게 반복해서 줍니다.",

    cost:50,

    hp:140,

    damage:8,

    attackInterval:0.55,

    attackType:"rapid"

  },


  "치조음":{

    name:"치조음 식물",

    feature:"치조음",

    role:"균형 공격",

    description:
      "공격력과 공격속도가 균형 잡힌 기본 딜러입니다.",

    cost:75,

    hp:160,

    damage:16,

    attackInterval:1,

    attackType:"balanced"

  },


"비음": {
  name:"비음 식물",
  feature:"비음",
  role:"집중 3점사",
  description:"한 적에게 3발을 집중 사격합니다. 마지막 탄은 강한 피해와 함께 주변 적에게 범위 피해를 줍니다.",
  cost:90,
  hp:150,
  damage:12,
  attackInterval:2,
  attackType:"burst",
  special:{
    type:"burst",
    shots:3,
    spacing:160,
    finalShotDamage:40,
    splashDamage:16,
    splashRadius:120
  }
},


  "파열음":{

    name:"파열음 식물",

    feature:"파열음",

    role:"중포",

    description:
      "공격은 느리지만 한 발의 피해량이 매우 높습니다.",

    cost:150,

    hp:200,

    damage:75,

    attackInterval:2.8,

    attackType:"heavy"

  },


  "유음":{

    name:"유음 식물",

    feature:"유음",

    role:"전 레인 연쇄",

    description:
      "같은 레인의 적을 공격한 뒤 다른 레인의 유음 적에게 공격이 연쇄됩니다.",

    cost:135,

    hp:170,

    damage:28,

    attackInterval:1.35,

    attackType:"chain",

    special:{
      maxTargets:3,
      damageRatios:[1,0.75,0.6]
    }

  },


  "마찰음":{

    name:"마찰음 식물",

    feature:"마찰음",

    role:"지속 피해",

    description:
      "공격한 적에게 3초 동안 지속 피해를 남깁니다.",

    cost:120,

    hp:160,

    damage:12,

    attackInterval:1.05,

    attackType:"dot",

    special:{
      duration:3,
      tickInterval:0.5,
      tickDamage:6
    }

  },


  "연구개음": {
  name:"연구개음 식물",
  feature:"연구개음",
  role:"관통",
  description:"연구개음 적이 있으면 공격을 시작하며, 같은 레인의 적을 모두 관통합니다. 뒤쪽 적일수록 피해가 감소합니다.",
  cost:145,
  hp:175,
  damage:38,
  attackInterval:1.8,
  attackType:"pierce",
  special:{
    type:"pierce",
    damageRatios:[1,0.7,0.45],
    extraTargetRatio:0.3
  }
},


  "파찰음":{

    name:"파찰음 식물",

    feature:"파찰음",

    role:"처치 폭발",

    description:
      "공격으로 적을 처치하면 주변 파찰음 적에게 폭발 피해를 줍니다.",

    cost:155,

    hp:170,

    damage:34,

    attackInterval:1.45,

    attackType:"deathBurst",

    special:{
      radius:155,
      explosionDamage:28
    }

  },


  // ------------------------------------------
  // 모음 지원 / 방어
  // ------------------------------------------

  "평순모음": {

  name:"평순모음 식물",

  feature:"평순모음",

  role:"탱커",

  description:
    "높은 체력과 단단한 방어력으로 앞에서 적을 오래 막아냅니다.",

  cost:110,

  hp:700,

  attackType:"tank",

  special:{
    biteDamageTaken:20
  }

},


  "고모음":{

    name:"고모음 식물",

    feature:"고모음",

    role:"공격속도 버프",

    description:
      "고모음 적이 같은 레인에 있을 때 주변 공격 식물의 공격속도를 25% 높입니다.",

    cost:90,

    hp:135,

    attackType:"support",

    special:{
      type:"attackSpeedBuff",
      multiplier:0.75,
      radius:1
    }

  },


  "중모음":{

    name:"중모음 식물",

    feature:"중모음",

    role:"회복",

    description:
      "중모음 적이 같은 레인에 있을 때 4초마다 주변 식물의 HP를 25 회복합니다.",

    cost:100,

    hp:150,

    attackType:"support",

    special:{
      type:"heal",
      amount:25,
      interval:4,
      radius:1
    }

  },


  "원순모음":{

    name:"원순모음 식물",

    feature:"원순모음",

    role:"보호막",

    description:
      "원순모음 적이 같은 레인에 있을 때 주변 식물이 받는 피해를 35% 감소시킵니다.",

    cost:125,

    hp:180,

    attackType:"support",

    special:{
      type:"shield",
      damageReduction:0.35,
      radius:1
    }

  },


  "저모음":{

    name:"저모음 식물",

    feature:"저모음",

    role:"정지",

    description:
      "5초마다 가장 가까운 저모음 적 하나를 1.6초 동안 완전히 멈춥니다.",

    cost:115,

    hp:155,

    attackType:"control",

    special:{
      type:"freeze",
      interval:5,
      duration:1.6
    }

  },


  "후설모음": {
  name: "후설모음 식물",
  feature: "후설모음",
  role: "전장 둔화",

  description:
    "전장에 후설모음 적이 있으면 11초마다 모든 적의 이동 속도를 4초 동안 절반으로 낮춥니다.",

  cost: 200,
  hp: 165,

  attackType: "control",

  special: {
    type: "globalSlow",
    interval: 11,
    duration: 4,
    multiplier: 0.5
  }
},


  "경구개음": {
  name:"경구개음 식물",
  feature:"경구개음",
  role:"연속 제압",
  description:"짧은 시간 동안 7발을 연속 발사하며, 적이 쓰러지면 즉시 다음 경구개음 적을 노립니다.",
  cost:145,
  hp:165,
  damage:15,
  attackInterval:3.2,
  attackType:"volley",
  special:{
    shots:7,
    spacing:110
  }
},


"후음": {

  name:"후음 식물",

  feature:"후음",

  role:"저격",

  description:
    "같은 레인의 후음 적 중 현재 체력이 가장 높은 적을 우선 공격합니다.",

  cost:165,

  hp:145,

  damage:140,

  attackInterval:4,

  attackType:"sniper"

},


"전설모음": {
  name: "전설모음 식물",
  feature: "전설모음",
  role: "전장 정지",

  description:
    "전장에 전설모음 적이 있으면 12초마다 모든 적을 2초 동안 멈춥니다.",

  cost: 230,
  hp: 150,

  attackType: "control",

  special: {
    type: "globalFreeze",
    interval: 12,
    duration: 2
  }
}

};