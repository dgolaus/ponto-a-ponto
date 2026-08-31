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
      // Só as celas que MUDARAM são refeitas: assim a letra recém-digitada
      // acende sozinha e o resto da palavra fica parado (sem repintar tudo).
      const atuais = saida.children;
      while (atuais.length > texto.length) saida.removeChild(saida.lastChild);
      const podeAnimarCela =
        !prefereMenosMovimento && !corpo.classList.contains("alto-contraste");
      for (let i = 0; i < texto.length; i++) {
        const ch = texto[i];
        const existente = atuais[i];
        if (existente && existente.dataset.ch === ch) continue;
        const nova = montarCela(ch);
        nova.dataset.ch = ch;
        if (podeAnimarCela) {
          nova.classList.add("cela-nova");
          nova.addEventListener("animationend", function () {
            nova.classList.remove("cela-nova");
          }, { once: true });
        }
        if (existente) saida.replaceChild(nova, existente);
        else saida.appendChild(nova);
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
     7f. Labirinto Sonoro (jogo-labirinto.html) — audiogame.
     A partir do projeto de João Lucas Marino (@joaomarino767).

     A ideia é dele: achar a saída guiado por som estéreo, com o
     pan dizendo o lado e a frequência dizendo a distância. O que
     mudou na remontagem para o Ponto a Ponto:

     - O som NUNCA começa sozinho. O jogo abre num portão onde a
       pessoa escolhe jogar com ou sem áudio (regra do site e
       WCAG 1.4.2). Nada toca antes desse clique.
     - O labirinto NÃO nasce desenhado: a parede só aparece
       depois que você esbarra nela, que é como se anda de
       bengala. No original a saída ficava visível na tela, então
       quem enxerga andava direto até ela e o jogo de ouvido se
       desmontava sozinho.
     - Tudo que o som diz, o texto também diz. Direção, distância
       e cada esbarrão vão para o aria-live, então dá pra jogar
       com leitor de tela, sem fone, ou com o som desligado.
     - A direção informa os DOIS eixos ("à direita e acima"). No
       original o eixo vertical sumia sempre que havia desvio
       horizontal — ou seja, na maioria das posições.
     - Desenha só quando algo muda. O original abria um loop de
       requestAnimationFrame por fase carregada e não cancelava
       nenhum: depois de três reinícios eram ~10 loops juntos.
     - As cores saem dos tokens do site, então o alto contraste
       do menu alcança o canvas de graça.
  --------------------------------------------------------- */
  (function labirintoSonoro() {
    const palco = document.getElementById("labirinto");
    if (!palco) return;

    /* Mapas: '#' parede, ' ' chão, 'P' onde a pessoa começa.
       Todas as linhas de um mapa têm a mesma largura e a borda é
       fechada — no original a fase 5 tinha linhas de 20 e 21
       caracteres e o código tapava o buraco com parede.
       As fases 4 e 5 foram geradas por busca em profundidade com
       alguns atalhos abertos depois: labirinto "perfeito" (só
       becos) é cruel de navegar só de ouvido. */
    const MAPAS = [
      [
        "###########",
        "#P    #   #",
        "# ### # # #",
        "#   #   # #",
        "### ##### #",
        "#         #",
        "###########"
      ],
      [
        "#############",
        "#P  #       #",
        "# # # ### # #",
        "# #   #   # #",
        "# ##### ### #",
        "#     #     #",
        "# ### # ### #",
        "#   #   #   #",
        "#############"
      ],
      [
        "###############",
        "#P    #       #",
        "# ### # ##### #",
        "#   #     #   #",
        "### ##### # ###",
        "#     #   #   #",
        "# ### # ##### #",
        "#   #       # #",
        "###############"
      ],
      [
        "#################",
        "#P#   #         #",
        "#   # #  ## # ###",
        "#   #     #     #",
        "######### # # # #",
        "#         #   # #",
        "# ## #### ##### #",
        "# #       #     #",
        "# #   #  ## # # #",
        "#           #   #",
        "#################"
      ],
      [
        "#####################",
        "#P#     #           #",
        "# # # # #### ##     #",
        "# #           # #   #",
        "# # ##### ### # ### #",
        "# #     #   # # #   #",
        "# # ### # ### # #   #",
        "# # #   #   #     # #",
        "# ### ### # ### #   #",
        "#     #             #",
        "#####################"
      ]
    ];

    const CHAVE_FASES = "pontoaponto-labirinto-fases";
    const VIZINHOS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    const arena = document.getElementById("lab-arena");
    const tela = document.getElementById("lab-canvas");
    const pincel = tela && tela.getContext ? tela.getContext("2d") : null;
    if (!arena || !pincel) return;

    const portao = document.getElementById("lab-inicio");
    const mesa = document.getElementById("lab-mesa");
    const elFase = document.getElementById("lab-fase-num");
    const elTotal = document.getElementById("lab-fase-total");
    const elPassos = document.getElementById("lab-passos");
    const elEstado = document.getElementById("lab-estado");
    const elDirecao = document.getElementById("lab-direcao");
    const elDistancia = document.getElementById("lab-distancia");
    const elMedidor = document.getElementById("lab-medidor");
    const btnPulso = document.getElementById("lab-pulso");
    const btnSom = document.getElementById("lab-som");
    const btnMapa = document.getElementById("lab-mapa");
    const btnReiniciar = document.getElementById("lab-reiniciar");
    const listaFases = document.getElementById("lab-fases");
    const vitoria = document.getElementById("lab-vitoria");
    const elVitoriaTexto = document.getElementById("lab-vitoria-texto");
    const btnProxima = document.getElementById("lab-proxima");

    let fase = 0;
    let grade = [];
    let jogador = { l: 1, c: 1 };
    let saida = { l: 1, c: 1 };
    let passos = 0;
    let paredesVistas = {};
    let chaoPisado = {};
    // Aberto por padrão, como no original: o labirinto inteiro à vista.
    // Fechar é OPCIONAL, pro jogo virar exploração de bengala.
    let mostrarMapa = true;
    let somLigado = false;
    let jogando = false;
    let venceu = false;

    /* --- áudio: criado só no primeiro gesto da pessoa --- */
    let audio = null;
    let mestre = null;
    // O "farol": um sine que toca SEM PARAR enquanto o som está ligado.
    // Fica mais agudo e mais alto conforme você se aproxima da saída, e
    // anda no estéreo para o lado dela. É o coração do jogo do João —
    // na primeira remontagem eu tinha trocado por um tom curto por passo,
    // e sem o contínuo não dá pra "virar e sentir" o som mudar.
    let farol = null;
    let farolGanho = null;
    let farolLado = null;

    function ligarAudio() {
      const Contexto = window.AudioContext || window.webkitAudioContext;
      if (!Contexto) return false;
      if (!audio) {
        audio = new Contexto();
        mestre = audio.createGain();
        mestre.gain.value = 0.16;
        mestre.connect(audio.destination);
      }

      if (!farol) {
        farol = audio.createOscillator();
        farolGanho = audio.createGain();
        farol.type = "sine";
        farol.frequency.value = 260;
        farolGanho.gain.value = 0.0001; // nasce mudo; sobe no primeiro ajuste
        if (audio.createStereoPanner) {
          farolLado = audio.createStereoPanner();
          farol.connect(farolGanho).connect(farolLado).connect(mestre);
        } else {
          farolLado = null;
          farol.connect(farolGanho).connect(mestre);
        }
        farol.start();
      }
      if (audio.state === "suspended") audio.resume();
      return true;
    }

    function desligarAudio() {
      if (!audio) return;
      try { audio.close(); } catch (erro) { /* segue funcionando */ }
      audio = null;
      mestre = null;
      farol = null;
      farolGanho = null;
      farolLado = null;
    }

    // Chamada a cada passo, troca de fase e liga/desliga do som.
    // setTargetAtTime em vez de valor seco: o som desliza, não pula.
    function atualizarFarol() {
      if (!audio || !farol) return;
      const agora = audio.currentTime;
      if (!somLigado || venceu || !jogando) {
        farolGanho.gain.cancelScheduledValues(agora);
        farolGanho.gain.setTargetAtTime(0.0001, agora, 0.05);
        return;
      }
      const m = medidas();
      farolGanho.gain.cancelScheduledValues(agora);
      farol.frequency.setTargetAtTime(200 + m.forca * 420, agora, 0.07);
      farolGanho.gain.setTargetAtTime(0.012 + m.forca * 0.05, agora, 0.07);
      if (farolLado) {
        farolLado.pan.setTargetAtTime(Math.max(-1, Math.min(1, m.lado)), agora, 0.07);
      }
    }

    function tocar(frequencia, duracao, forma, volume, lado) {
      if (!somLigado || !audio || !mestre) return;
      const oscilador = audio.createOscillator();
      const ganho = audio.createGain();
      oscilador.type = forma;
      oscilador.frequency.value = frequencia;

      // O pan estéreo é o coração do jogo, mas nem todo navegador
      // tem StereoPannerNode — sem ele o som sai centralizado e o
      // painel de texto continua dizendo o lado.
      let destino = ganho;
      if (audio.createStereoPanner) {
        const pan = audio.createStereoPanner();
        pan.pan.value = Math.max(-1, Math.min(1, lado));
        ganho.connect(pan);
        destino = pan;
      }

      const agora = audio.currentTime;
      ganho.gain.setValueAtTime(0.0001, agora);
      ganho.gain.exponentialRampToValueAtTime(Math.max(0.0005, volume), agora + 0.012);
      ganho.gain.exponentialRampToValueAtTime(0.0001, agora + duracao);
      oscilador.connect(ganho);
      destino.connect(mestre);
      oscilador.start(agora);
      oscilador.stop(agora + duracao + 0.03);
    }

    /* --- mapa --- */
    function ehLivre(l, c) {
      return !!grade[l] && grade[l][c] !== undefined && grade[l][c] !== "#";
    }

    /* Ideia do João: a saída não fica onde o mapa desenha, ela é
       sorteada entre as casas mais distantes do começo. Num jogo
       de ouvido isso fica ainda melhor — não dá pra decorar o
       caminho, tem que escutar de novo a cada partida. */
    function sortearSaida() {
      const fila = [{ l: jogador.l, c: jogador.c, d: 0 }];
      const vistos = {};
      const candidatas = [];
      vistos[jogador.l + "," + jogador.c] = true;

      while (fila.length) {
        const atual = fila.shift();
        if (atual.d > 0) candidatas.push(atual);
        for (let i = 0; i < VIZINHOS.length; i++) {
          const l = atual.l + VIZINHOS[i][0];
          const c = atual.c + VIZINHOS[i][1];
          const chave = l + "," + c;
          if (ehLivre(l, c) && !vistos[chave]) {
            vistos[chave] = true;
            fila.push({ l: l, c: c, d: atual.d + 1 });
          }
        }
      }

      if (!candidatas.length) {
        saida = { l: jogador.l, c: jogador.c };
        return;
      }
      let maior = 0;
      for (let i = 0; i < candidatas.length; i++) {
        if (candidatas[i].d > maior) maior = candidatas[i].d;
      }
      const longe = candidatas.filter(function (casa) { return casa.d >= maior * 0.6; });
      const escolhida = longe[Math.floor(Math.random() * longe.length)];
      saida = { l: escolhida.l, c: escolhida.c };
    }

    function fasesConcluidas() {
      const salvo = parseInt(lerPreferencia(CHAVE_FASES), 10);
      return isNaN(salvo) ? 0 : Math.max(0, Math.min(MAPAS.length, salvo));
    }

    /* --- cores: saem dos tokens, então o alto contraste vale aqui --- */
    let coresSalvas = null;
    let contrasteSalvoNoDesenho = null;

    function cores() {
      const alto = corpo.classList.contains("alto-contraste");
      if (coresSalvas && contrasteSalvoNoDesenho === alto) return coresSalvas;
      const estilo = getComputedStyle(corpo);
      function token(nome, reserva) {
        const valor = estilo.getPropertyValue(nome).trim();
        return valor || reserva;
      }
      contrasteSalvoNoDesenho = alto;
      coresSalvas = {
        fundo: token("--cor-fundo", "#080a11"),
        parede: token("--cor-borda", "#252a37"),
        rastro: token("--cor-texto-suave", "#a3a9b7"),
        acento: token("--cor-acento", "#f5b942"),
        texto: token("--cor-texto", "#f0f2f7"),
        alto: alto
      };
      return coresSalvas;
    }

    let larguraAnterior = 0;
    let alturaAnterior = 0;

    // Altura máxima do tabuleiro. Sem isso a célula cresce junto com a
    // largura da tela e um labirinto pequeno vira um paredão de 800px.
    const ALTURA_MAXIMA = 380;

    /* A bola desliza entre as casas. A grade continua sendo de passos
       inteiros — o jogo não muda, só o desenho interpola. No alto
       contraste e em prefers-reduced-motion ela salta direto. */
    const suave = { l: 0, c: 0 };
    let quadroSuave = 0;

    function pousarBola() {
      suave.l = jogador.l;
      suave.c = jogador.c;
      if (quadroSuave) {
        window.cancelAnimationFrame(quadroSuave);
        quadroSuave = 0;
      }
    }

    function deslizarBola() {
      if (prefereMenosMovimento || corpo.classList.contains("alto-contraste")) {
        pousarBola();
        desenhar();
        return;
      }
      if (quadroSuave) return;

      function passo() {
        quadroSuave = 0;
        const dl = jogador.l - suave.l;
        const dc = jogador.c - suave.c;
        if (Math.abs(dl) < 0.004 && Math.abs(dc) < 0.004) {
          pousarBola();
          desenhar();
          return;
        }
        suave.l += dl * 0.3;
        suave.c += dc * 0.3;
        desenhar();
        quadroSuave = window.requestAnimationFrame(passo);
      }
      quadroSuave = window.requestAnimationFrame(passo);
    }

    function desenhar() {
      if (!grade.length) return;
      const c = cores();
      const linhas = grade.length;
      const colunas = grade[0].length;
      // Mede pela COLUNA do mapa, não pela moldura: a moldura encolhe junto
      // com o canvas e realimentaria o observador de tamanho. A mesa inteira
      // também não serve — em duas colunas ela é bem mais larga que o mapa.
      const coluna = arena.closest(".lab-coluna-mapa");
      const disponivel = Math.max(
        240,
        (coluna && coluna.clientWidth) || (mesa && mesa.clientWidth) || arena.clientWidth || 640
      );
      const celula = Math.min(disponivel / colunas, ALTURA_MAXIMA / linhas);
      const largura = celula * colunas;
      const altura = celula * linhas;

      // Só mexe no tamanho do canvas quando ele mudou de verdade:
      // trocar width/height limpa o contexto e faz piscar.
      if (Math.abs(largura - larguraAnterior) > 0.5 || Math.abs(altura - alturaAnterior) > 0.5) {
        const densidade = window.devicePixelRatio || 1;
        tela.style.width = largura + "px";
        tela.style.height = altura + "px";
        tela.width = Math.round(largura * densidade);
        tela.height = Math.round(altura * densidade);
        pincel.setTransform(densidade, 0, 0, densidade, 0, 0);
        larguraAnterior = largura;
        alturaAnterior = altura;
      }

      pincel.clearRect(0, 0, largura, altura);
      pincel.fillStyle = c.fundo;
      pincel.fillRect(0, 0, largura, altura);

      function paredeVisivel(l, col) {
        return grade[l][col] === "#" && (mostrarMapa || paredesVistas[l + "," + col]);
      }

      function pisada(l, col) {
        return grade[l][col] !== "#" && !!chaoPisado[l + "," + col];
      }

      // 1. A parede: cada casa é um bloco próprio, com uma fresta escura
      //    entre ela e a vizinha. Coladas, viravam uma mancha só e não se
      //    conseguia contar as casas; a fresta devolve a leitura de grade.
      //    Sem pontes: eram elas que serrilhavam os cantos.
      const folgaParede = Math.max(0.5, celula * 0.09);
      const ladoParede = celula - folgaParede * 2;
      const raioParede = Math.max(1, celula * 0.2);
      pincel.fillStyle = c.parede;
      for (let l = 0; l < linhas; l++) {
        for (let col = 0; col < colunas; col++) {
          if (!paredeVisivel(l, col)) continue;

          // A moldura externa do labirinto é estrutura, não obstáculo de
          // percurso: ela recua para que as paredes internas saltem.
          const borda = l === 0 || col === 0 || l === linhas - 1 || col === colunas - 1;
          pincel.globalAlpha = c.alto ? 1 : (borda ? 0.42 : 1);

          const x = col * celula + folgaParede;
          const y = l * celula + folgaParede;
          pincel.beginPath();
          if (pincel.roundRect) pincel.roundRect(x, y, ladoParede, ladoParede, raioParede);
          else pincel.rect(x, y, ladoParede, ladoParede);
          pincel.fill();
        }
      }
      pincel.globalAlpha = 1;

      // 2. O caminho já andado: uma LINHA âmbar ligando os pontos das
      //    casas por onde a pessoa passou. Antes era uma faixa preenchida
      //    e, transparente sobre o fundo, saía num tom terroso sujo.
      //    Linha fina e ponto cheio: contraste limpo e a leitura de
      //    percurso "ponto a ponto".
      const centro = function (l, col) {
        return { x: col * celula + celula / 2, y: l * celula + celula / 2 };
      };

      pincel.strokeStyle = c.acento;
      pincel.globalAlpha = c.alto ? 1 : 0.45;
      pincel.lineWidth = Math.max(1.5, celula * 0.1);
      pincel.lineCap = "round";
      pincel.beginPath();
      for (let l = 0; l < linhas; l++) {
        for (let col = 0; col < colunas; col++) {
          if (!pisada(l, col)) continue;
          const a = centro(l, col);
          if (col + 1 < colunas && pisada(l, col + 1)) {
            const b = centro(l, col + 1);
            pincel.moveTo(a.x, a.y);
            pincel.lineTo(b.x, b.y);
          }
          if (l + 1 < linhas && pisada(l + 1, col)) {
            const b = centro(l + 1, col);
            pincel.moveTo(a.x, a.y);
            pincel.lineTo(b.x, b.y);
          }
        }
      }
      pincel.stroke();
      pincel.globalAlpha = 1;

      pincel.fillStyle = c.acento;
      pincel.globalAlpha = c.alto ? 1 : 0.85;
      for (let l = 0; l < linhas; l++) {
        for (let col = 0; col < colunas; col++) {
          if (!pisada(l, col)) continue;
          const a = centro(l, col);
          pincel.beginPath();
          pincel.arc(a.x, a.y, Math.max(1.5, celula * 0.11), 0, Math.PI * 2);
          pincel.fill();
        }
      }
      pincel.globalAlpha = 1;

      // Contorno da sala: diz o tamanho do labirinto sem entregar as paredes
      if (c.alto) {
        pincel.strokeStyle = c.rastro;
        pincel.lineWidth = 1;
        pincel.strokeRect(0.5, 0.5, largura - 1, altura - 1);
      }

      // A saída só aparece com o mapa aberto (ou depois de vencer).
      // Enquanto o mapa está fechado, ela é só som e texto.
      if (mostrarMapa || venceu) {
        const sx = saida.c * celula + celula / 2;
        const sy = saida.l * celula + celula / 2;
        pincel.strokeStyle = c.acento;
        pincel.lineWidth = Math.max(2, celula * 0.09);
        pincel.beginPath();
        pincel.arc(sx, sy, celula * 0.34, 0, Math.PI * 2);
        pincel.stroke();
        pincel.fillStyle = c.acento;
        pincel.font = "700 " + Math.max(10, Math.round(celula * 0.46)) + "px " +
          getComputedStyle(corpo).fontFamily;
        pincel.textAlign = "center";
        pincel.textBaseline = "middle";
        pincel.fillText("★", sx, sy + celula * 0.02);
      }

      // A pessoa: círculo âmbar com anel, pra separar do fundo
      // mesmo quando cai em cima da saída. Usa a posição SUAVE, não a da
      // grade: é ela que faz a bola deslizar de uma casa para a outra.
      const px = suave.c * celula + celula / 2;
      const py = suave.l * celula + celula / 2;
      pincel.fillStyle = c.acento;
      pincel.beginPath();
      pincel.arc(px, py, Math.max(4, celula * 0.28), 0, Math.PI * 2);
      pincel.fill();
      pincel.strokeStyle = c.texto;
      pincel.lineWidth = Math.max(1.5, celula * 0.06);
      pincel.stroke();
    }

    /* --- texto: tudo que o som diz, o painel também diz --- */
    function descreverDirecao(dl, dc) {
      const partes = [];
      if (dc > 0) partes.push("à direita");
      else if (dc < 0) partes.push("à esquerda");
      if (dl > 0) partes.push("abaixo");
      else if (dl < 0) partes.push("acima");
      if (!partes.length) return "bem aqui";
      return partes.join(" e ");
    }

    function medidas() {
      const dl = saida.l - jogador.l;
      const dc = saida.c - jogador.c;
      const casas = Math.abs(dl) + Math.abs(dc);
      const maximo = grade.length + grade[0].length;
      return {
        dl: dl,
        dc: dc,
        casas: casas,
        // 0 = longe, 1 = em cima da saída
        forca: Math.max(0, Math.min(1, 1 - casas / maximo)),
        lado: dc / Math.max(1, Math.abs(dl) + Math.abs(dc))
      };
    }

    function pintarPainel() {
      const m = medidas();
      if (elPassos) elPassos.textContent = String(passos);
      if (elDirecao) elDirecao.textContent = descreverDirecao(m.dl, m.dc);
      if (elDistancia) {
        elDistancia.textContent = m.casas === 1 ? "1 casa" : m.casas + " casas";
      }
      if (elMedidor) elMedidor.style.width = Math.round(m.forca * 100) + "%";
    }

    function dizer(mensagem) {
      if (elEstado) elEstado.textContent = mensagem;
      anunciar(mensagem);
    }

    function resumo() {
      const m = medidas();
      return "A saída está " + descreverDirecao(m.dl, m.dc) + ", a " +
        (m.casas === 1 ? "1 casa" : m.casas + " casas") + ".";
    }

    /* O "pulso": dá um realce curto no farol sem gastar um passo, e diz
       a posição em voz/texto. Serve pra quem está se reorientando — de
       ouvido, parar e escutar de novo é metade do jogo. */
    function pulso(comFala) {
      if (somLigado && audio && farol && jogando && !venceu) {
        const agora = audio.currentTime;
        farolGanho.gain.cancelScheduledValues(agora);
        farolGanho.gain.setTargetAtTime(0.10, agora, 0.015);
        window.setTimeout(atualizarFarol, 240);
      }
      if (comFala) dizer(resumo());
    }

    function mover(dl, dc) {
      if (!jogando || venceu) return;
      const l = jogador.l + dl;
      const c = jogador.c + dc;

      if (!ehLivre(l, c)) {
        paredesVistas[l + "," + c] = true;
        tocar(90, 0.18, "square", 0.09, dc);
        dizer("Parede " + descreverDirecao(dl, dc) + ". " + resumo());
        desenhar();
        return;
      }

      jogador = { l: l, c: c };
      chaoPisado[l + "," + c] = true;
      passos += 1;
      tocar(150, 0.07, "triangle", 0.045, 0);

      if (jogador.l === saida.l && jogador.c === saida.c) {
        vencer();
        return;
      }

      pintarPainel();
      atualizarFarol();
      dizer(resumo());
      deslizarBola();
    }

    function vencer() {
      venceu = true;
      jogando = false;
      atualizarFarol(); // cala o farol antes do arpejo
      passos += 1;
      pintarPainel();
      deslizarBola();

      const concluidas = fasesConcluidas();
      if (fase + 1 > concluidas) salvarPreferencia(CHAVE_FASES, String(fase + 1));
      montarListaDeFases();

      const ultima = fase >= MAPAS.length - 1;
      if (elVitoriaTexto) {
        elVitoriaTexto.textContent = "Fase " + (fase + 1) + " concluída em " + passos +
          (passos === 1 ? " passo." : " passos.");
      }
      if (btnProxima) {
        btnProxima.textContent = ultima ? "Jogar de novo" : "Próxima fase";
      }
      if (vitoria) vitoria.hidden = false;

      // Arpejo curto de vitória (só se a pessoa ligou o som)
      tocar(392, 0.14, "sine", 0.07, 0);
      window.setTimeout(function () { tocar(523, 0.16, "sine", 0.075, 0); }, 130);
      window.setTimeout(function () { tocar(659, 0.28, "sine", 0.08, 0); }, 280);

      dizer("Você encontrou a saída! Fase " + (fase + 1) + " concluída em " + passos +
        (passos === 1 ? " passo." : " passos."));
      if (btnProxima) window.setTimeout(function () { btnProxima.focus(); }, 120);
    }

    function carregarFase(indice, anunciarEntrada) {
      fase = Math.max(0, Math.min(MAPAS.length - 1, indice));
      grade = MAPAS[fase].map(function (linha) { return linha.split(""); });
      paredesVistas = {};
      chaoPisado = {};
      passos = 0;
      venceu = false;
      jogando = true;

      for (let l = 0; l < grade.length; l++) {
        for (let c = 0; c < grade[l].length; c++) {
          if (grade[l][c] === "P") {
            jogador = { l: l, c: c };
            grade[l][c] = " ";
          }
        }
      }
      sortearSaida();
      chaoPisado[jogador.l + "," + jogador.c] = true;

      if (elFase) elFase.textContent = String(fase + 1);
      if (vitoria) vitoria.hidden = true;
      pintarPainel();
      montarListaDeFases();
      pousarBola();
      desenhar();

      if (anunciarEntrada) {
        dizer("Fase " + (fase + 1) + " de " + MAPAS.length + ". " + resumo());
        atualizarFarol();
      } else if (elEstado) {
        elEstado.textContent = resumo();
      }
    }

    function montarListaDeFases() {
      if (!listaFases) return;
      const concluidas = fasesConcluidas();
      listaFases.innerHTML = "";

      for (let i = 0; i < MAPAS.length; i++) {
        const liberada = i === 0 || i <= concluidas;
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "lab-fase-botao";
        botao.setAttribute("data-fase", String(i));

        // Nunca só pela cor: o estado vai escrito no próprio botão.
        const situacao = i === fase ? "atual" : liberada ? "aberta" : "bloqueada";
        botao.classList.toggle("lab-fase-atual", i === fase);
        botao.classList.toggle("lab-fase-presa", !liberada);
        botao.innerHTML = '<span class="lab-fase-numero">' + (i + 1) + "</span>" +
          '<span class="lab-fase-situacao">' + situacao + "</span>";
        botao.setAttribute("aria-label", "Fase " + (i + 1) + " — " + situacao);
        if (i === fase) botao.setAttribute("aria-current", "true");

        if (!liberada) {
          botao.disabled = true;
        } else {
          botao.addEventListener("click", function () {
            carregarFase(Number(this.getAttribute("data-fase")), true);
            focarArena();
          });
        }
        listaFases.appendChild(botao);
      }
    }

    /* Aviso de foco: as setas só andam com o painel focado (é a regra que
       impede o jogo de sequestrar as teclas de quem está lendo a página).
       Em vez de deixar a pessoa apertando seta sem resposta, o quadro diz. */
    const avisoFoco = document.getElementById("lab-foco");

    function pintarAvisoFoco() {
      if (!avisoFoco || !mesa || mesa.hidden) return;
      // O próprio aviso conta como FORA: ele é visibility:hidden quando
      // some, e some no focusin do clique — o mouseup caía num elemento
      // já invisível e o click nunca completava, então clicar no aviso
      // não devolvia o foco. Enquanto ele estiver focado, fica visível.
      const dentro = palco.contains(document.activeElement) &&
        document.activeElement !== avisoFoco;
      avisoFoco.classList.toggle("lab-foco-ativo", !dentro);
    }

    document.addEventListener("focusin", pintarAvisoFoco);
    document.addEventListener("focusout", function () {
      window.setTimeout(pintarAvisoFoco, 0);
    });
    if (avisoFoco) {
      avisoFoco.addEventListener("click", function () {
        focarArena();
      });
    }

    function focarArena() {
      window.setTimeout(function () {
        // preventScroll: focar o canvas dava um tranco na página, e ele
        // já está à vista quando alguém clica em jogar / trocar de fase.
        try { tela.focus({ preventScroll: true }); } catch (erro) { tela.focus(); }
      }, 60);
    }

    function comecar(comSom) {
      somLigado = !!comSom;
      if (somLigado && !ligarAudio()) {
        somLigado = false;
        mostrarToast("Seu navegador não oferece o áudio do jogo.");
      }
      if (portao) portao.hidden = true;
      if (mesa) mesa.hidden = false;
      pintarBotaoSom();
      carregarFase(fasesConcluidas() >= MAPAS.length ? 0 : fasesConcluidas(), true);
      focarArena();
      window.setTimeout(pintarAvisoFoco, 60);
    }

    function pintarBotaoSom() {
      if (!btnSom) return;
      btnSom.setAttribute("aria-pressed", String(somLigado));
      btnSom.textContent = somLigado ? "Som: ligado" : "Som: desligado";
    }

    function pintarBotaoMapa() {
      if (!btnMapa) return;
      btnMapa.setAttribute("aria-pressed", String(mostrarMapa));
      btnMapa.textContent = mostrarMapa ? "Mapa: aberto" : "Mapa: fechado";
    }

    /* --- ligações --- */
    if (elTotal) elTotal.textContent = String(MAPAS.length);

    const btnComSom = document.getElementById("lab-comecar-som");
    const btnSemSom = document.getElementById("lab-comecar-mudo");
    if (btnComSom) btnComSom.addEventListener("click", function () { comecar(true); });
    if (btnSemSom) btnSemSom.addEventListener("click", function () { comecar(false); });

    if (btnSom) {
      btnSom.addEventListener("click", function () {
        somLigado = !somLigado;
        if (somLigado && !ligarAudio()) somLigado = false;
        if (!somLigado) desligarAudio();
        pintarBotaoSom();
        dizer(somLigado ? "Som ligado." : "Som desligado. O painel continua dizendo a direção.");
        if (somLigado) atualizarFarol();
      });
    }

    if (btnMapa) {
      btnMapa.addEventListener("click", function () {
        mostrarMapa = !mostrarMapa;
        pintarBotaoMapa();
        desenhar();
        dizer(mostrarMapa
          ? "Mapa aberto: as paredes e a saída estão desenhadas."
          : "Mapa fechado: só aparece o caminho que você já andou.");
      });
    }

    if (btnPulso) {
      btnPulso.addEventListener("click", function () {
        if (!jogando) return;
        pulso(true);
      });
    }

    if (btnReiniciar) {
      btnReiniciar.addEventListener("click", function () {
        carregarFase(fase, true);
        focarArena();
      });
    }

    if (btnProxima) {
      btnProxima.addEventListener("click", function () {
        carregarFase(fase >= MAPAS.length - 1 ? 0 : fase + 1, true);
        focarArena();
      });
    }

    // Botões de direção na tela: fazem o jogo funcionar no celular
    // e dão um alvo de Tab pra quem não usa as setas.
    const teclas = Array.prototype.slice.call(palco.querySelectorAll("[data-mover]"));
    for (let i = 0; i < teclas.length; i++) {
      teclas[i].addEventListener("click", function () {
        const passo = {
          cima: [-1, 0], baixo: [1, 0], esquerda: [0, -1], direita: [0, 1]
        }[this.getAttribute("data-mover")];
        if (passo) mover(passo[0], passo[1]);
      });
    }

    /* Atalhos presos ao painel do jogo, nunca ao documento: as setas são
       de quem está lendo a página até o foco entrar aqui. */
    palco.addEventListener("keydown", function (evento) {
      const alvo = evento.target;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable)) return;

      const setas = {
        ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]
      };
      if (setas[evento.key]) {
        evento.preventDefault();
        mover(setas[evento.key][0], setas[evento.key][1]);
        return;
      }

      const tecla = (evento.key || "").toLowerCase();
      if (tecla === "p") {
        evento.preventDefault();
        if (jogando) pulso(true);
        return;
      }
      if (tecla === "m" && btnMapa) {
        evento.preventDefault();
        btnMapa.click();
      }
    });

    // Redesenha quando a caixa muda de largura (A+/A−, girar o celular,
    // recolher a nav). Observa a MOLDURA, não o canvas: mexer na altura
    // do canvas realimentaria o observador.
    let mesaAnterior = 0;
    function conferirLargura() {
      const atual = (mesa && mesa.clientWidth) || 0;
      if (Math.abs(atual - mesaAnterior) < 1) return;
      mesaAnterior = atual;
      desenhar();
    }
    if (window.ResizeObserver && mesa) {
      new ResizeObserver(conferirLargura).observe(mesa);
    } else {
      window.addEventListener("resize", conferirLargura);
    }

    // O alto contraste troca os tokens: joga fora as cores guardadas
    // e redesenha com a paleta nova.
    if (window.MutationObserver) {
      new MutationObserver(function () {
        coresSalvas = null;
        desenhar();
      }).observe(corpo, { attributes: true, attributeFilter: ["class"] });
    }

    pintarBotaoSom();
    pintarBotaoMapa();
    montarListaDeFases();
  })();

  /* ---------------------------------------------------------
     7g. Semáforo de demonstração (cidade.html).
     Mostra a "redundância da informação" do trabalho do Marcos
     e do Lucas: a mesma mensagem em três canais ao mesmo tempo
     — posição, símbolo e texto. O botão "Desligar a cor" apaga
     só o canal da cor, e os outros dois seguem funcionando.

     Nada aqui depende de ver: os três canais viram texto no
     <dl> ao lado e vão para o aria-live a cada troca.
  --------------------------------------------------------- */
  (function semaforoDemo() {
    const palco = document.getElementById("semaforo-demo");
    if (!palco) return;

    const ESTADOS = {
      pare: { luz: "pare", posicao: "luz de cima", simbolo: "✕", mensagem: "Pare" },
      atencao: { luz: "atencao", posicao: "luz do meio", simbolo: "!", mensagem: "Atenção" },
      siga: { luz: "siga", posicao: "luz de baixo", simbolo: "↑", mensagem: "Siga" }
    };

    const luzes = Array.prototype.slice.call(palco.querySelectorAll(".semaforo-luz"));
    const botoes = Array.prototype.slice.call(palco.querySelectorAll("[data-estado]"));
    const btnCor = document.getElementById("semaforo-sem-cor");
    const elPosicao = document.getElementById("semaforo-posicao");
    const elSimbolo = document.getElementById("semaforo-simbolo-texto");
    const elMensagem = document.getElementById("semaforo-mensagem");

    let atual = "pare";
    let semCor = false;

    function pintar(anunciarTroca) {
      const e = ESTADOS[atual];
      if (!e) return;

      for (let i = 0; i < luzes.length; i++) {
        luzes[i].classList.toggle("acesa", luzes[i].getAttribute("data-luz") === e.luz);
      }
      for (let i = 0; i < botoes.length; i++) {
        botoes[i].setAttribute("aria-pressed", String(botoes[i].getAttribute("data-estado") === atual));
      }
      if (elPosicao) elPosicao.textContent = e.posicao;
      if (elSimbolo) elSimbolo.textContent = e.simbolo;
      if (elMensagem) elMensagem.textContent = e.mensagem;

      if (anunciarTroca) {
        anunciar(e.mensagem + ". " + e.posicao + ", símbolo " + e.simbolo +
          (semCor ? ", sem cor." : "."));
      }
    }

    for (let i = 0; i < botoes.length; i++) {
      botoes[i].addEventListener("click", function () {
        atual = this.getAttribute("data-estado");
        pintar(true);
      });
    }

    if (btnCor) {
      btnCor.addEventListener("click", function () {
        semCor = !semCor;
        palco.classList.toggle("sem-cor", semCor);
        btnCor.setAttribute("aria-pressed", String(semCor));
        btnCor.textContent = semCor ? "Devolver a cor" : "Desligar a cor";
        anunciar(semCor
          ? "Cor desligada. A posição e o símbolo continuam dizendo: " + ESTADOS[atual].mensagem + "."
          : "Cor devolvida.");
      });
    }

    pintar(false);
  })();
  /* ---------------------------------------------------------
     7h. A rota do AcessiCar (tecnologia.html): o trilho se
     preenche conforme a pessoa rola e cada parada acende ao
     ser alcançada. É enfeite — o texto e a ordem já estão no
     HTML (<ol>), então quem não vê a animação não perde nada.
     No alto contraste e no "reduzir movimento", o trajeto já
     nasce inteiro aceso e não há listener de scroll.
  --------------------------------------------------------- */
  (function rotaConceito() {
    // Serve para QUALQUER .rota-palco da página: o trajeto do AcessiCar e
    // a linha do tempo das leis usam o mesmo componente.
    const palcos = Array.prototype.slice.call(document.querySelectorAll(".rota-palco"));
    if (!palcos.length) return;

    palcos.forEach(function (palco) {
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
    // O olho entra por ÚLTIMO: no desktop ele fica no alto à direita e, pela
    // ordem vertical, roubaria a entrada do título. Ele acompanha, não compete.
    elementosDoHero
      .filter(function (e) { return e.classList.contains("hero-visual"); })
      .forEach(function (e) {
        elementosDoHero.splice(elementosDoHero.indexOf(e), 1);
        elementosDoHero.push(e);
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
     9c. Ritmo das seções (redesign de motion)
     Marca cada <section class="secao"> com .secao-vista quando ela
     entra na tela — UMA vez. O CSS usa isso para abrir a divisória
     e crescer as barras do rótulo: a passagem de uma seção para a
     outra vira progressão, não corte. Nenhum conteúdo depende disso
     (é decoração de borda) e, no alto contraste / redução de
     movimento, as regras da camada 21.z anulam tudo.
  --------------------------------------------------------- */
  // Espera a revelação do site ("aviso primeiro") antes de observar:
  // durante o pre-aviso a página está invisível e a entrada se perderia.
  function quandoRevelado(acao) {
    if (!raiz.classList.contains("pre-aviso")) { acao(); return; }
    if (!("MutationObserver" in window)) { window.setTimeout(acao, 900); return; }
    const vigia = new MutationObserver(function () {
      if (!raiz.classList.contains("pre-aviso")) { vigia.disconnect(); acao(); }
    });
    vigia.observe(raiz, { attributes: true, attributeFilter: ["class"] });
  }

  // Embrulha cada palavra de um título num <span class="palavra"> para a
  // revelação escalonada. Os espaços continuam sendo nós de texto e os
  // elementos filhos (ex.: <span class="acento">) entram inteiros, então
  // o leitor de tela continua lendo a frase normalmente.
  function fatiarTitulo(titulo) {
    if (!titulo || titulo.dataset.fatiado === "1") return;
    titulo.dataset.fatiado = "1";
    const pedacos = document.createDocumentFragment();
    let ordem = 0;
    Array.prototype.slice.call(titulo.childNodes).forEach(function (no) {
      if (no.nodeType === 3) {
        no.textContent.split(/(\s+)/).forEach(function (parte) {
          if (!parte) return;
          if (/^\s+$/.test(parte)) { pedacos.appendChild(document.createTextNode(parte)); return; }
          const palavra = document.createElement("span");
          palavra.className = "palavra";
          palavra.textContent = parte;
          palavra.style.transitionDelay = (ordem++ * 45) + "ms";
          pedacos.appendChild(palavra);
        });
      } else if (no.nodeType === 1) {
        no.classList.add("palavra");
        no.style.transitionDelay = (ordem++ * 45) + "ms";
        pedacos.appendChild(no);
      } else {
        pedacos.appendChild(no);
      }
    });
    titulo.textContent = "";
    titulo.appendChild(pedacos);
  }

  (function ritmoDasSecoes() {
    const secoes = document.querySelectorAll(".secao, .hero");
    if (!secoes.length) return;

    if (!prefereMenosMovimento && !corpo.classList.contains("alto-contraste")) {
      document.querySelectorAll(".secao h2, .pagina-topo h1").forEach(fatiarTitulo);
    }

    function acenderTodas() {
      secoes.forEach(function (s) { s.classList.add("secao-vista"); });
    }

    if (prefereMenosMovimento || corpo.classList.contains("alto-contraste")) {
      acenderTodas();
      return;
    }

    // Verificação por scroll (mesma técnica dos contadores e da rota):
    // simples, à prova de falhas e sem depender de IntersectionObserver.
    const pendentes = Array.prototype.slice.call(secoes);
    let tickSecao = false;

    function verificar() {
      for (let i = pendentes.length - 1; i >= 0; i--) {
        const r = pendentes[i].getBoundingClientRect();
        if (r.top < window.innerHeight * 0.9 && r.bottom > 0) {
          pendentes[i].classList.add("secao-vista");
          pendentes.splice(i, 1);
        }
      }
      if (!pendentes.length) {
        window.removeEventListener("scroll", aoRolarSecao);
        window.removeEventListener("resize", aoRolarSecao);
      }
    }

    function aoRolarSecao() {
      if (tickSecao) return;
      tickSecao = true;
      window.requestAnimationFrame(function () { tickSecao = false; verificar(); });
    }

    quandoRevelado(function () {
      window.addEventListener("scroll", aoRolarSecao, { passive: true });
      window.addEventListener("resize", aoRolarSecao);
      verificar();
    });

    // Ligou o alto contraste no meio do caminho: tudo aceso e estável.
    document.addEventListener("click", function (evento) {
      if (evento.target && evento.target.closest && evento.target.closest("#btn-contraste")) {
        window.setTimeout(function () {
          if (corpo.classList.contains("alto-contraste")) acenderTodas();
        }, 60);
      }
    });
  })();

  /* ---------------------------------------------------------
     9d. Trilha de pontos do scroll
     Uma coluna de pontos à direita, um por seção, que acende
     conforme a página avança — a leitura "ponto a ponto" da
     própria página. É DECORATIVA: aria-hidden, sem clique e sem
     parada de teclado; a navegação real segue no cabeçalho e no
     rodapé. Só aparece em telas largas (CSS).
  --------------------------------------------------------- */
  (function trilhaDePontos() {
    const secoes = Array.prototype.slice.call(
      document.querySelectorAll("main > .secao, main > .hero")
    );
    if (secoes.length < 2) return;

    const trilha = document.createElement("div");
    trilha.className = "trilha-pontos";
    trilha.setAttribute("aria-hidden", "true");
    const pontos = secoes.map(function () {
      const ponto = document.createElement("span");
      ponto.className = "trilha-ponto";
      trilha.appendChild(ponto);
      return ponto;
    });
    corpo.appendChild(trilha);

    let tick = false;
    function pintar() {
      const linha = window.innerHeight * 0.45;
      for (let i = 0; i < secoes.length; i++) {
        pontos[i].classList.toggle("aceso", secoes[i].getBoundingClientRect().top <= linha);
      }
    }
    function aoRolar() {
      if (tick) return;
      tick = true;
      window.requestAnimationFrame(function () { tick = false; pintar(); });
    }
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    pintar();
  })();

  /* ---------------------------------------------------------
     9e. Transição entre páginas
     Sair usa a mesma linguagem da entrada (desfoque + fade), pra
     o portal parecer um lugar só. Vale apenas para links internos
     e simples: com Ctrl/Cmd/Shift, target, âncora, e-mail ou link
     externo, o navegador age normalmente. Desligada no alto
     contraste e na redução de movimento.
  --------------------------------------------------------- */
  (function transicaoDePagina() {
    if (prefereMenosMovimento) return;

    document.addEventListener("click", function (evento) {
      if (evento.defaultPrevented || evento.button !== 0) return;
      if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
      if (corpo.classList.contains("alto-contraste")) return;
      const link = evento.target.closest && evento.target.closest("a[href]");
      if (!link) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      const href = link.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#" || /^[a-z]+:/i.test(href)) return;
      if (link.href.split("#")[0] === window.location.href.split("#")[0]) return;
      evento.preventDefault();
      raiz.classList.add("saindo");
      const destino = link.href;
      window.setTimeout(function () { window.location.href = destino; }, 240);
    });

    // Voltar pelo histórico não pode deixar a página apagada (bfcache)
    window.addEventListener("pageshow", function () {
      raiz.classList.remove("saindo");
    });
  })();

  /* ---------------------------------------------------------
     9g. Índice das seções (01, 02, 03…)
     Numeração decorativa na etiqueta de cada seção: ritmo
     editorial. aria-hidden — o leitor de tela não lê número
     nenhum a mais.
  --------------------------------------------------------- */
  /* ---------------------------------------------------------
     9f. Índice em Braille da seção "Explorar"
     Troca o numeral vazado pela CELA BRAILLE da inicial do item
     (B de Braille, J de Jogos…) e marca com um selo os destinos
     que ainda levam ao "em breve". A cela é decorativa — o span
     já é aria-hidden no HTML —, o selo NÃO é: quem usa leitor de
     tela também precisa saber que a página ainda está em obras.
  --------------------------------------------------------- */
  (function indiceEmBraille() {
    const linhas = document.querySelectorAll(".lista-linhas .linha");
    if (!linhas.length) return;

    linhas.forEach(function (linha) {
      const numero = linha.querySelector(".linha-numero");
      const titulo = linha.querySelector(".linha-titulo");
      if (!numero || !titulo) return;

      const letra = titulo.textContent.trim().charAt(0).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const pontos = MAPA_BRAILLE[letra];

      if (pontos) {
        numero.textContent = "";
        numero.classList.add("linha-cela");
        numero.title = letra.toUpperCase() + " em Braille";
        ORDEM_CELA.forEach(function (n) {
          const ponto = document.createElement("span");
          ponto.className = "linha-ponto" + (pontos.indexOf(n) !== -1 ? " cheio" : "");
          numero.appendChild(ponto);
        });
      }

      const destino = linha.getAttribute("href") || "";
      if (destino.indexOf("em-breve") === 0 && !titulo.querySelector(".linha-selo")) {
        const selo = document.createElement("span");
        selo.className = "linha-selo";
        selo.textContent = "em breve";
        titulo.appendChild(selo);
        linha.classList.add("linha-em-breve");
      }
    });
  })();

  /* ---------------------------------------------------------
     9k. O traço da nav segue o ponteiro
     Um único traço âmbar mora na barra e desliza entre os itens:
     descansa na página atual, vai até o item sob o ponteiro ou
     sob o foco, e volta quando eles saem. Só liga se a nav do topo
     existir E houver um link com aria-current — assim, sem JS, o
     sublinhado nativo continua marcando a página.
  --------------------------------------------------------- */
  (function tracoDaNav() {
    const lista = document.querySelector(".pilula-nav .menu");
    if (!lista) return;

    const links = Array.prototype.slice.call(lista.querySelectorAll("a"));
    const atual = lista.querySelector('a[aria-current="page"]');
    if (!links.length || !atual) return;

    const marcador = document.createElement("span");
    marcador.className = "menu-marcador";
    marcador.setAttribute("aria-hidden", "true");
    lista.appendChild(marcador);
    lista.classList.add("nav-com-marcador");

    let quadro = 0;

    // O traço tem a largura do TEXTO, não a da área clicável:
     // por isso o padding lateral do link é descontado.
    function mover(link) {
      if (quadro) window.cancelAnimationFrame(quadro);
      quadro = window.requestAnimationFrame(function () {
        quadro = 0;
        const caixa = link.getBoundingClientRect();
        const base = lista.getBoundingClientRect();
        const estilo = window.getComputedStyle(link);
        const recuo = parseFloat(estilo.paddingLeft) || 0;
        const recuoD = parseFloat(estilo.paddingRight) || 0;
        const largura = Math.max(0, caixa.width - recuo - recuoD);
        marcador.style.width = largura + "px";
        marcador.style.transform =
          "translateX(" + (caixa.left - base.left + recuo) + "px)";
      });
    }

    function voltar() { mover(atual); }

    links.forEach(function (link) {
      link.addEventListener("pointerenter", function () { mover(link); });
      link.addEventListener("focus", function () { mover(link); });
      link.addEventListener("blur", voltar);
    });

    lista.addEventListener("pointerleave", voltar);
    window.addEventListener("resize", voltar, { passive: true });

    // Posição inicial: sem transição, para não deslizar ao carregar.
    const guardada = marcador.style.transition;
    marcador.style.transition = "none";
    mover(atual);
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        marcador.style.transition = guardada;
      });
    });

    // As fontes chegam depois e mudam a largura do texto.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(voltar);
    }
  })();

  (function indiceDasSecoes() {
    const rotulos = document.querySelectorAll(".secao .rotulo-secao");
    if (!rotulos.length) return;
    rotulos.forEach(function (rotulo, posicao) {
      if (rotulo.querySelector(".rotulo-indice")) return;
      const indice = document.createElement("span");
      indice.className = "rotulo-indice";
      indice.setAttribute("aria-hidden", "true");
      indice.textContent = ("0" + (posicao + 1)).slice(-2);
      rotulo.insertBefore(indice, rotulo.firstChild);
    });
  })();

  /* ---------------------------------------------------------
     9h. A cabeça do anel: um ponto percorre o progresso
     O ponto é injetado no SVG da marca (funciona em qualquer
     página que tenha o cabeçalho) e anda pelo anel conforme a
     página é rolada.
  --------------------------------------------------------- */
  (function cabecaDoAnel() {
    const svg = document.querySelector(".marca-anel");
    if (!svg || !anelProgresso) return;

    const NS = "http://www.w3.org/2000/svg";
    const cabeca = document.createElementNS(NS, "circle");
    cabeca.setAttribute("class", "anel-cabeca");
    cabeca.setAttribute("r", "2.6");
    cabeca.setAttribute("cx", "22");
    cabeca.setAttribute("cy", "2");
    cabeca.style.opacity = "0";
    svg.appendChild(cabeca);

    let tick = false;
    function pintar() {
      tick = false;
      const st = window.scrollY || raiz.scrollTop || 0;
      const alcance = (raiz.scrollHeight - window.innerHeight) || 1;
      const progresso = Math.min(Math.max(st / alcance, 0), 1);
      const angulo = -Math.PI / 2 + progresso * Math.PI * 2;
      cabeca.setAttribute("cx", (22 + Math.cos(angulo) * 20).toFixed(2));
      cabeca.setAttribute("cy", (22 + Math.sin(angulo) * 20).toFixed(2));
      cabeca.style.opacity = progresso > 0.004 ? "1" : "0";
    }
    function aoRolar() {
      if (tick) return;
      tick = true;
      window.requestAnimationFrame(pintar);
    }
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    pintar();
  })();

  /* ---------------------------------------------------------
     9i. Cartões que respondem à inclinação
     Máximo de ~4°: sugere profundidade e direção sem virar
     brinquedo. Só com ponteiro fino; some ao sair; desligado no
     alto contraste e na redução de movimento.
  --------------------------------------------------------- */
  (function inclinarCartoes() {
    if (prefereMenosMovimento) return;
    if (window.matchMedia && !window.matchMedia("(hover: hover)").matches) return;

    const cartoes = document.querySelectorAll(".cartao");
    if (!cartoes.length) return;
    const LIMITE = 4;

    cartoes.forEach(function (cartao) {
      let tick = false, rx = 0, ry = 0;

      function pintar() {
        tick = false;
        if (corpo.classList.contains("alto-contraste")) { cartao.style.transform = ""; return; }
        cartao.style.transform =
          "perspective(900px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) +
          "deg) translateY(-4px)";
      }

      cartao.addEventListener("pointermove", function (evento) {
        const r = cartao.getBoundingClientRect();
        ry = ((evento.clientX - r.left) / r.width - 0.5) * 2 * LIMITE;
        rx = -((evento.clientY - r.top) / r.height - 0.5) * 2 * LIMITE;
        if (tick) return;
        tick = true;
        window.requestAnimationFrame(pintar);
      }, { passive: true });

      function soltar() { cartao.style.transform = ""; }
      cartao.addEventListener("pointerleave", soltar);
      cartao.addEventListener("blur", soltar, true);
    });
  })();

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
