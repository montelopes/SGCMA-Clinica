/**
 * SGCMA - Frontend (JavaScript Vanilla)
 * Consome as 3 rotas da API:
 *   GET  /api/agenda-diaria
 *   POST /api/agendar
 *   GET  /api/historico-paciente
 */

const API = '/api';

// ============== Navegação por abas ==============
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ============== Utilitário de mensagem ==============
function mostrarMsg(id, texto, tipo) {
  const el = document.getElementById(id);
  el.textContent = texto;
  el.className = 'msg ' + tipo;
  if (tipo === 'sucesso') setTimeout(() => { el.className = 'msg'; }, 4000);
}

// ============== Painel da Recepção ==============
async function carregarAgenda() {
  const tbody = document.querySelector('#tabela-agenda tbody');
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
  try {
    const res = await fetch(`${API}/agenda-diaria`);
    if (!res.ok) throw new Error('Falha na requisição');
    const dados = await res.json();

    if (!dados.length) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhuma consulta agendada.</td></tr>';
      return;
    }

    tbody.innerHTML = dados.map((c) => `
      <tr>
        <td>${c.hora_consulta || c.horario || '-'}</td>
        <td>${c.nome_paciente || c.paciente || '-'}</td>
        <td>${c.nome_medico || c.medico || '-'}</td>
        <td>${c.especialidade || '-'}</td>
        <td>${c.status || '-'}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '';
    mostrarMsg('msg-agenda', 'Erro ao carregar agenda: ' + err.message, 'erro');
  }
}

document.getElementById('btn-recarregar').addEventListener('click', carregarAgenda);

// ============== Novo Agendamento ==============
document.getElementById('form-agendar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = {
    paciente_id: Number(form.paciente_id.value),
    medico_id: Number(form.medico_id.value),
    data_consulta: form.data_consulta.value,
    hora_consulta: form.hora_consulta.value,
    observacoes: form.observacoes.value || null,
  };

  try {
    const res = await fetch(`${API}/agendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.sucesso) {
      throw new Error(data.erro || 'Erro ao agendar');
    }
    mostrarMsg('msg-agendar', `${data.mensagem} (ID: ${data.consulta_id})`, 'sucesso');
    form.reset();
  } catch (err) {
    mostrarMsg('msg-agendar', err.message, 'erro');
  }
});

// ============== Histórico do Paciente ==============
document.getElementById('btn-buscar').addEventListener('click', carregarHistorico);

async function carregarHistorico() {
  const idPaciente = document.getElementById('busca_paciente').value;
  const lista = document.getElementById('lista-historico');
  lista.innerHTML = 'Carregando...';

  try {
    const url = idPaciente
      ? `${API}/historico-paciente?paciente_id=${idPaciente}`
      : `${API}/historico-paciente`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha na requisição');
    const dados = await res.json();

    if (!dados.length) {
      lista.innerHTML = '<p>Nenhum registro encontrado.</p>';
      return;
    }

    lista.innerHTML = dados.map((r) => {
      // Metadados NoSQL (campo JSON) - ex.: pressão arterial, temperatura
      const meta = r.metadados || r.dados_clinicos || r.json_dados || null;
      let metaHtml = '';
      if (meta && typeof meta === 'object') {
        metaHtml = `
          <div class="metadados">
            <strong>Dados Clínicos:</strong><br>
            ${Object.entries(meta).map(([k, v]) =>
              `<span class="metadado-item"><strong>${k}:</strong> ${v}</span>`
            ).join('')}
          </div>`;
      }

      return `
        <div class="card-historico">
          <h3>${r.nome_paciente || 'Paciente'} ${r.paciente_id ? '(ID ' + r.paciente_id + ')' : ''}</h3>
          <div class="data-info">
            ${r.data_consulta || ''} ${r.hora_consulta || ''}
            ${r.nome_medico ? ' • Dr(a). ' + r.nome_medico : ''}
            ${r.especialidade ? ' • ' + r.especialidade : ''}
          </div>
          ${r.diagnostico ? `<p><strong>Diagnóstico:</strong> ${r.diagnostico}</p>` : ''}
          ${r.prescricao ? `<p><strong>Prescrição:</strong> ${r.prescricao}</p>` : ''}
          ${r.observacoes ? `<p><strong>Observações:</strong> ${r.observacoes}</p>` : ''}
          ${metaHtml}
        </div>`;
    }).join('');
  } catch (err) {
    mostrarMsg('msg-historico', 'Erro: ' + err.message, 'erro');
    lista.innerHTML = '';
  }
}

// ============== Inicialização ==============
carregarAgenda();
