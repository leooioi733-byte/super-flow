import {
  InterviewChoice,
  InterviewPrompt,
  InterviewTriggerKind,
} from '../types/career';

export interface InterviewContextData {
  eventId: string;
  eventName: string;
  beachName: string;
  roundLabel: string;
  season: number;
  tierName: string;
  playerName: string;
  bestWave: number;
  heatTotal: number;
  playerRank: number;
  rivalName: string;
  activeSponsorName: string | null;
  isWorldTitle: boolean;
  seed: number;
}

interface QuestionTemplate {
  id: string;
  trigger: InterviewTriggerKind;
  triggerBadge: string;
  build: (ctx: InterviewContextData) => {
    journalistName: string;
    mediaOutlet: string;
    question: string;
    contextLine: string;
    choices: [InterviewChoice, InterviewChoice, InterviewChoice];
  };
}

const PRESS_REPORTERS = [
  { name: 'Marina Tavares', outlet: 'Transmissão Oficial FLOW' },
  { name: 'Lucas Nogueira', outlet: 'Canal Ondas do Sul' },
  { name: 'Camila Duarte', outlet: 'Surf Brasil TV' },
  { name: 'Rafael Mendes', outlet: 'Arena Litoral Press' },
  { name: 'Beatriz Monteiro', outlet: 'Circuito Pro Mídia' },
];

export function pickPressReporter(seed: number) {
  return PRESS_REPORTERS[Math.abs(seed) % PRESS_REPORTERS.length];
}

