// =====================================================
// SCRIPT.JS — TaskFlow v2 (Revisado e Expandido)
// =====================================================
// Índice:
//  1. Constantes e configuração
//  2. Captura dos elementos do HTML
//  3. Estado da aplicação
//  4. Persistência (localStorage)
//  5. Funções de dados (CRUD)
//  6. Renderização
//  7. Histórico global
//  8. Modal de detalhes
//  9. Filtros
//  10. Eventos
//  11. Inicialização
// =====================================================


// ── 1. CONSTANTES E CONFIGURAÇÃO ───────────────────

// Mapeamento de valores internos para textos legíveis
// MELHORIA: movido para fora de qualquer loop/função — criado uma vez, reutilizado sempre
const TEXTO_PRIORIDADE = {
  alta:  "Alta",
  media: "Média",
  baixa: "Baixa",
};

// Chave usada para salvar/ler dados no localStorage
const CHAVE_STORAGE    = "taskflow_tarefas";
const CHAVE_HISTORICO  = "taskflow_historico";


// ── 2. CAPTURA DOS ELEMENTOS DO HTML ───────────────

const inputTarefa         = document.getElementById("inputTarefa");
const inputPrazo          = document.getElementById("inputPrazo");
const seletorPrioridade   = document.getElementById("seletorPrioridade");
const btnAdicionar        = document.getElementById("btnAdicionar");
const listaTarefas        = document.getElementById("listaTarefas");
const estadoVazio         = document.getElementById("estadoVazio");
const totalTarefasEl      = document.getElementById("totalTarefas");
const tarefasConcluidasEl = document.getElementById("tarefasConcluidas");
const tarefasVencidasEl   = document.getElementById("tarefasVencidas");
const progressoBarra      = document.getElementById("progressoBarra");
const textoProgressoEl    = document.getElementById("textoProgresso");
const percentualEl        = document.getElementById("percentualProgresso");
const btnHistorico        = document.getElementById("btnHistorico");
const painelHistorico     = document.getElementById("painelHistorico");
const listaHistorico      = document.getElementById("listaHistorico");
const historicoVazioEl    = document.getElementById("historicoVazio");
const btnFecharHistorico  = document.getElementById("btnFecharHistorico");
const modalDetalhe        = document.getElementById("modalDetalhe");
const modalTitulo         = document.getElementById("modalTitulo");
const modalConteudo       = document.getElementById("modalConteudo");
const btnFecharModal      = document.getElementById("btnFecharModal");
const botoesFiltro        = document.querySelectorAll(".btn-filtro");


// ── 3. ESTADO DA APLICAÇÃO ─────────────────────────

// Carrega os dados salvos no navegador (ou começa do zero)
let tarefas      = carregarDoStorage(CHAVE_STORAGE)   || [];
let historicoGlobal = carregarDoStorage(CHAVE_HISTORICO) || [];
let proximoId    = tarefas.length > 0
  ? Math.max(...tarefas.map(t => t.id)) + 1
  : 1;

// Filtro atual selecionado
let filtroAtivo = "todas";

// Controle de confirmação de exclusão (dois cliques para deletar)
// Guarda o id da tarefa que está aguardando confirmação
let idAguardandoConfirmacao = null;
let timerConfirmacao        = null;


// ── 4. PERSISTÊNCIA (localStorage) ────────────────
// MELHORIA: dados sobrevivem ao recarregar a página

// Salva qualquer valor no localStorage como texto JSON
function salvarNoStorage(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch (e) {
    console.warn("Erro ao salvar no localStorage:", e);
  }
}

// Lê e converte de volta para objeto/array JavaScript
function carregarDoStorage(chave) {
  try {
    const item = localStorage.getItem(chave);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.warn("Erro ao carregar do localStorage:", e);
    return null;
  }
}

// Salva o estado atual das tarefas e do histórico
function persistir() {
  salvarNoStorage(CHAVE_STORAGE, tarefas);
  salvarNoStorage(CHAVE_HISTORICO, historicoGlobal);
}


// ── 5. FUNÇÕES DE DADOS (CRUD) ─────────────────────
// CRUD = Create, Read, Update, Delete (criar, ler, atualizar, deletar)

