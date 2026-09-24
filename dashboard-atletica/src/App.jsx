import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZHcDYLZ8KaN2-JD0sKpnZHj_Jz0Udxl1SmGeoGEtd7GnvzWnGHNd2BH7zFiG3FHNl6f6YaJfkD7ul/pub?output=csv";

const MAPA_NORMALIZACAO = {
  'sinuca.': 'Sinuca',
  'sinuca': 'Sinuca',
  '8 ball pool': 'Sinuca',
  'clahs': 'Clash Royale',
  'clash royale': 'Clash Royale',
  'fifa': 'EA FC (FIFA)',
  'ea fc (fifa)': 'EA FC (FIFA)',
  'lol - league of legends': 'League of Legends',
  'league of legends': 'League of Legends',
};

const REGRAS_MODALIDADES = {
  'Vôlei': { icone: '🏐', tamPadrao: 6 },
  'Futsal': { icone: '⚽', tamPadrao: 5 },
  'Futebol de Campo': { icone: '⚽', tamPadrao: 11 },
  'Futebol Society (Fut 7)': { icone: '⚽', tamPadrao: 7 },
  'Basquete': { icone: '🏀', tamPadrao: 5 },
  'Handebol': { icone: '🤾', tamPadrao: 7 },
  'Beach Tennis': { icone: '🎾', tamPadrao: 2 },
  'Truco': { icone: '🃏', tamPadrao: 2 },
  'Sinuca': { icone: '🎱', tamPadrao: 1 },
  'Tênis de mesa': { icone: '🏓', tamPadrao: 1 },
  'Xadrez': { icone: '♟️', tamPadrao: 1 },
  'Poker': { icone: '♠️', tamPadrao: 6 },
  'Valorant': { icone: '🎯', tamPadrao: 5 },
  'EA FC (FIFA)': { icone: '🎮', tamPadrao: 1 },
  'Counter Strike': { icone: '💣', tamPadrao: 5 },
  'League of Legends': { icone: '⚔️', tamPadrao: 5 },
  'Fortnite': { icone: '🪂', tamPadrao: 4 },
  'Rocket League': { icone: '🚗', tamPadrao: 3 },
  'Dota': { icone: '🛡️', tamPadrao: 5 },
  'Marvel Rivals': { icone: '🦸', tamPadrao: 6 },
  'PUBG: BATTLEGROUNDS': { icone: '🪖', tamPadrao: 4 },
};

// --- FUNÇÕES DE HIGIENIZAÇÃO ---

const formatarWhatsApp = (val) => {
  if (!val || val === '-' || val.trim() === '') return '-';
  let num = String(val).replace(/\D/g, '');
  if (num.startsWith('55') && num.length >= 12) {
    num = num.substring(2);
  }
  if (num.length === 11) {
    return `(${num.substring(0, 2)}) ${num.substring(2, 7)}-${num.substring(7)}`;
  } else if (num.length === 10) {
    return `(${num.substring(0, 2)}) ${num.substring(2, 6)}-${num.substring(6)}`;
  }
  return val;
};

const formatarInstagram = (val) => {
  if (!val || val.trim() === '' || val.trim() === '-') return '-';
  let insta = val.trim();
  if (!insta.startsWith('@')) {
    insta = `@${insta}`;
  }
  return insta;
};

const formatarNome = (val) => {
  if (!val || val === '-' || val.trim() === '') return '-';
  return val
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

const SIMPLIFICACAO_TITULOS = [
  { palavras: ['gincanas', 'eventos curtos', 'disponíve'], titulo: 'Disponibilidade para Eventos' },
  { palavras: ['sugestão', 'ideia', 'contribui'], titulo: 'Sugestões e Ideias' },
];

const obterTituloSimplificado = (colunaOriginal) => {
  const colLower = colunaOriginal.toLowerCase();
  for (const item of SIMPLIFICACAO_TITULOS) {
    if (item.palavras.some((p) => colLower.includes(p))) {
      return item.titulo;
    }
  }
  return colunaOriginal;
};

const obterValorPorChave = (atleta, palavrasChave) => {
  if (!atleta) return '-';
  const chaveEncontrada = Object.keys(atleta).find((col) => {
    const colLower = col.toLowerCase();
    return palavrasChave.some((p) => colLower.includes(p.toLowerCase()));
  });
  return chaveEncontrada ? atleta[chaveEncontrada] : '-';
};

// FUNÇÃO AUXILIAR DE AGRUPAMENTO E MESCLAGEM DE ENVIOS
const agruparEMesclarAtletas = (dadosTratados) => {
  const mapaAtletas = new Map();

  dadosTratados.forEach((linha) => {
    const keys = Object.keys(linha);
    const colWhats = keys.find(c => c.toLowerCase().includes('whatsapp') || c.toLowerCase().includes('telefone'));
    const colNome = keys.find(c => c.toLowerCase().includes('nome')) || keys[1] || keys[0];

    const whats = (linha[colWhats] || '').replace(/\D/g, '');
    const nome = (linha[colNome] || '').trim().toLowerCase();

    // Chave única para rastrear o mesmo atleta
    const chaveUnica = whats.length >= 8 ? whats : nome;

    if (!chaveUnica) return;

    if (!mapaAtletas.has(chaveUnica)) {
      mapaAtletas.set(chaveUnica, {
        ...linha,
        _qtdEnvios: 1,
        _teveAlteracaoDados: false,
        _historicoEnvios: [linha]
      });
    } else {
      const atletaExistente = mapaAtletas.get(chaveUnica);
      atletaExistente._qtdEnvios += 1;
      atletaExistente._historicoEnvios.push(linha);

      // Checa divergência cadastral (Curso/Turno)
      const colCurso = keys.find(c => c.toLowerCase().includes('curso'));
      const colTurno = keys.find(c => c.toLowerCase().includes('turno'));

      if (
        (colCurso && linha[colCurso] && atletaExistente[colCurso] && linha[colCurso] !== atletaExistente[colCurso]) ||
        (colTurno && linha[colTurno] && atletaExistente[colTurno] && linha[colTurno] !== atletaExistente[colTurno])
      ) {
        atletaExistente._teveAlteracaoDados = true;
      }

      // Mescla dos Esportes/Jogos
      keys.forEach((col) => {
        const colLower = col.toLowerCase();
        if (colLower.includes('esportes') || colLower.includes('jogos') || colLower.includes('e-sports')) {
          const antigo = atletaExistente[col] || '';
          const novo = linha[col] || '';

          const listaAntiga = antigo.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
          const listaNova = novo.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);

          const unificados = Array.from(new Set([...listaAntiga, ...listaNova]));
          atletaExistente[col] = unificados.join(', ');
        } else if (linha[col] && (!atletaExistente[col] || atletaExistente[col] === '-')) {
          atletaExistente[col] = linha[col];
        }
      });
    }
  });

  return Array.from(mapaAtletas.values());
};

