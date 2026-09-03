const { attachmentBytes } = require('../domain/attachments');

function createFileStore({ readFileDb, writeFileDb, createFileBackup, now, passwordHash }) {
  return {
    async users() { return readFileDb().users; },
    async findUserByEmail(email) { return readFileDb().users.find(user => user.email === email); },
    async findUserByLogin(login) { const clean = String(login || '').trim().toLowerCase(); return readFileDb().users.find(user => user.email?.toLowerCase() === clean || user.login?.toLowerCase() === clean); },
    async findUser(idValue) { return readFileDb().users.find(user => user.id === idValue); },
    async createUser(user) { const db = readFileDb(); db.users.push(user); writeFileDb(db); return user; },
    async renameUser(userId, nome) { const db = readFileDb(); const target = db.users.find(user => user.id === userId); if (!target) return null; target.nome = nome; target.updatedAt = now(); writeFileDb(db); return target; },
    async setUserActive(userId, active) { const db = readFileDb(); const target = db.users.find(user => user.id === userId); if (!target) return null; target.active = active; target.updatedAt = now(); writeFileDb(db); return target; },
    async setUserPermissions(userId, permissions) { const db = readFileDb(); const target = db.users.find(user => user.id === userId); if (!target) return null; target.permissions = permissions; target.updatedAt = now(); writeFileDb(db); return target; },
    async updateUser(userId, fields) { const db = readFileDb(); const target = db.users.find(user => user.id === userId); if (!target) return null; Object.assign(target, fields, { updatedAt: now() }); writeFileDb(db); return target; },
    async updatePassword(userId, password, mustChangePassword = false) { const db = readFileDb(); const user = db.users.find(x => x.id === userId); if (!user) return null; Object.assign(user, passwordHash(password), { mustChangePassword, updatedAt: now() }); writeFileDb(db); return user; },
    async records(resource) { return readFileDb()[resource]; },
    async record(resource, recordId) { return readFileDb()[resource].find(record => record.id === recordId); },
    async createRecord(resource, record) { const db = readFileDb(); db[resource].push(record); writeFileDb(db); return record; },
    async updateRecord(resource, recordId, fields, userId) { const db = readFileDb(); const record = db[resource].find(item => item.id === recordId); if (!record) return null; Object.assign(record, fields, { updatedAt: now(), updatedBy: userId }); writeFileDb(db); return record; },
    async deleteRecord(resource, recordId) { const db = readFileDb(); const index = db[resource].findIndex(item => item.id === recordId); if (index < 0) return null; const [removed] = db[resource].splice(index, 1); writeFileDb(db); return removed; },
    async messagesFor(userId) { return readFileDb().messages.filter(message => message.recipientId === userId || message.senderId === userId); },
    async createMessage(message) { const db = readFileDb(); db.messages.push(message); writeFileDb(db); return message; },
    async messageFor(messageId, userId) { return readFileDb().messages.find(message => message.id === messageId && (message.senderId === userId || message.recipientId === userId)); },
    async attachmentUsageFor(userId) { const db = readFileDb(); const messages = db.messages.filter(message => message.senderId === userId && message.attachmentData); const demands = db.demandas.flatMap(record => [record.anexoPrint, ...(record.interacoes || []).map(interaction => interaction.anexoPrint)].filter(attachment => attachment?.data && (attachment.ownerId || record.createdBy) === userId)); return { count: messages.length + demands.length, bytes: messages.reduce((total, message) => total + Buffer.byteLength(message.attachmentData, 'base64'), 0) + demands.reduce((total, attachment) => total + attachmentBytes(attachment), 0) }; },
    async markMessageRead(messageId, userId) { const db = readFileDb(); const message = db.messages.find(x => x.id === messageId && x.recipientId === userId); if (!message) return null; message.readAt = now(); writeFileDb(db); return message; },
    async deleteMessageFor(messageId, userId) { const db = readFileDb(); const message = db.messages.find(x => x.id === messageId && (x.recipientId === userId || x.senderId === userId)); if (!message) return null; if (message.recipientId === userId) message.recipientDeletedAt = now(); if (message.senderId === userId) message.senderDeletedAt = now(); writeFileDb(db); return message; },
    async archiveMessageFor(messageId, userId) { const db = readFileDb(); const message = db.messages.find(x => x.id === messageId && (x.recipientId === userId || x.senderId === userId)); if (!message) return null; if (message.recipientId === userId) message.recipientArchivedAt = now(); if (message.senderId === userId) message.senderArchivedAt = now(); writeFileDb(db); return message; },
    async restoreMessageFor(messageId, userId) { const db = readFileDb(); const message = db.messages.find(x => x.id === messageId && (x.recipientId === userId || x.senderId === userId)); if (!message) return null; if (message.recipientId === userId) message.recipientArchivedAt = null; if (message.senderId === userId) message.senderArchivedAt = null; writeFileDb(db); return message; },
    async announcements() { return readFileDb().announcements.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async createAnnouncement(announcement) { const db = readFileDb(); db.announcements.push(announcement); writeFileDb(db); return announcement; },
    async deleteAnnouncement(announcementId) { const db = readFileDb(); const index = db.announcements.findIndex(item => item.id === announcementId); if (index < 0) return null; const [removed] = db.announcements.splice(index, 1); writeFileDb(db); return removed; },
    async audit(entry) { const db = readFileDb(); db.auditLogs.push(entry); writeFileDb(db); },
    async audits(resource, recordId) { return readFileDb().auditLogs.filter(log => (!resource || log.resource === resource) && (!recordId || log.recordId === recordId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async backupNow() { return createFileBackup(true); },
    async demandStatuses() { return readFileDb().demandStatuses; },
    async setDemandStatuses(statuses) { const db = readFileDb(); db.demandStatuses = statuses; writeFileDb(db); return statuses; },
    async computerGroups() { return readFileDb().computerGroups; },
    async setComputerGroups(groups) { const db = readFileDb(); db.computerGroups = groups; writeFileDb(db); return groups; }
  };
}

module.exports = { createFileStore };