// ── FUNÇÃO: Adicionar tarefa ──
function adicionarTarefa() {
  const texto = inputTarefa.value.trim();

  // MELHORIA: feedback visual de erro com animação de shake (classe definida no CSS agora)
  if (texto === "") {
    inputTarefa.classList.add("erro");
    setTimeout(() => inputTarefa.classList.remove("erro"), 400);
    inputTarefa.focus();
    return;
  }

  const agora = new Date();

  // Objeto da nova tarefa
  // MELHORIA: inclui criadoEm, prazo e historico de alterações
  const novaTarefa = {
    id:        proximoId,
    texto:     texto,
    prioridade: seletorPrioridade.value,
    concluida: false,
    criadoEm:  agora.toISOString(),   // ISO 8601: formato universal de data/hora
    prazo:     inputPrazo.value || null, // null se o usuário não preencheu o prazo
    historico: [                        // MELHORIA: log de alterações por tarefa
      criarEventoHistorico("Tarefa criada")
    ],
  };

  proximoId++;
  tarefas.unshift(novaTarefa); // unshift = adiciona no início do array

  // Registra no histórico global
  registrarHistoricoGlobal(`Tarefa adicionada: "${texto}"`);

  // Limpa os campos do formulário
  inputTarefa.value = "";
  inputPrazo.value  = "";
  inputTarefa.focus();

  persistir();
  renderizarLista();
}


// ── FUNÇÃO: Alternar conclusão ──
function alternarConclusao(id) {
  const tarefa = tarefas.find(t => t.id === id);
  if (!tarefa) return;

  tarefa.concluida = !tarefa.concluida;

  // Registra a alteração no histórico da própria tarefa
  const acao = tarefa.concluida ? "Marcada como concluída" : "Reaberta";
  tarefa.historico.push(criarEventoHistorico(acao));

  registrarHistoricoGlobal(`${acao}: "${tarefa.texto}"`);

  persistir();
  renderizarLista();
}


// ── FUNÇÃO: Remover tarefa com confirmação em dois cliques ──
// MELHORIA: evita exclusões acidentais
function removerTarefa(id, btnElement) {
  if (idAguardandoConfirmacao === id) {
    // Segundo clique: confirma a exclusão
    clearTimeout(timerConfirmacao);
    idAguardandoConfirmacao = null;

    const tarefa = tarefas.find(t => t.id === id);
    const textoTarefa = tarefa ? tarefa.texto : "";

    tarefas = tarefas.filter(t => t.id !== id);
    registrarHistoricoGlobal(`Tarefa removida: "${textoTarefa}"`);

    persistir();
    renderizarLista();
  } else {
    // Primeiro clique: pede confirmação
    // Cancela qualquer confirmação pendente anterior
    if (idAguardandoConfirmacao !== null) {
      renderizarLista(); // redesenha para resetar o botão anterior
    }

    idAguardandoConfirmacao = id;
    btnElement.textContent  = "Confirmar?";
    btnElement.classList.add("confirmar");

    // Se o usuário não confirmar em 3 segundos, cancela
    timerConfirmacao = setTimeout(() => {
      idAguardandoConfirmacao = null;
      renderizarLista();
    }, 3000);
  }
}


// ── FUNÇÃO: Editar tarefa inline ──
// MELHORIA: duplo clique no texto permite editar sem recriar a tarefa
function iniciarEdicao(id, spanElement) {
  const tarefa = tarefas.find(t => t.id === id);
  if (!tarefa || tarefa.concluida) return; // Não edita tarefa concluída

  // Cria um input temporário com o texto atual
  const input = document.createElement("input");
  input.type      = "text";
  input.className = "input-edicao";
  input.value     = tarefa.texto;
  input.maxLength = 120;

  // Substitui o <span> pelo <input>
  spanElement.replaceWith(input);
  input.focus();
  input.select(); // Seleciona todo o texto para facilitar a edição

  // Salva ao pressionar Enter ou ao sair do campo (blur)
  function salvarEdicao() {
    const novoTexto = input.value.trim();

    if (novoTexto && novoTexto !== tarefa.texto) {
      const textoAnterior = tarefa.texto;
      tarefa.texto = novoTexto;
      tarefa.historico.push(
        criarEventoHistorico(`Texto editado: "${textoAnterior}" → "${novoTexto}"`)
      );
      registrarHistoricoGlobal(`Tarefa editada: "${novoTexto}"`);
      persistir();
    }

    renderizarLista(); // Redesenha para mostrar o span novamente
  }

  input.addEventListener("keydown", e => {
    if (e.key === "Enter")  salvarEdicao();
    if (e.key === "Escape") renderizarLista(); // Cancela a edição
  });

  input.addEventListener("blur", salvarEdicao);
}


