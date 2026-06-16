const express = require('express');
const pool = require('../config/db');
const router = express.Router();

async function registrarAuditoria(tabela, operacao, id_registro, id_usuario, dados_anteriores = null) {
  const query = 'INSERT INTO log_auditoria (tabela_afetada, operacao, id_registro, id_usuario, dados_anteriores) VALUES (?, ?, ?, ?, ?)';
  const dados_json = dados_anteriores ? JSON.stringify(dados_anteriores) : null;
  await pool.query(query, [tabela, operacao, id_registro, id_usuario, dados_json]);
}

router.post('/agendar', async (req, res) => {
  const { paciente_id, medico_id, data_consulta, hora_consulta, observacoes, id_usuario } = req.body;

  if (!paciente_id || !medico_id || !data_consulta || !hora_consulta) {
    return res.status(400).json({ erro: 'Campos obrigatórios: paciente_id, medico_id, data_consulta, hora_consulta' });
  }

  try {
    // Validação de conflito de horário (simula Trigger 3 do MySQL)
    const [conflito] = await pool.query(
      "SELECT 1 FROM consultas WHERE id_medico = ? AND dt_consulta = ? AND hora_consulta = ? AND status != 'CANCELADA'",
      [medico_id, data_consulta, hora_consulta]
    );

    if (conflito.length > 0) {
      return res.status(400).json({ sucesso: false, erro: 'Horário já ocupado para este médico.' });
    }

    const [result] = await pool.query(
      'INSERT INTO consultas (id_paciente, id_medico, dt_consulta, hora_consulta, observacoes, id_usuario_agend) VALUES (?, ?, ?, ?, ?, ?)',
      [paciente_id, medico_id, data_consulta, hora_consulta, observacoes || null, id_usuario || null]
    );

    await registrarAuditoria('consultas', 'INSERT', result.lastID, id_usuario || null);

    res.status(201).json({
      sucesso: true,
      mensagem: 'Consulta agendada com sucesso',
      consulta_id: result.lastID,
    });
  } catch (err) {
    console.error('Erro em /agendar:', err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

router.post('/cancelar-consulta/:id', async (req, res) => {
  const { id_usuario, motivo } = req.body;
  try {
    const [antigo] = await pool.query('SELECT * FROM consultas WHERE id_consulta = ?', [req.params.id]);
    if(antigo.length === 0) return res.status(404).json({ erro: 'Consulta não encontrada' });
    
    await pool.query('UPDATE consultas SET status = ?, observacoes = ? WHERE id_consulta = ?', ['CANCELADA', motivo || 'Cancelada pelo usuário', req.params.id]);
    
    await registrarAuditoria('consultas', 'UPDATE', req.params.id, id_usuario || null, antigo[0]);
    res.json({ sucesso: true, mensagem: 'Consulta cancelada com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
