const KIT = ['Computador', 'Monitor', 'Teclado', 'Mouse', 'Leitor de cartão', 'Fone'];
const DISABLED_MODULES = new Set(['materiais']);
const isModuleEnabled = resource => !DISABLED_MODULES.has(resource);

const modules = {
  demandas: { name: 'Demandas', icon: '✓', fields: [['titulo', 'Demanda', 'Resumo da demanda'], ['tipo', 'Tipo', 'interna,externa'], ['solicitante', 'Solicitante', 'Nome do solicitante'], ['categoria', 'Categoria', 'DEMAND_CATEGORY'], ['outroDetalhe', 'Informe o que é', 'DEMAND_OTHER'], ['tecnicoResponsavel', 'Técnico responsável', 'TECHNICIAN'], ['prioridade', 'Prioridade', 'Baixa,Média,Alta,Crítica'], ['prazoSla', 'Prazo / SLA', 'DATE_OPTIONAL'], ['status', 'Status', 'DEMAND_STATUS'], ['descricao', 'Descrição da demanda externa (opcional)', 'OPTIONAL_TEXTAREA']] },
  materiais: { name: 'Materiais disponíveis na T.I.', icon: '◫', fields: [['item', 'Item', 'Nome do material'], ['categoria', 'Categoria', 'Ex.: Periféricos'], ['quantidade', 'Quantidade disponível', '0'], ['localizacao', 'Onde está guardado', 'Ex.: Armário da T.I.']] },
  programas: { name: 'Controle de Programas', icon: '◫', fields: [['programa', 'Programa / serviço', 'Nome do programa'], ['fornecedor', 'Fornecedor', 'Empresa contratada'], ['dataContratacao', 'Data da contratação', 'DATE_REQUIRED'], ['formaPagamento', 'Forma de pagamento', 'Cartão,Boleto,PIX,Transferência,Outro'], ['periodicidade', 'Periodicidade', 'Mensal,Anual'], ['dataRenovacao', 'Próxima renovação', 'DATE_REQUIRED'], ['valor', 'Valor da cobrança', 'CURRENCY'], ['status', 'Status', 'Ativo,Em renovação,Cancelado']] },
  equipamentos: { name: 'Controle de Equipamentos', icon: '◉', fields: [['patrimonio', 'Patrimônio', 'Código ou etiqueta'], ['equipamento', 'Equipamento', 'Nome do equipamento'], ['categoriaEquipamento', 'Subgrupo', 'Periférico,Computador,Notebook,Totem,Impressora'], ['numeroSerie', 'Número de série', 'OPTIONAL'], ['ip', 'IP do equipamento', 'Ex.: 192.168.1.25'], ['responsavel', 'Responsável', 'USER'], ['localizacao', 'Localização', 'Setor / sala'], ['condicao', 'Status', 'Em uso,Devolvido,Em manutenção'], ['avaliacao', 'Avaliação', 'Bom,Ruim,Precisa de manutenção,Troca necessária'], ['dataRetirada', 'Data de retirada', 'DATE_OPTIONAL'], ['dataDevolucao', 'Data de devolução', 'DATE_OPTIONAL']] },
  ramais: { name: 'Ramais', icon: '☎', fields: [['ramal', 'Ramal', 'Ex.: 204'], ['setor', 'Categoria / setor', 'RAMAL_SECTOR'], ['responsavel', 'Responsável', 'USER'], ['email', 'E-mail', 'OPTIONAL_EMAIL'], ['status', 'Ativação', 'Ativo,Inativo'], ['funcionamento', 'Funcionamento', 'Bom funcionamento,Com falha,Em manutenção']] },
  redes: { name: 'Wi-Fi', icon: '<svg class="wifi-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.7 8.2a14.3 14.3 0 0 1 18.6 0l-1.9 2.1a11.4 11.4 0 0 0-14.8 0L2.7 8.2Zm3.8 4.1a8.5 8.5 0 0 1 11 0l-1.9 2.1a5.6 5.6 0 0 0-7.2 0l-1.9-2.1Zm3.7 4.1a2.7 2.7 0 0 1 3.6 0L12 18.5l-1.8-2.1Z"/></svg>', fields: [['nome', 'Nome da rede Wi-Fi', 'Nome da rede Wi-Fi'], ['senha', 'Senha', 'PASSWORD_REQUIRED'], ['localizacao', 'Localização', 'Setor / rack'], ['status', 'Status', 'Ativa,Inativa,Em manutenção']] },
  patrimonio: { name: 'Patrimônio', icon: '◇', fields: [['codigo', 'Código', 'Código patrimonial'], ['produto', 'Produto', 'Nome do produto'], ['descricao', 'Descrição', 'Descrição do item'], ['localizacao', 'Localização', 'Setor / sala'], ['situacao', 'Situação', 'Em uso,Disponível,Em manutenção,Baixado']] }
};

