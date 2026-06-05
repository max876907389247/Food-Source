export function userPhoneDigits(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.startsWith("7")) return digits.slice(0, 11);
  return `7${digits}`.slice(0, 11);
}

export function formatUserPhone(value) {
  const digits = userPhoneDigits(value).slice(1);
  if (!digits.length) return "+7 ";
  if (digits.length <= 3) return `+7 ${digits}`;
  if (digits.length <= 6) return `+7 ${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 8) return `+7 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `+7 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
}

export function isCompleteUserPhone(value) {
  return userPhoneDigits(value).length === 11;
}

export function bindPhoneField(input) {
  if (!input || input.dataset.maskBound) return;
  input.dataset.maskBound = "1";

  const applyFormat = () => {
    input.value = formatUserPhone(input.value);
  };

  input.addEventListener("focus", () => {
    if (!input.value.trim()) input.value = "+7 ";
  });

  input.addEventListener("input", applyFormat);

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Backspace") return;
    const pos = input.selectionStart;
    if (pos <= 3) {
      e.preventDefault();
      input.value = "+7 ";
      input.setSelectionRange(3, 3);
    }
  });

  input.addEventListener("blur", () => {
    if (input.value === "+7 " || input.value === "+7") input.value = "";
  });
}
