const CENTRAL_API_BASE = 'https://rvarjao.pythonanywhere.com/api';
let centralApiToken = '';
let centralSyncQueue = Promise.resolve();
let centralSyncTimer = null;
let centralPollTimer = null;
let centralPollInFlight = false;
let centralPollPromise = null;
let centralSyncPending = 0;
let centralSyncInFlight = false;
let centralCreatePromise = null;
let centralStatusText = '';

class CentralApiError extends Error {
  constructor(status, message, ambiguous = false) {
    super(message);
    this.status = status;
    this.ambiguous = ambiguous;
  }
}

function centralApiErrorMessage(status) {
  if (status === 400) return 'A API rejeitou os dados enviados (HTTP 400). Confira os nomes e a modalidade.';
  if (status === 401) return 'Token inválido ou ausente (HTTP 401). Confira o token com o professor.';
  if (status === 403) return 'A API negou a operação (HTTP 403). Confirme o token e se o placar pertence ao seu grupo.';
  if (status === 404) return 'O placar não foi encontrado (HTTP 404). O estado local foi preservado.';
  if (status === 503) return 'A API está temporariamente indisponível (HTTP 503). Tente novamente mais tarde.';
  if (status >= 500) return `A API retornou um erro de servidor (HTTP ${status}).`;
  return `A API retornou um erro HTTP ${status}.`;
}

