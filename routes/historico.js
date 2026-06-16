const express = require('express');
const pool = require('../config/db');
const router = express.Router();

async function registrarAuditoria(tabela, operacao, id_registro, id_usuario, dados_anteriores = null) {
  const query = 'INSERT INTO log_auditoria (tabela_afetada, operacao, id_registro, id_usuario, dados_anteriores) VALUES (?, ?, ?, ?, ?)';
  const dados_json = dados_anteriores ? JSON.stringify(dados_anteriores) : null;
  await pool.query(query, [tabela, operacao, id_registro, id_usuario, dados_json]);
}

router.get('/historico-paciente', async (req, res) => {
  const { paciente_id } = req.query;
  try {
    let rows;
    if (paciente_id) {
      [rows] = await pool.query(
        'SELECT * FROM vw_historico_paciente WHERE paciente_id = ?',
        [paciente_id]
      );
    } else {
      [rows] = await pool.query('SELECT * FROM vw_historico_paciente');
    }

    const parsed = rows.map((row) => {
      const out = { ...row };
      for (const key of Object.keys(out)) {
        const val = out[key];
        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          try { out[key] = JSON.parse(val); } catch (_) { /* mantém string */ }
        }
      }
      return out;
    });

    res.json(parsed);
  } catch (err) {
    console.error('Erro em /historico-paciente:', err);
    res.status(500).json({ erro: 'Falha ao carregar histórico', detalhe: err.message });
  }
});

router.post('/prontuario', async (req, res) => {
  const { id_consulta, paciente_id, diagnostico, prescricao, observacoes, metadados, id_usuario } = req.body;
  if (!id_consulta || !paciente_id) return res.status(400).json({ erro: 'id_consulta e paciente_id obrigatórios' });

  try {
    const [result] = await pool.query(
      'INSERT INTO prontuarios (id_consulta, paciente_id, diagnostico, prescricao, observacoes, metadados) VALUES (?, ?, ?, ?, ?, ?)',
      [id_consulta, paciente_id, diagnostico || null, prescricao || null, observacoes || null, metadados ? JSON.stringify(metadados) : null]
    );
    
    // Atualiza o status da consulta para REALIZADA
    await pool.query('UPDATE consultas SET status = "REALIZADA" WHERE id_consulta = ?', [id_consulta]);

    await registrarAuditoria('prontuarios', 'INSERT', result.lastID, id_usuario || null);

    res.status(201).json({ sucesso: true, id_prontuario: result.lastID });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
