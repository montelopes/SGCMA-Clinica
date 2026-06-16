-- ============================================================================
-- UNIVERSIDADE CATÓLICA DE BRASÍLIA
-- Disciplina: Laboratório de Banco de Dados
-- Projeto: Sistema de Gerenciamento de Clínica Médica e Agendamento (SGCMA)
-- Autores: Caio Monte Lopes, Caio Gabriel, Caio Eduardo, Breno [cite: 6]
-- Professor: Jefferson Salomão 
-- Data de Entrega: 15 de junho de 2026 
-- ============================================================================
drop database sgcma_db;
CREATE DATABASE IF NOT EXISTS sgcma_db;
USE sgcma_db;

-- ----------------------------------------------------------------------------
-- 1. CRIAÇÃO DAS TABELAS (RESPEITANDO A 3FN E O DER DO ARTIGO) [cite: 11, 111]
-- ----------------------------------------------------------------------------

CREATE TABLE grupos_usuarios (
    id_grupo INT AUTO_INCREMENT,
    nome_grupo VARCHAR(50) NOT NULL,
    nivel_acesso INT NOT NULL,
    CONSTRAINT pk_grupos_usuarios PRIMARY KEY (id_grupo)
);

CREATE TABLE usuarios (
    id_usuario VARCHAR(20) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    ativo TINYINT(1) DEFAULT 1,
    id_grupo INT NOT NULL,
    dt_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    tentativas_login INT DEFAULT 0,
    CONSTRAINT pk_usuarios PRIMARY KEY (id_usuario),
    CONSTRAINT fk_usuarios_grupos FOREIGN KEY (id_grupo) REFERENCES grupos_usuarios(id_grupo)
);

CREATE TABLE especialidades (
    id_especialidade INT AUTO_INCREMENT,
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(255),
    CONSTRAINT pk_especialidades PRIMARY KEY (id_especialidade)
);

CREATE TABLE medicos (
    id_medico VARCHAR(12) NOT NULL,
    crm VARCHAR(20) NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    id_especialidade INT NOT NULL,
    telefone VARCHAR(20),
    ativo TINYINT(1) DEFAULT 1,
    CONSTRAINT pk_medicos PRIMARY KEY (id_medico),
    CONSTRAINT fk_medicos_especialidades FOREIGN KEY (id_especialidade) REFERENCES especialidades(id_especialidade)
);

CREATE TABLE convenios (
    id_convenio INT AUTO_INCREMENT,
    nome VARCHAR(100) NOT NULL,
    registro_ans VARCHAR(20) UNIQUE,
    percentual_cobertura DECIMAL(5,2) NOT NULL,
    CONSTRAINT pk_convenios PRIMARY KEY (id_convenio)
);

CREATE TABLE pacientes (
    id_paciente VARCHAR(12) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    dt_nascimento DATE NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(100),
    id_convenio INT,
    CONSTRAINT pk_pacientes PRIMARY KEY (id_paciente),
    CONSTRAINT fk_pacientes_convenios FOREIGN KEY (id_convenio) REFERENCES convenios(id_convenio)
);

CREATE TABLE consultas (
    id_consulta VARCHAR(12) NOT NULL,
    id_paciente VARCHAR(12) NOT NULL,
    id_medico VARCHAR(12) NOT NULL,
    dt_consulta DATE NOT NULL,
    hora TIME NOT NULL,
    status ENUM('AGENDADA', 'REALIZADA', 'CANCELADA') DEFAULT 'AGENDADA',
    id_usuario_agend VARCHAR(20) NOT NULL,
    dt_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_consultas PRIMARY KEY (id_consulta),
    CONSTRAINT fk_consultas_pacientes FOREIGN KEY (id_paciente) REFERENCES pacientes(id_paciente),
    CONSTRAINT fk_consultas_medicos FOREIGN KEY (id_medico) REFERENCES medicos(id_medico),
    CONSTRAINT fk_consultas_usuarios FOREIGN KEY (id_usuario_agend) REFERENCES usuarios(id_usuario)
);

