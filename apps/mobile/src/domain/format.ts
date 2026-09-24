export function expiryToVietnamese(value: string | null): string | null {
  if (value === null) return null;
  const fullDate = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(
    value,
  );
  if (fullDate) {
    const date = new Date(`${value}T00:00:00Z`);
    if (
      date.getUTCFullYear() === Number(fullDate[1]) &&
      date.getUTCMonth() + 1 === Number(fullDate[2]) &&
      date.getUTCDate() === Number(fullDate[3])
    ) {
      return `ngày ${Number(fullDate[3])} tháng ${Number(fullDate[2])} năm ${fullDate[1]}`;
    }
    return null;
  }
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return null;
  return `tháng ${Number(match[2])} năm ${match[1]}`;
}
