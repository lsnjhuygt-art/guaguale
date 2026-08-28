import OpenAI from 'openai';
import { getAllHexagrams, reconstructLiuyaoLines } from './hexagram';
import { calculateLiuyaoLayout } from './liuyaoLayout';

// 安全解析并清洗 build-time 注入的环境变量
const sanitizeEnv = (val: any): string => {
  if (!val || val === '0' || val === 0 || val === 'undefined' || val === 'null') return '';
  return String(val).trim();
};

const formatBaseUrl = (urlStr: string): string => {
  let url = sanitizeEnv(urlStr) || 'https://generativelanguage.googleapis.com/v1beta/openai/';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  if (!url.endsWith('/')) {
    url = `${url}/`;
  }
  return url;
};

const apiKey = sanitizeEnv(process.env.API_KEY);
const baseURL = formatBaseUrl(process.env.BASE_URL || '');
const model = sanitizeEnv(process.env.MODEL) || 'gemini-2.5-flash';

let openai: OpenAI | null = null;

// 初始化 OpenAI client
const getOpenAIClient = () => {
  if (!openai) {
    if (!apiKey) {
      console.warn('AI API Key is missing. AI divination interpretation will not function.');
    }
    openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
      dangerouslyAllowBrowser: true
    });
  }
  return openai;
};

export interface LiuyaoData {
  question?: string;
  timestamp?: number;
  additionalContext?: string;
  mainHexagram: {
    name: string;
    unicode: string;
    judgment?: { original: string; translation: string };
    lines?: Array<{ original: string; translation: string }>;
  };
  changingLines: number[];
  transformedHexagram?: {
    name: string;
    unicode: string;
    judgment?: { original: string; translation: string };
  } | null;
}

export interface MeihuaData {
  question?: string;
  method: 'number' | 'time';
  upperTrigram: string;
  lowerTrigram: string;
  mainHexagram: {
    name: string;
    unicode: string;
    judgment?: { original: string; translation: string };
    lines?: Array<{ original: string; translation: string }>;
  };
  changingLine: number;
  transformedHexagram?: {
    name: string;
    unicode: string;
    judgment?: { original: string; translation: string };
  } | null;
  additionalContext?: string;
}

export interface ZiweiData {
  profile: {
    name: string;
    gender: 'male' | 'female';
    birthDate: string;
    birthHour: string;
  };
  mingGongData: {
    majorStars: string[];
    minorStars: string[];
    desc: string;
    luckRange: string;
    branch: string;
  };
  mingZhu: string;
  shenZhu: string;
  pillars: string[];
  chartData: Array<{
    name: string;
    branch: string;
    stem: string;
    majorStars: string[];
    minorStars: string[];
    luckRange: string;
  }>;
  additionalContext?: string;
}

