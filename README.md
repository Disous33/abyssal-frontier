# Abyssal Frontier 0.5 — Living Ocean Update

Simulador naval e jogo de exploração marítima 3D em mundo aberto progressivo construído com React, TypeScript, Three.js, GLSL, Web Audio API e Rapier 3D (WebAssembly).

## Novidades da Edição 0.5 (Living Ocean Update)

- **Porto de Santos Vivo (`src/scene/portOfSantos.ts`)**: Estabelecimentos e NPCs funcionais: **Capitania (Helena Vance)**, **Quadro de Missões**, **Oficina Naval (Tomás Braga)**, **Posto de Abastecimento**, **Loja de Equipamentos (Clara)**, **Mercado Portuário (Bento)**, **Mesa de Carta Náutica** e estivadores em patrulha.
- **Economia, Inventário & Melhorias (`src/sim/economySystem.ts`, `src/components/InventoryEquipmentModal.tsx`)**: Moeda **Créditos Atlânticos (CR)**, carga com limite em `kg`, compra/venda de mercadorias e peças recuperadas, equipamentos de mergulho/sonar e 4 linhas de upgrade do **Aster S-01** (Motor, Casco, Velame e Porão).
- **Campanha Narrativa — *O Sinal do Atlântico* (`src/sim/missionManager.ts`, `src/components/MissionJournalModal.tsx`)**: Sistema completo de missões (`available`, `accepted`, `in_progress`, `completed`, `failed`, `cancelled`) cobrindo entrega, resgate da barcaça abandonada **Nereus-04**, recuperação subaquática na **Laje Norte**, patrulha no Guarujá e pesquisa marítima.
- **Tráfego Marítimo IA & Eventos Dinâmicos (`src/sim/maritimeTraffic.ts`, `src/sim/dynamicEvents.ts`, `src/scene/trafficRenderer.ts`)**: 5 embarcações NPC navegando com luzes de navegação (bombordo/boreste/mastro) e desvio inspirado em RIPEAM/COLREGs, além de 8 tipos de eventos oceânicos dinâmicos (SOS, frente de rajada, carga à deriva, golfinhos, falha mecânica, destroços e contatos Nereus).
- **Sistema de Avarias por Subsistema (`src/sim/damageSystem.ts`)**: Colisões no cais/navios, encalhamento em baixios e tempestades degradam Casco, Motor, Leme, Mastro e Velas com impacto direto na física Rapier 3D e reparo pago no estaleiro ou via Kit de Reparo.
- **Natação & Exploração Subaquática (`src/sim/characterController.ts`, `src/scene/underwaterArea.ts`)**: Entrada na água pelo barco (`U`) ou cais, nado na superfície, mergulho subaquático (`C` descer / `Espaço` subir), controle de oxigênio (45s → 150s com cilindro), névoa e iluminação submarina e coleta de peças/cápsulas da Nereus.
- **Áudio Procedural Expandido & Save Versionado (`src/scene/audioEngine.ts`, `src/services/saveSystem.ts`)**: Canais independentes de mixagem na pausa, rádio VHF e persistência versionada com validação e migração.

## Controles

- **Em Terra / Água**: `WASD` mover · `Shift` correr/nadar rápido · `Espaço` pular / subir na água · `C` mergulhar · `E` interagir / embarcar / coletar submerso
- **No Leme (Aster S-01)**: `W / S` motor · `A / D` leme · `Q / E` escota da vela (`E` no píer desembarca) · `R / F` rizo · `U` saltar na água para mergulho
- **Menus & Sistemas**: `I` Inventário/Porão · `J` Diário de Missões · `M` Carta Náutica · `Tab` Laboratório Naval · `F1` Vetores 3D · `F2` Clima · `F3` Vento · `Esc` Pausa / Salvar

## Testes Automatizados

```bash
npm test
```


## Revisão de estabilidade do ZIP

Esta revisão mantém o porto, o personagem, as embarcações, a pesca, o mergulho e os piratas do projeto enviado. As correções e evidências estão em `RELATORIO_REVISAO.md` e `reports/`.

### Executar e gerar a versão para navegador

Requer Node.js 22.12+ (validado nesta revisão com Node 24.22.1) e npm apenas no ambiente de desenvolvimento:

```bash
npm ci
npm run typecheck
npm test
npm run dev
```

Para produção:

```bash
npm run build
npm run preview
```

O ZIP revisado inclui `dist/` compilado. Publique o conteúdo dessa pasta em hospedagem estática HTTPS. O jogador precisa apenas do navegador com WebGL2 e WebAssembly. Abrir o HTML por `file://` não equivale a servir a aplicação por HTTP(S).

As três famílias de fontes agora são empacotadas localmente, com licenças em `FONT_LICENSES.txt`; não dependem do Google Fonts durante o jogo. Nenhuma chave Gemini ou servidor Express é necessária para esta versão. O lockfile de referência é `package-lock.json`.

O cache PWA funciona no build de produção. Instalação inicial exige conexão; uso offline posterior depende da conclusão do cache e do armazenamento permitido pelo navegador. A renderização WebGL e o funcionamento offline em navegador real ainda precisam de verificação no dispositivo alvo.

O carregamento de dados OSM/Overpass foi tornado opt-in no `GeographicSectorStreamer`, por `setOnlineMapsEnabled(true)`. Essa opção não está exposta na interface atual; a campanha usa a base regional embarcada. Uma futura interface deverá explicar o envio dos limites dos setores do mapa e solicitar consentimento separado antes de ativá-la. O GPS do dispositivo continua opcional e seus valores exatos não integram o estado regional salvo.

Saves antigos v1/v2 são aceitos com saneamento. Saves de versões futuras são recusados para impedir regravação incompatível. Retomar uma sessão de mergulho recoloca o personagem nadando na superfície na mesma posição horizontal; oxigênio e estágio de mergulho não eram persistidos por este formato. Uma sessão de pesca é retomada no barco, preservando as capturas registradas.