-- Tabela Prontuários integrada com suporte JSON (Abordagem Híbrida / NoSQL Document) 
CREATE TABLE prontuarios (
    id_prontuario INT AUTO_INCREMENT,
    fk_id_consulta VARCHAR(12) NOT NULL UNIQUE,
    diagnostico TEXT NOT NULL,
    prescricao TEXT NOT NULL,
    observacoes TEXT,
    metadados_clinicos JSON, -- Campo NoSQL para armazenar dados dinâmicos de exames 
    dt_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    dt_registro_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_prontuarios PRIMARY KEY (id_prontuario),
    CONSTRAINT fk_prontuarios_consultas FOREIGN KEY (fk_id_consulta) REFERENCES consultas(id_consulta)
);

CREATE TABLE log_auditoria (
    id_log INT AUTO_INCREMENT,
    tabela_afetada VARCHAR(50) NOT NULL,
    operacao VARCHAR(20) NOT NULL,
    id_registro VARCHAR(50) NOT NULL,
    id_usuario VARCHAR(100) NOT NULL,
    dt_operacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    dados_anteriores JSON, -- Armazenamento de estado em formato NoSQL Document 
    CONSTRAINT pk_log_auditoria PRIMARY KEY (id_log)
);


-- ----------------------------------------------------------------------------
-- 2. FUNÇÕES CUSTOMIZADAS (FUNCTIONS) [cite: 37, 126]
-- ----------------------------------------------------------------------------
DELIMITER $$

CREATE FUNCTION gerar_id_paciente() 
RETURNS VARCHAR(12)
DETERMINISTIC
BEGIN
    DECLARE seq INT;
    DECLARE novo_id VARCHAR(12);
    SELECT COALESCE(MAX(CAST(SUBSTRING(id_paciente, 4) AS UNSIGNED)), 0) + 1 INTO seq FROM pacientes;
    SET novo_id = CONCAT('PAC', LPAD(seq, 8, '0'));
    RETURN novo_id;
END$$

CREATE FUNCTION gerar_id_medico() 
RETURNS VARCHAR(12)
DETERMINISTIC
BEGIN
    DECLARE seq INT;
    DECLARE novo_id VARCHAR(12);
    SELECT COALESCE(MAX(CAST(SUBSTRING(id_medico, 4) AS UNSIGNED)), 0) + 1 INTO seq FROM medicos;
    SET novo_id = CONCAT('MED', LPAD(seq, 8, '0'));
    RETURN novo_id;
END$$

CREATE FUNCTION gerar_id_consulta() 
RETURNS VARCHAR(12)
DETERMINISTIC
BEGIN
    DECLARE seq INT;
    DECLARE novo_id VARCHAR(12);
    SELECT COALESCE(MAX(CAST(SUBSTRING(id_consulta, 4) AS UNSIGNED)), 0) + 1 INTO seq FROM consultas;
    SET novo_id = CONCAT('CON', LPAD(seq, 8, '0'));
    RETURN novo_id;
END$$

CREATE FUNCTION fn_total_consultas_medico(
    p_id_medico VARCHAR(12),
    p_dt_inicio DATE,
    p_dt_fim DATE
) 
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE total INT;
    SELECT COUNT(*) INTO total FROM consultas
    WHERE id_medico = p_id_medico
      AND dt_consulta BETWEEN p_dt_inicio AND p_dt_fim
      AND status = 'REALIZADA';
    RETURN total;
END$$

CREATE FUNCTION fn_idade_paciente(p_dt_nasc DATE) 
RETURNS INT
DETERMINISTIC
BEGIN
    RETURN TIMESTAMPDIFF(YEAR, p_dt_nasc, CURDATE());
END$$

DELIMITER ;


-- ----------------------------------------------------------------------------
-- 3. PROCEDIMENTOS ARMAZENADOS (STORED PROCEDURES) [cite: 37]
-- ----------------------------------------------------------------------------
DELIMITER $$

