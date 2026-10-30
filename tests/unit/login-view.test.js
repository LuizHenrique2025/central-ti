const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../public/assets/js/features/login-view.js'), 'utf8');

function context() {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const ui = vm.createContext({ state: { loginStep: 'identifier', loginIdentifier: '', firstAccess: null, pending: null }, esc });
  vm.runInContext(source, ui);
  return ui;
}

test('login preserva a identificação por usuário e a etapa de senha com os mesmos handlers', () => {
  const ui = context();
  let html = ui.renderLoginView();
  assert.match(html, /onsubmit="continueLogin\(event\)"/);
  assert.match(html, /name="email" required autocomplete="username"/);
  assert.match(html, /aria-current="step"><span>01/);
  assert.match(html, /Novembro Azul/);
  ui.state.loginStep = 'password';
  ui.state.loginIdentifier = 'teste@example.test';
  html = ui.renderLoginView();
  assert.match(html, /onsubmit="authenticate\(event\)"/);
  assert.match(html, /name="email" value="teste@example.test"/);
  assert.match(html, /name="password" type="password" required autocomplete="current-password"/);
  assert.match(html, /backToLoginIdentifier\(\)/);
  assert.match(html, /forgotPassword\(\)/);
  assert.match(html, /aria-current="step"><span>02/);
});

test('primeiro acesso mantém dados, validações e os formulários existentes', () => {
  const ui = context();
  ui.state.firstAccess = {};
  let html = ui.renderLoginView();
  assert.match(html, /identifyFirstAccess\(event\)/);
  assert.match(html, /name="cpf" required inputmode="numeric" maxlength="14"/);
  assert.match(html, /name="dataNascimento" type="date" required/);
  ui.state.firstAccess = { token: 'exemplo', nome: 'Pessoa de teste', dataNascimento: '2000-01-02' };
  html = ui.renderLoginView();
  assert.match(html, /completeFirstAccess\(event\)/);
  assert.match(html, /value="2000-01-02" readonly/);
  assert.match(html, /name="login" required minlength="3" maxlength="50"/);
  assert.match(html, /name="senha" type="password" required minlength="12"/);
  assert.match(html, /cancelFirstAccess\(\)/);
});

test('código de verificação e troca obrigatória conservam as ações existentes', () => {
  const ui = context();
  ui.state.pending = { email: 'teste@example.test' };
  const code = ui.renderLoginView();
  assert.match(code, /verifyCode\(event\)/);
  assert.match(code, /pattern="\[0-9\]\{6\}" maxlength="6" required/);
  assert.match(code, /cancelCode\(\)/);
  const password = ui.renderPasswordView();
  assert.match(password, /changeOwnPassword\(event\)/);
  assert.match(password, /name="currentPassword" type="password" required/);
  assert.match(password, /name="newPassword" type="password" required minlength="8"/);
});

test('valores externos são escapados em textos e atributos da nova tela', () => {
  const ui = context();
  const payload = '\"><img src=x onerror=alert(1)>';
  ui.state.loginIdentifier = payload;
  let html = ui.renderLoginView();
  assert(!html.includes('<img'));
  ui.state.loginStep = 'password';
  html = ui.renderLoginView();
  assert(!html.includes('<img'));
  assert.match(html, /&quot;&gt;&lt;img/);
  ui.state.pending = { email: payload };
  assert(!ui.renderLoginView().includes('<img'));
  ui.state.firstAccess = { token: 'exemplo', nome: payload, dataNascimento: payload };
  assert(!ui.renderLoginView().includes('<img'));
});
