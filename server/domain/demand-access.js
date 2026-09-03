function collaboratorPermissions() {
  return {
    demandas: { list: true, create: true, update: false, consult: true, delete: false, scope: 'hospital' },
    redes: { list: true, create: false, update: false, consult: true, delete: false },
    ramais: { list: true, create: false, update: false, consult: true, delete: false }
  };
}

function hospitalOnly(user) {
  return user.perfil !== 'admin' && Boolean(user.permissions?.demandas);
}

function canViewAllDemands(user) {
  return user.perfil === 'admin' || user.perfil === 'ti';
}

function demandBelongsToUser(record, user) {
  return canViewAllDemands(user) || record.createdBy === user.id || record.solicitanteId === user.id;
}

module.exports = { collaboratorPermissions, hospitalOnly, canViewAllDemands, demandBelongsToUser };
