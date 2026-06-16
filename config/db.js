const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const crypto = require('crypto');

let dbPromise;

// Função para simular o comportamento de hash do banco/senha
function hashPassword(senha) {
  return crypto.createHash('sha256').update(senha).digest('hex');
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = open({
      filename: path.join(__dirname, '../database.sqlite'),
      driver: sqlite3.Database
    }).then(async (db) => {
      // Habilitar Foreign Keys no SQLite
      await db.exec('PRAGMA foreign_keys = ON;');

      // ================= CREATE TABLES =================
      await db.exec(`
        CREATE TABLE IF NOT EXISTS grupos_usuarios (
          id_grupo INTEGER PRIMARY KEY AUTOINCREMENT,
          nome_grupo TEXT NOT NULL,
          descricao TEXT,
          nivel_acesso TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS usuarios (
          id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          senha_hash TEXT NOT NULL,
          ativo INTEGER DEFAULT 1,
          id_grupo INTEGER,
          dt_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
          tentativas_login INTEGER DEFAULT 0,
          FOREIGN KEY (id_grupo) REFERENCES grupos_usuarios(id_grupo)
        );

        CREATE TABLE IF NOT EXISTS log_auditoria (
          id_log INTEGER PRIMARY KEY AUTOINCREMENT,
          tabela_afetada TEXT NOT NULL,
          operacao TEXT NOT NULL,
          id_registro INTEGER,
          id_usuario INTEGER,
          dt_operacao DATETIME DEFAULT CURRENT_TIMESTAMP,
          dados_anteriores TEXT
        );

        CREATE TABLE IF NOT EXISTS especialidades (
          id_especialidade INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          descricao TEXT
        );

        CREATE TABLE IF NOT EXISTS convenios (
          id_convenio INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          registro_ans TEXT,
          percentual_cobertura REAL
        );

        CREATE TABLE IF NOT EXISTS pacientes (
          id_paciente INTEGER PRIMARY KEY AUTOINCREMENT,
          cpf TEXT UNIQUE NOT NULL,
          nome_paciente TEXT NOT NULL,
          dt_nascimento DATE,
          telefone TEXT,
          email TEXT,
          id_convenio INTEGER,
          FOREIGN KEY (id_convenio) REFERENCES convenios(id_convenio)
        );

        CREATE TABLE IF NOT EXISTS medicos (
          id_medico INTEGER PRIMARY KEY AUTOINCREMENT,
          crm TEXT UNIQUE NOT NULL,
          nome_medico TEXT NOT NULL,
          id_especialidade INTEGER,
          telefone TEXT,
          ativo INTEGER DEFAULT 1,
          FOREIGN KEY (id_especialidade) REFERENCES especialidades(id_especialidade)
        );

        CREATE TABLE IF NOT EXISTS consultas (
          id_consulta INTEGER PRIMARY KEY AUTOINCREMENT,
          id_paciente INTEGER NOT NULL,
          id_medico INTEGER NOT NULL,
          dt_consulta DATE NOT NULL,
          hora_consulta TIME NOT NULL,
          status TEXT DEFAULT 'AGENDADA',
          id_usuario_agend INTEGER,
          observacoes TEXT,
          FOREIGN KEY (id_paciente) REFERENCES pacientes(id_paciente),
          FOREIGN KEY (id_medico) REFERENCES medicos(id_medico),
          FOREIGN KEY (id_usuario_agend) REFERENCES usuarios(id_usuario)
        );

        CREATE TABLE IF NOT EXISTS prontuarios (
          id_prontuario INTEGER PRIMARY KEY AUTOINCREMENT,
          id_consulta INTEGER NOT NULL,
          paciente_id INTEGER NOT NULL,
          diagnostico TEXT,
          prescricao TEXT,
          observacoes TEXT,
          metadados TEXT,
          dt_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (id_consulta) REFERENCES consultas(id_consulta),
          FOREIGN KEY (paciente_id) REFERENCES pacientes(id_paciente)
        );
      `);

      // ================= CREATE VIEWS =================
      await db.exec(`
        DROP VIEW IF EXISTS vw_agenda_diaria;
        CREATE VIEW vw_agenda_diaria AS
        SELECT
          c.id_consulta,
          c.dt_consulta,
          c.hora_consulta as horario,
          p.nome_paciente as paciente,
          m.nome_medico as medico,
          e.nome as especialidade,
          c.status
        FROM consultas c
        JOIN pacientes p ON c.id_paciente = p.id_paciente
        JOIN medicos m ON c.id_medico = m.id_medico
        JOIN especialidades e ON m.id_especialidade = e.id_especialidade
        WHERE c.dt_consulta = date('now')
        ORDER BY c.hora_consulta ASC;

        DROP VIEW IF EXISTS vw_historico_paciente;
        CREATE VIEW vw_historico_paciente AS
        SELECT
          pr.id_prontuario as id,
          pr.paciente_id,
          p.nome_paciente,
          c.dt_consulta as data_consulta,
          c.hora_consulta,
          m.nome_medico,
          e.nome as especialidade,
          pr.diagnostico,
          pr.prescricao,
          pr.observacoes,
          pr.metadados
        FROM prontuarios pr
        JOIN pacientes p ON pr.paciente_id = p.id_paciente
        LEFT JOIN consultas c ON pr.id_consulta = c.id_consulta
        LEFT JOIN medicos m ON c.id_medico = m.id_medico
        LEFT JOIN especialidades e ON m.id_especialidade = e.id_especialidade
        ORDER BY c.dt_consulta DESC;

        DROP VIEW IF EXISTS vw_relatorio_mensal;
        CREATE VIEW vw_relatorio_mensal AS
        SELECT
          m.nome_medico as medico,
          e.nome as especialidade,
          COUNT(*) AS total_consultas,
          SUM(CASE WHEN c.status = 'REALIZADA' THEN 1 ELSE 0 END) AS realizadas,
          SUM(CASE WHEN c.status = 'CANCELADA' THEN 1 ELSE 0 END) AS canceladas
        FROM consultas c
        JOIN medicos m ON c.id_medico = m.id_medico
        JOIN especialidades e ON m.id_especialidade = e.id_especialidade
        WHERE strftime('%Y-%m', c.dt_consulta) = strftime('%Y-%m', 'now')
        GROUP BY m.id_medico, e.id_especialidade;
      `);

      // ================= INSERT MOCK DATA =================
      const { count } = await db.get('SELECT COUNT(*) as count FROM grupos_usuarios');
      if (count === 0) {
        // Grupos
        await db.exec(`
          INSERT INTO grupos_usuarios (nome_grupo, nivel_acesso) VALUES
          ('Administrador', 'admin'),
          ('Recepcionista', 'recepcao'),
          ('Médico', 'medico'),
          ('Financeiro', 'financeiro');
        `);

        // Usuários
        const sAdmin = hashPassword('admin123');
        const sRecep = hashPassword('recepcao123');
        const sMed = hashPassword('medico123');
        await db.run(`INSERT INTO usuarios (nome, email, senha_hash, id_grupo) VALUES ('Admin', 'admin@sgcma.com', ?, 1)`, [sAdmin]);
        await db.run(`INSERT INTO usuarios (nome, email, senha_hash, id_grupo) VALUES ('Recepcao', 'recepcao@sgcma.com', ?, 2)`, [sRecep]);
        await db.run(`INSERT INTO usuarios (nome, email, senha_hash, id_grupo) VALUES ('Dr. Carlos', 'carlos@sgcma.com', ?, 3)`, [sMed]);

        // Especialidades e Convênios
        await db.exec(`
          INSERT INTO especialidades (nome) VALUES ('Cardiologia'), ('Pediatria'), ('Clínico Geral');
          INSERT INTO convenios (nome, percentual_cobertura) VALUES ('Unimed', 100), ('Amil', 80), ('Particular', 0);
        `);

        // Pacientes e Médicos
        await db.exec(`
          INSERT INTO pacientes (cpf, nome_paciente, dt_nascimento, telefone, email, id_convenio)
          VALUES ('11122233344', 'João Silva', '1985-04-12', '11999998888', 'joao@email.com', 1),
                 ('55566677788', 'Maria Oliveira', '1990-10-25', '11988887777', 'maria@email.com', 2);

          INSERT INTO medicos (crm, nome_medico, id_especialidade, telefone)
          VALUES ('CRM1234', 'Dr. Carlos', 1, '11977776666'),
                 ('CRM5678', 'Dra. Ana', 2, '11966665555');
        `);

        // Consultas
        await db.exec(`
          INSERT INTO consultas (id_paciente, id_medico, dt_consulta, hora_consulta, status)
          VALUES (1, 1, date('now'), '14:00', 'AGENDADA'),
                 (2, 2, date('now', '-1 day'), '10:00', 'REALIZADA');
        `);

        // Prontuários (histórico)
        await db.exec(`
          INSERT INTO prontuarios (id_consulta, paciente_id, diagnostico, prescricao, observacoes, metadados)
          VALUES (2, 2, 'Gripe Forte', 'Repouso e Vitamina C', 'Paciente com febre moderada', '{"Temperatura": "38.5"}');
        `);
      }

      return db;
    });
  }
  return dbPromise;
}

// Wrapper pool-like
const pool = {
  query: async (sql, params) => {
    const db = await getDb();
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      const rows = await db.all(sql, params);
      return [rows];
    } else {
      const result = await db.run(sql, params);
      return [result];
    }
  },
  getConnection: async () => {
    return {
      query: pool.query,
      release: () => {}
    };
  }
};

module.exports = pool;