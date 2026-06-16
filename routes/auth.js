const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');
const router = express.Router();

function hashPassword(senha) {
  return crypto.createHash('sha256').update(senha).digest('hex');
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha são obrigatórios' });

  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const user = rows[0];

    if (user.ativo === 0) {
      return res.status(403).json({ erro: 'Conta bloqueada por excesso de tentativas falhas. Contate o administrador.' });
    }

    const hashed = hashPassword(senha);

    if (user.senha_hash !== hashed) {
      // Registrar tentativa falha
      const tentativas = user.tentativas_login + 1;
      let ativo = 1;
      let msg = 'Credenciais inválidas';
      if (tentativas >= 5) {
        ativo = 0;
        msg = 'Conta bloqueada após 5 tentativas inválidas.';
      }
      await pool.query('UPDATE usuarios SET tentativas_login = ?, ativo = ? WHERE id_usuario = ?', [tentativas, ativo, user.id_usuario]);
      return res.status(401).json({ erro: msg });
    }

    // Reset tentativas e autoriza
    await pool.query('UPDATE usuarios SET tentativas_login = 0 WHERE id_usuario = ?', [user.id_usuario]);

    // Buscar nível de acesso
    const [grupos] = await pool.query('SELECT nivel_acesso FROM grupos_usuarios WHERE id_grupo = ?', [user.id_grupo]);
    const nivel = grupos[0] ? grupos[0].nivel_acesso : 'nenhum';

    res.json({
      sucesso: true,
      usuario: { id: user.id_usuario, nome: user.nome, email: user.email, nivel_acesso: nivel }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ erro: 'Erro interno no servidor' });
  }
});

module.exports = router;