const DEMAND_CATEGORIES = {
  Software: ['RealClinic — Login / Acesso', 'RealClinic — Exclusão de pagamento particular', 'RealClinic — Exclusão de fatura', 'RealClinic — Exclusão de atendimento', 'RealClinic — Alterar convênio', 'RealClinic — Incluir procedimento', 'RealClinic — Atualizar valor de procedimento', 'RealClinic — Atualizar taxa', 'RealClinic — Incluir profissional', 'RealClinic — Abrir chamado TDSA', 'RealClinic — Relatório', 'RealClinic — Movimentação de estoque', 'RealClinic — Atualizar tabela', 'IPTell — Bot', 'IPTell — Login / Acesso', 'Site do hospital'],
  Hardware: ['Computador', 'Fone', 'Impressora', 'Tomografia', 'Raio X', 'Etiquetadora', 'Scanner'],
  'Impressão': ['Toner', 'Etiqueta'],
  Telefonia: ['Telefones', 'Ramais', 'MicroSIP'],
  Outros: []
};

const normalizeDemandText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const isExclusionRequest = value => normalizeDemandText(value).includes('exclusao');
const EXCLUSION_REASON_CATEGORIES = ['Atendimento duplicado', 'Paciente incorreto', 'Procedimento incorreto', 'Convênio incorreto', 'Guia/autorização incorreta', 'Lançamento por engano', 'Cadastro duplicado', 'Exame/procedimento duplicado', 'Outros'];
const DEMAND_DETAIL_RULES = [
  { subjects: ['atualizar taxa', 'atualizar valor de procedimento'], title: 'Dados para atualização', fields: [['codigoProcedimento', 'Código do procedimento', 'Ex.: 10101012'], ['convenio', 'Convênio', 'Informe o convênio'], ['valorProcedimento', 'Valor', 'R$ 0,00']] },
  { subjects: ['incluir procedimento'], title: 'Dados do procedimento', fields: [['valorProcedimento', 'Valor', 'R$ 0,00'], ['tuss', 'TUSS', 'Código TUSS']] },
  { subjects: ['atualizar tabela'], title: 'Dados da tabela', fields: [['convenio', 'Convênio', 'Informe o convênio'], ['tabela', 'Tabela', 'Informe a tabela']] }
];
const RAMAL_SECTORS = ['Administrativo', 'Atendimento', 'Auditoria', 'Centro Cirúrgico', 'Compras', 'Contabilidade', 'Enfermagem', 'Farmácia', 'Faturamento', 'Financeiro', 'Internação', 'Laboratório', 'Recepção', 'Recursos Humanos', 'T.I.', 'Tomografia', 'Raio X', 'Outros'];
const moduleFilters = {
  materiais: [['categoria', 'Categoria']],
  programas: [['status', 'Status'], ['periodicidade', 'Periodicidade']],
  equipamentos: [['categoriaEquipamento', 'Subgrupo'], ['condicao', 'Status'], ['responsavel', 'Responsável'], ['localizacao', 'Localização']],
  ramais: [['setor', 'Categoria / setor'], ['status', 'Ativação'], ['funcionamento', 'Funcionamento']],
  redes: [['status', 'Status'], ['localizacao', 'Localização']],
  patrimonio: [['situacao', 'Situação'], ['localizacao', 'Localização']]
};