export const INTERVIEW_QUESTION_BANK: QuestionTemplate[] = [
  // ================= 1. CHAMPIONSHIP WIN (4 templates) =================
  {
    id: 'champ-win-feeling',
    trigger: 'championship_win',
    triggerBadge: 'TÍTULO CONQUISTADO',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed);
      const titleDesc = ctx.isWorldTitle
        ? `o título mundial em ${ctx.eventName}`
        : `o troféu de ${ctx.eventName}`;
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `Campeão em ${ctx.beachName} · Placar final ${ctx.heatTotal.toFixed(1)} pts`,
        question: `${ctx.playerName}, levantar ${titleDesc} diante de toda a praia em ${ctx.beachName} marca a temporada. O que passa pela sua cabeça agora como grande campeão?`,
        choices: [
          {
            id: 'champ-1-hum',
            tone: 'humildade',
            text: 'Agradecer ao mar, à equipe e reconhecer o nível altíssimo dos adversários.',
            reactionQuote:
              '"Hoje o mar deu as ondas certas e eu só tentei respeitar cada seção. Meu máximo respeito a todos que dividiram essa bateria comigo."',
            reputationDelta: 20,
            sponsorAffinityDelta: 9,
            consequenceLabel: '+20 Reputação · +9 Relação Patrocinadores',
          },
          {
            id: 'champ-1-conf',
            tone: 'confianca',
            text: 'Mostrar que a preparação intensa nos treinos trouxe esse troféu para casa.',
            reactionQuote:
              '"Trabalhamos o ano inteiro exatamente para decidir baterias assim. Eu sabia que, na hora certa, o meu surfe faria a diferença."',
            reputationDelta: 25,
            sponsorAffinityDelta: 6,
            consequenceLabel: '+25 Reputação · +6 Relação Patrocinadores',
          },
          {
            id: 'champ-1-prov',
            tone: 'provocacao',
            text: 'Avisar ao circuito que ninguém segura essa fase e que o próximo pico já tem dono.',
            reactionQuote:
              '"Podem anotar na tabela: quando entro em sintonia com o pico, os rivais surfam pelo segundo lugar. Esse troféu é só o começo!"',
            reputationDelta: 32,
            sponsorAffinityDelta: -5,
            rivalryIntensityDelta: 2,
            consequenceLabel: '+32 Reputação · -5 Patrocinadores · Esquenta rivalidade',
          },
        ],
      };
    },
  },
  {
    id: 'champ-win-pressure',
    trigger: 'championship_win',
    triggerBadge: 'ENTREVISTA DO CAMPEÃO',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed + 1);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `1º lugar na Grande Final · Melhor onda ${ctx.bestWave.toFixed(1)}`,
        question: `Na bateria decisiva contra ${ctx.rivalName}, você somou ${ctx.heatTotal.toFixed(1)} pontos e fechou a porta em ${ctx.beachName}. Como manteve o controle sob tanta pressão?`,
        choices: [
          {
            id: 'champ-2-hum',
            tone: 'humildade',
            text: 'Focar em surfar leve, sem pensar no placar, deixando o oceano guiar.',
            reactionQuote:
              '"Quando a pressão aperta, eu apenas respiro fundo e tento me conectar com a onda. A vitória veio como consequência natural."',
            reputationDelta: 19,
            sponsorAffinityDelta: 8,
            consequenceLabel: '+19 Reputação · +8 Relação Patrocinadores',
          },
          {
            id: 'champ-2-conf',
            tone: 'confianca',
            text: 'Ler a série melhor do que qualquer rival e escolher as ondas que pagam alto.',
            reactionQuote:
              '"Eu li cada mudança de vento e esperei as ondas de potencial real. Em final de campeonato, estratégia vence ansiedade."',
            reputationDelta: 24,
            sponsorAffinityDelta: 7,
            consequenceLabel: '+24 Reputação · +7 Relação Patrocinadores',
          },
          {
            id: 'champ-2-prov',
            tone: 'provocacao',
            text: 'Dizer que a pressão ficou toda do outro lado quando você soltou o pé.',
            reactionQuote:
              '"Pressão? Quem sentiu a pressão foi quem olhou meu placar da água. Eu me divirto quando o título está na mesa."',
            reputationDelta: 30,
            sponsorAffinityDelta: -6,
            rivalryIntensityDelta: 2,
            consequenceLabel: '+30 Reputação · -6 Patrocinadores · Rival em alerta',
          },
        ],
      };
    },
  },
  {
    id: 'champ-win-sponsors',
    trigger: 'championship_win',
    triggerBadge: 'ZONA MISTA · CAMPEÃO',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed + 2);
      const sponsorRef = ctx.activeSponsorName
        ? `junto à ${ctx.activeSponsorName}`
        : 'com o apoio que vem construindo no circuito';
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `Campeão de ${ctx.eventName} · ${ctx.tierName}`,
        question: `Essa conquista em ${ctx.beachName} acontece ${sponsorRef}. Que recado você manda para quem investe e acredita no seu surfe?`,
        choices: [
          {
            id: 'champ-3-hum',
            tone: 'humildade',
            text: 'Dedicar a conquista a cada pessoa e marca que acreditou desde as primeiras baterias.',
            reactionQuote:
              '"Ninguém vence sozinho no circuito. Cada treino, prancha e apoio nos bastidores está representado neste troféu."',
            reputationDelta: 18,
            sponsorAffinityDelta: 11,
            consequenceLabel: '+18 Reputação · +11 Relação Patrocinadores',
          },
          {
            id: 'champ-3-conf',
            tone: 'confianca',
            text: 'Garantir que este é o padrão de resultados que o circuito pode esperar daqui pra frente.',
            reactionQuote:
              '"Entregamos exatamente o que prometemos: performance no topo e títulos expressivos. Vamos por mais nas próximas etapas."',
            reputationDelta: 22,
            sponsorAffinityDelta: 8,
            consequenceLabel: '+22 Reputação · +8 Relação Patrocinadores',
          },
          {
            id: 'champ-3-prov',
            tone: 'provocacao',
            text: 'Lembrar às grandes marcas quem ainda duvidou e valorizar seu passe no mercado.',
            reactionQuote:
              '"Quem demorou para apostar no meu nome agora viu ao vivo quanto custa perder a chance. O recado foi dado na água!"',
            reputationDelta: 29,
            sponsorAffinityDelta: -7,
            consequenceLabel: '+29 Reputação · -7 Relação Patrocinadores',
          },
        ],
      };
    },
  },
  {
    id: 'champ-win-next-goal',
    trigger: 'championship_win',
    triggerBadge: 'PÓS-PREMIAÇÃO',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed + 3);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `Temporada ${ctx.season} · ${ctx.eventName}`,
        question: `Com o troféu de ${ctx.eventName} nos braços, muda algo na sua postura para a sequência da Temporada ${ctx.season}?`,
        choices: [
          {
            id: 'champ-4-hum',
            tone: 'humildade',
            text: 'Manter os pés na areia, comemorar hoje e voltar aos treinos amanhã cedo.',
            reactionQuote:
              '"A festa dura hoje à noite, mas amanhã a prancha já volta pra água. Sempre existe algo novo para evoluir."',
            reputationDelta: 20,
            sponsorAffinityDelta: 8,
            consequenceLabel: '+20 Reputação · +8 Relação Patrocinadores',
          },
          {
            id: 'champ-4-conf',
            tone: 'confianca',
            text: 'Consolidar a liderança do ranking com regularidade etapa após etapa.',
            reactionQuote:
              '"Esse título confirma que nossa leitura tática está afiada. Agora o foco é transformar boa fase em hegemonia."',
            reputationDelta: 24,
            sponsorAffinityDelta: 6,
            consequenceLabel: '+24 Reputação · +6 Relação Patrocinadores',
          },
          {
            id: 'champ-4-prov',
            tone: 'provocacao',
            text: 'Dizer que os rivais vão precisar subir muito o nível se quiserem tirar a camisa amarela.',
            reactionQuote:
              '"Se quiserem ganhar a próxima etapa, é bom treinarem o dobro — porque eu acabei de achar minha marcha máxima."',
            reputationDelta: 31,
            sponsorAffinityDelta: -5,
            rivalryIntensityDelta: 2,
            consequenceLabel: '+31 Reputação · -5 Patrocinadores · Provoca rivais',
          },
        ],
      };
    },
  },

  // ================= 2. PERFECT TEN (3 templates) =================
  {
    id: 'ten-anatomy',
    trigger: 'perfect_ten',
    triggerBadge: 'NOTA 10 UNÂNIME',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `Onda perfeita ${ctx.bestWave.toFixed(1)} pts em ${ctx.beachName} · ${ctx.roundLabel}`,
        question: `Uma nota 10 perfeita! O público foi à loucura com aquela onda em ${ctx.beachName}. Quando você sentiu que seria uma onda histórica?`,
        choices: [
          {
            id: 'ten-1-hum',
            tone: 'humildade',
            text: 'Agradecer pela oportunidade de surfar uma parede tão limpa e mágica.',
            reactionQuote:
              '"Uma onda dessas é um presente do oceano. Eu só tentei não atrapalhar a perfeição dela e fluir até a rasgada final."',
            reputationDelta: 22,
            sponsorAffinityDelta: 8,
            consequenceLabel: '+22 Reputação · +8 Relação Patrocinadores',
          },
          {
            id: 'ten-1-conf',
            tone: 'confianca',
            text: 'Explicar que atacou o lip e a seção crítica no tempo exato para arrancar o 10.',
            reactionQuote:
              '"Assim que entrei no drop eu vi o espaço abrindo. Joguei tudo na borda e sabia antes mesmo de sair que os juízes dariam 10."',
            reputationDelta: 27,
            sponsorAffinityDelta: 6,
            consequenceLabel: '+27 Reputação · +6 Relação Patrocinadores',
          },
          {
            id: 'ten-1-prov',
            tone: 'provocacao',
            text: 'Brincar que o painel dos juízes precisou até conferir se não cabia uma nota 11.',
            reactionQuote:
              '"Faltou número no placar! Quando eu entro nesse ritmo, até quem torce contra para na areia para assistir."',
            reputationDelta: 34,
            sponsorAffinityDelta: -4,
            rivalryIntensityDelta: 2,
            consequenceLabel: '+34 Reputação · -4 Patrocinadores · Destaque viral',
          },
        ],
      };
    },
  },
  {
    id: 'ten-impact-heat',
    trigger: 'perfect_ten',
    triggerBadge: 'EXIBIÇÃO HISTÓRICA · 10.0',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed + 1);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `${ctx.roundLabel} · Somatório ${ctx.heatTotal.toFixed(1)} pts`,
        question: `Depois de cravar um 10.0 na ${ctx.roundLabel}, como essa onda transforma o respeito dos adversários pelo seu surfe?`,
        choices: [
          {
            id: 'ten-2-hum',
            tone: 'humildade',
            text: 'Lembrar que cada bateria recomeça do zero e ninguém vence só pelo passado.',
            reactionQuote:
              '"Um 10 fica na memória, mas na próxima bateria o cronômetro volta pro zero. Sigo respeitando todos igual."',
            reputationDelta: 21,
            sponsorAffinityDelta: 8,
            consequenceLabel: '+21 Reputação · +8 Relação Patrocinadores',
          },
          {
            id: 'ten-2-conf',
            tone: 'confianca',
            text: 'Afirmar que agora os oponentes sabem que precisam surfar no limite contra você.',
            reactionQuote:
              '"Quem cair na água comigo já entra sabendo que nota mediana não resolve. Esse 10 eleva o sarrafo do evento."',
            reputationDelta: 26,
            sponsorAffinityDelta: 5,
            consequenceLabel: '+26 Reputação · +5 Relação Patrocinadores',
          },
          {
            id: 'ten-2-prov',
            tone: 'provocacao',
            text: 'Mandar um recado direto para quem acha que tem a melhor linha do circuito.',
            reactionQuote:
              '"Teve gente dizendo que dominava esse pico — acho que a minha nota 10 acabou de responder à entrevista deles!"',
            reputationDelta: 33,
            sponsorAffinityDelta: -5,
            rivalryIntensityDelta: 2,
            consequenceLabel: '+33 Reputação · -5 Patrocinadores · Provocação direta',
          },
        ],
      };
    },
  },
  {
    id: 'ten-sponsor-highlight',
    trigger: 'perfect_ten',
    triggerBadge: 'ONDA DA TEMPORADA · 10.0',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed + 2);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `${ctx.eventName} · ${ctx.beachName}`,
        question: `Essa nota 10 já viralizou nas transmissões do ${ctx.eventName}. O que você diria para os fãs e patrocinadores que acompanham sua evolução?`,
        choices: [
          {
            id: 'ten-3-hum',
            tone: 'humildade',
            text: 'Compartilhar a emoção com a torcida e agradecer o carinho nas redes.',
            reactionQuote:
              '"Ver a praia vibrando assim dá arrepio. Esse momento é de todo mundo que torce e vibra junto comigo!"',
            reputationDelta: 22,
            sponsorAffinityDelta: 9,
            consequenceLabel: '+22 Reputação · +9 Relação Patrocinadores',
          },
          {
            id: 'ten-3-conf',
            tone: 'confianca',
            text: 'Destacar que equipamento acertado e confiança geram ondas de nota máxima.',
            reactionQuote:
              '"A prancha respondeu no milímetro. Quando equipamento, leitura e coragem se encontram, o 10 aparece."',
            reputationDelta: 25,
            sponsorAffinityDelta: 7,
            consequenceLabel: '+25 Reputação · +7 Relação Patrocinadores',
          },
          {
            id: 'ten-3-prov',
            tone: 'provocacao',
            text: 'Dizer que o vídeo da onda vai rodar o ano inteiro como aula prática pro pelotão.',
            reactionQuote:
              '"Podem salvar o replay e estudar quadro a quadro, porque eu pretendo repetir a dose antes do evento acabar!"',
            reputationDelta: 31,
            sponsorAffinityDelta: -4,
            consequenceLabel: '+31 Reputação · -4 Patrocinadores',
          },
        ],
      };
    },
  },

  // ================= 3. GRAND FINAL QUALIFIED (3 templates) =================
  {
    id: 'gf-ready',
    trigger: 'grand_final_qualified',
    triggerBadge: 'RUMO À GRANDE FINAL',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `Classificado na Semifinal · ${ctx.heatTotal.toFixed(1)} pts em ${ctx.beachName}`,
        question: `Parabéns pela vaga na Grande Final do ${ctx.eventName}! Você garantiu ${ctx.heatTotal.toFixed(1)} pontos na semifinal. Qual será sua estratégia para a decisão?`,
        choices: [
          {
            id: 'gf-1-hum',
            tone: 'humildade',
            text: 'Descansar, respeitar os finalistas e dar o melhor de si onda a onda.',
            reactionQuote:
              '"Chegar à final já é uma honra enorme. Agora é recuperar o fôlego e surfar com o coração leve na decisão."',
            reputationDelta: 15,
            sponsorAffinityDelta: 7,
            consequenceLabel: '+15 Reputação · +7 Relação Patrocinadores',
          },
          {
            id: 'gf-1-conf',
            tone: 'confianca',
            text: 'Partir para as séries maiores desde os primeiros minutos para ditar o ritmo.',
            reactionQuote:
              '"Não vim até a final para administrar bateria. Vou atacar as maiores da série logo cedo e buscar o troféu."',
            reputationDelta: 20,
            sponsorAffinityDelta: 5,
            consequenceLabel: '+20 Reputação · +5 Relação Patrocinadores',
          },
          {
            id: 'gf-1-prov',
            tone: 'provocacao',
            text: 'Avisar ao outro finalista que é melhor preparar a paciência porque não vai sobrar onda.',
            reactionQuote:
              '"A final tem 20 minutos, mas se depender da minha prioridade no pico, o troféu já tem nome gravado!"',
            reputationDelta: 26,
            sponsorAffinityDelta: -4,
            rivalryIntensityDelta: 2,
            consequenceLabel: '+26 Reputação · -4 Patrocinadores · Tensão na Final',
          },
        ],
      };
    },
  },
  {
    id: 'gf-mindset',
    trigger: 'grand_final_qualified',
    triggerBadge: 'FINALISTA CONFIRMADO',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed + 1);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `${ctx.eventName} · Rumo ao Título`,
        question: `Você superou uma semifinal duríssima em ${ctx.beachName}. O desgaste físico pesa na hora da Grande Final ou a adrenalina fala mais alto?`,
        choices: [
          {
            id: 'gf-2-hum',
            tone: 'humildade',
            text: 'Reconhecer o cansaço, mas destacar a força da torcida na areia.',
            reactionQuote:
              '"Os braços pesam, claro, mas quando olho para a praia cheia eu encontro energia de sobra para a última bateria."',
            reputationDelta: 16,
            sponsorAffinityDelta: 6,
            consequenceLabel: '+16 Reputação · +6 Relação Patrocinadores',
          },
          {
            id: 'gf-2-conf',
            tone: 'confianca',
            text: 'Garantir que o preparo físico está no auge para entregar o melhor na hora H.',
            reactionQuote:
              '"Estou inteiro, leve na prancha e com a cabeça fria. A minha melhor bateria ainda está por vir."',
            reputationDelta: 19,
            sponsorAffinityDelta: 6,
            consequenceLabel: '+19 Reputação · +6 Relação Patrocinadores',
          },
          {
            id: 'gf-2-prov',
            tone: 'provocacao',
            text: 'Ironizar dizendo que nem precisou usar 70% do gás na semifinal.',
            reactionQuote:
              '"Na semifinal eu ainda estava aquecendo. Na Grande Final vocês vão ver o que é pressão de verdade!"',
            reputationDelta: 24,
            sponsorAffinityDelta: -5,
            rivalryIntensityDelta: 1,
            consequenceLabel: '+24 Reputação · -5 Patrocinadores',
          },
        ],
      };
    },
  },
  {
    id: 'gf-duel-preview',
    trigger: 'grand_final_qualified',
    triggerBadge: 'PRÉVIA DA GRANDE FINAL',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed + 2);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `Final em ${ctx.beachName} · Contra a elite do ${ctx.tierName}`,
        question: `Com a vaga assegurada na decisão, todo mundo quer saber: o que falta ajustar entre a semifinal e o apito da Grande Final?`,
        choices: [
          {
            id: 'gf-3-hum',
            tone: 'humildade',
            text: 'Conversar com a equipe, ajustar a leitura da maré e manter a calma.',
            reactionQuote:
              '"A maré está virando rápido aqui em ' +
              ctx.beachName +
              '. Vou ouvir os conselhos certos e entrar com humildade total."',
            reputationDelta: 15,
            sponsorAffinityDelta: 7,
            consequenceLabel: '+15 Reputação · +7 Relação Patrocinadores',
          },
          {
            id: 'gf-3-conf',
            tone: 'confianca',
            text: 'Confiar na combinação de manobras de borda e tubos que trouxe até aqui.',
            reactionQuote:
              '"O plano funcionou até agora. É ajustar o timing do drop e executar minhas manobras mais fortes."',
            reputationDelta: 20,
            sponsorAffinityDelta: 5,
            consequenceLabel: '+20 Reputação · +5 Relação Patrocinadores',
          },
          {
            id: 'gf-3-prov',
            tone: 'provocacao',
            text: 'Dizer que o único ajuste necessário é abrir espaço na estante para mais um troféu.',
            reactionQuote:
              '"Ajuste? Só escolher qual foto quero na capa amanhã. Nos vemos no pódio!"',
            reputationDelta: 25,
            sponsorAffinityDelta: -6,
            rivalryIntensityDelta: 2,
            consequenceLabel: '+25 Reputação · -6 Patrocinadores',
          },
        ],
      };
    },
  },

  // ================= 4. IMPORTANT WIN (3 templates) =================
  {
    id: 'win-momentum',
    trigger: 'important_win',
    triggerBadge: 'VITÓRIA EXPRESSIVA',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `${ctx.roundLabel} · ${ctx.heatTotal.toFixed(1)} pts em ${ctx.beachName}`,
        question: `Vitória sólida na ${ctx.roundLabel} em ${ctx.beachName}, superando ${ctx.rivalName} com ${ctx.heatTotal.toFixed(1)} pontos. Esse resultado muda o seu patamar no evento?`,
        choices: [
          {
            id: 'win-1-hum',
            tone: 'humildade',
            text: 'Valorizar cada vitória sem perder a concentração para a fase seguinte.',
            reactionQuote:
              '"Foi uma bateria dura e ${ctx.rivalName} surfou muito bem. Fico feliz pelo avanço, mas tem muita água para rolar."'.replace(
                '${ctx.rivalName}',
                ctx.rivalName
              ),
            reputationDelta: 14,
            sponsorAffinityDelta: 6,
            consequenceLabel: '+14 Reputação · +6 Relação Patrocinadores',
          },
          {
            id: 'win-1-conf',
            tone: 'confianca',
            text: 'Afirmar que essa pontuação manda um recado claro para a chave inteira.',
            reactionQuote:
              '"Somar forte logo nessa fase dá tranquilidade e confiança. Estou surfando leve e mirando lá em cima."',
            reputationDelta: 18,
            sponsorAffinityDelta: 4,
            consequenceLabel: '+18 Reputação · +4 Relação Patrocinadores',
          },
          {
            id: 'win-1-prov',
            tone: 'provocacao',
            text: 'Provocar dizendo que ganhou no ritmo de treino e ainda guardou cartas na manga.',
            reactionQuote:
              '"Se no meu dia tranquilo já deu pra vencer assim, imagina quando eu resolver arriscar tudo!"',
            reputationDelta: 23,
            sponsorAffinityDelta: -4,
            rivalryIntensityDelta: 2,
            consequenceLabel: '+23 Reputação · -4 Patrocinadores · Rivalidade acesa',
          },
        ],
      };
    },
  },
  {
    id: 'win-conditions',
    trigger: 'important_win',
    triggerBadge: 'PÓS-BATERIA · VITÓRIA',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed + 1);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `${ctx.eventName} · Melhor onda ${ctx.bestWave.toFixed(1)}`,
        question: `As condições em ${ctx.beachName} pediam muita leitura do outside, e você tirou um ${ctx.bestWave.toFixed(1)} para selar a vitória. Como se sentiu com a prancha hoje?`,
        choices: [
          {
            id: 'win-2-hum',
            tone: 'humildade',
            text: 'Elogiar o shaper e dizer que a paciência foi a chave no mar difícil.',
            reactionQuote:
              '"Esse foguete sob os pés ajudou demais hoje! Paciência e leitura limpa resolveram nos momentos certos."',
            reputationDelta: 13,
            sponsorAffinityDelta: 7,
            consequenceLabel: '+13 Reputação · +7 Relação Patrocinadores',
          },
          {
            id: 'win-2-conf',
            tone: 'confianca',
            text: 'Explicar que mar desafiador separa quem realmente entende o oceano.',
            reactionQuote:
              '"Quanto mais técnico fica o mar, melhor para o meu surfe. Eu sabia exatamente onde a rampa ia armar."',
            reputationDelta: 18,
            sponsorAffinityDelta: 5,
            consequenceLabel: '+18 Reputação · +5 Relação Patrocinadores',
          },
          {
            id: 'win-2-prov',
            tone: 'provocacao',
            text: 'Dizer que enquanto os adversários reclamavam da correnteza, você fez a festa.',
            reactionQuote:
              '"Tinha gente perdida na arrebentação, e eu só escolhendo as bombas! Que venha a próxima bateria."',
            reputationDelta: 22,
            sponsorAffinityDelta: -4,
            rivalryIntensityDelta: 1,
            consequenceLabel: '+22 Reputação · -4 Patrocinadores',
          },
        ],
      };
    },
  },
  {
    id: 'win-rival-beat',
    trigger: 'important_win',
    triggerBadge: 'ZONA MISTA · TRIUNFO',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed + 2);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `${ctx.roundLabel} · ${ctx.eventName}`,
        question: `Uma bateria eletrizante com foco total da torcida no confronto contra ${ctx.rivalName}. Qual o peso desse triunfo nessa altura do ${ctx.eventName}?`,
        choices: [
          {
            id: 'win-3-hum',
            tone: 'humildade',
            text: 'Dizer que duelos assim fazem todo mundo evoluir no circuito.',
            reactionQuote:
              '"Enfrentar surfistas do calibre de ' +
              ctx.rivalName +
              ' me obriga a ser melhor todo dia. Hoje caiu para o meu lado."',
            reputationDelta: 15,
            sponsorAffinityDelta: 7,
            consequenceLabel: '+15 Reputação · +7 Relação Patrocinadores',
          },
          {
            id: 'win-3-conf',
            tone: 'confianca',
            text: 'Destacar a frieza para virar ou ampliar o placar nos momentos decisivos.',
            reactionQuote:
              '"Eu não baixo a guarda nunca. Quando a disputa aperta, é a hora que mais gosto de remar para o pico."',
            reputationDelta: 19,
            sponsorAffinityDelta: 5,
            consequenceLabel: '+19 Reputação · +5 Relação Patrocinadores',
          },
          {
            id: 'win-3-prov',
            tone: 'provocacao',
            text: 'Brincar que o retrospecto do confronto direto acabou de ganhar mais uma linha a seu favor.',
            reactionQuote:
              '"Mais um capítulo escrito do meu jeito! Se quiser revanche, sabe exatamente onde me encontrar."',
            reputationDelta: 24,
            sponsorAffinityDelta: -5,
            rivalryIntensityDelta: 2,
            consequenceLabel: '+24 Reputação · -5 Patrocinadores · Rivalidade acesa',
          },
        ],
      };
    },
  },

  // ================= 5. IMPORTANT DEFEAT (3 templates) =================
  {
    id: 'def-tough-pill',
    trigger: 'important_defeat',
    triggerBadge: 'ANÁLISE PÓS-DERROTA',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `${ctx.roundLabel} · ${ctx.playerRank}º lugar (${ctx.heatTotal.toFixed(1)} pts)`,
        question: `Não foi o desfecho esperado na ${ctx.roundLabel} em ${ctx.beachName}, com ${ctx.rivalName} levando a melhor hoje. O que faltou nessa bateria?`,
        choices: [
          {
            id: 'def-1-hum',
            tone: 'humildade',
            text: 'Reconhecer os méritos do adversário e assumir o aprendizado da derrota.',
            reactionQuote:
              '"Dói sair assim, mas o mérito hoje foi todo de quem encaixou as melhores ondas. Vou rever tudo e voltar mais forte."',
            reputationDelta: 10,
            sponsorAffinityDelta: 6,
            consequenceLabel: '+10 Reputação · +6 Relação Patrocinadores',
          },
          {
            id: 'def-1-conf',
            tone: 'confianca',
            text: 'Explicar que o plano era agressivo e que não vai mudar sua identidade competitiva.',
            reactionQuote:
              '"Faltou encaixar mais uma boa nota, mas não me arrependo de arriscar. Na próxima etapa o resultado vem."',
            reputationDelta: 8,
            sponsorAffinityDelta: 3,
            consequenceLabel: '+8 Reputação · +3 Relação Patrocinadores',
          },
          {
            id: 'def-1-prov',
            tone: 'provocacao',
            text: 'Criticar as escolhas de onda e prometer troco imediato no próximo encontro.',
            reactionQuote:
              '"Hoje a sorte sorriu pro outro lado, mas não se acostumem. No próximo campeonato eu vou cobrar essa conta na água!"',
            reputationDelta: 4,
            sponsorAffinityDelta: -7,
            rivalryIntensityDelta: 2,
            consequenceLabel: '+4 Reputação · -7 Patrocinadores · Rivalidade acesa',
          },
        ],
      };
    },
  },
  {
    id: 'def-margins',
    trigger: 'important_defeat',
    triggerBadge: 'ZONA MISTA · REAÇÃO',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed + 1);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `Eliminação em ${ctx.eventName} · ${ctx.beachName}`,
        question: `Em fases decisivas como a ${ctx.roundLabel}, detalhes mínimos separam a classificação da eliminação. Como você digere um resultado duro como esse?`,
        choices: [
          {
            id: 'def-2-hum',
            tone: 'humildade',
            text: 'Aceitar o resultado com serenidade e agradecer aos fãs que apoiaram até o fim.',
            reactionQuote:
              '"O esporte tem desses dias. Agradeço de coração a quem torceu aqui na areia; agora é cabeça erguida para a próxima."',
            reputationDelta: 11,
            sponsorAffinityDelta: 6,
            consequenceLabel: '+11 Reputação · +6 Relação Patrocinadores',
          },
          {
            id: 'def-2-conf',
            tone: 'confianca',
            text: 'Transformar a frustração imediata em combustível para o resto do calendário.',
            reactionQuote:
              '"Derrota assim só serve pra acender ainda mais minha fome de vencer. Vocês ainda vão me ver brigando pelo topo."',
            reputationDelta: 9,
            sponsorAffinityDelta: 4,
            consequenceLabel: '+9 Reputação · +4 Relação Patrocinadores',
          },
          {
            id: 'def-2-prov',
            tone: 'provocacao',
            text: 'Alfineta dizendo que o ritmo da bateria não refletiu o nível real de ninguém.',
            reactionQuote:
              '"Com o mar fechando desse jeito, ganhou quem teve mais sorte na última série. Quero ver repetir no pico aberto!"',
            reputationDelta: -2,
            sponsorAffinityDelta: -8,
            rivalryIntensityDelta: 2,
            consequenceLabel: '-2 Reputação · -8 Relação Patrocinadores',
          },
        ],
      };
    },
  },
  {
    id: 'def-sponsors-rebuild',
    trigger: 'important_defeat',
    triggerBadge: 'PÓS-COMPETIÇÃO',
    build: (ctx) => {
      const rep = pickPressReporter(ctx.seed + 2);
      return {
        journalistName: rep.name,
        mediaOutlet: rep.outlet,
        contextLine: `${ctx.eventName} · ${ctx.tierName}`,
        question: `Mesmo com a queda na ${ctx.roundLabel}, a temporada continua aberta. Qual mensagem você deixa para sua equipe e patrocinadores após esse revés?`,
        choices: [
          {
            id: 'def-3-hum',
            tone: 'humildade',
            text: 'Assumir a responsabilidade e prometer entrega total nos treinos antes da próxima etapa.',
            reactionQuote:
              '"Assumo o resultado de peito aberto. Vamos trabalhar nos pequenos detalhes para honrar toda a confiança que recebemos."',
            reputationDelta: 10,
            sponsorAffinityDelta: 8,
            consequenceLabel: '+10 Reputação · +8 Relação Patrocinadores',
          },
          {
            id: 'def-3-conf',
            tone: 'confianca',
            text: 'Lembrar que um campeonato não define o ano e o projeto segue sólido.',
            reactionQuote:
              '"Um tropeço não muda quem somos nem onde vamos chegar nessa temporada. Seguimos firmes no objetivo."',
            reputationDelta: 9,
            sponsorAffinityDelta: 5,
            consequenceLabel: '+9 Reputação · +5 Relação Patrocinadores',
          },
          {
            id: 'def-3-prov',
            tone: 'provocacao',
            text: 'Desafiar quem comemorou sua queda dizendo que a resposta será na próxima parada.',
            reactionQuote:
              '"Quem comemorou hoje é bom aproveitar bastante, porque na próxima parada eu volto pra atropelar a chave!"',
            reputationDelta: 5,
            sponsorAffinityDelta: -6,
            rivalryIntensityDelta: 2,
            consequenceLabel: '+5 Reputação · -6 Patrocinadores · Rivalidade acesa',
          },
        ],
      };
    },
  },
];

