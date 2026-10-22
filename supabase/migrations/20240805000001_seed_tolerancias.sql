-- Inserindo valores padrões na tabela de tolerâncias (Modelo de Herança)
INSERT INTO public.tolerancias_padrao (categoria, condicao, palavras_chave, tolerancia, ordem) VALUES
('Aço', 'Seco', 'ACO,CA50,CA60,VERGALHAO,BARRA RETA,BOBINA', 1, 1),
('Areia', 'Seco', 'AREIA,AREOLA,LAVADA,BRANCA', 2, 2),
('Areia', 'Úmido', 'AREIA,AREOLA,LAVADA,BRANCA', 4, 3),
('Brita', 'Seco', 'BRITA,PEDRA,PEDRISCO,PO DE PEDRA', 2, 4),
('Cimento', 'Seco', 'CIMENTO,CP II,CP III', 1, 5),
('Madeira', 'Seco', 'MADEIRA,TABUA,SARRAFO,PONTALETE', 3, 6),
('Solo/Terra', 'Seco', 'TERRA,BARRO,SAIBRO,SOLO', 5, 7),
('Solo/Terra', 'Úmido', 'TERRA,BARRO,SAIBRO,SOLO', 8, 8),
('Argamassa', 'Seco', 'ARGAMASSA,REBOCO,ASSENTAMENTO', 2, 9),
('Gesso', 'Seco', 'GESSO,PLAQUINHA,COLA', 2, 10),
('Cerâmica', 'Seco', 'PISO,REVESTIMENTO,PORCELANATO,AZULEJO', 2, 11),
('Bloco/Tijolo', 'Seco', 'BLOCO,TIJOLO,ESTRUTURAL,VEDACAO', 3, 12)
ON CONFLICT (categoria, condicao) DO UPDATE SET 
  palavras_chave = EXCLUDED.palavras_chave,
  tolerancia = EXCLUDED.tolerancia;
