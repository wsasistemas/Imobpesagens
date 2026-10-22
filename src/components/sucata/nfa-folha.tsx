// Folha A4 da Nota Fiscal Avulsa, reproduzida a partir do modelo oficial fornecido.
// A mesma folha é usada na pré-visualização, no PDF e no relatório fotográfico.
//
// IMPORTANTE: esta folha usa SOMENTE estilos em linha (style) e SOMENTE flexbox.
// Nada de CSS Grid: as bibliotecas de captura em imagem (html2canvas/html-to-image)
// não desenham Grid e todas as células caíam sobrepostas no mesmo ponto — era a
// origem da nota quebrada no PDF e no e-mail do relatório fotográfico.
import type { CSSProperties, ReactNode } from "react";
import simboloRj from "@/assets/simbolo-receita-estadual-rj.png";

export type CamposFolha = Record<string, string>;

type Props = {
  campos: CamposFolha;
  cfop: string;
  natureza: string;
  numero: string;
  emissao: string;
  processo: string;
  idFolha?: string;
};

const TINTA = "#050505";
const LINHA_COR = "#222222";
const ROTULO_COR = "#0000ee";
const SERIF = '"Times New Roman", Times, serif';
const SANS = "Arial, Helvetica, sans-serif";
const BORDA: CSSProperties = { border: `1px solid ${LINHA_COR}` };
const NUM: CSSProperties = { fontVariantNumeric: "tabular-nums" };

const sRotulo: CSSProperties = {
  fontSize: "5.5pt",
  textTransform: "uppercase",
  lineHeight: 1.05,
  color: ROTULO_COR,
};
const sValor: CSSProperties = {
  marginTop: "0.5mm",
  minHeight: "7px",
  overflow: "hidden",
  fontSize: "6.5pt",
  fontWeight: 500,
  lineHeight: 1.08,
  color: TINTA,
};

function dataBr(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function numeroNfa(numero: string): string {
  const limpo = numero.trim();
  if (!limpo) return "00001";
  return /^\d+$/.test(limpo) ? limpo.padStart(5, "0") : limpo;
}

/** Linha em flexbox: substitui o CSS Grid, preservando as larguras do modelo. */
function Linha({
  cols,
  children,
  style,
}: {
  cols: string[];
  children: ReactNode;
  style?: CSSProperties;
}) {
  const itens = Array.isArray(children) ? children : [children];
  return (
    <div style={{ display: "flex", alignItems: "stretch", minWidth: 0, ...style }}>
      {itens.map((filho, indice) => {
        const largura = cols[indice] ?? "1fr";
        const fr = /^(\d*\.?\d*)fr$/.exec(largura);
        const base: CSSProperties = fr
          ? { flex: `${Number(fr[1] || 1)} 1 0%`, minWidth: 0 }
          : { flex: `0 0 ${largura}`, width: largura, minWidth: 0 };
        return (
          <div key={indice} style={{ display: "flex", boxSizing: "border-box", ...base }}>
            {filho}
          </div>
        );
      })}
    </div>
  );
}

/** Coluna em flexbox, com filhos esticados na largura. */
function Coluna({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, width: "100%", ...style }}>
      {children}
    </div>
  );
}

function Celula({
  rotulo,
  valor,
  style,
  numerico = false,
  centralizado = false,
}: {
  rotulo: string;
  valor?: string;
  style?: CSSProperties;
  numerico?: boolean;
  centralizado?: boolean;
}) {
  return (
    <div
      style={{
        ...BORDA,
        boxSizing: "border-box",
        flex: "1 1 auto",
        minWidth: 0,
        width: "100%",
        padding: "0.8mm 1.4mm",
        ...style,
      }}
    >
      <div style={{ ...sRotulo, ...(centralizado ? { textAlign: "center" } : {}) }}>{rotulo}</div>
      <div
        style={{
          ...sValor,
          ...(numerico ? NUM : {}),
          ...(centralizado ? { textAlign: "center" as const } : {}),
        }}
      >
        {valor?.trim() ? valor : "\u00A0"}
      </div>
    </div>
  );
}