const renderizarCelulaSimplificada = (valor, nomeColuna) => {
  if (!valor || valor === '-' || valor.trim() === '') {
    return <span style={styles.badgeVazio}>—</span>;
  }

  const colLower = nomeColuna.toLowerCase();

  if (colLower.includes('turno')) {
    const valLower = valor.toLowerCase();
    const isNoite = valLower.includes('noite') || valLower.includes('noturno');
    
    return (
      <span style={isNoite ? styles.badgeTurnoNoturno : styles.badgeTurnoMatutino}>
        {isNoite ? '🌙 ' : '☀️ '}{valor}
      </span>
    );
  }

  if (colLower.includes('curso')) {
    return <span style={styles.badgeCurso}>{valor}</span>;
  }

  if (colLower.includes('whatsapp') || colLower.includes('telefone')) {
    return <span style={styles.linkWhatsapp}>📱 {valor}</span>;
  }

  if (colLower.includes('esportes') || colLower.includes('jogos') || colLower.includes('e-sports')) {
    const itens = valor.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    const eJogoUnico = itens.length === 1;

    return (
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {itens.slice(0, 3).map((item, idx) => {
          const icone = REGRAS_MODALIDADES[item]?.icone || '🏆';
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* Ícone fora da tag quando for jogo único */}
              {eJogoUnico && <span title="Inscrição Exclusiva" style={{ fontSize: '13px' }}>🎯</span>}
              <span style={styles.badgeModalidade}>
                {icone} {item}
              </span>
            </div>
          );
        })}
        {itens.length > 3 && (
          <span style={styles.badgeMaisModalidades}>+{itens.length - 3}</span>
        )}
      </div>
    );
  }

  return <span>{valor}</span>;
};

