const test = require('node:test');
const assert = require('node:assert/strict');
const { createPostgresStore } = require('../../server/storage/postgres-store');

test('leituras e atualização de usuário preservam data civil para o primeiro acesso', async () => {
  const pool = {
    async query(sql) {
      // Simula o contrato do driver: DATE vira Date; a projeção textual permanece string.
      const projectedDate = sql.includes("to_char(data_nascimento, 'YYYY-MM-DD')");
      return { rows: [{ id: 'test-user', dataNascimento: projectedDate ? '1992-06-15' : new Date('1992-06-15T03:00:00Z'), createdAt: new Date('2026-01-02T03:04:05Z') }] };
    }
  };
  const store = createPostgresStore({ pool });
  const records = [
    ...(await store.users()),
    await store.findUser('test-user'),
    await store.findUserByEmail('person@example.test'),
    await store.findUserByLogin('person'),
    await store.updateUser('test-user', { dataNascimento: '1992-06-15' })
  ];
  for (const record of records) {
    assert.equal(record.dataNascimento, '1992-06-15');
    assert.equal(record.createdAt, '2026-01-02T03:04:05.000Z');
  }
});