CREATE PROCEDURE sp_agendar_consulta(
    IN p_id_paciente VARCHAR(12),
    IN p_id_medico VARCHAR(12),
    IN p_dt_consulta DATE,
    IN p_hora TIME,
    IN p_id_usuario VARCHAR(20),
    OUT p_id_consulta VARCHAR(12)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
        SET p_id_consulta = gerar_id_consulta();
        INSERT INTO consultas (id_consulta, id_paciente, id_medico, dt_consulta, hora, status, id_usuario_agend)
        VALUES (p_id_consulta, p_id_paciente, p_id_medico, p_dt_consulta, p_hora, 'AGENDADA', p_id_usuario);
    COMMIT;
END$$

CREATE PROCEDURE sp_cancelar_consulta(
    IN p_id_consulta VARCHAR(12)
)
BEGIN
    UPDATE consultas 
    SET status = 'CANCELADA' 
    WHERE id_consulta = p_id_consulta;
END$$

DELIMITER ;


-- ----------------------------------------------------------------------------
-- 4. GATILHOS AUTOMÁTICOS (TRIGGERS) [cite: 35, 145]
-- ----------------------------------------------------------------------------
DELIMITER $$

-- Trigger 1: Log de auditoria estruturado via documento JSON (Abordagem Híbrida) [cite: 94, 147]
CREATE TRIGGER trg_auditoria_consultas
AFTER UPDATE ON consultas 
FOR EACH ROW
BEGIN
    INSERT INTO log_auditoria (tabela_afetada, operacao, id_registro, id_usuario, dt_operacao, dados_anteriores)
    VALUES (
        'consultas',
        'UPDATE', 
        OLD.id_consulta,
        USER(), 
        NOW(), 
        JSON_OBJECT('status', OLD.status, 'dt_consulta', OLD.dt_consulta, 'hora', OLD.hora)
    );
END$$

-- Trigger 2: Bloqueio automático de segurança de usuários [cite: 159]
CREATE TRIGGER trg_bloquear_usuario
BEFORE UPDATE ON usuarios 
FOR EACH ROW
BEGIN
    IF NEW.tentativas_login >= 5 THEN
        SET NEW.ativo = 0;
    END IF;
END$$

-- Trigger 3: Validação de conflito de agendas em tempo de execução [cite: 169]
CREATE TRIGGER trg_validar_agendamento
BEFORE INSERT ON consultas 
FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1 FROM consultas 
        WHERE id_medico = NEW.id_medico 
          AND dt_consulta = NEW.dt_consulta 
          AND hora = NEW.hora 
          AND status != 'CANCELADA'
    ) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Erro de Negócio: Horário já ocupado para este médico.';
    END IF;
END$$

DELIMITER ;


-- ----------------------------------------------------------------------------
-- 5. VISÕES (VIEWS) [cite: 36, 181]
-- ----------------------------------------------------------------------------

-- View 1: Painel operacional para o perfil de recepção [cite: 183]
CREATE VIEW vw_agenda_diaria AS
SELECT 
    c.id_consulta, 
    c.dt_consulta, 
    c.hora, 
    c.status,
    p.nome AS nome_paciente, 
    p.telefone,
    m.nome AS nome_medico, 
    e.nome AS especialidade
FROM consultas c
JOIN pacientes p ON c.id_paciente = p.id_paciente
JOIN medicos m ON c.id_medico = m.id_medico
JOIN especialidades e ON m.id_especialidade = e.id_especialidade
WHERE c.dt_consulta = CURDATE()
ORDER BY c.hora;

-- View 2: Relatório analítico gerencial com agregação nativa [cite: 196]
CREATE VIEW vw_relatorio_mensal AS
SELECT 
    m.nome AS medico, 
    e.nome AS especialidade,
    COUNT(*) AS total_consultas,
    SUM(CASE WHEN c.status = 'REALIZADA' THEN 1 ELSE 0 END) AS realizadas,
    SUM(CASE WHEN c.status = 'CANCELADA' THEN 1 ELSE 0 END) AS canceladas
