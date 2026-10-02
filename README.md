# Love Capsule — Cantinho da Lívia

A personalized, interactive web experience built with HTML, CSS and vanilla JavaScript. This portfolio project combines visual storytelling, a capsule claw game and progress-based content discovery.

**[Explore the live demo](https://love-capsule-livia.netlify.app/)**

Developed by **Haly Gabriel Pereira Penedo**, with AI assistance during development and refinement.

## English

### Features

- Responsive layout with chapter navigation.
- Interactive capsule claw game with messages and sound effects.
- Photo galleries, expandable messages and interactive reasons cards.
- Progress tracking and a closing letter unlocked after completing the experience.
- Light and dark themes, music controls and a reduced-motion preference.
- Progress and preferences saved locally in the visitor's browser.

### Technologies

HTML5, CSS3, vanilla JavaScript, browser Web Storage, inline SVG icons and static hosting on Netlify. No framework, database or build step is required.

### Run locally

Download the repository, open a terminal in its root folder and start a local static server. With Python 3 installed:

```bash
python -m http.server 8000
```

Visit `http://localhost:8000`. Google Fonts and remotely hosted images need an internet connection. Audio playback can require a user interaction, depending on the browser.

### Deployment

The demo is hosted on Netlify. Publish the repository root as a static website; no build command is needed. GitHub stores the source code and documentation. Linking the repository to Netlify is optional and is not required to use the current demo.

### Scope and credits

This is a front-end portfolio project. Progress is stored on the current browser and is not synchronized across devices. Content unlocking is an interface feature, not access control.

Image sources and credits are listed in [CREDITOS-IMAGENS.txt](CREDITOS-IMAGENS.txt). The icon license is included in [LICENCA-ICONES.txt](LICENCA-ICONES.txt). Photos, fonts and other third-party assets retain their respective rights and licenses; public availability of this repository does not grant a blanket license to reuse every asset.

## Português

Uma experiência web personalizada que transforma uma homenagem em uma jornada interativa. O projeto reúne narrativa visual, uma máquina de cápsulas e descoberta de conteúdo conforme o visitante avança.

### Funcionalidades

- Layout responsivo com navegação por capítulos.
- Máquina de cápsulas interativa com mensagens e efeitos sonoros.
- Galerias de fotos, mensagens expansíveis e cartões de motivos.
- Acompanhamento do progresso e carta de encerramento liberada ao completar a experiência.
- Temas claro e escuro, controles de música e preferência por movimentos reduzidos.
- Progresso e preferências salvos localmente no navegador do visitante.

### Tecnologias e execução

**HTML5, CSS3 e JavaScript puro**, com Web Storage, ícones SVG e hospedagem estática no Netlify. Não exige framework, banco de dados ou etapa de build.

Para executar, baixe o repositório e, na pasta principal, use `python -m http.server 8000` com Python 3 instalado. Acesse `http://localhost:8000`. Fontes e imagens externas dependem de conexão com a internet; a reprodução de áudio pode exigir uma interação do visitante.

### Estrutura

```text
index.html          Estrutura e conteúdo da experiência
style.css           Layout, temas e estilos responsivos
app.js              Interações, jogo e persistência local
assets/images/      Imagens locais
assets/audio/       Música e efeitos sonoros
_headers            Cabeçalhos de resposta para o Netlify
```

### Desenvolvimento e escopo

Projeto desenvolvido por **Haly Gabriel Pereira Penedo**, com apoio de inteligência artificial no desenvolvimento e refinamento. Demonstra prática em interfaces web, manipulação do DOM, eventos e persistência de estado no navegador.

O progresso não é sincronizado entre dispositivos. O desbloqueio de conteúdo faz parte da experiência visual e não funciona como proteção de acesso. Os créditos de imagens e a licença dos ícones estão nos arquivos indicados acima.

**[Ver demonstração publicada](https://love-capsule-livia.netlify.app/)**
