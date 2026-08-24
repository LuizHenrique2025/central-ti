const resourceDefinitions = {
  computadores: ['patrimonio', 'ip', 'grupo', 'responsavel', 'localizacao', 'status', 'avaliacao'],
  materiais: ['item', 'categoria', 'quantidade', 'localizacao'],
  programas: ['programa', 'fornecedor', 'dataContratacao', 'formaPagamento', 'periodicidade', 'dataRenovacao', 'valor', 'status'],
  equipamentos: ['patrimonio', 'equipamento', 'categoriaEquipamento', 'ip', 'responsavel', 'localizacao', 'condicao', 'avaliacao'],
  ramais: ['ramal', 'setor', 'responsavel', 'status', 'funcionamento'],
  redes: ['nome', 'senha', 'localizacao', 'status'],
  patrimonio: ['codigo', 'produto', 'descricao', 'localizacao', 'situacao'],
  demandas: ['titulo', 'solicitante', 'prioridade', 'status']
};

const optionalResourceFields = {
  materiais: ['observacoes'],
  computadores: ['numeroSerie', 'mac', 'dataSolicitacao', 'dataRetirada', 'dataDevolucao'],
  equipamentos: ['numeroSerie', 'dataRetirada', 'dataDevolucao'],
  ramais: ['email'],
  demandas: ['categoria', 'assunto', 'outroDetalhe', 'descricao', 'tecnicoResponsavel', 'prazoSla', 'codigoProcedimento', 'convenio', 'valorProcedimento', 'tuss', 'tabela']
};

const access = {
  admin: Object.keys(resourceDefinitions),
  ti: Object.keys(resourceDefinitions),
  consulta: []
};

const computerChecklist = ['Computador', 'Monitor', 'Teclado', 'Mouse', 'Leitor de cartão', 'Fone'];
// O recurso continua definido para preservar registros históricos e permitir
// reativação futura sem migração de dados.
const disabledResources = ['materiais'];

module.exports = { resourceDefinitions, optionalResourceFields, access, computerChecklist, disabledResources };
