# ARENA — placar de vôlei de praia

## Arquitetura e integração

O placar é uma aplicação estática (HTML e JavaScript), publicada pelo GitHub Pages. O servidor Python (`server.py`) serve os mesmos arquivos para testes locais. O Supabase Auth/RLS mantém os árbitros autorizados e grava cada partida em `arena_matches.data` (JSON); o ID da API central e o estado de sincronização ficam nesse mesmo registro sem mudar o formato das partidas.

`central-api.js` conversa diretamente com a API do Interclasse. A criação usa `POST /placares/criar` com modalidade `volei`; o ID retornado fica associado à partida local. Alterações do placar e o encerramento usam PATCH apenas para `pontos_a`, `pontos_b` e `status`. Sets, faltas, cartões, atletas e histórico continuam locais. O sistema de vôlei não tem cronômetro, então não envia `tempo_partida`.

## Token e CORS

O token é salvo como texto na tabela `arena_central_api_credentials` do Supabase para que árbitros autorizados possam carregá-lo ao entrar. A tabela tem RLS e somente usuários cadastrados em `arena_admins` podem ler, salvar ou remover o token. Isso é controle de acesso, não criptografia: árbitros autorizados e o navegador podem ver o token durante o uso. O navegador o carrega em memória durante a sessão; sair ou trocar de conta limpa essa cópia. O painel permite salvar, carregar, limpar da memória e apagar o registro salvo. Não use a chave `service_role` do Supabase.

Como o cliente é estático, o token e as requisições autenticadas podem ser vistos por qualquer árbitro autorizado que use as ferramentas do navegador; a RLS impede acesso por visitantes e usuários sem permissão, mas não transforma a aplicação cliente em backend secreto. Se essa exposição aos árbitros autorizados não for aceitável, use um backend/Edge Function com o token como segredo no servidor.

Antes do teste, solicite ao professor a autorização da origem exata do site: protocolo, domínio e porta, sem caminho. No GitHub Pages, use a origem publicada; localmente, `python server.py` escolhe uma porta livre entre 8000 e 8049, então autorize a origem/porta mostrada no terminal. O navegador envia `Origin` e faz o preflight CORS automaticamente. Não configure `Origin` manualmente nem use `no-cors`. CORS não substitui autenticação nem validação de propriedade no servidor.

## Executar e testar

1. Abra `index.html` pelo GitHub Pages ou execute `python server.py`.
2. Entre com a conta de árbitro já cadastrada em `arena_admins`.
3. Peça ao professor o token individual do grupo (não o envie em chats ou commits), informe-o no painel **API central do Interclasse** e selecione **Salvar token**. Nas sessões seguintes, ele é carregado automaticamente; **Carregar salvo** permite buscá-lo novamente.
4. Crie uma partida de teste com nomes identificáveis do grupo. Ao iniciar, a aplicação salva primeiro o registro local, cria o placar central e associa o ID retornado. Se já houver ID, recarregar não cria outro.
5. Consulte o ID, marque pontos e encerre a partida pela regra existente (melhor de três sets; sets 1 e 2 até 21, terceiro até 15, sempre por dois). Confirme o placar/status no monitor público e recarregue para verificar que o mesmo ID foi mantido.
6. Confira no DevTools o preflight `OPTIONS` e as respostas da API (`201` na criação; `200` na consulta/atualização). Teste token inválido, origem não autorizada e falha de rede sem usar placares de outros grupos.

Erros HTTP e de rede são indicados no painel e os dados locais são preservados. Uma falha ambígua durante o POST bloqueia a repetição automática; confira o monitor/API com o professor antes de usar a ação de nova tentativa confirmada. O ID vinculado permite consultar e sincronizar novamente, e o painel exibe a última confirmação. O polling ocorre a cada 15 segundos enquanto a página está aberta e o token está ativo.

Antes de publicar, aplique a migração `20261123000000_add_central_api_credentials.sql` (o workflow de deploy de migrações executa isso ao enviar alterações em `supabase/**`). O usuário precisa estar autenticado e cadastrado em `arena_admins` para ver o painel e carregar/salvar o token. Os testes reais de API dependem do token do grupo e da autorização CORS do professor. Nenhum token real foi incluído ou usado durante o desenvolvimento.
