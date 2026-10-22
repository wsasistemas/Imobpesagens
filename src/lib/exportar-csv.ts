/** Gera e baixa um CSV compatível com Excel (BOM UTF-8, separador ";"). */
export function baixarCsv(nomeBase: string, linhas: (string | number | null | undefined)[][]) {
  const csv = linhas
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeBase}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
