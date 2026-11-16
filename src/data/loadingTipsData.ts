export type LoadingTipCategory = 'dica' | 'curiosidade';

export interface ChampionshipLoadingTip {
  id: string;
  category: LoadingTipCategory;
  kicker: string;
  title: string;
  body: string;
}

export const CHAMPIONSHIP_LOADING_TIPS: ChampionshipLoadingTip[] = [
  // Gameplay Tips (Dicas de Jogabilidade)
  {
    id: 'tip-bottom-turn',
    category: 'dica',
    kicker: 'Técnica & Pontuação',
    title: 'Use o Bottom Turn como base para manobras grandes',
    body: 'Execute um Bottom Turn na base da parede antes de atacar o lip com um Aéreo ou Floater. A projeção gerada amplia a sequência e eleva o multiplicador de nota da onda.',
  },
  {
    id: 'tip-barrel-control',
    category: 'dica',
    kicker: 'Leitura de Tubo',
    title: 'Controle a velocidade dentro do cilindro',
    body: 'Ao encaixar no tubo, segure levemente para trás para frear e permanecer na zona mais profunda por mais tempo. Quanto maior a duração limpa dentro do barrel, maior o bônus dos juízes.',
  },
  {
    id: 'tip-stabilize-shift',
    category: 'dica',
    kicker: 'Equilíbrio Crítico',
    title: 'Recupere a prancha em drops e aterrissagens fortes',
    body: 'Sentiu a prancha oscilar no limite após uma manobra aérea ou num drop cavado? Pressione Shift (ou use a barra de equilíbrio) para estabilizar a base e evitar a queda.',
  },
  {
    id: 'tip-combo-chains',
    category: 'dica',
    kicker: 'Sistema de Combos',
    title: 'Encadeie manobras sem perder o ritmo na parede',
    body: 'Variar entre Bottom Turn, Cutback e Floater na mesma onda mantém a sequência ativa e multiplica os pontos. Uma linha fluida e sem vacas vale mais que uma tentativa isolada.',
  },
  {
    id: 'tip-best-two-waves',
    category: 'dica',
    kicker: 'Estratégia de Bateria',
    title: 'Apenas suas 2 melhores ondas entram no somatório',
    body: 'Nas baterias do Circuito FLOW, o placar final soma suas duas maiores notas (máximo de 20,0 pontos). Não desperdice energia em marolas fechadas quando uma série maior estiver armando.',
  },
  {
    id: 'tip-duck-dive',
    category: 'dica',
    kicker: 'Posicionamento no Outside',
    title: 'Fure a espuma com o Duck Dive',
    body: 'Durante a remada para o lineup, use o Duck Dive (tecla B ou botão de ação) logo antes de uma parede de espuma quebrar à frente para passar por baixo sem ser arrastado.',
  },
  {
    id: 'tip-quiver-match',
    category: 'dica',
    kicker: 'Escolha de Equipamento',
    title: 'Ajuste o modelo de prancha às condições do pico',
    body: 'Pranchas Twin Fish geram aceleração natural em ondas menores; já em swells pesados de recife e point break, modelos Step-Up ou Gun entregam firmeza e tração no cavado.',
  },
  {
    id: 'tip-cutback-pocket',
    category: 'dica',
    kicker: 'Leitura de Parede',
    title: 'Use o Cutback para voltar à força da onda',
    body: 'Se você acelerar demais e ficar longe da parte crítica, execute um Cutback para retornar ao pocket próximo à espuma — onde a parede concentra mais energia e pontuação.',
  },
  {
    id: 'tip-replay-angles',
    category: 'dica',
    kicker: 'Análise & Câmera',
    title: 'Reveja suas melhores linhas no Replay Instantâneo',
    body: 'Após surfar uma boa onda, pressione R para abrir o Replay e alternar entre cinco ângulos — incluindo câmera aérea de helicóptero, beira-mar e visão em primeira pessoa.',
  },
  {
    id: 'tip-first-person-cam',
    category: 'dica',
    kicker: 'Imersão no Pico',
    title: 'Alterne a perspectiva para ler o lábio da onda',
    body: 'Pressione T durante a sessão para experimentar a câmera em primeira pessoa e sentir de perto o ângulo de saída dos tubos e a altura das batidas no lip.',
  },

  // Surfing World Trivia (Curiosidades do Mundo do Surfe)
  {
    id: 'trivia-hee-nalu',
    category: 'curiosidade',
    kicker: 'História & Raízes',
    title: 'Heʻe nalu: a arte sagrada da Polinésia antiga',
    body: 'Há mais de mil anos, o surfe já era praticado na Polinésia e no Havaí antigo como expressão espiritual e ritual de liderança. As pranchas reais, chamadas Olo, chegavam a medir mais de cinco metros.',
  },
  {
    id: 'trivia-duke-kahanamoku',
    category: 'curiosidade',
    kicker: 'Pioneiros do Oceano',
    title: 'Duke Kahanamoku levou o surfe moderno ao mundo',
    body: 'Medalhista olímpico de natação pelo Havaí, Duke Kahanamoku realizou demonstrações históricas na Califórnia e na Austrália na década de 1910, transformando uma tradição insular em cultura global.',
  },
  {
    id: 'trivia-thruster-1980',
    category: 'curiosidade',
    kicker: 'Evolução das Pranchas',
    title: 'O desenho de três quilhas mudou a história em 1980',
    body: 'Criado pelo shaper e competidor australiano Simon Anderson, o sistema Thruster de três quilhas equilibradas trouxe velocidade com controle nas curvas — e segue como padrão nas competições até hoje.',
  },
  {
    id: 'trivia-judging-criteria',
    category: 'curiosidade',
    kicker: 'Regras da Elite',
    title: 'Como os juízes avaliam uma onda de 0 a 10',
    body: 'Os painéis profissionais julgam cinco pilares: comprometimento e grau de dificuldade, manobras progressivas e inovadoras, variedade de movimentos, além de velocidade, força e fluidez.',
  },
  {
    id: 'trivia-offshore-wind',
    category: 'curiosidade',
    kicker: 'Ciência das Ondas',
    title: 'Por que o vento terral cria tubos perfeitos',
    body: 'Quando o vento sopra da terra para o mar (offshore), ele empurra contra a face da onda e segura a crista por mais segundos, mantendo a parede lisa e formando cilindros ocos e abertos.',
  },
  {
    id: 'trivia-nazare-canyon',
    category: 'curiosidade',
    kicker: 'Geografia Submarina',
    title: 'O segredo geológico das ondas gigantes de Nazaré',
    body: 'Em Portugal, o Canhão da Nazaré — um desfiladeiro submerso com cerca de 5 km de profundidade — canaliza a energia das tempestades atlânticas e amplifica a altura das ondas perto da costa.',
  },
  {
    id: 'trivia-swell-period',
    category: 'curiosidade',
    kicker: 'Previsão Oceânica',
    title: 'Ondulações de longo período viajam oceanos inteiros',
    body: 'Um período de 16 a 20 segundos indica que a ondulação nasceu em tempestades distantes há dias. Quanto maior o intervalo entre as cristas, mais energia a onda carrega ao atingir a bancada.',
  },
  {
    id: 'trivia-pipeline-reef',
    category: 'curiosidade',
    kicker: 'Picos Lendários',
    title: 'Pipeline e o impacto de uma bancada vulcânica rasa',
    body: 'Na costa norte de Oahu, Havaí, a transição brusca de águas profundas para um recife raso faz a energia do Pacífico levantar quase verticalmente, gerando um dos tubos mais pesados do planeta.',
  },
  {
    id: 'trivia-regular-goofy',
    category: 'curiosidade',
    kicker: 'Cultura & Técnica',
    title: 'Base Regular ou Goofy muda toda a leitura da bateria',
    body: 'Surfistas Regular colocam o pé esquerdo à frente; os Goofy lideram com o direito. Essa base define se o atleta surfa de frente (frontside) ou de costas (backside) para cada direção de pico.',
  },
  {
    id: 'trivia-brazilian-storm',
    category: 'curiosidade',
    kicker: 'Circuito Mundial',
    title: 'A ascensão brasileira transformou o surfe aéreo',
    body: 'A geração conhecida como Brazilian Storm elevou o nível técnico das baterias mundiais ao unir leitura agressiva de tubos com aéreos rotacionais de altíssimo risco em qualquer condição de mar.',
  },
];