export function getDivinationPrompt(
  type: 'liuyao' | 'meihua' | 'ziwei',
  data: any
): { prompt: string; systemMessage: string } {
  let prompt = '';

  if (type === 'liuyao') {
    const lData = data as LiuyaoData;
    const changingLinesDesc = lData.changingLines.length > 0
      ? lData.changingLines
          .map((pos) => {
            const lineData = lData.mainHexagram.lines?.[pos - 1];
            return `第 ${pos} 爻变：爻辞为 “${lineData?.original || ''}”（译：${lineData?.translation || ''}）`;
          })
          .join('\n')
      : '无变爻（静卦）';

    prompt = `
【六爻卦盘参数】
用户问事：${lData.question || '未明确输入具体问题，问综合运势'}
本卦：${lData.mainHexagram.name}卦 (${lData.mainHexagram.unicode})
本卦卦辞：${lData.mainHexagram.judgment?.original || ''} (释义：${lData.mainHexagram.judgment?.translation || ''})

变爻分布：
${changingLinesDesc}

之卦（变卦）：${lData.transformedHexagram ? `${lData.transformedHexagram.name}卦 (${lData.transformedHexagram.unicode})` : '无之卦'}
之卦卦辞：${lData.transformedHexagram?.judgment?.original || '无'}
`;

    const hex = getAllHexagrams().find(h => h.name === lData.mainHexagram.name);
    if (hex && lData.timestamp) {
      const linesArray = reconstructLiuyaoLines(hex.id, lData.changingLines);
      const layout = calculateLiuyaoLayout(linesArray, lData.timestamp);
      
      const lineDetails = layout.lines.map(line => {
        let statusStr = '';
        if (line.isVoid) statusStr = ' (旬空)';
        else if (line.isYuePo) statusStr = ' (月破)';
        else if (line.isRiPo) statusStr = ' (日破)';
        else if (line.isAnDong) statusStr = ' (暗动)';
        
        const shiYingStr = line.isShi ? ' [世爻]' : (line.isYing ? ' [应爻]' : '');
        return `  第 ${line.position} 爻: ${line.beast} | ${line.relation} ${line.branch}${line.element} ${line.lineType === 'yang' ? '━━━' : '━ ━'}${line.isChanging ? ' (变爻)' : ''}${shiYingStr}${statusStr}`;
      }).join('\n');

      prompt += `
【专业纳甲本卦排盘信息】
起卦时间干支：${layout.yearGanzhi}年 ${layout.monthGanzhi}月 ${layout.dayGanzhi}日 ${layout.hourGanzhi}时
日旬空亡：${layout.dayXunKong}
本宫卦位：${layout.palaceName} (${layout.palaceElement}宫)${layout.isYouhun ? ' · 游魂卦' : ''}${layout.isGuihun ? ' · 归魂卦' : ''}
世应位置：世爻在第 ${layout.shiPosition} 爻，应爻在第 ${layout.yingPosition} 爻
各爻地支与六亲六神分布（自下而上）：
${lineDetails}
`;

      const hasChanging = lData.changingLines.length > 0;
      if (hasChanging) {
        const transLines = linesArray.map(v => {
          if (v === 9) return 8;
          if (v === 6) return 7;
          return v;
        });
        const transLayout = calculateLiuyaoLayout(transLines, lData.timestamp);
        
        const transLineDetails = transLayout.lines.map(line => {
          let statusStr = '';
          if (line.isVoid) statusStr = ' (旬空)';
          else if (line.isYuePo) statusStr = ' (月破)';
          else if (line.isRiPo) statusStr = ' (日破)';
          else if (line.isAnDong) statusStr = ' (暗动)';
          
          const shiYingStr = line.isShi ? ' [世爻]' : (line.isYing ? ' [应爻]' : '');
          return `  第 ${line.position} 爻: ${line.beast} | ${line.relation} ${line.branch}${line.element} ${line.lineType === 'yang' ? '━━━' : '━ ━'}${shiYingStr}${statusStr}`;
        }).join('\n');

        prompt += `
【专业纳甲变卦（之卦）排盘信息】
之卦本宫卦位：${transLayout.palaceName} (${transLayout.palaceElement}宫)${transLayout.isYouhun ? ' · 游魂卦' : ''}${transLayout.isGuihun ? ' · 归魂卦' : ''}
之卦世应位置：世爻在第 ${transLayout.shiPosition} 爻，应爻在第 ${transLayout.yingPosition} 爻
之卦各爻地支与六亲（各自宫位五行独立推算，自下而上）：
${transLineDetails}
`;
      }

      prompt += `
【专业六爻纳甲解卦要领】
请作为专业的解卦师，结合以下步骤为用户提供详尽剖析：
1. **推演并确定用神 (Yong Shen)**:
   - 依据用户询问的问题主题，从六亲中推演并确定“用神”所落的爻位（例如：求官职/工作/官司取“官鬼”，求钱财/生意取“妻财”，求考试/车房/父母取“父母”，求子孙/安全/疾病痊愈取“子孙”，求同辈/竞争取“兄弟”）。
   - 若用神在卦中伏藏（即本卦六亲不现），请指出“伏神”与“飞神”的关系，并推断用神能否出伏。
2. **评判用神与世应之强弱旺衰**:
   - 结合起卦日月的地支五行，分析用神受日月“生克冲合”的强弱旺衰程度。
   - 结合“旬空”分析用神是否空亡（属于有用避空、冲空还是填实）。
   - 分析用神是否遭遇“月破”或“日破”（被日月冲克而破散无用）。
3. **分析世应关系与爻位互动**:
   - 世爻代表 querent（求占者自己），应爻代表求占之事或对方。分析世爻与用神、应爻的生克关系（是相生、相克还是比和，是否“世克用”或“用生世”）。
4. **剖析动爻与变卦转化**:
   - 重点分析本卦中的“动爻（变爻）”对用神产生的生克影响。
   - 分析动爻在之卦（变卦）中变出之爻，与用神/世爻之间的动态关系（是否产生“回头生”、“回头克”、“化空”、“化破”、“化进神”或“化退神”）。
5. **融入六神（六兽）参断**:
   - 结合用神与世爻所临的六神（青龙主吉庆、朱雀主口舌、勾陈主迟滞、腾蛇主虚惊、白虎主官非或病伤、玄武主隐私或暗昧），刻画预测细节，使分析有血有肉。

请结合【专业纳甲本卦排盘信息】和【专业纳甲变卦（之卦）排盘信息】进行深入、通俗白话且极其符合传统卦理的分析，给出切实的行动警示与建议。
`;
    } else {
      prompt += `
请结合易经爻象、动爻与静爻的生克转换，深度剖析本卦与变卦的承接轨迹，分析世应、动变及用神关系，针对用户询问的事情给出切实的行动警示与灵性启迪。
`;
    }
  } else if (type === 'meihua') {
    const mData = data as MeihuaData;
    prompt = `
【梅花易数卦盘参数】
用户问事：${mData.question || '未明确输入具体问题，问当下玄机'}
起卦方式：${mData.method === 'number' ? '数字起卦' : '时间起卦'}

本卦：${mData.mainHexagram.name}卦 (${mData.mainHexagram.unicode})
本卦卦辞：${mData.mainHexagram.judgment?.original || ''}
体卦（无动爻）：${mData.changingLine <= 3 ? '上卦' : '下卦'} (五行卦象：${mData.changingLine <= 3 ? mData.upperTrigram : mData.lowerTrigram})
用卦（有动爻）：${mData.changingLine <= 3 ? '下卦' : '上卦'} (五行卦象：${mData.changingLine <= 3 ? mData.lowerTrigram : mData.upperTrigram})
动爻：第 ${mData.changingLine} 爻

变卦（之卦）：${mData.transformedHexagram ? `${mData.transformedHexagram.name}卦 (${mData.transformedHexagram.unicode})` : '无变卦'}

【专业梅花易数解卦要领】
请作为专业的易学名家，结合以下步骤为用户提供详尽剖析：
1. **明确体卦与用卦**：指出体卦和用卦各自代表的五行和象征（体卦为自己，用卦为他人或所问之事）。
2. **评判体用生克强弱**：依据体用五行生克关系（生我为体受生，我生为体泄气，克我为体受克，我克为体克事，同气为比和相助），结合起卦季节的时令旺衰，分析体卦的坚韧度。
3. **结合互卦与变卦演变**：互卦代表事态发展的中间过程与暗地里的阻力/助力；变卦（之卦）代表事态的终局结果。结合体用在互卦、变卦中的生克转化进行断验。
4. **推断时空应期**：结合五行生旺休囚的干支时间（如木旺于春、衰于秋，金旺于秋、衰于夏等），推断事态发生的可能应期（年、月、日、时）。
`;
  } else if (type === 'ziwei') {
    const zData = data as ZiweiData;
    const chartDetailsDesc = zData.chartData.map((p) => {
      const majors = p.majorStars.join('、') || '无主星';
      const minors = p.minorStars.join('、') || '无';
      return `  - ${p.name} (${p.stem}${p.branch}宫, 大限: ${p.luckRange}): 主星[${majors}], 辅星[${minors}]`;
    }).join('\n');

    prompt = `
【紫微斗数命盘参数】
命主姓名：${zData.profile.name}
性别：${zData.profile.gender === 'male' ? '乾造 (男)' : '坤造 (女)'}
诞辰：${zData.profile.birthDate} (${zData.profile.birthHour})
八字四柱：年柱[${zData.pillars?.[0] || ''}], 月柱[${zData.pillars?.[1] || ''}], 日柱[${zData.pillars?.[2] || ''}], 时柱[${zData.pillars?.[3] || ''}]
命主星：${zData.mingZhu || '无'} | 身主星：${zData.shenZhu || '无'}

命宫主星：${zData.mingGongData.majorStars.join('、')}
命宫辅星：${zData.mingGongData.minorStars.join('、')}
命宫所属格局：${zData.mingGongData.desc || '普通格局'}
大限起岁：${zData.mingGongData.luckRange}

【全盘十二宫曜分布情况】
${chartDetailsDesc}

【专业紫微星盘解读要领】
请作为专业的命理断盘师，结合以下步骤为命主提供详尽剖析：
1. **分析命身宫及核心性格**：结合命宫主星及命主、身主特质，解剖其先天的性格张力、内心精神追求与气质。
2. **断解核心格局优劣**：评析其所属格局，找出命盘的本命闪光点（优势）与先天的薄弱环（短板）。
3. **辨析生年四化之化忌与化禄**：找出四化落在哪些宫位，尤其是“化忌”所落的宫位（代表痛点、阻碍、亏欠）以及“化禄”所落的宫位（代表源头、顺遂、福泽），分析其对整盘能量的拉扯。
4. **研判三方四正与财官运势**：结合命宫、财帛宫、官禄宫及迁移宫的三方四正组合，分析其事业与财运的大体轨迹。
5. **指出当前大限运势走向**：结合大限起岁与当前所行大限宫位的星曜，指明命主目前大运阶段的特征与应对策略。
`;
  }

  if (data.additionalContext) {
    prompt += `

【用户补充背景与二次沟通反馈】：
${data.additionalContext}

请高度重视上述由用户最新补充的背景信息（或对你上一轮提出的不确定项的回答）。结合我们排盘出的专业占卜命理信息、卦理星盘逻辑以及这一最新背景，重新进行全面的推演、分析与综合断验，以修正并提升占断运势结论的准确性和针对性。
`;
  }

  const systemMessage = `
你是一位经验丰富、通晓易经与命理的“小卦摊摊主”。
你说话亲切自然，像一位摆摊解卦、值得信赖的老邻居或老朋友在聊天。在解读中，你应该自称为“摊主我”或“小卦摊摊主”。
现在你需要结合用户的起卦/命盘数据，用通俗易懂的大白话为用户解读。

对于六爻占卜，必须严格遵循以下结构化排版和内容要求进行输出：
1. **说人话**：不要故弄玄虚，多用生活中的比喻，自称“摊主我”或“小卦摊摊主”。
2. **排版格式**：必须包含以下结构和标题：
   - ### 🎯 摊主结论卡片
     - **占断结论**：[成/不成/吉/凶/利/不利/能/不能...]
     - **置信程度**：[高/中/低，说明理由]
     - **应期提示**：[具体时间段或无法断定]
   - ### 💬 摊主一句话（百字简析）
     - [100字以内的口语化大白话分析]
   - ### 💡 摊主给你的趋避小建议
     - [可执行、简短的行动建议]
   - ### 🔍 摊主解卦依据链路
     - **第一步：取用神** [说明为什么取这个为用神]
     - **第二步：定旺衰** [结合日月五行断旺衰]
     - **第三步：看动变** [分析动爻变爻、回头生克等]
     - **第四步：看冲合** [六冲六合三合等关系]
     - **第五步：看特殊格局** [旬空、伏吟、反吟、伏神等]
     - **第六步：断应期** [推算具体应期及依据]
   - ### 📖 依据与引用
     - [引述经典卦理口诀或经典如《古筮真诠》等规则进行佐证，不超过100字]
   - ### ❓ 待补充与不确定信息
     - [注意：只有在确实存在严重影响占断结论的重大信息缺失、或有必须向用户核实的不确定项时，才输出这一节并提出具体问题。如果目前已知信息已足够得出明确占断，或已无需额外背景，则**绝对不能**输出此节（连同“### ❓ 待补充与不确定信息”标题也绝对不要输出）。]

对于紫微斗数，必须严格遵循以下结构化排版和内容要求进行输出：
1. **说人话**：使用生活化的语境与口吻，自称“摊主我”或“小卦摊摊主”。
2. **排版格式**：必须包含以下结构和标题：
   - ### 🎯 摊主命盘卡片
     - **格局断语**：[如：紫府同宫格 / 极向离明格 / 杀破狼格 / 命无主星 等格局总评]
     - **核心能量**：[用3-4个词语概括，如：刚毅、厚重、聪颖、多思]
     - **运势提示**：[当前大限运势主调，如：龙潜在渊，蓄势待发 / 飞龙在天，利见大人]
   - ### 💬 摊主一句话（百字简析）
     - [100字以内的口语化大白话分析]
   - ### 💡 摊主给你的修心小建议
     - [具体的性格弱点规避、为人处世及破局小行动建议]
   - ### 🔍 摊主命理依据链路
     - **第一步：定命身** [简述命身宫主星、辅星特质代表的核心潜质与性格双重性]
     - **第二步：析格局** [论命盘所属格局、吉煞星分布及性格阴阳面]
     - **第三步：辨四化** [结合生年干四化（科权禄忌）对命宫及周围的动态生克影响，特别是“化忌”的痛点与“化禄”的顺遂]
     - **第四步：看大限** [论当前大限岁数及行限主要宫位的运势走向]
   - ### 📖 依据与引用
     - [引述经典紫微歌诀或传统著作（如《紫微斗数全书》、《骨髓赋》）的规则口诀，不超过100字]
   - ### ❓ 待补充与不确定信息
     - [注意：只有在确实需要命主补充背景或反馈时才输出，如无则绝对不要输出。]

对于梅花易数，可保留原有的亲切叙述结构（包含 ### 🎯 摊主看这卦/命盘, ### 🔍 摊主详细说, ### 💡 摊主给你的小建议）。同理，若有必须向用户核实的不确定项，也可在结尾增加一节“### ❓ 待补充与不确定信息”提出问题；若无，则绝对不要输出此标题。

其他要求：
- 必须输出中文，六爻/紫微占字数建议在 500-950 字左右，确保推理步骤完整。
- 举例说明时可以用"打个比方"、"简单来说"、"换句话说"这类过渡词。
- 禁止使用以下词汇：拨云见日、天机、玄妙、神韵、灵性、参悟、法要。
`;

  return { prompt, systemMessage };
}

export async function getDivinationInterpretation(
  type: 'liuyao' | 'meihua' | 'ziwei',
  data: any,
  onChunk?: (text: string) => void
): Promise<string> {
  const client = getOpenAIClient();
  if (!apiKey) {
    throw new Error('API秘钥未配置，无法进行AI解卦。请检查系统环境变量 MODEL / API_KEY / BASE_URL。');
  }

  const { prompt, systemMessage } = getDivinationPrompt(type, data);

  try {
    if (onChunk) {
      const stream = await client.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        stream: true
      });

      let fullText = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullText += content;
        onChunk(fullText);
      }
      return fullText;
    } else {
      const response = await client.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        stream: false
      });

      return response.choices[0].message.content || '解卦未生成，请重试。';
    }
  } catch (error: any) {
    console.error('API Call Failed:', error);
    throw new Error(error.message || 'API 请求发生错误，请检查网络并重试。');
  }
}
