# ARENA — placar de vôlei de praia

## Arquitetura e integração

O placar é uma aplicação estática (HTML e JavaScript), publicada pelo GitHub Pages. O servidor Python (`server.py`) serve os mesmos arquivos para testes locais. Durante os testes, a RLS do Supabase permite administrar partidas sem login e grava cada partida em `arena_matches.data` (JSON); o ID da API central e o estado de sincronização ficam nesse mesmo registro sem mudar o formato das partidas.

`central-api.js` conversa diretamente com a API do Interclasse. A criação usa `POST /placares/criar` com modalidade `volei`; o ID retornado fica associado à partida local. Alterações do placar e o encerramento usam PATCH apenas para `pontos_a`, `pontos_b` e `status`. Sets, faltas, cartões, atletas e histórico continuam locais. O sistema de vôlei não tem cronômetro, então não envia `tempo_partida`.

## Acesso temporário e token

Durante os testes, qualquer pessoa que abrir o site pode criar e editar partidas em `arena_matches`, sem fazer login. As alterações são compartilhadas com todos que acessam o mesmo Supabase. Para voltar a exigir login, será necessário reverter o acesso anônimo no cliente e remover as políticas anônimas da migração `20261126000000_allow_anonymous_scoreboard_tests.sql`.

O token da API central é informado em cada aba e mantido apenas em memória até fechar a página ou usar **Limpar token**. O token anteriormente salvo em `arena_central_api_credentials` permanece no banco, mas o modo de testes não o lê, altera ou expõe a visitantes. Não use a chave `service_role` do Supabase no navegador.

## CORS

Antes do teste, solicite ao professor a autorização da origem exata do site: protocolo, domínio e porta, sem caminho. No GitHub Pages, use a origem publicada; localmente, `python server.py` escolhe uma porta livre entre 8000 e 8049, então autorize a origem/porta mostrada no terminal. O navegador envia `Origin` e faz o preflight CORS automaticamente. Não configure `Origin` manualmente nem use `no-cors`. CORS não substitui autenticação nem validação de propriedade no servidor.

## Executar e testar

1. Abra `index.html` pelo GitHub Pages ou execute `python server.py`.
2. Abra o placar e use os controles de edição diretamente, sem login.
3. Para sincronizar com a API central, peça ao professor o token individual do grupo (não o envie em chats ou commits), informe-o no painel **API central do Interclasse** e selecione **Usar token**. Informe novamente o token ao recarregar a página.
4. Crie uma partida de teste com nomes identificáveis do grupo. Ao iniciar, a aplicação salva primeiro o registro local, cria o placar central e associa o ID retornado. Se já houver ID, recarregar não cria outro.
5. Consulte o ID, marque pontos e encerre a partida pela regra existente (melhor de três sets; sets 1 e 2 até 21, terceiro até 15, sempre por dois). Confirme o placar/status no monitor público e recarregue para verificar que o mesmo ID foi mantido.
6. Confira no DevTools o preflight `OPTIONS` e as respostas da API (`201` na criação; `200` na consulta/atualização). Teste token inválido, origem não autorizada e falha de rede sem usar placares de outros grupos.

Erros HTTP e de rede são indicados no painel e os dados locais são preservados. Uma falha ambígua durante o POST bloqueia a repetição automática; confira o monitor/API com o professor antes de usar a ação de nova tentativa confirmada. O ID vinculado permite consultar e sincronizar novamente, e o painel exibe a última confirmação. O polling ocorre a cada 15 segundos enquanto a página está aberta e o token está ativo.

Para que a edição sem login funcione no Supabase publicado, aplique a migração `20261126000000_allow_anonymous_scoreboard_tests.sql` (o workflow de deploy de migrações executa isso ao enviar alterações em `supabase/**`). A migração libera criação e edição de partidas para visitantes, mas não libera acesso anônimo ao token salvo ou a torneios. Os testes reais de API dependem do token do grupo e da autorização CORS do professor. Nenhum token real foi incluído ou usado durante o desenvolvimento.

### Configuração do deploy de migrações

O workflow `.github/workflows/supabase-deploy.yml` usa o ambiente GitHub Actions `production`. Em **Settings → Environments → production**, configure:

- **Secrets** `SUPABASE_ACCESS_TOKEN` (access token da conta Supabase) e `SUPABASE_DB_PASSWORD` (senha do banco do projeto).
- **Variable** `SUPABASE_PROJECT_ID` (project ref do projeto, não a URL).

Não cole esses valores em issues, chats, arquivos versionados ou logs. Sem esses três valores o workflow não consegue vincular o Supabase nem executar `supabase db push`; após configurá-los, use **Actions → Deploy Supabase migrations → Run workflow** para aplicar migrações já enviadas.
