const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../public/assets/js/app.js'), 'utf8');
const renderSource = source.split('\n').find(line => line.startsWith('function render('));

test('padrão compartilhado fica restrito à sessão autenticada e preserva o login', () => {
  const classes = new Set();
  const attributes = {};
  const root = { innerHTML: '', setAttribute: (key, value) => { attributes[key] = value; } };
  const state = { token: 'sessao-ficticia', user: { nome: 'Pessoa de teste' }, page: 'dashboard', modal: null, loading: false };
  const noop = () => {};
  const ui = vm.createContext({
    state, closingModal: false,
    document: { body: { classList: { toggle: (name, active) => active ? classes.add(name) : classes.delete(name) } }, querySelector: selector => selector === '#app' ? root : null },
    $: () => root,
    dashboard: () => '<h1>Painel</h1>', sidebar: () => '', modal: () => '',
    loginPage: () => '<form>Login</form>', passwordPage: () => '<form>Alterar senha</form>',
    enhanceCurrentSurface: noop, setupModalAccessibility: noop, applyColorTheme: noop
  });
  vm.runInContext(renderSource, ui);
  ui.render();
  assert(classes.has('central-workspace'));
  assert.equal(attributes.role, 'presentation');
  assert.equal((root.innerHTML.match(/<main\b/g) || []).length, 1);
  state.user.mustChangePassword = true;
  ui.render();
  assert(!classes.has('central-workspace'));
  assert.equal(root.innerHTML, '<form>Alterar senha</form>');
  assert.equal(attributes.role, 'main');
  state.user = null;
  state.token = null;
  ui.render();
  assert(!classes.has('central-workspace'));
  assert.equal(root.innerHTML, '<form>Login</form>');
});

test('modal mantém o formulário e identifica o contêiner como diálogo acessível', () => {
  const attributes = {};
  const title = { id: '' };
  let focused = false;
  const region = { setAttribute: (name, value) => { attributes[name] = value; } };
  const form = { tagName: 'FORM', closest: () => region, querySelector: selector => selector === 'h2' ? title : { focus: () => { focused = true; } } };
  const ui = vm.createContext({ document: { querySelector: () => form }, requestAnimationFrame: callback => callback() });
  vm.runInContext(source.slice(source.indexOf('function setupModalAccessibility('), source.indexOf('function modalFocusable(')), ui);
  ui.setupModalAccessibility();
  assert.equal(attributes.role, 'dialog');
  assert.equal(attributes['aria-modal'], 'true');
  assert.equal(attributes['aria-labelledby'], title.id);
  assert(focused);
});

test('fechamento do modal devolve o foco sem depender da referência já limpa', () => {
  let callback;
  let focused = false;
  const opener = { isConnected: true, focus: () => { focused = true; } };
  const ui = vm.createContext({ modalOpener: opener, document: { querySelector: () => null }, requestAnimationFrame: value => { callback = value; } });
  vm.runInContext(source.slice(source.indexOf('function setupModalAccessibility('), source.indexOf('function modalFocusable(')), ui);
  ui.setupModalAccessibility();
  assert.equal(ui.modalOpener, null);
  callback();
  assert(focused);
  focused = false;
  ui.modalOpener = opener;
  ui.setupModalAccessibility();
  opener.isConnected = false;
  callback();
  assert(!focused);
});