FROM consultas c
JOIN medicos m ON c.id_medico = m.id_medico
JOIN especialidades e ON m.id_especialidade = e.id_especialidade
WHERE MONTH(c.dt_consulta) = MONTH(NOW()) AND YEAR(c.dt_consulta) = YEAR(NOW())
GROUP BY m.id_medico, e.id_especialidade;

-- View 3: Prontuário Eletrônico Unificado (Consome o documento JSON dinâmico NoSQL) [cite: 94, 209]
CREATE VIEW vw_historico_paciente AS
SELECT 
    p.id_paciente,
    p.nome AS nome_paciente,
    fn_idade_paciente(p.dt_nascimento) AS idade,
    c.id_consulta,
    c.dt_consulta,
    m.nome AS medico_atendente,
    pr.diagnostico,
    pr.prescricao,
    pr.observacoes,
    -- Extração NoSQL Document de propriedades dinâmicas do JSON 
    JSON_UNQUOTE(JSON_EXTRACT(pr.metadados_clinicos, '$.pressao_arterial')) AS pressao,
    JSON_UNQUOTE(JSON_EXTRACT(pr.metadados_clinicos, '$.temperatura')) AS temperatura
FROM pacientes p
JOIN consultas c ON p.id_paciente = c.id_paciente
JOIN medicos m ON c.id_medico = m.id_medico
LEFT JOIN prontuarios pr ON c.id_consulta = pr.fk_id_consulta;


-- ----------------------------------------------------------------------------
-- 6. ÍNDICES DE DESEMPENHO (JUSTIFICADOS NO ARTIGO) [cite: 40, 140]
-- ----------------------------------------------------------------------------
CREATE INDEX idx_consultas_data ON consultas (dt_consulta);
CREATE INDEX idx_consultas_medico ON consultas (id_medico);
CREATE INDEX idx_consultas_paciente ON consultas (id_paciente);
CREATE INDEX idx_pacientes_cpf ON pacientes (cpf);
CREATE INDEX idx_medicos_crm ON medicos (crm);
CREATE INDEX idx_usuarios_email ON usuarios (email);
CREATE INDEX idx_log_tabela_data ON log_auditoria (tabela_afetada, dt_operacao);


-- ----------------------------------------------------------------------------
-- 7. CONTROLE GRANULAR DE ACESSO (SEGURANÇA POR PERFIL) [cite: 38, 255]
-- ----------------------------------------------------------------------------

CREATE USER IF NOT EXISTS 'app_admin'@'localhost' IDENTIFIED BY 'SenhaAdminForte@2026';
CREATE USER IF NOT EXISTS 'app_recepcao'@'localhost' IDENTIFIED BY 'SenhaRecepcao@2026';
CREATE USER IF NOT EXISTS 'app_medico'@'localhost' IDENTIFIED BY 'SenhaMedico@2026';
CREATE USER IF NOT EXISTS 'app_financeiro'@'localhost' IDENTIFIED BY 'SenhaFinanceiro@2026';

-- Concessão baseada restritamente na Matriz de Privilégios do Artigo [cite: 258]
GRANT ALL PRIVILEGES ON sgcma_db.* TO 'app_admin'@'localhost';

GRANT SELECT, INSERT, UPDATE ON sgcma_db.consultas TO 'app_recepcao'@'localhost';
GRANT SELECT, INSERT, UPDATE ON sgcma_db.pacientes TO 'app_recepcao'@'localhost';
GRANT SELECT, INSERT, UPDATE ON sgcma_db.medicos TO 'app_recepcao'@'localhost';
GRANT SELECT ON sgcma_db.vw_agenda_diaria TO 'app_recepcao'@'localhost';

