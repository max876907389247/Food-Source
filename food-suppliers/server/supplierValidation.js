export const RESPONSE_TIME_OPTIONS = [
  "30 минут",
  "45 минут",
  "1 час",
  "1 час 30 минут",
  "2 часа",
  "2 часа 30 минут",
  "3 часа",
  "3 часа 30 минут",
  "4 часа",
];

export const WORK_HOUR_OPTIONS = Array.from({ length: 14 }, (_, i) => {
  const h = 8 + i;
  return `${String(h).padStart(2, "0")}:00`;
});

export function formatWorkingHours(from, to) {
  return `${from}–${to} (МСК)`;
}

export function parseWorkingHours(value) {
  const m = String(value || "").match(/(\d{2}:\d{2})–(\d{2}:\d{2})/);
  if (!m) return { from: "08:00", to: "21:00" };
  return { from: m[1], to: m[2] };
}

export function validateSupplierData(data) {
  const errors = [];

  if (!RESPONSE_TIME_OPTIONS.includes(data.responseTime)) {
    errors.push("Выберите срок ответа из списка");
  }

  const { from, to } = parseWorkingHours(data.workingHours);
  if (!WORK_HOUR_OPTIONS.includes(from) || !WORK_HOUR_OPTIONS.includes(to)) {
    errors.push("Укажите корректное время работы (МСК)");
  } else if (from >= to) {
    errors.push("Время окончания работы должно быть позже начала");
  }

  if (data.hasCertificates && (!data.certificates || data.certificates.length === 0)) {
    errors.push("При подтверждённых сертификатах укажите их названия");
  }

  if (errors.length) {
    throw new Error(errors[0]);
  }
}
