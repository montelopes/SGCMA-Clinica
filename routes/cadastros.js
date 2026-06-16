const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// Função auxiliar para auditoria
async function registrarAuditoria(tabela, operacao, id_registro, id_usuario, dados_anteriores = null) {
  const query = 'INSERT INTO log_auditoria (tabela_afetada, operacao, id_registro, id_usuario, dados_anteriores) VALUES (?, ?, ?, ?, ?)';
  const dados_json = dados_anteriores ? JSON.stringify(dados_anteriores) : null;
  await pool.query(query, [tabela, operacao, id_registro, id_usuario, dados_json]);
}

// ================= PACIENTES =================
router.get('/pacientes', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, c.nome as convenio_nome 
      FROM pacientes p 
      LEFT JOIN convenios c ON p.id_convenio = c.id_convenio
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/pacientes', async (req, res) => {
  const { cpf, nome_paciente, dt_nascimento, telefone, email, id_convenio, id_usuario } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO pacientes (cpf, nome_paciente, dt_nascimento, telefone, email, id_convenio) VALUES (?, ?, ?, ?, ?, ?)',
      [cpf, nome_paciente, dt_nascimento, telefone, email, id_convenio || null]
    );
    await registrarAuditoria('pacientes', 'INSERT', result.lastID, id_usuario || null);
    res.status(201).json({ sucesso: true, id_paciente: result.lastID });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

router.put('/pacientes/:id', async (req, res) => {
  const { cpf, nome_paciente, dt_nascimento, telefone, email, id_convenio, id_usuario } = req.body;
  try {
    const [antigo] = await pool.query('SELECT * FROM pacientes WHERE id_paciente = ?', [req.params.id]);
    await pool.query(
      'UPDATE pacientes SET cpf=?, nome_paciente=?, dt_nascimento=?, telefone=?, email=?, id_convenio=? WHERE id_paciente=?',
      [cpf, nome_paciente, dt_nascimento, telefone, email, id_convenio || null, req.params.id]
    );
    await registrarAuditoria('pacientes', 'UPDATE', req.params.id, id_usuario || null, antigo[0]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// ================= MEDICOS =================
router.get('/medicos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.*, e.nome as especialidade_nome 
      FROM medicos m 
      LEFT JOIN especialidades e ON m.id_especialidade = e.id_especialidade
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/medicos', async (req, res) => {
  const { crm, nome_medico, id_especialidade, telefone, ativo, id_usuario } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO medicos (crm, nome_medico, id_especialidade, telefone, ativo) VALUES (?, ?, ?, ?, ?)',
      [crm, nome_medico, id_especialidade || null, telefone, ativo !== undefined ? ativo : 1]
    );
    await registrarAuditoria('medicos', 'INSERT', result.lastID, id_usuario || null);
    res.status(201).json({ sucesso: true, id_medico: result.lastID });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

router.put('/medicos/:id', async (req, res) => {
  const { crm, nome_medico, id_especialidade, telefone, ativo, id_usuario } = req.body;
  try {
    const [antigo] = await pool.query('SELECT * FROM medicos WHERE id_medico = ?', [req.params.id]);
    await pool.query(
      'UPDATE medicos SET crm=?, nome_medico=?, id_especialidade=?, telefone=?, ativo=? WHERE id_medico=?',
      [crm, nome_medico, id_especialidade || null, telefone, ativo, req.params.id]
    );
    await registrarAuditoria('medicos', 'UPDATE', req.params.id, id_usuario || null, antigo[0]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// ================= ESPECIALIDADES & CONVENIOS =================
router.get('/especialidades', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM especialidades');
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.get('/convenios', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM convenios');
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
