export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      densidades_fornecedor: {
        Row: {
          created_at: string
          densidade: number
          densidade_material_id: string
          fornecedor_nome: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          densidade: number
          densidade_material_id: string
          fornecedor_nome: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          densidade?: number
          densidade_material_id?: string
          fornecedor_nome?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "densidades_fornecedor_densidade_material_id_fkey"
            columns: ["densidade_material_id"]
            isOneToOne: false
            referencedRelation: "densidades_material"
            referencedColumns: ["id"]
          },
        ]
      }
      densidades_material: {
        Row: {
          ativo: boolean
          created_at: string
          densidade: number
          id: string
          material: string
          ordem: number
          palavras_chave: string[]
          unidade_base: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          densidade: number
          id?: string
          material: string
          ordem?: number
          palavras_chave?: string[]
          unidade_base?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          densidade?: number
          id?: string
          material?: string
          ordem?: number
          palavras_chave?: string[]
          unidade_base?: string
          updated_at?: string
        }
        Relationships: []
      }
      evidencias: {
        Row: {
          created_at: string
          id: string
          nome: string
          pesagem_id: string
          storage_path: string
          tipo: Database["public"]["Enums"]["tipo_evidencia"]
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          pesagem_id: string
          storage_path: string
          tipo: Database["public"]["Enums"]["tipo_evidencia"]
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          pesagem_id?: string
          storage_path?: string
          tipo?: Database["public"]["Enums"]["tipo_evidencia"]
        }
        Relationships: [
          {
            foreignKeyName: "evidencias_pesagem_id_fkey"
            columns: ["pesagem_id"]
            isOneToOne: false
            referencedRelation: "pesagens"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores_concreto: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string | null
          emissor_keywords: string[] | null
          id: string
          nome: string
          observacoes: string | null
          teor_ar: number | null
          tolerancia_padrao: number
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string | null
          emissor_keywords?: string[] | null
          id?: string
          nome: string
          observacoes?: string | null
          teor_ar?: number | null
          tolerancia_padrao?: number
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string | null
          emissor_keywords?: string[] | null
          id?: string
          nome?: string
          observacoes?: string | null
          teor_ar?: number | null
          tolerancia_padrao?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      fornecedores_material: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      fornecedores_material_v2: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string | null
          created_by: string | null
          created_by_nome: string | null
          id: string
          origem: string
          razao_social: string
          updated_at: string | null
          vinculado: boolean
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_nome?: string | null
          id?: string
          origem?: string
          razao_social: string
          updated_at?: string | null
          vinculado?: boolean
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_nome?: string | null
          id?: string
          origem?: string
          razao_social?: string
          updated_at?: string | null
          vinculado?: boolean
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          destinatario_cnpj: string | null
          emissao: string | null
          emissor: string | null
          emissor_cnpj: string | null
          fonte: Database["public"]["Enums"]["fonte_nota"]
          id: string
          numero: string | null
          obra_id: string | null
          peso: number | null
          placa: string | null
          transportadora: string | null
          uf: string | null
          updated_at: string
          xml: string | null
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          destinatario_cnpj?: string | null
          emissao?: string | null
          emissor?: string | null
          emissor_cnpj?: string | null
          fonte?: Database["public"]["Enums"]["fonte_nota"]
          id?: string
          numero?: string | null
          obra_id?: string | null
          peso?: number | null
          placa?: string | null
          transportadora?: string | null
          uf?: string | null
          updated_at?: string
          xml?: string | null
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          destinatario_cnpj?: string | null
          emissao?: string | null
          emissor?: string | null
          emissor_cnpj?: string | null
          fonte?: Database["public"]["Enums"]["fonte_nota"]
          id?: string
          numero?: string | null
          obra_id?: string | null
          peso?: number | null
          placa?: string | null
          transportadora?: string | null
          uf?: string | null
          updated_at?: string
          xml?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_acessos: {
        Row: {
          created_at: string
          id: string
          obra_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          obra_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          obra_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_acessos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          ativo: boolean
          cnpj: string
          coligada: string
          created_at: string
          endereco: string | null
          engenheiro_email: string | null
          engenheiro_nome: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj: string
          coligada: string
          created_at?: string
          endereco?: string | null
          engenheiro_email?: string | null
          engenheiro_nome?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          coligada?: string
          created_at?: string
          endereco?: string | null
          engenheiro_email?: string | null
          engenheiro_nome?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      perfil_descricoes: {
        Row: {
          created_at: string
          descricao: string | null
          nome: string
          ordem: number
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          nome: string
          ordem?: number
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          nome?: string
          ordem?: number
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      perfil_menu_permissoes: {
        Row: {
          created_at: string
          id: string
          menu_key: string
          permitido: boolean
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_key: string
          permitido?: boolean
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_key?: string
          permitido?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      pesagem_logs: {
        Row: {
          alteracoes: Json | null
          created_at: string
          evento: string
          id: string
          justificativa: string | null
          pesagem_id: string
          usuario_email: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          alteracoes?: Json | null
          created_at?: string
          evento: string
          id?: string
          justificativa?: string | null
          pesagem_id: string
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          alteracoes?: Json | null
          created_at?: string
          evento?: string
          id?: string
          justificativa?: string | null
          pesagem_id?: string
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pesagem_logs_pesagem_id_fkey"
            columns: ["pesagem_id"]
            isOneToOne: false
            referencedRelation: "pesagens"
            referencedColumns: ["id"]
          },
        ]
      }
      pesagens: {
        Row: {
          aud_base_calculo_anterior: string | null
          aud_diferenca_kg_anterior: number | null
          aud_diferenca_pct_anterior: number | null
          aud_peso_esperado_anterior: number | null
          aud_status_anterior: string | null
          aud_tolerancia_anterior: number | null
          base_calculo: string | null
          carreta: string | null
          chave_nfe: string | null
          contratante: string | null
          created_at: string
          criado_por: string | null
          dados_adicionais_nf: string | null
          descricao: string | null
          diferenca_kg: number | null
          diferenca_pct: number | null
          emissao: string | null
          emissor: string | null
          entrou_em: string | null
          fonte_nota: Database["public"]["Enums"]["fonte_nota"]
          fonte_peso_entrada: Database["public"]["Enums"]["fonte_peso"] | null
          fonte_peso_saida: Database["public"]["Enums"]["fonte_peso"] | null
          fornecedor_confirmado_manual: boolean | null
          id: string
          is_padrao_fallback: boolean | null
          itens_nf: Json | null
          justificativa: string | null
          marca: string | null
          modelo: string | null
          modo_pesagem: string | null
          motorista: string | null
          numero_nota: string | null
          obra_id: string
          ocorrencia_em: string | null
          ocorrencia_por: string | null
          ocorrencia_relato: string | null
          ocorrencia_saida_em: string | null
          ocorrencia_saida_por: string | null
          ocorrencia_saida_relato: string | null
          ocorrencia_saida_tipo: string | null
          ocorrencia_saida_tipo_outro: string | null
          ocorrencia_tipo: string | null
          ocorrencia_tipo_outro: string | null
          peso_entrada: number | null
          peso_esperado: number | null
          peso_liquido: number | null
          peso_nf: number | null
          peso_saida: number | null
          placa: string | null
          qtd_total: number | null
          recalculado_em: string | null
          recalculo_versao: string | null
          requer_conferencia_eng: boolean | null
          resultado_afericao: Json | null
          saida_por: string | null
          saiu_em: string | null
          status: Database["public"]["Enums"]["status_pesagem"]
          status_afericao: string | null
          tara_informada: number | null
          tolerancia_aplicada: number | null
          traco_confirmado_manual: boolean | null
          traco_id: string | null
          transportadora: string | null
          uf: string | null
          updated_at: string
          valor_total_nf: number | null
          volume_derivado_detalhe: Json | null
          volume_m3: number | null
          volume_residuo: number | null
        }
        Insert: {
          aud_base_calculo_anterior?: string | null
          aud_diferenca_kg_anterior?: number | null
          aud_diferenca_pct_anterior?: number | null
          aud_peso_esperado_anterior?: number | null
          aud_status_anterior?: string | null
          aud_tolerancia_anterior?: number | null
          base_calculo?: string | null
          carreta?: string | null
          chave_nfe?: string | null
          contratante?: string | null
          created_at?: string
          criado_por?: string | null
          dados_adicionais_nf?: string | null
          descricao?: string | null
          diferenca_kg?: number | null
          diferenca_pct?: number | null
          emissao?: string | null
          emissor?: string | null
          entrou_em?: string | null
          fonte_nota?: Database["public"]["Enums"]["fonte_nota"]
          fonte_peso_entrada?: Database["public"]["Enums"]["fonte_peso"] | null
          fonte_peso_saida?: Database["public"]["Enums"]["fonte_peso"] | null
          fornecedor_confirmado_manual?: boolean | null
          id?: string
          is_padrao_fallback?: boolean | null
          itens_nf?: Json | null
          justificativa?: string | null
          marca?: string | null
          modelo?: string | null
          modo_pesagem?: string | null
          motorista?: string | null
          numero_nota?: string | null
          obra_id: string
          ocorrencia_em?: string | null
          ocorrencia_por?: string | null
          ocorrencia_relato?: string | null
          ocorrencia_saida_em?: string | null
          ocorrencia_saida_por?: string | null
          ocorrencia_saida_relato?: string | null
          ocorrencia_saida_tipo?: string | null
          ocorrencia_saida_tipo_outro?: string | null
          ocorrencia_tipo?: string | null
          ocorrencia_tipo_outro?: string | null
          peso_entrada?: number | null
          peso_esperado?: number | null
          peso_liquido?: number | null
          peso_nf?: number | null
          peso_saida?: number | null
          placa?: string | null
          qtd_total?: number | null
          recalculado_em?: string | null
          recalculo_versao?: string | null
          requer_conferencia_eng?: boolean | null
          resultado_afericao?: Json | null
          saida_por?: string | null
          saiu_em?: string | null
          status?: Database["public"]["Enums"]["status_pesagem"]
          status_afericao?: string | null
          tara_informada?: number | null
          tolerancia_aplicada?: number | null
          traco_confirmado_manual?: boolean | null
          traco_id?: string | null
          transportadora?: string | null
          uf?: string | null
          updated_at?: string
          valor_total_nf?: number | null
          volume_derivado_detalhe?: Json | null
          volume_m3?: number | null
          volume_residuo?: number | null
        }
        Update: {
          aud_base_calculo_anterior?: string | null
          aud_diferenca_kg_anterior?: number | null
          aud_diferenca_pct_anterior?: number | null
          aud_peso_esperado_anterior?: number | null
          aud_status_anterior?: string | null
          aud_tolerancia_anterior?: number | null
          base_calculo?: string | null
          carreta?: string | null
          chave_nfe?: string | null
          contratante?: string | null
          created_at?: string
          criado_por?: string | null
          dados_adicionais_nf?: string | null
          descricao?: string | null
          diferenca_kg?: number | null
          diferenca_pct?: number | null
          emissao?: string | null
          emissor?: string | null
          entrou_em?: string | null
          fonte_nota?: Database["public"]["Enums"]["fonte_nota"]
          fonte_peso_entrada?: Database["public"]["Enums"]["fonte_peso"] | null
          fonte_peso_saida?: Database["public"]["Enums"]["fonte_peso"] | null
          fornecedor_confirmado_manual?: boolean | null
          id?: string
          is_padrao_fallback?: boolean | null
          itens_nf?: Json | null
          justificativa?: string | null
          marca?: string | null
          modelo?: string | null
          modo_pesagem?: string | null
          motorista?: string | null
          numero_nota?: string | null
          obra_id?: string
          ocorrencia_em?: string | null
          ocorrencia_por?: string | null
          ocorrencia_relato?: string | null
          ocorrencia_saida_em?: string | null
          ocorrencia_saida_por?: string | null
          ocorrencia_saida_relato?: string | null
          ocorrencia_saida_tipo?: string | null
          ocorrencia_saida_tipo_outro?: string | null
          ocorrencia_tipo?: string | null
          ocorrencia_tipo_outro?: string | null
          peso_entrada?: number | null
          peso_esperado?: number | null
          peso_liquido?: number | null
          peso_nf?: number | null
          peso_saida?: number | null
          placa?: string | null
          qtd_total?: number | null
          recalculado_em?: string | null
          recalculo_versao?: string | null
          requer_conferencia_eng?: boolean | null
          resultado_afericao?: Json | null
          saida_por?: string | null
          saiu_em?: string | null
          status?: Database["public"]["Enums"]["status_pesagem"]
          status_afericao?: string | null
          tara_informada?: number | null
          tolerancia_aplicada?: number | null
          traco_confirmado_manual?: boolean | null
          traco_id?: string | null
          transportadora?: string | null
          uf?: string | null
          updated_at?: string
          valor_total_nf?: number | null
          volume_derivado_detalhe?: Json | null
          volume_m3?: number | null
          volume_residuo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pesagens_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesagens_traco_id_fkey"
            columns: ["traco_id"]
            isOneToOne: false
            referencedRelation: "tracos_concreto"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cargo: string | null
          created_at: string
          email: string | null
          engenheiro_todas_coligadas: boolean
          ativo: boolean
          id: string
          nome: string | null
          setor: string | null
          telefone: string | null
          updated_at: string
          whatsapp_e164: string | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          engenheiro_todas_coligadas?: boolean
          ativo?: boolean
          id: string
          nome?: string | null
          setor?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp_e164?: string | null
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          engenheiro_todas_coligadas?: boolean
          ativo?: boolean
          id?: string
          nome?: string | null
          setor?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp_e164?: string | null
        }
        Relationships: []
      }
      sefaz_certificados: {
        Row: {
          ambiente: string
          ativo: boolean
          certificado_nome: string | null
          cnpj: string
          created_at: string
          id: string
          notas_cache_count: number
          obra_id: string
          ultimo_nsu: string | null
          updated_at: string
          vault_secret_name: string | null
        }
        Insert: {
          ambiente?: string
          ativo?: boolean
          certificado_nome?: string | null
          cnpj: string
          created_at?: string
          id?: string
          notas_cache_count?: number
          obra_id: string
          ultimo_nsu?: string | null
          updated_at?: string
          vault_secret_name?: string | null
        }
        Update: {
          ambiente?: string
          ativo?: boolean
          certificado_nome?: string | null
          cnpj?: string
          created_at?: string
          id?: string
          notas_cache_count?: number
          obra_id?: string
          ultimo_nsu?: string | null
          updated_at?: string
          vault_secret_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sefaz_certificados_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      sucata_cfop: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string
          escopo: string
          id: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao: string
          escopo?: string
          id?: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string
          escopo?: string
          id?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      sucata_contas_obra: {
        Row: {
          agencia: string
          banco: string
          chave_pix: string | null
          coligada_origem: string
          conta: string
          created_at: string
          created_by: string | null
          id: string
          obra_id: string
          observacoes: string | null
          situacao: string
          tipo_conta: string
          titular: string
          titular_documento: string | null
          updated_at: string
        }
        Insert: {
          agencia: string
          banco: string
          chave_pix?: string | null
          coligada_origem: string
          conta: string
          created_at?: string
          created_by?: string | null
          id?: string
          obra_id: string
          observacoes?: string | null
          situacao?: string
          tipo_conta?: string
          titular: string
          titular_documento?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string
          banco?: string
          chave_pix?: string | null
          coligada_origem?: string
          conta?: string
          created_at?: string
          created_by?: string | null
          id?: string
          obra_id?: string
          observacoes?: string | null
          situacao?: string
          tipo_conta?: string
          titular?: string
          titular_documento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sucata_contas_obra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      sucata_destinatarios_relatorio: {
        Row: {
          ativo: boolean
          coligada: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          nome: string
          papel: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          coligada: string
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          nome: string
          papel?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          coligada?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          nome?: string
          papel?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sucata_eventos: {
        Row: {
          acao: string
          coligada_origem: string | null
          created_at: string
          entidade: string
          entidade_id: string | null
          fase: string | null
          id: string
          payload: Json
          processo_id: string | null
          usuario_email: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          coligada_origem?: string | null
          created_at?: string
          entidade: string
          entidade_id?: string | null
          fase?: string | null
          id?: string
          payload?: Json
          processo_id?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          coligada_origem?: string | null
          created_at?: string
          entidade?: string
          entidade_id?: string | null
          fase?: string | null
          id?: string
          payload?: Json
          processo_id?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sucata_eventos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "sucata_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      sucata_evidencias: {
        Row: {
          capturado_em: string
          capturado_por: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          motivo_substituicao: string | null
          posicao: number
          processo_id: string
          rotulo: string
          storage_path: string
          substituida_por: string | null
          updated_at: string
          versao: number
        }
        Insert: {
          capturado_em?: string
          capturado_por: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          motivo_substituicao?: string | null
          posicao: number
          processo_id: string
          rotulo: string
          storage_path: string
          substituida_por?: string | null
          updated_at?: string
          versao?: number
        }
        Update: {
          capturado_em?: string
          capturado_por?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          motivo_substituicao?: string | null
          posicao?: number
          processo_id?: string
          rotulo?: string
          storage_path?: string
          substituida_por?: string | null
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "sucata_evidencias_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "sucata_processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucata_evidencias_substituida_por_fkey"
            columns: ["substituida_por"]
            isOneToOne: false
            referencedRelation: "sucata_evidencias"
            referencedColumns: ["id"]
          },
        ]
      }
      sucata_notificacoes: {
        Row: {
          assunto: string
          created_at: string
          destinatario: string
          enviada_em: string | null
          erro: string | null
          id: string
          processo_id: string
          provider_message_id: string | null
          status: string
          tipo: string
        }
        Insert: {
          assunto: string
          created_at?: string
          destinatario: string
          enviada_em?: string | null
          erro?: string | null
          id?: string
          processo_id: string
          provider_message_id?: string | null
          status?: string
          tipo: string
        }
        Update: {
          assunto?: string
          created_at?: string
          destinatario?: string
          enviada_em?: string | null
          erro?: string | null
          id?: string
          processo_id?: string
          provider_message_id?: string | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sucata_notificacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "sucata_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      sucata_numeracao: {
        Row: {
          ano: number
          ultimo: number
        }
        Insert: {
          ano: number
          ultimo?: number
        }
        Update: {
          ano?: number
          ultimo?: number
        }
        Relationships: []
      }
      sucata_parametros: {
        Row: {
          chave: string
          descricao: string | null
          updated_at: string
          valor: string
        }
        Insert: {
          chave: string
          descricao?: string | null
          updated_at?: string
          valor: string
        }
        Update: {
          chave?: string
          descricao?: string | null
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      sucata_processos: {
        Row: {
          aceite_em: string | null
          aceite_email: string | null
          aceite_ip: unknown
          aceite_token_expira_em: string | null
          aceite_token_hash: string | null
          alerta_admin_em: string | null
          ano: number
          aprovacao_observacao: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          bruto_kg: number | null
          coligada_origem: string
          concluido_em: string | null
          concluido_por: string | null
          conta_obra_id: string | null
          contestacao_em: string | null
          contestacao_motivo: string | null
          created_at: string
          created_by: string | null
          descricao_carga: string | null
          devolucao_fase_origem: string | null
          devolucao_motivo: string | null
          devolvido_em: string | null
          devolvido_por: string | null
          documento_motorista: string | null
          entrada_em: string
          excluido_em: string | null
          excluido_por: string | null
          exclusao_motivo: string | null
          fase: string
          fases_registro: Json
          id: string
          motorista: string | null
          nfa_cfop: string | null
          nfa_emissao: string | null
          nfa_enviada_em: string | null
          nfa_exportada_em: string | null
          nfa_formulario: Json
          nfa_impedimento_motivo: string | null
          nfa_natureza_operacao: string | null
          nfa_numero: string | null
          nfa_solicitada_em: string | null
          nfa_storage_path: string | null
          notificado_em: string | null
          numero: string
          obra_id: string
          pagamento_comprovante_hash: string | null
          pagamento_conta_divergente: boolean
          pagamento_conta_lida: string | null
          pagamento_data: string | null
          pagamento_justificativa: string | null
          pagamento_valor: number | null
          peso_aferido_kg: number | null
          peso_deposito_kg: number | null
          placa: string
          reaberto_em: string | null
          reaberto_por: string | null
          reabertura_motivo: string | null
          recibo_modo: string | null
          recibo_valor_lido: number | null
          reenvio_em: string | null
          relatorio_versao: number
          saida_em: string | null
          saida_por: string | null
          situacao: string
          snapshot_fiscal: Json
          sucateiro_id: string
          tara_kg: number
          teste_manual: boolean
          tipo_sucata_id: string | null
          updated_at: string
          valor_ajustado_em: string | null
          valor_ajustado_por: string | null
          valor_ajuste_justificativa: string | null
          valor_por_tonelada: number | null
          valor_total: number | null
          valor_unitario_kg: number | null
          veiculo_id: string | null
        }
        Insert: {
          aceite_em?: string | null
          aceite_email?: string | null
          aceite_ip?: unknown
          aceite_token_expira_em?: string | null
          aceite_token_hash?: string | null
          alerta_admin_em?: string | null
          ano: number
          aprovacao_observacao?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          bruto_kg?: number | null
          coligada_origem: string
          concluido_em?: string | null
          concluido_por?: string | null
          conta_obra_id?: string | null
          contestacao_em?: string | null
          contestacao_motivo?: string | null
          created_at?: string
          created_by?: string | null
          descricao_carga?: string | null
          devolucao_fase_origem?: string | null
          devolucao_motivo?: string | null
          devolvido_em?: string | null
          devolvido_por?: string | null
          documento_motorista?: string | null
          entrada_em?: string
          excluido_em?: string | null
          excluido_por?: string | null
          exclusao_motivo?: string | null
          fase?: string
          fases_registro?: Json
          id?: string
          motorista?: string | null
          nfa_cfop?: string | null
          nfa_emissao?: string | null
          nfa_enviada_em?: string | null
          nfa_exportada_em?: string | null
          nfa_formulario?: Json
          nfa_impedimento_motivo?: string | null
          nfa_natureza_operacao?: string | null
          nfa_numero?: string | null
          nfa_solicitada_em?: string | null
          nfa_storage_path?: string | null
          notificado_em?: string | null
          numero: string
          obra_id: string
          pagamento_comprovante_hash?: string | null
          pagamento_conta_divergente?: boolean
          pagamento_conta_lida?: string | null
          pagamento_data?: string | null
          pagamento_justificativa?: string | null
          pagamento_valor?: number | null
          peso_aferido_kg?: number | null
          peso_deposito_kg?: number | null
          placa: string
          reaberto_em?: string | null
          reaberto_por?: string | null
          reabertura_motivo?: string | null
          recibo_modo?: string | null
          recibo_valor_lido?: number | null
          reenvio_em?: string | null
          relatorio_versao?: number
          saida_em?: string | null
          saida_por?: string | null
          situacao?: string
          snapshot_fiscal?: Json
          sucateiro_id: string
          tara_kg: number
          teste_manual?: boolean
          tipo_sucata_id?: string | null
          updated_at?: string
          valor_ajustado_em?: string | null
          valor_ajustado_por?: string | null
          valor_ajuste_justificativa?: string | null
          valor_por_tonelada?: number | null
          valor_total?: number | null
          valor_unitario_kg?: number | null
          veiculo_id?: string | null
        }
        Update: {
          aceite_em?: string | null
          aceite_email?: string | null
          aceite_ip?: unknown
          aceite_token_expira_em?: string | null
          aceite_token_hash?: string | null
          alerta_admin_em?: string | null
          ano?: number
          aprovacao_observacao?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          bruto_kg?: number | null
          coligada_origem?: string
          concluido_em?: string | null
          concluido_por?: string | null
          conta_obra_id?: string | null
          contestacao_em?: string | null
          contestacao_motivo?: string | null
          created_at?: string
          created_by?: string | null
          descricao_carga?: string | null
          devolucao_fase_origem?: string | null
          devolucao_motivo?: string | null
          devolvido_em?: string | null
          devolvido_por?: string | null
          documento_motorista?: string | null
          entrada_em?: string
          excluido_em?: string | null
          excluido_por?: string | null
          exclusao_motivo?: string | null
          fase?: string
          fases_registro?: Json
          id?: string
          motorista?: string | null
          nfa_cfop?: string | null
          nfa_emissao?: string | null
          nfa_enviada_em?: string | null
          nfa_exportada_em?: string | null
          nfa_formulario?: Json
          nfa_impedimento_motivo?: string | null
          nfa_natureza_operacao?: string | null
          nfa_numero?: string | null
          nfa_solicitada_em?: string | null
          nfa_storage_path?: string | null
          notificado_em?: string | null
          numero?: string
          obra_id?: string
          pagamento_comprovante_hash?: string | null
          pagamento_conta_divergente?: boolean
          pagamento_conta_lida?: string | null
          pagamento_data?: string | null
          pagamento_justificativa?: string | null
          pagamento_valor?: number | null
          peso_aferido_kg?: number | null
          peso_deposito_kg?: number | null
          placa?: string
          reaberto_em?: string | null
          reaberto_por?: string | null
          reabertura_motivo?: string | null
          recibo_modo?: string | null
          recibo_valor_lido?: number | null
          reenvio_em?: string | null
          relatorio_versao?: number
          saida_em?: string | null
          saida_por?: string | null
          situacao?: string
          snapshot_fiscal?: Json
          sucateiro_id?: string
          tara_kg?: number
          teste_manual?: boolean
          tipo_sucata_id?: string | null
          updated_at?: string
          valor_ajustado_em?: string | null
          valor_ajustado_por?: string | null
          valor_ajuste_justificativa?: string | null
          valor_por_tonelada?: number | null
          valor_total?: number | null
          valor_unitario_kg?: number | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sucata_processos_conta_obra_id_fkey"
            columns: ["conta_obra_id"]
            isOneToOne: false
            referencedRelation: "sucata_contas_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucata_processos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucata_processos_sucateiro_id_fkey"
            columns: ["sucateiro_id"]
            isOneToOne: false
            referencedRelation: "sucata_sucateiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucata_processos_tipo_sucata_id_fkey"
            columns: ["tipo_sucata_id"]
            isOneToOne: false
            referencedRelation: "sucata_tipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucata_processos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "sucata_veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      sucata_relatorios: {
        Row: {
          created_at: string
          enviado_em: string | null
          enviado_para: Json
          gerado_em: string
          gerado_por: string | null
          id: string
          processo_id: string
          storage_path: string
          updated_at: string
          versao: number
        }
        Insert: {
          created_at?: string
          enviado_em?: string | null
          enviado_para?: Json
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          processo_id: string
          storage_path: string
          updated_at?: string
          versao: number
        }
        Update: {
          created_at?: string
          enviado_em?: string | null
          enviado_para?: Json
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          processo_id?: string
          storage_path?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "sucata_relatorios_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "sucata_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      sucata_sucateiro_documentos: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          motivo_substituicao: string | null
          nome_arquivo: string | null
          storage_path: string
          sucateiro_id: string
          tipo: string
          validade: string | null
          versao: number
          vigente: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          motivo_substituicao?: string | null
          nome_arquivo?: string | null
          storage_path: string
          sucateiro_id: string
          tipo: string
          validade?: string | null
          versao?: number
          vigente?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          motivo_substituicao?: string | null
          nome_arquivo?: string | null
          storage_path?: string
          sucateiro_id?: string
          tipo?: string
          validade?: string | null
          versao?: number
          vigente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sucata_sucateiro_documentos_sucateiro_id_fkey"
            columns: ["sucateiro_id"]
            isOneToOne: false
            referencedRelation: "sucata_sucateiros"
            referencedColumns: ["id"]
          },
        ]
      }
      sucata_sucateiros: {
        Row: {
          agencia: string
          bairro: string
          banco: string
          cep: string
          chave_pix: string | null
          cnae: string | null
          cnpj: string | null
          coligada_origem: string
          complemento: string | null
          conta: string
          contato_responsavel: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          data_nascimento: string | null
          email_coleta: string
          email_financeiro: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logradouro: string
          municipio: string
          nome_completo: string | null
          nome_fantasia: string | null
          numero: string
          observacoes: string | null
          orgao_emissor: string | null
          razao_social: string | null
          rg: string | null
          situacao: string
          telefone: string
          tipo_conta: string
          tipo_pessoa: string
          titularidade: string
          uf: string
          updated_at: string
          valor_por_kg: number | null
        }
        Insert: {
          agencia: string
          bairro: string
          banco: string
          cep: string
          chave_pix?: string | null
          cnae?: string | null
          cnpj?: string | null
          coligada_origem: string
          complemento?: string | null
          conta: string
          contato_responsavel?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          email_coleta: string
          email_financeiro?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro: string
          municipio: string
          nome_completo?: string | null
          nome_fantasia?: string | null
          numero: string
          observacoes?: string | null
          orgao_emissor?: string | null
          razao_social?: string | null
          rg?: string | null
          situacao?: string
          telefone: string
          tipo_conta: string
          tipo_pessoa: string
          titularidade: string
          uf: string
          updated_at?: string
          valor_por_kg?: number | null
        }
        Update: {
          agencia?: string
          bairro?: string
          banco?: string
          cep?: string
          chave_pix?: string | null
          cnae?: string | null
          cnpj?: string | null
          coligada_origem?: string
          complemento?: string | null
          conta?: string
          contato_responsavel?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          email_coleta?: string
          email_financeiro?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string
          municipio?: string
          nome_completo?: string | null
          nome_fantasia?: string | null
          numero?: string
          observacoes?: string | null
          orgao_emissor?: string | null
          razao_social?: string | null
          rg?: string | null
          situacao?: string
          telefone?: string
          tipo_conta?: string
          tipo_pessoa?: string
          titularidade?: string
          uf?: string
          updated_at?: string
          valor_por_kg?: number | null
        }
        Relationships: []
      }
      sucata_tipos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
          valor_ton_max: number | null
          valor_ton_min: number | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
          valor_ton_max?: number | null
          valor_ton_min?: number | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
          valor_ton_max?: number | null
          valor_ton_min?: number | null
        }
        Relationships: []
      }
      sucata_veiculos: {
        Row: {
          capacidade_kg: number | null
          created_at: string
          created_by: string | null
          id: string
          motorista_habitual: string | null
          placa: string
          situacao: string
          sucateiro_id: string
          tipo_veiculo: string | null
          updated_at: string
        }
        Insert: {
          capacidade_kg?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          motorista_habitual?: string | null
          placa: string
          situacao?: string
          sucateiro_id: string
          tipo_veiculo?: string | null
          updated_at?: string
        }
        Update: {
          capacidade_kg?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          motorista_habitual?: string | null
          placa?: string
          situacao?: string
          sucateiro_id?: string
          tipo_veiculo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sucata_veiculos_sucateiro_id_fkey"
            columns: ["sucateiro_id"]
            isOneToOne: false
            referencedRelation: "sucata_sucateiros"
            referencedColumns: ["id"]
          },
        ]
      }
      tolerancias_fornecedor: {
        Row: {
          created_at: string
          fornecedor_id: string
          id: string
          tolerancia: number
          tolerancia_material_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fornecedor_id: string
          id?: string
          tolerancia: number
          tolerancia_material_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fornecedor_id?: string
          id?: string
          tolerancia?: number
          tolerancia_material_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tolerancias_fornecedor_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores_material"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tolerancias_fornecedor_tolerancia_material_id_fkey"
            columns: ["tolerancia_material_id"]
            isOneToOne: false
            referencedRelation: "tolerancias_material"
            referencedColumns: ["id"]
          },
        ]
      }
      tolerancias_fornecedor_v2: {
        Row: {
          created_at: string | null
          fornecedor_id: string
          id: string
          tolerancia: number
          tolerancia_padrao_id: string
        }
        Insert: {
          created_at?: string | null
          fornecedor_id: string
          id?: string
          tolerancia: number
          tolerancia_padrao_id: string
        }
        Update: {
          created_at?: string | null
          fornecedor_id?: string
          id?: string
          tolerancia?: number
          tolerancia_padrao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tolerancias_fornecedor_v2_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores_material_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tolerancias_fornecedor_v2_tolerancia_padrao_id_fkey"
            columns: ["tolerancia_padrao_id"]
            isOneToOne: false
            referencedRelation: "tolerancias_padrao"
            referencedColumns: ["id"]
          },
        ]
      }
      tolerancias_material: {
        Row: {
          categoria: string
          condicao: string
          created_at: string
          id: string
          palavras_chave: string
          tolerancia_pct: number
          updated_at: string
        }
        Insert: {
          categoria: string
          condicao: string
          created_at?: string
          id?: string
          palavras_chave?: string
          tolerancia_pct?: number
          updated_at?: string
        }
        Update: {
          categoria?: string
          condicao?: string
          created_at?: string
          id?: string
          palavras_chave?: string
          tolerancia_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      tolerancias_padrao: {
        Row: {
          categoria: string
          condicao: string
          created_at: string | null
          id: string
          ordem: number | null
          palavras_chave: string | null
          tolerancia: number
        }
        Insert: {
          categoria: string
          condicao?: string
          created_at?: string | null
          id?: string
          ordem?: number | null
          palavras_chave?: string | null
          tolerancia?: number
        }
        Update: {
          categoria?: string
          condicao?: string
          created_at?: string | null
          id?: string
          ordem?: number | null
          palavras_chave?: string | null
          tolerancia?: number
        }
        Relationships: []
      }
      tracos_concreto: {
        Row: {
          aplicacao: string | null
          ativo: boolean
          carta_arquivo_url: string | null
          codigo: string | null
          consumo_cimento: number | null
          created_at: string | null
          densidade_pratica: number | null
          densidade_teorica: number | null
          fck: number | null
          fornecedor_id: string
          id: string
          match_keywords: string[] | null
          slump_nominal: number | null
          slump_tolerancia: number | null
          slump_unidade: string | null
          tolerancia_peso: number | null
          updated_at: string | null
        }
        Insert: {
          aplicacao?: string | null
          ativo?: boolean
          carta_arquivo_url?: string | null
          codigo?: string | null
          consumo_cimento?: number | null
          created_at?: string | null
          densidade_pratica?: number | null
          densidade_teorica?: number | null
          fck?: number | null
          fornecedor_id: string
          id?: string
          match_keywords?: string[] | null
          slump_nominal?: number | null
          slump_tolerancia?: number | null
          slump_unidade?: string | null
          tolerancia_peso?: number | null
          updated_at?: string | null
        }
        Update: {
          aplicacao?: string | null
          ativo?: boolean
          carta_arquivo_url?: string | null
          codigo?: string | null
          consumo_cimento?: number | null
          created_at?: string | null
          densidade_pratica?: number | null
          densidade_teorica?: number | null
          fck?: number | null
          fornecedor_id?: string
          id?: string
          match_keywords?: string[] | null
          slump_nominal?: number | null
          slump_tolerancia?: number | null
          slump_unidade?: string | null
          tolerancia_peso?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracos_concreto_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores_concreto"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuario_coligadas: {
        Row: {
          codcoligada: string
          created_at: string
          engenheiro_responsavel: boolean
          id: string
          nome: string | null
          user_id: string
        }
        Insert: {
          codcoligada: string
          created_at?: string
          engenheiro_responsavel?: boolean
          id?: string
          nome?: string | null
          user_id: string
        }
        Update: {
          codcoligada?: string
          created_at?: string
          engenheiro_responsavel?: boolean
          id?: string
          nome?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_alertas: {
        Row: {
          campos_enviados: Json | null
          coligada: string | null
          created_at: string
          created_by: string | null
          destinatario_email: string | null
          destinatario_nome: string | null
          destinatario_user_id: string | null
          erro_detalhe: string | null
          id: string
          mensagem_texto: string | null
          meta_message_id: string | null
          obra_id: string | null
          ocorrencia_ref: string | null
          pesagem_id: string
          placa: string | null
          reenvio_manual: boolean
          status: string
          telefone: string | null
          template: string | null
          template_id: string | null
          template_idioma: string | null
          template_nome_real: string | null
          tipo_alerta: string
          updated_at: string
          variaveis: Json
        }
        Insert: {
          campos_enviados?: Json | null
          coligada?: string | null
          created_at?: string
          created_by?: string | null
          destinatario_email?: string | null
          destinatario_nome?: string | null
          destinatario_user_id?: string | null
          erro_detalhe?: string | null
          id?: string
          mensagem_texto?: string | null
          meta_message_id?: string | null
          obra_id?: string | null
          ocorrencia_ref?: string | null
          pesagem_id: string
          placa?: string | null
          reenvio_manual?: boolean
          status?: string
          telefone?: string | null
          template?: string | null
          template_id?: string | null
          template_idioma?: string | null
          template_nome_real?: string | null
          tipo_alerta?: string
          updated_at?: string
          variaveis?: Json
        }
        Update: {
          campos_enviados?: Json | null
          coligada?: string | null
          created_at?: string
          created_by?: string | null
          destinatario_email?: string | null
          destinatario_nome?: string | null
          destinatario_user_id?: string | null
          erro_detalhe?: string | null
          id?: string
          mensagem_texto?: string | null
          meta_message_id?: string | null
          obra_id?: string | null
          ocorrencia_ref?: string | null
          pesagem_id?: string
          placa?: string | null
          reenvio_manual?: boolean
          status?: string
          telefone?: string | null
          template?: string | null
          template_id?: string | null
          template_idioma?: string | null
          template_nome_real?: string | null
          tipo_alerta?: string
          updated_at?: string
          variaveis?: Json
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_alertas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_alertas_pesagem_id_fkey"
            columns: ["pesagem_id"]
            isOneToOne: false
            referencedRelation: "pesagens"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_automacao_config: {
        Row: {
          created_at: string
          debug_mode: boolean | null
          horario_fim: string | null
          horario_inicio: string | null
          ia_max_tokens: number | null
          ia_modelo: string | null
          ia_prompt_base: string | null
          ia_temperatura: number | null
          id: string
          msg_fora_horario: string | null
          notif_docs_recebidos: boolean | null
          notif_email: string | null
          notif_erros: boolean | null
          notif_novas_msgs: boolean | null
          notif_relatorio_diario: boolean | null
          respostas_automaticas: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          debug_mode?: boolean | null
          horario_fim?: string | null
          horario_inicio?: string | null
          ia_max_tokens?: number | null
          ia_modelo?: string | null
          ia_prompt_base?: string | null
          ia_temperatura?: number | null
          id?: string
          msg_fora_horario?: string | null
          notif_docs_recebidos?: boolean | null
          notif_email?: string | null
          notif_erros?: boolean | null
          notif_novas_msgs?: boolean | null
          notif_relatorio_diario?: boolean | null
          respostas_automaticas?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          debug_mode?: boolean | null
          horario_fim?: string | null
          horario_inicio?: string | null
          ia_max_tokens?: number | null
          ia_modelo?: string | null
          ia_prompt_base?: string | null
          ia_temperatura?: number | null
          id?: string
          msg_fora_horario?: string | null
          notif_docs_recebidos?: boolean | null
          notif_email?: string | null
          notif_erros?: boolean | null
          notif_novas_msgs?: boolean | null
          notif_relatorio_diario?: boolean | null
          respostas_automaticas?: Json
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          alerta_template_id: string | null
          alerta_template_idioma: string | null
          alerta_template_nome: string | null
          alertas_tolerancia_ativo: boolean
          api_token: string | null
          api_url: string | null
          created_at: string
          id: string
          instance_name: string | null
          is_active: boolean
          meta_display_name: string | null
          meta_phone_number_id: string | null
          meta_waba_id: string | null
          provedor: string
          sender_id: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          alerta_template_id?: string | null
          alerta_template_idioma?: string | null
          alerta_template_nome?: string | null
          alertas_tolerancia_ativo?: boolean
          api_token?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          is_active?: boolean
          meta_display_name?: string | null
          meta_phone_number_id?: string | null
          meta_waba_id?: string | null
          provedor?: string
          sender_id?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          alerta_template_id?: string | null
          alerta_template_idioma?: string | null
          alerta_template_nome?: string | null
          alertas_tolerancia_ativo?: boolean
          api_token?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          is_active?: boolean
          meta_display_name?: string | null
          meta_phone_number_id?: string | null
          meta_waba_id?: string | null
          provedor?: string
          sender_id?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_mensagens: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_whatsapp: string
          created_at: string
          created_by: string | null
          direcao: string
          id: string
          mensagem: string
          obra_id: string | null
          provider_message_id: string | null
          status: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_whatsapp: string
          created_at?: string
          created_by?: string | null
          direcao?: string
          id?: string
          mensagem: string
          obra_id?: string | null
          provider_message_id?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_whatsapp?: string
          created_at?: string
          created_by?: string | null
          direcao?: string
          id?: string
          mensagem?: string
          obra_id?: string | null
          provider_message_id?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_numeros: {
        Row: {
          api_token: string | null
          api_url: string | null
          created_at: string
          enviados_hoje: number
          health_score: number
          id: string
          instance_name: string | null
          janela_fim: string | null
          janela_inicio: string | null
          label: string
          limite_diario: number
          prioridade: number
          provedor: string
          reset_at: string
          sender_id: string | null
          status: string
          ultima_falha_em: string | null
          ultimo_check_em: string | null
          updated_at: string
        }
        Insert: {
          api_token?: string | null
          api_url?: string | null
          created_at?: string
          enviados_hoje?: number
          health_score?: number
          id?: string
          instance_name?: string | null
          janela_fim?: string | null
          janela_inicio?: string | null
          label: string
          limite_diario?: number
          prioridade?: number
          provedor?: string
          reset_at?: string
          sender_id?: string | null
          status?: string
          ultima_falha_em?: string | null
          ultimo_check_em?: string | null
          updated_at?: string
        }
        Update: {
          api_token?: string | null
          api_url?: string | null
          created_at?: string
          enviados_hoje?: number
          health_score?: number
          id?: string
          instance_name?: string | null
          janela_fim?: string | null
          janela_inicio?: string | null
          label?: string
          limite_diario?: number
          prioridade?: number
          provedor?: string
          reset_at?: string
          sender_id?: string | null
          status?: string
          ultima_falha_em?: string | null
          ultimo_check_em?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          funcao_key: string
          funcao_label: string
          id: string
          sender_id: string | null
          sender_phone: string | null
          sender_status: string | null
          template_id: string | null
          updated_at: string
          variaveis: string[]
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          funcao_key: string
          funcao_label: string
          id?: string
          sender_id?: string | null
          sender_phone?: string | null
          sender_status?: string | null
          template_id?: string | null
          updated_at?: string
          variaveis?: string[]
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          funcao_key?: string
          funcao_label?: string
          id?: string
          sender_id?: string | null
          sender_phone?: string | null
          sender_status?: string | null
          template_id?: string | null
          updated_at?: string
          variaveis?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dashboard_recebimento: {
        Args: { _fim: string; _ini: string; _obra_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pode_ler_obra: { Args: { _obra_id: string }; Returns: boolean }
      pode_ver_coligada: { Args: { _cod: string }; Returns: boolean }
      pode_ver_obra_coligada: { Args: { _obra_id: string }; Returns: boolean }
      sucata_pode_escrever: { Args: never; Returns: boolean }
      sucata_pode_ler: { Args: never; Returns: boolean }
      sucata_posicao_faltante_bloco_a: {
        Args: { _processo_id: string }
        Returns: number
      }
      sucata_proximo_numero: { Args: { _ano: number }; Returns: string }
      sucata_valida_cnpj: { Args: { _cnpj: string }; Returns: boolean }
      sucata_valida_cpf: { Args: { _cpf: string }; Returns: boolean }
      tem_acesso_obra: { Args: { _obra_id: string }; Returns: boolean }
      usuario_do_app: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "operador"
        | "coordenador"
        | "superadmin"
        | "contador"
        | "administrativo_obra"
      fonte_nota: "sefaz" | "ocr" | "ocr_pendente" | "manual"
      fonte_peso: "balanca" | "manual"
      status_pesagem:
        | "aguardando_saida"
        | "concluida"
        | "recusado"
        | "fechada_com_ocorrencia"
        | "aguardando_saida_ocorrencia"
      tipo_evidencia:
        | "placa"
        | "carga"
        | "lateral"
        | "nota"
        | "outro"
        | "ocorrencia"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "operador",
        "coordenador",
        "superadmin",
        "contador",
        "administrativo_obra",
      ],
      fonte_nota: ["sefaz", "ocr", "ocr_pendente", "manual"],
      fonte_peso: ["balanca", "manual"],
      status_pesagem: [
        "aguardando_saida",
        "concluida",
        "recusado",
        "fechada_com_ocorrencia",
        "aguardando_saida_ocorrencia",
      ],
      tipo_evidencia: [
        "placa",
        "carga",
        "lateral",
        "nota",
        "outro",
        "ocorrencia",
      ],
    },
  },
} as const