// ── FUNÇÃO: Criar evento de histórico ──
// Retorna um objeto padronizado para os logs
function criarEventoHistorico(descricao) {
  return {
    hora:      new Date().toISOString(),
    descricao: descricao,
  };
}


// ── 6. RENDERIZAÇÃO ────────────────────────────────
// Transforma o array de dados em HTML visível

function renderizarLista() {
  listaTarefas.innerHTML = "";

  // Aplica o filtro atual
  const tarefasFiltradas = aplicarFiltro(tarefas, filtroAtivo);

  if (tarefas.length === 0) {
    estadoVazio.classList.remove("escondido");
    atualizarContadores();
    atualizarProgresso();
    return;
  }

  estadoVazio.classList.add("escondido");

  tarefasFiltradas.forEach(tarefa => {
    const li = document.createElement("li");

    // Verifica se o prazo está vencido
    const vencida = estaVencida(tarefa);

    // Classes do item
    li.className = [
      "item-tarefa",
      `prioridade-${tarefa.prioridade}`,
      tarefa.concluida ? "concluida" : "",
      vencida && !tarefa.concluida ? "vencida" : "",
    ].filter(Boolean).join(" ");

    // ── Checkbox ──
    const checkbox = document.createElement("input");
    checkbox.type    = "checkbox";
    checkbox.checked = tarefa.concluida;
    checkbox.setAttribute("aria-label", `Marcar "${tarefa.texto}" como concluída`);
    checkbox.addEventListener("change", () => alternarConclusao(tarefa.id));

    // ── Corpo central ──
    const corpo = document.createElement("div");
    corpo.className = "tarefa-corpo";

    // Texto da tarefa — MELHORIA: usa textContent (seguro contra XSS)
    const spanTexto = document.createElement("span");
    spanTexto.className   = "texto-tarefa";
    spanTexto.textContent = tarefa.texto; // textContent é seguro!
    spanTexto.title       = "Duplo clique para editar";
    spanTexto.addEventListener("dblclick", () => iniciarEdicao(tarefa.id, spanTexto));

    // Metadados (data de criação e prazo)
    const meta = document.createElement("div");
    meta.className = "tarefa-meta";

    // Data de criação formatada
    const spanCriacao = document.createElement("span");
    spanCriacao.className   = "meta-item";
    spanCriacao.textContent = `🕐 ${formatarData(tarefa.criadoEm)}`;

    meta.appendChild(spanCriacao);

    // Prazo, se existir
    if (tarefa.prazo) {
      const spanPrazo = document.createElement("span");
      spanPrazo.className = `meta-item${vencida && !tarefa.concluida ? " vencida" : ""}`;
      const prefixo = vencida && !tarefa.concluida ? "⚠️ Venceu" : "📅 Prazo";
      spanPrazo.textContent = `${prefixo}: ${formatarData(tarefa.prazo)}`;
      meta.appendChild(spanPrazo);
    }

    corpo.appendChild(spanTexto);
    corpo.appendChild(meta);

    // ── Ações (direita) ──
    const acoes = document.createElement("div");
    acoes.className = "tarefa-acoes";

    // Badge de prioridade
    const badge = document.createElement("span");
    badge.className   = "badge-prioridade";
    badge.textContent = TEXTO_PRIORIDADE[tarefa.prioridade];

    // Grupo de botões
    const grupoBotoes = document.createElement("div");
    grupoBotoes.className = "grupo-botoes";

    // Botão de detalhes/histórico
    const btnInfo = document.createElement("button");
    btnInfo.className = "btn-acao info";
    btnInfo.textContent = "📋";
    btnInfo.title = "Ver detalhes e histórico";
    btnInfo.setAttribute("aria-label", "Ver detalhes da tarefa");
    btnInfo.addEventListener("click", () => abrirModal(tarefa.id));

    // Botão de remover
    const btnRemover = document.createElement("button");
    btnRemover.className = "btn-acao remover";
    btnRemover.textContent = "✕";
    btnRemover.title = "Remover tarefa";
    btnRemover.setAttribute("aria-label", "Remover tarefa");
    // Passa o próprio botão para a função para poder alterar seu texto
    btnRemover.addEventListener("click", () => removerTarefa(tarefa.id, btnRemover));

    grupoBotoes.appendChild(btnInfo);
    grupoBotoes.appendChild(btnRemover);

    acoes.appendChild(badge);
    acoes.appendChild(grupoBotoes);

    // Monta o item
    li.appendChild(checkbox);
    li.appendChild(corpo);
    li.appendChild(acoes);

    listaTarefas.appendChild(li);
  });

  atualizarContadores();
  atualizarProgresso();
}


