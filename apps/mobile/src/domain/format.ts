export function expiryToVietnamese(value: string | null): string | null {
  if (value === null) return null;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return null;
  return `tháng ${Number(match[2])} năm ${match[1]}`;
}

