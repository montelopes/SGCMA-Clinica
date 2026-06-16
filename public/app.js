const API = '/api';
let usuarioLogado = null;

// ================= UTILITÁRIOS =================
function mostrarToast(mensagem, tipo = 'sucesso') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  const icone = tipo === 'sucesso' ? 'ph-check-circle' : 'ph-warning-circle';
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `<i class="ph ${icone}"></i> <span>${mensagem}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ================= CONTROLE DE SESSÃO =================
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login_email').value;
  const senha = document.getElementById('login_senha').value;
  const btn = document.getElementById('btn-login-submit');
  
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Entrando...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await res.json();
    
    if (res.ok && data.sucesso) {
      usuarioLogado = data.usuario;
      document.getElementById('user-name').textContent = usuarioLogado.nome;
      document.getElementById('user-role').textContent = usuarioLogado.nivel_acesso;
      
      // Esconder login, mostrar dashboard
      document.getElementById('login-screen').classList.remove('active');
      document.getElementById('app-screen').classList.add('active');
      
      aplicarPermissoes(usuarioLogado.nivel_acesso);
      inicializarDados();
    } else {
      mostrarToast(data.erro || 'Erro ao logar', 'erro');
    }
  } catch (err) {
    mostrarToast('Erro de conexão', 'erro');
  } finally {
    btn.innerHTML = 'Entrar no sistema <i class="ph ph-arrow-right"></i>';
    btn.disabled = false;
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  usuarioLogado = null;
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('form-login').reset();
});

function aplicarPermissoes(nivel) {
  // Esconder itens de menu não permitidos
  document.querySelectorAll('.nav-item[data-role]').forEach(item => {
    const allowed = item.getAttribute('data-role').split(',');
    if (!allowed.includes(nivel)) {
      item.style.display = 'none';
    } else {
      item.style.display = 'flex';
    }
  });

  // Ir para a primeira aba permitida
  document.querySelector('.nav-item').click();
}

// ================= NAVEGAÇÃO =================
document.querySelectorAll('.nav-item[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item[data-tab]').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    
    // Auto recarregar dados específicos ao trocar de aba
    if(btn.dataset.tab === 'painel') carregarAgenda();
    if(btn.dataset.tab === 'gerencial') carregarDashboard();
    if(btn.dataset.tab === 'cadastros') carregarPacientes();
  });
});

// ================= FUNÇÕES DE INICIALIZAÇÃO =================
async function inicializarDados() {
  carregarAgenda();
  carregarOpcoesAgendamento();
  carregarOpcoesProntuario();
}

async function fetchJSON(url) {
  const res = await fetch(url);
  return res.ok ? await res.json() : [];
}

// ================= PAINEL (AGENDA DIÁRIA) =================
async function carregarAgenda() {
  const tbody = document.querySelector('#tabela-agenda tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center"><i class="ph ph-spinner ph-spin"></i> Carregando...</td></tr>';
  
  try {
    const dados = await fetchJSON(`${API}/agenda-diaria`);
    if (!dados.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Nenhuma consulta agendada para hoje.</td></tr>';
      return;
    }

    tbody.innerHTML = dados.map(c => {
      let badgeClass = 'badge-agendada';
      if(c.status === 'REALIZADA') badgeClass = 'badge-realizada';
      if(c.status === 'CANCELADA') badgeClass = 'badge-cancelada';
      
      let acoes = '';
      if(c.status === 'AGENDADA' && (usuarioLogado.nivel_acesso === 'admin' || usuarioLogado.nivel_acesso === 'recepcao')) {
        acoes = `<button class="btn-outline btn-sm" onclick="cancelarConsulta(${c.id_consulta})"><i class="ph ph-x"></i> Cancelar</button>`;
      }
      if(c.status === 'AGENDADA' && (usuarioLogado.nivel_acesso === 'admin' || usuarioLogado.nivel_acesso === 'medico')) {
         acoes += ` <button class="btn-primary btn-sm" onclick="abrirModalAtendimento(${c.id_consulta}, ${c.id_paciente}, '${c.paciente}')"><i class="ph ph-stethoscope"></i> Atender</button>`;
      }

      return `
      <tr>
        <td><strong>${c.horario || '-'}</strong></td>
        <td>${c.paciente || '-'}</td>
        <td>${c.medico || '-'}</td>
        <td>${c.especialidade || '-'}</td>
        <td><span class="badge ${badgeClass}">${c.status}</span></td>
        <td>${acoes}</td>
      </tr>
    `}).join('');
  } catch(e) {
    tbody.innerHTML = '';
    mostrarToast('Erro ao carregar agenda', 'erro');
  }
}
document.getElementById('btn-recarregar-agenda').addEventListener('click', carregarAgenda);

async function cancelarConsulta(id) {
  if(!confirm('Deseja realmente cancelar esta consulta?')) return;
  const res = await fetch(`${API}/cancelar-consulta/${id}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ id_usuario: usuarioLogado.id, motivo: 'Cancelado via painel' })
  });
  const data = await res.json();
  if(data.sucesso) {
    mostrarToast('Consulta cancelada com sucesso!');
    carregarAgenda();
  } else {
    mostrarToast(data.erro, 'erro');
  }
}