export default function App() {
  const [dados, setDados] = useState([]);
  const [colunas, setColunas] = useState([]);
  const [estatisticas, setEstatisticas] = useState({});
  const [filtroTexto, setFiltroTexto] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('graficos');
  const [atletaSelecionado, setAtletaSelecionado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  // Estados da aba de Montar Times
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState('Vôlei');
  const [tamanhoPorTime, setTamanhoPorTime] = useState(6);
  const [filtroCursoTime, setFiltroCursoTime] = useState('TODOS');
  const [qtdTimes, setQtdTimes] = useState(1);
  const [timeAtivoAbas, setTimeAtivoAbas] = useState(0);
  const [timesEscalados, setTimesEscalados] = useState({ 0: [] });
  const [nomesTimes, setNomesTimes] = useState({ 0: 'Time A', 1: 'Time B', 2: 'Time C', 3: 'Time D', 4: 'Time E' });
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const dadosBrutos = results.data;

          const dadosTratados = dadosBrutos.map((linha) => {
            const linhaTratada = { ...linha };
            Object.keys(linhaTratada).forEach((col) => {
              const colLower = col.toLowerCase();
              if (colLower.includes('whatsapp') || colLower.includes('telefone')) {
                linhaTratada[col] = formatarWhatsApp(linhaTratada[col]);
              } else if (colLower.includes('instagram')) {
                linhaTratada[col] = formatarInstagram(linhaTratada[col]);
              } else if (colLower.includes('nome')) {
                linhaTratada[col] = formatarNome(linhaTratada[col]);
              }
            });
            return linhaTratada;
          });

          // APLICA A MESCLAGEM AUTOMÁTICA DE ATLETAS
          const dadosAgrupados = agruparEMesclarAtletas(dadosTratados);

          setDados(dadosAgrupados);
          setColunas(Object.keys(dadosAgrupados[0] || {}));

          const categorias = {};
          dadosAgrupados.forEach((atleta) => {
            Object.keys(atleta).forEach((coluna) => {
              if (
                coluna.includes("Esportes") || 
                coluna.includes("Jogos") || 
                coluna.includes("E-sports")
              ) {
                const nomeCategoria = coluna.trim();
                if (!categorias[nomeCategoria]) {
                  categorias[nomeCategoria] = {
                    itens: {},
                    atletasUnicosSet: new Set()
                  };
                }

                const valor = atleta[coluna];
                if (valor && valor !== '-' && valor.trim() !== '') {
                  const itens = valor.split(/[,;\n]/).map((item) => item.trim());
                  let teveEscolhaNaCategoria = false;

                  itens.forEach((itemRaw) => {
                    if (!itemRaw) return;
                    teveEscolhaNaCategoria = true;
                    const chaveLower = itemRaw.toLowerCase();
                    const nomeFormatado = MAPA_NORMALIZACAO[chaveLower] || itemRaw;
                    categorias[nomeCategoria].itens[nomeFormatado] = (categorias[nomeCategoria].itens[nomeFormatado] || 0) + 1;
                  });

                  if (teveEscolhaNaCategoria) {
                    const idAtleta = atleta[Object.keys(atleta)[0]] || JSON.stringify(atleta);
                    categorias[nomeCategoria].atletasUnicosSet.add(idAtleta);
                  }
                }
              }
            });
          });

          const estatisticasProcessadas = {};
          Object.entries(categorias).forEach(([catNome, obj]) => {
            estatisticasProcessadas[catNome] = {
              itens: obj.itens,
              atletasUnicos: obj.atletasUnicosSet.size
            };
          });

          setEstatisticas(estatisticasProcessadas);
        } else {
          setErro("Nenhum dado encontrado na planilha.");
        }
        setCarregando(false);
      },
      error: (err) => {
        console.error(err);
        setErro("Erro ao carregar os dados brutos da planilha.");
        setCarregando(false);
      }
    });
  }, []);

  const handleTrocarModalidade = (novaMod) => {
    setModalidadeSelecionada(novaMod);
    const regra = REGRAS_MODALIDADES[novaMod];
    const tam = regra ? regra.tamPadrao : 5;
    setTamanhoPorTime(tam);
    limparEscalacao();
  };

  const dadosFiltrados = dados.filter((atleta) => {
    if (!filtroTexto) return true;
    const busca = filtroTexto.toLowerCase();
    return Object.values(atleta).some((val) => 
      String(val).toLowerCase().includes(busca)
    );
  });

  const obterDestaquesApresentacao = () => {
    let topGeral = { nome: '-', qtd: 0, cat: '-' };
    let totalInscricoesGeral = 0;

    Object.entries(estatisticas).forEach(([cat, data]) => {
      Object.entries(data.itens).forEach(([nome, qtd]) => {
        totalInscricoesGeral += qtd;
        if (qtd > topGeral.qtd) {
          topGeral = { nome, qtd, cat };
        }
      });
    });

    return { topGeral, totalInscricoesGeral };
  };

  const { topGeral, totalInscricoesGeral } = obterDestaquesApresentacao();

  if (carregando) {
    return (
      <div style={styles.containerCenter}>
        <p style={{ color: '#94a3b8', fontSize: '16px' }}>Carregando dados da A.A.A.F.R.P....</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div style={styles.containerCenter}>
        <p style={{ color: '#ef4444', fontSize: '16px' }}>{erro}</p>
      </div>
    );
  }

  const colNome = colunas.find(c => c.toLowerCase().includes('nome')) || colunas[1] || colunas[0];
  const colCurso = colunas.find(c => c.toLowerCase().includes('curso'));
  const colTurno = colunas.find(c => c.toLowerCase().includes('turno'));
  const colWhats = colunas.find(c => c.toLowerCase().includes('whatsapp') || c.toLowerCase().includes('telefone'));
  const colCarimbo = colunas.find(c => c.toLowerCase().includes('carimbo') || c.toLowerCase().includes('data'));

  const listaModalidadesUnicas = Array.from(
    new Set(Object.values(estatisticas).flatMap(cat => Object.keys(cat.itens)))
  ).sort();

  const atletasDaModalidade = dados.filter(atleta => {
    return Object.keys(atleta).some(col => {
      const colLower = col.toLowerCase();
      if (colLower.includes('esportes') || colLower.includes('jogos') || colLower.includes('e-sports')) {
        const valor = atleta[col] || '';
        return valor.toLowerCase().includes(modalidadeSelecionada.toLowerCase());
      }
      return false;
    });
  });

  const atletasFiltradosPorCurso = atletasDaModalidade.filter(atleta => {
    if (filtroCursoTime === 'TODOS') return true;
    const cursoAtleta = atleta[colCurso] || '';
    return cursoAtleta.toLowerCase().includes(filtroCursoTime.toLowerCase());
  });

  const listaCursosDisponiveis = Array.from(
    new Set(atletasDaModalidade.map(a => a[colCurso] || 'Outros').filter(Boolean))
  ).sort();

  const getIndexTimeAtleta = (nomeAtleta) => {
    for (let i = 0; i < qtdTimes; i++) {
      if (timesEscalados[i]?.some(a => a.nome === nomeAtleta)) {
        return i;
      }
    }
    return -1;
  };

  const toggleAtletaNoTime = (atleta, timeTargetIdx = timeAtivoAbas) => {
    const timeIndexAtual = getIndexTimeAtleta(atleta.nome);
    
    setTimesEscalados(prev => {
      const novostimes = { ...prev };
      if (timeIndexAtual !== -1) {
        novostimes[timeIndexAtual] = novostimes[timeIndexAtual].filter(a => a.nome !== atleta.nome);
      }
      if (timeIndexAtual !== timeTargetIdx) {
        novostimes[timeTargetIdx] = [...(novostimes[timeTargetIdx] || []), atleta];
      }
      return novostimes;
    });
  };

  const autoDistribuirTimes = (modo = 'random') => {
    const baseAtletas = modo === 'curso' ? atletasFiltradosPorCurso : atletasDaModalidade;
    if (baseAtletas.length === 0) return;

    const numTimesNecessarios = Math.max(1, Math.ceil(baseAtletas.length / tamanhoPorTime));
    setQtdTimes(numTimesNecessarios);
    setTimeAtivoAbas(0);

    let listaProcessar = [...baseAtletas].map(a => ({
      nome: a[colNome] || '-',
      whats: a[colWhats] || '-',
      curso: a[colCurso] || '-'
    }));

    if (modo === 'random') {
      listaProcessar.sort(() => Math.random() - 0.5);
    } else if (modo === 'curso') {
      listaProcessar.sort((a, b) => a.curso.localeCompare(b.curso));
    }

    const novosTimes = {};
    const novosNomes = { ...nomesTimes };

    for (let i = 0; i < numTimesNecessarios; i++) {
      novosTimes[i] = [];
      if (modo === 'curso' && filtroCursoTime !== 'TODOS') {
        novosNomes[i] = `${filtroCursoTime} - Time ${i + 1}`;
      }
    }

    if (modo === 'curso' && filtroCursoTime !== 'TODOS') {
      setNomesTimes(novosNomes);
    }

    listaProcessar.forEach((atleta, index) => {
      const targetTime = Math.floor(index / tamanhoPorTime);
      const timeDestino = targetTime < numTimesNecessarios ? targetTime : numTimesNecessarios - 1;
      novosTimes[timeDestino].push(atleta);
    });

    setTimesEscalados(novosTimes);
  };

  const limparEscalacao = () => {
    setTimesEscalados({ 0: [] });
    setQtdTimes(1);
    setTimeAtivoAbas(0);
  };

  const copiarEscalacaoWhatsApp = () => {
    let texto = `🏆 *ESCALAÇÃO - ${modalidadeSelecionada.toUpperCase()}*\n`;
    texto += `📌 *Regra:* ${tamanhoPorTime} atletas por time\n`;
    texto += `-------------------------------\n`;

    for (let i = 0; i < qtdTimes; i++) {
      const timeList = timesEscalados[i] || [];
      const nomeDoTime = nomesTimes[i] || `Time ${String.fromCharCode(65 + i)}`;
      
      texto += `📋 *${nomeDoTime}* (${timeList.length} atletas)\n`;
      if (timeList.length === 0) {
        texto += `_(nenhum atleta)_\n`;
      } else {
        timeList.forEach((atleta, index) => {
          texto += `${index + 1}. ${atleta.nome} (${atleta.curso})\n`;
        });
      }
      texto += `\n`;
    }

    texto += `-------------------------------\n🔴⚫ *A.A.A.F.R.P. - FATEC RP*`;

    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div style={styles.appContainer} className="app-container">
      {/* REGRAS CSS RESPONSIVAS DEDICADAS */}
      <style>{`
        @keyframes moverGlow1 {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(120px, 80px) scale(1.1); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes moverGlow2 {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(-100px, -60px) scale(1.15); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .glow-orb-1 {
          position: fixed;
          top: -10%;
          left: -10%;
          width: 50vw;
          height: 50vw;
          background: radial-gradient(circle, rgba(239, 68, 68, 0.12) 0%, rgba(0,0,0,0) 70%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
          animation: moverGlow1 22s ease-in-out infinite;
          filter: blur(60px);
        }
        .glow-orb-2 {
          position: fixed;
          bottom: -10%;
          right: -10%;
          width: 55vw;
          height: 55vw;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, rgba(0,0,0,0) 70%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
          animation: moverGlow2 28s ease-in-out infinite;
          filter: blur(70px);
        }
        .tr-hover {
          transition: all 0.15s ease;
        }
        .tr-hover:hover {
          background-color: rgba(30, 41, 59, 0.85) !important;
        }

        /* MEDIA QUERIES PARA TELEMÓVEL E TABLET */
        @media (max-width: 768px) {
          .app-container {
            padding: 16px 12px !important;
          }
          .header-responsive {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }
          .nav-tabs-responsive {
            width: 100% !important;
            overflow-x: auto !important;
            white-space: nowrap !important;
            padding: 6px !important;
            justify-content: flex-start !important;
          }
          .nav-tabs-responsive button {
            padding: 8px 12px !important;
            font-size: 12px !important;
            flex-shrink: 0 !important;
          }
          .grid-responsive {
            grid-template-columns: 1fr !important;
          }
          .search-responsive {
            width: 100% !important;
          }
          .table-header-responsive {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .config-panel-responsive {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .config-panel-responsive > div {
            width: 100% !important;
            flex: none !important;
          }
        }
      `}</style>

      <div className="glow-orb-1" />
      <div className="glow-orb-2" />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <header style={styles.header} className="header-responsive">
          <div>
            <span style={styles.badgeHeader}>A.A.A.F.R.P. • Apresentação de Dados</span>
            <h1 style={styles.title}>Relatório Geral de Atletas & Modalidades</h1>
          </div>
          
          <div style={styles.navTabs} className="nav-tabs-responsive">
            <button 
              onClick={() => setAbaAtiva('graficos')} 
              style={abaAtiva === 'graficos' ? styles.tabActive : styles.tabInactive}
            >
              📊 Apresentação
            </button>
            <button 
              onClick={() => setAbaAtiva('geral')} 
              style={abaAtiva === 'geral' ? styles.tabActive : styles.tabInactive}
            >
              📋 Resumo
            </button>
            <button 
              onClick={() => setAbaAtiva('tabela')} 
              style={abaAtiva === 'tabela' ? styles.tabActive : styles.tabInactive}
            >
              🗃️ Tabela
            </button>
            <button 
              onClick={() => setAbaAtiva('times')} 
              style={abaAtiva === 'times' ? styles.tabActive : styles.tabInactive}
            >
              🎮 Montar Times
            </button>
          </div>

          <div style={styles.statBoxHeader}>
            <span style={styles.statNumberHeader}>{dados.length}</span>
            <span style={styles.statLabelHeader}>Atletas Inscritos</span>
          </div>
        </header>

        {/* ABA 1: GRÁFICOS */}
        {abaAtiva === 'graficos' && (
          <section style={styles.section}>
            <div style={styles.kpiGrid} className="grid-responsive">
              <div style={styles.kpiCard}>
                <span style={styles.kpiLabel}>Total de Atletas</span>
                <div style={styles.kpiValueContainer}>
                  <span style={styles.kpiValue}>{dados.length}</span>
                  <span style={styles.kpiBadge}>100% Participação</span>
                </div>
                <p style={styles.kpiSubtext}>Cadastrados via formulário oficial</p>
              </div>

              <div style={styles.kpiCardHighlight}>
                <span style={styles.kpiLabelHighlight}>Modalidade Mais Procurada</span>
                <div style={styles.kpiValueContainer}>
                  <span style={styles.kpiValueHighlight}>
                    {REGRAS_MODALIDADES[topGeral.nome]?.icone || '🏆'} {topGeral.nome}
                  </span>
                  <span style={styles.kpiBadgeHighlight}>{topGeral.qtd} atletas</span>
                </div>
                <p style={styles.kpiSubtextHighlight}>Líder em adesão na Atlética</p>
              </div>

              <div style={styles.kpiCard}>
                <span style={styles.kpiLabel}>Total de Escolhas</span>
                <div style={styles.kpiValueContainer}>
                  <span style={styles.kpiValue}>{totalInscricoesGeral}</span>
                  <span style={styles.kpiBadgeBlue}>
                    ~{(totalInscricoesGeral / (dados.length || 1)).toFixed(1)} mod/atleta
                  </span>
                </div>
                <p style={styles.kpiSubtext}>Interesse acumulado em todas categorias</p>
              </div>
            </div>

            <div style={styles.gridGraficos} className="grid-responsive">
              {Object.entries(estatisticas).map(([categoriaNome, dataObj], idx) => {
                const listaItens = dataObj.itens;
                const maxQtd = Math.max(...Object.values(listaItens));
                const totalCategoria = Object.values(listaItens).reduce((a, b) => a + b, 0);

                return (
                  <div key={idx} style={styles.cardGraficoPresentation}>
                    <div style={styles.cardGraficoHeader}>
                      <div>
                        <h3 style={styles.cardGraficoTitle}>{categoriaNome}</h3>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                          <span style={styles.badgeRefinado}>{dataObj.atletasUnicos} atletas únicos</span>
                          <span style={styles.badgeBruto}>{totalCategoria} escolhas no total</span>
                        </div>
                      </div>
                    </div>

                    <div style={styles.barsContainer}>
                      {Object.entries(listaItens)
                        .sort(([, a], [, b]) => b - a)
                        .map(([itemNome, qtd], i) => {
                          const porcentagemBarra = (qtd / maxQtd) * 100;
                          const porcentagemTotal = ((qtd / totalCategoria) * 100).toFixed(0);
                          const isLider = i === 0;
                          const icone = REGRAS_MODALIDADES[itemNome]?.icone || '🏆';

                          return (
                            <div key={i} style={styles.barRow}>
                              <div style={styles.barLabelContainer}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ ...styles.barLabel, fontWeight: isLider ? '700' : '500', color: isLider ? '#f8fafc' : '#cbd5e1' }}>
                                    {icone} {itemNome}
                                  </span>
                                  {isLider && <span style={styles.badgeLider}>👑 1º</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={styles.barPercent}>{porcentagemTotal}%</span>
                                  <span style={{ ...styles.barValue, color: isLider ? '#ef4444' : '#38bdf8' }}>{qtd}</span>
                                </div>
                              </div>
                              
                              <div style={styles.barTrack}>
                                <div 
                                  style={{ 
                                    ...styles.barFill, 
                                    width: `${porcentagemBarra}%`,
                                    background: isLider 
                                      ? 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)' 
                                      : 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)'
                                  }} 
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ABA 2: RESUMO POR MODALIDADE */}
        {abaAtiva === 'geral' && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Inscrições por Modalidade</h2>
            <p style={styles.sectionSubtitle}>
              Comparativo detalhado de escolhas por modalidade
            </p>

            <div style={styles.gridCategorias} className="grid-responsive">
              {Object.entries(estatisticas).map(([categoriaNome, dataObj], idx) => {
                const listaItens = dataObj.itens;
                const totalCategoria = Object.values(listaItens).reduce((a, b) => a + b, 0);
                const maxQtd = Math.max(...Object.values(listaItens));

                return (
                  <div key={idx} style={styles.cardCategoria}>
                    <div style={styles.cardCategoriaHeader}>
                      <h3 style={styles.cardCategoriaTitle}>{categoriaNome}</h3>
                      <div style={styles.metricaDuplaBox}>
                        <span style={styles.badgeRefinado}>{dataObj.atletasUnicos} atletas únicos</span>
                        <span style={styles.badgeBruto}>{totalCategoria} escolhas</span>
                      </div>
                    </div>

                    <div style={styles.listaModalidadesRefinada}>
                      {Object.entries(listaItens)
                        .sort(([, a], [, b]) => b - a)
                        .map(([itemNome, qtd], i) => {
                          const porcentagem = Math.round((qtd / maxQtd) * 100);
                          const icone = REGRAS_MODALIDADES[itemNome]?.icone || '🏆';

                          return (
                            <div key={i} style={styles.itemModalidadeRow}>
                              <div 
                                style={{ 
                                  ...styles.itemModalidadeBar, 
                                  width: `${porcentagem}%` 
                                }} 
                              />
                              <span style={styles.itemModalidadeNome}>
                                {icone} {itemNome}
                              </span>
                              <span style={styles.itemModalidadeBadge}>{qtd}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ABA 3: TABELA COMPLETA */}
        {abaAtiva === 'tabela' && (
          <section style={styles.section}>
            <div style={styles.tableHeaderContainer} className="table-header-responsive">
              <div>
                <h2 style={styles.sectionTitle}>Base Geral de Atletas</h2>
                <p style={styles.sectionSubtitle}>
                  Clique em qualquer linha para ver a ficha • Exibindo <strong style={{ color: '#ef4444' }}>{dadosFiltrados.length}</strong> de {dados.length}
                </p>
              </div>
              
              <input
                type="text"
                placeholder="🔍 Pesquisar por nome, curso, WhatsApp..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                style={styles.searchInput}
                className="search-responsive"
              />
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: '40px', textAlign: 'center' }}>#</th>
                    <th style={styles.th}>Nome do Atleta</th>
                    {colCurso && <th style={styles.th}>Curso</th>}
                    {colTurno && <th style={styles.th}>Turno</th>}
                    {colWhats && <th style={styles.th}>WhatsApp</th>}
                    <th style={styles.th}>Modalidades Selecionadas</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosFiltrados.map((linha, idx) => (
                    <tr 
                      key={idx} 
                      className="tr-hover"
                      onClick={() => setAtletaSelecionado(linha)}
                      style={{ 
                        backgroundColor: idx % 2 === 0 ? 'rgba(19, 28, 46, 0.5)' : 'rgba(11, 18, 32, 0.5)',
                        cursor: 'pointer'
                      }}
                    >
                      <td style={{ ...styles.td, textAlign: 'center', color: '#475569', fontWeight: '600', fontSize: '11px' }}>
                        {idx + 1}
                      </td>

                      <td style={{ ...styles.td, fontWeight: '700', color: '#f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{linha[colNome] || '-'}</span>
                          {linha._teveAlteracaoDados && (
                            <span style={styles.badgeAlterado}>⚠️ Alterado</span>
                          )}
                        </div>
                      </td>

                      {colCurso && (
                        <td style={styles.td}>
                          {renderizarCelulaSimplificada(linha[colCurso], colCurso)}
                        </td>
                      )}

                      {colTurno && (
                        <td style={styles.td}>
                          {renderizarCelulaSimplificada(linha[colTurno], colTurno)}
                        </td>
                      )}

                      {colWhats && (
                        <td style={styles.td}>
                          {renderizarCelulaSimplificada(linha[colWhats], colWhats)}
                        </td>
                      )}

                      <td style={styles.td}>
                        {renderizarCelulaSimplificada(
                          Object.keys(linha)
                            .filter(k => k.toLowerCase().includes('esportes') || k.toLowerCase().includes('jogos'))
                            .map(k => linha[k])
                            .filter(Boolean)
                            .join(', '), 
                          'esportes'
                        )}
                      </td>

                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <span style={styles.btnVerFichaSutil}>
                          Ver Ficha ➔
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ABA 4: MONTAR TIMES */}
        {abaAtiva === 'times' && (
          <section style={styles.section}>
            
            {/* PAINEL DE CONFIGURAÇÕES */}
            <div style={{ ...styles.cardGraficoPresentation, marginBottom: '20px', padding: '18px 24px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyBetween: 'space-between', gap: '16px' }} className="config-panel-responsive">
                
                {/* Seleção de Modalidade */}
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ ...styles.labelInfo, marginBottom: '6px' }}>Modalidade / Jogo</label>
                  <select 
                    value={modalidadeSelecionada} 
                    onChange={(e) => handleTrocarModalidade(e.target.value)}
                    style={{ ...styles.searchInput, width: '100%', cursor: 'pointer', backgroundColor: '#0b1220' }}
                  >
                    {listaModalidadesUnicas.map((mod, i) => (
                      <option key={i} value={mod} style={{ backgroundColor: '#0f172a' }}>
                        {REGRAS_MODALIDADES[mod]?.icone || '🏆'} {mod}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Curso */}
                <div style={{ flex: '1 1 180px' }}>
                  <label style={{ ...styles.labelInfo, marginBottom: '6px' }}>Filtrar por Curso</label>
                  <select 
                    value={filtroCursoTime} 
                    onChange={(e) => setFiltroCursoTime(e.target.value)}
                    style={{ ...styles.searchInput, width: '100%', cursor: 'pointer', backgroundColor: '#0b1220' }}
                  >
                    <option value="TODOS">🌐 Todos os Cursos</option>
                    {listaCursosDisponiveis.map((c, i) => (
                      <option key={i} value={c} style={{ backgroundColor: '#0f172a' }}>🎓 {c}</option>
                    ))}
                  </select>
                </div>

                {/* Regra de Titulares por Time */}
                <div style={{ flex: '0 0 120px' }}>
                  <label style={{ ...styles.labelInfo, marginBottom: '6px' }}>Titulares/Time</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={tamanhoPorTime}
                    onChange={(e) => setTamanhoPorTime(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ ...styles.searchInput, width: '100%', textAlign: 'center', backgroundColor: '#0b1220' }}
                  />
                </div>

                {/* Quantidade Manual de Times */}
                <div>
                  <label style={{ ...styles.labelInfo, marginBottom: '6px' }}>Qtd. Times</label>
                  <div style={styles.navTabs} className="nav-tabs-responsive">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        onClick={() => {
                          setQtdTimes(num);
                          if (timeAtivoAbas >= num) setTimeAtivoAbas(0);
                        }}
                        style={qtdTimes === num ? styles.tabActive : styles.tabInactive}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Botões de Ação */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
                  <button
                    onClick={() => autoDistribuirTimes('random')}
                    style={{
                      ...styles.tabActive,
                      backgroundColor: '#8b5cf6',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      flex: '1'
                    }}
                  >
                    🎲 Random
                  </button>

                  <button
                    onClick={() => autoDistribuirTimes('curso')}
                    style={{
                      ...styles.tabActive,
                      backgroundColor: '#0284c7',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      flex: '1'
                    }}
                  >
                    🎓 Por Curso
                  </button>

                  <button
                    onClick={limparEscalacao}
                    style={{
                      ...styles.tabInactive,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ef4444',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Limpar
                  </button>
                </div>

              </div>
            </div>

            {/* PAINEL PRINCIPAL DE ESCALAÇÃO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              
              {/* Coluna Esquerda: Lista de Atletas Disponíveis */}
              <div style={styles.cardGraficoPresentation}>
                <div style={styles.cardGraficoHeader}>
                  <div>
                    <h3 style={styles.cardGraficoTitle}>
                      Inscritos em {modalidadeSelecionada} ({atletasFiltradosPorCurso.length})
                    </h3>
                    <p style={{ ...styles.kpiSubtext, marginTop: '4px' }}>
                      Adicionando no: <strong style={{ color: '#38bdf8' }}>{nomesTimes[timeAtivoAbas] || 'Time ' + (timeAtivoAbas + 1)}</strong>
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                  {atletasFiltradosPorCurso.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                      Nenhum atleta encontrado para esta seleção.
                    </p>
                  ) : (
                    atletasFiltradosPorCurso.map((atleta, idx) => {
                      const nome = atleta[colNome] || '-';
                      const whats = atleta[colWhats] || '-';
                      const curso = atleta[colCurso] || '-';
                      const timeIndex = getIndexTimeAtleta(nome);
                      const estaNoTimeAtivo = timeIndex === timeAtivoAbas;

                      return (
                        <div key={idx} style={styles.itemModalidadeRow}>
                          <div>
                            <strong style={{ color: '#f8fafc', fontSize: '13px', display: 'block' }}>{nome}</strong>
                            <span style={{ color: '#64748b', fontSize: '11px' }}>{curso} • 📱 {whats}</span>
                          </div>

                          <button
                            onClick={() => toggleAtletaNoTime({ nome, whats, curso })}
                            style={{
                              backgroundColor: estaNoTimeAtivo 
                                ? 'rgba(239, 68, 68, 0.2)' 
                                : (timeIndex !== -1 ? '#334155' : '#0284c7'),
                              color: estaNoTimeAtivo ? '#ef4444' : (timeIndex !== -1 ? '#94a3b8' : '#fff'),
                              border: estaNoTimeAtivo ? '1px solid #ef4444' : 'none',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            {estaNoTimeAtivo 
                              ? 'Remover' 
                              : (timeIndex !== -1 ? `No ${nomesTimes[timeIndex] || 'Time ' + (timeIndex + 1)}` : '+ Adicionar')}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Coluna Direita: Escalação do Time */}
              <div style={styles.cardGraficoPresentation}>
                
                {/* Abas para alternar entre os times */}
                <div style={{ ...styles.navTabs, marginBottom: '16px' }} className="nav-tabs-responsive">
                  {Array.from({ length: qtdTimes }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTimeAtivoAbas(idx)}
                      style={timeAtivoAbas === idx ? styles.tabActive : styles.tabInactive}
                    >
                      {nomesTimes[idx] || `Time ${String.fromCharCode(65 + idx)}`} ({timesEscalados[idx]?.length || 0}/{tamanhoPorTime})
                    </button>
                  ))}
                </div>

                <div style={styles.cardGraficoHeader}>
                  <div>
                    <h3 style={styles.cardGraficoTitle}>Escalação do Time</h3>
                    <span style={(timesEscalados[timeAtivoAbas] || []).length >= tamanhoPorTime ? styles.badgeRefinado : styles.badgeBruto}>
                      {(timesEscalados[timeAtivoAbas] || []).length} / {tamanhoPorTime} titulares
                    </span>
                  </div>

                  <input 
                    type="text" 
                    value={nomesTimes[timeAtivoAbas] || `Time ${String.fromCharCode(65 + timeAtivoAbas)}`} 
                    onChange={(e) => setNomesTimes({ ...nomesTimes, [timeAtivoAbas]: e.target.value })}
                    style={{ ...styles.searchInput, width: '130px', padding: '6px 10px', fontSize: '12px' }}
                  />
                </div>

                {/* Lista de Escalados */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '200px', maxHeight: '350px', overflowY: 'auto', marginBottom: '20px' }}>
                  {(timesEscalados[timeAtivoAbas] || []).length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', margin: 'auto' }}>
                      Nenhum atleta escalado neste time. Use os botões "🎲 Random" ou "🎓 Por Curso".
                    </p>
                  ) : (
                    (timesEscalados[timeAtivoAbas] || []).map((atleta, idx) => {
                      const isExcedente = idx >= tamanhoPorTime;
                      return (
                        <div 
                          key={idx} 
                          style={{ 
                            ...styles.itemModalidadeRow, 
                            backgroundColor: isExcedente ? 'rgba(234, 179, 8, 0.1)' : 'rgba(2, 132, 199, 0.1)',
                            border: isExcedente ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(2, 132, 199, 0.2)'
                          }}
                        >
                          <span style={{ color: isExcedente ? '#fde047' : '#38bdf8', fontWeight: '700', fontSize: '12px' }}>
                            {idx + 1}. {atleta.nome} ({atleta.curso}) {isExcedente ? '⚠️ (Reserva)' : ''}
                          </span>
                          <button 
                            onClick={() => toggleAtletaNoTime(atleta, timeAtivoAbas)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Copiar WhatsApp */}
                <button
                  onClick={copiarEscalacaoWhatsApp}
                  style={{
                    ...styles.tabActive,
                    width: '100%',
                    backgroundColor: copiado ? '#16a34a' : '#ef4444',
                    cursor: 'pointer',
                    padding: '12px'
                  }}
                >
                  {copiado ? '✓ Escalação Copiada!' : '📋 Copiar Escalação para WhatsApp'}
                </button>
              </div>

            </div>
          </section>
        )}

        {/* MODAL FICHA COMPLETA DO ATLETA */}
        {atletaSelecionado && (
          <div style={styles.modalOverlay} onClick={() => setAtletaSelecionado(null)}>
            <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              
              <div style={styles.modalHeader}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={styles.badgeHeader}>Ficha do Atleta</span>
                    {colCarimbo && atletaSelecionado[colCarimbo] && (
                      <span style={styles.carimboSutil}>
                        ⏱️ Registrado em {atletaSelecionado[colCarimbo]}
                      </span>
                    )}
                  </div>
                  <h2 style={{ ...styles.title, fontSize: '24px', marginTop: '6px' }}>
                    {obterValorPorChave(atletaSelecionado, ['nome'])}
                  </h2>
                </div>
                <button style={styles.btnClose} onClick={() => setAtletaSelecionado(null)}>✕</button>
              </div>

              {atletaSelecionado._teveAlteracaoDados && (
                <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', color: '#fde047', fontSize: '12px' }}>
                  ⚠️ <strong>Atenção:</strong> Este atleta enviou mais de um formulário com divergência em dados de Curso/Turno. Os jogos foram mesclados.
                </div>
              )}

              <div style={styles.modalGridInfo}>
                <div>
                  <span style={styles.labelInfo}>Curso</span>
                  <p style={styles.valInfo}>{obterValorPorChave(atletaSelecionado, ['curso'])}</p>
                </div>
                <div>
                  <span style={styles.labelInfo}>Turno</span>
                  <p style={styles.valInfo}>{obterValorPorChave(atletaSelecionado, ['turno'])}</p>
                </div>
                <div>
                  <span style={styles.labelInfo}>WhatsApp</span>
                  <p style={{ ...styles.valInfo, color: '#4ade80' }}>
                    📱 {obterValorPorChave(atletaSelecionado, ['whatsapp', 'telefone'])}
                  </p>
                </div>
                <div>
                  <span style={styles.labelInfo}>Instagram</span>
                  <p style={{ ...styles.valInfo, color: '#f472b6' }}>
                    📸 {obterValorPorChave(atletaSelecionado, ['instagram'])}
                  </p>
                </div>
              </div>

              <div style={{ marginTop: '24px' }}>
                <h4 style={{ margin: '0 0 14px 0', color: '#ef4444', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Inscrições e Informações
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {colunas.map((col, idx) => {
                    const colLower = col.toLowerCase();
                    
                    if (
                      colLower.includes('nome') ||
                      colLower.includes('curso') ||
                      colLower.includes('turno') ||
                      colLower.includes('whatsapp') ||
                      colLower.includes('telefone') ||
                      colLower.includes('instagram') ||
                      colLower.includes('carimbo') ||
                      col.startsWith('_')
                    ) {
                      return null;
                    }

                    const valor = atletaSelecionado[col];
                    const temValor = valor && valor !== '-' && valor.trim() !== '';
                    const tituloCurto = obterTituloSimplificado(col);

                    return (
                      <div key={idx} style={styles.modalCampoBox}>
                        <span style={styles.modalCampoTitulo}>{tituloCurto}</span>
                        <p style={{ 
                          margin: 0, 
                          fontSize: '13px',
                          color: temValor ? '#38bdf8' : '#64748b', 
                          fontWeight: temValor ? '600' : '400',
                          fontStyle: temValor ? 'normal' : 'italic'
                        }}>
                          {temValor ? valor : 'Sem resposta'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ESTILOS BASE
const styles = {
  appContainer: {
    backgroundColor: '#070a12',
    color: '#f1f5f9',
    minHeight: '100vh',
    padding: '30px 40px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    position: 'relative',
    overflowX: 'hidden',
  },
  containerCenter: {
    backgroundColor: '#070a12',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '24px',
    marginBottom: '30px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    gap: '20px',
  },
  badgeHeader: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#ef4444',
    textTransform: 'uppercase',
    letterSpacing: '1.2px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '800',
    margin: '4px 0 0 0',
    color: '#f8fafc',
  },
  navTabs: {
    display: 'flex',
    backgroundColor: 'rgba(19, 28, 46, 0.8)',
    backdropFilter: 'blur(10px)',
    padding: '4px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    gap: '4px',
  },
  tabActive: {
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabInactive: {
    backgroundColor: 'transparent',
    color: '#94a3b8',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '8px',
    fontWeight: '500',
    fontSize: '13px',
    cursor: 'pointer',
  },
  statBoxHeader: {
    backgroundColor: 'rgba(19, 28, 46, 0.8)',
    backdropFilter: 'blur(10px)',
    padding: '10px 20px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    textAlign: 'center',
  },
  statNumberHeader: {
    display: 'block',
    fontSize: '24px',
    fontWeight: '800',
    color: '#38bdf8',
    lineHeight: '1',
  },
  statLabelHeader: {
    fontSize: '10px',
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: '4px',
  },
  section: {
    marginBottom: '40px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    margin: '0 0 4px 0',
    color: '#f8fafc',
  },
  sectionSubtitle: {
    fontSize: '13px',
    color: '#64748b',
    margin: '0 0 16px 0',
  },

  // KPI Cards
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '30px',
  },
  kpiCard: {
    backgroundColor: 'rgba(19, 28, 46, 0.7)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
    padding: '20px',
  },
  kpiCardHighlight: {
    backgroundColor: 'rgba(26, 16, 31, 0.8)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '14px',
    padding: '20px',
  },
  kpiLabel: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kpiLabelHighlight: {
    fontSize: '12px',
    color: '#fca5a5',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  kpiValueContainer: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    marginTop: '8px',
    marginBottom: '6px',
    flexWrap: 'wrap',
  },
  kpiValue: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#f8fafc',
  },
  kpiValueHighlight: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#ef4444',
  },
  kpiBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#cbd5e1',
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '6px',
    fontWeight: '600',
  },
  kpiBadgeHighlight: {
    backgroundColor: 'rgba(127, 29, 29, 0.6)',
    color: '#fca5a5',
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '6px',
    fontWeight: '700',
  },
  kpiBadgeBlue: {
    backgroundColor: 'rgba(12, 74, 110, 0.6)',
    color: '#7dd3fc',
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '6px',
    fontWeight: '600',
  },
  kpiSubtext: {
    margin: 0,
    fontSize: '12px',
    color: '#64748b',
  },
  kpiSubtextHighlight: {
    margin: 0,
    fontSize: '12px',
    color: '#f87171',
  },

  // Gráficos
  gridGraficos: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '24px',
  },
  cardGraficoPresentation: {
    backgroundColor: 'rgba(19, 28, 46, 0.75)',
    backdropFilter: 'blur(12px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '20px',
    boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.5)',
  },
  cardGraficoHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '12px',
  },
  cardGraficoTitle: {
    fontSize: '16px',
    fontWeight: '700',
    margin: 0,
    color: '#f8fafc',
  },
  barsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  barRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  barLabelContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
  },
  barLabel: {
    color: '#cbd5e1',
  },
  badgeLider: {
    backgroundColor: 'rgba(69, 10, 10, 0.8)',
    color: '#fca5a5',
    border: '1px solid rgba(153, 27, 27, 0.8)',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  barPercent: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: '600',
  },
  barValue: {
    fontWeight: '800',
    fontSize: '14px',
  },
  barTrack: {
    backgroundColor: 'rgba(11, 18, 32, 0.8)',
    borderRadius: '6px',
    height: '10px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '6px',
    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
  },

  badgeRefinado: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    color: '#34d399',
    border: '1px solid rgba(52, 211, 153, 0.25)',
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 7px',
    borderRadius: '5px',
  },
  badgeBruto: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#94a3b8',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    fontSize: '11px',
    fontWeight: '500',
    padding: '2px 7px',
    borderRadius: '5px',
  },

  // Resumo por Modalidade
  gridCategorias: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginTop: '16px',
  },
  cardCategoria: {
    backgroundColor: 'rgba(19, 28, 46, 0.75)',
    backdropFilter: 'blur(12px)',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '20px',
  },
  cardCategoriaHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  cardCategoriaTitle: {
    fontSize: '15px',
    fontWeight: '700',
    margin: 0,
    color: '#f8fafc',
  },
  metricaDuplaBox: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  listaModalidadesRefinada: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  itemModalidadeRow: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    backgroundColor: 'rgba(11, 18, 32, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.03)',
  },
  itemModalidadeBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    transition: 'width 0.4s ease',
  },
  itemModalidadeNome: {
    position: 'relative',
    zIndex: 1,
    fontSize: '13px',
    color: '#e2e8f0',
    fontWeight: '500',
  },
  itemModalidadeBadge: {
    position: 'relative',
    zIndex: 1,
    fontSize: '11px',
    fontWeight: '700',
    color: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    padding: '2px 8px',
    borderRadius: '12px',
  },

  // Tabela
  tableHeaderContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  searchInput: {
    backgroundColor: 'rgba(19, 28, 46, 0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    padding: '12px 18px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  tableWrapper: {
    backgroundColor: 'rgba(19, 28, 46, 0.5)',
    backdropFilter: 'blur(12px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    overflowX: 'auto',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px',
    minWidth: '600px',
  },
  th: {
    padding: '16px 20px',
    backgroundColor: 'rgba(11, 18, 32, 0.95)',
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '14px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
    whiteSpace: 'nowrap',
  },
  btnVerFichaSutil: {
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: '600',
    opacity: 0.8,
  },

  badgeCurso: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#e2e8f0',
    fontSize: '11px',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  badgeTurnoNoturno: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    color: '#818cf8',
    border: '1px solid rgba(129, 140, 248, 0.35)',
    fontSize: '11px',
    fontWeight: '600',
    padding: '4px 10px',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  badgeTurnoMatutino: {
    backgroundColor: 'rgba(161, 98, 7, 0.2)',
    color: '#fde047',
    border: '1px solid rgba(234, 179, 8, 0.3)',
    fontSize: '11px',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  linkWhatsapp: {
    color: '#cbd5e1',
    fontWeight: '500',
    fontSize: '12px',
  },
  badgeModalidade: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    color: '#38bdf8',
    border: '1px solid rgba(56, 189, 248, 0.2)',
    fontSize: '11px',
    fontWeight: '500',
    padding: '3px 7px',
    borderRadius: '5px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  badgeMaisModalidades: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#94a3b8',
    fontSize: '10px',
    fontWeight: '700',
    padding: '3px 6px',
    borderRadius: '5px',
  },
  badgeAlterado: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    color: '#fde047',
    border: '1px solid rgba(234, 179, 8, 0.3)',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  badgeVazio: {
    color: '#475569',
  },

  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modalCard: {
    backgroundColor: '#131c2e',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '20px',
    padding: '24px',
    width: '580px',
    maxWidth: '100%',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
    boxSizing: 'border-box',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '16px',
  },
  carimboSutil: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: '500',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  btnClose: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '20px',
    cursor: 'pointer',
  },
  modalGridInfo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '14px',
    backgroundColor: '#0b1220',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  labelInfo: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '700',
    display: 'block',
    marginBottom: '2px',
  },
  valInfo: {
    margin: 0,
    fontSize: '14px',
    color: '#cbd5e1',
    fontWeight: '600',
  },
  modalCampoBox: {
    backgroundColor: '#0b1220',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.04)',
  },
  modalCampoTitulo: {
    fontSize: '11px',
    color: '#94a3b8',
    display: 'block',
    marginBottom: '4px',
    fontWeight: '500',
  },
};
