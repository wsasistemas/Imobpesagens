import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizarNomeOpcional } from "@/lib/normalizar-nomes";

export type ItemNota = {
  descricao?: string;
  quantidade?: number;
  unidade?: string;
  ncm?: string;
  valor_unitario?: number;
};

export type DadosConcretoNota = {
  fck?: number;
  slump_nominal?: number;
  slump_tolerancia?: number;
  slump_unidade?: string;
  dosagem?: string;
  relacao_ac?: number;
  idade_dias?: number;
  validade?: string;
  /** Volume de concreto (m³) declarado na nota (itens ou dados adicionais). */
  volume_m3?: number;
  fonte_dados_concreto?: "quadro_danfe" | "descricao_codigo" | "ambos";
};

export type CamposNota = {
  chave_nfe?: string;
  numero_nota?: string;
  emissao?: string;
  emissor?: string;
  emissor_cnpj?: string;
  transportadora?: string;
  placa?: string;
  uf?: string;
  motorista?: string;
  descricao?: string;
  peso_kg?: number;
  contratante?: string;
  destinatario?: string;
  destinatario_cnpj?: string;
  tomador_cnpj?: string;
  tipo_nota?: "produto" | "servico" | "cte" | "nao_fiscal" | "desconhecido";
  documento_nao_fiscal?: boolean;
  produto_categoria?: string;
  modelo?: string;
  marca?: string;
  carreta?: string;
  tara_kg?: number;
  valor_total_nf?: number;
  itens?: ItemNota[];
  tomador?: string;
  remetente?: string;
  produto_predominante?: string;
  dados_adicionais_nf?: string;
  concreto?: DadosConcretoNota;
  avisos?: string[];
};


export type OcrResult =
  | { ok: true; campos: CamposNota }
  | { ok: false; motivo: string };