// ── FUNÇÃO: Atualizar contadores ──
function atualizarContadores() {
  const total     = tarefas.length;
  const concluidas = tarefas.filter(t => t.concluida).length;
  const vencidas   = tarefas.filter(t => estaVencida(t) && !t.concluida).length;

  totalTarefasEl.textContent      = `${total} ${total === 1 ? "tarefa" : "tarefas"}`;
  tarefasConcluidasEl.textContent = `${concluidas} ${concluidas === 1 ? "concluída" : "concluídas"}`;
  tarefasVencidasEl.textContent   = `${vencidas} ${vencidas === 1 ? "vencida" : "vencidas"}`;

  // Mostra/esconde o contador de vencidas
  tarefasVencidasEl.classList.toggle("zero", vencidas === 0);
}


// ── FUNÇÃO: Atualizar barra de progresso ──
function atualizarProgresso() {
  const total      = tarefas.length;
  const concluidas = tarefas.filter(t => t.concluida).length;
  const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  progressoBarra.style.width     = `${percentual}%`;
  percentualEl.textContent       = `${percentual}%`;
  textoProgressoEl.textContent   = `${concluidas} de ${total} concluídas`;
}


// ── 7. HISTÓRICO GLOBAL ────────────────────────────

// Registra uma ação no log global
function registrarHistoricoGlobal(descricao) {
  historicoGlobal.unshift(criarEventoHistorico(descricao));

  // Mantém no máximo 50 registros para não ficar pesado
  if (historicoGlobal.length > 50) {
    historicoGlobal = historicoGlobal.slice(0, 50);
  }

  // Atualiza o painel se estiver aberto
  if (!painelHistorico.classList.contains("escondido")) {
    renderizarHistoricoGlobal();
  }
}

// Renderiza o painel de histórico global
function renderizarHistoricoGlobal() {
  listaHistorico.innerHTML = "";

  if (historicoGlobal.length === 0) {
    historicoVazioEl.classList.remove("escondido");
    return;
  }

  historicoVazioEl.classList.add("escondido");

  historicoGlobal.forEach(evento => {
    const li = document.createElement("li");
    li.className = "item-historico";

    const hora = document.createElement("span");
    hora.className   = "historico-hora";
    hora.textContent = formatarHora(evento.hora);

    const desc = document.createElement("span");
    desc.textContent = evento.descricao; // textContent: seguro!

    li.appendChild(hora);
    li.appendChild(desc);
    listaHistorico.appendChild(li);
  });
}


// ── 8. MODAL DE DETALHES ───────────────────────────

function abrirModal(id) {
  const tarefa = tarefas.find(t => t.id === id);
  if (!tarefa) return;

  modalTitulo.textContent = "Detalhes da Tarefa";
  modalConteudo.innerHTML = ""; // Limpa conteúdo anterior

  // Função auxiliar para criar linhas de detalhe
  function criarLinha(label, valor) {
    const linha = document.createElement("div");
    linha.className = "modal-linha";

    const lb = document.createElement("span");
    lb.className   = "modal-label";
    lb.textContent = label;

    const vl = document.createElement("span");
    vl.className   = "modal-valor";
    vl.textContent = valor; // textContent: seguro!

    linha.appendChild(lb);
    linha.appendChild(vl);
    return linha;
  }

  // Adiciona as informações da tarefa
  modalConteudo.appendChild(criarLinha("Tarefa",     tarefa.texto));
  modalConteudo.appendChild(criarLinha("Prioridade", TEXTO_PRIORIDADE[tarefa.prioridade]));
  modalConteudo.appendChild(criarLinha("Status",     tarefa.concluida ? "✅ Concluída" : "⏳ Pendente"));
  modalConteudo.appendChild(criarLinha("Criada em",  formatarDataCompleta(tarefa.criadoEm)));

  if (tarefa.prazo) {
    const vencida = estaVencida(tarefa);
    const labelPrazo = vencida && !tarefa.concluida ? "⚠️ Prazo (vencido)" : "Prazo";
    modalConteudo.appendChild(criarLinha(labelPrazo, formatarDataCompleta(tarefa.prazo)));
  }

  // Histórico de alterações da tarefa
  const tituloHistorico = document.createElement("p");
  tituloHistorico.className   = "modal-historico-titulo";
  tituloHistorico.textContent = "Histórico de alterações";
  modalConteudo.appendChild(tituloHistorico);

  const listaH = document.createElement("ul");
  listaH.className = "modal-historico-lista";

  // Mostra do mais recente para o mais antigo
  [...tarefa.historico].reverse().forEach(evento => {
    const item = document.createElement("li");
    item.className = "modal-historico-item";

    const hora = document.createElement("span");
    hora.className   = "modal-historico-hora";
    hora.textContent = formatarHora(evento.hora);

    const desc = document.createElement("span");
    desc.textContent = evento.descricao;

    item.appendChild(hora);
    item.appendChild(desc);
    listaH.appendChild(item);
  });

  modalConteudo.appendChild(listaH);

  // Exibe o modal
  modalDetalhe.classList.remove("escondido");
  document.body.style.overflow = "hidden"; // Impede scroll da página de fundo
}

