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

const ICONES_MODALIDADES = {
  'Vôlei': '🏐',
  'Futsal': '⚽',
  'Futebol de Campo': '⚽',
  'Basquete': '🏀',
  'Handebol': '🤾',
  'Beach Tennis': '🎾',
  'Atletismo': '🏃',
  'Queimada': '🔥',
  'Futvolei': '🏐',
  'Futebol Society (Fut 7)': '⚽',
  'Xadrez': '♟️',
  'Tênis de mesa': '🏓',
  'Damas': '🏁',
  'Poker': '♠️',
  'Truco': '🃏',
  'Sinuca': '🎱',
  'Judô': '🥋',
  'Valorant': '🎯',
  'EA FC (FIFA)': '🎮',
  'Counter Strike': '💣',
  'League of Legends': '⚔️',
  'Fortnite': '🪂',
  'Rocket League': '🚗',
  'Mortal Kombat': '🥊',
  'Dota': '🛡️',
  'Marvel Rivals': '🦸',
  'PUBG: BATTLEGROUNDS': '🪖',
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
    return (
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {itens.slice(0, 3).map((item, idx) => {
          const icone = ICONES_MODALIDADES[item] || '🏆';
          return (
            <span key={idx} style={styles.badgeModalidade}>
              {icone} {item}
            </span>
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
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState('Futsal');
  const [qtdTimes, setQtdTimes] = useState(1); // Padrão: 1 time
  const [timeAtivoAbas, setTimeAtivoAbas] = useState(0); // Índice do time sendo editado manualmente
  const [timesEscalados, setTimesEscalados] = useState({ 0: [], 1: [], 2: [] });
  const [nomesTimes, setNomesTimes] = useState({ 0: 'Time A', 1: 'Time B', 2: 'Time C' });
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

          setDados(dadosTratados);
          setColunas(Object.keys(dadosTratados[0]));

          const categorias = {};
          dadosTratados.forEach((atleta) => {
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
  const colEsportes = colunas.find(c => c.toLowerCase().includes('esportes') || c.toLowerCase().includes('jogos'));
  const colCarimbo = colunas.find(c => c.toLowerCase().includes('carimbo') || c.toLowerCase().includes('data'));

  // Variáveis para a aba de Montagem de Times
  const listaModalidadesUnicas = Object.values(estatisticas).flatMap(cat => Object.keys(cat.itens));

  const atletasDaModalidade = dados.filter(atleta => {
    if (!colEsportes || !atleta[colEsportes]) return false;
    return atleta[colEsportes].toLowerCase().includes(modalidadeSelecionada.toLowerCase());
  });

  // Retorna em qual time o atleta está escalado (-1 se em nenhum)
  const getIndexTimeAtleta = (nomeAtleta) => {
    for (let i = 0; i < qtdTimes; i++) {
      if (timesEscalados[i]?.some(a => a.nome === nomeAtleta)) {
        return i;
      }
    }
    return -1;
  };

  // Alterna a presença do atleta no time atualmente selecionado
  const toggleAtletaNoTime = (atleta, timeTargetIdx = timeAtivoAbas) => {
    const timeIndexAtual = getIndexTimeAtleta(atleta.nome);
    
    setTimesEscalados(prev => {
      const novostimes = { ...prev };
      
      // Se já estava em outro time, remove de lá primeiro
      if (timeIndexAtual !== -1) {
        novostimes[timeIndexAtual] = novostimes[timeIndexAtual].filter(a => a.nome !== atleta.nome);
      }

      // Se não estava neste time alvo, adiciona
      if (timeIndexAtual !== timeTargetIdx) {
        novostimes[timeTargetIdx] = [...(novostimes[timeTargetIdx] || []), atleta];
      }

      return novostimes;
    });
  };

  // Sorteio Randomico de Atletas entre os times ativos
  const sortearTimesRandom = () => {
    if (atletasDaModalidade.length === 0) return;

    // Embaralha a lista de atletas (Fisher-Yates Shuffle)
    const embaralhados = [...atletasDaModalidade].map(a => ({
      nome: a[colNome] || '-',
      whats: a[colWhats] || '-',
      curso: a[colCurso] || '-'
    })).sort(() => Math.random() - 0.5);

    const novosTimes = { 0: [], 1: [], 2: [] };

    // Distribui ciclicamente entre a quantidade de times configurada
    embaralhados.forEach((atleta, index) => {
      const timeDestino = index % qtdTimes;
      novosTimes[timeDestino].push(atleta);
    });

    setTimesEscalados(novosTimes);
  };

  // Limpa todos os times escalados
  const limparEscalacao = () => {
    setTimesEscalados({ 0: [], 1: [], 2: [] });
  };

  // Formata e copia o texto de todos os times para o WhatsApp
  const copiarEscalacaoWhatsApp = () => {
    let texto = `🏆 *ESCALAÇÃO - ${modalidadeSelecionada.toUpperCase()}*\n`;
    texto += `-------------------------------\n`;

    for (let i = 0; i < qtdTimes; i++) {
      const timeList = timesEscalados[i] || [];
      const nomeDoTime = nomesTimes[i] || `Time ${i + 1}`;
      
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
    <div style={styles.appContainer}>
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
      `}</style>

      <div className="glow-orb-1" />
      <div className="glow-orb-2" />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <header style={styles.header}>
          <div>
            <span style={styles.badgeHeader}>A.A.A.F.R.P. • Apresentação de Dados</span>
            <h1 style={styles.title}>Relatório Geral de Atletas & Modalidades</h1>
          </div>
          
          <div style={styles.navTabs}>
            <button 
              onClick={() => setAbaAtiva('graficos')} 
              style={abaAtiva === 'graficos' ? styles.tabActive : styles.tabInactive}
            >
              📊 Apresentação (Gráficos)
            </button>
            <button 
              onClick={() => setAbaAtiva('geral')} 
              style={abaAtiva === 'geral' ? styles.tabActive : styles.tabInactive}
            >
              📋 Resumo por Modalidade
            </button>
            <button 
              onClick={() => setAbaAtiva('tabela')} 
              style={abaAtiva === 'tabela' ? styles.tabActive : styles.tabInactive}
            >
              🗃️ Tabela Completa
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
            <div style={styles.kpiGrid}>
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
                    {ICONES_MODALIDADES[topGeral.nome] || '🏆'} {topGeral.nome}
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

            <div style={styles.gridGraficos}>
              {Object.entries(estatisticas).map(([categoriaNome, dataObj], idx) => {
                const listaItens = dataObj.itens;
                const maxQtd = Math.max(...Object.values(listaItens));
                const totalCategoria = Object.values(listaItens).reduce((a, b) => a + b, 0);

                return (
                  <div key={idx} style={styles.cardGraficoPresentation}>
                    <div style={styles.cardGraficoHeader}>
                      <div>
                        <h3 style={styles.cardGraficoTitle}>{categoriaNome}</h3>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
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
                          const icone = ICONES_MODALIDADES[itemNome] || '🏆';

                          return (
                            <div key={i} style={styles.barRow}>
                              <div style={styles.barLabelContainer}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ ...styles.barLabel, fontWeight: isLider ? '700' : '500', color: isLider ? '#f8fafc' : '#cbd5e1' }}>
                                    {icone} {itemNome}
                                  </span>
                                  {isLider && <span style={styles.badgeLider}>👑 1º Lugar</span>}
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

            <div style={styles.gridCategorias}>
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
                          const icone = ICONES_MODALIDADES[itemNome] || '🏆';

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
            <div style={styles.tableHeaderContainer}>
              <div>
                <h2 style={styles.sectionTitle}>Base Geral de Atletas</h2>
                <p style={styles.sectionSubtitle}>
                  Clique em qualquer linha para abrir a ficha individual • Exibindo <strong style={{ color: '#ef4444' }}>{dadosFiltrados.length}</strong> de {dados.length}
                </p>
              </div>
              
              <input
                type="text"
                placeholder="🔍 Pesquisar por nome, curso, WhatsApp..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                style={styles.searchInput}
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
                    {colEsportes && <th style={styles.th}>Modalidades Selecionadas</th>}
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
                        {linha[colNome] || '-'}
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

                      {colEsportes && (
                        <td style={styles.td}>
                          {renderizarCelulaSimplificada(linha[colEsportes], colEsportes)}
                        </td>
                      )}

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
            
            {/* BARRA SUPERIOR DE CONFIGURAÇÃO DE TIMES */}
            <div style={{ ...styles.cardGraficoPresentation, marginBottom: '20px', padding: '16px 24px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                
                {/* Seleção de Modalidade */}
                <div style={{ flex: '1 1 240px' }}>
                  <label style={{ ...styles.labelInfo, marginBottom: '6px' }}>Modalidade / Jogo</label>
                  <select 
                    value={modalidadeSelecionada} 
                    onChange={(e) => {
                      setModalidadeSelecionada(e.target.value);
                      limparEscalacao();
                    }}
                    style={{ ...styles.searchInput, width: '100%', cursor: 'pointer', backgroundColor: '#0b1220' }}
                  >
                    {listaModalidadesUnicas.map((mod, i) => (
                      <option key={i} value={mod} style={{ backgroundColor: '#0f172a' }}>
                        {ICONES_MODALIDADES[mod] || '🏆'} {mod}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Seleção da Quantidade de Times (1, 2 ou 3) */}
                <div>
                  <label style={{ ...styles.labelInfo, marginBottom: '6px' }}>Quantidade de Times</label>
                  <div style={styles.navTabs}>
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        onClick={() => {
                          setQtdTimes(num);
                          if (timeAtivoAbas >= num) setTimeAtivoAbas(0);
                        }}
                        style={qtdTimes === num ? styles.tabActive : styles.tabInactive}
                      >
                        {num} {num === 1 ? 'Time' : 'Times'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Botão de Sorteio Randômico e Limpar */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginTop: '18px' }}>
                  <button
                    onClick={sortearTimesRandom}
                    style={{
                      ...styles.tabActive,
                      backgroundColor: '#8b5cf6',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    🎲 Sortear Random
                  </button>
                  <button
                    onClick={limparEscalacao}
                    style={{
                      ...styles.tabInactive,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ef4444'
                    }}
                  >
                    Limpar
                  </button>
                </div>

              </div>
            </div>

            {/* PAINEL PRINCIPAL */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              
              {/* Coluna Esquerda: Lista de Atletas Inscritos */}
              <div style={styles.cardGraficoPresentation}>
                <div style={styles.cardGraficoHeader}>
                  <div>
                    <h3 style={styles.cardGraficoTitle}>Atletas Inscritos ({atletasDaModalidade.length})</h3>
                    <p style={{ ...styles.kpiSubtext, marginTop: '4px' }}>
                      Adicionando no: <strong style={{ color: '#38bdf8' }}>{nomesTimes[timeAtivoAbas]}</strong>
                    </p>
                  </div>
                </div>

                {/* Lista de Atletas do Jogo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                  {atletasDaModalidade.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                      Nenhum atleta inscrito nesta modalidade.
                    </p>
                  ) : (
                    atletasDaModalidade.map((atleta, idx) => {
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
                              : (timeIndex !== -1 ? `No ${nomesTimes[timeIndex]}` : '+ Adicionar')}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Coluna Direita: Painel de Times e Escalação */}
              <div style={styles.cardGraficoPresentation}>
                
                {/* Abas para Alternar Entre os Times Criados (se qtdTimes > 1) */}
                {qtdTimes > 1 && (
                  <div style={{ ...styles.navTabs, marginBottom: '16px' }}>
                    {Array.from({ length: qtdTimes }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setTimeAtivoAbas(idx)}
                        style={timeAtivoAbas === idx ? styles.tabActive : styles.tabInactive}
                      >
                        {nomesTimes[idx]} ({timesEscalados[idx]?.length || 0})
                      </button>
                    ))}
                  </div>
                )}

                <div style={styles.cardGraficoHeader}>
                  <div>
                    <h3 style={styles.cardGraficoTitle}>Escalação do Time</h3>
                    <span style={styles.badgeRefinado}>
                      {(timesEscalados[timeAtivoAbas] || []).length} selecionados
                    </span>
                  </div>

                  {/* Nome editável do time ativo */}
                  <input 
                    type="text" 
                    value={nomesTimes[timeAtivoAbas] || ''} 
                    onChange={(e) => setNomesTimes({ ...nomesTimes, [timeAtivoAbas]: e.target.value })}
                    style={{ ...styles.searchInput, width: '120px', padding: '6px 10px', fontSize: '12px' }}
                  />
                </div>

                {/* Atletas Escalados no Time Selecionado */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '200px', maxHeight: '350px', overflowY: 'auto', marginBottom: '20px' }}>
                  {(timesEscalados[timeAtivoAbas] || []).length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', margin: 'auto' }}>
                      Nenhum atleta neste time. Adicione manualmente ou use o "🎲 Sortear Random".
                    </p>
                  ) : (
                    (timesEscalados[timeAtivoAbas] || []).map((atleta, idx) => (
                      <div key={idx} style={{ ...styles.itemModalidadeRow, backgroundColor: 'rgba(2, 132, 199, 0.1)' }}>
                        <span style={{ color: '#38bdf8', fontWeight: '700', fontSize: '12px' }}>
                          {idx + 1}. {atleta.nome} ({atleta.curso})
                        </span>
                        <button 
                          onClick={() => toggleAtletaNoTime(atleta, timeAtivoAbas)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Botão Copiar WhatsApp (Copia todos os times ativos juntos) */}
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
                  {copiado ? '✓ Escalação Copiada!' : '📋 Copiar Todos os Times para WhatsApp'}
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
                      colLower.includes('carimbo')
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

// ESTILOS COMPLETO (CSS-in-JS)
const styles = {
  appContainer: {
    backgroundColor: '#070a12',
    color: '#f1f5f9',
    minHeight: '100vh',
    padding: '30px 50px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden',
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
    fontSize: '26px',
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
  },
  kpiValue: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#f8fafc',
  },
  kpiValueHighlight: {
    fontSize: '24px',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
    gap: '24px',
  },
  cardGraficoPresentation: {
    backgroundColor: 'rgba(19, 28, 46, 0.75)',
    backdropFilter: 'blur(12px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '24px',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
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
    width: '320px',
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
  },
  modalCard: {
    backgroundColor: '#131c2e',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '20px',
    padding: '30px',
    width: '580px',
    maxWidth: '90%',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
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
    gridTemplateColumns: '1fr 1fr',
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