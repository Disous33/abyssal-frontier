# ABYSSAL FRONTIER — Revisão do ZIP enviado

## Resultado

Foram mantidos os sistemas e a direção visual do projeto enviado: Porto de Santos, Kael, barcos, pesca, mergulho, submarino, economia, missões e piratas. Esta revisão concentra-se em instalação reproduzível, continuidade de saves, geolocalização e estabilidade do mapa.

Validação executada com Node.js v24.22.1: instalação limpa via `npm ci`, verificação TypeScript e build de produção concluídos. Os 14 casos da suíte existente e 10 novos testes de regressão passaram, totalizando **24 verificações aprovadas**. Os 10 testes novos foram executados antes das correções e falharam nos comportamentos previstos; o relatório anterior foi preservado.

## Correções

| Problema / gatilho | Comportamento corrigido | Evidência |
|---|---|---|
| Instalar com npm: conflito entre Vite 8 e a declaração direta de esbuild 0.25 | Removida a dependência direta não utilizada e incluído lockfile npm consistente. Dependências de servidor/IA sem uso no código também foram removidas. | `reports/install-final.txt` |
| Carregar save de versão futura | O formato desconhecido é recusado, evitando regravação com perda de campos. | Regressão 1 |
| Carregar embarcação com condição incompleta ou upgrade inválido | Condição, cores e melhorias recebem valores finitos e limites; modelos desconhecidos são descartados. | Regressão 2 |
| Capturas, XP ou estado de submarino malformados | Registros inválidos são filtrados; valores numéricos recebem limites e fallback, sem NaN propagado. | Regressão 3 |
| Inventário com itens desconhecidos ou quantidades fracionárias/infinitas | Apenas itens catalogados com quantidades inteiras positivas são restaurados. | Regressão 4 |
| Salvar durante mergulho | A retomada ocorre nadando na superfície, na posição horizontal salva, em vez de colocar o personagem andando debaixo d'água. | Regressão 5 e inspeção do ramo de retomada no motor |
| Callback GPS chegar após desativação | Respostas de sessões encerradas são ignoradas. | Regressão 6 |
| Permissão negada sincronicamente com watch ID zero | O acompanhamento retornado é encerrado corretamente, inclusive nesse caso. Contexto inseguro, sinal inválido e posição antiga também recebem estados próprios. | Regressão 7 |
| Iniciar perto do porto com conexão disponível | O mapa usa dados regionais locais; não realiza requisições automáticas ao Overpass. O acesso online exige opt-in técnico separado, ainda sem controle na interface. | Regressão 8 |
| Recentrar a origem durante navegação | Chaves e posições de setores permanecem referenciadas ao mundo global, evitando recarregar outra região sobre a mesma área. | Regressão 9 |
| Desmontar a cena enquanto chegam respostas do mapa | Requisições são canceladas e respostas atrasadas não recriam geometrias em uma cena já descartada. Timers também são limpos. | Regressão 10 |
| Comprar NEREID e interagir depois com a doca | O callback consulta o estado atual do motor em vez de usar a telemetria inicial capturada no primeiro render React. | Inspeção de fluxo + verificação TypeScript; interação visual ainda pendente |
| Jogar offline com fontes antes carregadas por Google Fonts | Outfit, Plus Jakarta Sans e JetBrains Mono agora fazem parte do build local, com licenças incluídas. | Build e verificação de HTML/CSS produzido |

O cache de desenvolvimento foi desativado para reduzir interferência de service workers durante edição. O cache PWA de produção continua sendo gerado. O script de limpeza agora remove apenas `dist/`, preservando futuros arquivos de servidor que o usuário possa criar.

## Executar

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run preview
```

O ZIP inclui o build em `dist/`. Para jogar sem ferramentas de desenvolvimento, hospede o conteúdo dessa pasta por HTTPS. Não abra o HTML diretamente por `file://`.

O comando de testes utiliza o carregador oficial `node --import tsx`, sem o servidor IPC auxiliar da CLI tsx. A CLI original encontrou uma restrição de socket deste ambiente; isso não impediu os testes executados pelo carregador. Referência: https://github.com/privatenumber/tsx/blob/master/docs/dev-api/node-cli.md .

## Evidências incluídas

- `reports/regressions-before.txt`: os dez comportamentos falhando antes das correções.
- `reports/tests-final.txt`: suíte existente e regressões aprovadas.
- `reports/typecheck-final.txt`: checagem TypeScript sem erros.
- `reports/install-final.txt`: instalação limpa com lockfile.
- `reports/build-final.txt`: build e precache PWA gerados.
- `reports/review-summary.json`: resumo estruturado da revisão.

## Limites desta validação

Não foi executada uma sessão visual 3D em navegador nesta revisão. Portanto, não há aprovação de shaders em GPU, qualidade visual, 60 FPS, compra/entrada no submarino pela interface, permissões reais de localização nem reinício offline de navegador. Os testes GPS usam dados simulados e não acessam a localização do desenvolvedor.

O teste existente cujo nome menciona gráficos verifica configurações e matemática; não é uma prova de renderização. A física de flutuação e combate continua sendo a aproximação do projeto enviado. Correções de colisão com tráfego ainda incluem ajustes diretos de posição/velocidade, e o save não representa a continuidade exata de velocidades, oxigênio ou sessão de pesca. Essas características não foram reescritas como parte desta revisão.

O bundle Rapier continua grande, embora dentro do limite de precache configurado. A geração do service worker foi confirmada; seu funcionamento offline completo depende de um ensaio posterior em HTTPS/localhost com um navegador compatível e armazenamento permitido.