function fecharModal() {
  modalDetalhe.classList.add("escondido");
  document.body.style.overflow = "";
}


// ── 9. FILTROS ─────────────────────────────────────

// Retorna apenas as tarefas que correspondem ao filtro ativo
function aplicarFiltro(lista, filtro) {
  switch (filtro) {
    case "ativas":    return lista.filter(t => !t.concluida);
    case "concluidas": return lista.filter(t => t.concluida);
    case "alta":      return lista.filter(t => t.prioridade === "alta");
    case "media":     return lista.filter(t => t.prioridade === "media");
    case "baixa":     return lista.filter(t => t.prioridade === "baixa");
    default:          return lista; // "todas"
  }
}


// ── FUNÇÕES UTILITÁRIAS ─────────────────────────────

// Verifica se o prazo de uma tarefa já passou
function estaVencida(tarefa) {
  if (!tarefa.prazo || tarefa.concluida) return false;
  return new Date(tarefa.prazo) < new Date();
}

// Formata ISO string para "dd/mm/aaaa hh:mm"
function formatarData(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  const dia  = String(d.getDate()).padStart(2, "0");
  const mes  = String(d.getMonth() + 1).padStart(2, "0");
  const ano  = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, "0");
  const min  = String(d.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${ano} ${hora}:${min}`;
}

// Formata apenas a hora para o histórico: "hh:mm:ss"
function formatarHora(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// Formata data completa com dia da semana
function formatarDataCompleta(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleString("pt-BR", {
    weekday: "short",
    day:     "2-digit",
    month:   "short",
    year:    "numeric",
    hour:    "2-digit",
    minute:  "2-digit",
  });
}


// ── 10. EVENTOS ────────────────────────────────────

// Botão Adicionar
btnAdicionar.addEventListener("click", adicionarTarefa);

// Tecla Enter no campo de texto
inputTarefa.addEventListener("keydown", e => {
  if (e.key === "Enter") adicionarTarefa();
});

// Botão do painel de histórico (abre/fecha)
btnHistorico.addEventListener("click", () => {
  const aberto = !painelHistorico.classList.contains("escondido");
  if (aberto) {
    painelHistorico.classList.add("escondido");
    btnHistorico.classList.remove("ativo");
  } else {
    painelHistorico.classList.remove("escondido");
    btnHistorico.classList.add("ativo");
    renderizarHistoricoGlobal();
  }
});

// Fechar painel de histórico
btnFecharHistorico.addEventListener("click", () => {
  painelHistorico.classList.add("escondido");
  btnHistorico.classList.remove("ativo");
});

// Fechar modal
btnFecharModal.addEventListener("click", fecharModal);

// Fechar modal ao clicar fora da caixa (no overlay escuro)
modalDetalhe.addEventListener("click", e => {
  if (e.target === modalDetalhe) fecharModal();
});

// Fechar modal com Escape
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !modalDetalhe.classList.contains("escondido")) {
    fecharModal();
  }
});

// Filtros
botoesFiltro.forEach(btn => {
  btn.addEventListener("click", () => {
    // Remove classe "ativo" de todos os botões
    botoesFiltro.forEach(b => b.classList.remove("ativo"));
    // Adiciona no botão clicado
    btn.classList.add("ativo");
    // Atualiza o filtro e redesenha
    filtroAtivo = btn.dataset.filtro;
    renderizarLista();
  });
});


// ── 11. INICIALIZAÇÃO ──────────────────────────────
// Executado uma vez quando a página carrega

renderizarLista();