export function selectInterviewPromptForContext(
  trigger: InterviewTriggerKind,
  ctx: InterviewContextData,
  recentQuestionIds: string[] = []
): InterviewPrompt {
  const pool = INTERVIEW_QUESTION_BANK.filter((q) => q.trigger === trigger);
  const nonRecent = pool.filter((q) => !recentQuestionIds.includes(q.id));
  const candidates = nonRecent.length > 0 ? nonRecent : pool.filter((q) => q.id !== recentQuestionIds[0]);
  const finalPool = candidates.length > 0 ? candidates : pool;
  const chosen = finalPool[Math.abs(ctx.seed) % finalPool.length];
  const built = chosen.build(ctx);

  return {
    id: `intv-${ctx.season}-${ctx.eventId}-${trigger}-${ctx.seed}`,
    questionId: chosen.id,
    trigger,
    triggerBadge: chosen.triggerBadge,
    eventId: ctx.eventId,
    eventName: ctx.eventName,
    beachName: ctx.beachName,
    roundLabel: ctx.roundLabel,
    season: ctx.season,
    journalistName: built.journalistName,
    mediaOutlet: built.mediaOutlet,
    question: built.question,
    contextLine: built.contextLine,
    choices: built.choices,
    seed: ctx.seed,
  };
}
