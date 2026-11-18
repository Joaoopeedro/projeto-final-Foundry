// tests/prazos.test.js
// Testes para o cálculo de prazos em dias úteis e corridos
// Execute com: node --test tests/prazos.test.js

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Replica a lógica de prazos do frontend
const fixedHolidays = [
  [1,1],[4,21],[5,1],[9,7],[10,12],[11,2],[11,15],[11,20],[12,25],
];

function isHoliday(d) {
  return fixedHolidays.some(([m, day]) => d.getMonth() + 1 === m && d.getDate() === day);
}

function isSuspension(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (m === 12 && day >= 20) return true;
  if (m === 1 && day <= 20) return true;
  return false;
}

function isWorkDay(d, cpc = true) {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (isHoliday(d)) return false;
  if (cpc && isSuspension(d)) return false;
  return true;
}

function calcBusinessDays(startDate, days, isCPC = true) {
  let current = new Date(startDate);
  current.setDate(current.getDate() + 1);
  while (!isWorkDay(current, isCPC)) current.setDate(current.getDate() + 1);

  let counted = 0;
  while (counted < days) {
    if (isWorkDay(current, isCPC)) counted++;
    if (counted < days) current.setDate(current.getDate() + 1);
  }
  return current;
}

function calcCalendarDays(startDate, days) {
  const result = new Date(startDate);
  result.setDate(result.getDate() + days);
  return result;
}

function dateStr(d) {
  return d.toISOString().split('T')[0];
}

describe('calcBusinessDays — CPC', () => {
  test('15 dias úteis a partir de segunda-feira normal (sem feriados)', () => {
    // Segunda 2026-02-02 (fevereiro — sem feriados)
    const start = new Date('2026-02-02T12:00:00');
    const result = calcBusinessDays(start, 15, true);
    // Dias úteis: ter 03, qua 04, qui 05, sex 06, seg 09, ter 10, qua 11, qui 12, sex 13, seg 16, ter 17, qua 18, qui 19, sex 20, seg 23
    // = 23/02/2026
    assert.equal(dateStr(result), '2026-02-23');
  });

  test('5 dias úteis (embargos de declaração) a partir de quinta', () => {
    // Quinta 2026-02-05
    const start = new Date('2026-02-05T12:00:00');
    const result = calcBusinessDays(start, 5, true);
    // Dias: sex 06, seg 09, ter 10, qua 11, qui 12 = 12/02
    assert.equal(dateStr(result), '2026-02-12');
  });

  test('pula final de semana corretamente', () => {
    // Sexta 2026-02-06 — prazo de 1 dia útil
    const start = new Date('2026-02-06T12:00:00');
    const result = calcBusinessDays(start, 1, true);
    // Próximo dia útil após sex = seg 09
    assert.equal(dateStr(result), '2026-02-09');
  });

  test('pula Ano Novo (feriado)', () => {
    // 31/12 — 1 dia útil
    const start = new Date('2025-12-31T12:00:00');
    const result = calcBusinessDays(start, 1, false); // sem suspensão CPC
    // 01/01 é feriado, 02/01 seria útil mas CPC está suspenso — sem CPC, 02/01 é dia útil
    assert.equal(dateStr(result), '2026-01-02');
  });
});

describe('calcBusinessDays — Trabalhista (sem suspensão CPC)', () => {
  test('8 dias úteis trabalhistas (sem suspensão)', () => {
    const start = new Date('2026-02-02T12:00:00');
    const result = calcBusinessDays(start, 8, false);
    // ter 03, qua 04, qui 05, sex 06, seg 09, ter 10, qua 11, qui 12 = 12/02
    assert.equal(dateStr(result), '2026-02-12');
  });
});

describe('calcCalendarDays', () => {
  test('10 dias corridos a partir de 01/02', () => {
    const start = new Date('2026-02-01T12:00:00');
    const result = calcCalendarDays(start, 10);
    assert.equal(dateStr(result), '2026-02-11');
  });

  test('120 dias corridos (mandado de segurança)', () => {
    const start = new Date('2026-01-01T12:00:00');
    const result = calcCalendarDays(start, 120);
    // 1 jan + 120 = 1 mai
    assert.equal(dateStr(result), '2026-05-01');
  });

  test('7 dias corridos (arrependimento online)', () => {
    const start = new Date('2026-03-10T12:00:00');
    const result = calcCalendarDays(start, 7);
    assert.equal(dateStr(result), '2026-03-17');
  });
});

describe('isHoliday()', () => {
  test('01/01 é feriado', () => {
    assert.equal(isHoliday(new Date('2026-01-01T12:00:00')), true);
  });
  test('07/09 é feriado', () => {
    assert.equal(isHoliday(new Date('2026-09-07T12:00:00')), true);
  });
  test('15/02 não é feriado nacional fixo', () => {
    assert.equal(isHoliday(new Date('2026-02-15T12:00:00')), false);
  });
});

describe('isSuspension() — CPC 20/dez a 20/jan', () => {
  test('25/12 está em suspensão', () => {
    assert.equal(isSuspension(new Date('2025-12-25T12:00:00')), true);
  });
  test('15/01 está em suspensão', () => {
    assert.equal(isSuspension(new Date('2026-01-15T12:00:00')), true);
  });
  test('21/01 não está em suspensão', () => {
    assert.equal(isSuspension(new Date('2026-01-21T12:00:00')), false);
  });
  test('19/12 não está em suspensão', () => {
    assert.equal(isSuspension(new Date('2025-12-19T12:00:00')), false);
  });
  test('20/12 está em suspensão', () => {
    assert.equal(isSuspension(new Date('2025-12-20T12:00:00')), true);
  });
  test('20/01 está em suspensão', () => {
    assert.equal(isSuspension(new Date('2026-01-20T12:00:00')), true);
  });
});