async function centralApiRequest(path, method = 'GET', body) {
  if (!centralApiToken) throw new CentralApiError(0, 'Informe o token do grupo para conectar.');
  const headers = { Authorization: `Bearer ${centralApiToken}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${CENTRAL_API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new CentralApiError(0, 'Falha de rede ou CORS. Confira a conexão e peça ao professor para autorizar a origem exata da aplicação.', true);
  }

  let data = null;
  let responseText;
  try {
    responseText = await response.text();
  } catch {
    throw new CentralApiError(0, 'A conexão foi interrompida ao ler a resposta da API. Consulte o placar antes de repetir qualquer operação.', method === 'POST' || response.status >= 500);
  }
  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    throw new CentralApiError(response.status, centralApiErrorMessage(response.status), response.status >= 500);
  }
  return data;
}

function centralSetStatus(message) {
  centralStatusText = message;
  const status = $('#centralStatus');
  if (status) status.textContent = message;
  centralRenderAccess();
}

function centralRenderAccess() {
  const form = $('#centralCredentialForm');
  const retry = $('#centralRetry');
  const status = $('#centralStatus');
  const lastSync = $('#centralLastSync');
  if (form) form.classList.toggle('hidden', !isAdmin);
  if (status && centralStatusText) status.textContent = centralStatusText;
  if (lastSync) {
    lastSync.textContent = currentMatch?.centralApiLastSyncAt
      ? `Última confirmação: ${new Date(currentMatch.centralApiLastSyncAt).toLocaleString('pt-BR')}.`
      : 'Ainda não houve sincronização confirmada.';
  }
  if (!retry) return;

  const match = currentMatch;
  const hasId = !!match?.centralApiId;
  const state = match?.centralApiCreateState || 'not_started';
  const canCreate = ['not_started', 'rejected', 'uncertain'].includes(state);
  retry.classList.toggle('hidden', !isAdmin || !centralApiToken || !match || (!hasId && !canCreate));
  retry.textContent = hasId ? 'Consultar e sincronizar agora' :
    state === 'uncertain' ? 'Verifiquei que não foi criado — tentar novamente' : 'Criar placar na API central';
}

function centralRemoteSnapshot(data) {
  if (!data || !Number.isInteger(data.pontos_a) || data.pontos_a < 0 ||
      !Number.isInteger(data.pontos_b) || data.pontos_b < 0 ||
      !['aguardando', 'em_andamento', 'encerrado'].includes(data.status)) {
    throw new CentralApiError(0, 'A API retornou dados de placar inesperados.');
  }
  return { pontos_a: data.pontos_a, pontos_b: data.pontos_b, status: data.status };
}

function centralDesiredSnapshot(match) {
  return {
    pontos_a: match.game.points[0],
    pontos_b: match.game.points[1],
    status: match.game.over ? 'encerrado' : 'em_andamento'
  };
}

function centralSnapshotsEqual(a, b) {
  return !!a && !!b &&
    a.pontos_a === b.pontos_a &&
    a.pontos_b === b.pontos_b &&
    a.status === b.status;
}

function centralApplyRemote(match, snapshot) {
  const game = match.game;
  const changed = game.points[0] !== snapshot.pontos_a ||
    game.points[1] !== snapshot.pontos_b ||
    game.over !== (snapshot.status === 'encerrado');
  game.points = [snapshot.pontos_a, snapshot.pontos_b];
  if (snapshot.status === 'encerrado') game.over = true;
  else game.over = false;
  match.centralApiLastSynced = snapshot;
  match.centralApiLastSyncAt = new Date().toISOString();
  if (changed && currentMatch === match) renderMatch();
}

async function centralSaveMatch(match) {
  if (typeof saveMatch === 'function' && currentMatch === match) return await saveMatch();
  return false;
}

async function centralConsult(match, fromPoll = false) {
  if (!centralApiToken || !match?.centralApiId) return false;
  const data = await centralApiRequest(`/${encodeURIComponent(match.centralApiId)}`);
  const remote = centralRemoteSnapshot(data);
  const desired = centralDesiredSnapshot(match);
  const hasSnapshot = !!match.centralApiLastSynced;
  const localUnchanged = !hasSnapshot || centralSnapshotsEqual(match.centralApiLastSynced, desired);

  if (localUnchanged) {
    centralApplyRemote(match, remote);
    const saved = await centralSaveMatch(match);
    centralSetStatus(`Conectado · placar ${match.centralApiId} consultado.`);
    if (!saved) centralSetStatus('API consultada, mas não foi possível salvar o estado recuperado no Supabase.');
    if (!centralSnapshotsEqual(centralDesiredSnapshot(match), remote)) await centralSyncMatch(fromPoll);
    return true;
  }

  match.centralApiLastSynced = remote;
  centralSetStatus('Há alterações locais ainda não confirmadas. Enviando os campos pendentes…');
  await centralSaveMatch(match);
  await centralSyncMatch(fromPoll);
  return true;
}

async function centralSyncNow(match) {
  if (currentMatch !== match || !centralApiToken || !match.centralApiId) return false;
  let baseline = match.centralApiLastSynced;
  if (!baseline) {
    const data = await centralApiRequest(`/${encodeURIComponent(match.centralApiId)}`);
    baseline = centralRemoteSnapshot(data);
    match.centralApiLastSynced = baseline;
  }

  const desired = centralDesiredSnapshot(match);
  const patch = {};
  for (const key of ['pontos_a', 'pontos_b', 'status']) {
    if (desired[key] !== baseline[key]) patch[key] = desired[key];
  }
  if (!Object.keys(patch).length) {
    match.centralApiLastSyncAt = new Date().toISOString();
    const saved = await centralSaveMatch(match);
    if (!saved) {
      centralSetStatus('A API confirma os dados, mas não foi possível salvar a confirmação no Supabase.');
      return false;
    }
    centralSetStatus(`Sincronizado · ${new Date(match.centralApiLastSyncAt).toLocaleTimeString('pt-BR')}.`);
    return true;
  }

  centralSetStatus('Sincronizando placar…');
  const data = await centralApiRequest(`/${encodeURIComponent(match.centralApiId)}`, 'PATCH', patch);
  let confirmed = { ...baseline, ...patch };
  if (data && Number.isInteger(data.pontos_a) && Number.isInteger(data.pontos_b) &&
      ['aguardando', 'em_andamento', 'encerrado'].includes(data.status)) {
    confirmed = centralRemoteSnapshot(data);
  }
  match.centralApiLastSynced = confirmed;
  match.centralApiLastSyncAt = new Date().toISOString();
  const saved = await centralSaveMatch(match);
  if (!saved) {
    centralSetStatus('A API confirmou a atualização, mas não foi possível salvar a confirmação no Supabase.');
    return false;
  }
  centralSetStatus(`Sincronizado · ${new Date(match.centralApiLastSyncAt).toLocaleTimeString('pt-BR')}.`);
  return true;
}

function centralSyncMatch(fromPoll = false) {
  const match = currentMatch;
  if (!match?.centralApiId || !centralApiToken) return Promise.resolve(false);
  if (centralPollInFlight && !fromPoll) return centralPollPromise.then(() => centralSyncMatch());
  centralSyncPending++;
  const job = centralSyncQueue.then(async () => {
    centralSyncInFlight = true;
    try {
      return await centralSyncNow(match);
    } catch (error) {
      centralSetStatus(error.message || 'Falha ao sincronizar com a API central.');
      return false;
    } finally {
      centralSyncInFlight = false;
      centralSyncPending--;
    }
  });
  centralSyncQueue = job.then(() => undefined, () => undefined);
  return job;
}

function centralQueueSync() {
  clearTimeout(centralSyncTimer);
  centralSyncTimer = setTimeout(() => { void centralSyncMatch(); }, 500);
}

async function centralCreateMatch(match) {
  if (currentMatch !== match || match.centralApiId) return false;
  if (!centralApiToken) {
    centralSetStatus('Partida salva localmente. Informe o token em tempo de execução para criar o placar central.');
    return false;
  }
  if (centralCreatePromise) return centralCreatePromise;
  if (['creating', 'uncertain'].includes(match.centralApiCreateState)) {
    centralSetStatus('O resultado da criação é incerto. Não repita o POST; verifique o monitor/API com o professor antes de qualquer nova tentativa.');
    return false;
  }

  centralCreatePromise = (async () => {
    match.centralApiCreateState = 'creating';
    const saved = await centralSaveMatch(match);
    if (!saved) {
      match.centralApiCreateState = 'not_started';
      centralSetStatus('Não foi possível salvar o estado local antes da criação. A API não foi chamada.');
      return false;
    }

    centralSetStatus('Criando placar na API central…');
    let data;
    try {
      data = await centralApiRequest('/placares/criar', 'POST', {
        nome_equipe_a: match.teams[0].name,
        nome_equipe_b: match.teams[1].name,
        modalidade: 'volei'
      });
    } catch (error) {
      match.centralApiCreateState = error.ambiguous ? 'uncertain' : 'rejected';
      const stateSaved = await centralSaveMatch(match);
      if (!stateSaved) {
        centralSetStatus('Não foi possível salvar o resultado da tentativa no Supabase. Verifique a API antes de tentar novamente.');
        return false;
      }
      centralSetStatus(`${error.message}${error.ambiguous ? ' Não tente criar novamente sem verificar o resultado.' : ' Você pode corrigir o problema e tentar novamente.'}`);
      return false;
    }

    if (!data || data.id === undefined || data.id === null) {
      match.centralApiCreateState = 'uncertain';
      await centralSaveMatch(match);
      centralSetStatus('A resposta de criação não trouxe um ID válido. Não repita o POST; verifique o resultado com o professor.');
      return false;
    }

    match.centralApiId = String(data.id);
    match.centralApiCreateState = 'linked';
    try {
      match.centralApiLastSynced = centralRemoteSnapshot(data);
      match.centralApiLastSyncAt = new Date().toISOString();
    } catch {
      match.centralApiLastSynced = null;
    }
    const linkedSaved = await centralSaveMatch(match);
    if (!linkedSaved) {
      centralSetStatus(`A API criou o placar com ID ${match.centralApiId}, mas o vínculo não foi confirmado no Supabase. Não crie outro placar; tente salvar novamente ou procure o professor.`);
      return false;
    }
    centralSetStatus(`Placar central criado e associado · ID ${match.centralApiId}.`);
    if (!match.centralApiLastSynced) {
      await centralPoll();
      return true;
    }
    await centralSyncMatch();
    return true;
  })();
  const newMatchButton = $('#newMatch');
  if (newMatchButton) newMatchButton.disabled = true;
  const logoutButton = $('#logoutBtn');
  if (logoutButton) logoutButton.disabled = true;

  try {
    return await centralCreatePromise;
  } finally {
    centralCreatePromise = null;
    const newMatchButton = $('#newMatch');
    if (newMatchButton) newMatchButton.disabled = false;
    const logoutButton = $('#logoutBtn');
    if (logoutButton) logoutButton.disabled = false;
    centralRenderAccess();
  }
}

async function centralPoll() {
  const match = currentMatch;
  if (!centralApiToken || !match?.centralApiId || centralPollInFlight || centralSyncPending || centralSyncInFlight) return;
  centralPollInFlight = true;
  centralPollPromise = (async () => {
    try {
      await centralConsult(match, true);
    } catch (error) {
      centralSetStatus(error.message || 'Não foi possível consultar a API central. Os dados locais foram preservados.');
    } finally {
      centralPollInFlight = false;
      centralPollPromise = null;
    }
  })();
  await centralPollPromise;
}

function centralStartPolling() {
  clearInterval(centralPollTimer);
  if (centralApiToken) centralPollTimer = setInterval(() => { void centralPoll(); }, 15000);
}

function centralClearToken() {
  centralApiToken = '';
  clearInterval(centralPollTimer);
  clearTimeout(centralSyncTimer);
  const input = $('#centralToken');
  if (input) input.value = '';
  centralSetStatus('Token removido da memória. Informe-o novamente para sincronizar.');
}

function centralOnMatchLoaded(match) {
  if (match?.centralApiCreateState === 'creating') {
    match.centralApiCreateState = 'uncertain';
    void centralSaveMatch(match);
  }
  if (match && !centralApiToken) {
    centralSetStatus(match.centralApiId
      ? `Partida vinculada ao ID ${match.centralApiId}. Informe o token para consultar e sincronizar.`
      : 'Partida local carregada. Informe o token para criar ou sincronizar o placar central.');
  }
  centralRenderAccess();
  if (centralApiToken && match?.centralApiId) void centralPoll();
}

function setupCentralIntegration() {
  $('#centralCredentialForm').onsubmit = async event => {
    event.preventDefault();
    const token = $('#centralToken').value.trim();
    $('#centralToken').value = '';
    if (!token) {
      centralSetStatus('Informe o token do grupo.');
      return;
    }
    centralApiToken = token;
    centralSetStatus('Token mantido somente na memória. Verificando a conexão…');
    centralStartPolling();
    if (currentMatch?.centralApiId) await centralPoll();
    else centralSetStatus(currentMatch?.centralApiCreateState === 'uncertain'
      ? 'Token configurado. Criação anterior incerta: verifique o resultado antes de tentar novamente.'
      : 'Token mantido na memória; ainda não validado pela API porque não há placar associado.');
    centralRenderAccess();
  };

  $('#centralRetry').onclick = async () => {
    if (!currentMatch) return;
    if (currentMatch.centralApiId) await centralPoll();
    else {
      if (currentMatch.centralApiCreateState === 'uncertain') {
        const verifiedAbsent = confirm('Confirme que verificou o monitor/API com o professor e que o placar não foi criado. Só então será feito outro POST.');
        if (!verifiedAbsent) return;
        currentMatch.centralApiCreateState = 'not_started';
        if (!await centralSaveMatch(currentMatch)) {
          centralSetStatus('Não foi possível salvar a confirmação local; a API não foi chamada.');
          return;
        }
      }
      await centralCreateMatch(currentMatch);
    }
  };
  $('#centralDisconnect').onclick = centralClearToken;
  window.addEventListener('pagehide', () => {
    centralApiToken = '';
    clearInterval(centralPollTimer);
  });
}