function seededFraction(seed: number, step: number): number {
  const x = Math.sin(seed * 12.9898 + step * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Builds an alternating queue of gameplay tips and surfing trivia
 * so the player sees balanced, non-repetitive cards during loading.
 */
export function buildChampionshipLoadingQueue(seed: number): ChampionshipLoadingTip[] {
  const tips = CHAMPIONSHIP_LOADING_TIPS.filter((item) => item.category === 'dica');
  const trivia = CHAMPIONSHIP_LOADING_TIPS.filter((item) => item.category === 'curiosidade');

  const shuffle = <T,>(items: T[], offset: number): T[] => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(seededFraction(seed + offset, i + 1) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const shuffledTips = shuffle(tips, 17);
  const shuffledTrivia = shuffle(trivia, 53);
  const startWithTip = seededFraction(seed, 3) >= 0.4;

  const queue: ChampionshipLoadingTip[] = [];
  const maxLen = Math.max(shuffledTips.length, shuffledTrivia.length);
  for (let i = 0; i < maxLen; i++) {
    const first = startWithTip ? shuffledTips[i] : shuffledTrivia[i];
    const second = startWithTip ? shuffledTrivia[i] : shuffledTips[i];
    if (first) queue.push(first);
    if (second) queue.push(second);
  }
  return queue;
}