GRANT SELECT ON sgcma_db.vw_agenda_diaria TO 'app_medico'@'localhost';
GRANT SELECT ON sgcma_db.vw_historico_paciente TO 'app_medico'@'localhost';
GRANT INSERT, UPDATE ON sgcma_db.prontuarios TO 'app_medico'@'localhost';

GRANT SELECT ON sgcma_db.consultas TO 'app_financeiro'@'localhost';
GRANT SELECT ON sgcma_db.convenios TO 'app_financeiro'@'localhost';
GRANT SELECT ON sgcma_db.vw_relatorio_mensal TO 'app_financeiro'@'localhost';

FLUSH PRIVILEGES;


-- ----------------------------------------------------------------------------
-- 8. CARGA INICIAL E DISPARO DE TESTES DE INTEGRIDADE
-- ----------------------------------------------------------------------------

-- Massa base de parametrização
INSERT INTO grupos_usuarios (nome_grupo, nivel_acesso) VALUES 
('Administrador', 1), ('Recepcionista', 2), ('Médico', 3), ('Financeiro', 4);

INSERT INTO usuarios (id_usuario, nome, email, senha_hash, id_grupo) VALUES 
('USR001', 'Breno Silva', 'breno@clinica.com', 'hash_breno_77', 1),
('USR002', 'Caio Monte', 'caio.monte@clinica.com', 'hash_monte_88', 2),
('USR003', 'Caio Gabriel', 'caio.gabriel@clinica.com', 'hash_gabriel_99', 3),
('USR004', 'Caio Eduardo', 'caio.eduardo@clinica.com', 'hash_eduardo_00', 4);

INSERT INTO especialidades (nome) VALUES ('Cardiologia'), ('Pediatria'), ('Clínica Médica');

-- Geração de IDs em tempo de execução via chamadas diretas das Functions [cite: 126]
INSERT INTO medicos (id_medico, crm, nome, id_especialidade) VALUES 
(gerar_id_medico(), 'CRM-DF 12345', 'Dr. Jefferson Salomão', 3),
(gerar_id_medico(), 'CRM-DF 67890', 'Dra. Cláudia Souza', 1);

INSERT INTO convenios (nome, registro_ans, percentual_cobertura) VALUES 
('Particular', NULL, 0.00),
('Amil', '326305', 100.00);

INSERT INTO pacientes (id_paciente, cpf, nome, dt_nascimento, telefone, email, id_convenio) VALUES 
(gerar_id_paciente(), '000.000.000-00', 'Augusto Cesar', '1990-05-15', '61999999999', 'augusto@email.com', 2),
(gerar_id_paciente(), '111.111.111-11', 'Beatriz Rocha', '2015-10-22', '61988888888', 'beatriz@email.com', 1);

-- Agendamento transacional usando a Stored Procedure do escopo [cite: 212]
SET @id_gerado = '';
CALL sp_agendar_consulta('PAC00000001', 'MED00000001', CURDATE(), '14:00:00', 'USR002', @id_gerado);
CALL sp_agendar_consulta('PAC00000002', 'MED00000002', CURDATE(), '16:00:00', 'USR002', @id_gerado);

-- Massa Clínico-Documental: Inserindo dados relacionais textuais e dados Dinâmicos (NoSQL JSON) 
INSERT INTO prontuarios (fk_id_consulta, diagnostico, prescricao, observacoes, metadados_clinicos) VALUES 
('CON00000002', 'Check-up de rotina pediátrica.', 'Nenhuma medicação necessária.', 'Retorno anual.', 
 '{"pressao_arterial": "12x8", "temperatura": "36.5", "peso_kg": 22.4}');

-- Operação simulada para forçar o disparo do Trigger de Auditoria em formato JSON [cite: 94, 147]
UPDATE consultas SET status = 'REALIZADA' WHERE id_consulta = 'CON00000001';

-- Comando de verificação rápida para comprovar o sucesso da estrutura
SELECT * FROM log_auditoria;
SELECT * FROM vw_historico_paciente;