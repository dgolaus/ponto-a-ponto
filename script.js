/* =========================================================
   Ponto a Ponto — script.js
   Recursos de acessibilidade e interações da página.

   Índice:
   0. Página começa no topo
   1. Menu de acessibilidade (abre/fecha por botão)
   2. Alto contraste (com memória) — desliga as animações
   3. Tamanho do texto (A− / A+)
   4. Leitura em voz alta (Web Speech API)
   5. Contagem animada dos números
   6. Ilustração do olho: raios, cintilar de cor e reação ao mouse
   7. Cabeçalho: anel de progresso do scroll + estado compacto
   8. Popup "Você é cega ou tem baixa visão?"
   9. Animações de entrada
  10. Restaura preferências salvas

   PARA REUTILIZAR NAS SUB-PÁGINAS: inclua este mesmo arquivo com
   <script src="script.js" defer> e mantenha os mesmos ids/classes
   do cabeçalho. Cada bloco verifica se os elementos existem antes
   de ligar os eventos, então funciona mesmo em páginas sem o olho,
   sem os contadores ou sem o popup.
   ========================================================= */

"use strict";

(function () {
  const raiz = document.documentElement;
  const corpo = document.body;
  const prefereMenosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Avisa o failsafe do script inline (index.html) que o fluxo normal
  // está no controle da revelação do site ("aviso primeiro").
  window.__papPronto = true;

  /* ---------------------------------------------------------
     0. Começar sempre no topo da página
  --------------------------------------------------------- */
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);
  window.addEventListener("load", function () {
    window.scrollTo(0, 0);
  });

  /* ---------------------------------------------------------
     Avisos para leitores de tela (região aria-live)
  --------------------------------------------------------- */
  const regiaoAvisos = document.getElementById("regiao-avisos");

  function anunciar(mensagem) {
    if (!regiaoAvisos) return;
    regiaoAvisos.textContent = "";
    window.setTimeout(function () {
      regiaoAvisos.textContent = mensagem;
    }, 50);
  }

  // Toast visual (o leitor de tela é avisado pela região aria-live acima)
  const elementoToast = document.getElementById("toast");
  let toastTimer = null;

  function mostrarToast(mensagem) {
    if (!elementoToast) return;
    elementoToast.textContent = mensagem;
    elementoToast.classList.add("toast-visivel");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      elementoToast.classList.remove("toast-visivel");
    }, 2600);
  }

  /* ---------------------------------------------------------
     Preferências salvas (try/catch p/ navegação privada)
  --------------------------------------------------------- */
  const CHAVE_CONTRASTE = "pontoaponto-contraste";
  const CHAVE_FONTE = "pontoaponto-fonte";
  const CHAVE_PERGUNTA = "pontoaponto-pergunta-respondida"; // localStorage: não perguntar de novo

  function salvarPreferencia(chave, valor) {
    try { localStorage.setItem(chave, valor); } catch (erro) { /* segue funcionando */ }
  }
  function lerPreferencia(chave) {
    try { return localStorage.getItem(chave); } catch (erro) { return null; }
  }
  function esquecerPreferencia(chave) {
    try { localStorage.removeItem(chave); } catch (erro) { /* segue funcionando */ }
  }

  /* ---------------------------------------------------------
     1. Menu de acessibilidade (botão que abre/fecha o painel)
  --------------------------------------------------------- */
  const btnAcesso = document.getElementById("btn-acesso");
  const painelAcesso = document.getElementById("painel-acesso");

  function abrirAcesso() {
    if (!painelAcesso || !btnAcesso) return;
    painelAcesso.hidden = false;
    btnAcesso.setAttribute("aria-expanded", "true");
  }
  function fecharAcesso(retornarFoco) {
    if (!painelAcesso || !btnAcesso) return;
    painelAcesso.hidden = true;
    btnAcesso.setAttribute("aria-expanded", "false");
    if (retornarFoco) btnAcesso.focus();
  }

  if (btnAcesso && painelAcesso) {
    btnAcesso.addEventListener("click", function () {
      if (painelAcesso.hidden) abrirAcesso();
      else fecharAcesso(false);
    });

    // Fecha ao clicar fora do menu
    document.addEventListener("click", function (evento) {
      if (painelAcesso.hidden) return;
      if (evento.target === btnAcesso || btnAcesso.contains(evento.target)) return;
      if (painelAcesso.contains(evento.target)) return; // clicou num controle: mantém aberto
      fecharAcesso(false);
    });

    // Fecha com Escape (devolvendo o foco ao botão)
    document.addEventListener("keydown", function (evento) {
      if (evento.key === "Escape" && !painelAcesso.hidden) fecharAcesso(true);
    });
  }

  /* ---------------------------------------------------------
     2. Alto contraste (modo baixa visão — página estável)
  --------------------------------------------------------- */
  const btnContraste = document.getElementById("btn-contraste");

  function aplicarContraste(ativo, comAnuncio) {
    corpo.classList.toggle("alto-contraste", ativo);
    if (btnContraste) btnContraste.setAttribute("aria-pressed", String(ativo));
    salvarPreferencia(CHAVE_CONTRASTE, ativo ? "1" : "0");
    if (ativo) {
      estabilizarPagina();      // completa números e revela conteúdo
    }
    sincronizarOlho();          // olho parado/estável no HC, animado fora dele
    if (comAnuncio) {
      const msg = ativo ? "Alto contraste ativado" : "Alto contraste desativado";
      anunciar(msg + ".");
      mostrarToast(msg);
    }
  }

  // No alto contraste nada pode ficar se mexendo.
  function estabilizarPagina() {
    completarContadores();
    document.querySelectorAll("[data-anima]").forEach(function (elemento) {
      elemento.classList.add("visivel");
    });
  }

  if (btnContraste) {
    btnContraste.addEventListener("click", function () {
      aplicarContraste(!corpo.classList.contains("alto-contraste"), true);
    });
  }

  /* ---------------------------------------------------------
     3. Tamanho do texto (rem na raiz → escala a página inteira)
  --------------------------------------------------------- */
  // Base 110% (escala geral do site, combina com o html { font-size } do CSS);
  // o A+ sobe a partir daí e o A− pode voltar até 100%.
  const NIVEIS_FONTE = [100, 110, 122.5, 135, 147.5, 160]; // em %
  const NIVEL_PADRAO = 1; // índice do 110% — a escala normal do site
  const btnAumentar = document.getElementById("btn-aumentar-fonte");
  const btnDiminuir = document.getElementById("btn-diminuir-fonte");
  let indiceFonte = NIVEL_PADRAO;

  function aplicarFonte(indice, comAnuncio) {
    indiceFonte = Math.max(0, Math.min(indice, NIVEIS_FONTE.length - 1));
    raiz.style.fontSize = NIVEIS_FONTE[indiceFonte] + "%";
    salvarPreferencia(CHAVE_FONTE, String(indiceFonte));
    if (btnAumentar) btnAumentar.setAttribute("aria-disabled", String(indiceFonte === NIVEIS_FONTE.length - 1));
    if (btnDiminuir) btnDiminuir.setAttribute("aria-disabled", String(indiceFonte === 0));
    if (comAnuncio) {
      anunciar("Tamanho do texto: nível " + (indiceFonte + 1) + " de " + NIVEIS_FONTE.length + ".");
    }
  }

  if (btnAumentar) {
    btnAumentar.addEventListener("click", function () {
      if (indiceFonte === NIVEIS_FONTE.length - 1) { anunciar("O texto já está no tamanho máximo."); return; }
      aplicarFonte(indiceFonte + 1, true);
    });
  }
  if (btnDiminuir) {
    btnDiminuir.addEventListener("click", function () {
      if (indiceFonte === 0) { anunciar("O texto já está no tamanho mínimo."); return; }
      aplicarFonte(indiceFonte - 1, true);
    });
  }

  /* ---------------------------------------------------------
     4. Leitura em voz alta (Web Speech API)
  --------------------------------------------------------- */
  const btnOuvir = document.getElementById("btn-ouvir");
  const rotuloOuvir = document.getElementById("rotulo-ouvir");
  const suportaLeitura = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  let lendo = false;
  let sessaoLeitura = 0;
  let vozPortugues = null;

  function escolherVoz() {
    const vozes = window.speechSynthesis.getVoices();
    vozPortugues =
      vozes.find(function (v) { return /^pt[-_]br/i.test(v.lang); }) ||
      vozes.find(function (v) { return /^pt/i.test(v.lang); }) ||
      null;
  }

  if (suportaLeitura) {
    escolherVoz();
    window.speechSynthesis.onvoiceschanged = escolherVoz;
  }

  function coletarTrechos() {
    const principal = document.getElementById("conteudo-principal");
    if (!principal) return [];
    const elementos = principal.querySelectorAll("h1, h2, h3, p, figcaption");
    const trechos = [];
    elementos.forEach(function (elemento) {
      if (elemento.closest("[hidden]") || elemento.closest('[aria-hidden="true"]')) return;
      const texto = elemento.textContent.replace(/\s+/g, " ").trim();
      if (texto) trechos.push(texto);
    });
    return trechos;
  }

  function atualizarBotaoOuvir() {
    if (!btnOuvir || !rotuloOuvir) return;
    btnOuvir.setAttribute("aria-pressed", String(lendo));
    rotuloOuvir.textContent = lendo ? "Parar leitura" : "Ouvir esta página";
  }

  function iniciarLeitura() {
    if (!suportaLeitura || lendo) return;
    sessaoLeitura += 1;
    const sessaoAtual = sessaoLeitura;
    window.speechSynthesis.cancel();

    const trechos = coletarTrechos();
    if (trechos.length === 0) return;

    trechos.forEach(function (trecho, posicao) {
      const fala = new SpeechSynthesisUtterance(trecho);
      fala.lang = "pt-BR";
      if (vozPortugues) fala.voice = vozPortugues;
      fala.rate = 1;
      if (posicao === trechos.length - 1) {
        fala.onend = function () {
          if (sessaoAtual === sessaoLeitura) {
            lendo = false;
            atualizarBotaoOuvir();
            anunciar("Leitura concluída.");
          }
        };
      }
      window.speechSynthesis.speak(fala);
    });

    lendo = true;
    atualizarBotaoOuvir();
  }

  function pararLeitura(comAnuncio) {
    if (!suportaLeitura) return;
    sessaoLeitura += 1;
    window.speechSynthesis.cancel();
    if (lendo && comAnuncio) anunciar("Leitura interrompida.");
    lendo = false;
    atualizarBotaoOuvir();
  }

  // Fala um texto específico (usado pelo "Ouvir esta mensagem" do popup)
  function falarTexto(texto) {
    if (!suportaLeitura || !texto) return;
    sessaoLeitura += 1;
    window.speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = "pt-BR";
    if (vozPortugues) fala.voice = vozPortugues;
    fala.rate = 1;
    window.speechSynthesis.speak(fala);
  }

  if (btnOuvir) {
    if (!suportaLeitura) {
      btnOuvir.setAttribute("aria-disabled", "true");
      btnOuvir.title = "Seu navegador não oferece leitura em voz alta.";
    }
    btnOuvir.addEventListener("click", function () {
      if (!suportaLeitura) { anunciar("Seu navegador não oferece leitura em voz alta."); return; }
      if (lendo) pararLeitura(true);
      else iniciarLeitura();
    });
  }

  document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape" && lendo) pararLeitura(true);
  });

  window.addEventListener("pagehide", function () {
    if (suportaLeitura) window.speechSynthesis.cancel();
  });

  /* ---------------------------------------------------------
     5. Contagem animada dos números (.contador)
     Dispara quando o número entra na tela (verificação no
     scroll, à prova de falhas). Sem JS/rAF ou com "reduzir
     movimento", os números mostram o valor final.
  --------------------------------------------------------- */
  const contadores = document.querySelectorAll(".contador");

  function animarContador(elemento) {
    if (elemento.dataset.contado || elemento.dataset.contando) return;
    const bruto = (elemento.getAttribute("data-alvo") || elemento.textContent).trim();
    const temDecimal = bruto.indexOf(",") !== -1;
    const alvo = parseFloat(bruto.replace(",", "."));
    if (isNaN(alvo)) { elemento.dataset.contado = "1"; return; }
    elemento.dataset.contando = "1";
    const DURACAO = 1600;
    let inicio = null;

    function quadro(agora) {
      if (elemento.dataset.contado === "1") return;
      if (inicio === null) inicio = agora;
      const progresso = Math.min((agora - inicio) / DURACAO, 1);
      const suave = 1 - Math.pow(1 - progresso, 3);
      const valor = alvo * suave;
      elemento.textContent = temDecimal ? valor.toFixed(1).replace(".", ",") : String(Math.round(valor));
      if (progresso < 1) {
        window.requestAnimationFrame(quadro);
      } else {
        elemento.textContent = bruto;
        elemento.dataset.contado = "1";
        delete elemento.dataset.contando;
      }
    }
    window.requestAnimationFrame(quadro);
  }

  function completarContadores() {
    contadores.forEach(function (elemento) {
      const bruto = (elemento.getAttribute("data-alvo") || elemento.textContent).trim();
      elemento.textContent = bruto;
      elemento.dataset.contado = "1";
      delete elemento.dataset.contando;
    });
  }

  function zerarContador(elemento) {
    const bruto = (elemento.getAttribute("data-alvo") || elemento.textContent).trim();
    elemento.textContent = bruto.indexOf(",") !== -1 ? "0,0" : "0";
  }

  // "Na tela ou acima": quem pula direto para o fim da página (tecla End)
  // também dispara a contagem — o número nunca fica preso no zero.
  function contadorNaTela(elemento) {
    return elemento.getBoundingClientRect().top < window.innerHeight * 0.9;
  }

  let tickContador = false;

  function verificarContadores() {
    if (raiz.classList.contains("pre-aviso")) return; // espera a resposta ao aviso
    if (corpo.classList.contains("alto-contraste")) {
      completarContadores();
      pararDeOuvirContadores();
      return;
    }
    let pendentes = 0;
    contadores.forEach(function (elemento) {
      if (elemento.dataset.contado === "1" || elemento.dataset.contando === "1") return;
      if (contadorNaTela(elemento)) animarContador(elemento);
      else pendentes += 1;
    });
    if (pendentes === 0) pararDeOuvirContadores();
  }

  function aoRolarContadores() {
    if (tickContador) return;
    tickContador = true;
    window.requestAnimationFrame(function () {
      tickContador = false;
      verificarContadores();
    });
  }

  function pararDeOuvirContadores() {
    window.removeEventListener("scroll", aoRolarContadores);
    window.removeEventListener("resize", aoRolarContadores);
  }

  const podeAnimarNumeros =
    contadores.length > 0 && !prefereMenosMovimento && "requestAnimationFrame" in window;

  if (podeAnimarNumeros && !corpo.classList.contains("alto-contraste")) {
    contadores.forEach(zerarContador);
    window.addEventListener("scroll", aoRolarContadores, { passive: true });
    window.addEventListener("resize", aoRolarContadores);
    verificarContadores();
  }

  /* ---------------------------------------------------------
     6. Olho de partículas (canvas)
     Dezenas de pontos se juntam formando um olho, com raios que
     terminam em pontos. Têm uma vida sutil (deriva) e, ao passar o
     mouse, os pontos perto do cursor ENCOLHEM (e são levemente
     empurrados). No alto contraste e no "reduzir movimento" o olho
     é desenhado uma vez, parado e estável.
  --------------------------------------------------------- */
  const olhoContainer = document.querySelector(".olho-canvas");
  const olhoCanvas = olhoContainer ? olhoContainer.querySelector(".olho-tela") : null;
  let olhoCtx = null;
  let olhoModelo = null;
  let olhoPontos = [];
  let olhoRaiosLinhas = [];
  let olhoLoop = null;
  let olhoPronto = false;
  let olhoW = 0, olhoH = 0, olhoDpr = 1, olhoScale = 0, olhoHoverR = 0;
  const olhoPointer = { x: 0, y: 0, ativo: false, dentro: false };

  function paletaOlho() {
    if (corpo.classList.contains("alto-contraste")) {
      return {
        ambar: "#ffd600", dim: "#ffd600", branco: "#ffffff", cinza: "#ffffff",
        linha: "rgba(255,255,255,0.55)", linhaAcento: "rgba(255,214,0,0.8)"
      };
    }
    return {
      ambar: "#f5b942", dim: "#b98a2f", branco: "#f0f2f7", cinza: "#8a90a0",
      linha: "rgba(160,168,185,0.16)", linhaAcento: "rgba(245,185,66,0.22)"
    };
  }

  // Gera as posições-alvo (normalizadas em -1..1) que formam o olho.
  function gerarModeloOlho() {
    const pontos = [];
    const raios = [];

    function bezier(p0, p1, p2, t) {
      const u = 1 - t;
      return [
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
      ];
    }
    function add(nx, ny, rn, cor, gaze) {
      pontos.push({
        nx: nx, ny: ny, rn: rn, cor: cor,
        gaze: !!gaze, // se true, acompanha o cursor (parte da "íris")
        fase: Math.random() * Math.PI * 2,
        vel: 0.25 + Math.random() * 0.3,
        ampN: 0.0012 + Math.random() * 0.0015 // deriva quase imperceptível
      });
      return pontos.length - 1;
    }

    // Pálpebras (contorno amêndoa) — a superior um tico mais forte
    const AW = 0.92, AH = 0.72, N_LID = 26;
    for (let i = 0; i <= N_LID; i++) {
      const p = bezier([-AW, 0], [0, -AH], [AW, 0], i / N_LID);
      add(p[0], p[1], 0.015, "ambar");
    }
    for (let i = 1; i < N_LID; i++) {
      const p = bezier([AW, 0], [0, AH], [-AW, 0], i / N_LID);
      add(p[0], p[1], 0.013, "ambar");
    }

    // Vinco da pálpebra: arco sutil acima do olho (dá o ar realista)
    const N_VINCO = 20;
    for (let i = 1; i < N_VINCO; i++) {
      const p = bezier([-0.68, -0.3], [0, -0.62], [0.68, -0.3], i / N_VINCO);
      add(p[0], p[1], 0.009, "dim");
    }

    // Íris: anel do limbo (borda) + anel da pupila + FIBRAS radiais.
    // As fibras (raios curtos entre a pupila e a borda) dão a textura
    // real da íris — bem melhor e mais limpo que anéis concêntricos.
    const R_LIMBO = 0.3, R_PUPILA = 0.14;
    const nLimbo = 30;
    for (let i = 0; i < nLimbo; i++) {
      const a = (i / nLimbo) * Math.PI * 2;
      add(Math.cos(a) * R_LIMBO, Math.sin(a) * R_LIMBO, 0.014, "ambar", true);
    }
    const nPup = 16;
    for (let i = 0; i < nPup; i++) {
      const a = (i / nPup) * Math.PI * 2;
      add(Math.cos(a) * R_PUPILA, Math.sin(a) * R_PUPILA, 0.011, "ambar", true);
    }
    const nFibra = 28;
    for (let i = 0; i < nFibra; i++) {
      const a = (i / nFibra) * Math.PI * 2 + (Math.random() - 0.5) * 0.06;
      const externo = 0.25 + Math.random() * 0.03;
      for (let r = R_PUPILA + 0.03; r < externo; r += 0.04) {
        const rr = r + (Math.random() - 0.5) * 0.012;
        add(Math.cos(a) * rr, Math.sin(a) * rr, 0.011, "ambar", true);
      }
    }

    add(0.09, -0.1, 0.022, "branco", true); // brilho (catchlight), acompanha o olhar

    // (Sem "burst": as linhas e pontos externos foram removidos a pedido.)
    return { pontos: pontos, raios: raios };
  }

  function redimensionarOlho() {
    if (!olhoContainer || !olhoCtx) return;
    const rect = olhoContainer.getBoundingClientRect();
    olhoW = rect.width;
    olhoH = rect.height;
    if (!olhoW || !olhoH) return;
    olhoDpr = Math.min(window.devicePixelRatio || 1, 2);
    olhoCanvas.width = Math.round(olhoW * olhoDpr);
    olhoCanvas.height = Math.round(olhoH * olhoDpr);
    olhoCtx.setTransform(olhoDpr, 0, 0, olhoDpr, 0, 0);
    olhoScale = (olhoW / 2) * 0.92;   // baseado na largura (o olho é largo)
    olhoHoverR = olhoW * 0.15;
    const cx = olhoW / 2, cy = olhoH / 2;
    for (let i = 0; i < olhoPontos.length; i++) {
      const m = olhoModelo.pontos[i];
      const p = olhoPontos[i];
      p.hx = cx + m.nx * olhoScale;
      p.hy = cy + m.ny * olhoScale;
      p.rBase = m.rn * olhoScale;
      p.amp = m.ampN * olhoScale;
      if (p.x === undefined) { p.x = p.hx; p.y = p.hy; p.r = p.rBase; }
    }
    if (!olhoLoop) desenharOlho();
  }

  function atualizarOlho(agora) {
    const tempo = agora / 1000;
    const hc = corpo.classList.contains("alto-contraste");
    const cx = olhoW / 2, cy = olhoH / 2;
    // O olhar (a íris) segue o cursor pela página, mas com deslocamento LIMITADO.
    let olharX = 0, olharY = 0;
    if (olhoPointer.ativo && !hc) {
      const maxOlhar = olhoScale * 0.05;
      olharX = Math.max(-1, Math.min(1, (olhoPointer.x - cx) / (olhoW * 0.5))) * maxOlhar;
      olharY = Math.max(-1, Math.min(1, (olhoPointer.y - cy) / (olhoH * 0.5))) * maxOlhar;
    }
    for (let i = 0; i < olhoPontos.length; i++) {
      const p = olhoPontos[i];
      let tx = p.hx + Math.sin(tempo * p.vel + p.fase) * p.amp;      // deriva sutil
      let ty = p.hy + Math.cos(tempo * p.vel * 0.9 + p.fase) * p.amp;
      if (p.gaze) { tx += olharX; ty += olharY; }                    // íris acompanha o olhar
      let ra = p.rBase;
      if (olhoPointer.dentro && !hc) {                               // encolher só quando o mouse está SOBRE o olho
        const ex = p.x - olhoPointer.x;
        const ey = p.y - olhoPointer.y;
        const d = Math.hypot(ex, ey);
        if (d < olhoHoverR) {
          const f = d / olhoHoverR;                 // 0 (colado no cursor) .. 1 (longe)
          ra = p.rBase * (0.4 + 0.6 * f);            // encolhe mais perto do cursor
          const empurra = (1 - f) * olhoHoverR * 0.11;
          if (d > 0.5) { tx += (ex / d) * empurra; ty += (ey / d) * empurra; }
        }
      }
      p.x += (tx - p.x) * 0.1;   // lerp: forma o olho e suaviza a deriva/hover
      p.y += (ty - p.y) * 0.1;
      p.r += (ra - p.r) * 0.22;
    }
  }

  function desenharOlho() {
    if (!olhoCtx || !olhoW) return;
    const cor = paletaOlho();
    olhoCtx.clearRect(0, 0, olhoW, olhoH);
    const cx = olhoW / 2, cy = olhoH / 2;
    olhoCtx.lineWidth = 1;
    for (let i = 0; i < olhoRaiosLinhas.length; i++) {
      const ray = olhoRaiosLinhas[i];
      const p = olhoPontos[ray.i];
      const ox = cx + Math.cos(ray.a) * ray.r1 * olhoScale;
      const oy = cy + Math.sin(ray.a) * ray.r1 * olhoScale;
      olhoCtx.strokeStyle = ray.acento ? cor.linhaAcento : cor.linha;
      olhoCtx.beginPath();
      olhoCtx.moveTo(ox, oy);
      olhoCtx.lineTo(p.x, p.y);
      olhoCtx.stroke();
    }
    // Pontos, cada um com um glow pequeno (desligado no alto contraste,
    // onde a clareza importa mais que o brilho).
    const comGlow = !corpo.classList.contains("alto-contraste");
    for (let i = 0; i < olhoPontos.length; i++) {
      const p = olhoPontos[i];
      if (p.r <= 0.15) continue;
      const c = cor[p.cor] || cor.ambar;
      olhoCtx.fillStyle = c;
      if (comGlow) {
        olhoCtx.shadowColor = c;
        olhoCtx.shadowBlur = p.r * 2.4;
      }
      olhoCtx.beginPath();
      olhoCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      olhoCtx.fill();
    }
    olhoCtx.shadowBlur = 0; // reseta pro próximo quadro / linhas
  }

  function loopOlho(agora) {
    atualizarOlho(agora);
    desenharOlho();
    olhoLoop = window.requestAnimationFrame(loopOlho);
  }
  function pararLoopOlho() {
    if (olhoLoop) { window.cancelAnimationFrame(olhoLoop); olhoLoop = null; }
  }

  // Forma o olho. Estático (alto contraste / reduzir movimento): desenha
  // parado. Animado: espalha os pontos e o loop os junta ("se transformam").
  function formarOlho() {
    if (!olhoPronto) return;
    pararLoopOlho();
    const estatico = prefereMenosMovimento || corpo.classList.contains("alto-contraste");
    if (estatico) {
      for (let i = 0; i < olhoPontos.length; i++) {
        const p = olhoPontos[i];
        p.x = p.hx; p.y = p.hy; p.r = p.rBase;
      }
      desenharOlho();
      return;
    }
    for (let i = 0; i < olhoPontos.length; i++) {
      const p = olhoPontos[i];
      const a = Math.random() * Math.PI * 2;
      const rad = Math.min(olhoW, olhoH) * (0.15 + Math.random() * 0.5);
      p.x = olhoW / 2 + Math.cos(a) * rad;
      p.y = olhoH / 2 + Math.sin(a) * rad;
      p.r = 0;
    }
    olhoLoop = window.requestAnimationFrame(loopOlho);
  }

  // Reavalia o estado (chamada quando o alto contraste liga/desliga)
  function sincronizarOlho() {
    if (olhoPronto) formarOlho();
  }

  // Pointer na PÁGINA inteira: o olhar segue o mouse em qualquer lugar
  // (gaze), mas o encolhimento só age quando o cursor está sobre o olho
  // (olhoPointer.dentro).
  function olhoAoMover(evento) {
    if (!olhoCanvas) return;
    const rect = olhoCanvas.getBoundingClientRect();
    if (!rect.width) return;
    olhoPointer.x = evento.clientX - rect.left;
    olhoPointer.y = evento.clientY - rect.top;
    olhoPointer.ativo = true;
    olhoPointer.dentro =
      evento.clientX >= rect.left && evento.clientX <= rect.right &&
      evento.clientY >= rect.top && evento.clientY <= rect.bottom;
  }

  function configurarOlho() {
    if (!olhoCanvas || !olhoCanvas.getContext) return;
    olhoCtx = olhoCanvas.getContext("2d");
    if (!olhoCtx) return;
    olhoModelo = gerarModeloOlho();
    olhoRaiosLinhas = olhoModelo.raios;
    olhoPontos = olhoModelo.pontos.map(function (m) {
      return { cor: m.cor, gaze: m.gaze, fase: m.fase, vel: m.vel, ampN: m.ampN };
    });
    window.addEventListener("pointermove", olhoAoMover, { passive: true });
    window.addEventListener("resize", redimensionarOlho);
    redimensionarOlho();
    olhoPronto = true;
    // desenho inicial já formado (fica escondido durante o pre-aviso;
    // a formação animada acontece em formarOlho(), na revelação)
    for (let i = 0; i < olhoPontos.length; i++) {
      const p = olhoPontos[i];
      p.x = p.hx; p.y = p.hy; p.r = p.rBase;
    }
    desenharOlho();
  }

  configurarOlho();

  /* ---------------------------------------------------------
     7. Cabeçalho: anel de progresso do scroll + estado compacto
     Feito direto no evento de scroll (sem rAF) para ser leve e
     previsível: uma escrita de estilo e um toggle de classe.
  --------------------------------------------------------- */
  /* ---------------------------------------------------------
     6b. Altura REAL do cabeçalho.
     O token --altura-cabecalho (5rem) é uma estimativa e sobra
     ~16px sobre a altura real — o bastante para a próxima seção
     espiar por baixo da dobra nas telas de abertura. Aqui a
     altura é medida e publicada em --cabecalho-real, que o CSS
     usa para calcular "uma tela cheia".
     Só medimos com o cabeçalho no estado NÃO rolado: ao rolar
     ele encolhe, e usar essa altura menor faria a página pular.
  --------------------------------------------------------- */
  (function alturaRealDoCabecalho() {
    const barra = document.querySelector(".cabecalho");
    if (!barra) return;

    function medir() {
      if (barra.classList.contains("rolado")) return; // encolhido: não serve
      const altura = barra.getBoundingClientRect().height;
      if (altura > 0) raiz.style.setProperty("--cabecalho-real", altura.toFixed(1) + "px");
    }

    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("load", medir);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
  })();

  const cabecalho = document.querySelector(".cabecalho");
  const anelProgresso = document.querySelector(".anel-progresso");
  const CIRCUNFERENCIA = 2 * Math.PI * 20; // r = 20 no viewBox 0 0 44 44

  if (anelProgresso) {
    anelProgresso.style.strokeDasharray = CIRCUNFERENCIA.toFixed(2);
    anelProgresso.style.strokeDashoffset = CIRCUNFERENCIA.toFixed(2);
  }

  function aoRolarCabecalho() {
    const st = window.scrollY || raiz.scrollTop || 0;
    const alcance = (raiz.scrollHeight - window.innerHeight) || 1;
    const progresso = Math.min(Math.max(st / alcance, 0), 1);
    if (anelProgresso) {
      anelProgresso.style.strokeDashoffset = (CIRCUNFERENCIA * (1 - progresso)).toFixed(2);
    }
    if (cabecalho) cabecalho.classList.toggle("rolado", st > 20);
  }

  if (cabecalho) {
    window.addEventListener("scroll", aoRolarCabecalho, { passive: true });
    window.addEventListener("resize", aoRolarCabecalho);
    aoRolarCabecalho();
  }

  /* ---------------------------------------------------------
     Alfabeto Braille — compartilhado pelo brinquedo da home
     (7a) e pelo simulador da página de jogos (7d).
     Numeração da cela:  1 4
                         2 5
                         3 6
  --------------------------------------------------------- */
  // Pontos ativos por letra (Braille Grau 1, a–z)
  const MAPA_BRAILLE = {
    a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5],
    f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
    k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5],
    p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
    u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6],
    y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6],
  };
  // Ordem de leitura num grid de 2 colunas: 1,4 / 2,5 / 3,6
  const ORDEM_CELA = [1, 4, 2, 5, 3, 6];

  // Caminho inverso: dado um conjunto de pontos, qual letra é?
  function letraDosPontos(pontos) {
    const chave = pontos.slice().sort(function (a, b) { return a - b; }).join(",");
    for (const letra in MAPA_BRAILLE) {
      if (MAPA_BRAILLE[letra].join(",") === chave) return letra;
    }
    return null;
  }

  // O caractere Braille do Unicode (U+2800 + bitmask dos pontos) —
  // permite mostrar ⠃ de verdade, e leitores de tela em braille o entendem.
  function glifoBraille(pontos) {
    const bits = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 32 };
    let cod = 0x2800;
    for (let i = 0; i < pontos.length; i++) cod += bits[pontos[i]] || 0;
    return String.fromCharCode(cod);
  }

  /* ---------------------------------------------------------
     7a. Brinquedo de Braille: digite o nome, veja em pontos.
     Alfabeto Grade 1 (a–z) + espaço. Acentos são normalizados
     para a letra base; caracteres sem letra viram cela vazia.
     As celas são só visuais (o container é aria-hidden) — o
     texto digitado continua sendo lido normalmente pelo campo.
  --------------------------------------------------------- */
  (function brailleBrinquedo() {
    const entrada = document.getElementById("entrada-braille");
    const saida = document.getElementById("saida-braille");
    const descricao = document.getElementById("braille-descricao");
    if (!entrada || !saida) return;

    const MAPA = MAPA_BRAILLE;
    const ORDEM = ORDEM_CELA;

    function normalizar(texto) {
      return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, ""); // tira acentos (ç -> c, á -> a...)
    }

    function montarCela(ch) {
      const cela = document.createElement("span");
      cela.className = "braille-cela";
      const pontos = MAPA[ch];
      if (ch === " ") {
        cela.classList.add("braille-cela-espaco");
        cela.title = "espaço";
      } else {
        cela.title = pontos ? ch.toUpperCase() : ch;
      }
      for (let i = 0; i < ORDEM.length; i++) {
        const ponto = document.createElement("span");
        ponto.className = "braille-ponto";
        if (pontos && pontos.indexOf(ORDEM[i]) !== -1) {
          ponto.className += " cheio";
        }
        cela.appendChild(ponto);
      }
      return cela;
    }

    // Descrição textual pro leitor de tela: "A: ponto 1. N: pontos 1, 3, 4, 5."
    function descrever(texto) {
      const partes = [];
      for (let i = 0; i < texto.length; i++) {
        const ch = texto[i];
        if (ch === " ") { partes.push("espaço"); continue; }
        const pontos = MAPA[ch];
        if (!pontos) continue; // ignora não-letras na descrição
        const rotulo = pontos.length === 1 ? "ponto " : "pontos ";
        partes.push(ch.toUpperCase() + ": " + rotulo + pontos.join(", "));
      }
      return partes.join(". ");
    }

    let anuncioTimer = null;
    function render() {
      const texto = normalizar(entrada.value);
      saida.textContent = "";
      for (let i = 0; i < texto.length; i++) {
        saida.appendChild(montarCela(texto[i]));
      }
      // Anuncia a descrição em Braille com um respiro, pra o leitor de tela
      // ler a palavra inteira quando a pessoa pausa (e não a cada tecla).
      if (descricao) {
        clearTimeout(anuncioTimer);
        anuncioTimer = setTimeout(function () {
          descricao.textContent = texto ? descrever(texto) : "";
        }, 600);
      }
    }

    entrada.addEventListener("input", render);
    render();
  })();

  /* ---------------------------------------------------------
     7c. Narração dos jogos — OPT-IN, guardada no localStorage.
     Jogos que falam sozinhos atrapalham quem usa leitor de tela
     (duas vozes ao mesmo tempo) e contrariam a WCAG 1.4.2, que
     exige controle sobre áudio automático. Então nasce desligada.
     A mesma chave é lida pelo jogo "Teclas pelo Toque", que roda
     numa subpasta própria.
  --------------------------------------------------------- */
  const CHAVE_SOM_JOGOS = "pontoaponto-som-jogos";

  (function narracaoDosJogos() {
    const botao = document.getElementById("btn-som-jogos");
    if (!botao) return;

    const rotulo = document.getElementById("rotulo-som-jogos");
    const icone = document.getElementById("icone-som-jogos");

    // Sem API de voz no navegador, o controle não faz sentido
    if (!suportaLeitura) {
      botao.hidden = true;
      return;
    }

    function ligado() {
      return lerPreferencia(CHAVE_SOM_JOGOS) === "1";
    }

    function pintar() {
      const on = ligado();
      botao.setAttribute("aria-pressed", String(on));
      if (rotulo) rotulo.textContent = "Narração dos jogos: " + (on ? "ligada" : "desligada");
      if (icone) icone.textContent = on ? "🔊" : "🔇";
    }

    botao.addEventListener("click", function () {
      const novo = !ligado();
      salvarPreferencia(CHAVE_SOM_JOGOS, novo ? "1" : "0");
      if (!novo && window.speechSynthesis) window.speechSynthesis.cancel();
      pintar();
      anunciar(novo
        ? "Narração dos jogos ligada. Os jogos podem falar em voz alta."
        : "Narração dos jogos desligada.");
      mostrarToast(novo ? "Narração dos jogos ligada" : "Narração dos jogos desligada");
    });

    pintar();
  })();

  /* ---------------------------------------------------------
     7d. Simulador Braille (jogos.html) — teclado tipo Perkins.
     F, D, S = pontos 1, 2, 3 · J, K, L = pontos 4, 5, 6 ·
     Espaço confirma a letra · Backspace apaga.
     Os pontos também são BOTÕES, então funciona com mouse,
     toque e Tab — não só com o teclado de atalho. Tudo é
     anunciado pelo aria-live, então dá pra jogar sem ver.
  --------------------------------------------------------- */
  (function simuladorBraille() {
    const cela = document.getElementById("cela-simulador");
    if (!cela) return;

    const botoes = Array.prototype.slice.call(cela.querySelectorAll(".sim-ponto"));
    const elGlifo = document.getElementById("sim-glifo");
    const elLetra = document.getElementById("sim-letra");
    const elTexto = document.getElementById("sim-texto");
    const btnConfirmar = document.getElementById("sim-confirmar");
    const btnApagar = document.getElementById("sim-apagar");
    const btnLimpar = document.getElementById("sim-limpar");
    const painel = document.getElementById("simulador-braille");

    const TECLAS = { f: 1, d: 2, s: 3, j: 4, k: 5, l: 6 };
    const ativos = {};
    let escrito = "";

    function pontosAtivos() {
      const lista = [];
      for (let n = 1; n <= 6; n++) if (ativos[n]) lista.push(n);
      return lista;
    }

    function nomeDaLetra(pontos) {
      if (!pontos.length) return null;
      const l = letraDosPontos(pontos);
      return l ? l.toUpperCase() : null;
    }

    function pintar() {
      for (let i = 0; i < botoes.length; i++) {
        const n = Number(botoes[i].getAttribute("data-ponto"));
        const aceso = !!ativos[n];
        botoes[i].classList.toggle("aceso", aceso);
        botoes[i].setAttribute("aria-pressed", String(aceso));
      }
      const pontos = pontosAtivos();
      const letra = nomeDaLetra(pontos);
      if (elGlifo) elGlifo.textContent = glifoBraille(pontos);
      if (elLetra) {
        elLetra.textContent = !pontos.length ? "—" : letra ? letra : "?";
        elLetra.classList.toggle("sim-letra-vaga", !!pontos.length && !letra);
        elLetra.classList.toggle("sim-letra-vazia", !pontos.length);
      }
    }

    function descreverEstado() {
      const pontos = pontosAtivos();
      if (!pontos.length) return "Cela vazia.";
      const letra = nomeDaLetra(pontos);
      const rotulo = pontos.length === 1 ? "Ponto " : "Pontos ";
      return rotulo + pontos.join(", ") + ". " +
        (letra ? "Forma a letra " + letra + "." : "Ainda não forma uma letra.");
    }

    function alternar(n) {
      ativos[n] = !ativos[n];
      pintar();
      anunciar(descreverEstado());
    }

    function confirmar() {
      const pontos = pontosAtivos();
      if (!pontos.length) {
        anunciar("A cela está vazia — não há letra para confirmar.");
        return;
      }
      const letra = nomeDaLetra(pontos);
      if (!letra) {
        anunciar("Esta combinação de pontos não forma uma letra do alfabeto. Tente outra.");
        return;
      }
      escrito += letra;
      if (elTexto) elTexto.textContent = escrito;
      for (let n = 1; n <= 6; n++) ativos[n] = false;
      pintar();
      anunciar("Letra " + letra + " confirmada. Você escreveu: " + escrito.split("").join(" ") + ".");
    }

    function apagar() {
      if (!escrito) {
        anunciar("Não há nada escrito para apagar.");
        return;
      }
      escrito = escrito.slice(0, -1);
      if (elTexto) elTexto.textContent = escrito;
      anunciar(escrito ? "Apagado. Você escreveu: " + escrito.split("").join(" ") + "." : "Tudo apagado.");
    }

    function limpar() {
      for (let n = 1; n <= 6; n++) ativos[n] = false;
      escrito = "";
      if (elTexto) elTexto.textContent = "";
      pintar();
      anunciar("Simulador limpo.");
    }

    // Os pontos são botões: clique, toque e Tab+Espaço funcionam.
    for (let i = 0; i < botoes.length; i++) {
      botoes[i].addEventListener("click", function () {
        alternar(Number(this.getAttribute("data-ponto")));
      });
    }
    if (btnConfirmar) btnConfirmar.addEventListener("click", confirmar);
    if (btnApagar) btnApagar.addEventListener("click", apagar);
    if (btnLimpar) btnLimpar.addEventListener("click", limpar);

    // Atalhos de teclado: presos ao painel do jogo (não à página inteira),
    // pra não sequestrar teclas de quem está lendo o resto do conteúdo.
    if (painel) {
      painel.addEventListener("keydown", function (evento) {
        const alvo = evento.target;
        const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable);
        if (digitando) return;

        const tecla = (evento.key || "").toLowerCase();
        if (TECLAS[tecla]) {
          evento.preventDefault();
          alternar(TECLAS[tecla]);
          return;
        }
        // Espaço = confirmar, como na máquina Perkins (no original ele
        // ROLAVA A PÁGINA, faltava preventDefault).
        // Nos PONTOS o Espaço é reservado para confirmar — quem navega por
        // Tab alterna o ponto com Enter (ou clicando). Já nos botões de
        // ação, o Espaço age normalmente sobre o botão focado.
        if (evento.key === " " || evento.code === "Space") {
          const botaoDeAcao = alvo && alvo.tagName === "BUTTON" &&
            !alvo.classList.contains("sim-ponto");
          if (botaoDeAcao) return;
          evento.preventDefault();
          confirmar();
          return;
        }
        if (evento.key === "Backspace") {
          evento.preventDefault();
          apagar();
        }
      });
    }

    pintar();
  })();

  /* ---------------------------------------------------------
     7e. Quiz de revisão (jogos.html). Cada pergunta tem
     data-correta com o índice da alternativa certa. O acerto
     é mostrado por símbolo + texto (nunca só por cor) e vai
     para o aria-live, então funciona com leitor de tela.
  --------------------------------------------------------- */
  (function quizRevisao() {
    const quiz = document.getElementById("quiz-revisao");
    if (!quiz) return;

    const itens = Array.prototype.slice.call(quiz.querySelectorAll(".quiz-item"));
    const placar = document.getElementById("quiz-placar");
    let acertos = 0;
    let respondidas = 0;

    function atualizarPlacar() {
      if (!placar) return;
      if (!respondidas) {
        placar.textContent = "";
        return;
      }
      const fim = respondidas === itens.length;
      placar.textContent =
        "Você acertou " + acertos + " de " + respondidas +
        (fim ? " — quiz completo!" : " (" + itens.length + " no total).");
    }

    itens.forEach(function (item) {
      const correta = Number(item.getAttribute("data-correta"));
      const opcoes = Array.prototype.slice.call(item.querySelectorAll(".quiz-opcao"));
      const retorno = item.querySelector(".quiz-feedback");

      opcoes.forEach(function (botao, indice) {
        botao.addEventListener("click", function () {
          if (item.getAttribute("data-respondida") === "1") return;
          item.setAttribute("data-respondida", "1");
          respondidas++;

          const acertou = indice === correta;
          if (acertou) acertos++;

          opcoes.forEach(function (b, j) {
            b.disabled = true;
            if (j === correta) b.classList.add("certa");
          });
          if (!acertou) botao.classList.add("errada");

          const textoCerto = opcoes[correta].textContent.trim();
          if (retorno) {
            retorno.textContent = acertou
              ? "✔ Correto! " + textoCerto + "."
              : "✕ Não foi essa. A resposta certa é: " + textoCerto + ".";
            retorno.classList.add("visivel");
            retorno.classList.toggle("acertou", acertou);
          }
          atualizarPlacar();
        });
      });
    });

    atualizarPlacar();
  })();

  /* ---------------------------------------------------------
     7f. A rota do AcessiCar (tecnologia.html): o trilho se
     preenche conforme a pessoa rola e cada parada acende ao
     ser alcançada. É enfeite — o texto e a ordem já estão no
     HTML (<ol>), então quem não vê a animação não perde nada.
     No alto contraste e no "reduzir movimento", o trajeto já
     nasce inteiro aceso e não há listener de scroll.
  --------------------------------------------------------- */
  (function rotaConceito() {
    const palco = document.getElementById("rota-acessicar");
    if (!palco) return;

    const paradas = Array.prototype.slice.call(palco.querySelectorAll(".rota-parada"));
    if (!paradas.length) return;

    // Onde o trilho começa/termina e onde fica o centro de cada parada.
    let trilhoTopo = 0;
    let trilhoAltura = 1;
    let centros = [];

    function medir() {
      const base = palco.getBoundingClientRect().top;
      const marcas = paradas.map(function (p) {
        const m = p.querySelector(".rota-marca").getBoundingClientRect();
        return m.top - base + m.height / 2;
      });
      trilhoTopo = marcas[0];
      trilhoAltura = Math.max(1, marcas[marcas.length - 1] - marcas[0]);
      centros = marcas.map(function (c) { return c - trilhoTopo; });
      palco.style.setProperty("--rota-topo", trilhoTopo.toFixed(1) + "px");
      palco.style.setProperty("--rota-altura", trilhoAltura.toFixed(1) + "px");
    }

    function acenderTudo() {
      palco.style.setProperty("--rota", "1");
      paradas.forEach(function (p) { p.classList.add("alcancada"); });
    }

    function estatico() {
      return prefereMenosMovimento || corpo.classList.contains("alto-contraste");
    }

    function aoRolar() {
      if (estatico()) { acenderTudo(); return; }
      const topoNaTela = palco.getBoundingClientRect().top + trilhoTopo;
      // linha de referência um pouco abaixo do meio da tela
      const referencia = window.innerHeight * 0.62;
      let avanco = (referencia - topoNaTela) / trilhoAltura;
      avanco = Math.max(0, Math.min(1, avanco));
      palco.style.setProperty("--rota", avanco.toFixed(4));

      const percorrido = avanco * trilhoAltura;
      for (let i = 0; i < paradas.length; i++) {
        paradas[i].classList.toggle("alcancada", percorrido >= centros[i] - 1);
      }
    }

    function atualizar() {
      medir();
      aoRolar();
    }

    atualizar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", atualizar);
    window.addEventListener("load", atualizar);
    // a imagem da marca acima pode empurrar o layout ao carregar
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(atualizar);

    // Ao ligar/desligar o alto contraste, o modo muda na hora
    document.addEventListener("click", function (evento) {
      if (evento.target && evento.target.closest && evento.target.closest("#btn-contraste")) {
        window.setTimeout(atualizar, 60);
      }
    });
  })();

  /* ---------------------------------------------------------
     7b. Scroll suave "manteiga" (lerp a cada frame)
     Portado do projeto agrocarbono. A cada frame, a posição do
     scroll persegue o alvo, dando a sensação de deslize.
     DESLIGADO em: touch, prefers-reduced-motion, alto contraste
     e durante a entrada — nesses casos, scroll nativo normal.
  --------------------------------------------------------- */
  function configurarScrollSuave() {
    const semHover = window.matchMedia("(hover: none)").matches;
    if (prefereMenosMovimento || semHover) return;

    raiz.classList.add("tem-scroll-suave");

    let atual = window.scrollY;
    let alvo = window.scrollY;
    let animando = false;
    const SUAVIDADE = 0.09; // menor = mais "glide"

    function maxScroll() { return raiz.scrollHeight - window.innerHeight; }
    function limitar(v) { return Math.max(0, Math.min(v, maxScroll())); }

    function iniciar() {
      if (animando) return;
      animando = true;
      window.requestAnimationFrame(passo);
    }

    function passo() {
      atual += (alvo - atual) * SUAVIDADE;
      if (Math.abs(alvo - atual) < 0.3) { atual = alvo; animando = false; }
      window.scrollTo(0, atual);
      if (animando) window.requestAnimationFrame(passo);
    }

    // Quando o scroll suave não deve agir, deixamos o scroll nativo passar.
    function suaveDesligado() {
      return corpo.classList.contains("alto-contraste") || raiz.classList.contains("pre-aviso");
    }

    function aoGirarRoda(evento) {
      if (evento.ctrlKey) return; // não atrapalha o zoom
      if (suaveDesligado()) return;
      evento.preventDefault();
      alvo = limitar(alvo + evento.deltaY);
      iniciar();
    }

    function aoClicarAncora(evento) {
      if (suaveDesligado()) return; // no HC/entrada, deixa a âncora nativa agir
      const link = evento.target.closest('a[href^="#"]');
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      const destino = document.getElementById(href.slice(1));
      if (!destino) return;
      evento.preventDefault();
      const recuo = parseFloat(getComputedStyle(raiz).scrollPaddingTop) || 8;
      alvo = limitar(destino.getBoundingClientRect().top + window.scrollY - recuo);
      iniciar();
      // Move o foco para o destino (importante para o teclado)
      if (!destino.hasAttribute("tabindex")) destino.setAttribute("tabindex", "-1");
      destino.focus({ preventScroll: true });
    }

    // Se o scroll mudar por fora (teclado, "localizar", âncora nativa), sincroniza.
    function aoRolar() {
      if (animando) return;
      if (Math.abs(window.scrollY - atual) > 2) { atual = alvo = window.scrollY; }
    }
    function aoRedimensionar() { alvo = limitar(alvo); }

    window.addEventListener("wheel", aoGirarRoda, { passive: false });
    document.addEventListener("click", aoClicarAncora);
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRedimensionar);
  }

  configurarScrollSuave();

  /* ---------------------------------------------------------
     8. Popup "Você é uma pessoa cega ou tem baixa visão?"
  --------------------------------------------------------- */
  const dialogoPergunta = document.getElementById("dialogo-pergunta");
  const bannerAcoes = document.getElementById("banner-acoes");
  const bannerSeguinte = document.getElementById("banner-seguinte");
  const btnPerguntaSim = document.getElementById("btn-pergunta-sim");
  const btnPerguntaNao = document.getElementById("btn-pergunta-nao");
  const btnOuvirSim = document.getElementById("btn-ouvir-sim");
  const btnOuvirNao = document.getElementById("btn-ouvir-nao");
  const btnFecharDialogo = document.getElementById("btn-fechar-dialogo");

  let mensagemFechamento = "Tudo bem! Os recursos de acessibilidade ficam no menu do topo da página.";
  let perguntaEncerrada = false;

  // Guarda a resposta em localStorage: quem já respondeu não é perguntado
  // de novo em visitas futuras.
  function jaRespondeuPergunta() {
    return lerPreferencia(CHAVE_PERGUNTA) === "1";
  }
  function marcarPerguntaRespondida() {
    salvarPreferencia(CHAVE_PERGUNTA, "1");
  }

  // "Aviso primeiro": o site espera desfocado e invisível (html.pre-aviso)
  // até a pessoa responder. Só então a trava sai — o site inteiro assenta
  // em foco E as animações de entrada começam, na frente da pessoa.
  function revelarSite() {
    raiz.classList.remove("pre-aviso");
    iniciarAnimacoesEntrada();
    if (podeAnimarNumeros) verificarContadores(); // retoma contadores já visíveis
    verificarTitulos(); // e a varredura de luz dos títulos que já estão na tela
    formarOlho();       // os pontos se juntam formando o olho, na frente da pessoa
  }

  function encerrarPergunta(mensagem) {
    if (perguntaEncerrada) return;
    perguntaEncerrada = true;
    marcarPerguntaRespondida();
    if (dialogoPergunta && dialogoPergunta.open) dialogoPergunta.close();
    anunciar(mensagem);
    const principal = document.getElementById("conteudo-principal");
    if (principal) principal.focus({ preventScroll: true });
    revelarSite(); // resposta dada → agora sim o site aparece
  }

  const suportaDialogo = dialogoPergunta && typeof dialogoPergunta.showModal === "function";

  if (suportaDialogo && !jaRespondeuPergunta()) {
    // 1ª visita: abre o aviso sobre a tela ainda escura
    window.setTimeout(function () {
      if (!dialogoPergunta.open && !perguntaEncerrada) {
        try {
          dialogoPergunta.showModal();
        } catch (erro) {
          revelarSite(); // se o aviso falhar, nunca prende a pessoa
        }
      }
    }, 400);
    // Retaguarda para a tecla Esc
    dialogoPergunta.addEventListener("close", function () {
      encerrarPergunta(mensagemFechamento);
    });
  } else {
    // Já respondeu antes (ou navegador sem <dialog>): sem aviso, revela o site
    perguntaEncerrada = true;
    window.setTimeout(revelarSite, jaRespondeuPergunta() ? 300 : 0);
  }

  // "Ouvir esta mensagem" — lê o texto do aviso (caso a voz automática seja bloqueada)
  const btnOuvirMensagem = document.getElementById("btn-ouvir-mensagem");
  if (btnOuvirMensagem) {
    if (!suportaLeitura) {
      btnOuvirMensagem.hidden = true;
    }
    btnOuvirMensagem.addEventListener("click", function () {
      const titulo = document.getElementById("titulo-pergunta");
      const desc = document.getElementById("desc-pergunta");
      const texto = [titulo, desc]
        .filter(Boolean)
        .map(function (e) { return e.textContent.trim(); })
        .join(". ");
      falarTexto(texto);
    });
  }

  if (btnPerguntaSim) {
    btnPerguntaSim.addEventListener("click", function () {
      aplicarContraste(true, false);
      mensagemFechamento = "Modo de alto contraste ativado. Você pode ativar a leitura em voz alta no menu de acessibilidade.";
      if (suportaLeitura && bannerSeguinte) {
        if (bannerAcoes) bannerAcoes.hidden = true;
        bannerSeguinte.hidden = false;
        anunciar("Modo de alto contraste ativado. Agora escolha se quer ouvir a página em voz alta.");
        if (btnOuvirSim) btnOuvirSim.focus();
      } else {
        encerrarPergunta("Modo de alto contraste ativado. Você pode ativar a leitura em voz alta no menu de acessibilidade.");
      }
    });
  }

  if (btnPerguntaNao) {
    btnPerguntaNao.addEventListener("click", function () {
      encerrarPergunta("Tudo bem! Se mudar de ideia, os recursos de acessibilidade ficam no menu do topo da página.");
    });
  }

  if (btnOuvirSim) {
    btnOuvirSim.addEventListener("click", function () {
      encerrarPergunta("Alto contraste ativado. Iniciando a leitura em voz alta.");
      iniciarLeitura();
    });
  }

  if (btnOuvirNao) {
    btnOuvirNao.addEventListener("click", function () {
      encerrarPergunta("Combinado! Para ouvir depois, use “Ouvir esta página” no menu de acessibilidade.");
    });
  }

  // X no canto: fecha sem mudar nada (como o "Não")
  if (btnFecharDialogo) {
    btnFecharDialogo.addEventListener("click", function () {
      encerrarPergunta("Aviso fechado. Os recursos de acessibilidade ficam no menu do topo da página.");
    });
  }

  /* ---------------------------------------------------------
     9. Animações de entrada ("focus pull")
     SÓ começam quando revelarSite() roda — depois da resposta
     ao aviso — para a entrada acontecer na frente da pessoa.
     O que está na tela entra em cascata (escalonado); o resto
     revela conforme o scroll. Sem JS, tudo fica visível.
  --------------------------------------------------------- */
  const elementosAnimados = document.querySelectorAll("[data-anima]");
  let animacoesIniciadas = false;

  function iniciarAnimacoesEntrada() {
    if (animacoesIniciadas) return;
    animacoesIniciadas = true;
    if (prefereMenosMovimento) return;
    if (corpo.classList.contains("alto-contraste")) return; // modo estável

    const pendentes = [];
    const elementosDoHero = [];

    elementosAnimados.forEach(function (elemento) {
      elemento.classList.add("anima-entrada");
      pendentes.push(elemento);

      if (elemento.closest(".hero")) {
        // Hero: entra na revelação, de cima para baixo (ordem por altura)
        elementosDoHero.push(elemento);
      } else {
        // Seções: cascata entre irmãos (0/90/180ms…), revelada no scroll
        let atraso = 0;
        let anterior = elemento.previousElementSibling;
        while (anterior) {
          if (anterior.hasAttribute("data-anima")) atraso += 1;
          anterior = anterior.previousElementSibling;
        }
        elemento.style.transitionDelay = Math.min(atraso * 90, 450) + "ms";
      }
    });

    // Varredura descendente do hero: quem está mais alto entra antes,
    // começando depois que o cabeçalho desceu (base de 150ms).
    elementosDoHero.sort(function (a, b) {
      return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
    });
    elementosDoHero.forEach(function (elemento, posicao) {
      elemento.style.transitionDelay = 150 + posicao * 120 + "ms";
    });

    // Garante que o estado "escondido" foi pintado antes de revelar
    // (senão o navegador junta as duas classes e não anima nada).
    void corpo.offsetHeight;

    // "Na tela ou acima dela": um pulo direto para o fim da página
    // (tecla End) também revela o que ficou para trás no caminho.
    function naTela(elemento) {
      return elemento.getBoundingClientRect().top < window.innerHeight * 0.92;
    }

    function verificarReveals() {
      for (let i = pendentes.length - 1; i >= 0; i--) {
        if (naTela(pendentes[i])) {
          pendentes[i].classList.add("visivel");
          pendentes.splice(i, 1);
        }
      }
      if (pendentes.length === 0) {
        window.removeEventListener("scroll", verificarReveals);
        window.removeEventListener("resize", verificarReveals);
      }
    }

    window.addEventListener("scroll", verificarReveals, { passive: true });
    window.addEventListener("resize", verificarReveals);
    verificarReveals(); // o que já está na tela entra agora
  }

  /* ---------------------------------------------------------
     9b. Varredura de luz nos títulos de seção (GUARDADA)
     Uma "esfera" de luz âmbar cruza o título quando ele entra na
     tela. O Dg decidiu tirar por ora — mas o código fica inteiro,
     dormente. Para RELIGAR, troque o interruptor abaixo para true
     (o CSS .titulo-brilho / @keyframes titulo-varre segue no style.css,
     inerte enquanto o JS não marcar os títulos).
  --------------------------------------------------------- */
  const VARREDURA_TITULOS_ATIVA = false; // ← true para religar a varredura dos títulos

  const titulosSecao = document.querySelectorAll(".secao h2");
  let tickTitulo = false;

  function prepararTitulos() {
    titulosSecao.forEach(function (h2) {
      if (!h2.getAttribute("data-texto")) {
        h2.setAttribute("data-texto", h2.textContent.trim());
      }
      h2.classList.add("titulo-brilho");
    });
  }

  function tituloNaTela(h2) {
    const r = h2.getBoundingClientRect();
    return r.top < window.innerHeight * 0.85 && r.bottom > 0;
  }

  function pararDeOuvirTitulos() {
    window.removeEventListener("scroll", aoRolarTitulos);
    window.removeEventListener("resize", aoRolarTitulos);
  }

  function verificarTitulos() {
    if (!VARREDURA_TITULOS_ATIVA) return; // interruptor: feature guardada
    if (prefereMenosMovimento) return;
    if (raiz.classList.contains("pre-aviso")) return; // espera revelar o site
    if (corpo.classList.contains("alto-contraste")) { pararDeOuvirTitulos(); return; }
    let pendentes = 0;
    titulosSecao.forEach(function (h2) {
      if (h2.dataset.brilhou === "1") return;
      if (tituloNaTela(h2)) {
        h2.classList.add("brilho-ativo");
        h2.dataset.brilhou = "1";
      } else {
        pendentes += 1;
      }
    });
    if (pendentes === 0) pararDeOuvirTitulos();
  }

  function aoRolarTitulos() {
    if (tickTitulo) return;
    tickTitulo = true;
    window.requestAnimationFrame(function () {
      tickTitulo = false;
      verificarTitulos();
    });
  }

  if (VARREDURA_TITULOS_ATIVA && titulosSecao.length && !prefereMenosMovimento) {
    prepararTitulos();
    window.addEventListener("scroll", aoRolarTitulos, { passive: true });
    window.addEventListener("resize", aoRolarTitulos);
    // A 1ª checagem acontece em revelarSite() (durante pre-aviso, espera).
  }

  /* ---------------------------------------------------------
     10. Restaura as preferências salvas na última visita

     No contraste, a escolha do usuário vem primeiro. Se ele nunca
     mexeu no botão, a gente olha o que o sistema dele já diz:
     quem liga "aumentar contraste" no Windows/macOS ou usa o Modo
     de Alto Contraste está justamente avisando que precisa disso,
     e não deveria ter que achar o menu pra pedir de novo.
  --------------------------------------------------------- */
  const contrasteSalvo = lerPreferencia(CHAVE_CONTRASTE);

  function sistemaPedeContraste() {
    if (!window.matchMedia) return false;
    return window.matchMedia("(prefers-contrast: more)").matches ||
           window.matchMedia("(forced-colors: active)").matches;
  }

  if (contrasteSalvo === "1") {
    aplicarContraste(true, false);
  } else if (contrasteSalvo === null && sistemaPedeContraste()) {
    aplicarContraste(true, false);
    // Ligou porque o SISTEMA pediu, não porque ele clicou. Se deixasse
    // salvo, o site ficaria preso no alto contraste mesmo depois que ele
    // desligasse a config do sistema. Apagando, a gente continua seguindo.
    esquecerPreferencia(CHAVE_CONTRASTE);
  }
  // contrasteSalvo === "0" cai fora de propósito: ele desligou na mão,
  // e isso vale mais que a preferência do sistema.

  const fonteSalva = parseInt(lerPreferencia(CHAVE_FONTE), 10);
  aplicarFonte(isNaN(fonteSalva) ? NIVEL_PADRAO : fonteSalva, false);
})();