// ================= NOVO AGENDAMENTO =================
async function carregarOpcoesAgendamento() {
  const pacientes = await fetchJSON(`${API}/pacientes`);
  const medicos = await fetchJSON(`${API}/medicos`);
  
  const pSelect = document.getElementById('agenda_paciente');
  pSelect.innerHTML = '<option value="">Selecione...</option>' + pacientes.map(p => `<option value="${p.id_paciente}">${p.nome_paciente} (CPF: ${p.cpf})</option>`).join('');
  
  const mSelect = document.getElementById('agenda_medico');
  mSelect.innerHTML = '<option value="">Selecione...</option>' + medicos.filter(m=>m.ativo).map(m => `<option value="${m.id_medico}">${m.nome_medico} - ${m.especialidade_nome}</option>`).join('');
}

document.getElementById('form-agendar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    paciente_id: document.getElementById('agenda_paciente').value,
    medico_id: document.getElementById('agenda_medico').value,
    data_consulta: document.getElementById('agenda_data').value,
    hora_consulta: document.getElementById('agenda_hora').value,
    observacoes: document.getElementById('agenda_obs').value,
    id_usuario: usuarioLogado.id
  };

  try {
    const res = await fetch(`${API}/agendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.sucesso) {
      mostrarToast('Consulta agendada com sucesso!');
      e.target.reset();
      carregarAgenda();
    } else {
      mostrarToast(data.erro, 'erro');
    }
  } catch (err) {
    mostrarToast('Falha na comunicação com o servidor', 'erro');
  }
});

// ================= CADASTROS =================
async function carregarPacientes() {
  const pacientes = await fetchJSON(`${API}/pacientes`);
  const convenios = await fetchJSON(`${API}/convenios`);
  
  document.getElementById('pac_convenio').innerHTML = '<option value="">Sem Convênio (Particular)</option>' + 
    convenios.map(c => `<option value="${c.id_convenio}">${c.nome}</option>`).join('');

  const tbody = document.querySelector('#tabela-pacientes tbody');
  tbody.innerHTML = pacientes.map(p => `
    <tr>
      <td>${p.id_paciente}</td>
      <td>${p.cpf}</td>
      <td>${p.nome_paciente}</td>
      <td>${p.telefone || '-'}</td>
      <td><span class="badge" style="background:#e0e7ff; color:#3730a3">${p.convenio_nome || 'Particular'}</span></td>
    </tr>
  `).join('');
}

document.getElementById('form-paciente').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    cpf: document.getElementById('pac_cpf').value,
    nome_paciente: document.getElementById('pac_nome').value,
    dt_nascimento: document.getElementById('pac_dt_nasc').value,
    telefone: document.getElementById('pac_telefone').value,
    email: document.getElementById('pac_email').value,
    id_convenio: document.getElementById('pac_convenio').value,
    id_usuario: usuarioLogado.id
  };
  const res = await fetch(`${API}/pacientes`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
  const data = await res.json();
  if(data.sucesso) {
    mostrarToast('Paciente cadastrado!');
    e.target.reset();
    carregarPacientes();
    carregarOpcoesAgendamento(); // Refresh selects
  } else mostrarToast(data.erro, 'erro');
});

// ================= PRONTUÁRIO & HISTÓRICO =================
async function carregarOpcoesProntuario() {
  const pacientes = await fetchJSON(`${API}/pacientes`);
  document.getElementById('busca_paciente_prontuario').innerHTML = '<option value="">Todos os pacientes</option>' + 
    pacientes.map(p => `<option value="${p.id_paciente}">${p.nome_paciente}</option>`).join('');
}

document.getElementById('btn-buscar-historico').addEventListener('click', async () => {
  const pId = document.getElementById('busca_paciente_prontuario').value;
  const histContainer = document.getElementById('historico-container');
  histContainer.innerHTML = '<p><i class="ph ph-spinner ph-spin"></i> Buscando...</p>';
  
  const url = pId ? `${API}/historico-paciente?paciente_id=${pId}` : `${API}/historico-paciente`;
  const dados = await fetchJSON(url);
  
  if(!dados.length) {
    histContainer.innerHTML = '<p>Nenhum registro encontrado.</p>';
    return;
  }

  histContainer.innerHTML = dados.map(r => {
    let metaHtml = '';
    if (r.metadados && typeof r.metadados === 'object') {
      metaHtml = `<div class="metadados mt-15"><strong>Sinais Vitais / Exames:</strong><br>
        ${Object.entries(r.metadados).map(([k,v]) => `<span class="badge" style="background:#f1f5f9; color:#475569; margin-right:5px">${k}: ${v}</span>`).join('')}
      </div>`;
    }
    return `
      <div class="card history-card">
        <div class="history-header">
          <strong>${r.nome_paciente}</strong>
          <span class="history-date"><i class="ph ph-calendar"></i> ${r.data_consulta || '-'} ${r.hora_consulta || ''}</span>
        </div>
        <div class="history-body">
          <p><i class="ph ph-stethoscope"></i> Dr(a). ${r.nome_medico} (${r.especialidade})</p>
          ${r.diagnostico ? `<p><strong>Diagnóstico:</strong> ${r.diagnostico}</p>` : ''}
          ${r.prescricao ? `<p><strong>Prescrição:</strong> ${r.prescricao}</p>` : ''}
          ${r.observacoes ? `<p><strong>Obs:</strong> ${r.observacoes}</p>` : ''}
        </div>
        ${metaHtml}
      </div>
    `;
  }).join('');
});

function abrirModalAtendimento(idConsulta, idPaciente, nomePaciente) {
  document.getElementById('modal-atendimento').classList.add('active');
  document.getElementById('atend_id_consulta').value = idConsulta;
  document.getElementById('atend_id_paciente').value = idPaciente;
}

function fecharModal() {
  document.getElementById('modal-atendimento').classList.remove('active');
  document.getElementById('form-atendimento').reset();
}

document.getElementById('form-atendimento').addEventListener('submit', async (e) => {
  e.preventDefault();
  const metadados = {};
  if(document.getElementById('atend_pa').value) metadados['Pressão Arterial'] = document.getElementById('atend_pa').value;
  if(document.getElementById('atend_temp').value) metadados['Temperatura'] = document.getElementById('atend_temp').value + '°C';

  const payload = {
    id_consulta: document.getElementById('atend_id_consulta').value,
    paciente_id: document.getElementById('atend_id_paciente').value,
    diagnostico: document.getElementById('atend_diag').value,
    prescricao: document.getElementById('atend_presc').value,
    observacoes: document.getElementById('atend_obs').value,
    metadados: Object.keys(metadados).length ? metadados : null,
    id_usuario: usuarioLogado.id
  };

  const res = await fetch(`${API}/prontuario`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
  const data = await res.json();
  if(data.sucesso) {
    mostrarToast('Atendimento salvo com sucesso!');
    fecharModal();
    carregarAgenda();
  } else mostrarToast(data.erro, 'erro');
});

// ================= GERENCIAL =================
document.getElementById('btn-recarregar-dash').addEventListener('click', carregarDashboard);

async function carregarDashboard() {
  try {
    const dash = await fetchJSON(`${API}/dashboard`);
    document.getElementById('stat-consultas').textContent = dash.consultas_hoje || 0;
    document.getElementById('stat-pacientes').textContent = dash.total_pacientes || 0;
    document.getElementById('stat-medicos').textContent = dash.medicos_ativos || 0;
    
    document.querySelector('#tabela-relatorio tbody').innerHTML = dash.relatorio_mensal.map(r => `
      <tr>
        <td>${r.medico}</td>
        <td>${r.especialidade}</td>
        <td><strong>${r.total_consultas}</strong></td>
        <td style="color:var(--secondary)">${r.realizadas}</td>
        <td style="color:var(--danger)">${r.canceladas}</td>
      </tr>
    `).join('');

    const aud = await fetchJSON(`${API}/auditoria`);
    document.getElementById('lista-auditoria').innerHTML = aud.map(a => `
      <div class="audit-item">
        <strong>[${a.operacao}]</strong> tabela <em>${a.tabela_afetada}</em> (ID ${a.id_registro})
        <span class="date">Por ${a.usuario_nome || 'Sistema'} em ${new Date(a.dt_operacao).toLocaleString()}</span>
      </div>
    `).join('');
  } catch (e) {
    mostrarToast('Erro ao carregar painel gerencial', 'erro');
  }
}