const OCR_SCHEMA = {
  type: "object",
  properties: {
    chave_nfe: { type: "string", description: "Chave da NF-e com 44 dígitos, apenas números" },
    numero_nota: { type: "string" },
    emissao: { type: "string", description: "Data no formato ISO YYYY-MM-DD" },
    emissor: { type: "string", description: "Razão social do emitente" },
    emissor_cnpj: { type: "string" },
    transportadora: { type: "string" },
    placa: { type: "string", description: "Placa do veículo/cavalo mecânico" },
    uf: { type: "string" },
    motorista: { type: "string" },
    descricao: { type: "string", description: "Descrição resumida da mercadoria principal" },
    peso_kg: { type: "number", description: "Peso bruto total em kg" },
    contratante: {
      type: "string",
      description:
        "Razão social do CONTRATANTE. Comum em NF de serviço no bloco 'CONTRATANTE' ou 'DADOS ADICIONAIS' (ex.: 'CONTRATANTE: <razão social>'). Deixe vazio se não houver.",
    },
    destinatario: {
      type: "string",
      description:
        "Razão social do DESTINATÁRIO em DANFE de mercadoria (bloco 'DESTINATÁRIO/REMETENTE', campo 'NOME/RAZÃO SOCIAL'). Deixe vazio se não houver.",
    },
    destinatario_cnpj: {
      type: "string",
      description:
        "CNPJ/CPF do DESTINATÁRIO (ou do CONTRATANTE em NF de serviço), apenas dígitos. Deixe vazio se não houver.",
    },
    tomador_cnpj: {
      type: "string",
      description: "CNPJ do TOMADOR DO SERVIÇO no CT-e, apenas dígitos. Deixe vazio se não houver.",
    },
    tipo_nota: {
      type: "string",
      enum: ["produto", "servico", "cte", "nao_fiscal", "desconhecido"],
      description:
        "Tipo do documento: 'produto' para DANFE de mercadoria (NF-e modelo 55, bloco DESTINATÁRIO/REMETENTE, quadro DADOS DOS PRODUTOS); 'servico' para NF de serviço/NFS-e (bloco CONTRATANTE / PRESTAÇÃO DE SERVIÇO); 'cte' para Conhecimento de Transporte Eletrônico (CT-e / DACTE modelo 57); 'nao_fiscal' para comprovantes SEM validade fiscal (sem chave de 44 dígitos, sem ICMS, sem quadro de produtos), como 'COMPROVANTE DE ABASTECIMENTO DE ÁGUA ATRAVÉS DE CAMINHÕES-PIPA', romaneios, tickets e recibos de entrega; 'desconhecido' se não identificar.",
    },
    documento_nao_fiscal: {
      type: "boolean",
      description:
        "true quando o documento NÃO é uma nota fiscal oficial (não possui chave de acesso de 44 dígitos, nem tributos/ICMS, nem quadro DADOS DOS PRODUTOS) — ex.: comprovante de abastecimento de água por caminhão-pipa, romaneio, ticket ou recibo de entrega.",
    },
    produto_categoria: {
      type: "string",
      description:
        "Categoria do material transportado quando identificável. Use exatamente 'agua' quando o documento tratar de fornecimento/abastecimento de água (caminhão-pipa).",
    },
    modelo: { type: "string", description: "Modelo do veículo/cavalo mecânico, quando informado" },
    marca: { type: "string", description: "Marca/montadora do veículo, quando informado" },
    carreta: { type: "string", description: "Placa da carreta/reboque (segundo veículo), quando houver" },
    tara_kg: { type: "number", description: "Tara do veículo (peso vazio) informado na nota ou documento" },
    valor_total_nf: { type: "number", description: "Valor TOTAL DA NOTA (ou VALOR TOTAL DA PRESTAÇÃO no CT-e) em reais (número)" },
    tomador: {
      type: "string",
      description: "Razão social do TOMADOR DO SERVIÇO no CT-e (bloco 'TOMADOR DO SERVIÇO'). Deixe vazio se não houver.",
    },
    remetente: {
      type: "string",
      description: "Razão social do REMETENTE no CT-e (bloco 'REMETENTE'). Deixe vazio se não houver.",
    },
    produto_predominante: {
      type: "string",
      description: "Descrição do PRODUTO PREDOMINANTE no CT-e (campo 'PRODUTO PREDOMINANTE' do DACTE). Deixe vazio se não houver.",
    },
    itens: {
      type: "array",
      description:
        "Itens do quadro 'DADOS DOS PRODUTOS / SERVIÇOS' (NF-e) ou, no CT-e, uma única entrada com a descrição do PRODUTO PREDOMINANTE, quantidade (se houver) e valor da prestação como valor_unitario.",
      items: {
        type: "object",
        properties: {
          descricao: { type: "string", description: "Descrição do produto/serviço" },
          quantidade: { type: "number", description: "Quantidade" },
          unidade: { type: "string", description: "Unidade de medida da coluna UN/UNID (ex.: KG, T, UN, PC, M, M2, M3, L). Sempre em MAIÚSCULAS." },
          ncm: { type: "string", description: "Código NCM do item (coluna NCM/SH), apenas números" },
          valor_unitario: { type: "number", description: "Valor unitário em reais" },
        },
      },
    },
    dados_adicionais_nf: {
      type: "string",
      description: "Conteúdo INTEGRAL do quadro 'DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES' da nota fiscal.",
    },
    concreto: {
      type: "object",
      properties: {
        fck: { type: "number" },
        slump_nominal: { type: "number" },
        slump_tolerancia: { type: "number" },
        slump_unidade: { type: "string" },
        dosagem: { type: "string" },
        relacao_ac: { type: "number" },
        idade_dias: { type: "number" },
        validade: { type: "string", description: "ISO 8601 ou formato legível" },
        volume_m3: {
          type: "number",
          description:
            "Volume de CONCRETO em m³ da nota. Se o quadro de itens tiver uma linha de concreto em M3, use a quantidade dessa linha. Se os itens forem matérias-primas (CIMENTO, AREIA, BRITA, PEDRA, ÁGUA, ADITIVO, FIBRA), NUNCA some as quantidades: leia o volume declarado no texto dos DADOS ADICIONAIS (ex.: 'preparo e descarga de 10 m3 de FCK 35 MPa' -> 10).",
        },
        fonte_dados_concreto: { type: "string", enum: ["quadro_danfe", "descricao_codigo", "ambos"] },
      },
    },
    avisos: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [],
} as const;

export const ocrNotaFiscal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        arquivo: z.string().min(20),
        mimeType: z.string().optional(),
        filename: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<OcrResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, motivo: "LOVABLE_API_KEY não configurada." };

    const isPdf = (data.mimeType ?? "").includes("pdf") || data.arquivo.startsWith("data:application/pdf");
    const base64 = data.arquivo.includes(",") ? data.arquivo.slice(data.arquivo.indexOf(",") + 1) : "";
    if (isPdf && base64.trim().length < 100) {
      return { ok: false, motivo: "O PDF enviado está vazio ou corrompido. Envie novamente ou use uma foto/print da nota." };
    }

    const anexo = isPdf
      ? {
          type: "file" as const,
          file: {
            filename: data.filename?.trim() || "nota.pdf",
            file_data: data.arquivo.startsWith("data:")
              ? data.arquivo
              : `data:application/pdf;base64,${data.arquivo}`,
          },
        }
      : { type: "image_url" as const, image_url: { url: data.arquivo } };


    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um extrator de dados de documentos fiscais brasileiros: DANFE de mercadoria (NF-e mod. 55), NFS-e de serviço e DACTE / CT-e (Conhecimento de Transporte Eletrônico, mod. 57). Chame extrair_nota com os campos que conseguir ler; deixe ausentes vazios e não invente dados.\n\nFORMATO NUMÉRICO BRASILEIRO: nas notas brasileiras a vírgula é o separador decimal e o ponto é milhar. Ex.: '28,4740' = 28.4740 (não 284740); '4.971,277306' = 4971.277306; '141.552,15' = 141552.15. SEMPRE converta corretamente antes de devolver o número.\n\nDADOS ADICIONAIS E CONCRETO: No final do documento, no quadro 'DADOS ADICIONAIS' ou 'INFORMAÇÕES COMPLEMENTARES', podem haver especificações técnicas cruciais para o traço do concreto (ex: 'FCK 35', 'Brita 1', 'Bombeável'). Além disso, notas de concreto (DANFE) costumam ter um QUADRO estruturado de dados do concreto com campos rotulados: SLUMP, FCK, DOSAGEM, IDADE, VALIDADE CONCRETO. SEMPRE que esse quadro existir, extraia SLUMP, FCK e DOSAGEM dele (fonte primária) para o objeto 'concreto'. Use o código da descrição do produto (ex.: 'TC.35,0...D.12+-2') apenas como reforço/validação. Se o quadro estruturado e o código na descrição divergirem, prevaleça o quadro e adicione um item em 'avisos' descrevendo a divergência. Preencha 'concreto.fonte_dados_concreto' com 'quadro_danfe', 'descricao_codigo' or 'ambos'. VOLUME DE CONCRETO (obrigatório em notas de concreto): preencha 'concreto.volume_m3' com o volume em m³ da carga. Se houver uma linha de item de CONCRETO em M3, use a quantidade dessa linha. Se os itens forem matérias-primas (CIMENTO, AREIA, BRITA, PEDRA, AGUA, ADITIVO, FIBRA), NUNCA some as quantidades — leia o volume declarado no texto dos DADOS ADICIONAIS (ex.: 'para preparo e descarga de 10 m3 de FCK 35 MPa' -> 10) e transcreva esse quadro INTEGRALMENTE em 'dados_adicionais_nf'.\n\nITENS DO QUADRO 'DADOS DOS PRODUTOS / SERVIÇOS' (obrigatório para DANFE de mercadoria): leia TODAS as linhas da tabela de produtos e devolva UMA entrada por linha em 'itens', com descricao (coluna DESCRIÇÃO DOS PRODUTOS/SERVIÇOS), quantidade (coluna QUANT.), unidade (coluna UN / UNID — ex.: KG, T, UN, PC, M, M2, M3, L; sempre MAIÚSCULAS) e valor_unitario (coluna VALOR UNIT.). A UNIDADE É OBRIGATÓRIA E DEVE SER LIDA LINHA A LINHA, na mesma linha do item — NUNCA repita a unidade do primeiro item nem assuma uma unidade padrão. Normalizar unidades: M²/M2/MC -> m3 (para concreto), TON -> ton, KG -> kg, L -> l. Datas em YYYY-MM-DD; peso em kg (número).\n\nCLASSIFICAÇÃO OBRIGATÓRIA de tipo_nota:\n- 'produto' → DANFE de mercadoria (bloco DESTINATÁRIO/REMETENTE, natureza VENDA/REMESSA/TRANSFERÊNCIA, quadro DADOS DOS PRODUTOS). Preencha 'destinatario' com a razão social do bloco DESTINATÁRIO/REMETENTE e SEMPRE preencha 'itens' + 'descricao'.\n- 'servico' → NF de serviço/NFS-e (bloco CONTRATANTE ou prestação de serviço). Preencha 'contratante'.\n- 'cte' → DACTE / CT-e (contém 'CONHECIMENTO DE TRANSPORTE ELETRÔNICO', modelo 57, blocos TOMADOR DO SERVIÇO, REMETENTE, DESTINATÁRIO, EXPEDIDOR/RECEBEDOR, PRODUTO PREDOMINANTE, VALOR TOTAL DA PRESTAÇÃO DO SERVIÇO). Nesse caso: preencha 'tomador' e 'remetente'; preencha 'produto_predominante' com o campo PRODUTO PREDOMINANTE do DACTE; preencha 'descricao' com o mesmo valor do produto predominante; adicione UM item em 'itens' com descricao = produto predominante, quantidade (se houver, ex. em campo QTDE/UNID), unidade (unidade informada, ex. KG/T) e valor_unitario = VALOR TOTAL DA PRESTAÇÃO; 'valor_total_nf' = VALOR TOTAL DA PRESTAÇÃO DO SERVIÇO; peso_kg = peso bruto informado no CT-e (campo PESO BRUTO KG).\n- 'nao_fiscal' → documento SEM validade fiscal: não tem chave de acesso de 44 dígitos, não tem tributos/ICMS e não tem quadro 'DADOS DOS PRODUTOS'. Exemplos: 'COMPROVANTE DE ABASTECIMENTO DE ÁGUA ATRAVÉS DE CAMINHÕES-PIPA', romaneio, ticket ou recibo de entrega. Nesse caso preencha 'documento_nao_fiscal'=true; 'numero_nota' = Nº do protocolo/documento; 'emissor' = empresa emissora do comprovante (quem forneceu/abasteceu); 'transportadora' = empresa proprietária do veículo; 'placa' = placa do veículo; 'motorista' = nome do motorista; 'emissao' = data do documento; 'descricao' = objeto do documento (ex.: ABASTECIMENTO DE ÁGUA); e 'produto_categoria'='agua' quando se tratar de água. Não invente chave, valores nem itens.\n- 'desconhecido' se não conseguir classificar.\n\nSe a foto mostrar APENAS o quadro 'DADOS DOS PRODUTOS / SERVIÇOS' (recorte), assuma tipo_nota='produto', extraia os itens e devolva os demais campos vazios.",
          },

          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados deste documento fiscal (DANFE, NFS-e ou DACTE/CT-e)." },
              anexo,
            ],

          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extrair_nota",
              description: "Retorna os campos extraídos da DANFE",
              parameters: OCR_SCHEMA,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extrair_nota" } },
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error("[ocr] gateway error", resp.status, body);
      if (resp.status === 429) return { ok: false, motivo: "Limite de requisições atingido. Tente em alguns segundos." };
      if (resp.status === 402) return { ok: false, motivo: "Créditos de IA esgotados." };
      if (resp.status === 400) {
        const b = body.toLowerCase();
        if (b.includes("no pages") || b.includes("invalid") || b.includes("fetch")) {
          return {
            ok: false,
            motivo: isPdf
              ? "Não foi possível ler este PDF (pode estar protegido por senha, vazio ou corrompido). Envie uma foto/print da nota."
              : "Não foi possível ler esta imagem. Envie outra foto da nota.",
          };
        }
      }
      return { ok: false, motivo: `Falha no OCR (${resp.status}).` };
    }


    const json = (await resp.json()) as {
      choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { ok: false, motivo: "OCR não retornou dados." };
    try {
      const campos = JSON.parse(args) as CamposNota;

      // Normaliza nomes de empresas antes de qualquer consolidação/vínculo,
      // para que o casamento com fornecedores cadastrados seja estável.
      campos.emissor = normalizarNomeOpcional(campos.emissor);
      campos.transportadora = normalizarNomeOpcional(campos.transportadora);
      campos.contratante = normalizarNomeOpcional(campos.contratante);
      campos.destinatario = normalizarNomeOpcional(campos.destinatario);
      campos.tomador = normalizarNomeOpcional(campos.tomador);
      campos.remetente = normalizarNomeOpcional(campos.remetente);

      // Consolida contratante conforme tipo do documento:
      // - NF de produto → usa DESTINATÁRIO
      // - NF de serviço → mantém CONTRATANTE
      // - CT-e → usa TOMADOR DO SERVIÇO; descrição = PRODUTO PREDOMINANTE
      // - Fallback: se contratante vazio e houver destinatário, usa destinatário
      const destinatario = campos.destinatario?.trim();
      const contratante = campos.contratante?.trim();
      const tomador = campos.tomador?.trim();
      const produtoPred = campos.produto_predominante?.trim();
      if (campos.tipo_nota === "cte") {
        if (tomador) campos.contratante = tomador;
        else if (!contratante && destinatario) campos.contratante = destinatario;
        if (produtoPred && !campos.descricao?.trim()) campos.descricao = produtoPred;
        // garante ao menos um item para consistência com fluxo de mercadoria
        if ((!campos.itens || campos.itens.length === 0) && produtoPred) {
          campos.itens = [
            {
              descricao: produtoPred,
              quantidade: undefined,
              valor_unitario: campos.valor_total_nf,
            },
          ];
        }
      } else if (campos.tipo_nota === "produto" && destinatario) {
        campos.contratante = destinatario;
      } else if (!contratante && destinatario) {
        campos.contratante = destinatario;
      }
      // Fallback: se descricao vazia mas há itens, usa a descrição do 1º item
      if (!campos.descricao?.trim() && Array.isArray(campos.itens) && campos.itens.length > 0) {
        const primeira = campos.itens.find((it) => it?.descricao?.trim())?.descricao?.trim();
        if (primeira) campos.descricao = primeira;
      }

      return { ok: true, campos };
    } catch {
      return { ok: false, motivo: "Resposta inválida do OCR." };
    }
  });