/** Constantes do painel admin compartilhadas entre global-setup.ts e admin.spec.ts (só valem no barber_e2e). */
export const E2E_ADMIN_USER = 'admin-e2e';
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'senha-e2e-1234567';
/** Data local fixa e distante, para não colidir com os testes de agendamento. */
export const E2E_AGENDA_DATE = '2031-03-12';
export const E2E_AGENDA_CUSTOMER = 'Cliente Agenda E2E';
/** Segundo agendamento no mesmo dia, com HTML no nome: o teste e2e confere o escape. */
export const E2E_XSS_CUSTOMER = '<img src=x onerror=alert(1)>';
