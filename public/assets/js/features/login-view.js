function loginIcon(name) {
  const paths = {
    sparkle: '<path d="m10 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15v6m-3-3h6"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    user: '<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 4M12 17h.01"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.sparkle}</svg>`;
}

function loginRibbon() {
  return `<svg class="auth-ribbon" viewBox="0 0 400 300" fill="none" aria-hidden="true"><defs><linearGradient id="auth-ribbon-front" x1="260" y1="70" x2="165" y2="240" gradientUnits="userSpaceOnUse"><stop stop-color="var(--auth-ribbon-light)"/><stop offset="1" stop-color="var(--auth-ribbon-deep)"/></linearGradient><linearGradient id="auth-ribbon-back" x1="145" y1="70" x2="235" y2="245" gradientUnits="userSpaceOnUse"><stop stop-color="var(--auth-ribbon-soft)"/><stop offset="1" stop-color="var(--auth-ribbon-mid)"/></linearGradient></defs><circle cx="200" cy="155" r="134" stroke="var(--auth-ring)" stroke-dasharray="2 5"/><circle cx="200" cy="155" r="116" stroke="var(--auth-ring)"/><circle cx="200" cy="155" r="96" fill="var(--auth-orb)" stroke="var(--auth-ring)" stroke-width="2"/><circle cx="200" cy="155" r="76" fill="var(--auth-orb-inner)"/><path d="m185 154 30 20-43 80-12-16-16 3z" fill="url(#auth-ribbon-front)"/><path d="m214 154-29 20 43 80 12-16 16 3z" fill="url(#auth-ribbon-back)"/><path d="M200 150c-16-32-30-66-48-69-23-4-33 17-19 43l55 91 28-17-47-73c-10-16-14-26-8-29 8-4 21 23 39 54Z" fill="url(#auth-ribbon-back)"/><path d="M200 150c16-32 30-66 48-69 23-4 33 17 19 43l-55 91-28-17 47-73c10-16 14-26 8-29-8-4-21 23-39 54Z" fill="url(#auth-ribbon-front)"/><path d="m171 235 29-54 31 54M151 102c-9 7 8 34 18 49m73-48c8 7-8 33-17 47" stroke="var(--auth-ribbon-glint)" stroke-width="5" stroke-linecap="round" opacity=".65"/><circle cx="200" cy="181" r="5" fill="var(--auth-ribbon-glint)"/></svg>`;
}

function loginSteps(step) {
  return `<ol class="auth-steps" aria-label="Etapas do acesso"><li ${step === 'identifier' ? 'aria-current="step"' : ''}><span>01</span>Identificação</li><li ${step === 'password' ? 'aria-current="step"' : ''}><span>02</span>Senha</li></ol>`;
}

function loginField(label, input, icon = '') {
  return `<label class="field auth-field"><span>${label}</span><span class="auth-input${icon ? ' auth-input-icon' : ''}">${icon ? loginIcon(icon) : ''}${input}</span></label>`;
}

function loginPrimary(label) {
  return `<button type="submit" class="primary auth-primary"><span>${label}</span>${loginIcon('arrow')}</button>`;
}

function loginFrame(form, step = '') {
  return `<div class="login-page auth-page"><div class="auth-shell"><section class="auth-story" aria-label="Central TI, suporte interno"><div class="auth-brand"><span class="auth-brand-symbol">${loginIcon('sparkle')}</span><span><b>Central TI</b><small>Tecnologia &amp; suporte</small></span></div><div class="auth-story-content"><div class="auth-campaign">${loginIcon('sparkle')}<span>Novembro Azul · Cuidar de você também é prioridade</span></div><p class="auth-eyebrow">Central TI · Suporte interno</p><h1>Todo o suporte de<br/>TI da sua equipe,<br/><em>em um só lugar.</em></h1><p class="auth-description">Abra chamados, acompanhe suas solicitações e fale com a equipe de TI sem sair do fluxo do seu dia.</p><div class="auth-art">${loginRibbon()}<div class="auth-art-note auth-art-care"><span>${loginIcon('sparkle')}</span><div><b>Cuidar de si é prioridade</b><small>Novembro Azul · prevenção</small></div></div><div class="auth-art-note auth-art-support"><span>${loginIcon('check')}</span><div><b>Suporte para o seu dia</b><small>Central TI · sempre por perto</small></div></div></div></div><p class="auth-story-note"><i aria-hidden="true"></i>Um acesso simples para seguir com o que importa.</p></section><section class="auth-panel" aria-label="Acesso à Central TI"><div class="auth-panel-header"><span class="auth-internal">${loginIcon('lock')}Acesso de uso interno</span></div><div class="auth-form-area"><div class="auth-form-content">${step ? loginSteps(step) : ''}${form}</div></div><footer class="auth-footer"><span>© Central TI · Acesso protegido</span><button type="button" class="auth-help" onclick="forgotPassword()">${loginIcon('help')}Precisa de ajuda?</button><span class="auth-theme-slot"></span></footer></section></div></div>`;
}

function renderStandardLogin() {
  if (state.loginStep === 'password') {
    return loginFrame(`<form class="login-card auth-card" onsubmit="authenticate(event)"><h2>Informe sua senha</h2><p class="auth-form-intro">Acessando como <b>${esc(state.loginIdentifier)}</b>.</p><input type="hidden" name="email" value="${esc(state.loginIdentifier)}"/>${loginField('Senha', '<input name="password" type="password" required autocomplete="current-password" placeholder="Sua senha" autofocus/>', 'lock')}<button type="button" class="forgot-password" onclick="forgotPassword()">Esqueceu a senha?</button>${loginPrimary('Entrar na plataforma')}<button type="button" class="login-back" onclick="backToLoginIdentifier()">Voltar para identificação</button></form>`, 'password');
  }
  return loginFrame(`<form class="login-card auth-card" onsubmit="continueLogin(event)"><h2>Boas-vindas</h2><p class="auth-form-intro">Informe seu e-mail ou login para continuar.</p>${loginField('E-mail ou login', `<input name="email" required autocomplete="username" placeholder="Seu e-mail ou usuário" value="${esc(state.loginIdentifier)}" autofocus/>`, 'user')}${loginPrimary('Continuar')}<button type="button" class="login-back" onclick="startFirstAccess()">Primeiro acesso? Comece aqui</button></form>`, 'identifier');
}

function renderLoginView() {
  if (state.firstAccess?.token) return loginFrame(`<form class="login-card auth-card" onsubmit="completeFirstAccess(event)"><h2>Complete seu cadastro</h2><p class="auth-form-intro">Olá, <b>${esc(state.firstAccess.nome)}</b>. Informe seus dados e crie sua senha.</p>${loginField('Data de nascimento', `<input name="dataNascimento" type="date" required value="${esc(state.firstAccess.dataNascimento)}" readonly/>`)}${loginField('E-mail', '<input name="email" type="email" autocomplete="email" required/>')}${loginField('Login', '<input name="login" required minlength="3" maxlength="50" autocomplete="username" placeholder="Escolha seu login"/>')}${loginField('Senha', '<input name="senha" type="password" required minlength="12" autocomplete="new-password"/>')}${loginPrimary('Concluir cadastro')}<button type="button" class="login-back" onclick="cancelFirstAccess()">Voltar</button></form>`);
  if (state.firstAccess) return loginFrame(`<form class="login-card auth-card" onsubmit="identifyFirstAccess(event)"><h2>Primeiro acesso</h2><p class="auth-form-intro">Informe seu CPF e data de nascimento para localizar seu pré-cadastro.</p>${loginField('CPF', '<input name="cpf" required inputmode="numeric" maxlength="14" placeholder="000.000.000-00" autofocus/>')}${loginField('Data de nascimento', '<input name="dataNascimento" type="date" required/>')}${loginPrimary('Validar dados')}<button type="button" class="login-back" onclick="cancelFirstAccess()">Voltar</button></form>`);
  if (state.pending) return loginFrame(`<form class="login-card auth-card" onsubmit="verifyCode(event)"><h2>Confirme seu acesso</h2><p class="auth-form-intro">Enviamos um código de seis dígitos para <b>${esc(state.pending.email)}</b>.</p>${loginField('Código', '<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus/>')}${loginPrimary('Validar e entrar')}<button type="button" class="login-back" onclick="cancelCode()">Voltar</button></form>`);
  return renderStandardLogin();
}

function renderPasswordView() {
  return loginFrame(`<form class="login-card auth-card" onsubmit="changeOwnPassword(event)"><h2>Proteja seu acesso</h2><p class="auth-form-intro">Antes de usar o sistema, defina uma senha pessoal e segura. Use 8+ caracteres, maiúscula, minúscula, número e símbolo.</p>${loginField('Senha atual', '<input name="currentPassword" type="password" required autocomplete="current-password" autofocus/>')}${loginField('Nova senha', '<input name="newPassword" type="password" required minlength="8" autocomplete="new-password"/>')}${loginPrimary('Salvar senha e entrar')}</form>`);
}
