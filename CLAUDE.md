# Site institucional Samuel Freire

Antes de qualquer mudança, siga as regras do projeto:

@REGRAS.md


---

# Regras gerais de trabalho (padrão dos projetos)

Este bloco soma regras gerais. O `REGRAS.md` (importado acima) **prevalece** em tudo que for específico: sem travessão, tokens, propostas, servidor sem dependências, publicação e git.

### Contexto e documentação principal

- `REGRAS.md`: regras obrigatórias (lidas automaticamente).
- `LEIA-ME.md`: o que é cada pasta (site, servidor, material).
- `material/publicacao.md`: deploy (Swarm, Traefik, ghcr.io, Portainer).
- `03-RECURSOS/ARQUITETURAS/SITE/site-universal.md`: site estático e como vira dist.
- `TYPEBOTS E CONTRATOS MODELOS/`: contratos de clientes; consultar só quando a tarefa pedir, nunca expor.
- `../MIRA/ARQUITETURA-MIRA.md`: estudo da MIRA (a cópia que ficava aqui foi arquivada em 22/10/2026).

### Delegação e modelos

- Escolher sempre o modelo mais barato/rápido que faça a tarefa com qualidade suficiente. Não usar o mais forte para tudo.
- **Opus 5.5 (padrão):** desenvolvimento e design — criação de sites, páginas, criativos, código/HTML/CSS — e também arquitetura, bugs complexos, decisões importantes e revisão crítica.
- **Sonnet 5.5 (intermediário):** tarefas do meio que não são criação — organizar arquivos e pastas, documentação, atualizar fichas e tarefas do vault, processar o inbox, ajustes pequenos de texto.
- **Haiku 5.5 (rápido):** pesquisas simples, resumos, classificação, tarefas repetitivas.
- **Fable 5.1 (mais caro):** só com o ok do Matheus, quando o Opus não der conta.
- Se o ambiente já tiver um modelo configurado, respeitar.
- Subagentes só quando reduzem trabalho, tempo ou contexto. Tarefas independentes em paralelo; dependentes na ordem certa. Especificar o modelo em cada chamada. Nada de vários agentes para uma tarefa simples.

### Economia de contexto e tokens

- Trabalhar com o menor contexto que resolva corretamente: identificar o problema → os arquivos prováveis → ler só o necessário → resolver → verificar de forma objetiva.
- Buscar mais contexto aos poucos, só se precisar. Não abrir dezenas de arquivos "por garantia", não ler arquivos enormes para achar um trecho, não reanalisar o que não tem relação com a tarefa.
- Não repetir informação já conhecida, não rodar comandos para confirmar o óbvio, não gerar explicação longa quando uma curta resolve, não criar documentação desnecessária.
- Antes de criar algo, ver se já existe (arquivo, peça, componente, documentação, Skill) e reutilizar.

### Skills e ferramentas

- Quando uma Skill existente puder resolver ou acelerar a tarefa, procurar com `find-skills`, avaliar se se aplica e usar. Não instalar Skills desnecessárias nem procurar Skill para tarefa trivial.
- **Ponytail:** este projeto tem código. Usar `/ponytail` quando a tarefa pedir abordagem mínima; `/ponytail-review` para revisar overengineering; `/ponytail-audit` para auditar o projeto; `/ponytail-debt` para listar os atalhos marcados; `/ponytail-help` para os comandos.
- YAGNI: nada "para o futuro", nada não pedido, preferir recurso nativo (HTML/CSS) e biblioteca padrão, sem dependência nova para problema simples, sem abstração prematura. Simplicidade sem sacrificar correção nem requisitos.

### Segurança e preservação

- **Nunca apagar** nem sobrescrever arquivos do projeto. Versão nova = arquivo novo; o original fica intacto. Antes de qualquer operação destrutiva ou irreversível, confirmar com o Matheus.
- Atenção especial com: originais e arquivos editáveis (PSD, AI, Figma, SVG), fotos, contratos e documentos de `ADMIN`, backups, configurações e credenciais.
- **Não inventar** dados, números, depoimentos, clientes, produtos, funcionalidades, requisitos ou resultados. Informação que falta fica marcada com ⚠️ para confirmar.
- Exceção a registrar: `cloudflare-antigo/` é a versão antiga do painel (não usada pelo Docker); não editar sem pedido.

### Fluxo de trabalho

- Trabalhar por etapas e não avançar para a próxima sem o ok do Matheus.
- Tarefa normal: entender → achar os arquivos relevantes → consultar a documentação necessária → escolher o modelo → ver se há Skill útil → (se for código) considerar abordagem mínima → executar → conferir o resultado (peça visual é conferida visualmente antes da entrega).
- Tarefa complexa: plano curto, arquivos envolvidos, executar, validar. Tarefa simples: direto ao ponto, sem burocracia.
- Ao terminar: o que foi alterado, quais arquivos, decisões importantes e o que precisa de atenção. Sem colar arquivos inteiros.
- Regra de ouro: **menor contexto + modelo adequado + menor complexidade + máxima correção.**
- Este arquivo complementa a documentação do projeto. Regra específica do projeto prevalece sobre regra genérica; em dúvida real, perguntar.