function Titulo({ children, style }: { children: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        height: "3.4mm",
        padding: "0.6mm 1mm 0",
        fontSize: "6pt",
        fontWeight: 700,
        textTransform: "uppercase",
        lineHeight: 1,
        color: ROTULO_COR,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Marcacao({ rotulo, marcado }: { rotulo: string; marcado?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1mm" }}>
      <span style={{ ...sRotulo, fontWeight: 700 }}>{rotulo}</span>
      <span
        style={{
          ...BORDA,
          display: "flex",
          width: "6mm",
          height: "6mm",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "8pt",
          color: TINTA,
        }}
      >
        {marcado ? "X" : ""}
      </span>
    </div>
  );
}

export function NfaFolha({ campos, cfop, natureza, numero, emissao, processo, idFolha = "nfa-folha" }: Props) {
  const c = (chave: string): string => campos[chave] ?? "";
  const nfa = numeroNfa(numero);
  const dataEmissao = dataBr(emissao);
  const dataSaida = c("destDataSaida") || dataEmissao;

  const DatasLaterais = (
    <Coluna>
      <Celula rotulo="Data da emissão" valor={dataEmissao} numerico centralizado style={{ flex: "1 1 0%" }} />
      <Celula
        rotulo="Data saída/entrada"
        valor={dataBr(dataSaida)}
        numerico
        centralizado
        style={{ flex: "1 1 0%" }}
      />
      <Celula rotulo="Hora da saída" valor={c("emitHoraSaida")} numerico centralizado style={{ flex: "1 1 0%" }} />
    </Coluna>
  );

  return (
    <div
      id={idFolha}
      data-nfa-folha="a4"
      style={{
        boxSizing: "border-box",
        margin: "0 auto",
        width: "210mm",
        height: "297mm",
        overflow: "hidden",
        background: "#ffffff",
        padding: "9mm",
        fontFamily: SERIF,
        color: TINTA,
        colorScheme: "light",
      }}
    >
      <div style={{ ...BORDA, boxSizing: "border-box", height: "244mm", padding: "2mm" }}>
        <Linha cols={["59mm", "31mm", "1fr"]} style={{ height: "58mm", alignItems: "flex-start" }}>
          <div
            style={{
              ...BORDA,
              boxSizing: "border-box",
              marginTop: "1mm",
              height: "31mm",
              width: "100%",
              overflow: "hidden",
              padding: "1mm 1.5mm",
              textAlign: "justify",
              fontSize: "8pt",
              fontWeight: 700,
              lineHeight: 1.08,
            }}
          >
            Os dados declarados são de responsabilidade do remetente emitente, configurando-se crime de falsidade
            ideológica a inserção ou omissão de dados inexatos, nos termos do artigo 299 do Código Penal Brasileiro
          </div>

          <div
            style={{
              display: "flex",
              width: "100%",
              height: "38mm",
              alignItems: "flex-start",
              justifyContent: "center",
              paddingTop: "1mm",
            }}
          >
            <img
              src={simboloRj}
              alt="Símbolo da Receita Fazendária do Estado do Rio de Janeiro"
              style={{ height: "34mm", width: "30mm", objectFit: "contain" }}
              crossOrigin="anonymous"
            />
          </div>

          <div
            style={{
              display: "flex",
              width: "100%",
              height: "57mm",
              flexDirection: "column",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              paddingBottom: "1mm",
            }}
          >
            <div style={{ width: "100%", textAlign: "center", fontFamily: SANS }}>
              <div style={{ whiteSpace: "nowrap", fontSize: "17pt", fontWeight: 700, lineHeight: 1 }}>
                NOTA FISCAL AVULSA
              </div>
              <div style={{ marginTop: "1.5mm", fontSize: "10.5pt", fontWeight: 700, ...NUM }}>Nº&nbsp;&nbsp;{nfa}</div>
            </div>
            <div
              style={{
                marginTop: "6mm",
                display: "flex",
                width: "100%",
                alignItems: "flex-end",
                justifyContent: "flex-end",
                gap: "8mm",
                paddingRight: "2mm",
                fontFamily: SANS,
              }}
            >
              <Marcacao rotulo="SAÍDA" marcado />
              <Marcacao rotulo="ENTRADA" />
              <div style={{ ...sRotulo, paddingBottom: "7mm", fontWeight: 700 }}>1ª VIA DEST./REMET.</div>
            </div>
            <Linha cols={["1fr", "25mm"]} style={{ marginTop: "1.5mm", width: "100%", fontFamily: SANS }}>
              <Celula rotulo="Natureza de operação" valor={natureza} />
              <Celula rotulo="CFOP" valor={cfop} numerico centralizado />
            </Linha>
          </div>
        </Linha>

        <section style={{ fontFamily: SANS }}>
          <Titulo style={{ width: "calc(100% - 29mm)", textAlign: "center" }}>Remetente / Emitente</Titulo>
          <Linha cols={["1fr", "29mm"]} style={{ columnGap: "4mm" }}>
            <Coluna>
              <Linha cols={["1fr", "42mm"]}>
                <Celula rotulo="Nome / Razão social" valor={c("emitNome")} />
                <Celula rotulo="CNPJ / CPF" valor={c("emitCnpj")} numerico />
              </Linha>
              <Linha cols={["44mm", "1fr", "25mm"]}>
                <Celula rotulo="Endereço" valor={c("emitEndereco")} />
                <Celula rotulo="Bairro / Distrito" valor={c("emitBairro")} />
                <Celula rotulo="CEP" valor={c("emitCep")} numerico />
              </Linha>
              <Linha cols={["44mm", "12mm", "1fr", "25mm"]}>
                <Celula rotulo="Município" valor={c("emitMunicipio")} />
                <Celula rotulo="Código" valor={c("emitCodigo")} numerico />
                <Celula rotulo="Fone / Fax" valor={c("emitFone")} numerico />
                <Celula rotulo="Inscrição estadual" valor={c("emitIe")} numerico />
              </Linha>
            </Coluna>
            {DatasLaterais}
          </Linha>

          <Titulo style={{ width: "calc(100% - 29mm)", textAlign: "center" }}>Destinatário</Titulo>
          <Linha cols={["1fr", "29mm"]} style={{ columnGap: "4mm" }}>
            <Coluna>
              <Linha cols={["1fr", "42mm"]}>
                <Celula rotulo="Nome / Razão social" valor={c("destNome")} />
                <Celula rotulo="CNPJ / CPF" valor={c("destDoc")} numerico />
              </Linha>
              <Linha cols={["1fr", "41mm", "22mm"]}>
                <Celula rotulo="Endereço" valor={c("destEndereco")} />
                <Celula rotulo="Bairro / Distrito" valor={c("destBairro")} />
                <Celula rotulo="CEP" valor={c("destCep")} numerico />
              </Linha>
              <Linha cols={["1fr", "30mm", "12mm", "25mm"]}>
                <Celula rotulo="Município" valor={c("destMunicipio")} />
                <Celula rotulo="Fone / Fax" valor={c("destFone")} numerico />
                <Celula rotulo="UF" valor={c("destUf")} centralizado />
                <Celula rotulo="Inscrição estadual" valor={c("destIe")} numerico />
              </Linha>
            </Coluna>
            {DatasLaterais}
          </Linha>

          <Celula
            rotulo="Fatura"
            valor={c("fatura")}
            style={{ marginTop: "2mm", height: "5mm", paddingTop: "0.4mm", paddingBottom: "0.4mm" }}
          />

          <Titulo>Dados do produto</Titulo>
          <Linha cols={["15mm", "1fr", "17mm", "17mm", "17mm", "17mm", "18mm", "20mm", "18mm"]}>
            <Celula rotulo="Código produto" valor={c("prodCodigo")} centralizado />
            <Celula rotulo="Descrição dos produtos" valor={c("prodDescricao")} />
            <Celula rotulo="Classificação fiscal" valor={c("prodNcm")} numerico centralizado />
            <Celula rotulo="Situação tributária" valor={c("prodCst")} numerico centralizado />
            <Celula rotulo="Unidade" valor={c("prodUnidade")} centralizado />
            <Celula rotulo="Quantidade" valor={c("prodQuantidade")} numerico centralizado />
            <Celula rotulo="Valor unitário" valor={c("prodValorUnitario")} numerico centralizado />
            <Celula rotulo="Valor total" valor={c("prodValorTotal")} numerico centralizado />
            <Celula
              rotulo="Alíquotas ICMS / IPI"
              valor={`${c("prodAliqIcms")} / ${c("prodAliqIpi")}`}
              numerico
              centralizado
            />
          </Linha>

          <Titulo>Cálculo do imposto</Titulo>
          <Linha cols={["1fr", "1fr", "1fr", "1fr", "1fr"]}>
            <Celula rotulo="Base de cálculo do ICMS" valor={c("baseIcms")} numerico centralizado />
            <Celula rotulo="Valor do ICMS" valor={c("valorIcms")} numerico centralizado />
            <Celula rotulo="Base de cálculo ICMS substituição" valor={c("baseIcmsSt")} numerico centralizado />
            <Celula rotulo="Valor do ICMS substituição" valor={c("valorIcmsSt")} numerico centralizado />
            <Celula rotulo="Valor total dos produtos" valor={c("valorProdutos")} numerico centralizado />
          </Linha>
          <Linha cols={["1fr", "1fr", "1fr", "1fr", "1fr"]}>
            <Celula rotulo="Valor do frete" valor={c("valorFrete")} numerico centralizado />
            <Celula rotulo="Valor do seguro" valor={c("valorSeguro")} numerico centralizado />
            <Celula rotulo="Outras despesas acessórias" valor={c("outrasDespesas")} numerico centralizado />
            <Celula rotulo="Valor total do IPI" valor={c("valorIpi")} numerico centralizado />
            <Celula rotulo="Valor total da nota" valor={c("valorNota")} numerico centralizado />
          </Linha>

          <Titulo>Transportador / volumes transportados</Titulo>
          <Linha cols={["1fr", "28mm", "23mm", "12mm", "32mm"]}>
            <Celula rotulo="Nome / Razão social" valor={c("transpNome")} />
            <Celula rotulo="Frete por conta 1 emitente / 2 destinatário" valor={c("transpFretePorConta")} />
            <Celula rotulo="Placa do veículo" valor={c("transpPlaca")} numerico />
            <Celula rotulo="UF" valor={c("transpUf")} centralizado />
            <Celula rotulo="CNPJ / CPF" valor={c("transpCnpj")} numerico />
          </Linha>
          <Linha cols={["1fr", "23mm", "12mm", "32mm"]}>
            <Celula rotulo="Endereço" valor={c("transpEndereco")} />
            <Celula rotulo="Município" valor={c("transpMunicipio")} />
            <Celula rotulo="UF" valor={c("transpUf")} centralizado />
            <Celula rotulo="Inscrição estadual" valor={c("transpIe")} numerico />
          </Linha>
          <Linha cols={["28mm", "31mm", "32mm", "32mm", "32mm", "1fr"]}>
            <Celula rotulo="Quantidade" valor={c("volQuantidade")} numerico />
            <Celula rotulo="Espécie" valor={c("volEspecie")} />
            <Celula rotulo="Marca" valor={c("volMarca")} />
            <Celula rotulo="Número" valor={c("volNumero")} numerico />
            <Celula rotulo="Peso bruto" valor={c("pesoBruto")} numerico />
            <Celula rotulo="Peso líquido" valor={c("pesoLiquido")} numerico />
          </Linha>

          <Titulo>Dados adicionais</Titulo>
          <Linha cols={["45%", "42%", "1fr"]} style={{ height: "25mm" }}>
            <div
              style={{
                ...BORDA,
                boxSizing: "border-box",
                width: "100%",
                overflow: "hidden",
                padding: "0.8mm 1.4mm",
              }}
            >
              <div style={{ ...sRotulo, fontWeight: 700 }}>Informações complementares</div>
              <div
                style={{
                  marginTop: "1mm",
                  maxHeight: "20mm",
                  overflow: "hidden",
                  whiteSpace: "pre-wrap",
                  fontSize: "6pt",
                  lineHeight: 1.15,
                }}
              >
                {c("informacoesComplementares")}
                {c("certificado") ? `\n\n${c("certificado")}` : ""}
              </div>
            </div>
            <Celula rotulo="Reservado ao fisco" valor={c("reservadoFisco")} />
            <Celula rotulo="Nº de controle do formulário" valor={nfa} numerico centralizado />
          </Linha>

          <div style={{ marginTop: "1mm", borderTop: `1px dashed ${LINHA_COR}`, paddingTop: "1mm" }}>
            <div style={{ ...sRotulo, marginBottom: "1mm" }}>Dados da AIDF e do impressor</div>
            <Linha cols={["1fr", "29mm"]}>
              <Coluna>
                <div
                  style={{
                    ...BORDA,
                    boxSizing: "border-box",
                    height: "9mm",
                    padding: "1mm 1.5mm",
                    textAlign: "center",
                    fontSize: "6pt",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: ROTULO_COR,
                  }}
                >
                  Recebemos de {c("emitNome") || "(razão social do emitente)"} os produtos constantes da nota fiscal
                  indicada ao lado
                </div>
                <Linha cols={["24mm", "1fr"]}>
                  <Celula rotulo="Data do recebimento" />
                  <Celula rotulo="Identificação e assinatura do recebedor" />
                </Linha>
              </Coluna>
              <div
                style={{
                  ...BORDA,
                  boxSizing: "border-box",
                  display: "flex",
                  width: "100%",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: SANS,
                  fontSize: "8pt",
                  fontWeight: 700,
                  color: ROTULO_COR,
                }}
              >
                <span>NOTA FISCAL</span>
                <span>AVULSA</span>
                <span style={{ marginTop: "1mm", fontSize: "10pt", ...NUM }}>Nº {nfa}</span>
              </div>
            </Linha>
          </div>
        </section>
      </div>

      <p style={{ marginTop: "2mm", fontSize: "5.5pt", fontFamily: SANS, color: "#555555", ...NUM }}>
        Documento gerado pelo Portal de Pesagem — processo {processo}
      </p>
    </div>
  );
}
