const express = require('express');
const pool = require('../config/db');
const router = express.Router();

async function registrarAuditoria(tabela, operacao, id_registro, id_usuario, dados_anteriores = null) {
  const query = 'INSERT INTO log_auditoria (tabela_afetada, operacao, id_registro, id_usuario, dados_anteriores) VALUES (?, ?, ?, ?, ?)';
  const dados_json = dados_anteriores ? JSON.stringify(dados_anteriores) : null;
  await pool.query(query, [tabela, operacao, id_registro, id_usuario, dados_json]);
}

// GET /historico-paciente
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

// POST /prontuario
router.post('/prontuario', async (req, res) => {
  const { id_consulta, paciente_id, diagnostico, prescricao, observacoes, metadados, id_usuario } = req.body;

  // 1. Validação básica
  if (!id_consulta || !paciente_id) {
    return res.status(400).json({ erro: 'id_consulta e paciente_id são obrigatórios' });
  }

  try {
    // 2. Verifica se a consulta existe E pertence ao paciente informado
    const [consultas] = await pool.query(
      'SELECT id_consulta, id_paciente FROM consultas WHERE id_consulta = ?',
      [id_consulta]
    );

    if (consultas.length === 0) {
      return res.status(404).json({ erro: `Consulta com id ${id_consulta} não encontrada` });
    }

    const consulta = consultas[0];

    // 3. Garante que o paciente_id bate com o da consulta (evita FK inválida)
    if (String(consulta.id_paciente) !== String(paciente_id)) {
      return res.status(400).json({
        erro: `O paciente_id (${paciente_id}) não corresponde ao paciente da consulta (${consulta.id_paciente})`
      });
    }

    // 4. Verifica se o paciente existe na tabela pacientes
    const [pacientes] = await pool.query(
      'SELECT id_paciente FROM pacientes WHERE id_paciente = ?',
      [paciente_id]
    );

    if (pacientes.length === 0) {
      return res.status(404).json({ erro: `Paciente com id ${paciente_id} não encontrado` });
    }

    // 5. Verifica se já existe prontuário para essa consulta (evita duplicata)
    const [prontuarioExistente] = await pool.query(
      'SELECT id_prontuario FROM prontuarios WHERE id_consulta = ?',
      [id_consulta]
    );

    if (prontuarioExistente.length > 0) {
      return res.status(409).json({
        erro: 'Já existe um prontuário registrado para esta consulta',
        id_prontuario: prontuarioExistente[0].id_prontuario
      });
    }

    // 6. Serializa metadados corretamente (evita double-stringify)
    let metadadosStr = null;
    if (metadados !== undefined && metadados !== null) {
      metadadosStr = typeof metadados === 'string' ? metadados : JSON.stringify(metadados);
    }

    // 7. Insere o prontuário
    const [result] = await pool.query(
      'INSERT INTO prontuarios (id_consulta, paciente_id, diagnostico, prescricao, observacoes, metadados) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id_consulta,
        paciente_id,
        diagnostico || null,
        prescricao || null,
        observacoes || null,
        metadadosStr
      ]
    );

    // 8. Atualiza status da consulta para REALIZADA
    await pool.query(
      "UPDATE consultas SET status = 'REALIZADA' WHERE id_consulta = ?",
      [id_consulta]
    );

    // 9. Registra auditoria
    await registrarAuditoria('prontuarios', 'INSERT', result.lastID, id_usuario || null);

    res.status(201).json({
      sucesso: true,
      id_prontuario: result.lastID,
      mensagem: 'Prontuário salvo com sucesso'
    });

  } catch (err) {
    console.error('Erro em POST /prontuario:', err);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
