# ARENA — placar de vôlei de praia

## Arquitetura e integração

O placar é uma aplicação estática (HTML e JavaScript), publicada pelo GitHub Pages. O servidor Python (`server.py`) serve os mesmos arquivos para testes locais. Visitantes podem acompanhar o placar, mas apenas usuários autenticados com e-mail e senha no Supabase podem criar ou alterar partidas. A RLS protege a escrita em `arena_matches.data` (JSON); o ID da API central e o estado de sincronização ficam nesse mesmo registro sem mudar o formato das partidas.

`central-api.js` conversa diretamente com a API do Interclasse. A criação usa `POST /placares/criar` com modalidade `volei`; o ID retornado fica associado à partida local. Alterações do placar e o encerramento usam PATCH apenas para `pontos_a`, `pontos_b` e `status`. Sets, faltas, cartões, atletas e histórico continuam locais. O sistema de vôlei não tem cronômetro, então não envia `tempo_partida`.

## Acesso e token

Use **Entrar** com uma conta de e-mail e senha já cadastrada no Supabase para criar ou editar partidas. A migração `20261126110000_require_login_for_scoreboard_edits.sql` remove a permissão temporária de escrita anônima; a leitura pública do placar continua disponível. As políticas atuais permitem edição a qualquer usuário autenticado neste projeto.

O token da API central é informado no painel após o login. Sem marcar **Lembrar neste navegador**, ele fica apenas em memória até fechar a página ou usar **Limpar token**. Com a opção marcada, fica no `localStorage` deste navegador e é restaurado nas próximas visitas enquanto houver uma sessão autenticada; **Sair** e **Limpar token** também o apagam do armazenamento. Use essa opção apenas em dispositivo de confiança, pois scripts executados na mesma origem podem ler o `localStorage`. O token anteriormente salvo em `arena_central_api_credentials` permanece no banco, mas este modo não o lê nem altera. Não use a chave `service_role` do Supabase no navegador.

## CORS

A API publicada atualmente responde aos preflights com `Access-Control-Allow-Origin: *` para as rotas e métodos permitidos. O navegador ainda faz o preflight automaticamente: uma rota incorreta ou um método não permitido pode aparecer no console como erro de CORS. Não configure `Origin` manualmente nem use `no-cors`. Confira a URL e o método da requisição no DevTools quando houver falha.

## Executar e testar

1. Abra `index.html` pelo GitHub Pages ou execute `python server.py`.
2. Para editar, selecione **Entrar** e informe o e-mail e a senha de uma conta existente no Supabase. Sem login, o placar fica somente para leitura.
3. Para sincronizar com a API central, peça ao professor o token individual do grupo (não o envie em chats ou commits), informe-o no painel **API central do Interclasse** e selecione **Usar token**. Marque **Lembrar neste navegador** se quiser reutilizá-lo após recarregar a página. Gerar outro token no painel administrativo revoga o anterior.
4. Crie uma partida de teste com nomes identificáveis do grupo. Ao iniciar, a aplicação salva primeiro o registro local, cria o placar central e associa o ID retornado. Se já houver ID, recarregar não cria outro.
5. Consulte o ID, marque pontos e encerre a partida pela regra existente (melhor de três sets; sets 1 e 2 até 21, terceiro até 15, sempre por dois). Confirme o placar/status no monitor público e recarregue para verificar que o mesmo ID foi mantido.
6. Confira no DevTools o preflight `OPTIONS` e as respostas da API (`201` na criação; `200` na consulta/atualização). Teste token inválido e falha de rede sem usar placares de outros grupos.

Erros HTTP e de rede são indicados no painel e os dados locais são preservados. Uma falha ambígua durante o POST bloqueia a repetição automática; confira o monitor/API com o professor antes de usar a ação de nova tentativa confirmada. O ID vinculado permite consultar e sincronizar novamente, e o painel exibe a última confirmação. O polling ocorre a cada 15 segundos enquanto a página está aberta e o token está ativo.

Para impedir alterações sem login no Supabase publicado, aplique a migração `20261126110000_require_login_for_scoreboard_edits.sql` (o workflow de deploy de migrações executa isso ao enviar alterações em `supabase/**`). Os testes reais de API central dependem do token do grupo. Nenhum token real foi incluído ou usado durante o desenvolvimento.

### Configuração do deploy de migrações

O workflow `.github/workflows/supabase-deploy.yml` usa o ambiente GitHub Actions `production`. Em **Settings → Environments → production**, configure:

- **Secrets** `SUPABASE_ACCESS_TOKEN` (access token da conta Supabase) e `SUPABASE_DB_PASSWORD` (senha do banco do projeto).
- **Variable** `SUPABASE_PROJECT_ID` (project ref do projeto, não a URL).

Não cole esses valores em issues, chats, arquivos versionados ou logs. Sem esses três valores o workflow não consegue vincular o Supabase nem executar `supabase db push`; após configurá-los, use **Actions → Deploy Supabase migrations → Run workflow** para aplicar migrações já enviadas.
