# Teclas pelo Toque

Jogo de digitação acessível: ensina a digitar sem olhar para o teclado, usando o
relevo tátil das teclas **F** e **J** como ponto de partida. Tem seis lições, um
modo de treino com estatísticas e um jogo de velocidade — tudo narrado em voz
alta em português.

**Autor:** Victor Bellin (*Chorão*) — 2º EM, Colégio Cívico-Militar Castro Alves.

## De onde vem este código

Estes arquivos são o **resultado compilado** (build) do projeto original, feito no
Figma Make em React + Vite + Tailwind:

<https://github.com/dgolaus/NaoCHOREASSESEOPODVERCommunity>

Não edite os arquivos em `assets/` diretamente — eles são gerados. Para mudar o
jogo, altere o projeto original e gere um novo build.

## Como gerar o build de novo

```bash
git clone https://github.com/dgolaus/NaoCHOREASSESEOPODVERCommunity.git jogo
cd jogo
git apply /caminho/para/jogos/teclas-pelo-toque/integracao.patch
npm install
npm run build
```

Depois copie **só a pasta `dist/assets/`** para cá:

```bash
cp -r dist/assets /caminho/para/jogos/teclas-pelo-toque/
```

O `index.html` desta pasta já está pronto e commitado — mas ele aponta para os
nomes de arquivo gerados no build (`index-<hash>.css` e `index-<hash>.js`). Se
os hashes saírem diferentes, copie também o `dist/index.html` por cima.

O `integracao.patch` (nesta pasta) contém exatamente as quatro alterações
descritas abaixo, para o build sair idêntico ao que foi testado.

## O que foi ajustado para entrar no Ponto a Ponto

A lógica e o layout do jogo são os originais. As únicas mudanças foram de
integração:

1. **`src/styles/theme.css`** — a paleta passou a usar os tokens do site
   (navy `#080a11` + acento âmbar `#f5b942`), no lugar do preto/dourado padrão.
2. **`index.html`** — `lang="en"` virou `lang="pt-BR"`. Isso importa: o leitor de
   tela lê o idioma declarado, e com `en` o NVDA leria o texto em português com
   voz inglesa. Também saiu o `noindex` e entraram o favicon e as meta tags do site.
3. **`vite.config.ts`** — `base: './'`, porque o jogo é publicado numa subpasta
   e os caminhos dos assets precisam ser relativos.
4. **`src/app/App.tsx`** — só um link "← Ponto a Ponto" no cabeçalho e na tela de
   abertura, para dar saída de volta ao portal.

## Limitação conhecida

O jogo é um aplicativo separado: o **menu de acessibilidade do site** (alto
contraste, A+/A−, "Ouvir esta página") **não alcança esta página**. O jogo tem a
própria narração em voz e é todo navegável por teclado, mas não tem o modo de
alto contraste do Ponto a Ponto.
